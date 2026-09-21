(function () {
  const GRID_SIZE = 18;
  const START_INTERVAL_MS = 160;
  const MIN_INTERVAL_MS = 75;
  const SPEEDUP_PER_FOOD = 4;
  const POINTS_PER_FOOD = 10;

  // ---- Theme (night mode) -----------------------------------------------------
  const THEME_KEY = "nowak-snake-theme";
  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    draw(); // re-render the canvas immediately with the new palette
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
      applyTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  // ---- Screens --------------------------------------------------------------
  const screens = {
    start: document.getElementById("screen-start"),
    game: document.getElementById("screen-game"),
    calculating: document.getElementById("screen-calculating"),
    gameover: document.getElementById("screen-gameover")
  };
  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      screens[key].classList.toggle("active", key === name);
    });
  }

  // ---- Score tiers (image shown at game-over, per final score bracket) --------
  // Each bracket has 2 reaction images; one is picked at random on reveal.
  // Boundaries keep the original 7-tier shape (narrow bands early, wider
  // toward the top), rescaled so 400 is the practical ceiling.
  const CALCULATING_DELAY_MS = 1300;
  const SCORE_TIERS = [
    { min: 0, max: 19, images: ["assets/score-tiers/0-19-1.png", "assets/score-tiers/0-19-2.png"] },
    { min: 20, max: 59, images: ["assets/score-tiers/20-59-1.png", "assets/score-tiers/20-59-2.png"] },
    { min: 60, max: 99, images: ["assets/score-tiers/60-99-1.png", "assets/score-tiers/60-99-2.png"] },
    { min: 100, max: 199, images: ["assets/score-tiers/100-199-1.png", "assets/score-tiers/100-199-2.png"] },
    { min: 200, max: 299, images: ["assets/score-tiers/200-299-1.png", "assets/score-tiers/200-299-2.png"] },
    { min: 300, max: 399, images: ["assets/score-tiers/300-399-1.png", "assets/score-tiers/300-399-2.png"] },
    { min: 400, max: Infinity, images: ["assets/score-tiers/400-plus-1.png", "assets/score-tiers/400-plus-2.png"] }
  ];
  function getScoreTierImage(finalScore) {
    const tier = SCORE_TIERS.find((t) => finalScore >= t.min && finalScore <= t.max) || SCORE_TIERS[0];
    const images = tier.images;
    return images[Math.floor(Math.random() * images.length)];
  }

  // ---- Nickname ---------------------------------------------------------------
  let nickname = "";
  const nicknameInput = document.getElementById("nicknameInput");
  const nicknameError = document.getElementById("nicknameError");

  // ---- Canvas / rendering ------------------------------------------------------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const canvasWrap = document.querySelector(".canvas-wrap");
  const startOverlay = document.getElementById("startOverlay");
  let cellSize = 0;

  function resizeCanvas() {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cellSize = rect.width / GRID_SIZE;
    draw();
  }
  window.addEventListener("resize", () => {
    if (screens.game.classList.contains("active")) resizeCanvas();
  });

  // ---- Game state ---------------------------------------------------------------
  let snake, direction, nextDirection, food, score, best, tickMs, timerId, running, started;

  function resetState() {
    const mid = Math.floor(GRID_SIZE / 2);
    snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    tickMs = START_INTERVAL_MS;
    running = false;
    started = false;
    placeFood();
    document.getElementById("scoreValue").textContent = "0";
    document.getElementById("bestValue").textContent = String(best || 0);
    startOverlay.hidden = false;
  }

  function placeFood() {
    let candidate;
    do {
      candidate = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (snake.some((s) => s.x === candidate.x && s.y === candidate.y));
    food = candidate;
  }

  function setDirection(dx, dy) {
    // Ignore direct reversals (can't turn 180 into your own neck).
    if (dx === -direction.x && dy === -direction.y) return;
    nextDirection = { x: dx, y: dy };
    if (!started) startRun();
  }

  function startRun() {
    started = true;
    running = true;
    startOverlay.hidden = true;
    clearInterval(timerId);
    timerId = setInterval(tick, tickMs);
  }

  function restartTimerAtCurrentSpeed() {
    clearInterval(timerId);
    timerId = setInterval(tick, tickMs);
  }

  function tick() {
    direction = nextDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    const hitWall = head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      gameOver();
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += POINTS_PER_FOOD;
      document.getElementById("scoreValue").textContent = String(score);
      if (score > (best || 0)) {
        best = score;
        document.getElementById("bestValue").textContent = String(best);
      }
      placeFood();
      tickMs = Math.max(MIN_INTERVAL_MS, START_INTERVAL_MS - Math.floor(score / POINTS_PER_FOOD) * SPEEDUP_PER_FOOD);
      restartTimerAtCurrentSpeed();
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    if (!cellSize) return;
    const w = GRID_SIZE * cellSize;
    ctx.clearRect(0, 0, w, w);

    // subtle grid
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.07)" : "rgba(24,90,125,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, w);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(w, i * cellSize);
      ctx.stroke();
    }

    // food (tooth emoji, on brand with the rest of the newsletter)
    ctx.font = `${Math.floor(cellSize * 0.85)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🦷", (food.x + 0.5) * cellSize, (food.y + 0.55) * cellSize);

    // snake (brighter head in dark mode so it stays visible against a near-black canvas)
    snake.forEach((seg, i) => {
      const pad = cellSize * 0.08;
      ctx.fillStyle = i === 0 ? (isDark ? "#ffdd00" : "#185a7d") : "#238dc1";
      roundRect(ctx, seg.x * cellSize + pad, seg.y * cellSize + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.25);
      ctx.fill();
    });
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function gameOver() {
    running = false;
    clearInterval(timerId);

    const finalScore = score;
    const tierImage = getScoreTierImage(finalScore);
    document.getElementById("tierImageCalculating").src = tierImage;
    submitScore(finalScore);

    showScreen("calculating");
    setTimeout(() => {
      document.getElementById("tierImageGameover").src = tierImage;
      document.getElementById("finalScoreText").textContent = `${nickname} scored ${finalScore} points!`;
      document.getElementById("shareStatusText").textContent = "";
      showScreen("gameover");
      renderLeaderboard(document.getElementById("gameoverLeaderboardList"), finalScore);
    }, CALCULATING_DELAY_MS);
  }

  // ---- Leaderboard --------------------------------------------------------------
  function submitScore(finalScore) {
    const url = window.GAME_CONFIG && window.GAME_CONFIG.LEADERBOARD_URL;
    const statusEl = document.getElementById("submitStatusText");
    if (!url) {
      statusEl.textContent = "";
      return;
    }
    statusEl.textContent = "Saving your score…";
    try {
      fetch(url, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ nickname: nickname, score: finalScore })
      }).then(() => {
        statusEl.textContent = "Score saved!";
      }, () => {
        statusEl.textContent = "";
      });
    } catch (e) {
      statusEl.textContent = "";
    }
  }

  function fetchLeaderboard() {
    const url = window.GAME_CONFIG && window.GAME_CONFIG.LEADERBOARD_URL;
    if (!url) return Promise.resolve([]);
    return fetch(url)
      .then((r) => r.json())
      .then((data) => (data && data.leaderboard) || [])
      .catch(() => []);
  }

  function setEmptyMessage(listEl, text) {
    listEl.textContent = "";
    const div = document.createElement("div");
    div.className = "lb-empty";
    div.textContent = text;
    listEl.appendChild(div);
  }

  function renderLeaderboard(listEl, highlightScore) {
    setEmptyMessage(listEl, "Loading…");
    fetchLeaderboard().then((entries) => {
      if (!window.GAME_CONFIG || !window.GAME_CONFIG.LEADERBOARD_URL) {
        setEmptyMessage(listEl, "Leaderboard isn't connected yet.");
        return;
      }
      if (!entries.length) {
        setEmptyMessage(listEl, "No scores yet — be the first!");
        return;
      }
      listEl.textContent = "";
      entries.forEach((entry, i) => {
        const entryScore = Number(entry.score) || 0;
        const isMe = entry.nickname === nickname && entryScore === highlightScore;

        const row = document.createElement("div");
        row.className = "lb-row" + (isMe ? " lb-me" : "");

        const rank = document.createElement("div");
        rank.className = "lb-rank";
        rank.textContent = String(i + 1);

        const name = document.createElement("div");
        name.className = "lb-name";
        name.textContent = String(entry.nickname);

        const scoreEl = document.createElement("div");
        scoreEl.className = "lb-score";
        scoreEl.textContent = String(entryScore);

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(scoreEl);
        listEl.appendChild(row);
      });
    });
  }

  // ---- Share result -----------------------------------------------------------------
  // Composites the revealed tier image with the player's score into one PNG,
  // then hands it to the Web Share sheet (mobile) or triggers a download (desktop).
  const shareResultBtn = document.getElementById("shareResultBtn");
  const shareStatusText = document.getElementById("shareStatusText");

  function loadImageEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function buildShareCanvas(finalScore) {
    const tierImg = document.getElementById("tierImageGameover");
    const srcImg = await loadImageEl(tierImg.src);

    const W = 800;
    const IMG_H = 800;
    const TEXT_H = 190;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = IMG_H + TEXT_H;
    const cctx = canvas.getContext("2d");

    cctx.fillStyle = "#185a7d";
    cctx.fillRect(0, 0, W, canvas.height);

    // cover-fit the tier image into the top square
    const scale = Math.max(W / srcImg.width, IMG_H / srcImg.height);
    const sw = W / scale;
    const sh = IMG_H / scale;
    const sx = (srcImg.width - sw) / 2;
    const sy = (srcImg.height - sh) / 2;
    cctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, W, IMG_H);

    cctx.fillStyle = "#ffdd00";
    cctx.fillRect(0, IMG_H, W, 6);

    try {
      await Promise.all([
        document.fonts.load('900 48px Roboto'),
        document.fonts.load('700 26px Roboto')
      ]);
    } catch (e) { /* fall back to default font if webfont load fails */ }

    cctx.textAlign = "center";
    cctx.fillStyle = "#ffffff";
    cctx.font = "900 48px Roboto, sans-serif";
    cctx.fillText(`${nickname} scored ${finalScore} points!`, W / 2, IMG_H + 85, W - 60);

    cctx.font = "700 26px Roboto, sans-serif";
    cctx.fillStyle = "#ffdd00";
    cctx.fillText("Nowak Snake Challenge — The Nowak Insider", W / 2, IMG_H + 135, W - 60);

    return canvas;
  }

  async function shareResult() {
    const finalScore = score;
    shareResultBtn.disabled = true;
    shareStatusText.textContent = "Preparing image…";
    try {
      const canvas = await buildShareCanvas(finalScore);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not create image.");

      const fileName = `nowak-snake-${finalScore}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        shareStatusText.textContent = "";
        await navigator.share({
          files: [file],
          title: "Nowak Snake Challenge",
          text: `${nickname} scored ${finalScore} points on the Nowak Snake Challenge!`
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        shareStatusText.textContent = "Image downloaded!";
      }
    } catch (e) {
      if (e && e.name !== "AbortError") {
        shareStatusText.textContent = "Couldn't create the share image.";
      } else {
        shareStatusText.textContent = "";
      }
    } finally {
      shareResultBtn.disabled = false;
    }
  }

  shareResultBtn.addEventListener("click", shareResult);

  // ---- Input ----------------------------------------------------------------------
  document.addEventListener("keydown", (e) => {
    if (!screens.game.classList.contains("active")) return;
    const map = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
      ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
    };
    if (map[e.key]) {
      e.preventDefault();
      setDirection(map[e.key][0], map[e.key][1]);
    }
  });

  document.getElementById("btnUp").addEventListener("click", () => setDirection(0, -1));
  document.getElementById("btnDown").addEventListener("click", () => setDirection(0, 1));
  document.getElementById("btnLeft").addEventListener("click", () => setDirection(-1, 0));
  document.getElementById("btnRight").addEventListener("click", () => setDirection(1, 0));

  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const THRESHOLD = 18;
    if (Math.max(absX, absY) < THRESHOLD) { touchStart = null; return; }
    if (absX > absY) {
      setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      setDirection(0, dy > 0 ? 1 : -1);
    }
    touchStart = null;
  }, { passive: true });

  // ---- Flow -------------------------------------------------------------------------
  function startGame() {
    const value = nicknameInput.value.trim();
    if (!value) {
      nicknameError.classList.add("visible");
      nicknameInput.focus();
      return;
    }
    nickname = value;
    nicknameError.classList.remove("visible");
    best = best || 0;
    resetState();
    showScreen("game");
    requestAnimationFrame(resizeCanvas);
  }

  document.getElementById("playBtn").addEventListener("click", startGame);
  nicknameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
  });

  document.getElementById("showLeaderboardBtn").addEventListener("click", () => {
    const panel = document.getElementById("startLeaderboardPanel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      renderLeaderboard(document.getElementById("startLeaderboardList"), null);
    }
  });

  document.getElementById("playAgainBtn").addEventListener("click", () => {
    resetState();
    showScreen("game");
    requestAnimationFrame(resizeCanvas);
  });

  document.getElementById("backToStartBtn").addEventListener("click", () => {
    showScreen("start");
  });

  initTheme();
})();
