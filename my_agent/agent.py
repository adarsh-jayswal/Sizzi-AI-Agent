from google.adk.agents import Agent
from datetime import datetime
from zoneinfo import ZoneInfo
import math

# ============================================================
# TOOL 1: CURRENT TIME
# ============================================================

def get_current_time(city: str = "Delhi") -> str:
    """
    Get the current date and time for a supported city.

    Use this tool whenever the user asks for the current time,
    date, or day in a specific location.

    Args:
        city: City name such as Delhi, London, New York, Tokyo,
              Mumbai, Bengaluru, etc.

    Returns:
        Current local date and time.
    """

    timezones = {
        "delhi": "Asia/Kolkata",
        "mumbai": "Asia/Kolkata",
        "bangalore": "Asia/Kolkata",
        "bengaluru": "Asia/Kolkata",
        "kolkata": "Asia/Kolkata",
        "chennai": "Asia/Kolkata",
        "london": "Europe/London",
        "new york": "America/New_York",
        "los angeles": "America/Los_Angeles",
        "tokyo": "Asia/Tokyo",
        "dubai": "Asia/Dubai",
        "singapore": "Asia/Singapore",
        "paris": "Europe/Paris",
    }

    key = city.lower().strip()

    if key not in timezones:
        return f"Sorry, I don't currently have a timezone configured for {city}."

    now = datetime.now(ZoneInfo(timezones[key]))

    return (
        f"Current time in {city.title()}: "
        f"{now.strftime('%I:%M %p')}\n"
        f"Date: {now.strftime('%A, %d %B %Y')}"
    )


# ============================================================
# TOOL 2: CALCULATOR
# ============================================================

def calculate(expression: str) -> str:
    """
    Calculate a mathematical expression.

    Use this tool when the user asks for arithmetic or numerical
    calculations.

    Args:
        expression: Mathematical expression such as "25 * 8",
                    "sqrt(144)", or "100 / 4".

    Returns:
        Calculated result.
    """

    try:
        allowed = {
            "sqrt": math.sqrt,
            "pow": pow,
            "abs": abs,
            "round": round,
        }

        result = eval(
            expression,
            {"__builtins__": {}},
            allowed
        )

        return f"Result: {result}"

    except Exception:
        return "I couldn't calculate that expression."


# ============================================================
# TOOL 3: BASIC WEATHER
# ============================================================

def get_weather(city: str) -> str:
    """
    Get weather information for a city.

    IMPORTANT:
    This is currently a demo weather tool and does not provide
    real-time weather data.

    Args:
        city: City name.

    Returns:
        Weather information.
    """

    return (
        f"Weather information for {city} is currently unavailable "
        "because the live weather service has not been connected yet."
    )


# ============================================================
# SIZZI AGENT
# ============================================================

root_agent = Agent(
    model="gemini-3.5-flash",
    name="root_agent",

    description=(
        "Sizzi is a general-purpose AI assistant capable of "
        "answering questions and using tools when necessary."
    ),

    instruction="""
You are Sizzi, a helpful and intelligent general-purpose AI assistant.

Your job is to understand what the user actually wants and provide
accurate, useful and easy-to-understand answers.

IMPORTANT BEHAVIOR:

1. For normal knowledge, explanations, coding questions, writing,
   reasoning and general conversation, answer directly.

2. When the user asks for the CURRENT time or date, use the
   get_current_time tool.

3. When the user asks for mathematical calculations, use the
   calculate tool instead of doing the arithmetic mentally.

4. When the user asks about weather, use the get_weather tool.
   Be honest that it is a demo tool if live weather data is unavailable.

5. NEVER pretend that a tool result is real-time if the tool does
   not provide real-time information.

6. If a tool is useful, use it automatically. Do not ask the user
   to explicitly tell you which tool to use.

7. Answer in a clear structured format.

8. Do NOT put the entire response into one giant paragraph.

9. Use Markdown when appropriate:
   - headings
   - bullet lists
   - numbered lists
   - bold text
   - code blocks
   - tables when useful

10. For simple questions, keep the answer concise.

11. For technical questions, explain step-by-step.

12. If you are unsure about something, clearly say so instead
    of inventing information.

13. Your name is Sizzi.
""",

    tools=[
        get_current_time,
        calculate,
        get_weather,
    ],
)