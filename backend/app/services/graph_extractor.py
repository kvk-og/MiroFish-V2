"""
Knowledge Graph Extractor
Extracts entities and relationships from agent actions using LLM reasoning.
"""

import json
import logging
from typing import Dict, Any, List

from ..core.ingham_client import InghamClient

logger = logging.getLogger(__name__)

# Valid entity types and sentiment values
ENTITY_TYPES = {"agent", "faction", "concept", "location", "resource", "event"}
SENTIMENT_VALUES = {"positive", "negative", "neutral"}


def _normalise_node(node: dict, existing_ids: set) -> dict | None:
    """Validate and normalise a single node dict."""
    nid = node.get("id")
    if not nid:
        return None
    return {
        "id": str(nid),
        "label": str(node.get("label", nid)),
        "type": node.get("type", "concept") if node.get("type") in ENTITY_TYPES else "concept",
        "group": str(node.get("group", "default")),
    }


def _normalise_edge(edge: dict, valid_ids: set) -> dict | None:
    """Validate and normalise a single edge dict."""
    source = edge.get("source")
    target = edge.get("target")
    if not source or not target:
        return None
    if valid_ids and (source not in valid_ids or target not in valid_ids):
        return None
    sentiment = edge.get("sentiment", "neutral")
    if sentiment not in SENTIMENT_VALUES:
        sentiment = "neutral"
    strength = edge.get("strength", 3)
    try:
        strength = max(1, min(5, int(strength)))
    except (ValueError, TypeError):
        strength = 3
    return {
        "source": str(source),
        "target": str(target),
        "label": str(edge.get("label", "")),
        "sentiment": sentiment,
        "strength": strength,
    }


def _merge_graphs(existing: dict, new_nodes: list, new_edges: list) -> dict:
    """Merge newly extracted nodes/edges into the existing graph, deduplicating."""
    node_map = {n["id"]: n for n in existing.get("nodes", [])}
    edge_set = set()
    edge_list = []
    for e in existing.get("edges", []):
        key = (e["source"], e["target"], e["label"])
        edge_set.add(key)
        edge_list.append(e)

    for n in new_nodes:
        if n["id"] not in node_map:
            node_map[n["id"]] = n
        else:
            # Update group/type if provided
            existing_node = node_map[n["id"]]
            if n.get("group") and n["group"] != "default":
                existing_node["group"] = n["group"]
            if n.get("type"):
                existing_node["type"] = n["type"]

    valid_ids = set(node_map.keys())
    for e in new_edges:
        if e is None:
            continue
        key = (e["source"], e["target"], e["label"])
        if key not in edge_set:
            edge_set.add(key)
            edge_list.append(e)
        else:
            # Update existing edge (e.g. strength change)
            for idx, existing_e in enumerate(edge_list):
                if (existing_e["source"], existing_e["target"], existing_e["label"]) == key:
                    edge_list[idx] = e
                    break

    return {"nodes": list(node_map.values()), "edges": edge_list}


async def extract_relationships(
    llm_client: InghamClient,
    actions: list,
    existing_graph: dict,
) -> dict:
    """
    Given recent agent actions and the current knowledge graph, ask the LLM
    to extract notable new entities and relationships.

    Returns the updated graph: {nodes, edges}.
    """
    if not actions:
        return existing_graph

    # Build a concise summary of recent actions
    action_summaries = []
    for a in actions[-10:]:  # keep last 10 actions max
        if isinstance(a, dict):
            action_summaries.append(
                f"{a.get('agent_name', 'Unknown')} ({a.get('action_type', 'act')}): {a.get('content', '')}"
            )
        else:
            action_summaries.append(str(a))
    actions_text = "\n".join(action_summaries)

    existing_summary = ""
    if existing_graph.get("nodes"):
        existing_summary = (
            "Existing nodes: "
            + json.dumps([{"id": n["id"], "label": n["label"], "type": n["type"]} for n in existing_graph["nodes"]])
        )
    if existing_graph.get("edges"):
        existing_summary += (
            "\nExisting edges: "
            + json.dumps([{"source": e["source"], "target": e["target"], "label": e["label"], "sentiment": e["sentiment"]} for e in existing_graph["edges"]])
        )

    prompt = (
        "You are a knowledge-graph extraction engine for a social simulation.\n"
        "Given recent agent actions and an existing knowledge graph, extract ONLY notable new "
        "entities and relationships. Do NOT extract trivial or obvious relationships.\n\n"
        f"Recent actions:\n{actions_text}\n\n"
        f"{existing_summary}\n\n"
        "Return a SINGLE valid JSON object (no markdown, no code fences) with this exact structure:\n"
        "{\n"
        '  "nodes": [{"id": "unique_id", "label": "display name", "type": "agent|faction|concept|location|resource|event", "group": "category"}],\n'
        '  "edges": [{"source": "node_id", "target": "node_id", "label": "relationship", "sentiment": "positive|negative|neutral", "strength": 1-5}]\n'
        "}\n\n"
        "Rules:\n"
        "- Entity types must be one of: agent, faction, concept, location, resource, event\n"
        "- Sentiment must be one of: positive, negative, neutral\n"
        "- Strength is an integer from 1 (weak) to 5 (very strong)\n"
        "- Only extract meaningful, non-trivial relationships\n"
        "- Include previously existing nodes/edges that are still relevant\n"
        "- Respond with raw JSON only, no explanation"
    )

    try:
        raw = await llm_client.chat([{"role": "user", "content": prompt}])
        clean = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean)

        new_nodes = []
        for n in parsed.get("nodes", []):
            normed = _normalise_node(n, set())
            if normed:
                new_nodes.append(normed)

        valid_ids = {n["id"] for n in new_nodes}
        # Also allow edges referencing existing graph nodes
        for n in existing_graph.get("nodes", []):
            valid_ids.add(n["id"])

        new_edges = []
        for e in parsed.get("edges", []):
            normed = _normalise_edge(e, valid_ids)
            if normed:
                new_edges.append(normed)

        merged = _merge_graphs(existing_graph, new_nodes, new_edges)
        logger.info(
            f"[graph_extractor] Extracted {len(new_nodes)} new nodes, {len(new_edges)} new edges. "
            f"Graph totals: {len(merged['nodes'])} nodes, {len(merged['edges'])} edges."
        )
        return merged

    except Exception as e:
        logger.error(f"[graph_extractor] Failed to extract relationships: {e}")
        return existing_graph
