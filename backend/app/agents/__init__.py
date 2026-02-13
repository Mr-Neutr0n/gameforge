"""GameForge ADK agent system.

Exports root_agent — the coordinator SequentialAgent that orchestrates the
full game generation pipeline: planner → generator → validator → fix loop.
"""

from app.agents.coordinator import coordinator_agent

root_agent = coordinator_agent
