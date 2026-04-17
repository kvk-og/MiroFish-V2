"""
MiroFish V2 - Main FastAPI Application
"""

import asyncio
import json
import logging
import os
import uuid
from typing import Dict, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .core.ingham_client import InghamClient
from .core.hindsight_client import HindsightClient
from .services.orchestrator import SimulationOrchestrator
from .services.agent_manager import AgentManager
from .services.simulation_runner import SimulationRunner, SimulationStatus
from .services.document_parser import parse_document
from .db.database import init_db, save_simulation, get_simulations, get_simulation

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Global State ---

ingham = InghamClient()
hindsight = HindsightClient()
orchestrator = SimulationOrchestrator(ingham, hindsight)

# Active simulations: sim_id -> SimulationRunner
simulations: Dict[str, SimulationRunner] = {}

# WebSocket connections: sim_id -> list of WebSocket
ws_connections: Dict[str, list] = {}


# --- App Lifespan ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MiroFish V2 API starting up...")
    init_db()
    yield
    logger.info("MiroFish V2 API shutting down...")


app = FastAPI(title="MiroFish V2 API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Broadcast Helper ---

async def broadcast_event(sim_id: str, data: dict):
    """Push events to all connected WebSocket clients for a simulation."""
    if sim_id in ws_connections:
        dead = []
        for ws in ws_connections[sim_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            ws_connections[sim_id].remove(ws)


# --- REST Endpoints ---

@app.get("/health")
async def health():
    return {"status": "online", "engine": os.getenv("LLM_MODEL_NAME", "unknown"), "memory": os.getenv("HINDSIGHT_MODE", "memory"), "version": "2.0.0"}


@app.post("/simulation/survey_questions")
async def generate_survey_questions(payload: dict):
    scenario = payload.get("scenario")
    if not scenario:
        raise HTTPException(status_code=400, detail="scenario is required")
    questions = await orchestrator.generate_survey_questions(scenario)
    return {"questions": questions}


@app.post("/simulation/upload_context")
async def upload_context(file: UploadFile = File(...)):
    contents = await file.read()
    text = parse_document(contents, file.filename)
    return {"filename": file.filename, "extracted_text": text}


@app.post("/simulation/create")
async def create_simulation(payload: dict):
    """
    Create and initialize a new simulation.
    Body: {
        "scenario": "...",
        "platform": "twitter"|"reddit",
        "max_rounds": 10,
        "num_agents": 3,
        "speed_ms": 3000,
        "user_profile": {            <-- optional
            "location": "...",
            "age": 30,
            "occupation": "...",
            "social_handles": {...},
            "social_factors": {...}
        }
    }
    """
    scenario = payload.get("scenario")
    if not scenario:
        raise HTTPException(status_code=400, detail="scenario is required")

    platform = payload.get("platform", "twitter")
    max_rounds = payload.get("max_rounds", 10)
    num_agents = payload.get("num_agents", 3)
    speed_ms = payload.get("speed_ms", 3000)
    user_profile = payload.get("user_profile")  # optional

    sim_id = f"sim_{uuid.uuid4().hex[:12]}"

    # Step 1: Initialize world via LLM + Hindsight (with optional social context)
    result = await orchestrator.initialize_world(
        scenario,
        num_agents=num_agents,
        user_profile=user_profile,
    )
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])

    # Step 2: Spawn agents
    agent_mgr = AgentManager()
    agent_mgr.spawn_agents(result["agents"], platform=platform)

    # Step 3: Create runner with initial knowledge graph
    initial_graph = result.get("initial_graph", {"nodes": [], "edges": []})
    runner = SimulationRunner(
        sim_id=sim_id,
        ingham=ingham,
        hindsight=hindsight,
        agent_manager=agent_mgr,
        broadcast_fn=lambda data, sid=sim_id: broadcast_event(sid, data),
        initial_graph=initial_graph,
    )
    runner.max_rounds = max_rounds
    runner.speed_ms = speed_ms
    runner.world_facts = result["world_facts"]
    runner.scenario = scenario
    runner.platform = platform

    simulations[sim_id] = runner

    response = {
        "simulation_id": sim_id,
        "status": "created",
        "world_facts": result["world_facts"],
        "agents": [{"id": a.id, "name": a.name, "bio": a.bio} for a in agent_mgr.list_agents()],
    }
    if result.get("social_context"):
        response["social_context"] = result["social_context"]
    if initial_graph.get("nodes"):
        response["initial_graph"] = initial_graph

    return response


@app.post("/simulation/{sim_id}/start")
async def start_simulation(sim_id: str):
    runner = simulations.get(sim_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if runner.status == SimulationStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Already running")

    asyncio.create_task(runner.run())
    return {"simulation_id": sim_id, "status": "running"}


@app.post("/simulation/{sim_id}/pause")
async def pause_simulation(sim_id: str):
    runner = simulations.get(sim_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Simulation not found")
    runner.pause()
    return {"simulation_id": sim_id, "status": "paused"}


@app.post("/simulation/{sim_id}/resume")
async def resume_simulation(sim_id: str):
    runner = simulations.get(sim_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Simulation not found")
    runner.resume()
    asyncio.create_task(runner.run())
    return {"simulation_id": sim_id, "status": "running"}


@app.post("/simulation/{sim_id}/stop")
async def stop_simulation(sim_id: str):
    runner = simulations.get(sim_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Simulation not found")
    runner.stop()
    return {"simulation_id": sim_id, "status": "stopped"}


@app.get("/simulation/{sim_id}/status")
async def get_status(sim_id: str):
    runner = simulations.get(sim_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {
        "simulation_id": sim_id,
        "status": runner.status.value,
        "current_round": runner.current_round,
        "max_rounds": runner.max_rounds,
        "agents": len(runner.agents.list_agents()),
    }


@app.get("/simulation/{sim_id}/feed")
async def get_feed(sim_id: str, limit: int = 50):
    runner = simulations.get(sim_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"feed": runner.agents.get_feed(limit=limit)}


@app.get("/simulation/{sim_id}/graph")
async def get_graph(sim_id: str):
    """Return the current knowledge graph for a simulation."""
    runner = simulations.get(sim_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {
        "simulation_id": sim_id,
        "round": runner.current_round,
        "graph": runner.graph,
    }


@app.get("/simulation/{sim_id}/report")
async def get_report(sim_id: str):
    """Generate and return a final GO/NO-GO report for the simulation."""
    runner = simulations.get(sim_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    feed = runner.agents.get_feed(limit=1000)
    facts = getattr(runner, "world_facts", [])
    
    report = await orchestrator.generate_sim_report(facts=facts, feed=feed)
    
    # Save to history
    save_simulation(
        sim_id=sim_id,
        scenario=getattr(runner, "scenario", "Unknown"),
        platform=getattr(runner, "platform", "unknown"),
        decision=report.get("decision", "UNKNOWN"),
        summary=report.get("summary", ""),
        report_analytics=report.get("analytics"),
        graph=runner.graph,
        feed=feed,
        agents=[{"id": a.id, "name": a.name, "bio": a.bio, "platform": a.platform} for a in runner.agents.list_agents()]
    )
    
    return {
        "simulation_id": sim_id,
        "report": report
    }


@app.get("/simulations/history")
async def fetch_history():
    return {"simulations": get_simulations()}


@app.get("/simulations/history/{sim_id}")
async def fetch_historical_simulation(sim_id: str):
    sim = get_simulation(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Historical simulation not found")
    return {"simulation": sim}


# --- WebSocket Endpoint ---

@app.websocket("/ws/{sim_id}")
async def websocket_endpoint(ws: WebSocket, sim_id: str):
    await ws.accept()
    if sim_id not in ws_connections:
        ws_connections[sim_id] = []
    ws_connections[sim_id].append(ws)

    try:
        while True:
            # Keep connection alive; client can send pings
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_json({"event": "pong"})
    except WebSocketDisconnect:
        ws_connections[sim_id].remove(ws)
