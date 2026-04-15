# MiroFish V2

LLM-powered social simulation platform. Agents with distinct personalities interact in simulated social media environments, generating emergent narratives and evolving knowledge graphs.

## Features

- **Social Simulation** -- Describe a scenario, AI spawns agents with unique personas and simulates their interactions
- **Knowledge Graph** -- Entities and relationships are extracted in real-time, visualized as an interactive graph (React Flow)
- **Social Context Grounding** -- Optionally provide your real-world context (location, age, occupation) to ground the simulation
- **Persistent Memory** -- Vector-based memory via Hindsight stores simulation facts for context-rich agent behavior
- **Live Feed** -- WebSocket-powered real-time feed of agent posts as the simulation runs

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12, FastAPI, uvicorn, httpx |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind v4, Shadcn/UI |
| Graph Viz | React Flow (@xyflow/react) |
| Memory | Hindsight (vectorize.io) -- Docker |
| LLM | OpenAI-compatible API (tested with Ingham / Gemma) |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/kvk-og/MiroFish-V2.git
cd MiroFish-V2

# 2. Set your LLM API key
cp .env.example .env
# Edit .env with your API key and endpoint

# 3. Launch everything
docker compose up -d

# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000
# Hindsight: http://localhost:9999 (UI)
```

## Architecture

```
Browser (:3000)
  └─> nginx → React SPA
        └─> FastAPI (:8000)
              ├─> Ingham API (LLM)
              └─> Hindsight (:8888, vector memory)
```

## Configuration

Environment variables (set in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | Your LLM API key | Required |
| `LLM_BASE_URL` | OpenAI-compatible endpoint | `https://api.ingham.ai/v1` |
| `LLM_MODEL_NAME` | Model identifier | `google/gemma-4-26B-A4B-it` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/simulation/create` | Create simulation with scenario + optional social context |
| `POST` | `/simulation/{id}/start` | Start simulation |
| `POST` | `/simulation/{id}/pause` | Pause |
| `POST` | `/simulation/{id}/resume` | Resume |
| `POST` | `/simulation/{id}/stop` | Stop |
| `GET` | `/simulation/{id}/status` | Current round, status, agent count |
| `GET` | `/simulation/{id}/graph` | Knowledge graph (nodes + edges) |
| `GET` | `/simulation/{id}/feed` | Agent activity feed |
| `WS` | `/ws/{id}` | Real-time WebSocket updates |

## License

MIT
