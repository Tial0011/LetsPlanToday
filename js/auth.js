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
      <div style="max-width:360px;margin:10vh auto 0;">
        <h1 style="margin-bottom:var(--space-2);">Let's Plan Today</h1>
        <p>A quiet place to plan, journal, and focus — one day at a time.</p>

        <div class="journal-tabs" style="margin-bottom:var(--space-5);">
          <button class="journal-tab" data-mode="signin" aria-selected="${mode === "signin"}">Sign in</button>
          <button class="journal-tab" data-mode="signup" aria-selected="${mode === "signup"}">Create account</button>
        </div>

        <form id="auth-form" class="card">
          ${mode === "signup" ? `
            <div class="field" style="margin-bottom:var(--space-3);">
              <label for="auth-name" style="display:block;font-size:var(--text-body-sm);color:var(--text-secondary);margin-bottom:var(--space-2);">Name</label>
              <input class="add-input" id="auth-name" type="text" required placeholder="What should we call you?">
            </div>` : ""}
          <div class="field" style="margin-bottom:var(--space-3);">
            <label for="auth-email" style="display:block;font-size:var(--text-body-sm);color:var(--text-secondary);margin-bottom:var(--space-2);">Email</label>
            <input class="add-input" id="auth-email" type="email" required autocomplete="email">
          </div>
          <div class="field" style="margin-bottom:var(--space-4);">
            <label for="auth-password" style="display:block;font-size:var(--text-body-sm);color:var(--text-secondary);margin-bottom:var(--space-2);">Password</label>
            <input class="add-input" id="auth-password" type="password" required minlength="6" autocomplete="${mode === "signup" ? "new-password" : "current-password"}">
          </div>
          <div id="auth-error" role="alert" style="color:var(--danger);font-size:var(--text-body-sm);margin-bottom:var(--space-3);"></div>
          <button class="btn btn-primary btn-block" type="submit">${mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>

        <button class="btn btn-ghost btn-block" id="auth-google" style="margin-top:var(--space-3);">Continue with Google</button>
      </div>
    `;

    el.querySelectorAll("[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => { mode = btn.dataset.mode; renderAuthScreen(); });
    });

    el.querySelector("#auth-form").addEventListener("submit", async e => {
      e.preventDefault();
      const errorEl = el.querySelector("#auth-error");
      errorEl.textContent = "";
      const email = el.querySelector("#auth-email").value.trim();
      const password = el.querySelector("#auth-password").value;
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
      }
    });

    el.querySelector("#auth-google").addEventListener("click", async () => {
      try {
        await signInWithGoogle();
        PWA.notePostAuthMoment();
      } catch (err) { el.querySelector("#auth-error").textContent = friendlyError(err); }
    });
  }

  return { onAuthChange, signOutUser, renderAuthScreen, getCurrentUser: () => currentUser };
})();
