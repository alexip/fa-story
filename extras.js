/* ================================================================
   extras.js — Pickleball Hunt, Toss-a-Treat, Dear Fafa, and a small
   Tweaks panel to toggle each feature.

   The original cat.js exposes a few hooks we make use of:
     - the canvas listens for pointermove/down to set its `target`
     - window.__faState() reads {x, y, w, h, ...}
   So we never modify cat.js — we just synthesise pointer events on
   the canvas to lure Fafa toward thrown treats.
   ================================================================ */

(() => {
  // ───────────────────────────── Tweaks (host protocol) ─────────────────────
  const tweaks = Object.assign(
    { showPickleballs: true, showDearFafa: true, showTreats: true },
    window.FA_TWEAKS || {}
  );

  function applyTweaks() {
    document.body.classList.toggle("no-pickleballs", !tweaks.showPickleballs);
    document.body.classList.toggle("no-dear-fafa", !tweaks.showDearFafa);
    document.body.classList.toggle("no-treats", !tweaks.showTreats);
  }
  applyTweaks();

  // Tweaks panel (in-page) — wired to the host edit-mode protocol.
  const panel = document.getElementById("tweaks");
  const panelBody = document.getElementById("tweaks-body");
  const panelX = document.getElementById("tweaks-x");

  const TWEAK_DEFS = [
    { key: "showPickleballs", label: "Pickleball hunt", sub: "5 hidden across the page" },
    { key: "showDearFafa",    label: "Dear Fafa",        sub: "ask the cat anything" },
    { key: "showTreats",      label: "Toss a treat",     sub: "lure her with fish" },
  ];

  function renderPanel() {
    panelBody.innerHTML = "";
    for (const def of TWEAK_DEFS) {
      const row = document.createElement("div");
      row.className = "tweak-row";
      const lbl = document.createElement("div");
      lbl.innerHTML = `<span class="tweak-label">${def.label}</span><span class="tweak-sub">${def.sub}</span>`;
      const btn = document.createElement("button");
      btn.className = "tweak-toggle";
      btn.type = "button";
      btn.setAttribute("aria-pressed", tweaks[def.key] ? "true" : "false");
      btn.addEventListener("click", () => {
        tweaks[def.key] = !tweaks[def.key];
        btn.setAttribute("aria-pressed", tweaks[def.key] ? "true" : "false");
        applyTweaks();
        try {
          window.parent.postMessage(
            { type: "__edit_mode_set_keys", edits: { [def.key]: tweaks[def.key] } },
            "*"
          );
        } catch (_) {}
      });
      row.appendChild(lbl);
      row.appendChild(btn);
      panelBody.appendChild(row);
    }
  }
  renderPanel();

  window.addEventListener("message", (e) => {
    const t = e && e.data && e.data.type;
    if (t === "__activate_edit_mode") {
      panel.hidden = false;
    } else if (t === "__deactivate_edit_mode") {
      panel.hidden = true;
    }
  });
  panelX.addEventListener("click", () => {
    panel.hidden = true;
    try {
      window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
    } catch (_) {}
  });
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch (_) {}

  // ───────────────────────────── Pickleball Hunt ────────────────────────────

  const pballs = Array.from(document.querySelectorAll(".pball"));
  const tally = document.getElementById("pball-tally");
  const countEl = document.getElementById("pball-count");
  const LF_KEY = "fa-pballs-found";
  let found = new Set(JSON.parse(localStorage.getItem(LF_KEY) || "[]"));

  function syncTally() {
    countEl.textContent = String(found.size);
    tally.hidden = found.size === 0;
  }

  function revealPball(el) {
    // Stagger reveal slightly so they fade in after layout settles.
    const delay = 600 + Math.random() * 1200;
    setTimeout(() => el.classList.add("is-revealed"), delay);
  }

  function ping(el, label) {
    const rect = el.getBoundingClientRect();
    const node = document.createElement("div");
    node.className = "pball-ping";
    node.textContent = label;
    node.style.left = rect.left + rect.width / 2 + "px";
    node.style.top  = rect.top + "px";
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1200);
  }

  const PHRASES = [
    "found one",
    "that's hers",
    "rightfully yours",
    "she'd want this back",
    "one of five",
  ];

  pballs.forEach((el) => {
    const id = el.dataset.pball;
    if (found.has(id)) {
      // Already collected on a previous visit — just hide it.
      el.style.display = "none";
      return;
    }
    revealPball(el);
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (el.classList.contains("is-collected")) return;
      el.classList.add("is-collected");
      found.add(id);
      localStorage.setItem(LF_KEY, JSON.stringify([...found]));
      syncTally();
      ping(el, PHRASES[Math.min(found.size - 1, PHRASES.length - 1)]);
      setTimeout(() => { el.style.display = "none"; }, 700);
      if (found.size >= 5) showLostFound();
    });
  });
  syncTally();

  // Lost & Found overlay (all 5 collected)
  const lostFound = document.getElementById("lost-found");
  const lostFoundClose = document.getElementById("lost-found-close");
  function showLostFound() {
    setTimeout(() => { lostFound.hidden = false; }, 700);
  }
  lostFoundClose.addEventListener("click", () => { lostFound.hidden = true; });
  lostFound.addEventListener("click", (e) => {
    if (e.target === lostFound) lostFound.hidden = true;
  });

  // Hidden reset shortcut for dev/preview: window.__faResetHunt()
  window.__faResetHunt = () => {
    localStorage.removeItem(LF_KEY);
    location.reload();
  };

  // ───────────────────────────── Toss a Treat ───────────────────────────────

  const canvas = document.getElementById("cat-canvas");
  const treatBtn = document.getElementById("treat-btn");
  const treatCount = document.getElementById("treat-count");
  const TR_KEY = "fa-treats-served-" + new Date().toISOString().slice(0, 10);
  let treatTotal = Number(localStorage.getItem(TR_KEY) || "0");
  treatCount.textContent = String(treatTotal);

  function dispatchPointer(type, x, y) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ev = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      clientX: rect.left + x,
      clientY: rect.top + y,
      buttons: type === "pointerdown" ? 1 : 0,
    });
    canvas.dispatchEvent(ev);
  }

  let tossing = false;
  treatBtn.addEventListener("click", () => {
    if (tossing) return;
    tossing = true;
    treatBtn.classList.add("is-cooling");

    const rect = canvas.getBoundingClientRect();
    // Land the fish somewhere in the lower half of the canvas, away from the
    // text overlay (which is bottom-left).
    const targetX = rect.width * (0.42 + Math.random() * 0.4);
    const targetY = rect.height * (0.62 + Math.random() * 0.18);

    // Spawn a flying fish element layered over the canvas.
    const fish = document.createElement("div");
    fish.className = "flying-fish";
    fish.textContent = "𓆟";
    fish.style.left = (targetX - 11) + "px";
    fish.style.top  = (targetY - 12) + "px";
    canvas.parentElement.appendChild(fish);

    // Wake Fafa & lure her: simulate a pointer move + click at the fish spot.
    // This puts cat.js into 'follow' state and triggers a tap heart pop.
    dispatchPointer("pointermove", targetX, targetY);
    setTimeout(() => dispatchPointer("pointermove", targetX, targetY), 60);

    // While she's traveling, keep nudging the target so she doesn't lose interest.
    const nudge = setInterval(() => dispatchPointer("pointermove", targetX, targetY), 220);

    // After ~1.6s, check if she's arrived; eat the fish.
    const checkArrived = () => {
      const state = (typeof window.__faState === "function") ? window.__faState() : null;
      if (!state) return false;
      const dx = state.x - targetX;
      const dy = state.y - targetY;
      return Math.hypot(dx, dy) < 38;
    };

    let elapsed = 0;
    const arriveTimer = setInterval(() => {
      elapsed += 200;
      if (checkArrived() || elapsed > 3600) {
        clearInterval(arriveTimer);
        clearInterval(nudge);
        // Trigger a "tap" near Fafa for the heart pop.
        dispatchPointer("pointerdown", targetX, targetY);
        fish.classList.add("is-eaten");
        setTimeout(() => fish.remove(), 380);
        treatTotal += 1;
        localStorage.setItem(TR_KEY, String(treatTotal));
        treatCount.textContent = String(treatTotal);
        tossing = false;
        treatBtn.classList.remove("is-cooling");
      }
    }, 200);
  });

  // ───────────────────────────── Dear Fafa — Mailbox ───────────────────────
  // Letters submitted here are queued, not auto-answered. In a real deploy
  // this submit would POST to your backend / form service (Formspree, Buttondown,
  // a serverless function, etc.) which emails you the day's letters. The host
  // then curates and posts replies in the mailbag above.
  //
  // For the prototype we just stash submissions in localStorage so refreshing
  // the page won't lose your test draft, and you can read them back via
  // `window.__faMailbag()` from the console.

  const form     = document.getElementById("mailbox-form");
  const msg      = document.getElementById("mailbox-message");
  const nameEl   = document.getElementById("mailbox-name");
  const cityEl   = document.getElementById("mailbox-city");
  const sendBtn  = document.getElementById("mailbox-send");
  const postmark = document.getElementById("mailbox-postmark");
  const thanks   = document.getElementById("mailbox-thanks");
  const again    = document.getElementById("mailbox-again");
  const bin      = document.querySelector(".mailbox-bin");
  const letter   = document.getElementById("mailbox-letter");

  function todayStamp() {
    return new Date().toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    }).toLowerCase();
  }
  postmark.textContent = todayStamp();

  const MAILBAG_KEY = "fa-mailbag-queue";
  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(MAILBAG_KEY) || "[]"); }
    catch (_) { return []; }
  }
  function saveQueue(q) {
    localStorage.setItem(MAILBAG_KEY, JSON.stringify(q));
  }
  // Dev hook: read or clear the queue from the console.
  window.__faMailbag = () => loadQueue();
  window.__faMailbagClear = () => { localStorage.removeItem(MAILBAG_KEY); };

  function flyLetter() {
    if (!letter || !bin) return;
    letter.hidden = false;
    letter.classList.remove("is-flying");
    // Force reflow so the animation restarts if submitted twice.
    void letter.offsetWidth;
    letter.classList.add("is-flying");
    setTimeout(() => bin.classList.add("is-flagged"), 700);
    setTimeout(() => {
      letter.hidden = true;
      letter.classList.remove("is-flying");
    }, 1000);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const body = msg.value.trim();
    if (!body) return;

    sendBtn.disabled = true;
    sendBtn.querySelector("span").textContent = "Mailing…";

    const entry = {
      message: body,
      from: nameEl.value.trim() || null,
      city: cityEl.value.trim() || null,
      submittedAt: new Date().toISOString(),
    };

    // In production this would be an async POST to your backend.
    // e.g. await fetch('/api/mailbag', { method:'POST', body: JSON.stringify(entry) })
    // For the prototype we queue locally.
    const q = loadQueue();
    q.push(entry);
    saveQueue(q);

    flyLetter();

    setTimeout(() => {
      form.hidden = true;
      thanks.hidden = false;
      thanks.scrollIntoView({ block: "center", behavior: "smooth" });
      sendBtn.disabled = false;
      sendBtn.querySelector("span").textContent = "Mail it";
    }, 900);
  });

  again.addEventListener("click", () => {
    thanks.hidden = true;
    form.hidden = false;
    msg.value = "";
    nameEl.value = "";
    cityEl.value = "";
    bin.classList.remove("is-flagged");
    msg.focus();
  });
})();
