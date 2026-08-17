/* ==========================================================================
   SIZZI AI AGENT — script.js
   Vanilla JS. No frameworks. Organized into clearly commented sections:
     1. Backend configuration & integration (ISOLATED — edit this only)
     2. App state
     3. DOM references
     4. Storage (localStorage)
     5. Theme
     6. Rendering (messages, markdown, conversations)
     7. Chat flow (send / receive / thinking state / retry / cancel)
     8. Agent Activity panel
     9. Error handling
    10. Sidebar
    11. Account menu
    12. Composer
    13. Connection status
    14. Event wiring & init
   ========================================================================== */

/* ==========================================================================
   1. BACKEND CONFIGURATION & INTEGRATION
   --------------------------------------------------------------------------
   Everything that talks to your FastAPI backend lives in this section only.
   The rest of the app calls `sendMessageToAgent()` and never touches
   `fetch` directly, so swapping in your real API shape is a local edit.
   ========================================================================== */

const API_BASE_URL = "http://127.0.0.1:8000";
const CHAT_ENDPOINT = "/chat"; // Google ADK agent endpoint

/**
 * sendMessageToAgent
 * ------------------
 * Sends one user message (plus optional conversation history) to the
 * FastAPI backend and returns the agent's reply as a plain string.
 *
 * CURRENT ASSUMPTION (edit to match your real backend):
 *   Request:  POST {API_BASE_URL}{CHAT_ENDPOINT}
 *             Content-Type: application/json
 *             Body: {
 *               "message": "<latest user message>",
 *               "history": [{ "role": "user"|"agent", "content": "..." }, ...]
 *             }
 *
 *   Response: 200 OK
 *             Body: { "reply": "<agent's text response>" }
 *
 * If your Google ADK / FastAPI backend uses a different request or
 * response shape, this is the ONLY function you need to change. Keep the
 * function signature (message, history, signal) => Promise<string> the
 * same and the rest of the UI will keep working.
 *
 * TODO(backend): once real ADK activity events exist (tool calls, plan
 * steps, etc.), stream them here (e.g. via SSE or websocket) and call
 * `setActivityStep(name, "active"|"done")` as each one occurs instead of
 * relying on the simulated timeline in showThinkingState().
 *
 * @param {string} message - the latest user message
 * @param {Array<{role: string, content: string}>} history - prior turns
 * @param {AbortSignal} [signal] - lets the UI cancel an in-flight request
 * @returns {Promise<string>} the agent's reply text
 */
async function sendMessageToAgent(message, history, signal) {
  const response = await fetch(`${API_BASE_URL}${CHAT_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!response.ok) {
    const error = new Error(`Backend responded with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();

  // Adjust this line if your backend's JSON field name differs
  // (e.g. data.response, data.output, data.result.text, etc.)
  if (typeof data.reply !== "string") {
    throw new Error("Unexpected response shape from backend (expected { reply: string })");
  }

  return data.reply;
}

/**
 * checkBackendConnection
 * -----------------------
 * Lightweight reachability check used to color the "Backend" indicator.
 * This is deliberately separate from "Agent" readiness — a reachable
 * FastAPI server does not guarantee the underlying model/tooling is
 * available. Adjust the endpoint if your backend exposes a dedicated
 * health check (e.g. "/health").
 */
async function checkBackendConnection() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    await fetch(`${API_BASE_URL}/`, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);
    setConnectionStatus("online");
  } catch (err) {
    setConnectionStatus("offline");
  }
}

/* ==========================================================================
   2. APP STATE
   ========================================================================== */

const state = {
  conversations: [],   // [{ id, title, messages: [{role, content, timestamp}], createdAt }]
  activeConversationId: null,
  isAwaitingResponse: false,
  lastFailedMessage: null, // holds the message text if the last send failed, for retry
  activeAbortController: null,
  theme: "dark",
};

const CHAT_STORAGE_PREFIX = "sizzi_demo_chats_";
const CHAT_MAP_STORAGE_KEY = "sizzi_demo_chats";
const LEGACY_CHAT_STORAGE_KEY = "sizzi_conversations_v1";
const THEME_STORAGE_KEY = "sizzi_theme";

function getCurrentUser() {
  return window.SizziAuth ? window.SizziAuth.getSession() : null;
}

function getChatsStorageKeyForUser(userId) {
  return userId ? `${CHAT_STORAGE_PREFIX}${userId}` : null;
}

function normalizeConversation(conversation, userId) {
  if (!conversation || typeof conversation !== "object") return null;

  const safeUserId = conversation.userId || userId || "guest";
  const normalizedMessages = Array.isArray(conversation.messages) ? conversation.messages : [];

  return {
    id: conversation.id || `convo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: safeUserId,
    title: typeof conversation.title === "string" && conversation.title.trim() ? conversation.title.trim() : "New conversation",
    messages: normalizedMessages,
    createdAt: conversation.createdAt || Date.now(),
    updatedAt: conversation.updatedAt || Date.now(),
  };
}

function readStoredChatMap() {
  try {
    const raw = localStorage.getItem(CHAT_MAP_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.error("Failed to read chat map:", err);
    return {};
  }
}

/* ==========================================================================
   3. DOM REFERENCES
   ========================================================================== */

const dom = {
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  sidebarScrim: document.getElementById("sidebarScrim"),
  convoList: document.getElementById("convoList"),
  convoEmptyState: document.getElementById("convoEmptyState"),
  newChatHeaderBtn: document.getElementById("newChatHeaderBtn"),
  newChatSidebarBtn: document.getElementById("newChatSidebarBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),

  welcomeScreen: document.getElementById("welcomeScreen"),
  welcomeReady: document.getElementById("welcomeReady"),
  welcomeReadyText: document.getElementById("welcomeReadyText"),
  messageLog: document.getElementById("messageLog"),
  agentActivity: document.getElementById("agentActivity"),
  activitySteps: document.getElementById("activitySteps"),
  errorBanner: document.getElementById("errorBanner"),
  errorBannerInner: document.getElementById("errorBannerInner"),
  errorTitle: document.getElementById("errorTitle"),
  errorDesc: document.getElementById("errorDesc"),
  retryBtn: document.getElementById("retryBtn"),

  composerForm: document.getElementById("composerForm"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  charCounter: document.getElementById("charCounter"),
  attachBtn: document.getElementById("attachBtn"),

  connectionStatus: document.getElementById("connectionStatus"),
  connectionStatusText: document.getElementById("connectionStatusText"),
  agentStatus: document.getElementById("agentStatus"),
  agentStatusText: document.getElementById("agentStatusText"),

  accountTrigger: document.getElementById("accountTrigger"),
  accountMenu: document.getElementById("accountMenu"),
  accountAvatar: document.getElementById("accountAvatar"),
  accountName: document.getElementById("accountName"),
  accountPlan: document.getElementById("accountPlan"),

  messageTemplate: document.getElementById("messageTemplate"),
  convoItemTemplate: document.getElementById("convoItemTemplate"),
};

/* ==========================================================================
   4. STORAGE (localStorage)
   ========================================================================== */

function saveChats() {
  try {
    const currentUser = getCurrentUser();
    const storageKey = currentUser && currentUser.id ? getChatsStorageKeyForUser(currentUser.id) : null;
    if (!storageKey) return;

    const filtered = state.conversations
      .map((conversation) => normalizeConversation(conversation, currentUser.id))
      .filter((conversation) => conversation && conversation.userId === currentUser.id);

    state.conversations = filtered.map((conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
    }));

    localStorage.setItem(storageKey, JSON.stringify(state.conversations));

    const chatMap = readStoredChatMap();
    chatMap[currentUser.id] = state.conversations;
    localStorage.setItem(CHAT_MAP_STORAGE_KEY, JSON.stringify(chatMap));

    if (localStorage.getItem(LEGACY_CHAT_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
    }
  } catch (err) {
    console.error("Failed to save conversations:", err);
  }
}

function loadChats() {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
      state.conversations = [];
      return;
    }

    const storageKey = getChatsStorageKeyForUser(currentUser.id);
    let parsedConversations = [];

    if (storageKey) {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsedConversations = Array.isArray(parsed) ? parsed : [];
      }
    }

    if (!parsedConversations.length) {
      const chatMap = readStoredChatMap();
      const mapValue = Array.isArray(chatMap[currentUser.id]) ? chatMap[currentUser.id] : [];
      parsedConversations = mapValue;
    }

    if (!parsedConversations.length) {
      const legacyRaw = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const legacyParsed = JSON.parse(legacyRaw);
          parsedConversations = Array.isArray(legacyParsed) ? legacyParsed : [];
        } catch (legacyErr) {
          console.error("Failed to read legacy chat storage:", legacyErr);
        }
      }
    }

    state.conversations = parsedConversations
      .map((conversation) => normalizeConversation(conversation, currentUser.id))
      .filter((conversation) => conversation && conversation.userId === currentUser.id);

    if (storageKey && state.conversations.length) {
      localStorage.setItem(storageKey, JSON.stringify(state.conversations));
    }
  } catch (err) {
    console.error("Failed to load conversations:", err);
    state.conversations = [];
  }
}

/* ==========================================================================
   5. THEME
   ========================================================================== */

function getThemeIcon(theme) {
  if (theme === "light") {
    return `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2.75v1.6M10 15.65v1.6M4.2 4.2l1.1 1.1M14.7 14.7l1.1 1.1M2.75 10h1.6M15.65 10h1.6M4.2 15.8l1.1-1.1M14.7 5.3l1.1-1.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="10" cy="10" r="3.15" stroke="currentColor" stroke-width="1.4"/>
      </svg>
    `;
  }
  return `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M13.6 3.5A6.8 6.8 0 0 0 8.2 16.3 7.3 7.3 0 0 1 13.6 3.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>
  `;
}

function applyTheme(theme) {
  const normalized = theme === "light" ? "light" : "dark";
  state.theme = normalized;
  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;
  localStorage.setItem(THEME_STORAGE_KEY, normalized);

  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.innerHTML = getThemeIcon(normalized);
    const label = normalized === "dark" ? "Switch to light mode" : "Switch to dark mode";
    dom.themeToggleBtn.setAttribute("aria-label", label);
    dom.themeToggleBtn.setAttribute("title", label);
  }
}

/* ==========================================================================
   6. RENDERING
   ========================================================================== */

function getActiveConversation() {
  return state.conversations.find((c) => c.id === state.activeConversationId) || null;
}

function renderConvoList() {
  dom.convoList.innerHTML = "";

  const sorted = [...state.conversations].sort((a, b) => b.createdAt - a.createdAt);
  dom.convoEmptyState.classList.toggle("visible", sorted.length === 0);

  sorted.forEach((convo) => {
    const node = dom.convoItemTemplate.content.cloneNode(true);
    const item = node.querySelector(".convo-item");
    const btn = node.querySelector(".convo-item-btn");
    const title = node.querySelector(".convo-item-title");
    const deleteBtn = node.querySelector(".convo-delete-btn");

    title.textContent = convo.title;
    item.classList.toggle("active", convo.id === state.activeConversationId);
    btn.setAttribute("aria-current", convo.id === state.activeConversationId ? "true" : "false");

    btn.addEventListener("click", () => switchConversation(convo.id));
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(convo.id);
    });

    dom.convoList.appendChild(node);
  });
}

function scrollToLatestMessage({ behavior = "auto", force = false } = {}) {
  const log = dom.messageLog;
  if (!log || log.hidden) return;

  const distanceFromBottom = log.scrollHeight - (log.scrollTop + log.clientHeight);
  if (force || distanceFromBottom <= 120) {
    requestAnimationFrame(() => {
      log.scrollTo({ top: log.scrollHeight, behavior });
    });
  }
}

/**
 * renderMarkdown
 * --------------
 * Converts markdown to sanitized HTML using `marked` + `DOMPurify`
 * (both loaded in index.html). Falls back to plain-text escaping if
 * either library failed to load, so the app never breaks because of a
 * CDN hiccup.
 */
function renderMarkdown(rawText) {
  if (typeof marked === "undefined" || typeof DOMPurify === "undefined") {
    const escaped = document.createElement("div");
    escaped.textContent = rawText;
    return escaped.innerHTML;
  }
  const html = marked.parse(rawText, { breaks: true });
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
}

/**
 * Wraps every <pre><code> block in the rendered message with a
 * .code-block container and a copy-to-clipboard button.
 */
function enhanceCodeBlocks(container) {
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement.classList.contains("code-block")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "code-copy-btn";
    copyBtn.setAttribute("aria-label", "Copy code");
    copyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.1"/>
        <path d="M2.5 8V2.8A1.3 1.3 0 0 1 3.8 1.5H8" stroke="currentColor" stroke-width="1.1"/>
      </svg>
      <span>Copy</span>
    `;
    copyBtn.addEventListener("click", async () => {
      const code = pre.querySelector("code") || pre;
      try {
        await navigator.clipboard.writeText(code.textContent || "");
        copyBtn.classList.add("copied");
        copyBtn.querySelector("span").textContent = "Copied";
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.querySelector("span").textContent = "Copy";
        }, 1600);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    });

    wrapper.appendChild(copyBtn);
  });
}

function renderMessage(message) {
  const node = dom.messageTemplate.content.cloneNode(true);
  const wrapper = node.querySelector(".message");
  const avatar = node.querySelector(".message-avatar");
  const sender = node.querySelector(".message-sender");
  const time = node.querySelector(".message-time");
  const text = node.querySelector(".message-text");

  const isUser = message.role === "user";
  wrapper.classList.add(isUser ? "user" : "agent");
  sender.textContent = isUser ? "You" : "Sizzi";
  avatar.textContent = isUser ? getUserInitial() : "S";
  time.textContent = formatTimestamp(message.timestamp);

  if (message.isError) {
    text.textContent = message.content;
    text.classList.add("error-text-inline");
  } else if (isUser) {
    // User input is rendered as plain text, never as markdown/HTML.
    text.textContent = message.content;
  } else {
    text.innerHTML = renderMarkdown(message.content);
    enhanceCodeBlocks(text);
  }

  dom.messageLog.appendChild(node);
}

function getUserInitial() {
  const session = window.SizziAuth ? window.SizziAuth.getSession() : null;
  const name = session && session.name ? session.name : "You";
  return name.trim().charAt(0).toUpperCase() || "Y";
}

function renderActiveConversation() {
  const convo = getActiveConversation();
  dom.messageLog.innerHTML = "";

  const hasMessages = convo && convo.messages.length > 0;
  dom.welcomeScreen.hidden = hasMessages;
  dom.messageLog.hidden = !hasMessages;

  if (hasMessages) {
    convo.messages.forEach(renderMessage);
    scrollToLatestMessage({ behavior: "auto", force: true });
  }

  renderConvoList();
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ==========================================================================
   7. CHAT FLOW
   ========================================================================== */

function ensureActiveConversation() {
  if (state.activeConversationId && getActiveConversation()) return;
  createNewChat();
}

function createNewChat() {
  const currentUser = getCurrentUser();
  const convo = {
    id: `convo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: currentUser && currentUser.id ? currentUser.id : "guest",
    title: "New conversation",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.conversations.push(convo);
  state.activeConversationId = convo.id;
  saveChats();
  hideError();
  renderActiveConversation();
  closeSidebarOnMobile();
  dom.messageInput.focus();
}

function switchConversation(id) {
  state.activeConversationId = id;
  hideError();
  renderActiveConversation();
  closeSidebarOnMobile();
}

function deleteChat(id) {
  state.conversations = state.conversations.filter((c) => c.id !== id);
  saveChats();

  if (state.activeConversationId === id) {
    state.activeConversationId = state.conversations.length
      ? state.conversations.sort((a, b) => b.createdAt - a.createdAt)[0].id
      : null;
  }

  if (!state.conversations.length) {
    renderConvoList();
    dom.welcomeScreen.hidden = false;
    dom.messageLog.hidden = true;
    dom.messageLog.innerHTML = "";
  } else {
    renderActiveConversation();
  }
}

function deriveTitleFromMessage(text) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed || "New conversation";
}

async function sendMessage(rawText) {
  const text = (rawText ?? dom.messageInput.value).trim();
  if (!text || state.isAwaitingResponse) return;

  ensureActiveConversation();
  const convo = getActiveConversation();

  if (convo.messages.length === 0) {
    convo.title = deriveTitleFromMessage(text);
  }

  const userMessage = { role: "user", content: text, timestamp: new Date().toISOString() };
  convo.userId = convo.userId || (getCurrentUser() ? getCurrentUser().id : null) || "guest";
  convo.updatedAt = Date.now();
  convo.messages.push(userMessage);
  saveChats();

  dom.welcomeScreen.hidden = true;
  dom.messageLog.hidden = false;
  renderMessage(userMessage);
  renderConvoList();
  scrollToLatestMessage({ behavior: "smooth", force: true });

  resetComposer();
  hideError();
  await requestAgentReply(convo, text);
}

async function requestAgentReply(convo, text) {
  state.isAwaitingResponse = true;
  state.lastFailedMessage = text;
  setComposerDisabled(true);
  setSendButtonMode("stop");

  const controller = new AbortController();
  state.activeAbortController = controller;

  showThinkingState();

  const history = convo.messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    const reply = await sendMessageToAgent(text, history, controller.signal);
    hideThinkingState();

    const agentMessage = { role: "agent", content: reply, timestamp: new Date().toISOString() };
    convo.updatedAt = Date.now();
    convo.messages.push(agentMessage);
    saveChats();
    renderMessage(agentMessage);
    scrollToLatestMessage({ behavior: "smooth", force: true });

    state.lastFailedMessage = null;
    setConnectionStatus("online");
  } catch (err) {
    hideThinkingState();
    if (err.name === "AbortError") {
      // User cancelled — not an error state.
    } else {
      console.error("Agent request failed:", err);
      showError(err);
      if (err.message !== "Backend responded with status 429") {
        setConnectionStatus("offline");
      }
    }
  } finally {
    state.isAwaitingResponse = false;
    state.activeAbortController = null;
    setComposerDisabled(false);
    setSendButtonMode("send");
  }
}

function cancelActiveRequest() {
  if (state.activeAbortController) {
    state.activeAbortController.abort();
  }
}

function retryMessage() {
  if (!state.lastFailedMessage) return;
  const convo = getActiveConversation();
  if (!convo) return;
  hideError();
  requestAgentReply(convo, state.lastFailedMessage);
}

/* ==========================================================================
   8. AGENT ACTIVITY PANEL
   --------------------------------------------------------------------------
   Simulated step timeline today. `setActivityStep` is exposed so a future
   real ADK event stream can drive these steps directly — see the TODO on
   sendMessageToAgent().
   ========================================================================== */

const THINKING_STEP_ORDER = ["received", "understanding", "processing", "generating"];
let thinkingStepTimer = null;

function showThinkingState() {
  dom.agentActivity.hidden = false;
  scrollToLatestMessage({ behavior: "smooth", force: true });

  let stepIndex = 0;
  setActivityStep(THINKING_STEP_ORDER[stepIndex], "active");

  clearInterval(thinkingStepTimer);
  thinkingStepTimer = setInterval(() => {
    stepIndex = Math.min(stepIndex + 1, THINKING_STEP_ORDER.length - 1);
    setActivityStep(THINKING_STEP_ORDER[stepIndex], "active");
    if (stepIndex === THINKING_STEP_ORDER.length - 1) clearInterval(thinkingStepTimer);
  }, 750);
}

/**
 * setActivityStep(name, status)
 * status: "pending" | "active" | "done"
 * Marks all steps before `name` as done and everything after as pending.
 */
function setActivityStep(activeStepName, status = "active") {
  const steps = dom.activitySteps.querySelectorAll(".activity-step");
  let reachedActive = false;
  steps.forEach((step) => {
    const name = step.dataset.step;
    step.classList.remove("active", "done", "pending");
    if (name === activeStepName) {
      step.classList.add(status);
      reachedActive = true;
    } else if (!reachedActive) {
      step.classList.add("done");
    } else {
      step.classList.add("pending");
    }
  });
}

function hideThinkingState() {
  clearInterval(thinkingStepTimer);
  dom.agentActivity.hidden = true;
  const steps = dom.activitySteps.querySelectorAll(".activity-step");
  steps.forEach((step) => step.classList.remove("active", "done", "pending"));
}

/* ==========================================================================
   9. ERROR HANDLING
   --------------------------------------------------------------------------
   Distinguishes a few common failure modes without leaking internal
   backend details to the user.
   ========================================================================== */

function showError(err) {
  let title = "Couldn't connect to Sizzi AI Agent";
  let desc = "Make sure the FastAPI server is running.";
  let variant = "error";
  let showRetry = true;

  if (err && err.message === "Failed to fetch") {
    title = "Connection problem";
    desc = "Check your internet connection and that the FastAPI server is reachable, then try again.";
  } else if (err && err.status === 429) {
    title = "AI service temporarily unavailable";
    desc = "The model's usage quota may have been reached. Please try again in a moment.";
    variant = "warning";
  } else if (err && typeof err.status === "number" && err.status >= 500) {
    title = "Couldn't reach Sizzi AI Agent";
    desc = "Make sure the FastAPI server is running and check the server logs for details.";
  } else if (err && typeof err.status === "number") {
    title = "Something went wrong";
    desc = "The backend returned an unexpected response. Please try again.";
  }

  dom.errorTitle.textContent = title;
  dom.errorDesc.textContent = desc;
  dom.errorBannerInner.classList.toggle("warning", variant === "warning");
  dom.retryBtn.hidden = !showRetry;
  dom.errorBanner.hidden = false;
  scrollToLatestMessage({ behavior: "smooth", force: true });
}

function hideError() {
  dom.errorBanner.hidden = true;
}

/* ==========================================================================
   10. SIDEBAR
   ========================================================================== */

function toggleSidebar() {
  const isMobile = window.matchMedia("(max-width: 820px)").matches;
  if (isMobile) {
    const isOpen = dom.sidebar.classList.toggle("mobile-open");
    dom.sidebarScrim.classList.toggle("visible", isOpen);
    dom.sidebarScrim.hidden = !isOpen;
    dom.sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  } else {
    const isCollapsed = dom.sidebar.classList.toggle("collapsed");
    dom.sidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
  }
}

function closeSidebarOnMobile() {
  const isMobile = window.matchMedia("(max-width: 820px)").matches;
  if (isMobile) {
    dom.sidebar.classList.remove("mobile-open");
    dom.sidebarScrim.classList.remove("visible");
    dom.sidebarScrim.hidden = true;
    dom.sidebarToggle.setAttribute("aria-expanded", "false");
  }
}

/* ==========================================================================
   11. ACCOUNT MENU
   ========================================================================== */

function populateAccountArea() {
  const session = window.SizziAuth ? window.SizziAuth.getSession() : null;
  const name = session && session.name ? session.name : "Guest";
  const plan = session && session.plan ? session.plan : "Free";
  const avatarValue = session && session.avatar ? session.avatar : null;

  dom.accountName.textContent = name;
  dom.accountPlan.textContent = plan === "Free" ? "Free Plan" : plan;

  if (avatarValue && /^data:image\//i.test(avatarValue)) {
    dom.accountAvatar.textContent = "";
    dom.accountAvatar.style.backgroundImage = `url("${avatarValue}")`;
    dom.accountAvatar.style.backgroundSize = "cover";
    dom.accountAvatar.style.backgroundPosition = "center";
    dom.accountAvatar.style.color = "transparent";
  } else {
    dom.accountAvatar.style.backgroundImage = "";
    dom.accountAvatar.textContent = name.trim().charAt(0).toUpperCase() || "G";
    dom.accountAvatar.style.color = "";
  }
}

function openAccountMenu() {
  dom.accountMenu.hidden = false;
  dom.accountTrigger.setAttribute("aria-expanded", "true");
  const firstItem = dom.accountMenu.querySelector(".account-menu-item");
  if (firstItem) firstItem.focus();
}

function closeAccountMenu({ refocusTrigger = false } = {}) {
  dom.accountMenu.hidden = true;
  dom.accountTrigger.setAttribute("aria-expanded", "false");
  if (refocusTrigger) dom.accountTrigger.focus();
}

function isAccountMenuOpen() {
  return !dom.accountMenu.hidden;
}

function handleAccountMenuAction(action) {
  switch (action) {

    case "signout":
      if (window.SizziAuth) window.SizziAuth.clearSession();
      window.location.href = "login.html";
      break;

    case "appearance":
      applyTheme(state.theme === "dark" ? "light" : "dark");
      closeAccountMenu({ refocusTrigger: true });
      break;

    case "profile":
      closeAccountMenu({ refocusTrigger: true });
      openProfileModal();
      break;

    case "settings":
      closeAccountMenu({ refocusTrigger: true });
      openSettingsModal();
      break;

    case "help":
      closeAccountMenu({ refocusTrigger: true });
      openHelpModal();
      break;

    default:
      closeAccountMenu({ refocusTrigger: true });
      break;
  }
}

/* ==========================================================================
   12. COMPOSER
   ========================================================================== */

const MAX_CHARS = 4000;

const SEND_ICON = `
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2.5 9h13M9 2.5 15.5 9 9 15.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;
const STOP_ICON = `
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="4.5" y="4.5" width="7" height="7" rx="1.4" fill="currentColor"/>
  </svg>
`;

function setSendButtonMode(mode) {
  if (mode === "stop") {
    dom.sendBtn.innerHTML = STOP_ICON;
    dom.sendBtn.setAttribute("aria-label", "Stop generating");
    dom.sendBtn.disabled = false;
    dom.sendBtn.dataset.mode = "stop";
  } else {
    dom.sendBtn.innerHTML = SEND_ICON;
    dom.sendBtn.setAttribute("aria-label", "Send message");
    dom.sendBtn.dataset.mode = "send";
    updateSendButtonState();
  }
}

function autoResizeTextarea() {
  dom.messageInput.style.height = "auto";
  dom.messageInput.style.height = `${Math.min(dom.messageInput.scrollHeight, 200)}px`;
}

function updateCharCounter() {
  const len = dom.messageInput.value.length;
  dom.charCounter.textContent = `${len} / ${MAX_CHARS}`;
  dom.charCounter.classList.toggle("near-limit", len > MAX_CHARS * 0.92);
}

function updateSendButtonState() {
  if (dom.sendBtn.dataset.mode === "stop") return;
  const hasText = dom.messageInput.value.trim().length > 0;
  dom.sendBtn.disabled = !hasText || state.isAwaitingResponse;
}

function resetComposer() {
  dom.messageInput.value = "";
  autoResizeTextarea();
  updateCharCounter();
  updateSendButtonState();
}

function setComposerDisabled(disabled) {
  dom.messageInput.disabled = disabled;
  updateSendButtonState();
}

/* ==========================================================================
   13. CONNECTION STATUS
   ========================================================================== */

function setConnectionStatus(statusValue) {
  dom.connectionStatus.classList.remove("status-unknown", "status-online", "status-offline");
  dom.agentStatus.classList.remove("status-unknown", "status-online", "status-offline");

  if (statusValue === "online") {
    dom.connectionStatus.classList.add("status-online");
    dom.connectionStatusText.textContent = "Connected";
    dom.agentStatus.classList.add("status-online");
    dom.agentStatusText.textContent = "Ready";
    if (dom.welcomeReadyText) dom.welcomeReadyText.textContent = "Ready";
  } else if (statusValue === "offline") {
    dom.connectionStatus.classList.add("status-offline");
    dom.connectionStatusText.textContent = "Unreachable";
    dom.agentStatus.classList.add("status-offline");
    dom.agentStatusText.textContent = "Idle";
    if (dom.welcomeReadyText) dom.welcomeReadyText.textContent = "Backend unreachable";
  } else {
    dom.connectionStatus.classList.add("status-unknown");
    dom.connectionStatusText.textContent = "Checking…";
    dom.agentStatus.classList.add("status-unknown");
    dom.agentStatusText.textContent = "Checking…";
    if (dom.welcomeReadyText) dom.welcomeReadyText.textContent = "Checking connection…";
  }
}

/* ==========================================================================
   14. EVENT WIRING & INIT
   ========================================================================== */

function wireEvents() {
  dom.sidebarToggle.addEventListener("click", toggleSidebar);
  dom.sidebarScrim.addEventListener("click", closeSidebarOnMobile);

  dom.newChatHeaderBtn.addEventListener("click", createNewChat);
  dom.newChatSidebarBtn.addEventListener("click", createNewChat);

  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.addEventListener("click", () => {
      applyTheme(state.theme === "dark" ? "light" : "dark");
    });
  }

  dom.retryBtn.addEventListener("click", retryMessage);

  document.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      sendMessage(card.dataset.prompt);
    });
  });

  dom.composerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (dom.sendBtn.dataset.mode === "stop") {
      cancelActiveRequest();
      return;
    }
    sendMessage();
  });

  dom.messageInput.addEventListener("input", () => {
    autoResizeTextarea();
    updateCharCounter();
    updateSendButtonState();
  });

  dom.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (dom.sendBtn.dataset.mode !== "stop") sendMessage();
    }
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 820px)").matches) {
      dom.sidebar.classList.remove("mobile-open");
      dom.sidebarScrim.classList.remove("visible");
      dom.sidebarScrim.hidden = true;
    }
  });

  /* ---- Account menu ---- */
  dom.accountTrigger.addEventListener("click", () => {
    if (isAccountMenuOpen()) {
      closeAccountMenu();
    } else {
      openAccountMenu();
    }
  });

  dom.accountMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".account-menu-item");
    if (item) handleAccountMenuAction(item.dataset.action);
  });

  document.addEventListener("click", (e) => {
    if (!isAccountMenuOpen()) return;
    const withinMenu =
      dom.accountMenu.contains(e.target) ||
      dom.accountTrigger.contains(e.target);

    if (!withinMenu) closeAccountMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!document.getElementById("settingsModal") || document.getElementById("settingsModal").hidden === false) {
        closeSettingsModal();
        return;
      }
      if (!document.getElementById("helpModal") || document.getElementById("helpModal").hidden === false) {
        closeHelpModal();
        return;
      }
      if (isAccountMenuOpen()) {
        closeAccountMenu({ refocusTrigger: true });
      }
    }
  });

  /* ---- Profile Modal ---- */
  const profileModalClose =
    document.getElementById("profileModalClose");

  const profileModalDone =
    document.getElementById("profileModalDone");

  const profileModalOverlay =
    document.getElementById("profileModalOverlay");

  if (profileModalClose) {
    profileModalClose.addEventListener("click", closeProfileModal);
  }

  if (profileModalDone) {
    profileModalDone.addEventListener("click", closeProfileModal);
  }

  if (profileModalOverlay) {
    profileModalOverlay.addEventListener("click", closeProfileModal);
  }

  /* ---- Settings and Help Modal ---- */
  const settingsModalClose = document.getElementById("settingsModalClose");
  const settingsModalDone = document.getElementById("settingsModalDone");
  const settingsModalOverlay = document.getElementById("settingsModalOverlay");
  const settingsThemeToggle = document.getElementById("settingsThemeToggle");

  if (settingsModalClose) {
    settingsModalClose.addEventListener("click", closeSettingsModal);
  }

  if (settingsModalDone) {
    settingsModalDone.addEventListener("click", closeSettingsModal);
  }

  if (settingsModalOverlay) {
    settingsModalOverlay.addEventListener("click", closeSettingsModal);
  }

  if (settingsThemeToggle) {
    settingsThemeToggle.addEventListener("click", () => {
      applyTheme(state.theme === "dark" ? "light" : "dark");
      updateSettingsThemeLabel();
    });
  }

  const helpModalClose = document.getElementById("helpModalClose");
  const helpModalDone = document.getElementById("helpModalDone");
  const helpModalOverlay = document.getElementById("helpModalOverlay");

  if (helpModalClose) {
    helpModalClose.addEventListener("click", closeHelpModal);
  }

  if (helpModalDone) {
    helpModalDone.addEventListener("click", closeHelpModal);
  }

  if (helpModalOverlay) {
    helpModalOverlay.addEventListener("click", closeHelpModal);
  }
}

function init() {
  // Frontend-only auth guard — see auth.js for what this checks.
  if (window.SizziAuth && !window.SizziAuth.requireAuth()) return;

  populateAccountArea();
  loadChats();

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  applyTheme(initialTheme);

  if (state.conversations.length) {
    state.activeConversationId = [...state.conversations].sort((a, b) => b.createdAt - a.createdAt)[0].id;
  }

  renderActiveConversation();
  resetComposer();
  wireEvents();
  checkBackendConnection();
}

document.addEventListener("DOMContentLoaded", init);

function openProfileModal() {
  const modal = document.getElementById("profileModal");

  if (!modal) return;

  const session = window.SizziAuth ? window.SizziAuth.getSession() : null;
  const name = session && session.name ? session.name : "Guest";
  const email = session && session.email ? session.email : "Not available";
  const avatarValue = session && session.avatar ? session.avatar : null;

  const avatar = document.getElementById("profileModalAvatar");
  const nameEl = document.getElementById("profileModalName");
  const emailEl = document.getElementById("profileModalEmail");

  if (avatar) {
    if (avatarValue && /^data:image\//i.test(avatarValue)) {
      avatar.textContent = "";
      avatar.style.backgroundImage = `url("${avatarValue}")`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.style.color = "transparent";
    } else {
      avatar.style.backgroundImage = "";
      avatar.textContent = name.trim().charAt(0).toUpperCase() || "G";
      avatar.style.color = "";
    }
  }

  if (nameEl) {
    nameEl.textContent = name;
  }

  if (emailEl) {
    emailEl.textContent = email || "Not available";
  }

  modal.hidden = false;
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (!modal) return;
  modal.hidden = true;
}

function updateSettingsThemeLabel() {
  const label = document.getElementById("settingsThemeLabel");
  if (label) {
    label.textContent = state.theme === "dark" ? "Dark" : "Light";
  }
}

function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;
  updateSettingsThemeLabel();
  modal.hidden = false;
}

function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;
  modal.hidden = true;
}

function openHelpModal() {
  const modal = document.getElementById("helpModal");
  if (!modal) return;
  modal.hidden = false;
}

function closeHelpModal() {
  const modal = document.getElementById("helpModal");
  if (!modal) return;
  modal.hidden = true;
}
