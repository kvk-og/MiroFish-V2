"""
Simulation Runner
The async engine that drives agent behavior round by round.
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from enum import Enum

from ..core.ingham_client import InghamClient
from ..core.hindsight_client import HindsightClient
from .agent_manager import AgentManager, AgentPersona, AgentAction
from .graph_extractor import extract_relationships

logger = logging.getLogger(__name__)


class SimulationStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    COMPLETED = "completed"
    FAILED = "failed"


class SimulationRunner:
    """
    Drives the simulation loop:
    1. Pick an agent
    2. Retrieve context from Hindsight
    3. Generate action via Ingham
    4. Record action
    5. Update memory
    6. Broadcast to frontend
    7. After each round, update knowledge graph
    """

    def __init__(
        self,
        sim_id: str,
        ingham: InghamClient,
        hindsight: HindsightClient,
        agent_manager: AgentManager,
        broadcast_fn: Optional[Callable] = None,
        initial_graph: Optional[Dict[str, Any]] = None,
    ):
        self.sim_id = sim_id
        self.llm = ingham
        self.memory = hindsight
        self.agents = agent_manager
        self.broadcast = broadcast_fn
        self.status = SimulationStatus.CREATED
        self.current_round = 0
        self.max_rounds = 10
        self.speed_ms = 3000  # delay between actions
        self.graph: Dict[str, Any] = initial_graph or {"nodes": [], "edges": []}

    async def run(self):
        """Main simulation loop. Resumes from current_round if paused."""
        self.status = SimulationStatus.RUNNING
        start_round = self.current_round + 1
        logger.info(f"Simulation {self.sim_id} {'resumed' if start_round > 1 else 'started'} from round {start_round}/{self.max_rounds}.")

        for round_num in range(start_round, self.max_rounds + 1):
            if self.status != SimulationStatus.RUNNING:
                break

            self.current_round = round_num
            logger.info(f"--- Round {round_num}/{self.max_rounds} ---")

            # Collect actions from this round for graph extraction
            round_actions = []

            # Each agent takes a turn
            for agent in self.agents.list_agents():
                if self.status != SimulationStatus.RUNNING:
                    break

                try:
                    action = await self._agent_turn(agent, round_num)
                    if action:
                        self.agents.record_action(action)
                        action_summary = {
                            "agent_name": agent.name,
                            "agent_id": agent.id,
                            "action_type": action.action_type,
                            "content": action.content,
                            "round": round_num,
                        }
                        round_actions.append(action_summary)

                        await self.memory.add_memory(
                            f"{agent.name} {action.action_type}: {action.content}",
                            {"type": "action", "round": round_num, "agent": agent.name},
                        )
                        if self.broadcast:
                            await self.broadcast({
                                "event": "agent_action",
                                "simulation_id": self.sim_id,
                                "round": round_num,
                                "data": {
                                    "id": action.id,
                                    "agent_name": agent.name,
                                    "agent_id": agent.id,
                                    "action_type": action.action_type,
                                    "content": action.content,
                                    "target_id": action.target_id,
                                    "timestamp": action.timestamp,
                                }
                            })
                except Exception as e:
                    logger.error(f"Agent {agent.name} failed in round {round_num}: {e}")

                await asyncio.sleep(self.speed_ms / 1000.0)

            # After all agents have acted in this round, update the knowledge graph
            if round_actions and self.status == SimulationStatus.RUNNING:
                try:
                    self.graph = await extract_relationships(
                        self.llm,
                        round_actions,
                        self.graph,
                    )
                    if self.broadcast:
                        await self.broadcast({
                            "event": "graph_update",
                            "simulation_id": self.sim_id,
                            "round": round_num,
                            "data": self.graph,
                        })
                    logger.info(
                        f"Round {round_num} graph updated: "
                        f"{len(self.graph.get('nodes', []))} nodes, "
                        f"{len(self.graph.get('edges', []))} edges"
                    )
                except Exception as e:
                    logger.error(f"Graph extraction failed after round {round_num}: {e}")

        if self.status == SimulationStatus.RUNNING:
            self.status = SimulationStatus.COMPLETED
            logger.info(f"Simulation {self.sim_id} completed.")

    async def _agent_turn(self, agent: AgentPersona, round_num: int) -> Optional[AgentAction]:
        """Generate a single action for one agent."""
        agent.status = "thinking"

        # 1. Retrieve context from Hindsight
        try:
            context_results = await self.memory.search(f"What is {agent.name} doing? What's happening?", limit=3)
            context_str = json.dumps(context_results) if context_results else "No prior context."
        except Exception:
            context_str = "No prior context available."

        # Get recent feed for threading context
        recent_feed = self.agents.get_feed(limit=10)
        recent_feed_context = [
             {"post_id": f.get("id"), "agent": f.get("agent_name"), "content": f.get("content"), "action_type": f.get("action_type")} 
             for f in recent_feed[-10:] if f.get("agent_id") != agent.id
        ]
        recent_feed_str = json.dumps(recent_feed_context) if recent_feed_context else "No recent posts from others."

        # 2. Build prompt
        messages = [
            {
                "role": "system",
                "content": (
                    f"You are {agent.name}. {agent.bio}. "
                    f"Personality: {', '.join(agent.personality_traits)}. "
                    f"You are participating in a social media simulation on {agent.platform}. "
                    f"Respond ONLY with a JSON object: {{'action_type': 'post'|'reply'|'like', 'content': 'your message here', 'target_id': 'post_id if replying/liking else null'}}. "
                    f"Consider the recent posts from others and reply directly if strongly agree or disagree, else make a standalone post. "
                    f"Do NOT use markdown code blocks. Just raw JSON."
                )
            },
            {
                "role": "user",
                "content": f"Round {round_num}. Historical context: {context_str}. Recent community activity: {recent_feed_str}. What do you do?"
            }
        ]

        # 3. Call LLM
        raw = await self.llm.chat(messages, temperature=0.8)
        clean = raw.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(clean)
        except json.JSONDecodeError:
            # Fallback: treat the whole response as a post
            parsed = {"action_type": "post", "content": clean}

        return AgentAction(
            agent_id=agent.id,
            action_type=parsed.get("action_type", "post"),
            content=parsed.get("content", raw),
            target_id=parsed.get("target_id", None),
            timestamp=datetime.now().isoformat(),
        )

    def pause(self):
        self.status = SimulationStatus.PAUSED

    def resume(self):
        self.status = SimulationStatus.RUNNING

    def stop(self):
        self.status = SimulationStatus.STOPPED
