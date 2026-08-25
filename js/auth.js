// auth.js — sign up, sign in, sign out, and the auth screen UI.
// No account is required to look at the landing/auth screen itself;
// everything past it requires a signed-in user.

const Auth = (() => {
  let currentUser = null;
  let mode = "signin"; // "signin" | "signup"

  function onAuthChange(callback) {
    FB.auth.onAuthStateChanged(user => {
      currentUser = user;
      callback(user);
    });
  }

  async function signUp(name, email, password) {
    const cred = await FB.auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    // Seed the user's profile + default settings doc.
    await FB.userDoc(cred.user.uid).set({
      displayName: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      onboardingComplete: false
    }, { merge: true });
    return cred.user;
  }

  function signIn(email, password) {
    return FB.auth.signInWithEmailAndPassword(email, password);
  }

  function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    return FB.auth.signInWithPopup(provider);
  }

  function signOutUser() {
    return FB.auth.signOut();
  }

  function friendlyError(err) {
    const map = {
      "auth/email-already-in-use": "That email already has an account — try signing in instead.",
      "auth/invalid-email": "That email doesn't look right.",
      "auth/weak-password": "Use at least 6 characters for your password.",
      "auth/wrong-password": "That password doesn't match.",
      "auth/user-not-found": "We couldn't find an account with that email.",
      "auth/popup-closed-by-user": "Sign-in was closed before finishing."
    };
    return map[err.code] || "Something went wrong. Please try again.";
  }

  function renderAuthScreen() {
    const el = document.getElementById("screen-auth");
    el.innerHTML = `
      <div class="auth-wrap">
        <span class="auth-flame">${Icons.flame()}</span>
        <h1 class="auth-title">Let's Plan Today</h1>
        <p class="auth-subtitle">A quiet place to plan, journal, and focus — one day at a time.</p>

        <div class="journal-tabs auth-tabs">
          <button type="button" class="journal-tab" data-mode="signin" aria-selected="${mode === "signin"}">Sign in</button>
          <button type="button" class="journal-tab" data-mode="signup" aria-selected="${mode === "signup"}">Create account</button>
        </div>

        <form id="auth-form" class="auth-form">
          ${mode === "signup" ? `
            <div class="field">
              <label for="auth-name">Name</label>
              <input class="add-input" id="auth-name" type="text" required placeholder="What should we call you?" autocomplete="name">
            </div>` : ""}
          <div class="field">
            <label for="auth-email">Email</label>
            <input class="add-input" id="auth-email" type="email" required autocomplete="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="you@example.com">
          </div>
          <div class="field">
            <label for="auth-password">Password</label>
            <div class="auth-password-wrap">
              <input class="add-input" id="auth-password" type="password" required minlength="6" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" placeholder="At least 6 characters">
              <button type="button" class="auth-password-toggle" id="auth-password-toggle" aria-label="Show password">Show</button>
            </div>
          </div>
          <div id="auth-error" class="auth-error" role="alert"></div>
          <button class="btn btn-primary btn-block" type="submit" id="auth-submit">${mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>

        <div class="auth-divider"><span>or</span></div>

        <button class="btn btn-ghost btn-block auth-google-btn" id="auth-google"><span class="auth-google-icon">${Icons.googleG}</span>Continue with Google</button>
      </div>
    `;

    el.querySelectorAll("[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => { mode = btn.dataset.mode; renderAuthScreen(); });
    });

    el.querySelector("#auth-password-toggle").addEventListener("click", () => {
      const input = el.querySelector("#auth-password");
      const btn = el.querySelector("#auth-password-toggle");
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "Show" : "Hide";
    });

    el.querySelector("#auth-form").addEventListener("submit", async e => {
      e.preventDefault();
      const errorEl = el.querySelector("#auth-error");
      const submitBtn = el.querySelector("#auth-submit");
      errorEl.textContent = "";
      const email = el.querySelector("#auth-email").value.trim();
      const password = el.querySelector("#auth-password").value;
      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = mode === "signup" ? "Creating account…" : "Signing in…";
      try {
        if (mode === "signup") {
          const name = el.querySelector("#auth-name").value.trim();
          await signUp(name, email, password);
        } else {
          await signIn(email, password);
        }
        PWA.notePostAuthMoment();
      } catch (err) {
        errorEl.textContent = friendlyError(err);
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });

    el.querySelector("#auth-google").addEventListener("click", async () => {
      const googleBtn = el.querySelector("#auth-google");
      googleBtn.disabled = true;
      try {
        await signInWithGoogle();
        PWA.notePostAuthMoment();
      } catch (err) {
        el.querySelector("#auth-error").textContent = friendlyError(err);
        googleBtn.disabled = false;
      }
    });
  }

  return { onAuthChange, signOutUser, renderAuthScreen, getCurrentUser: () => currentUser };
})();
