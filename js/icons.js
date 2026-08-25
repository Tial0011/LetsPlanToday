// icons.js — small inline SVG icon set (stroke-based, currentColor) used in
// place of decorative emoji for navigation and card links. Kept separate
// from decorative-but-functional emoji (mood picker) which stay as-is.

const Icons = (() => {
  const sun = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"></circle><path d="M12 2.5v2.5M12 19v2.5M4.4 4.4l1.8 1.8M17.8 17.8l1.8 1.8M2.5 12H5M19 12h2.5M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8"></path></svg>`;
  const journal = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h11a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5v-14A1 1 0 0 1 6 3.5Z"></path><path d="M8.5 8h6M8.5 11.5h6M8.5 15h4"></path></svg>`;
  const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"></path></svg>`;
  const timer = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"></circle><path d="M12 9v4l2.5 1.5M9.5 2.5h5M18.5 5.5l1-1"></path></svg>`;
  const moon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.2A8.2 8.2 0 1 1 10.8 4a6.5 6.5 0 0 0 9.2 9.2Z"></path></svg>`;
  const progress = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 12 12 5"></path></svg>`;
  const settings = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 13.5a1.7 1.7 0 0 0 .35 1.9l.05.05a2 2 0 1 1-2.85 2.85l-.05-.05a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1 1.55V19.6a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.9.35l-.05.05a2 2 0 1 1-2.85-2.85l.05-.05a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.55-1H4.4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.35-1.9l-.05-.05A2 2 0 1 1 8.5 4.15l.05.05a1.7 1.7 0 0 0 1.9.35H10.5a1.7 1.7 0 0 0 1-1.55V2.9a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.35l.05-.05a2 2 0 1 1 2.85 2.85l-.05.05a1.7 1.7 0 0 0-.35 1.9V8.5a1.7 1.7 0 0 0 1.55 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1Z"></path></svg>`;
  let flameGradSeq = 0;
  function flame() {
    const gid = `flameGrad-${++flameGradSeq}`;
    return `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.3c.6 2.2-.4 3.4-1.6 4.7C9 8.4 7.6 9.9 7.6 12.6a4.4 4.4 0 0 0 8.8 0c0-1.4-.5-2.3-1.1-3.2-.2.9-.7 1.5-1.3 1.5-.7 0-1.1-.6-1-1.4.2-1.6 1.2-2.6 1.2-4.6 0-1-.4-1.9-1.2-2.5-.5 1.2-1.2 1.8-1 3-.1-1 0-2 0-3Z" fill="url(#${gid})"></path><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFC65C"></stop><stop offset="55%" stop-color="#E2A33D"></stop><stop offset="100%" stop-color="#C97B84"></stop></linearGradient></defs></svg>`;
  }
  const badgeStar = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z"></path></svg>`;
  const badgeSprout = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V11"></path><path d="M12 11c0-3.5-2.5-6-6.5-6C5.5 9 8.5 11 12 11Z"></path><path d="M12 8c0-3 2-5 5.5-5C17.5 6.5 15.5 8.5 12 8Z"></path></svg>`;

  return { sun, journal, check, timer, moon, progress, settings, flame, badgeStar, badgeSprout };
})();
