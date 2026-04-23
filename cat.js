(() => {
  const canvas = document.getElementById("cat-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = 0;
  let height = 0;

  // Target the cat is "looking at" / walking toward. Follows cursor with easing.
  const target = { x: 0, y: 0, active: false };
  // Cat position (smoothed).
  const cat = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1, // 1 = right, -1 = left
    phase: 0, // walk/breath cycle
    tailPhase: 0,
    blink: 0,
    blinkTimer: 0,
  };

  // Ambient dust motes / fireflies drifting in the art panel.
  const motes = [];

  function resize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!target.active) {
      target.x = width * 0.62;
      target.y = height * 0.55;
    }
    if (cat.x === 0 && cat.y === 0) {
      cat.x = width * 0.35;
      cat.y = height * 0.6;
    }

    // Seed motes relative to panel size.
    const targetCount = Math.round((width * height) / 22000);
    while (motes.length < targetCount) {
      motes.push(makeMote());
    }
    motes.length = Math.min(motes.length, targetCount);
  }

  function makeMote() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.1 - 0.05,
      r: Math.random() * 1.4 + 0.3,
      // Warm dust motes in a sunbeam: honey gold or soft leaf-green
      hue: Math.random() < 0.6 ? 38 : 92,
      life: Math.random() * 1,
      twinkle: Math.random() * Math.PI * 2,
    };
  }

  // --- Input ----------------------------------------------------------------
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    target.x = e.clientX - rect.left;
    target.y = e.clientY - rect.top;
    target.active = true;
  });
  canvas.addEventListener("pointerleave", () => {
    target.active = false;
  });
  // Idle wander when the cursor isn't in the panel.
  let wanderT = 0;

  // --- Drawing helpers ------------------------------------------------------
  function drawBackdrop() {
    // Warm sunbeam glow + vignette.
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


  // Fafa's palette — brown tabby with white markings
  const FUR_BASE = "#8a5e38";       // warm tabby brown
  const FUR_SHADE = "#6a4528";      // shaded brown
  const FUR_STRIPE = "#2b1a10";     // near-black stripes
  const FUR_WHITE = "#f2e6d2";      // cream/white bib, paws, muzzle
  const FUR_WHITE_SHADE = "#d8c7a8"; // subtle shadow on white
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

  function drawCat() {
    const bob = Math.sin(cat.phase) * 1.6;
    const legSwing = Math.sin(cat.phase) * 6;
    const tail = Math.sin(cat.tailPhase) * 0.55;

    ctx.save();
    ctx.translate(cat.x, cat.y + bob);
    ctx.scale(cat.facing, 1);

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
    // Tail rings
    ctx.save();
    ctx.strokeStyle = FUR_STRIPE;
    ctx.lineWidth = 10;
    const tailRings = 4;
    for (let i = 1; i <= tailRings; i++) {
      const t = i / (tailRings + 1);
      // sample a short segment along the tail curve
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
    // Tail tip highlight
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

    // --- Back legs (tabby with white socks)
    ctx.fillStyle = FUR_BASE;
    ctx.beginPath();
    ctx.ellipse(-22, 24 + legSwing * 0.4, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-34, 24 - legSwing * 0.4, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // White socks
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(-22, 30 + legSwing * 0.4, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-34, 30 - legSwing * 0.4, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Front legs
    ctx.fillStyle = FUR_BASE;
    ctx.beginPath();
    ctx.ellipse(18, 24 - legSwing * 0.4, 7.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(28, 24 + legSwing * 0.4, 7.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // White mitts
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(18, 31 - legSwing * 0.4, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(28, 31 + legSwing * 0.4, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Body (tabby brown)
    ctx.beginPath();
    ctx.fillStyle = FUR_BASE;
    ctx.ellipse(-4, 8, 40, 21, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Body stripes — clipped to body ellipse
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-4, 8, 40, 21, -0.08, 0, Math.PI * 2);
    ctx.clip();
    // Horizontal arching stripes across the back
    const stripePositions = [-28, -18, -8, 2, 12, 22];
    for (const sx of stripePositions) {
      drawStripe(sx, -2, 4.5, 13, -0.08, 0.85);
    }
    // Lower flank stripes, slightly thinner
    for (const sx of [-24, -10, 6, 20]) {
      drawStripe(sx, 14, 3.5, 8, -0.08, 0.55);
    }
    ctx.restore();

    // White belly patch — big cream oval on lower/front underside
    ctx.save();
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(6, 18, 24, 10, -0.06, 0, Math.PI * 2);
    ctx.fill();
    // Soft edge blend
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = FUR_WHITE_SHADE;
    ctx.beginPath();
    ctx.ellipse(6, 22, 22, 4, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body highlight (sunbeam)
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

    // --- Head (tabby)
    ctx.fillStyle = FUR_BASE;
    ctx.beginPath();
    ctx.ellipse(28, -6, 19, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears (outer)
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
    // Inner ears — pink
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

    // Forehead "M" tabby marking
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
    // Cheek stripes
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(18, -6);
    ctx.lineTo(14, -4);
    ctx.moveTo(19, -2);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.restore();

    // White muzzle + chin
    ctx.fillStyle = FUR_WHITE;
    ctx.beginPath();
    ctx.ellipse(34, 3, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // White chest bib (continues from body white)
    ctx.beginPath();
    ctx.ellipse(22, 13, 10, 8, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // --- Eyes: green, blink-aware
    const eyeOpen = 1 - cat.blink;
    const eyeY = -7;
    const leftEyeX = 25;
    const rightEyeX = 37;
    if (eyeOpen > 0.05) {
      // Green iris with subtle glow
      ctx.save();
      const eyeGrad = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 3.2);
      eyeGrad.addColorStop(0, EYE_GREEN);
      eyeGrad.addColorStop(1, EYE_GREEN_DEEP);
      ctx.fillStyle = EYE_GREEN;
      ctx.shadowColor = "rgba(163, 201, 106, 0.5)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeY, 2.6, 3.4 * eyeOpen, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(rightEyeX, eyeY, 2.6, 3.4 * eyeOpen, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pupils — vertical slits, tracking target
      const dx = (target.x - cat.x) * cat.facing;
      const dy = target.y - cat.y;
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
      // Catchlights
      ctx.fillStyle = "rgba(255, 255, 240, 0.9)";
      ctx.beginPath();
      ctx.arc(leftEyeX - 0.8, eyeY - 1.2, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rightEyeX - 0.8, eyeY - 1.2, 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Closed eyes — small arcs
      ctx.strokeStyle = FUR_STRIPE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY, 2.8, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY, 2.8, 0, Math.PI);
      ctx.stroke();
    }

    // Nose — pink triangle
    ctx.fillStyle = NOSE_PINK;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(34.5, -1);
    ctx.lineTo(32, 3);
    ctx.closePath();
    ctx.fill();

    // Mouth line
    ctx.strokeStyle = FUR_STRIPE;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(32, 3);
    ctx.quadraticCurveTo(29, 6, 26, 5);
    ctx.moveTo(32, 3);
    ctx.quadraticCurveTo(35, 6, 38, 5);
    ctx.stroke();

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

  // --- Tick -----------------------------------------------------------------
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(48, now - last);
    last = now;

    // Idle wandering target
    if (!target.active) {
      wanderT += dt * 0.0006;
      target.x = width * (0.5 + Math.cos(wanderT) * 0.28);
      target.y = height * (0.55 + Math.sin(wanderT * 1.3) * 0.18);
    }

    // Cat chases target with easing, keeping a small standoff distance.
    const dx = target.x - cat.x;
    const dy = target.y - cat.y;
    const dist = Math.hypot(dx, dy);
    const standoff = 80;
    const pull = Math.max(0, (dist - standoff) / dist || 0);
    const ax = dx * pull * 0.0009 * dt;
    const ay = dy * pull * 0.0009 * dt;
    cat.vx = cat.vx * 0.86 + ax;
    cat.vy = cat.vy * 0.86 + ay;
    cat.x += cat.vx * dt;
    cat.y += cat.vy * dt;

    const speed = Math.hypot(cat.vx, cat.vy);
    if (Math.abs(cat.vx) > 0.02) cat.facing = cat.vx > 0 ? 1 : -1;

    // Cycles
    cat.phase += dt * (0.004 + speed * 0.6);
    cat.tailPhase += dt * 0.003;

    // Blink occasionally
    cat.blinkTimer -= dt;
    if (cat.blinkTimer <= 0) {
      cat.blink = 1;
      cat.blinkTimer = 2200 + Math.random() * 2800;
    } else if (cat.blink > 0) {
      cat.blink -= dt * 0.006;
      if (cat.blink < 0) cat.blink = 0;
    }

    // Render
    ctx.clearRect(0, 0, width, height);
    drawBackdrop();
    drawMotes(dt);
    drawCat();

    requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame((t) => {
    last = t;
    tick(t);
  });
})();
