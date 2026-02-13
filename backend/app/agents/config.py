"""Gemini model configuration for ADK agents."""

import os

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# Agent app identifier used by ADK Runner
APP_NAME = "gameforge"

# Max LLM calls per runner invocation (budget guard)
MAX_LLM_CALLS = 50
