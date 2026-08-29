"""Azure OpenAI game generation and iteration pipelines."""

import json
from collections.abc import AsyncGenerator
from types import SimpleNamespace

from app.agents.azure_openai import AzureOpenAIClient
from app.agents.prompts import (
    FIXER_PROMPT,
    GENERATOR_PROMPT,
    ITERATOR_PROMPT,
    PLANNER_PROMPT,
)
from app.agents.validation import clean_code, validate_phaser_code


class _Event:
    def __init__(
        self,
        author: str,
        *,
        state_delta: dict | None = None,
        text: str | None = None,
        final_game_code: str | None = None,
    ):
        self.author = author
        self.actions = SimpleNamespace(state_delta=state_delta)
        self.content = (
            SimpleNamespace(parts=[SimpleNamespace(text=text)]) if text else None
        )
        if final_game_code is not None:
            self.final_game_code = final_game_code


def _code_prompt(user_prompt: str, plan: dict, template_type: str) -> str:
    return (
        f"User request:\n{user_prompt}\n\n"
        f"Template hint: {template_type}\n\n"
        f"Approved game plan:\n{json.dumps(plan, ensure_ascii=False)}"
    )


async def _fix_if_needed(
    client: AzureOpenAIClient,
    code: str,
    validation: dict,
) -> tuple[str, dict, bool]:
    if validation["valid"]:
        return code, validation, False
    fixed = await client.chat(
        FIXER_PROMPT,
        "Errors to repair:\n"
        f"{json.dumps(validation['errors'])}\n\nCurrent code:\n{code}",
    )
    fixed_code = clean_code(str(fixed))
    fixed_validation = validate_phaser_code(fixed_code)
    if not fixed_validation["valid"]:
        raise RuntimeError("Azure OpenAI produced structurally invalid Phaser code")
    return fixed_code, fixed_validation, True


async def run_game_generation(
    prompt: str,
    game_id: str,
    template_type: str | None = None,
) -> AsyncGenerator[_Event, None]:
    """Plan and generate a complete Phaser game with Azure OpenAI."""
    del game_id  # Included in the public runner contract, not sent to the model.
    client = AzureOpenAIClient()
    progress = ["Planning game design..."]
    yield _Event("planner", state_delta={"progress_messages": progress.copy()})

    plan = await client.chat(
        PLANNER_PROMPT,
        f"Game description: {prompt}\nTemplate hint: {template_type or 'custom'}",
        json_response=True,
    )
    assert isinstance(plan, dict)
    yield _Event("planner", state_delta={"game_plan": json.dumps(plan)})

    progress.append("Generating Phaser.js game code...")
    yield _Event("code_generator", state_delta={"progress_messages": progress.copy()})
    generated = await client.chat(
        GENERATOR_PROMPT,
        _code_prompt(prompt, plan, template_type or "custom"),
    )
    code = clean_code(str(generated))
    validation = validate_phaser_code(code)
    yield _Event("code_generator", state_delta={"game_files": {"game.js": code}})
    yield _Event("validator", state_delta={"validation_result": validation})

    fixed_code, final_validation, was_fixed = await _fix_if_needed(
        client, code, validation
    )
    if was_fixed:
        progress.append("Repairing structural validation errors...")
        yield _Event("fixer", state_delta={"progress_messages": progress.copy()})
        yield _Event("fixer", state_delta={"game_files": {"game.js": fixed_code}})
        yield _Event(
            "validator", state_delta={"validation_result": final_validation}
        )

    yield _Event("coordinator", final_game_code=fixed_code)


async def run_game_iteration(
    message: str,
    game_id: str,
    existing_code: str,
    conversation_context: list[dict[str, str]] | None = None,
) -> AsyncGenerator[_Event, None]:
    """Apply a requested modification to an existing game with Azure OpenAI."""
    del game_id
    client = AzureOpenAIClient()
    progress = ["Analyzing change request..."]
    yield _Event("iterator", state_delta={"progress_messages": progress.copy()})

    recent_context = []
    for item in (conversation_context or [])[-4:]:
        recent_context.append(
            {
                "role": str(item.get("role", "")),
                "content": str(item.get("content", ""))[:1000],
            }
        )
    user_prompt = (
        f"Requested change:\n{message}\n\n"
        f"Recent context:\n{json.dumps(recent_context, ensure_ascii=False)}\n\n"
        f"Current complete game code:\n{existing_code}"
    )
    generated = await client.chat(ITERATOR_PROMPT, user_prompt)
    code = clean_code(str(generated))
    validation = validate_phaser_code(code)
    fixed_code, _, was_fixed = await _fix_if_needed(client, code, validation)

    if was_fixed:
        progress.append("Repairing structural validation errors...")
        yield _Event("iterator", state_delta={"progress_messages": progress.copy()})
    yield _Event("iterator", state_delta={"game_files": {"game.js": fixed_code}})
    yield _Event("iterator", text="Applied the requested changes and validated the game.")
    yield _Event("iterator", final_game_code=fixed_code)
