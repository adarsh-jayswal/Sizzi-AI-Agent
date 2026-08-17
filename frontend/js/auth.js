/* ==========================================================================
   SIZZI AI AGENT — auth.js
   --------------------------------------------------------------------------
   FRONTEND-ONLY authentication UI. There is no real backend auth yet.

   What this file does:
     - Renders working login / signup / forgot-password forms with
       validation, loading states, and password visibility toggles.
     - On "successful" submit, stores a clearly-marked DEMO session object
       in localStorage so the rest of the app (script.js) can show an
       account name in the sidebar and gate the chat page.
     - NEVER stores a password, real or otherwise, anywhere.

   Wiring this up to a real backend later:
     - Replace the body of `createDemoSession()` calls in each submit
       handler with a real fetch() to your FastAPI auth endpoints
       (e.g. POST /auth/login, POST /auth/signup).
     - Keep `SizziAuth.setSession()` / `SizziAuth.getSession()` as the
       single source of truth for "who is logged in" so index.html /
       script.js don't need to change.
   ========================================================================== */

const SizziAuth = (() => {
  const SESSION_KEY = "sizzi_demo_session";
  const USERS_KEY = "sizzi_demo_users";
  const THEME_STORAGE_KEY = "sizzi_theme";

  function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function generateInitials(name) {
    const safeName = typeof name === "string" ? name.trim() : "";
    if (!safeName) return "G";
    const parts = safeName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function sanitizeUserRecord(value) {
    if (!value || typeof value !== "object") return null;

    const name = typeof value.name === "string" ? value.name.trim() : "";
    const email = normalizeEmail(value.email);
    if (!name || !email) return null;

    return {
      id: value.id || `user_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      name,
      email,
      avatar: value.avatar || null,
      plan: value.plan || "Free",
    };
  }

  function getUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      console.error("Failed to read demo users:", err);
      return {};
    }
  }

  function getUserByEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const users = getUsers();
    const user = users[normalized];
    return sanitizeUserRecord(user);
  }

  function saveUserAccount(user) {
    const normalizedUser = sanitizeUserRecord(user);
    if (!normalizedUser) return null;

    const users = getUsers();
    users[normalizedUser.email] = {
      ...normalizedUser,
      email: normalizedUser.email,
    };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return normalizedUser;
  }

  function repairSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      const normalized = sanitizeUserRecord(parsed);
      if (!normalized) {
        const savedUser = parsed && parsed.email ? getUserByEmail(parsed.email) : null;
        if (savedUser) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(savedUser));
          return savedUser;
        }

        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (err) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function getSession() {
    return repairSession();
  }

  /**
   * Stores a DEMO session only. Intentionally holds no password, token,
   * or anything sensitive — just enough to personalize the UI.
   */
  function setSession(userOrInput) {
    const current = getSession();
    const fullUser = sanitizeUserRecord(userOrInput);
    const lookupEmail = normalizeEmail(userOrInput && typeof userOrInput === "object" ? userOrInput.email : userOrInput);
    const savedUser = fullUser || (lookupEmail ? getUserByEmail(lookupEmail) : null) ||
      (current && current.email ? getUserByEmail(current.email) : null);

    if (!savedUser || !savedUser.name || !savedUser.email) {
      return null;
    }

    const session = {
      id: savedUser.id || `user_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      name: savedUser.name,
      email: normalizeEmail(savedUser.email),
      avatar: savedUser.avatar || null,
      plan: savedUser.plan || "Free",
    };

    if (session.email) {
      saveUserAccount(session);
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /**
   * Call at the top of a protected page. Redirects to login.html if no
   * demo session exists.
   */
  function requireAuth() {
    if (!getSession()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  }

  /* ---- Shared theme handling for auth pages ---- */
  function initAuthTheme() {
    const toggleBtn = document.getElementById("themeToggleBtn");
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const initial = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    applyAuthTheme(initial);

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
        applyAuthTheme(current === "dark" ? "light" : "dark");
      });
    }
  }

  function applyAuthTheme(theme) {
    const normalized = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = normalized;
    document.documentElement.style.colorScheme = normalized;
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
  }

  const authApi = {
    getSession,
    setSession,
    clearSession,
    requireAuth,
    initAuthTheme,
    getUserByEmail,
    saveUserAccount,
  };
  window.SizziAuth = authApi;
  return authApi;
})();

/* ==========================================================================
   Shared form helpers
   ========================================================================== */

function setFieldError(inputId, message) {
  const errorEl = document.getElementById(`${inputId}Error`);
  const inputEl = document.getElementById(inputId);
  if (errorEl) errorEl.textContent = message || "";
  if (inputEl) inputEl.classList.toggle("has-error", Boolean(message));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function showBanner(el, message, type = "error") {
  if (!el) return;
  el.textContent = message;
  el.className = `auth-form-banner ${type}`;
  el.hidden = false;
}

function hideBanner(el) {
  if (!el) return;
  el.hidden = true;
}

function setSubmitLoading(btn, isLoading, loadingLabel, defaultLabel) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle("is-loading", isLoading);
  const label = btn.querySelector(".auth-submit-label");
  if (label) label.textContent = isLoading ? loadingLabel : defaultLabel;
}

function wirePasswordToggles() {
  document.querySelectorAll(".field-toggle-visibility").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.toggleFor;
      const input = document.getElementById(targetId);
      if (!input) return;
      const nowVisible = input.type === "password";
      input.type = nowVisible ? "text" : "password";
      btn.setAttribute("aria-label", nowVisible ? "Hide password" : "Show password");
    });
  });
}

function evaluatePasswordStrength(value) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  return score; // 0-3
}

function wirePasswordStrengthMeter() {
  const input = document.getElementById("signupPassword");
  const bars = document.querySelectorAll("#passwordStrength .password-strength-bar");
  const label = document.getElementById("passwordStrengthLabel");
  if (!input || !bars.length) return;

  const colors = ["var(--danger)", "var(--warning)", "var(--success)"];
  const labels = ["Use 8+ characters", "Weak", "Good", "Strong"];

  input.addEventListener("input", () => {
    const score = input.value ? evaluatePasswordStrength(input.value) : 0;
    bars.forEach((bar, i) => {
      bar.style.background = i < score ? colors[Math.min(score - 1, 2)] : "var(--border)";
    });
    label.textContent = input.value ? labels[score] : labels[0];
  });
}

/* ==========================================================================
   Page init
   ========================================================================== */

function getGoogleClientId() {
  return window.SIZZI_GOOGLE_CLIENT_ID || window.GOOGLE_CLIENT_ID || "";
}

function handleGoogleOAuthButton(banner) {
  const clientId = getGoogleClientId();

  if (!clientId) {
    showBanner(banner, "Google sign-in is not configured for this app yet.", "error");
    return;
  }

  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    showBanner(banner, "Google sign-in is not ready yet. Please try again later.", "error");
    return;
  }

  showBanner(banner, "Google sign-in is not configured for this app yet.", "error");
}

function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const banner = document.getElementById("formBanner");
  const submitBtn = document.getElementById("loginSubmit");
  const googleBtn = document.getElementById("googleOauthBtn");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    hideBanner(banner);
    setFieldError("loginEmail", "");
    setFieldError("loginPassword", "");

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    let valid = true;
    if (!isValidEmail(email)) {
      setFieldError("loginEmail", "Enter a valid email address.");
      valid = false;
    }
    if (!password) {
      setFieldError("loginPassword", "Enter your password.");
      valid = false;
    }
    if (!valid) return;

    setSubmitLoading(submitBtn, true, "Signing in…", "Sign In");

    // Simulated network delay — replace with a real fetch() to your
    // FastAPI auth endpoint. Never store the password itself.
    window.setTimeout(() => {
      const savedUser = SizziAuth.getUserByEmail(email);
      if (!savedUser) {
        setSubmitLoading(submitBtn, false, "Signing in…", "Sign In");
        setFieldError("loginEmail", "No account found for this email. Please sign up first.");
        showBanner(banner, "We couldn't find a saved account for that email. Create an account and then sign in again.", "error");
        return;
      }

      SizziAuth.setSession(savedUser);
      window.location.href = "index.html";
    }, 600);
  });

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      handleGoogleOAuthButton(banner);
    });
  }
}

function initSignupPage() {
  const form = document.getElementById("signupForm");
  if (!form) return;

  const banner = document.getElementById("formBanner");
  const submitBtn = document.getElementById("signupSubmit");
  const googleBtn = document.getElementById("googleOauthBtn");

  wirePasswordStrengthMeter();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner(banner);
    ["signupName", "signupEmail", "signupPassword", "signupConfirmPassword", "signupAvatar"].forEach((id) => setFieldError(id, ""));

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("signupConfirmPassword").value;
    const avatarInput = document.getElementById("signupAvatar");
    const agreed = document.getElementById("agreeTerms").checked;

    let valid = true;
    if (name.length < 2) {
      setFieldError("signupName", "Enter your full name.");
      valid = false;
    }
    if (!isValidEmail(email)) {
      setFieldError("signupEmail", "Enter a valid email address.");
      valid = false;
    }
    if (password.length < 8) {
      setFieldError("signupPassword", "Password must be at least 8 characters.");
      valid = false;
    }
    if (confirmPassword !== password) {
      setFieldError("signupConfirmPassword", "Passwords don't match.");
      valid = false;
    }
    if (!agreed) {
      showBanner(banner, "Please agree to the Terms of Service and Privacy Policy to continue.", "error");
      valid = false;
    }
    if (!valid) return;

    setSubmitLoading(submitBtn, true, "Creating account…", "Create Account");

    const readAvatarFile = (file) => new Promise((resolve) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

    const avatar = await readAvatarFile(avatarInput && avatarInput.files ? avatarInput.files[0] : null);
    const userRecord = {
      id: `user_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      name,
      email: email.toLowerCase(),
      avatar: avatar || null,
      plan: "Free",
    };

    SizziAuth.saveUserAccount(userRecord);
    SizziAuth.setSession(userRecord);
    window.location.href = "index.html";
  });

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      handleGoogleOAuthButton(banner);
    });
  }
}

function initForgotPasswordPage() {
  const form = document.getElementById("forgotForm");
  if (!form) return;

  const banner = document.getElementById("formBanner");
  const submitBtn = document.getElementById("forgotSubmit");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    hideBanner(banner);
    setFieldError("forgotEmail", "");

    const email = document.getElementById("forgotEmail").value.trim();
    if (!isValidEmail(email)) {
      setFieldError("forgotEmail", "Enter a valid email address.");
      return;
    }

    setSubmitLoading(submitBtn, true, "Sending…", "Send Reset Link");

    window.setTimeout(() => {
      setSubmitLoading(submitBtn, false, "Sending…", "Send Reset Link");
      showBanner(banner, `If an account exists for ${email}, a reset link has been sent. (Demo only — no email was actually sent.)`, "success");
    }, 600);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  SizziAuth.initAuthTheme();
  wirePasswordToggles();
  initLoginPage();
  initSignupPage();
  initForgotPasswordPage();
});
