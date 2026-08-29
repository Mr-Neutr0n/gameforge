"""Minimal async Azure OpenAI client for GameForge text generation."""

import asyncio
import email.utils
import json
import os
import random
from datetime import datetime, timezone
from typing import Awaitable, Callable
from urllib.parse import urlparse

import httpx


Sleep = Callable[[float], Awaitable[None]]


class AzureOpenAIClient:
    RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

    def __init__(
        self,
        endpoint: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        http_client: httpx.AsyncClient | None = None,
        sleep: Sleep = asyncio.sleep,
        jitter: Callable[[], float] = random.random,
    ):
        self.endpoint = self._normalize_endpoint(
            endpoint or os.getenv("AZURE_OPENAI_ENDPOINT", "")
        )
        self.api_key = api_key or os.getenv("AZURE_OPENAI_API_KEY", "")
        self.model = model or os.getenv("AZURE_MODEL_TEXT", "gpt-5-6-luna")
        self.http_client = http_client
        self.sleep = sleep
        self.jitter = jitter

    @staticmethod
    def _normalize_endpoint(endpoint: str) -> str:
        value = endpoint.rstrip("/")
        if value and not value.endswith("/openai/v1"):
            value = f"{value}/openai/v1"
        return value

    def _validate_configuration(self) -> None:
        parsed = urlparse(self.endpoint)
        if (
            not self.api_key
            or parsed.scheme != "https"
            or not parsed.netloc
            or parsed.path != "/openai/v1"
        ):
            raise RuntimeError(
                "AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must identify an HTTPS Azure resource"
            )

    @staticmethod
    def _retry_after(response: httpx.Response) -> float | None:
        value = response.headers.get("Retry-After")
        if not value:
            return None
        try:
            return max(0.0, float(value))
        except ValueError:
            try:
                retry_at = email.utils.parsedate_to_datetime(value)
                if retry_at.tzinfo is None:
                    retry_at = retry_at.replace(tzinfo=timezone.utc)
                return max(
                    0.0, (retry_at - datetime.now(timezone.utc)).total_seconds()
                )
            except (TypeError, ValueError):
                return None

    async def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        json_response: bool = False,
        max_retries: int = 3,
    ) -> str | dict:
        self._validate_configuration()
        payload: dict = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if json_response:
            payload["response_format"] = {"type": "json_object"}

        owns_client = self.http_client is None
        client = self.http_client or httpx.AsyncClient(timeout=180.0)
        try:
            for attempt in range(max_retries + 1):
                try:
                    response = await client.post(
                        f"{self.endpoint}/chat/completions",
                        headers={"api-key": self.api_key},
                        json=payload,
                    )
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt >= max_retries:
                        raise
                    await self.sleep((2**attempt) + self.jitter())
                    continue

                if response.status_code < 400:
                    break
                if (
                    response.status_code not in self.RETRYABLE_STATUS_CODES
                    or attempt >= max_retries
                ):
                    raise RuntimeError(
                        f"Azure OpenAI error {response.status_code}: {response.text[:500]}"
                    )
                retry_after = self._retry_after(response)
                await self.sleep(
                    (retry_after if retry_after is not None else 2**attempt)
                    + self.jitter()
                )
            else:  # pragma: no cover - loop always returns or raises
                raise RuntimeError("Azure OpenAI request failed")
        finally:
            if owns_client:
                await client.aclose()

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise RuntimeError("Azure OpenAI response did not contain text") from exc

        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Azure OpenAI response was empty")
        if not json_response:
            return content

        try:
            result = json.loads(content)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Azure OpenAI response was not valid JSON") from exc
        if not isinstance(result, dict):
            raise RuntimeError("Azure OpenAI JSON response must be an object")
        return result
