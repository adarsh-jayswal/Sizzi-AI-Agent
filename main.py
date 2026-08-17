"""
FastAPI backend for Sizzi's AI Agent.

Routes user messages from the frontend through the Google ADK agent
and returns responses using the correct ADK execution pattern.
Handles CORS for local development.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import asyncio
import uuid
from dotenv import load_dotenv
import logging

# Load environment variables from my_agent/.env
load_dotenv(os.path.join(os.path.dirname(__file__), "my_agent", ".env"))

# Import Google ADK components
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google import genai

# Import the agent
from my_agent.agent import root_agent

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Sizzi's AI Agent Backend",
    description="FastAPI backend for the Sizzi AI Agent frontend",
    version="1.0.0",
)

# Configure CORS for local development
# Allow the frontend to make requests from common local ports
origins = [
    "http://localhost:5500",     # VS Code Live Server default
    "http://127.0.0.1:5500",     # Live Server loopback
    "http://localhost:3000",     # Common Node dev server
    "http://127.0.0.1:3000",     # Node loopback
    "http://localhost:8080",     # Another common port
    "http://127.0.0.1:8080",     # Loopback
    "http://localhost",          # Bare localhost
    "http://127.0.0.1",          # Loopback
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize session service (in-memory for simplicity)
_session_service = InMemorySessionService()


# Request/Response models
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


# Routes
@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Sizzi's AI Agent backend is running"}


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Process a user message through the Google ADK agent.
    
    Uses the Google ADK Runner with InMemorySessionService to execute
    the root_agent with the proper async execution pattern.
    
    Expected request:
    {
        "message": "Hello",
        "history": [
            {"role": "user", "content": "Hi"},
            {"role": "agent", "content": "Hello!"}
        ]
    }
    
    Returns:
    {
        "reply": "Agent's response here"
    }
    """
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        logger.info(f"Processing message: {request.message[:50]}...")
        
        # Create runner with ADK-compliant session service
        runner = Runner(
            agent=root_agent,
            app_name="sizzi_ai_agent",
            session_service=_session_service,
            auto_create_session=True
        )
        
        # Generate unique IDs for this request
        user_id = "user_default"
        session_id = "session_default"
        
        # Create Content object with user message
        message_content = genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=request.message)]
        )
        
        # Run the agent asynchronously
        reply_text = ""
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=message_content
        ):
            # Extract final response
            if event.is_final_response() and event.message:
                for part in event.message.parts:
                    if hasattr(part, 'text') and part.text:
                        reply_text += part.text
        
        if not reply_text:
            raise ValueError("Agent did not return a response")
        
        logger.info(f"Agent response received: {reply_text[:50]}...")
        
        return ChatResponse(reply=reply_text)
    
    except HTTPException as he:
        logger.error(f"HTTP error: {he.detail}")
        raise he
    
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """Detailed health check endpoint."""
    return {
        "status": "ok",
        "agent": "root_agent",
        "model": "gemini-3.5-flash",
        "backend": "google_adk",
        "session_service": "InMemorySessionService"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
