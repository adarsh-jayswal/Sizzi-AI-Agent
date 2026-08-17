"""Test the /chat endpoint."""

import asyncio
import aiohttp
import json

async def test_chat_endpoint():
    """Send a test message to the /chat endpoint."""
    url = "http://127.0.0.1:8000/chat"
    payload = {
        "message": "Hello",
        "history": []
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                print(f"Status: {response.status}")
                data = await response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_chat_endpoint())
