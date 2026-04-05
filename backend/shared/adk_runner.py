from typing import Optional

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService


class ADKRunner:
    """Manages the lifecycle of ADK Runners and ensures session existence."""

    _session_service = InMemorySessionService()

    @classmethod
    def get_session_service(cls) -> InMemorySessionService:
        return cls._session_service

    @classmethod
    def create_runner(cls, agent, app_name: str = "better-resume-builder") -> Runner:
        return Runner(
            agent=agent,
            app_name=app_name,
            session_service=cls._session_service,
        )


def get_runner(agent, app_name: str = "better-resume-builder") -> Runner:
    return ADKRunner.create_runner(agent, app_name)


def get_session_service() -> InMemorySessionService:
    return ADKRunner.get_session_service()
