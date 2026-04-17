
import httpx
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

class InghamClient:
    """
    Direct client for Ingham API (Gemma 4).
    """
    def __init__(self):
        self.api_key = os.getenv("LLM_API_KEY")
        self.base_url = os.getenv("LLM_BASE_URL")
        self.model = os.getenv("LLM_MODEL_NAME")
        
        if not self.api_key or not self.base_url:
            raise ValueError("Ingham API credentials missing in .env")

    async def chat(self, messages: List[Dict[str, str]], temperature: float = 0.7, max_retries: int = 3) -> str:
        """
        Sends a chat completion request to Ingham API with exponential backoff.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            for attempt in range(max_retries):
                try:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload
                    )
                    
                    if response.status_code != 200:
                        raise Exception(f"Ingham API Error ({response.status_code}): {response.text}")
                    
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    import asyncio
                    await asyncio.sleep(2 ** attempt)

    async def stream_chat(self, messages: List[Dict[str, str]]):
        """
        Placeholder for streaming implementation.
        """
        pass
