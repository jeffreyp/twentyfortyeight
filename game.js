(function () {
  "use strict";

  var SIZE = 4;
  var TRANSITION_MS = 130;
  var BEST_SCORE_KEY = "2048-best-score";

  var els = {
    gridBackground: document.getElementById("grid-background"),
    tileContainer: document.getElementById("tile-container"),
    gameContainer: document.getElementById("game-container"),
    scoreEl: document.getElementById("score"),
    bestScoreEl: document.getElementById("best-score"),
    message: document.getElementById("game-message"),
    messageText: document.getElementById("game-message-text"),
    newGameBtn: document.getElementById("new-game"),
    retryBtn: document.getElementById("retry-button"),
    keepPlayingBtn: document.getElementById("keep-playing-button"),
  };

  var tiles = [];
  var tileEls = new Map();
  var nextId = 1;
  var score = 0;
  var bestScore = 0;
  var won = false;
  var keepPlaying = false;
  var gameOver = false;
  var animating = false;

  function getBestScore() {
    try {
      return parseInt(localStorage.getItem(BEST_SCORE_KEY), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function setBestScore(value) {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(value));
    } catch (e) {
      /* ignore (private mode / storage disabled) */
    }
  }

  function buildBackground() {
    els.gridBackground.innerHTML = "";
    for (var i = 0; i < SIZE * SIZE; i++) {
      var cell = document.createElement("div");
      cell.className = "grid-cell";
      els.gridBackground.appendChild(cell);
    }
  }

  function updateGeometry() {
    var cells = els.gridBackground.children;
    if (cells.length < SIZE + 1) return;
    var first = cells[0].getBoundingClientRect();
    var second = cells[1].getBoundingClientRect();
    var rowSecond = cells[SIZE].getBoundingClientRect();
    var cellTotal = second.left - first.left;
    var rowTotal = rowSecond.top - first.top;
    els.tileContainer.style.setProperty("--cell-total", cellTotal + "px");
    els.tileContainer.style.setProperty("--tile-size", first.width + "px");
    if (Math.abs(cellTotal - rowTotal) > 0.5) {
      els.tileContainer.style.setProperty("--cell-total", Math.min(cellTotal, rowTotal) + "px");
    }
  }

  function withinBounds(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function tileAt(row, col) {
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (!t.removed && t.row === row && t.col === col) return t;
    }
    return null;
  }

  function emptyCells() {
    var empties = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (!tileAt(r, c)) empties.push({ row: r, col: c });
      }
    }
    return empties;
  }

  function addRandomTile() {
    var empties = emptyCells();
    if (empties.length === 0) return;
    var spot = empties[Math.floor(Math.random() * empties.length)];
    var value = Math.random() < 0.9 ? 2 : 4;
    tiles.push({
      id: nextId++,
      row: spot.row,
      col: spot.col,
      value: value,
      isNew: true,
      mergedFrom: null,
      mergingInto: null,
      pendingValue: null,
      removed: false,
      popped: false,
    });
  }

  function getVector(direction) {
    switch (direction) {
      case "up": return { x: 0, y: -1 };
      case "right": return { x: 1, y: 0 };
      case "down": return { x: 0, y: 1 };
      case "left": return { x: -1, y: 0 };
    }
  }

  function buildTraversals(vector) {
    var rows = [0, 1, 2, 3];
    var cols = [0, 1, 2, 3];
    if (vector.y === 1) rows.reverse();
    if (vector.x === 1) cols.reverse();
    return { rows: rows, cols: cols };
  }

  function findFarthestPosition(row, col, vector) {
    var prevRow = row, prevCol = col;
    var nextRow = row + vector.y, nextCol = col + vector.x;
    while (withinBounds(nextRow, nextCol) && !tileAt(nextRow, nextCol)) {
      prevRow = nextRow;
      prevCol = nextCol;
      nextRow += vector.y;
      nextCol += vector.x;
    }
    return {
      farthest: { row: prevRow, col: prevCol },
      next: withinBounds(nextRow, nextCol) ? { row: nextRow, col: nextCol } : null,
    };
  }

  function move(direction) {
    if (animating || gameOver) return;
    if (won && !keepPlaying) return;

    var vector = getVector(direction);
    var traversals = buildTraversals(vector);
    var moved = false;
    var scoreGained = 0;
    var reachedWin = false;

    tiles.forEach(function (t) {
      t.mergedFrom = null;
    });

    traversals.rows.forEach(function (row) {
      traversals.cols.forEach(function (col) {
        var tile = tileAt(row, col);
        if (!tile) return;

        var positions = findFarthestPosition(row, col, vector);
        var target = positions.next ? tileAt(positions.next.row, positions.next.col) : null;

        if (target && target !== tile && target.value === tile.value && !target.mergedFrom && !target.mergingInto) {
          tile.row = positions.next.row;
          tile.col = positions.next.col;
          tile.mergingInto = target.id;
          target.mergedFrom = tile.id;
          target.pendingValue = target.value * 2;
          scoreGained += target.pendingValue;
          if (target.pendingValue === 2048) reachedWin = true;
          moved = true;
        } else if (positions.farthest.row !== row || positions.farthest.col !== col) {
          tile.row = positions.farthest.row;
          tile.col = positions.farthest.col;
          moved = true;
        }
      });
    });

    if (!moved) return;

    animating = true;
    render();

    window.setTimeout(function () {
      tiles.forEach(function (t) {
        if (t.mergingInto) t.removed = true;
      });
      tiles.forEach(function (t) {
        if (t.pendingValue) {
          t.value = t.pendingValue;
          t.pendingValue = null;
          t.popped = true;
        }
        t.mergedFrom = null;
        t.mergingInto = null;
      });
      tiles = tiles.filter(function (t) {
        return !t.removed;
      });

      addRandomTile();
      score += scoreGained;
      if (score > bestScore) {
        bestScore = score;
        setBestScore(bestScore);
      }
      updateScores();
      render();
      animating = false;

      if (reachedWin && !won) {
        won = true;
        showMessage("You Win!", "game-won");
      } else {
        checkGameOver();
      }
    }, TRANSITION_MS);
  }

  function checkGameOver() {
    if (emptyCells().length > 0) return;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var tile = tileAt(r, c);
        if (!tile) continue;
        var right = tileAt(r, c + 1);
        var down = tileAt(r + 1, c);
        if ((right && right.value === tile.value) || (down && down.value === tile.value)) {
          return;
        }
      }
    }
    gameOver = true;
    showMessage("Game Over!", "game-over");
  }

  function showMessage(text, cls) {
    els.messageText.textContent = text;
    els.message.classList.remove("game-won", "game-over");
    els.message.classList.add("active", cls);
  }

  function hideMessage() {
    els.message.classList.remove("active", "game-won", "game-over");
  }

  function updateScores() {
    els.scoreEl.textContent = String(score);
    els.bestScoreEl.textContent = String(bestScore);
  }

  function tileClassForValue(value) {
    return value <= 2048 ? "tile-" + value : "tile-super";
  }

  function render() {
    var seen = new Set();

    tiles.forEach(function (tile) {
      if (tile.removed) return;
      seen.add(tile.id);
      var el = tileEls.get(tile.id);

      if (!el) {
        el = document.createElement("div");
        el.className = "tile " + tileClassForValue(tile.value);
        var inner = document.createElement("div");
        inner.className = "tile-inner";
        inner.textContent = String(tile.value);
        el.appendChild(inner);
        els.tileContainer.appendChild(el);
        tileEls.set(tile.id, el);

        el.style.setProperty("--row", tile.row);
        el.style.setProperty("--col", tile.col);

        if (tile.isNew) {
          inner.classList.add("appear");
          tile.isNew = false;
        }
      } else {
        el.style.setProperty("--row", tile.row);
        el.style.setProperty("--col", tile.col);

        var innerEl = el.querySelector(".tile-inner");
        if (tile.popped) {
          innerEl.textContent = String(tile.value);
          el.className = "tile " + tileClassForValue(tile.value);
          innerEl.classList.remove("pop");
          void innerEl.offsetWidth;
          innerEl.classList.add("pop");
          tile.popped = false;
        }
      }
    });

    tileEls.forEach(function (el, id) {
      if (!seen.has(id)) {
        el.remove();
        tileEls.delete(id);
      }
    });
  }

  function newGame() {
    tiles = [];
    tileEls.forEach(function (el) {
      el.remove();
    });
    tileEls.clear();
    nextId = 1;
    score = 0;
    won = false;
    keepPlaying = false;
    gameOver = false;
    animating = false;
    hideMessage();
    addRandomTile();
    addRandomTile();
    updateScores();
    render();
  }

  var KEY_DIRECTIONS = {
    ArrowUp: "up",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowLeft: "left",
    w: "up",
    W: "up",
    d: "right",
    D: "right",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
  };

  document.addEventListener("keydown", function (e) {
    var direction = KEY_DIRECTIONS[e.key];
    if (!direction) return;
    e.preventDefault();
    move(direction);
  });

  var touchStartX = null;
  var touchStartY = null;
  var SWIPE_THRESHOLD = 20;

  els.gameContainer.addEventListener(
    "touchstart",
    function (e) {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );

  els.gameContainer.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches.length === 1) e.preventDefault();
    },
    { passive: false }
  );

  els.gameContainer.addEventListener(
    "touchend",
    function (e) {
      if (touchStartX === null) return;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - touchStartX;
      var dy = touch.clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;

      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        move(dx > 0 ? "right" : "left");
      } else {
        move(dy > 0 ? "down" : "up");
      }
    },
    { passive: true }
  );

  els.newGameBtn.addEventListener("click", newGame);
  els.retryBtn.addEventListener("click", newGame);
  els.keepPlayingBtn.addEventListener("click", function () {
    keepPlaying = true;
    hideMessage();
  });

  window.addEventListener("resize", updateGeometry);

  buildBackground();
  updateGeometry();
  bestScore = getBestScore();
  updateScores();
  newGame();

  if (window.ResizeObserver) {
    new ResizeObserver(updateGeometry).observe(els.gameContainer);
  }
})();
