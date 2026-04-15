"""
Simulation Orchestrator
The central brain that coordinates LLM reasoning and Hindsight memory seeding.
"""

import json
import logging
from typing import List, Dict, Any, Optional

from ..core.ingham_client import InghamClient
from ..core.hindsight_client import HindsightClient

logger = logging.getLogger(__name__)


class SimulationOrchestrator:
    def __init__(self, ingham: InghamClient, hindsight: HindsightClient):
        self.llm = ingham
        self.memory = hindsight

    async def derive_social_context(self, user_profile: Dict[str, Any]) -> str:
        """
        Derive a rich socio-economic context description from a user profile.
        Takes: {location, age, occupation, social_handles, social_factors}
        Returns: rich text describing the social environment.
        """
        logger.info(f"Deriving social context for profile: {user_profile}")

        prompt = (
            "You are a sociological analysis engine. Given a user's profile, produce a detailed "
            "socio-economic context analysis. Be specific and grounded in real-world data and trends.\n\n"
            "User profile:\n"
            f"- Location: {user_profile.get('location', 'unknown')}\n"
            f"- Age: {user_profile.get('age', 'unknown')}\n"
            f"- Occupation: {user_profile.get('occupation', 'unknown')}\n"
            f"- Social media handles/activity: {json.dumps(user_profile.get('social_handles', {}))}\n"
            f"- Additional social factors: {json.dumps(user_profile.get('social_factors', {}))}\n\n"
            "Provide a detailed analysis covering:\n"
            "1. Demographics of their town/area (population density, diversity, age distribution)\n"
            "2. Economic pressures (cost of living, job market, industry trends, income levels)\n"
            "3. Social class dynamics (class distribution, mobility, tensions)\n"
            "4. Media consumption patterns (what media/social platforms dominate locally)\n"
            "5. Local political leanings and civic engagement\n"
            "6. Relevant social issues (housing, healthcare, education, immigration, environment, etc.)\n"
            "7. Cultural factors and community identity\n\n"
            "Respond with a cohesive narrative description (3-5 paragraphs). "
            "Do not use JSON or code blocks. Plain text only."
        )

        try:
            context = await self.llm.chat([{"role": "user", "content": prompt}])
            logger.info(f"Social context derived ({len(context)} chars)")
            return context.strip()
        except Exception as e:
            logger.error(f"Failed to derive social context: {e}")
            return ""

    async def initialize_world(
        self,
        scenario_prompt: str,
        num_agents: int = 3,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        1. Optionally derive social context from user_profile.
        2. Use LLM to expand the scenario into detailed world facts (grounded in social context).
        3. Inject those facts into Hindsight.
        4. Generate initial agent personas (reflecting socio-economic reality).
        5. Extract initial relationships between agents (knowledge graph).
        """
        logger.info(f"Initializing world scenario with {num_agents} agents (user_profile={'yes' if user_profile else 'no'})...")

        # Step 0: Derive social context if user_profile provided
        social_context = ""
        if user_profile:
            social_context = await self.derive_social_context(user_profile)
            if social_context:
                await self.memory.add_memory(
                    f"Social context: {social_context}",
                    {"type": "social_context"},
                )

        # Step 1: Expand scenario into world facts
        expansion_prompt = (
            "Expand this simulation scenario into a list of 10 distinct, interconnected facts "
            "that define the world.\n"
        )
        if social_context:
            expansion_prompt += (
                "\nThe simulation should be grounded in this socio-economic reality:\n"
                f"{social_context}\n\n"
                "Ensure the facts reflect the demographics, economic pressures, social dynamics, "
                "and political landscape described above.\n\n"
            )
        expansion_prompt += (
            "Format the output as a valid JSON list of strings.\n"
            "Scenario: " + scenario_prompt
        )

        try:
            raw_facts = await self.llm.chat([{"role": "user", "content": expansion_prompt}])
            clean_facts_str = raw_facts.replace("```json", "").replace("```", "").strip()
            facts: List[str] = json.loads(clean_facts_str)

            # Step 2: Seed Hindsight
            logger.info(f"Seeding {len(facts)} facts into Hindsight...")
            for fact in facts:
                await self.memory.add_memory(fact, {"type": "world_fact"})

            # Step 3: Generate Agents
            agent_prompt = (
                "Based on these world facts: " + json.dumps(facts) + "\n"
                f"Generate {num_agents} diverse agent personas.\n"
            )
            if social_context:
                agent_prompt += (
                    "The agents should reflect the socio-economic reality of this environment:\n"
                    f"{social_context}\n\n"
                    "Give them realistic backgrounds, economic situations, and social positions "
                    "that create interesting dynamics and conflict potential.\n"
                )
            agent_prompt += (
                "For each agent, provide: name, bio, and personality_traits.\n"
                "Format as a valid JSON list of objects."
            )

            raw_agents = await self.llm.chat([{"role": "user", "content": agent_prompt}])
            clean_agents_str = raw_agents.replace("```json", "").replace("```", "").strip()
            agents = json.loads(clean_agents_str)

            # Seed agent personas into memory
            for agent in agents:
                await self.memory.add_memory(
                    f"{agent.get('name', 'Unknown')}: {agent.get('bio', '')}",
                    {"type": "persona"},
                )

            # Step 4: Extract initial relationships (knowledge graph)
            initial_graph = await self._extract_initial_relationships(facts, agents, social_context)

            return {
                "status": "success",
                "world_facts": facts,
                "agents": agents,
                "social_context": social_context,
                "initial_graph": initial_graph,
            }
        except Exception as e:
            logger.error(f"Failed to initialize world: {e}")
            return {"status": "error", "message": str(e)}

    async def _extract_initial_relationships(
        self,
        facts: List[str],
        agents: List[Dict[str, Any]],
        social_context: str = "",
    ) -> Dict[str, Any]:
        """
        Use the LLM to extract initial relationships between agents and entities.
        Returns: {nodes: [{id, label, type}], edges: [{source, target, label, sentiment}]}
        """
        agent_names = [a.get("name", f"Agent_{i}") for i, a in enumerate(agents)]

        prompt = (
            "You are a knowledge-graph extraction engine for a social simulation.\n"
            "Given world facts and agent personas, extract the initial relationship network.\n\n"
            f"World facts:\n{json.dumps(facts)}\n\n"
            f"Agents: {json.dumps(agent_names)}\n\n"
        )
        if social_context:
            prompt += f"Social context:\n{social_context}\n\n"

        prompt += (
            "Extract:\n"
            "- Nodes for each agent, plus any factions, concepts, locations, resources, or events mentioned\n"
            "- Edges representing relationships (alliances, oppositions, power dynamics, affiliations)\n\n"
            "Return a SINGLE valid JSON object (no markdown, no code fences):\n"
            "{\n"
            '  "nodes": [{"id": "unique_id", "label": "display name", "type": "agent|faction|concept|location|resource|event"}],\n'
            '  "edges": [{"source": "id", "target": "id", "label": "relationship", "sentiment": "positive|negative|neutral"}]\n'
            "}\n\n"
            "Entity types: agent, faction, concept, location, resource, event\n"
            "Sentiment: positive, negative, neutral\n"
            "Focus on notable relationships — oppositions, alliances, power dynamics.\n"
            "Respond with raw JSON only."
        )

        try:
            raw = await self.llm.chat([{"role": "user", "content": prompt}])
            clean = raw.replace("```json", "").replace("```", "").strip()
            graph = json.loads(clean)

            # Normalise
            valid_types = {"agent", "faction", "concept", "location", "resource", "event"}
            valid_sentiments = {"positive", "negative", "neutral"}

            nodes = []
            for n in graph.get("nodes", []):
                nid = n.get("id")
                if not nid:
                    continue
                nodes.append({
                    "id": str(nid),
                    "label": str(n.get("label", nid)),
                    "type": n.get("type", "concept") if n.get("type") in valid_types else "concept",
                    "group": str(n.get("group", "default")),
                })

            node_ids = {n["id"] for n in nodes}
            edges = []
            for e in graph.get("edges", []):
                s, t = e.get("source"), e.get("target")
                if not s or not t:
                    continue
                if node_ids and (str(s) not in node_ids or str(t) not in node_ids):
                    continue
                sentiment = e.get("sentiment", "neutral")
                if sentiment not in valid_sentiments:
                    sentiment = "neutral"
                edges.append({
                    "source": str(s),
                    "target": str(t),
                    "label": str(e.get("label", "")),
                    "sentiment": sentiment,
                    "strength": 3,
                })

            result = {"nodes": nodes, "edges": edges}
            logger.info(f"Extracted initial graph: {len(nodes)} nodes, {len(edges)} edges")
            return result

        except Exception as e:
            logger.error(f"Failed to extract initial relationships: {e}")
            return {"nodes": [], "edges": []}
