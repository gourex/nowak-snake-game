(function () {
  const GRID_SIZE = 18;
  const START_INTERVAL_MS = 160;
  const MIN_INTERVAL_MS = 75;
  const SPEEDUP_PER_FOOD = 4;
  const POINTS_PER_FOOD = 10;

  // ---- Screens --------------------------------------------------------------
  const screens = {
    start: document.getElementById("screen-start"),
    game: document.getElementById("screen-game"),
    gameover: document.getElementById("screen-gameover")
  };
  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      screens[key].classList.toggle("active", key === name);
    });
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
    ctx.strokeStyle = "rgba(24,90,125,0.06)";
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

    // snake
    snake.forEach((seg, i) => {
      const pad = cellSize * 0.08;
      ctx.fillStyle = i === 0 ? "#185a7d" : "#238dc1";
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
    showScreen("gameover");
    document.getElementById("finalScoreText").textContent = `${nickname} scored ${score} points!`;
    submitScore(score);
    renderLeaderboard(document.getElementById("gameoverLeaderboardList"), score);
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
})();
