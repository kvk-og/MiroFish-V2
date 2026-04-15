"""
Memory Store for MiroFish V2.
Supports two backends, selectable via HINDSIGHT_MODE env var:

  HINDSIGHT_MODE=memory   -> In-process keyword search (default, no external deps)
  HINDSIGHT_MODE=rest     -> Hindsight REST API via httpx (async-native)

When mode=rest, configure:
  HINDSIGHT_URL=http://localhost:8888  (Hindsight server URL)
  HINDSIGHT_BANK=mirofish-v2           (memory bank ID)
"""

import json
import math
import os
import logging
import re
from collections import Counter
from typing import List, Dict, Any, Optional

import httpx

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# In-Process Memory Store (fallback / dev mode)
# ──────────────────────────────────────────────

def _tokenize(text: str) -> List[str]:
    return re.findall(r'[a-z0-9]+', text.lower())


def _cosine_similarity(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    dot = sum(a[k] * b.get(k, 0) for k in a)
    mag_a = math.sqrt(sum(v ** 2 for v in a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


class _InProcessMemory:
    """Simple in-process keyword search memory."""

    def __init__(self):
        self.memories: List[Dict[str, Any]] = []
        self._id_counter = 0

    async def add_memory(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        self._id_counter += 1
        self.memories.append({
            "id": self._id_counter,
            "text": text,
            "metadata": metadata or {},
            "tokens": Counter(_tokenize(text)),
        })
        logger.debug(f"[memory] Stored #{self._id_counter}: {text[:80]}...")
        return True

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        query_tokens = Counter(_tokenize(query))
        if not query_tokens:
            return []
        scored = []
        for mem in self.memories:
            sim = _cosine_similarity(query_tokens, mem["tokens"])
            if sim > 0:
                scored.append((sim, mem))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {"id": s[1]["id"], "text": s[1]["text"], "metadata": s[1]["metadata"], "score": round(s[0], 4)}
            for s in scored[:limit]
        ]

    async def clear_all(self):
        self.memories.clear()
        self._id_counter = 0
        logger.info("[memory] All memories cleared.")


# ──────────────────────────────────────────────
# Hindsight REST Client (production mode)
# Uses httpx async — no event loop conflicts
# ──────────────────────────────────────────────

class _HindsightREST:
    """Async client for Hindsight REST API via httpx."""

    def __init__(self, base_url: str, bank_id: str):
        self._base_url = base_url.rstrip("/")
        self._bank_id = bank_id
        self._client = httpx.AsyncClient(base_url=self._base_url, timeout=30.0)
        self._bank_ready = False
        logger.info(f"[hindsight-rest] Configured for {base_url}, bank={bank_id}")

    async def _ensure_bank(self):
        """Create bank with chunks extraction mode if it doesn't exist."""
        if self._bank_ready:
            return
        try:
            resp = await self._client.put(
                f"/v1/default/banks/{self._bank_id}",
                json={
                    "name": "MiroFish V2 Memory",
                    "retain_extraction_mode": "chunks",
                }
            )
            if resp.status_code in (200, 201):
                logger.info(f"[hindsight-rest] Bank '{self._bank_id}' created/updated (chunks mode)")
            else:
                logger.info(f"[hindsight-rest] Bank '{self._bank_id}' response: {resp.status_code}")
        except Exception as e:
            logger.warning(f"[hindsight-rest] Bank init error: {e}")
        self._bank_ready = True

    async def add_memory(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        await self._ensure_bank()
        try:
            tags = []
            if metadata and metadata.get("type"):
                tags.append(metadata["type"])
            resp = await self._client.post(
                f"/v1/default/banks/{self._bank_id}/memories",
                json={"items": [{"content": text, "tags": tags}]},
            )
            data = resp.json()
            if data.get("success"):
                logger.debug(f"[hindsight-rest] Retained: {text[:60]}...")
                return True
            else:
                logger.error(f"[hindsight-rest] retain failed: {data}")
                return False
        except Exception as e:
            logger.error(f"[hindsight-rest] retain failed: {e}")
            return False

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        await self._ensure_bank()
        try:
            resp = await self._client.post(
                f"/v1/default/banks/{self._bank_id}/memories/recall",
                json={"query": query, "max_tokens": 2000},
            )
            data = resp.json()
            results = []
            for item in (data.get("results") or [])[:limit]:
                results.append({
                    "id": item.get("id", ""),
                    "text": item.get("text", ""),
                    "metadata": {"type": item.get("fact_type", "world"), "tags": item.get("tags", [])},
                    "score": 1.0,
                })
            return results
        except Exception as e:
            logger.error(f"[hindsight-rest] recall failed: {e}")
            return []

    async def clear_all(self):
        try:
            await self._client.delete(f"/v1/default/banks/{self._bank_id}")
            self._bank_ready = False  # Will recreate on next use
            logger.info("[hindsight-rest] Bank deleted.")
        except Exception as e:
            logger.error(f"[hindsight-rest] clear failed: {e}")


# ──────────────────────────────────────────────
# Public Interface
# ──────────────────────────────────────────────

class HindsightClient:
    """
    Memory client for MiroFish V2.
    Automatically selects backend based on HINDSIGHT_MODE env var.
    All methods are async to work within FastAPI's event loop.
    """

    def __init__(self):
        mode = os.getenv("HINDSIGHT_MODE", "memory")

        if mode == "rest":
            url = os.getenv("HINDSIGHT_URL", "http://localhost:8888")
            bank = os.getenv("HINDSIGHT_BANK", "mirofish-v2")
            self._backend = _HindsightREST(base_url=url, bank_id=bank)
        else:
            self._backend = _InProcessMemory()

        self.mode = mode
        logger.info(f"HindsightClient ready (mode={mode}, backend={type(self._backend).__name__})")

    async def add_memory(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        return await self._backend.add_memory(text, metadata)

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        return await self._backend.search(query, limit)

    async def clear_all(self):
        await self._backend.clear_all()
