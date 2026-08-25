// app.js — navigation + screen rendering + auth gate.
// Data modules (Tasks/Journal/Focus/Reflection) now read from Firestore-backed
// caches kept live via onSnapshot; this file just re-renders when they change.

(() => {
  const todayKey = Utils.todayKey();
  let currentScreen = "today";
  let journalViewDate = todayKey;
  let focusSelectedTaskId = null;
  let settingsCache = { name: "", theme: "default", focusDuration: 25 };
  let settingsUnsub = null;
  let sidebarCalState = { year: new Date().getFullYear(), month: new Date().getMonth() };
  let journalCalState = null;

  // ---------- static icon injection (nav bars use fixed markup) ----------
  function injectStaticIcons() {
    document.querySelectorAll("[data-icon]").forEach(el => {
      if (Icons[el.dataset.icon]) el.innerHTML = Icons[el.dataset.icon];
    });
  }

  // ---------- activity / streak (drives the streak badge + heatmap) ----------
  function getActivityDates() {
    return [
      ...Journal.activeDates(),
      ...Tasks.activeDates(),
      ...Focus.activeDates(),
      ...Reflection.activeDates()
    ];
  }

  function renderStreakBadge() {
    const streak = CalendarUI.computeStreak(getActivityDates(), todayKey);
    return `
      <div class="streak-badge ${streak === 0 ? "streak-zero" : ""}" title="${streak} day streak">
        <span class="streak-flame">${Icons.flame}</span>
        <span>
          <div class="streak-num">${streak}</div>
          <div class="streak-label">day streak</div>
        </span>
      </div>`;
  }

  // ---------- persistent sidebar mini calendar ----------
  function renderSidebarCalendar() {
    const container = document.getElementById("sidebar-calendar");
    if (!container) return;
    const marked = new Set(getActivityDates());
    container.innerHTML = CalendarUI.renderMonth({
      year: sidebarCalState.year, month: sidebarCalState.month,
      markedDates: marked, selectedDate: journalViewDate, todayKey, compact: true
    });
    CalendarUI.bind(container, {
      onNav: delta => {
        sidebarCalState.month += delta;
        if (sidebarCalState.month < 0) { sidebarCalState.month = 11; sidebarCalState.year--; }
        else if (sidebarCalState.month > 11) { sidebarCalState.month = 0; sidebarCalState.year++; }
        renderSidebarCalendar();
      },
      onSelectDate: date => { journalViewDate = date; goTo("journal"); }
    });
  }

  // ---------- settings (Firestore: users/{uid}/settings/preferences) ----------
  function getSettings() { return settingsCache; }

  async function setSettings(patch) {
    const uid = Auth.getCurrentUser()?.uid;
    if (!uid) return;
    await FB.col(uid, "settings").doc("preferences").set(patch, { merge: true })
      .catch(() => Utils.showToast("We couldn't save that right now. Check your connection and try again."));
  }

  function initSettingsListener(uid) {
    if (settingsUnsub) settingsUnsub();
    settingsUnsub = FB.col(uid, "settings").doc("preferences").onSnapshot(doc => {
      settingsCache = { name: "", theme: "default", focusDuration: 25, ...(doc.data() || {}) };
      applyTheme();
      render();
    });
  }

  // ---------- navigation ----------
  function goTo(screen) {
    currentScreen = screen;
    document.querySelectorAll("[data-screen]").forEach(el => { el.hidden = el.dataset.screen !== screen; });
    document.querySelectorAll("[data-nav]").forEach(btn => {
      btn.setAttribute("aria-current", btn.dataset.nav === screen ? "page" : "false");
    });
    render();
  }

  document.querySelectorAll("[data-nav]").forEach(btn => btn.addEventListener("click", () => goTo(btn.dataset.nav)));

  function render() {
    if (currentScreen === "today") renderToday();
    if (currentScreen === "journal") renderJournal();
    if (currentScreen === "tasks") renderTasks();
    if (currentScreen === "focus") renderFocus();
    if (currentScreen === "reflection") renderReflection();
    if (currentScreen === "progress") renderProgress();
    if (currentScreen === "settings") renderSettings();
    renderSidebarCalendar();
  }

  function applyDayArc() {
    document.documentElement.style.setProperty("--day-arc", Utils.dayArcGradient());
  }

  // ---------- TODAY ----------
  function renderToday() {
    const el = document.getElementById("screen-today");
    const today3 = Tasks.forDate(todayKey).filter(t => t.isToday3);
    const mood = (Journal.get(todayKey) || {}).mood;
    const name = getSettings().name;

    el.innerHTML = `
      <div class="today-grid">
        <div>
          <div class="day-arc-bar"></div>
          <div class="today-header">
            <div>
              <h1 class="greeting">${Utils.greeting()}${name ? ", " + Utils.escapeHtml(name) : ""}</h1>
              <div class="date">${Utils.formatDisplayDate(todayKey)}</div>
            </div>
            ${renderStreakBadge()}
          </div>

          <div class="mood-row" role="group" aria-label="How are you feeling?">
            ${["😔","😐","🙂","😄"].map(m => `<button class="mood-btn" data-mood="${m}" aria-pressed="${mood === m}" aria-label="Feeling ${m}">${m}</button>`).join("")}
          </div>

          <h2>Today's 3</h2>
          ${today3.length ? `<ul class="today3-list">${today3.map(t => Tasks.renderTaskRow(t)).join("")}</ul>`
            : `<div class="empty-state" style="padding:var(--space-4) 0;text-align:left;"><p>Nothing chosen yet — pick up to three things that matter today.</p></div>`}
          <div class="add-row" style="margin-bottom:var(--space-6);">
            <input class="add-input" id="today-add" placeholder="Add something you want to do" aria-label="Add a task">
            <button class="btn btn-primary" id="today-add-btn">Add</button>
          </div>
        </div>

        <div>
          <button class="card card--link" id="today-journal-link">
            <span class="icon-row"><span class="link-icon">${Icons.journal}</span><span>Write today's page</span></span>
            <span class="arrow">→</span>
          </button>
          <button class="card card--link" id="today-focus-link">
            <span class="icon-row"><span class="link-icon">${Icons.timer}</span><span>Start a focus session</span></span>
            <span class="arrow">→</span>
          </button>
          <button class="card card--link" id="today-reflect-link">
            <span class="icon-row"><span class="link-icon">${Icons.moon}</span><span>Evening reflection</span></span>
            <span class="arrow">→</span>
          </button>
        </div>
      </div>
    `;

    applyDayArc();
    el.querySelectorAll(".mood-btn").forEach(btn => btn.addEventListener("click", () => Journal.setMood(todayKey, btn.dataset.mood)));
    Tasks.bindRowEvents(el);
    el.querySelector("#today-add-btn").addEventListener("click", addFromToday);
    el.querySelector("#today-add").addEventListener("keydown", e => { if (e.key === "Enter") addFromToday(); });
    el.querySelector("#today-journal-link").addEventListener("click", () => { journalViewDate = todayKey; goTo("journal"); });
    el.querySelector("#today-focus-link").addEventListener("click", () => goTo("focus"));
    el.querySelector("#today-reflect-link").addEventListener("click", () => goTo("reflection"));

    function addFromToday() {
      const input = el.querySelector("#today-add");
      Tasks.add(input.value, todayKey, { isToday3: true });
      input.value = "";
    }
  }

  // ---------- JOURNAL ----------
  function renderJournal() {
    journalCalState = null; // re-center the month grid on whatever date we land on next
    const el = document.getElementById("screen-journal");
    const entry = Journal.get(journalViewDate);
    const isToday = journalViewDate === todayKey;
    const prompt = entry?.promptUsed || Journal.randomPrompt();

    el.innerHTML = `
      <h1>Journal</h1>
      <div class="journal-tabs" role="tablist">
        <button class="journal-tab" data-tab="today" aria-selected="${journalViewDate === todayKey}">Today</button>
        <button class="journal-tab" data-tab="yesterday" aria-selected="${journalViewDate === Utils.offsetDateKey(-1)}">Yesterday</button>
        <button class="journal-tab" data-tab="calendar" aria-selected="false">Calendar</button>
        <button class="journal-tab" data-tab="search" aria-selected="false">Search</button>
      </div>
      <div id="journal-body">
        <div class="journal-prompt">${Utils.escapeHtml(prompt)}</div>
        <textarea class="journal-textarea" id="journal-text" placeholder="You don't have to write a whole essay.">${entry?.text ? Utils.escapeHtml(entry.text) : ""}</textarea>
        <div style="display:flex;align-items:center;color:var(--text-secondary);font-size:var(--text-body-sm);margin-top:var(--space-2);">
          ${isToday ? "Saved automatically" : Utils.formatDisplayDate(journalViewDate)}
          <span class="journal-save-dot" id="save-dot"></span>
        </div>
      </div>
    `;

    const textarea = el.querySelector("#journal-text");
    const dot = el.querySelector("#save-dot");
    const debouncedSave = Utils.debounce(val => {
      Journal.setText(journalViewDate, val);
      dot.classList.add("show");
      setTimeout(() => dot.classList.remove("show"), 900);
    }, 500);
    textarea.addEventListener("input", () => debouncedSave(textarea.value));

    el.querySelectorAll(".journal-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const kind = tab.dataset.tab;
        if (kind === "today") { journalViewDate = todayKey; renderJournal(); }
        else if (kind === "yesterday") { journalViewDate = Utils.offsetDateKey(-1); renderJournal(); }
        else if (kind === "calendar") renderJournalCalendar();
        else if (kind === "search") renderJournalSearch();
      });
    });
  }

  function renderJournalCalendar() {
    const el = document.getElementById("screen-journal");
    const body = el.querySelector("#journal-body");
    const entries = Journal.entriesSorted();
    const marked = new Set(Journal.activeDates());

    if (!journalCalState) {
      const base = new Date(journalViewDate + "T00:00:00");
      journalCalState = { year: base.getFullYear(), month: base.getMonth() };
    }

    body.innerHTML = `
      <div id="journal-cal-wrap"></div>
      ${entries.length
        ? `<h2 style="margin-top:var(--space-6);">All entries</h2><ul class="journal-entry-list">${entries.map(e => `
            <li data-date="${e.date}">
              <div class="entry-date">${Utils.formatDisplayDate(e.date)}</div>
              <div class="entry-snippet">${Utils.escapeHtml(e.text.slice(0, 90))}${e.text.length > 90 ? "…" : ""}</div>
            </li>`).join("")}</ul>`
        : `<div class="empty-state" style="margin-top:var(--space-5);"><h3>Your first page is waiting.</h3><p>Entries you write will show up here.</p></div>`}
    `;

    const calWrap = body.querySelector("#journal-cal-wrap");
    drawJournalCal();

    function drawJournalCal() {
      calWrap.innerHTML = CalendarUI.renderMonth({
        year: journalCalState.year, month: journalCalState.month,
        markedDates: marked, selectedDate: journalViewDate, todayKey
      });
      CalendarUI.bind(calWrap, {
        onNav: delta => {
          journalCalState.month += delta;
          if (journalCalState.month < 0) { journalCalState.month = 11; journalCalState.year--; }
          else if (journalCalState.month > 11) { journalCalState.month = 0; journalCalState.year++; }
          drawJournalCal();
        },
        onSelectDate: date => { journalViewDate = date; renderJournal(); }
      });
    }

    body.querySelectorAll("li[data-date]").forEach(li => li.addEventListener("click", () => { journalViewDate = li.dataset.date; renderJournal(); }));
  }

  function renderJournalSearch() {
    const el = document.getElementById("screen-journal");
    const body = el.querySelector("#journal-body");
    body.innerHTML = `
      <input class="search-input" id="journal-search-input" placeholder="Search your journal" aria-label="Search journal entries">
      <ul class="journal-entry-list" id="journal-search-results"></ul>
    `;
    const input = body.querySelector("#journal-search-input");
    const results = body.querySelector("#journal-search-results");
    function run() {
      const entries = Journal.search(input.value);
      results.innerHTML = entries.length
        ? entries.map(e => `<li data-date="${e.date}"><div class="entry-date">${Utils.formatDisplayDate(e.date)}</div><div class="entry-snippet">${Utils.escapeHtml(e.text.slice(0, 90))}</div></li>`).join("")
        : `<div class="empty-state"><p>No entries match yet.</p></div>`;
      results.querySelectorAll("li[data-date]").forEach(li => li.addEventListener("click", () => { journalViewDate = li.dataset.date; renderJournal(); }));
    }
    input.addEventListener("input", Utils.debounce(run, 200));
    run();
  }

  // ---------- TASKS ----------
  function renderTasks() {
    const el = document.getElementById("screen-tasks");
    const list = Tasks.forDate(todayKey);
    el.innerHTML = `
      <h1>Tasks</h1>
      <div class="add-row" style="margin-bottom:var(--space-5);">
        <input class="add-input" id="tasks-add" placeholder="Add something you want to do" aria-label="Add a task">
        <button class="btn btn-primary" id="tasks-add-btn">Add</button>
      </div>
      ${list.length
        ? `<ul class="task-list">${list.map(t => Tasks.renderTaskRow(t, { showToday3Toggle: true })).join("")}</ul>`
        : `<div class="empty-state"><h3>Nothing planned yet.</h3><p>Add something above — one line is enough.</p></div>`}
    `;
    Tasks.bindRowEvents(el);
    el.querySelector("#tasks-add-btn").addEventListener("click", addFromTasks);
    el.querySelector("#tasks-add").addEventListener("keydown", e => { if (e.key === "Enter") addFromTasks(); });
    function addFromTasks() {
      const input = el.querySelector("#tasks-add");
      Tasks.add(input.value, todayKey);
      input.value = "";
    }
  }

  // ---------- FOCUS ----------
  function renderFocus() {
    const el = document.getElementById("screen-focus");
    if (Focus.getState()) { renderFocusSession(); return; }

    const todaysTasks = Tasks.forDate(todayKey).filter(t => !t.completed);
    el.innerHTML = `
      <h1>Focus</h1>
      <p>Pick one thing. Everything else can wait.</p>
      <div class="focus-setup card">
        <div class="field">
          <label for="focus-task">Task</label>
          <select id="focus-task">
            <option value="">Just focus, no task selected</option>
            ${todaysTasks.map(t => `<option value="${t.id}" ${t.id === focusSelectedTaskId ? "selected" : ""}>${Utils.escapeHtml(t.title)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="focus-duration">Duration (minutes)</label>
          <select id="focus-duration">
            ${[15, 25, 45, 60].map(m => `<option value="${m}" ${m === getSettings().focusDuration ? "selected" : ""}>${m} minutes</option>`).join("")}
          </select>
        </div>
        <button class="btn btn-primary btn-block" id="focus-start">Start focus</button>
      </div>
    `;
    el.querySelector("#focus-start").addEventListener("click", () => {
      const taskId = el.querySelector("#focus-task").value;
      const minutes = parseInt(el.querySelector("#focus-duration").value, 10);
      const task = todaysTasks.find(t => t.id === taskId);
      focusSelectedTaskId = taskId || null;
      Focus.start(task ? task.title : "Focus session", minutes, updateRing, complete);
      PWA.acquireWakeLock();
      renderFocusSession();
    });
  }

  function renderFocusSession() {
    const el = document.getElementById("screen-focus");
    const state = Focus.getState();
    if (!state) { renderFocus(); return; }
    const r = Focus.radius(), c = Focus.circumference();
    const canDeepFocus = !!(document.documentElement.requestFullscreen);
    el.innerHTML = `
      <div class="focus-session">
        <div class="focus-task-name">${Utils.escapeHtml(state.taskTitle)}</div>
        <div class="focus-ring-wrap">
          <svg viewBox="0 0 240 240">
            <circle class="focus-ring-bg" cx="120" cy="120" r="${r}"></circle>
            <circle class="focus-ring-fg" id="focus-ring-fg" cx="120" cy="120" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="0"></circle>
          </svg>
          <div class="focus-time" id="focus-time">${Focus.formatTime(state.remaining)}</div>
        </div>
        <div class="focus-actions">
          <button class="btn btn-ghost" id="focus-pause">${state.intervalId ? "Pause" : "Resume"}</button>
          <button class="btn btn-ghost" id="focus-finish">Finish early</button>
        </div>
        ${canDeepFocus ? `<button class="btn-text" id="focus-deep">Enter Deep Focus (fullscreen)</button>` : ""}
      </div>
    `;
    updateRing();
    el.querySelector("#focus-pause").addEventListener("click", () => {
      const s = Focus.getState();
      if (s.intervalId) { Focus.pause(); PWA.releaseWakeLock(); }
      else { Focus.resume(updateRing, complete); PWA.acquireWakeLock(); }
      renderFocusSession();
    });
    el.querySelector("#focus-finish").addEventListener("click", () => {
      Focus.stop();
      PWA.releaseWakeLock();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      goTo("today");
    });
    const deepBtn = el.querySelector("#focus-deep");
    if (deepBtn) deepBtn.addEventListener("click", () => {
      document.documentElement.requestFullscreen().catch(() => {
        Utils.showToast("Fullscreen isn't available here — the timer still runs.");
      });
    });
  }

  function updateRing() {
    const state = Focus.getState();
    if (!state) return;
    const c = Focus.circumference();
    const pct = state.remaining / state.totalSeconds;
    const ring = document.getElementById("focus-ring-fg");
    const time = document.getElementById("focus-time");
    if (ring) ring.setAttribute("stroke-dashoffset", String(c * (1 - pct)));
    if (time) time.textContent = Focus.formatTime(state.remaining);
  }

  function complete(state) {
    PWA.releaseWakeLock();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    Utils.showToast(`Nice work. You focused for ${Math.round(state.totalSeconds / 60)} minutes.`);
    goTo("today");
  }

  // ---------- REFLECTION ----------
  function renderReflection() {
    const el = document.getElementById("screen-reflection");
    const data = Reflection.get(todayKey);
    el.innerHTML = `
      <h1>How did today go?</h1>
      <p>Optional — answer what feels useful.</p>
      ${Reflection.FIELDS.map(f => `
        <div class="reflection-field">
          <label for="r-${f.id}">${f.label}</label>
          <textarea id="r-${f.id}" data-field="${f.id}">${data[f.id] ? Utils.escapeHtml(data[f.id]) : ""}</textarea>
        </div>
      `).join("")}
      <button class="btn btn-primary" id="reflection-save">Save reflection</button>
    `;
    el.querySelector("#reflection-save").addEventListener("click", () => {
      Reflection.FIELDS.forEach(f => Reflection.setField(todayKey, f.id, el.querySelector(`#r-${f.id}`).value));
      Utils.showToast("Saved. Tomorrow is another day.");
      goTo("today");
    });
  }

  // ---------- PROGRESS ----------
  function statRing(value, max, size = 56) {
    const r = (size - 4) / 2;
    const c = 2 * Math.PI * r;
    const pct = max ? Math.min(1, value / max) : 0;
    return `
      <div class="ring-wrap">
        <svg viewBox="0 0 ${size} ${size}">
          <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}"></circle>
          <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"></circle>
        </svg>
        <span class="num">${value}</span>
      </div>`;
  }

  function renderProgress() {
    const el = document.getElementById("screen-progress");
    const journalDays = Journal.entriesSorted().length;
    const focusSessions = Focus.sessionCount();
    const reflections = Reflection.completedCount();
    const activity = getActivityDates();
    const streak = CalendarUI.computeStreak(activity, todayKey);
    const week = CalendarUI.lastSevenDays(activity, todayKey);

    const milestones = [
      { label: "First journal entry", done: journalDays >= 1, icon: Icons.journal },
      { label: "First focus session", done: focusSessions >= 1, icon: Icons.timer },
      { label: "3 day streak", done: streak >= 3, icon: Icons.badgeSprout },
      { label: "7 day streak", done: streak >= 7, icon: Icons.flame },
      { label: "10 focus sessions", done: focusSessions >= 10, icon: Icons.badgeStar }
    ];

    el.innerHTML = `
      <h1>Your progress</h1>
      <p>Not a report card — just a record that you showed up.</p>

      <div class="progress-hero">
        <span class="flame-big ${streak === 0 ? "streak-zero" : ""}">${Icons.flame}</span>
        <div>
          <div class="streak-count">${streak} day${streak === 1 ? "" : "s"}</div>
          <div class="streak-copy">${streak > 0
            ? `You've shown up ${streak} day${streak === 1 ? "" : "s"} in a row. Any one of these keeps it alive: write in your journal, add or complete a task, finish a focus session, or do your evening reflection.`
            : "Do one of these today to start a streak: write in your journal, add or complete a task, finish a focus session, or do your evening reflection."}</div>
        </div>
      </div>

      <p style="color:var(--text-secondary);font-size:var(--text-body-sm);margin-top:calc(-1 * var(--space-4));margin-bottom:var(--space-5);">Streaks count consecutive calendar days with at least one of those — miss a full day and it resets to 0.</p>

      <div class="heatmap-row">
        ${week.map(d => `
          <div class="heatmap-day">
            <span class="heatmap-dow">${d.dow}</span>
            <span class="heatmap-cell ${d.active ? "active" : ""} ${d.isToday ? "today" : ""}" title="${d.key}"></span>
          </div>`).join("")}
      </div>

      <div class="stat-row">
        <div class="stat-card ${streak === 0 ? "streak-zero" : ""}">
          <span class="stat-flame">${Icons.flame}</span>
          <div class="stat-num-plain">${streak}</div>
          <div class="label">Day streak</div>
        </div>
        <div class="stat-card">${statRing(journalDays, Math.max(journalDays, 7))}<div class="label">Journal entries</div></div>
        <div class="stat-card">${statRing(focusSessions, Math.max(focusSessions, 10))}<div class="label">Focus sessions</div></div>
        <div class="stat-card">${statRing(reflections, Math.max(reflections, 7))}<div class="label">Reflections</div></div>
      </div>

      <h2>Milestones</h2>
      <div class="badge-grid">
        ${milestones.map(m => `
          <div class="badge-card ${m.done ? "done" : ""}">
            <div class="badge-icon">${m.icon}</div>
            <div class="badge-label">${m.label}</div>
          </div>`).join("")}
      </div>
    `;
  }

  // ---------- SETTINGS ----------
  function renderSettings() {
    const el = document.getElementById("screen-settings");
    const s = getSettings();
    const themes = [
      { id: "default", color: "#E2A33D" }, { id: "lavender", color: "#9C87C9" },
      { id: "sage", color: "#7FA37A" }, { id: "peach", color: "#E5926B" }, { id: "dark", color: "#16302B" }
    ];
    el.innerHTML = `
      <h1>Settings</h1>
      <div class="settings-group">
        <h3>Your name</h3>
        <input type="text" id="set-name" value="${Utils.escapeHtml(s.name || "")}" placeholder="What should we call you?">
      </div>
      <div class="settings-group">
        <h3>Theme</h3>
        <div class="theme-swatches">
          ${themes.map(t => `<button class="theme-swatch" data-theme="${t.id}" style="background:${t.color}" aria-pressed="${s.theme === t.id}" aria-label="${t.id} theme"></button>`).join("")}
        </div>
      </div>
      <div class="settings-group">
        <h3>Default focus duration</h3>
        <select id="set-focus-duration">${[15, 25, 45, 60].map(m => `<option value="${m}" ${m === s.focusDuration ? "selected" : ""}>${m} minutes</option>`).join("")}</select>
      </div>
      <div class="settings-group">
        <h3>Daily reminder</h3>
        <input type="time" id="set-reminder" value="${s.reminderTime || ""}">
        ${renderReminderNote()}
      </div>
      <div class="settings-group">
        <h3>App</h3>
        ${renderInstallRow()}
      </div>
      <div class="settings-group">
        <h3>Account</h3>
        <p>Signed in as ${Utils.escapeHtml(Auth.getCurrentUser()?.email || "")}</p>
        <button class="btn btn-ghost" id="set-signout">Sign out</button>
      </div>
    `;
    el.querySelector("#set-name").addEventListener("change", e => setSettings({ name: e.target.value }));
    el.querySelector("#set-focus-duration").addEventListener("change", e => setSettings({ focusDuration: parseInt(e.target.value, 10) }));
    el.querySelector("#set-reminder").addEventListener("change", e => setSettings({ reminderTime: e.target.value }));
    el.querySelectorAll(".theme-swatch").forEach(btn => btn.addEventListener("click", () => setSettings({ theme: btn.dataset.theme })));
    el.querySelector("#set-signout").addEventListener("click", () => Auth.signOutUser());

    const notifBtn = el.querySelector("#set-notif-enable");
    if (notifBtn) notifBtn.addEventListener("click", async () => {
      const result = await PWA.requestNotificationPermission();
      if (result === "granted") { PWA.startReminderWatcher(getSettings); Utils.showToast("Reminders are on."); }
      else if (result === "denied") Utils.showToast("Notifications are blocked in your browser settings.");
      renderSettings();
    });

    const installBtn = el.querySelector("#set-install");
    if (installBtn) installBtn.addEventListener("click", async () => {
      const outcome = await PWA.promptInstall();
      if (outcome === "accepted") renderSettings();
    });
  }

  function renderReminderNote() {
    const support = PWA.notificationsSupported();
    const perm = PWA.notificationPermission();
    if (!support) return `<p style="margin-top:var(--space-2);">Reminders aren't supported in this browser yet — your time is still saved.</p>`;
    if (perm === "granted") return `<p style="margin-top:var(--space-2);">Reminders are on while the app is open in a tab or window — a closed browser can't notify you (no server push yet).</p>`;
    if (perm === "denied") return `<p style="margin-top:var(--space-2);">Notifications are blocked for this site in your browser settings.</p>`;
    return `<button class="btn btn-ghost" id="set-notif-enable" style="margin-top:var(--space-2);">Turn on reminders</button>`;
  }

  function renderInstallRow() {
    if (PWA.isStandalone()) return `<p>Installed — you're all set.</p>`;
    if (PWA.canPromptInstall()) return `<button class="btn btn-primary" id="set-install">Install app</button><p style="margin-top:var(--space-2);">Faster access, works more like an app, offline support.</p>`;
    return `<p>Your browser will offer an install option once it decides the app qualifies — usually after a couple of visits.</p>`;
  }

  function applyTheme() {
    document.body.dataset.theme = getSettings().theme;
  }

  // ---------- auth gate ----------
  function showApp() {
    document.getElementById("screen-auth").hidden = true;
    document.querySelector(".sidebar-nav").hidden = false;
    document.querySelector(".bottom-nav").hidden = false;
    document.querySelectorAll(".main-content [data-screen]").forEach(el => {
      if (el.id !== "screen-auth") el.hidden = el.dataset.screen !== currentScreen;
    });
  }

  function showAuth() {
    document.getElementById("screen-auth").hidden = false;
    document.querySelector(".sidebar-nav").hidden = true;
    document.querySelector(".bottom-nav").hidden = true;
    document.querySelectorAll(".main-content [data-screen]").forEach(el => { if (el.id !== "screen-auth") el.hidden = true; });
    Auth.renderAuthScreen();
  }

  Tasks.onChange = render;
  Journal.onChange = render;
  Reflection.onChange = render;
  Focus.onChange = render;

  // ---------- install banner ("Want your planner one tap away?") ----------
  function showInstallBanner() {
    const banner = document.getElementById("install-banner");
    if (!banner) return;
    banner.hidden = false;
  }
  function hideInstallBanner() {
    const banner = document.getElementById("install-banner");
    if (banner) banner.hidden = true;
  }
  const installBanner = document.getElementById("install-banner");
  if (installBanner) {
    installBanner.querySelector("#install-banner-yes").addEventListener("click", async () => {
      await PWA.promptInstall();
      hideInstallBanner();
    });
    installBanner.querySelector("#install-banner-dismiss").addEventListener("click", () => {
      PWA.dismissInstallBanner();
      hideInstallBanner();
    });
  }

  let pendingShortcutScreen = null;
  (function readShortcutParam() {
    const params = new URLSearchParams(window.location.search);
    const screen = params.get("screen");
    if (["journal", "tasks", "focus", "progress", "settings"].includes(screen)) pendingShortcutScreen = screen;
  })();

  Auth.onAuthChange(user => {
    if (user) {
      Tasks.init(user.uid);
      Journal.init(user.uid);
      Focus.init(user.uid);
      Reflection.init(user.uid);
      initSettingsListener(user.uid);
      showApp();
      goTo(pendingShortcutScreen || "today");
      pendingShortcutScreen = null;
      PWA.startReminderWatcher(getSettings);
    } else {
      Tasks.teardown(); Journal.teardown(); Focus.teardown(); Reflection.teardown();
      showAuth();
    }
  });

  injectStaticIcons();
  applyDayArc();
  setInterval(applyDayArc, 5 * 60 * 1000);

  // ---------- Phase 5: PWA wiring ----------
  PWA.registerServiceWorker();
  PWA.initConnectivityToast();
  PWA.recordVisit();
  PWA.initInstallPrompt({ onEligible: showInstallBanner });
})();
