const KEY_TD_OPEN = "delve_td_open";

const PATH_POINTS = [
  { x: 40, y: 230 },
  { x: 170, y: 230 },
  { x: 170, y: 100 },
  { x: 350, y: 100 },
  { x: 350, y: 300 },
  { x: 540, y: 300 },
  { x: 540, y: 160 },
  { x: 760, y: 160 },
];

const TOWER_SLOTS = [
  { x: 110, y: 150 },
  { x: 240, y: 220 },
  { x: 275, y: 55 },
  { x: 420, y: 210 },
  { x: 470, y: 340 },
  { x: 620, y: 250 },
  { x: 675, y: 95 },
  { x: 730, y: 265 },
];

const TOWER_TYPES = {
  bolt: {
    id: "bolt",
    label: "Болтовая",
    cost: 90,
    damage: 18,
    range: 110,
    cooldown: 0.55,
    color: "#8cc7ff",
  },
  cannon: {
    id: "cannon",
    label: "Пушка",
    cost: 160,
    damage: 34,
    range: 95,
    cooldown: 1.05,
    color: "#f6b36b",
  },
  frost: {
    id: "frost",
    label: "Мороз",
    cost: 145,
    damage: 12,
    range: 115,
    cooldown: 0.75,
    slowMul: 0.62,
    slowDuration: 1.4,
    color: "#87f2ff",
  },
};

const state = {
  mounted: false,
  running: false,
  selectedTowerId: "bolt",
  wave: 0,
  baseHp: 20,
  enemies: [],
  towers: [],
  bullets: [],
  spawnQueue: 0,
  spawnCd: 0,
  spawnTick: 0.55,
  waveActive: false,
  waveTickets: 0,
  totalTicketsSession: 0,
  speed: 1,
  runId: 0,
  raf: null,
  lastTs: 0,
  messages: [],
};

let canvas = null;
let ctx = null;
let onBackCb = null;
let spendGoldCb = null;
let getGoldCb = null;
let addTicketsCb = null;
let getTicketsCb = null;
let onStateChangedCb = null;

function notifyStateChanged() {
  if (typeof onStateChangedCb === "function") onStateChangedCb();
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function waveEnemyCount(wave) {
  return 7 + wave * 2;
}

function waveEnemyHp(wave) {
  return Math.round(48 + wave * 22 + Math.pow(wave, 1.12) * 6);
}

function waveEnemySpeed(wave) {
  return 44 + Math.min(72, wave * 2.5);
}

function ticketsForWave(wave) {
  return 1 + Math.floor(wave / 4);
}

function pushMessage(line, tone = "neutral") {
  const ts = Date.now();
  state.messages.unshift({ line, tone, ts });
  if (state.messages.length > 6) state.messages.length = 6;
  renderHud();
}

function pathPoint(progress) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    const len = distance(a, b);
    segments.push({ a, b, len });
    total += len;
  }
  const target = progress * total;
  let acc = 0;
  for (const seg of segments) {
    if (acc + seg.len >= target) {
      const t = (target - acc) / seg.len;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t,
      };
    }
    acc += seg.len;
  }
  return PATH_POINTS[PATH_POINTS.length - 1];
}

function spawnEnemy() {
  state.enemies.push({
    progress: 0,
    hp: waveEnemyHp(state.wave),
    maxHp: waveEnemyHp(state.wave),
    speed: waveEnemySpeed(state.wave),
    slowLeft: 0,
    slowMul: 1,
  });
}

function getTowerUpgradeCost(tower) {
  const type = TOWER_TYPES[tower.typeId];
  return Math.round(type.cost * (0.75 + tower.level * 0.65));
}

function canSpendGold(amount) {
  if (typeof spendGoldCb !== "function") return false;
  return spendGoldCb(amount);
}

function getGold() {
  return typeof getGoldCb === "function" ? getGoldCb() : 0;
}

function getTickets() {
  return typeof getTicketsCb === "function" ? getTicketsCb() : 0;
}

function addTickets(amount) {
  if (amount <= 0) return;
  if (typeof addTicketsCb === "function") addTicketsCb(amount);
}

function startNextWave() {
  if (state.baseHp <= 0) {
    pushMessage("База разрушена. Начни новую серию.", "bad");
    return;
  }
  if (state.waveActive) return;
  state.wave += 1;
  state.waveActive = true;
  state.spawnQueue = waveEnemyCount(state.wave);
  state.spawnCd = 0;
  state.waveTickets = ticketsForWave(state.wave);
  pushMessage(`Волна ${state.wave}: врагов ${state.spawnQueue}`, "good");
  renderHud();
}

function finishWave() {
  state.waveActive = false;
  if (state.waveTickets > 0) {
    addTickets(state.waveTickets);
    state.totalTicketsSession += state.waveTickets;
    pushMessage(`Волна ${state.wave} очищена: +${state.waveTickets} билет(ов).`, "good");
    notifyStateChanged();
  }
  renderHud();
}

function resetSession() {
  state.wave = 0;
  state.baseHp = 20;
  state.enemies = [];
  state.bullets = [];
  state.towers = [];
  state.spawnQueue = 0;
  state.waveActive = false;
  state.waveTickets = 0;
  state.totalTicketsSession = 0;
  state.messages = [];
  pushMessage("Новая серия TD запущена.", "neutral");
}

function handleSlotClick(slotIndex) {
  const tower = state.towers.find((t) => t.slotIndex === slotIndex);
  if (!tower) {
    const type = TOWER_TYPES[state.selectedTowerId];
    if (!type) return;
    if (!canSpendGold(type.cost)) {
      pushMessage(`Не хватает золота: нужно ${type.cost}.`, "bad");
      return;
    }
    state.towers.push({
      slotIndex,
      typeId: type.id,
      level: 1,
      cooldownLeft: 0,
    });
    pushMessage(`${type.label} построена за ${type.cost} золота.`, "neutral");
    notifyStateChanged();
    renderHud();
    return;
  }

  const cost = getTowerUpgradeCost(tower);
  if (!canSpendGold(cost)) {
    pushMessage(`Не хватает золота на апгрейд (${cost}).`, "bad");
    return;
  }
  tower.level += 1;
  pushMessage(`Башня улучшена до уровня ${tower.level}.`, "neutral");
  notifyStateChanged();
  renderHud();
}

function tryHitSlot(x, y) {
  for (let i = 0; i < TOWER_SLOTS.length; i += 1) {
    if (distance({ x, y }, TOWER_SLOTS[i]) <= 18) {
      handleSlotClick(i);
      return;
    }
  }
}

function advanceEnemies(dt) {
  const end = PATH_POINTS[PATH_POINTS.length - 1];
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    const effectiveSpeed = e.speed * (e.slowLeft > 0 ? e.slowMul : 1);
    const pathLen = 1070;
    e.progress += (effectiveSpeed * dt * state.speed) / pathLen;
    e.slowLeft = Math.max(0, e.slowLeft - dt * state.speed);
    if (e.progress >= 1) {
      state.enemies.splice(i, 1);
      state.baseHp -= 1;
      pushMessage("Враг прорвался: -1 прочность базы.", "bad");
      if (state.baseHp <= 0) {
        state.waveActive = false;
        state.spawnQueue = 0;
        pushMessage("Серия окончена. Запусти новую волну после перестройки.", "bad");
      }
    }
    const pos = pathPoint(clamp(e.progress, 0, 1));
    e.x = pos.x;
    e.y = pos.y;
    e.atEnd = distance(pos, end) < 2;
  }
}

function acquireTarget(tower, range) {
  const slot = TOWER_SLOTS[tower.slotIndex];
  let best = null;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (distance(slot, enemy) > range) continue;
    if (!best || enemy.progress > best.progress) best = enemy;
  }
  return best;
}

function updateTowers(dt) {
  for (const tower of state.towers) {
    const type = TOWER_TYPES[tower.typeId];
    const lvlMul = 1 + (tower.level - 1) * 0.42;
    const range = type.range + (tower.level - 1) * 7;
    const cd = Math.max(0.12, type.cooldown / (1 + (tower.level - 1) * 0.08));
    tower.cooldownLeft = Math.max(0, tower.cooldownLeft - dt * state.speed);
    if (tower.cooldownLeft > 0) continue;

    const target = acquireTarget(tower, range);
    if (!target) continue;

    const slot = TOWER_SLOTS[tower.slotIndex];
    const damage = type.damage * lvlMul;

    if (type.id === "cannon") {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        if (distance(enemy, target) <= 42 + (tower.level - 1) * 2) {
          enemy.hp -= damage;
        }
      }
    } else {
      target.hp -= damage;
    }

    if (type.slowMul) {
      target.slowMul = Math.min(target.slowMul, type.slowMul);
      target.slowLeft = Math.max(target.slowLeft, type.slowDuration * lvlMul * 0.6);
    }

    state.bullets.push({
      x1: slot.x,
      y1: slot.y,
      x2: target.x,
      y2: target.y,
      t: 0.12,
      color: type.color,
    });

    tower.cooldownLeft = cd;
  }

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    if (state.enemies[i].hp <= 0) state.enemies.splice(i, 1);
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    state.bullets[i].t -= dt * state.speed;
    if (state.bullets[i].t <= 0) state.bullets.splice(i, 1);
  }
}

function updateSpawning(dt) {
  if (!state.waveActive || state.baseHp <= 0) return;
  state.spawnCd -= dt * state.speed;
  while (state.spawnQueue > 0 && state.spawnCd <= 0) {
    spawnEnemy();
    state.spawnQueue -= 1;
    state.spawnCd += state.spawnTick;
  }

  if (state.spawnQueue <= 0 && state.enemies.length === 0) {
    finishWave();
  }
}

function drawPath() {
  if (!ctx) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#2a4252";
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
  for (let i = 1; i < PATH_POINTS.length; i += 1) {
    ctx.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
  }
  ctx.stroke();

  ctx.strokeStyle = "#6f9db6";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function drawSlots() {
  for (let i = 0; i < TOWER_SLOTS.length; i += 1) {
    const slot = TOWER_SLOTS[i];
    const tower = state.towers.find((t) => t.slotIndex === i);
    ctx.save();
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, 16, 0, Math.PI * 2);
    if (!tower) {
      ctx.fillStyle = "#183246";
      ctx.strokeStyle = "#4f7b96";
      ctx.fill();
      ctx.stroke();
    } else {
      const type = TOWER_TYPES[tower.typeId];
      ctx.fillStyle = type.color;
      ctx.strokeStyle = "#0b1d29";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0d1720";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(tower.level), slot.x, slot.y + 4);
    }
    ctx.restore();
  }
}

function drawEnemies() {
  for (const e of state.enemies) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#ef6868";
    ctx.fill();

    const hpPct = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(e.x - 12, e.y - 18, 24, 4);
    ctx.fillStyle = "#87e38d";
    ctx.fillRect(e.x - 12, e.y - 18, 24 * hpPct, 4);
    ctx.restore();
  }
}

function drawBullets() {
  for (const b of state.bullets) {
    ctx.save();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.restore();
  }
}

function renderCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0c1a25";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPath();
  drawSlots();
  drawEnemies();
  drawBullets();
}

function renderHud() {
  const waveEl = document.getElementById("td-wave");
  const hpEl = document.getElementById("td-base-hp");
  const goldEl = document.getElementById("td-gold");
  const ticketsEl = document.getElementById("td-tickets");
  const queueEl = document.getElementById("td-queue");
  const runEl = document.getElementById("td-run-tickets");
  const logEl = document.getElementById("td-log");

  if (waveEl) waveEl.textContent = String(state.wave);
  if (hpEl) hpEl.textContent = String(state.baseHp);
  if (goldEl) goldEl.textContent = String(getGold());
  if (ticketsEl) ticketsEl.textContent = String(getTickets());
  if (queueEl) queueEl.textContent = String(state.spawnQueue + state.enemies.length);
  if (runEl) runEl.textContent = String(state.totalTicketsSession);

  if (logEl) {
    logEl.innerHTML = state.messages
      .map((m) => `<div class="td-log-line td-${m.tone}">${m.line}</div>`)
      .join("");
  }

  const selectedText = document.getElementById("td-selected-tower");
  if (selectedText) {
    const type = TOWER_TYPES[state.selectedTowerId];
    selectedText.textContent = type ? `${type.label} (${type.cost} золота)` : "—";
  }
}

function frame(ts) {
  if (!state.running) return;
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(0.05, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  updateSpawning(dt);
  advanceEnemies(dt);
  updateTowers(dt);
  updateBullets(dt);
  renderCanvas();

  state.raf = requestAnimationFrame(frame);
}

function startLoop() {
  if (state.running) return;
  state.running = true;
  state.lastTs = 0;
  state.raf = requestAnimationFrame(frame);
}

function stopLoop() {
  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
}

function bindUi() {
  canvas = document.getElementById("td-canvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    tryHitSlot(x, y);
  });

  document.getElementById("td-start-wave")?.addEventListener("click", () => {
    startNextWave();
  });

  document.getElementById("td-reset-run")?.addEventListener("click", () => {
    resetSession();
    renderCanvas();
    renderHud();
  });

  document.getElementById("td-speed")?.addEventListener("click", () => {
    state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1;
    const btn = document.getElementById("td-speed");
    if (btn) btn.textContent = `Скорость x${state.speed}`;
  });

  document.querySelectorAll("[data-td-tower]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-td-tower");
      if (!TOWER_TYPES[id]) return;
      state.selectedTowerId = id;
      document.querySelectorAll("[data-td-tower]").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-td-tower") === id);
      });
      renderHud();
    });
  });

  document.getElementById("td-back")?.addEventListener("click", () => {
    if (typeof onBackCb === "function") onBackCb();
  });

  renderCanvas();
  renderHud();
}

export function buildTdScreen() {
  return `
  <div id="screen-td" class="screen">
    <div class="panel td-panel">
      <div class="panel-header"><span class="icon">🛡</span> ШАХТНЫЙ ПОЛИГОН TD</div>
      <div class="panel-body td-layout">
        <div class="td-top">
          <div>Волна: <strong id="td-wave">0</strong></div>
          <div>База: <strong id="td-base-hp">20</strong></div>
          <div>Золото: <strong id="td-gold">0</strong></div>
          <div>Билеты: <strong id="td-tickets">0</strong></div>
          <div>Врагов на поле: <strong id="td-queue">0</strong></div>
          <div>Билеты за серию: <strong id="td-run-tickets">0</strong></div>
        </div>

        <div class="td-main">
          <canvas id="td-canvas" width="800" height="380"></canvas>
          <div class="td-controls">
            <div class="td-control-block">
              <div class="td-title">Башни (тратят только золото)</div>
              <div class="td-btn-row">
                <button class="btn-primary active" data-td-tower="bolt">Болтовая (90)</button>
                <button class="btn-primary" data-td-tower="cannon">Пушка (160)</button>
                <button class="btn-primary" data-td-tower="frost">Мороз (145)</button>
              </div>
              <div class="td-sub">Выбрано: <span id="td-selected-tower">Болтовая (90 золота)</span></div>
              <div class="td-sub">Клик по точке: строить. Клик по башне: апгрейд.</div>
            </div>

            <div class="td-btn-row">
              <button class="btn-primary" id="td-start-wave">Старт волны</button>
              <button class="btn-primary" id="td-speed">Скорость x1</button>
              <button class="btn-danger" id="td-reset-run">Сброс серии</button>
              <button class="btn-primary" id="td-back">← Назад</button>
            </div>

            <div class="td-log" id="td-log"></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

export function initTdScreen({
  onBack,
  spendGold,
  getGold,
  addTickets,
  getTickets,
  onStateChanged,
}) {
  onBackCb = onBack;
  spendGoldCb = spendGold;
  getGoldCb = getGold;
  addTicketsCb = addTickets;
  getTicketsCb = getTickets;
  onStateChangedCb = onStateChanged;
  if (!state.mounted) {
    bindUi();
    state.mounted = true;
  }
  startLoop();
}

export function renderTdScreen() {
  renderCanvas();
  renderHud();
}

export function pauseTdScreen() {
  stopLoop();
}

export function resumeTdScreen() {
  startLoop();
}

export function isTdOpen() {
  return localStorage.getItem(KEY_TD_OPEN) === "1";
}

export function openTd() {
  localStorage.setItem(KEY_TD_OPEN, "1");
}

export function resetTd() {
  localStorage.removeItem(KEY_TD_OPEN);
}
