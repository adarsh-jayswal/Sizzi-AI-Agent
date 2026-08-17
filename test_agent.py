"""Test script to understand Google ADK Agent event structure."""

import asyncio
import os
from dotenv import load_dotenv
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from my_agent.agent import root_agent

# Load env
load_dotenv("my_agent/.env")

async def test_agent():
    """Test running the agent and print event structure."""
    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name="test_app",
        session_service=session_service,
        auto_create_session=True
    )
    
    user_id = "test_user"
    session_id = "test_session"
    
    # Create message
    message_content = types.Content(
        role="user",
        parts=[types.Part(text="Hello, agent!")]
    )
    
    print("Running agent...")
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=message_content
    ):
        print(f"\nEvent type: {type(event)}")
        print(f"Event: {event}")
        print(f"Event.message: {getattr(event, 'message', 'NO MESSAGE ATTR')}")
        if hasattr(event, 'is_final_response'):
            print(f"Is final: {event.is_final_response()}")
        
        # Try to extract text
        if hasattr(event, 'message') and event.message:
            print(f"Message type: {type(event.message)}")
            print(f"Message: {event.message}")
            if hasattr(event.message, 'parts'):
                for part in event.message.parts:
                    if hasattr(part, 'text'):
                        print(f"Text part: {part.text}")

if __name__ == "__main__":
    asyncio.run(test_agent())
