// calendar.js — a real month-grid calendar (like a phone calendar app),
// plus the streak calculation that powers the retention badge on Today
// and Progress. Pure render/compute helpers; app.js owns the state
// (which month is showing, which date is selected) and re-renders on nav.

const CalendarUI = (() => {
  const DOW = ["S", "M", "T", "W", "T", "F", "S"];

  function monthCells(year, month) {
    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  // markedDates: Set<string YYYY-MM-DD> of days to show a dot on
  function renderMonth({ year, month, markedDates, selectedDate, todayKey, compact = false }) {
    const cells = monthCells(year, month);
    const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return `
      <div class="cal-widget ${compact ? "cal-compact" : ""}" data-cal-year="${year}" data-cal-month="${month}">
        <div class="cal-header">
          <button type="button" class="cal-nav" data-cal="prev" aria-label="Previous month">‹</button>
          <span class="cal-month">${monthLabel}</span>
          <button type="button" class="cal-nav" data-cal="next" aria-label="Next month">›</button>
        </div>
        <div class="cal-dow">${DOW.map(d => `<span>${d}</span>`).join("")}</div>
        <div class="cal-grid">
          ${cells.map(d => {
            if (d === null) return `<span class="cal-cell cal-empty"></span>`;
            const key = Utils.dateKeyFromParts(year, month, d);
            const cls = [
              key === todayKey ? "cal-today" : "",
              key === selectedDate ? "cal-selected" : ""
            ].filter(Boolean).join(" ");
            return `<button type="button" class="cal-cell ${cls}" data-date="${key}" aria-label="${key}">${d}${markedDates.has(key) ? `<span class="cal-dot"></span>` : ""}</button>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  // Binds prev/next + day-click handlers on a rendered calendar. Returns
  // nothing; callbacks own re-rendering.
  function bind(container, { onNav, onSelectDate }) {
    const prev = container.querySelector('[data-cal="prev"]');
    const next = container.querySelector('[data-cal="next"]');
    if (prev) prev.addEventListener("click", () => onNav(-1));
    if (next) next.addEventListener("click", () => onNav(1));
    container.querySelectorAll(".cal-cell[data-date]").forEach(cell => {
      cell.addEventListener("click", () => onSelectDate(cell.dataset.date));
    });
  }

  // Consecutive-day streak ending today (or still "alive" if only
  // yesterday was active — gives people the rest of today to keep it).
  function computeStreak(activeDates, todayKey) {
    const set = new Set(activeDates);
    const cursor = new Date(todayKey + "T00:00:00");
    if (!set.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1);
      if (!set.has(Utils.todayKey(cursor))) return 0;
    }
    let streak = 0;
    while (set.has(Utils.todayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // Last 7 days (oldest→newest) as {key, dow, active} for the heatmap row.
  function lastSevenDays(activeDates, todayKey) {
    const set = new Set(activeDates);
    const dowLabels = ["S", "M", "T", "W", "T", "F", "S"];
    const out = [];
    const base = new Date(todayKey + "T00:00:00");
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const key = Utils.todayKey(d);
      out.push({ key, dow: dowLabels[d.getDay()], active: set.has(key), isToday: key === todayKey });
    }
    return out;
  }

  return { monthCells, renderMonth, bind, computeStreak, lastSevenDays };
})();
