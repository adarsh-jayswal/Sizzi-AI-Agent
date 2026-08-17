# 🤖 Sizzi AI Agent

> An intelligent AI-powered assistant designed to help users analyze problems, write and understand code, explain concepts, research topics, and interact with an AI agent through a clean modern web interface.

## ✨ Features

* 💬 **AI Chat** — Interact with Sizzi through a conversational interface.
* 🔍 **Analyze** — Analyze questions, problems, and information.
* 💻 **Code** — Get help with programming, debugging, and code explanations.
* 📋 **Plan** — Break complex tasks into clear, actionable steps.
* 🔎 **Research** — Explore topics and organize useful information.
* 💡 **Explain** — Get concepts explained in simple, step-by-step language.
* 👤 **User Authentication** — Local signup/login flow with persistent user information.
* 👤 **Profile** — View the currently logged-in user's name, email, avatar, and plan.
* 🌙 **Dark/Light Mode** — Switch between dark and light appearance.
* 💾 **Conversation History** — Conversations are stored locally for the frontend.
* 🗑️ **Conversation Management** — Create, switch between, and delete conversations.
* ⚡ **Agent Activity** — Visual feedback while the AI agent is processing a request.
* 📋 **Code Copying** — Copy generated code directly from code blocks.
* 📱 **Responsive UI** — Designed to work across desktop and smaller screens.
* 🔌 **FastAPI Backend** — Frontend communicates with the AI agent through a FastAPI API.

---

## 🖥️ Screenshots

> Screenshots will be added here after the project screenshots are uploaded to the repository.

### Login

![Login](screenshots/login.png)

### Sign Up

![Sign Up](screenshots/signup.png)

### Main Chat

![Chat Interface](screenshots/chat.png)

### Profile

![Profile](screenshots/profile.png)

---

## 🏗️ Project Architecture

```text
Sizzi-AI-Agent/
│
├── frontend/
│   ├── css/
│   │   ├── style.css
│   │   └── auth.css
│   │
│   ├── js/
│   │   └── auth.js
│   │
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   └── forgot-password.html
│
├── my_agent/
│   ├── __init__.py
│   └── agent.py
│
├── main.py
├── test_agent.py
├── test_endpoint.py
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Responsive Web Design
* LocalStorage

### Backend

* Python
* FastAPI
* Uvicorn
* Google ADK / AI Agent integration

### Development Tools

* Visual Studio Code
* Git
* GitHub

---

## 🔄 How It Works

The application is divided into two main components:

```text
                ┌─────────────────────┐
                │     Sizzi Frontend  │
                │  HTML / CSS / JS    │
                └──────────┬──────────┘
                           │
                           │ HTTP POST
                           ▼
                ┌─────────────────────┐
                │    FastAPI Backend  │
                │      /chat API      │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │     AI Agent        │
                │   Google ADK / AI   │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Agent Response    │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │    Sizzi Frontend   │
                └─────────────────────┘
```

When a user sends a message:

1. The frontend collects the user's message.
2. The frontend sends the message and conversation history to the FastAPI backend.
3. The backend passes the request to the AI agent.
4. The agent processes the request.
5. The backend returns the response.
6. Sizzi renders the response in the chat interface.

---

## 🔐 Authentication

Sizzi currently uses a frontend-based authentication flow suitable for a demo/college project.

User information is stored locally using browser `localStorage`.

The active session uses:

```text
sizzi_demo_session
```

The authentication flow supports:

* Sign up
* Login
* Logout
* Persistent user information
* Profile information
* User avatar based on the first letter of the user's name

### ⚠️ Important

This authentication system is **not intended for production security** because credentials and session information are handled on the client side.

For production deployment, authentication should be moved to a secure backend/database solution.

---

## ⚙️ Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/adarsh-jayswal/Sizzi-AI-Agent.git
cd Sizzi-AI-Agent
```

### 2. Create a Python virtual environment

Windows:

```bash
python -m venv .venv
```

Activate it:

```bash
.venv\Scripts\activate
```

Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

If `requirements.txt` is available:

```bash
pip install -r requirements.txt
```

Otherwise install the required backend dependencies according to the project's backend configuration.

---

## 🔑 Environment Variables

Create a `.env` file for private API credentials/configuration.

Example:

```env
GOOGLE_API_KEY=your_api_key_here
```

**Never commit `.env` to GitHub.**

The repository already uses `.gitignore` to prevent environment files and other local development files from being committed.

---

## ▶️ Running the Backend

Start the FastAPI server using:

```bash
uvicorn main:app --reload
```

The backend will normally be available at:

```text
http://127.0.0.1:8000
```

---

## 🌐 Running the Frontend

Open the `frontend` folder in Visual Studio Code and run `index.html` using a local development server such as VS Code Live Server.

For example:

```text
http://127.0.0.1:5500/frontend/index.html
```

Make sure the backend is running before sending messages to the AI agent.

---

## 🔌 Backend Configuration

The frontend communicates with the backend through the API configuration in `script.js`.

During local development:

```javascript
const API_BASE_URL = "http://127.0.0.1:8000";
```

For deployment, replace the local backend URL with the URL of the deployed FastAPI service.

Example:

```javascript
const API_BASE_URL = "https://your-backend-url.example.com";
```

---

## 📡 API

### Chat

**Endpoint**

```http
POST /chat
```

### Request

```json
{
  "message": "Explain binary search",
  "history": [
    {
      "role": "user",
      "content": "What is binary search?"
    }
  ]
}
```

### Response

```json
{
  "reply": "Binary search is an efficient searching algorithm..."
}
```

> The exact request/response structure depends on the current FastAPI backend implementation.

---

## 🧪 Testing

The repository contains backend test files such as:

```text
test_agent.py
test_endpoint.py
```

Run the project's tests with:

```bash
pytest
```

if `pytest` is included in the project's installed dependencies.

---

## 🚀 Deployment

Sizzi can be deployed using separate services for the frontend and backend.

Recommended architecture:

```text
Frontend
   │
   │ HTTPS
   ▼
Static Hosting
   │
   │ API Request
   ▼
FastAPI Backend
   │
   ▼
AI Agent / Model
```

Possible deployment platforms include:

* Render
* Vercel
* Netlify
* GitHub Pages for the static frontend only

For the FastAPI backend, use a platform that supports Python web services.

### Deployment Checklist

Before deployment:

* [ ] Remove local `127.0.0.1` API URLs.
* [ ] Configure the production backend URL.
* [ ] Configure environment variables on the hosting platform.
* [ ] Never upload `.env` or API keys.
* [ ] Configure CORS for the production frontend.
* [ ] Test login and profile functionality.
* [ ] Test the `/chat` endpoint.
* [ ] Test the application from a fresh browser session.

---

## 🔒 Security Notes

This project is currently designed primarily as a learning/college project.

Before using it in production, consider implementing:

* Secure backend authentication
* Password hashing
* Database-backed user accounts
* Secure session/token management
* HTTPS-only communication
* Proper CORS configuration
* Rate limiting
* Server-side authorization
* Secure secret management
* Input validation
* Production-grade error handling

**Never expose API keys in frontend JavaScript or commit them to GitHub.**

---

## 🎯 Future Improvements

Some possible future improvements include:

* 🔐 Production-grade authentication
* 🗄️ Database-backed user accounts
* 🌐 Real Google OAuth authentication
* 📁 File upload and document analysis
* 🧠 More specialized AI agents
* 🔧 Real automation/tool execution
* 🔍 Web research capabilities
* 📊 Usage analytics
* 💾 Cloud-based conversation history
* ⚡ Streaming AI responses
* 🛡️ Improved security and rate limiting
* 📱 Progressive Web App support

---

## 📚 Learning Goals

This project was built to explore and practice:

* Frontend development
* Backend API development
* FastAPI
* AI agent integration
* Google ADK concepts
* REST APIs
* JavaScript application state
* LocalStorage
* Authentication flows
* Git and GitHub
* Deployment and cloud hosting

---

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

To contribute:

```bash
git clone https://github.com/adarsh-jayswal/Sizzi-AI-Agent.git
```

Create a new branch:

```bash
git checkout -b feature/your-feature
```

Make your changes, commit them, and open a pull request.

---

## 📄 License

This project is currently intended for educational and demonstration purposes.

If you plan to distribute or use it commercially, add an appropriate open-source license to the repository.

---

## 👨‍💻 Author

**Adarsh Jaiswal**

GitHub:
https://github.com/adarsh-jayswal

---

## ⭐ Support

If you find this project useful or interesting, consider giving the repository a ⭐ on GitHub.

---

<p align="center">
  Built with ❤️ using HTML, CSS, JavaScript, Python, FastAPI and AI.
</p>
