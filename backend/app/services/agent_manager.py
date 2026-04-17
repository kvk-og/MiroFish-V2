"""
Agent Manager
Spawns, tracks, and controls individual agent personas.
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class AgentPersona(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str
    bio: str
    personality_traits: List[str] = Field(default_factory=list)
    platform: str = "twitter"  # twitter or reddit
    status: str = "idle"  # idle, thinking, posting, replying


class AgentAction(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    agent_id: str
    action_type: str  # post, reply, like, share
    content: str
    target_id: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentManager:
    """
    Manages the lifecycle of all agents in a simulation.
    """

    def __init__(self):
        self.agents: Dict[str, AgentPersona] = {}
        self.action_history: List[AgentAction] = []

    def spawn_agents(self, agent_data: List[Dict[str, Any]], platform: str = "twitter") -> List[AgentPersona]:
        """Create agents from LLM-generated persona data."""
        spawned = []
        for data in agent_data:
            persona = AgentPersona(
                name=data.get("name", f"Agent_{uuid.uuid4().hex[:4]}"),
                bio=data.get("bio", ""),
                personality_traits=data.get("personality_traits", []),
                platform=platform,
            )
            self.agents[persona.id] = persona
            spawned.append(persona)
            logger.info(f"Spawned agent: {persona.name} ({persona.id})")
        return spawned

    def get_agent(self, agent_id: str) -> Optional[AgentPersona]:
        return self.agents.get(agent_id)

    def list_agents(self) -> List[AgentPersona]:
        return list(self.agents.values())

    def record_action(self, action: AgentAction):
        self.action_history.append(action)
        if action.agent_id in self.agents:
            self.agents[action.agent_id].status = "idle"

    def get_feed(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns the action feed for the frontend."""
        feed = []
        for action in reversed(self.action_history[-limit:]):
            agent = self.agents.get(action.agent_id)
            feed.append({
                "id": action.id,
                "agent_name": agent.name if agent else "Unknown",
                "agent_id": action.agent_id,
                "action_type": action.action_type,
                "content": action.content,
                "target_id": action.target_id,
                "timestamp": action.timestamp,
                "platform": agent.platform if agent else "unknown",
            })
        return feed
