(() => {
  const audio = document.getElementById("episode-audio");
  const playBtn = document.getElementById("play-btn");
  const fill = document.getElementById("progress-fill");
  const seek = document.getElementById("progress-input");
  const timeCurrent = document.getElementById("time-current");
  const timeTotal = document.getElementById("time-total");

  if (!audio || !playBtn) return;

  // Placeholder episode — Blender Foundation's public-domain sample.
  // Replace with the real episode URL once available.
  const EPISODE_SRC =
    "https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3";
  audio.src = EPISODE_SRC;

  function fmt(t) {
    if (!isFinite(t) || t < 0) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function setPlaying(on) {
    playBtn.setAttribute("aria-pressed", on ? "true" : "false");
    playBtn.setAttribute("aria-label", on ? "Pause episode" : "Play episode");
  }

  playBtn.addEventListener("click", async () => {
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (err) {
      console.warn("Playback blocked or failed:", err);
    }
  });

  audio.addEventListener("play", () => setPlaying(true));
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("ended", () => setPlaying(false));

  audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = fmt(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    fill.style.width = pct + "%";
    seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    timeCurrent.textContent = fmt(audio.currentTime);
  });

  seek.addEventListener("input", () => {
    if (!audio.duration) return;
    const pct = Number(seek.value) / 1000;
    audio.currentTime = pct * audio.duration;
    fill.style.width = pct * 100 + "%";
  });
})();
