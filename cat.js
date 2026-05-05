(() => {
  const canvas = document.getElementById("cat-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = 0;
  let height = 0;

  // Target the cat is "looking at" / walking toward. Follows cursor with easing.
  const target = { x: 0, y: 0, active: false };

  // Cat position (smoothed) + behavior state.
  const cat = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1, // 1 = right, -1 = left
    phase: 0, // walk/breath cycle
    tailPhase: 0,
    scratchPhase: 0,
    blink: 0,
    blinkTimer: 0,
    smile: 0,
    state: "wander", // wander | follow | travel | sleep | scratch
    travelTo: null, // 'bed' | 'scratch' when state === 'travel'
    actionTimer: 0,
    idleTimer: 0,
    idleThreshold: 6000,
    spawnTimer: 0,
    tapTimer: 0,
    holdAction: false,
  };

  const TAP_DURATION = 800;

  // Scenery — bed and scratch post anchors. Recomputed on resize.
  const scenery = {
    bed: { x: 0, y: 0 },
    scratch: { x: 0, y: 0, postH: 110, postW: 16 },
  };

  // Ambient dust motes / fireflies drifting in the art panel.
  const motes = [];
  // Ephemeral particles — sleep z's and scratch flakes.
  const fx = [];

  function layoutScenery() {
    scenery.bed.x = width * 0.88;
    scenery.bed.y = height * 0.84;
    scenery.scratch.x = width * 0.56;
    scenery.scratch.y = height * 0.80;
  }

  function resize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    layoutScenery();

    if (!target.active) {
      target.x = width * 0.5;
      target.y = height * 0.55;
    }
    if (cat.x === 0 && cat.y === 0) {
      cat.x = width * 0.4;
      cat.y = height * 0.65;
    }

    const targetCount = Math.round((width * height) / 22000);
    while (motes.length < targetCount) motes.push(makeMote());
    motes.length = Math.min(motes.length, targetCount);
  }

  function makeMote() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.1 - 0.05,
      r: Math.random() * 1.4 + 0.3,
      hue: Math.random() < 0.6 ? 38 : 92,
      twinkle: Math.random() * Math.PI * 2,
    };
  }

  // --- Behavior state helpers ---------------------------------------------

  function startWander() {
    cat.state = "wander";
    cat.idleTimer = 0;
    cat.idleThreshold = 5500 + Math.random() * 4000;
    cat.holdAction = false;
  }

  function pickDestination() {
    cat.state = "travel";
    cat.travelTo = Math.random() < 0.55 ? "bed" : "scratch";
    cat.idleTimer = 0;
    cat.holdAction = false;
  }

  function hitBed(px, py) {
    const dx = (px - scenery.bed.x) / 60;
    const dy = (py - (scenery.bed.y + 2)) / 22;
    return dx * dx + dy * dy < 1;
  }

  function hitScratch(px, py) {
    const x = scenery.scratch.x;
    const baseY = scenery.scratch.y;
    const postH = scenery.scratch.postH;
    return (
      px > x - 28 && px < x + 28 &&
      py > baseY - postH - 6 && py < baseY + 12
    );
  }

  function enterSleep() {
    cat.state = "sleep";
    cat.actionTimer = 9000 + Math.random() * 7000;
    cat.x = scenery.bed.x;
    cat.y = scenery.bed.y - 6;
    cat.vx = 0;
    cat.vy = 0;
    cat.facing = -1;
    cat.spawnTimer = 600;
  }

  // Dev-only hook: lets the preview agent verify the sleep pose without
  // waiting for the random wander/travel scheduler. Safe to leave in — it
  // does nothing unless someone calls window.__faSleep().
  if (typeof window !== "undefined") {
    window.__faSleep = () => {
      cat.holdAction = true;
      enterSleep();
      return { x: cat.x, y: cat.y, bed: { ...scenery.bed }, w: width, h: height };
    };
    window.__faWake = () => {
      cat.holdAction = false;
      startWander();
    };
    window.__faState = () => ({
      state: cat.state,
      x: cat.x, y: cat.y,
      bed: { ...scenery.bed },
      w: width, h: height,
    });
  }

  function enterScratch() {
    cat.state = "scratch";
    cat.actionTimer = 6500 + Math.random() * 4000;
    cat.x = scenery.scratch.x + 28;
    cat.y = scenery.scratch.y - 6;
    cat.vx = 0;
    cat.vy = 0;
    cat.facing = -1; // post is to the left of the cat
    cat.spawnTimer = 80;
  }

  function wakeIfResting() {
    if (
      cat.state === "sleep" ||
      cat.state === "scratch" ||
      cat.state === "travel"
    ) {
      cat.state = "follow";
      cat.holdAction = false;
    }
  }

  // --- Input ---------------------------------------------------------------

  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    target.x = e.clientX - rect.left;
    target.y = e.clientY - rect.top;
    target.active = true;
    // Cursor movement alone shouldn't override a user-commanded action.
    if (cat.holdAction) return;
    wakeIfResting();
    cat.state = "follow";
  });
  canvas.addEventListener("pointerleave", () => {
    target.active = false;
    if (cat.state === "follow") startWander();
  });
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const onCat = Math.hypot(px - cat.x, py - cat.y) < 70;

    // While resting, any click wakes her — tap on the cat also pops a reaction.
    if (cat.state === "sleep" || cat.state === "scratch") {
      cat.state = "follow";
      cat.holdAction = false;
      cat.smile = 1;
      if (onCat) triggerTap();
      return;
    }

    // Awake: explicit destination clicks send her there and hold the state.
    if (hitBed(px, py)) {
      cat.state = "travel";
      cat.travelTo = "bed";
      cat.holdAction = true;
      return;
    }
    if (hitScratch(px, py)) {
      cat.state = "travel";
      cat.travelTo = "scratch";
      cat.holdAction = true;
      return;
    }

    // Tap on the cat — heart reaction, then follow cursor.
    if (onCat) {
      triggerTap();
      cat.state = "follow";
      cat.smile = 1;
      return;
    }

    // Plain click on empty space — just follow cursor.
    cat.state = "follow";
    cat.holdAction = false;
    cat.smile = 1;
  });

  let wanderT = 0;

  // --- Drawing helpers -----------------------------------------------------

  function drawBackdrop() {
    const grad = ctx.createRadialGradient(
      width * 0.7,
      height * 0.25,
      Math.min(width, height) * 0.05,
      width * 0.7,
      height * 0.25,
      Math.max(width, height) * 0.9
    );
    grad.addColorStop(0, "rgba(255, 190, 110, 0.1)");
    grad.addColorStop(0.55, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawMotes(dt) {
    for (const m of motes) {
      m.x += m.vx;
      m.y += m.vy;
      m.twinkle += dt * 0.002;
      if (m.x < -10) m.x = width + 10;
      if (m.x > width + 10) m.x = -10;
      if (m.y < -10) m.y = height + 10;
      if (m.y > height + 10) m.y = -10;
      const a = 0.25 + Math.sin(m.twinkle) * 0.2;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${m.hue}, 80%, 70%, ${Math.max(0, a)})`;
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Journey scenery helpers ──────────────────────────────────────────────

  // Deterministic hash so window lights don't flicker between frames.
  function seededRng(x, y) {
    let h = (Math.imul(x | 0, 2747636419) ^ Math.imul(y | 0, 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
  }

  function drawLantern(cx, cy, size, wobble) {
    ctx.save();
    ctx.translate(cx, cy + Math.sin(wobble) * 1.8);
    ctx.rotate(Math.sin(wobble * 0.7) * 0.04);

    // Soft warm glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.8);
    glow.addColorStop(0, "rgba(220, 70, 50, 0.28)");
    glow.addColorStop(1, "rgba(220, 70, 50, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = "#b81e18";
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.68, size, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ribs
    ctx.strokeStyle = "rgba(160, 28, 22, 0.55)";
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) {
      const py = -size * 0.6 + i * size * 0.4;
      const rw = Math.sqrt(Math.max(0, 1 - (py / size) ** 2)) * size * 0.68;
      ctx.beginPath();
      ctx.moveTo(-rw, py);
      ctx.lineTo(rw, py);
      ctx.stroke();
    }

    // Highlight shimmer
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#ffdd99";
    ctx.beginPath();
    ctx.ellipse(-size * 0.2, -size * 0.25, size * 0.22, size * 0.38, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Top cap + ring
    ctx.fillStyle = "#c08820";
    ctx.fillRect(-size * 0.52, -size - size * 0.22, size * 1.04, size * 0.22);
    ctx.fillRect(-size * 0.2, -size - size * 0.42, size * 0.4, size * 0.22);

    // Bottom cap
    ctx.fillRect(-size * 0.42, size, size * 0.84, size * 0.18);

    // Tassel strings
    ctx.strokeStyle = "#c08820";
    ctx.lineWidth = 0.7;
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * size * 0.16, size + size * 0.18);
      ctx.lineTo(
        i * size * 0.16,
        size + size * 0.18 + size * 0.55 + Math.sin(wobble + i * 1.1) * size * 0.09
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawJourneyScenery(t) {
    const horizonY = height * 0.67;
    const hkW = width * 0.30; // HK spans left 30 %

    // ── HK glow ───────────────────────────────────────────────────
    ctx.save();
    const hkGlow = ctx.createRadialGradient(width * 0.12, horizonY, 0, width * 0.12, horizonY, width * 0.32);
    hkGlow.addColorStop(0, "rgba(255, 140, 50, 0.09)");
    hkGlow.addColorStop(1, "rgba(255, 140, 50, 0)");
    ctx.fillStyle = hkGlow;
    ctx.fillRect(0, 0, width * 0.38, height);
    ctx.restore();

    // ── HK skyline ────────────────────────────────────────────────
    // Each entry: [xFrac of hkW, widthFrac of hkW, heightFrac of canvas]
    const hkB = [
      [0.00, 0.06, 0.38], [0.07, 0.04, 0.52], [0.12, 0.07, 0.44],
      [0.20, 0.04, 0.60], [0.25, 0.06, 0.48], [0.32, 0.03, 0.66],
      [0.36, 0.06, 0.56], [0.43, 0.04, 0.42], [0.48, 0.07, 0.50],
      [0.56, 0.03, 0.46], [0.60, 0.05, 0.35], [0.66, 0.07, 0.40],
      [0.74, 0.03, 0.30], [0.78, 0.07, 0.36], [0.86, 0.07, 0.26],
      [0.94, 0.06, 0.20],
    ];

    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = "#1b1308";
    for (const [xf, wf, hf] of hkB) {
      const bx = xf * hkW, bw = wf * hkW;
      const bh = height * hf, by = horizonY - bh;
      ctx.fillRect(bx, by, bw, bh);
      // Rooftop antenna on tall buildings
      if (hf > 0.46) ctx.fillRect(bx + bw * 0.42, by - bh * 0.07, 1.5, bh * 0.07);
    }
    ctx.restore();

    // Window lights (stable — no flicker)
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (const [xf, wf, hf] of hkB) {
      const bx = xf * hkW, bw = wf * hkW;
      const bh = height * hf, by = horizonY - bh;
      const cols = Math.max(1, Math.floor(bw / 5));
      const rows = Math.max(1, Math.floor(bh / 9));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const rng = seededRng(Math.round(bx * 10) + c, Math.round(by * 10) + r);
          if (rng < 0.55) {
            const rng2 = seededRng(Math.round(bx * 10) + c + 500, Math.round(by * 10) + r + 500);
            ctx.fillStyle = rng2 < 0.18 ? "#ffdd66" : "#ffaa44";
            ctx.fillRect(bx + 2 + c * (bw / cols), by + 5 + r * 9, 2, 3);
          }
        }
      }
    }
    ctx.restore();

    // ── Bamboo (left edge, HK foreground) ─────────────────────────
    ctx.save();
    const bamboos = [
      { xf: 0.010, phase: 0.0 }, { xf: 0.024, phase: 0.5 },
      { xf: 0.038, phase: 1.0 }, { xf: 0.050, phase: 1.5 },
    ];
    for (const { xf, phase } of bamboos) {
      const bx = width * xf + Math.sin(t * 0.38 + phase) * 2.2;
      const topY = horizonY - height * 0.08;

      ctx.strokeStyle = "#4a6a30";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.28;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(bx, height * 0.95);
      ctx.lineTo(bx + Math.sin(t * 0.3 + phase) * 3.5, topY);
      ctx.stroke();

      // Node rings
      ctx.strokeStyle = "#3a5228";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.2;
      for (let s = 1; s <= 5; s++) {
        const sy = height * 0.95 - (height * 0.95 - topY) * (s / 5.5);
        ctx.beginPath();
        ctx.moveTo(bx - 3, sy);
        ctx.lineTo(bx + 3, sy);
        ctx.stroke();
      }

      // Leaves
      ctx.fillStyle = "#567040";
      ctx.globalAlpha = 0.32;
      const leafY = topY + Math.sin(t * 0.4 + phase) * 3;
      ctx.beginPath();
      ctx.ellipse(bx + 10, leafY, 13, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx - 11, leafY + 14, 14, 3, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── Red lanterns (HK) ─────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.88;
    const lanterns = [
      { xf: 0.050, yf: 0.38, s: 7,  p: 0.0 },
      { xf: 0.105, yf: 0.30, s: 9,  p: 1.2 },
      { xf: 0.170, yf: 0.36, s: 6,  p: 2.4 },
      { xf: 0.075, yf: 0.52, s: 5,  p: 0.8 },
      { xf: 0.220, yf: 0.42, s: 7,  p: 1.8 },
    ];
    for (const { xf, yf, s, p } of lanterns) {
      drawLantern(width * xf, height * yf, s, t * 0.6 + p);
    }
    ctx.restore();

    // ── Flight path arc (HK → SF) ─────────────────────────────────
    const arcX0 = width * 0.18, arcY0 = height * 0.28;
    const arcCx0 = width * 0.36, arcCy0 = height * 0.04;
    const arcCx1 = width * 0.64, arcCy1 = height * 0.04;
    const arcX1 = width * 0.76, arcY1 = height * 0.28;

    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#dcc880";
    ctx.lineWidth = 1.3;
    ctx.setLineDash([5, 9]);
    ctx.beginPath();
    ctx.moveTo(arcX0, arcY0);
    ctx.bezierCurveTo(arcCx0, arcCy0, arcCx1, arcCy1, arcX1, arcY1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Animated airplane along the arc
    const planeT = (t * 0.072) % 1;
    const pl = bezierPoint(planeT, arcX0, arcY0, arcCx0, arcCy0, arcCx1, arcCy1, arcX1, arcY1);
    const plPrev = bezierPoint(Math.max(0, planeT - 0.01), arcX0, arcY0, arcCx0, arcCy0, arcCx1, arcCy1, arcX1, arcY1);
    const plAngle = Math.atan2(pl.y - plPrev.y, pl.x - plPrev.x);

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.translate(pl.x, pl.y);
    ctx.rotate(plAngle);
    ctx.fillStyle = "#e8d8b0";
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings
    ctx.beginPath();
    ctx.moveTo(-1, 0); ctx.lineTo(-5, -5.5); ctx.lineTo(3, 0); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-1, 0); ctx.lineTo(-5, 5.5); ctx.lineTo(3, 0); ctx.closePath();
    ctx.fill();
    // Tail fin
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(-10, -3.5); ctx.lineTo(-8, 0); ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── SF ambient glow ───────────────────────────────────────────
    ctx.save();
    const sfGlow = ctx.createRadialGradient(width * 0.80, horizonY, 0, width * 0.80, horizonY, width * 0.28);
    sfGlow.addColorStop(0, "rgba(110, 170, 210, 0.07)");
    sfGlow.addColorStop(1, "rgba(110, 170, 210, 0)");
    ctx.fillStyle = sfGlow;
    ctx.fillRect(width * 0.55, 0, width * 0.45, height);
    ctx.restore();

    // ── SF rolling hills ──────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#5a7040";
    ctx.beginPath();
    ctx.moveTo(width * 0.56, horizonY);
    ctx.bezierCurveTo(width * 0.61, height * 0.48, width * 0.68, height * 0.45, width * 0.74, horizonY);
    ctx.lineTo(width * 0.56, horizonY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width * 0.73, horizonY);
    ctx.bezierCurveTo(width * 0.80, height * 0.43, width * 0.90, height * 0.46, width, horizonY);
    ctx.lineTo(width * 0.73, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── SF fog wisps ─────────────────────────────────────────────
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const fx = width * (0.60 + i * 0.09) + Math.sin(t * 0.1 + i) * width * 0.01;
      const fy = horizonY - height * (0.04 + i * 0.005);
      ctx.globalAlpha = 0.07 + Math.sin(t * 0.09 + i * 1.3) * 0.02;
      const fog = ctx.createRadialGradient(fx, fy, 0, fx, fy, width * 0.095);
      fog.addColorStop(0, "rgba(205, 212, 200, 0.75)");
      fog.addColorStop(1, "rgba(205, 212, 200, 0)");
      ctx.fillStyle = fog;
      ctx.beginPath();
      ctx.ellipse(fx, fy, width * 0.095, height * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── Golden Gate Bridge ────────────────────────────────────────
    const ggLx = width * 0.640;  // left tower
    const ggRx = width * 0.818;  // right tower (closer = slightly shorter)
    const ggDeck = horizonY;
    const ggTH = height * 0.28;
    const ggColor = "#8b3a24";

    const ltop = ggDeck - ggTH;
    const rtop = ggDeck - ggTH * 0.91;

    ctx.save();
    ctx.globalAlpha = 0.54;
    ctx.fillStyle = ggColor;

    // Left tower
    ctx.fillRect(ggLx - 4, ltop, 8, ggTH);
    ctx.fillRect(ggLx - 14, ltop + 10, 28, 4.5);
    ctx.fillRect(ggLx - 14, ltop + ggTH * 0.38, 28, 4.5);

    // Right tower
    ctx.fillRect(ggRx - 4, rtop, 8, ggTH * 0.91);
    ctx.fillRect(ggRx - 14, rtop + 10, 28, 4.5);
    ctx.fillRect(ggRx - 14, rtop + ggTH * 0.91 * 0.38, 28, 4.5);

    // Main suspension cable (catenary)
    const csx = ggLx - 60, csy = ltop + 12;
    const cex = ggRx + 55, cey = rtop + 12;
    const midX = (ggLx + ggRx) / 2;
    const midY = ggDeck + height * 0.026;

    ctx.strokeStyle = ggColor;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(csx, csy + height * 0.04);
    ctx.quadraticCurveTo(ggLx, ltop + 12, midX, midY);
    ctx.quadraticCurveTo(ggRx, rtop + 12, cex, cey + height * 0.03);
    ctx.stroke();

    // Vertical hangers
    ctx.lineWidth = 0.75;
    ctx.globalAlpha = 0.28;
    for (let hx = csx + 10; hx <= cex - 10; hx += 10) {
      let cy2;
      if (hx <= midX) {
        const tl = (hx - csx) / (midX - csx);
        cy2 = (1-tl)*(1-tl)*(csy+height*0.04) + 2*(1-tl)*tl*(ltop+12) + tl*tl*midY;
      } else {
        const tr = (hx - midX) / (cex - midX);
        cy2 = (1-tr)*(1-tr)*midY + 2*(1-tr)*tr*(rtop+12) + tr*tr*(cey+height*0.03);
      }
      ctx.beginPath();
      ctx.moveTo(hx, cy2);
      ctx.lineTo(hx, ggDeck);
      ctx.stroke();
    }

    // Bridge deck
    ctx.globalAlpha = 0.54;
    ctx.fillStyle = ggColor;
    ctx.fillRect(csx, ggDeck - 5, cex - csx, 5);

    ctx.restore();

    // ── Subtle horizon haze ───────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.06;
    const hz = ctx.createLinearGradient(0, horizonY - 8, 0, horizonY + 8);
    hz.addColorStop(0,   "rgba(200, 180, 140, 0)");
    hz.addColorStop(0.5, "rgba(200, 180, 140, 0.5)");
    hz.addColorStop(1,   "rgba(200, 180, 140, 0)");
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizonY - 8, width, 16);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBed(b) {
    ctx.save();
    // Floor shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 18, 60, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer rim — warm rust
    ctx.fillStyle = "#5a2f24";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 4, 58, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner cushion — warm cream
    ctx.fillStyle = "#e2b89a";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 1, 50, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Center depression — softer dip
    ctx.fillStyle = "#b88a6e";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 1, 36, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stitched rim
    ctx.strokeStyle = "rgba(255, 230, 200, 0.45)";
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 4, 54, 17, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawScratchPost(p) {
    ctx.save();
    const baseY = p.y;
    const postH = p.postH;
    const postW = p.postW;
    const postX = p.x - postW / 2;
    const postTop = baseY - postH;

    // Floor shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(p.x, baseY + 7, 30, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wooden base
    ctx.fillStyle = "#5e3e22";
    roundRect(p.x - 28, baseY - 4, 56, 12, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 220, 170, 0.1)";
    roundRect(p.x - 28, baseY - 4, 56, 4, 3);
    ctx.fill();

    // Sisal-wrapped post body
    const ropeGrad = ctx.createLinearGradient(postX, 0, postX + postW, 0);
    ropeGrad.addColorStop(0, "#6e4a26");
    ropeGrad.addColorStop(0.5, "#a07a48");
    ropeGrad.addColorStop(1, "#6e4a26");
    ctx.fillStyle = ropeGrad;
    ctx.fillRect(postX, postTop, postW, postH);

    // Rope bands
    ctx.strokeStyle = "rgba(50, 30, 12, 0.7)";
    ctx.lineWidth = 1;
    for (let y = postTop + 3; y < baseY - 3; y += 4) {
      ctx.beginPath();
      ctx.moveTo(postX, y);
      ctx.lineTo(postX + postW, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 220, 170, 0.18)";
    for (let y = postTop + 3; y < baseY - 3; y += 4) {
      ctx.beginPath();
      ctx.moveTo(postX + 2, y - 1);
      ctx.lineTo(postX + postW - 2, y - 1);
      ctx.stroke();
    }

    // Top cap
    ctx.fillStyle = "#5e3e22";
    roundRect(postX - 1, postTop - 4, postW + 2, 5, 2);
    ctx.fill();

    // Pre-existing claw scratches
    ctx.strokeStyle = "rgba(40, 22, 10, 0.45)";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) {
      const yy = postTop + 28 + i * 14;
      ctx.beginPath();
      ctx.moveTo(postX + 2, yy);
      ctx.lineTo(postX + postW - 2, yy + 2);
      ctx.stroke();
    }

    // Hanging string + green pom-pom toy (gentle sway)
    const sway = Math.sin(performance.now() * 0.002) * 4;
    const stringStartX = p.x + 1;
    const stringStartY = postTop - 2;
    const tasselX = p.x + 6 + sway;
    const tasselY = postTop + 16;
    ctx.strokeStyle = "rgba(245, 230, 200, 0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(stringStartX, stringStartY);
    ctx.lineTo(tasselX, tasselY);
    ctx.stroke();
    ctx.fillStyle = "#9cc26a";
    ctx.beginPath();
    ctx.arc(tasselX, tasselY, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 200, 0.45)";
    ctx.beginPath();
    ctx.arc(tasselX - 1, tasselY - 1.2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function spawnZ() {
    fx.push({
      type: "z",
      x: cat.x + (cat.facing === -1 ? -8 : 16),
      y: cat.y - 18,
      vx: 0.02,
      vy: -0.05,
      life: 0,
      maxLife: 2400,
      size: 11 + Math.random() * 4,
      drift: Math.random() * Math.PI * 2,
    });
  }

  function spawnFlake() {
    const sx = scenery.scratch.x + (Math.random() - 0.5) * 6;
    const sy = scenery.scratch.y - 30 - Math.random() * 60;
    fx.push({
      type: "flake",
      x: sx,
      y: sy,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0.04 + Math.random() * 0.1,
      life: 0,
      maxLife: 700 + Math.random() * 300,
    });
  }

  function spawnHeart() {
    fx.push({
      type: "heart",
      x: cat.x + (Math.random() - 0.5) * 28,
      y: cat.y - 26,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -0.07 - Math.random() * 0.04,
      life: 0,
      maxLife: 1300 + Math.random() * 400,
      size: 4 + Math.random() * 2.5,
      drift: Math.random() * Math.PI * 2,
    });
  }

  function triggerTap() {
    cat.tapTimer = TAP_DURATION;
    cat.blink = 0;
    cat.smile = 1;
    for (let i = 0; i < 4; i++) spawnHeart();
  }

  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life += dt;
      if (f.life >= f.maxLife) {
        fx.splice(i, 1);
        continue;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.type === "z") {
        f.drift += dt * 0.003;
        f.x += Math.sin(f.drift) * 0.04 * dt;
      } else if (f.type === "heart") {
        f.drift += dt * 0.005;
        f.x += Math.sin(f.drift) * 0.05 * dt;
      }
    }
  }

  function drawFx() {
    for (const f of fx) {
      const t = f.life / f.maxLife;
      if (f.type === "z") {
        const a = (1 - t) * 0.75;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = "#ecdcb6";
        ctx.font = `italic ${f.size}px "Fraunces", Georgia, serif`;
        ctx.fillText("z", f.x, f.y);
        ctx.restore();
      } else if (f.type === "flake") {
        const a = (1 - t) * 0.6;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = "#a07a48";
        ctx.beginPath();
        ctx.arc(f.x, f.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (f.type === "heart") {
        const a = (1 - t) * 0.85;
        const pop = Math.min(1, f.life / 180);
        const s = f.size * (0.5 + 0.6 * pop);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = "#e35d6a";
        ctx.beginPath();
        ctx.moveTo(f.x, f.y + s * 0.3);
        ctx.bezierCurveTo(f.x - s, f.y - s * 0.4, f.x - s * 1.4, f.y + s * 0.4, f.x, f.y + s * 1.2);
        ctx.bezierCurveTo(f.x + s * 1.4, f.y + s * 0.4, f.x + s, f.y - s * 0.4, f.x, f.y + s * 0.3);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 240, 230, 0.7)";
        ctx.beginPath();
        ctx.arc(f.x - s * 0.4, f.y + s * 0.2, s * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // --- Cat palette --------------------------------------------------------
  const FUR_BASE = "#8a5e38";
  const FUR_SHADE = "#6a4528";
  const FUR_STRIPE = "#2b1a10";
  const FUR_WHITE = "#f2e6d2";
  const FUR_WHITE_SHADE = "#d8c7a8";
  const EAR_PINK = "#c88a7a";
  const NOSE_PINK = "#d6907e";
  const EYE_GREEN = "#a3c96a";
  const EYE_GREEN_DEEP = "#6b9b3a";

  function drawStripe(cx, cy, w, h, angle, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = FUR_STRIPE;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function bezierPoint(t, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * p0x + 3 * uu * t * p1x + 3 * u * tt * p2x + ttt * p3x,
      y: uuu * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + ttt * p3y,
    };
  }

  // Sleeping pose — drawn separately from the standing/walking pose so we can
  // show a proper curled-up cat lying in her bed instead of just squishing the
  // standing drawing vertically.
  function drawSleepingCat() {
    ctx.save();
    ctx.translate(cat.x, cat.y);
    ctx.scale(cat.facing, 1);

    const breath = Math.sin(cat.tailPhase * 0.5) * 0.5;
    const tailFlick = Math.sin(cat.tailPhase * 0.3) * 1.2;

    // Tail wraps around the front of the body. Draw it first so the body
    // overlaps it where it tucks behind her side.
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = FUR_BASE;
    ctx.lineWidth = 9;
    // Curve from back-left, sweeping down and around toward the front paws.
    const tx0 = -34, ty0 = 6;
    const tx1 = -50, ty1 = 22 + tailFlick;
    const tx2 = -8, ty2 = 26 + tailFlick;
    const tx3 = 24, ty3 = 14;
    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.bezierCurveTo(tx1, ty1, tx2, ty2, tx3, ty3);
    ctx.stroke();
    // Tail rings (tabby)
    ctx.strokeStyle = FUR_STRIPE;
    ctx.lineWidth = 9;
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const p0 = bezierPoint(t - 0.04, tx0, ty0, tx1, ty1, tx2, ty2, tx3, ty3);
      const p1 = bezierPoint(t + 0.04, tx0, ty0, tx1, ty1, tx2, ty2, tx3, ty3);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    // Tail tip highlight
    ctx.strokeStyle = "rgba(255, 220, 170, 0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.bezierCurveTo(tx1, ty1, tx2, ty2, tx3, ty3);
    ctx.stroke();
    ctx.restore();

    // Curled body — flat horizontal loaf, fits in the bed cushion
    ctx.fillStyle = FUR_BASE;
    ctx.beginPath();
    ctx.ellipse(-4, 4 + breath * 0.4, 38, 12, -0.04, 0, Math.PI * 2);
    ctx.fill();

    // Tabby stripes across the visible back, clipped to the body
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-4, 4 + breath * 0.4, 38, 12, -0.04, 0, Math.PI * 2);
    ctx.clip();
    for (const sx of [-28, -20, -12, -4, 4, 12]) {
      drawStripe(sx, 0, 3.2, 8, -0.04, 0.78);
    }
    ctx.restore();

    // White underside / belly fur peeking
    ctx.save();
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(-2, 11 + breath * 0.4, 26, 5, -0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = FUR_WHITE_SHADE;
    ctx.beginPath();
    ctx.ellipse(-2, 14 + breath * 0.4, 24, 2, -0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Soft sunbeam highlight along the back
    ctx.save();
    ctx.globalAlpha = 0.2;
    const bodyGrad = ctx.createLinearGradient(-30, -4, 25, 8);
    bodyGrad.addColorStop(0, "rgba(255, 220, 160, 0.85)");
    bodyGrad.addColorStop(1, "rgba(255, 220, 160, 0)");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(-4, 1, 38, 12, -0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Front paws — small white peeks tucked under chin
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(20, 14, 6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(13, 15, 5.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head — turned slightly toward us, resting near the paws
    ctx.fillStyle = FUR_BASE;
    ctx.beginPath();
    ctx.ellipse(24, -2 + breath * 0.5, 16, 13, 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Outer ears — relaxed, slightly drooped sideways
    ctx.beginPath();
    ctx.moveTo(14, -8);
    ctx.lineTo(17, -18);
    ctx.lineTo(23, -10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(27, -10);
    ctx.lineTo(33, -17);
    ctx.lineTo(36, -6);
    ctx.closePath();
    ctx.fill();
    // Inner ears — pink
    ctx.fillStyle = EAR_PINK;
    ctx.beginPath();
    ctx.moveTo(17, -10);
    ctx.lineTo(19, -15);
    ctx.lineTo(21, -10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(29, -10);
    ctx.lineTo(33, -14);
    ctx.lineTo(34, -8);
    ctx.closePath();
    ctx.fill();

    // Subtle forehead M
    ctx.save();
    ctx.strokeStyle = FUR_STRIPE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(19, -6);
    ctx.lineTo(22, -3);
    ctx.lineTo(25, -6);
    ctx.lineTo(28, -3);
    ctx.lineTo(31, -6);
    ctx.stroke();
    ctx.restore();

    // White muzzle + chin
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(30, 5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Closed eyes — gentle happy arcs
    ctx.strokeStyle = FUR_STRIPE;
    ctx.lineWidth = 1.3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(20, 0, 2.6, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(28, 0, 2.6, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // Pink nose
    ctx.fillStyle = NOSE_PINK;
    ctx.beginPath();
    ctx.moveTo(27, 5);
    ctx.lineTo(30, 4);
    ctx.lineTo(28.5, 7.5);
    ctx.closePath();
    ctx.fill();

    // Tiny content smile
    ctx.strokeStyle = FUR_STRIPE;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(28.5, 7.5);
    ctx.quadraticCurveTo(26, 9, 24, 8);
    ctx.moveTo(28.5, 7.5);
    ctx.quadraticCurveTo(31, 9, 33, 8);
    ctx.stroke();

    // Whiskers — soft
    ctx.strokeStyle = "rgba(245, 237, 224, 0.6)";
    ctx.lineWidth = 0.7;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(30, 6 + i * 1.2);
      ctx.lineTo(46, 7 + i * 2.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCat() {
    if (cat.state === "sleep") {
      drawSleepingCat();
      return;
    }

    const scratching = cat.state === "scratch";

    const tapBoost = Math.max(0, cat.tapTimer / TAP_DURATION);
    const tapJump = -12 * Math.sin(tapBoost * Math.PI);
    const bob = Math.sin(cat.phase) * 1.6 + tapJump;
    const legSwing = scratching
      ? Math.sin(cat.scratchPhase) * 12
      : Math.sin(cat.phase) * 6;
    const armSwing = scratching ? Math.sin(cat.scratchPhase + Math.PI) * 10 : 0;
    const tail = Math.sin(cat.tailPhase) * 0.55;

    ctx.save();
    ctx.translate(cat.x, cat.y + bob);
    if (scratching) {
      ctx.scale(cat.facing, 1);
      ctx.rotate(-0.18); // lean back into the post
      ctx.translate(0, -2);
    } else {
      ctx.scale(cat.facing, 1);
    }

    // Ground shadow
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(-2, 30, 42, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Tail — tabby brown with dark rings
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = FUR_BASE;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-38, 4);
    ctx.bezierCurveTo(
      -62, -8 + tail * 12,
      -78, -30 + tail * 28,
      -56 + tail * 14, -54 + tail * 18
    );
    ctx.stroke();
    ctx.save();
    ctx.strokeStyle = FUR_STRIPE;
    ctx.lineWidth = 10;
    const tailRings = 4;
    for (let i = 1; i <= tailRings; i++) {
      const t = i / (tailRings + 1);
      const segA = t - 0.03;
      const segB = t + 0.03;
      const p0 = bezierPoint(segA, -38, 4, -62, -8 + tail * 12, -78, -30 + tail * 28, -56 + tail * 14, -54 + tail * 18);
      const p1 = bezierPoint(segB, -38, 4, -62, -8 + tail * 12, -78, -30 + tail * 28, -56 + tail * 14, -54 + tail * 18);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255, 220, 170, 0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-38, 4);
    ctx.bezierCurveTo(
      -62, -8 + tail * 12,
      -78, -30 + tail * 28,
      -56 + tail * 14, -54 + tail * 18
    );
    ctx.stroke();
    ctx.restore();

    // Back legs
    ctx.fillStyle = FUR_BASE;
    ctx.beginPath();
    ctx.ellipse(-22, 24 + legSwing * 0.4, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-34, 24 - legSwing * 0.4, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(-22, 30 + legSwing * 0.4, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-34, 30 - legSwing * 0.4, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front legs (paws lift higher when scratching)
    ctx.fillStyle = FUR_BASE;
    ctx.beginPath();
    ctx.ellipse(18, 24 - legSwing * 0.4 - armSwing * 0.4, 7.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(28, 24 + legSwing * 0.4 + armSwing * 0.4, 7.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(18, 31 - legSwing * 0.4 - armSwing * 0.4, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(28, 31 + legSwing * 0.4 + armSwing * 0.4, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.fillStyle = FUR_BASE;
    ctx.ellipse(-4, 8, 40, 21, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Body stripes — clipped to body ellipse
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-4, 8, 40, 21, -0.08, 0, Math.PI * 2);
    ctx.clip();
    const stripePositions = [-28, -18, -8, 2, 12, 22];
    for (const sx of stripePositions) {
      drawStripe(sx, -2, 4.5, 13, -0.08, 0.85);
    }
    for (const sx of [-24, -10, 6, 20]) {
      drawStripe(sx, 14, 3.5, 8, -0.08, 0.55);
    }
    ctx.restore();

    // White belly patch
    ctx.save();
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(6, 18, 24, 10, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = FUR_WHITE_SHADE;
    ctx.beginPath();
    ctx.ellipse(6, 22, 22, 4, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body sunbeam highlight
    ctx.save();
    ctx.globalAlpha = 0.22;
    const bodyGrad = ctx.createLinearGradient(-40, -10, 30, 18);
    bodyGrad.addColorStop(0, "rgba(255, 220, 160, 0.85)");
    bodyGrad.addColorStop(1, "rgba(255, 220, 160, 0)");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(-4, 4, 40, 21, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Head
    ctx.fillStyle = FUR_BASE;
    ctx.beginPath();
    ctx.ellipse(28, -6, 19, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer ears
    ctx.beginPath();
    ctx.moveTo(15, -17);
    ctx.lineTo(20, -33);
    ctx.lineTo(27, -18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(31, -18);
    ctx.lineTo(39, -32);
    ctx.lineTo(43, -15);
    ctx.closePath();
    ctx.fill();
    // Inner ears
    ctx.fillStyle = EAR_PINK;
    ctx.beginPath();
    ctx.moveTo(18, -19);
    ctx.lineTo(21, -29);
    ctx.lineTo(25, -19);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(33, -19);
    ctx.lineTo(38, -28);
    ctx.lineTo(41, -18);
    ctx.closePath();
    ctx.fill();

    // Forehead M + cheek stripes
    ctx.save();
    ctx.strokeStyle = FUR_STRIPE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(22, -14);
    ctx.lineTo(25, -10);
    ctx.lineTo(28, -14);
    ctx.lineTo(31, -10);
    ctx.lineTo(34, -14);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(18, -6);
    ctx.lineTo(14, -4);
    ctx.moveTo(19, -2);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.restore();

    // White muzzle + chest bib
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(34, 3, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(22, 13, 10, 8, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — green with tracking pupils (sleep is handled in drawSleepingCat)
    const renderBlink = cat.blink * (1 - tapBoost);
    const eyeOpen = 1 - renderBlink;
    const eyeScale = 1 + 0.35 * tapBoost;
    const eyeY = -7;
    const leftEyeX = 25;
    const rightEyeX = 37;
    if (eyeOpen > 0.05) {
      ctx.save();
      ctx.fillStyle = EYE_GREEN;
      ctx.shadowColor = "rgba(163, 201, 106, 0.5)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeY, 2.6 * eyeScale, 3.4 * eyeOpen * eyeScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(rightEyeX, eyeY, 2.6 * eyeScale, 3.4 * eyeOpen * eyeScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pupils — track the post when scratching, otherwise the target
      let lookX = target.x;
      let lookY = target.y;
      if (scratching) {
        lookX = scenery.scratch.x;
        lookY = scenery.scratch.y - scenery.scratch.postH * 0.5;
      }
      const dx = (lookX - cat.x) * cat.facing;
      const dy = lookY - cat.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const px = (dx / len) * 1.0;
      const py = (dy / len) * 1.4;
      ctx.fillStyle = "#1a1008";
      ctx.beginPath();
      ctx.ellipse(leftEyeX + px, eyeY + py, 0.8, 2.6 * eyeOpen, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(rightEyeX + px, eyeY + py, 0.8, 2.6 * eyeOpen, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 240, 0.9)";
      ctx.beginPath();
      ctx.arc(leftEyeX - 0.8, eyeY - 1.2, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rightEyeX - 0.8, eyeY - 1.2, 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Closed eye arcs — happy curves when sleeping
      ctx.strokeStyle = FUR_STRIPE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY, 2.8, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY, 2.8, 0, Math.PI);
      ctx.stroke();
    }

    // Nose
    ctx.fillStyle = NOSE_PINK;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(34.5, -1);
    ctx.lineTo(32, 3);
    ctx.closePath();
    ctx.fill();

    // Mouth — opens into a chirp when tapped
    if (tapBoost > 0.15) {
      ctx.fillStyle = "#3a1e12";
      ctx.beginPath();
      ctx.ellipse(32, 5, 2.4 * tapBoost, 2.8 * tapBoost, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = NOSE_PINK;
      ctx.beginPath();
      ctx.ellipse(32, 6.4, 1.4 * tapBoost, 1.2 * tapBoost, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = FUR_STRIPE;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(32, 3);
      ctx.quadraticCurveTo(29, 6, 26, 5);
      ctx.moveTo(32, 3);
      ctx.quadraticCurveTo(35, 6, 38, 5);
      ctx.stroke();
    }

    // Whiskers
    ctx.strokeStyle = "rgba(245, 237, 224, 0.7)";
    ctx.lineWidth = 0.8;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(30, 2 + i * 1.8);
      ctx.lineTo(54, 2 + i * 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(30, 2 + i * 1.8);
      ctx.lineTo(14, 4 + i * 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- Tick ----------------------------------------------------------------
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(48, now - last);
    last = now;

    // --- State updates: pick where the cat is heading / what she's doing
    if (cat.state === "follow") {
      // target.x/y already set by pointermove
      cat.smile = Math.min(1, cat.smile + dt * 0.002);
    } else if (cat.state === "wander") {
      wanderT += dt * 0.0006;
      target.x = width * (0.5 + Math.cos(wanderT) * 0.28);
      target.y = height * (0.55 + Math.sin(wanderT * 1.3) * 0.18);
      cat.smile = Math.max(0, cat.smile - dt * 0.001);
      cat.idleTimer += dt;
      if (cat.idleTimer >= cat.idleThreshold) pickDestination();
    } else if (cat.state === "travel") {
      const dest = cat.travelTo === "bed" ? scenery.bed : scenery.scratch;
      const approachX = cat.travelTo === "bed" ? dest.x : dest.x + 28;
      const approachY = cat.travelTo === "bed" ? dest.y - 6 : dest.y - 6;
      target.x = approachX;
      target.y = approachY;
      const dist = Math.hypot(approachX - cat.x, approachY - cat.y);
      if (dist < 8) {
        if (cat.travelTo === "bed") enterSleep();
        else enterScratch();
      }
      cat.smile = Math.max(0, cat.smile - dt * 0.001);
    } else if (cat.state === "sleep" || cat.state === "scratch") {
      if (!cat.holdAction) cat.actionTimer -= dt;
      cat.spawnTimer -= dt;
      if (cat.spawnTimer <= 0) {
        if (cat.state === "sleep") {
          spawnZ();
          cat.spawnTimer = 1100 + Math.random() * 500;
        } else {
          spawnFlake();
          cat.spawnTimer = 50 + Math.random() * 80;
        }
      }
      if (!cat.holdAction && cat.actionTimer <= 0) startWander();
    }

    // --- Motion: chase target (skipped while resting)
    if (cat.state === "sleep" || cat.state === "scratch") {
      // Lock to anchor; bleed off any residual velocity.
      cat.vx *= 0.7;
      cat.vy *= 0.7;
    } else {
      const dx = target.x - cat.x;
      const dy = target.y - cat.y;
      const dist = Math.hypot(dx, dy);
      const standoff = cat.state === "travel" ? 4 : 80;
      const pull = dist > 0 ? Math.max(0, (dist - standoff) / dist) : 0;
      const accel = cat.state === "travel" ? 0.00035 : 0.0009;
      const ax = dx * pull * accel * dt;
      const ay = dy * pull * accel * dt;
      cat.vx = cat.vx * 0.86 + ax;
      cat.vy = cat.vy * 0.86 + ay;
      // Cap speed so the cat can't slingshot past her destination.
      const maxSpeed = 0.35;
      const sp = Math.hypot(cat.vx, cat.vy);
      if (sp > maxSpeed) {
        cat.vx = (cat.vx / sp) * maxSpeed;
        cat.vy = (cat.vy / sp) * maxSpeed;
      }
      cat.x += cat.vx * dt;
      cat.y += cat.vy * dt;
      // Stay inside the panel.
      cat.x = Math.max(40, Math.min(width - 40, cat.x));
      cat.y = Math.max(40, Math.min(height - 30, cat.y));
      if (Math.abs(cat.vx) > 0.02) cat.facing = cat.vx > 0 ? 1 : -1;
    }

    const speed = Math.hypot(cat.vx, cat.vy);
    cat.phase += dt * (0.004 + speed * 0.6);
    cat.tailPhase += dt * (cat.state === "sleep" ? 0.0015 : 0.003);
    if (cat.state === "scratch") {
      cat.scratchPhase += dt * 0.025;
    }

    // Blink (skip while sleeping — eyes stay closed)
    if (cat.state !== "sleep") {
      cat.blinkTimer -= dt;
      if (cat.blinkTimer <= 0) {
        cat.blink = 1;
        cat.blinkTimer = 2200 + Math.random() * 2800;
      } else if (cat.blink > 0) {
        cat.blink -= dt * 0.006;
        if (cat.blink < 0) cat.blink = 0;
      }
    }

    if (cat.tapTimer > 0) cat.tapTimer = Math.max(0, cat.tapTimer - dt);

    updateFx(dt);

    // --- Render
    ctx.clearRect(0, 0, width, height);
    drawBackdrop();
    drawJourneyScenery(performance.now() * 0.001);
    drawMotes(dt);
    drawBed(scenery.bed);
    drawScratchPost(scenery.scratch);
    drawCat();
    drawFx();

    requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener("resize", resize);
  resize();
  startWander();
  requestAnimationFrame((t) => {
    last = t;
    tick(t);
  });
})();
