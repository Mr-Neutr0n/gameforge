import asyncio
import json

import httpx
import pytest

from app.agents.azure_openai import AzureOpenAIClient


def test_chat_uses_azure_v1_endpoint_and_model():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["key"] = request.headers.get("api-key")
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "hello"}}]},
        )

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler)
        ) as http_client:
            client = AzureOpenAIClient(
                endpoint="https://example.openai.azure.com",
                api_key="secret",
                model="gpt-test",
                http_client=http_client,
            )
            return await client.chat("system", "user")

    assert asyncio.run(run()) == "hello"
    assert captured["url"] == "https://example.openai.azure.com/openai/v1/chat/completions"
    assert captured["key"] == "secret"
    assert captured["body"]["model"] == "gpt-test"


def test_chat_retries_429_and_parses_json():
    attempts = 0
    sleeps = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"ok": true}'}}]},
        )

    async def fake_sleep(delay: float):
        sleeps.append(delay)

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler)
        ) as http_client:
            client = AzureOpenAIClient(
                endpoint="https://example.openai.azure.com",
                api_key="secret",
                http_client=http_client,
                sleep=fake_sleep,
                jitter=lambda: 0,
            )
            return await client.chat("system", "user", json_response=True)

    assert asyncio.run(run()) == {"ok": True}
    assert attempts == 2
    assert sleeps == [0]


def test_chat_rejects_non_azure_endpoint():
    client = AzureOpenAIClient(endpoint="http://example.com", api_key="secret")
    with pytest.raises(RuntimeError, match="HTTPS Azure resource"):
        asyncio.run(client.chat("system", "user"))
