"""Shared rate limiter instance used across all route modules.

This lives in a separate module to avoid circular imports between
main.py and the route files.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Budget constants
MAX_GAMES_PER_USER_PER_DAY = 10
MAX_GENERATIONS_PER_GAME = 50  # Gemini API call budget per generation
