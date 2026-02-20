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

const TOWER_HIT_RADIUS = 16;
const TOWER_MIN_GAP = 34;
const MAP_PADDING = 18;

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

const WAVE_UPGRADES = [
  {
    id: "forge_damage",
    title: "Кузня Гильдии",
    desc: "Весь урон башен +15%",
    apply: (buffs) => {
      buffs.damageMult *= 1.15;
    },
  },
  {
    id: "clockwork_reload",
    title: "Часовой Механизм",
    desc: "Скорость перезарядки +12%",
    apply: (buffs) => {
      buffs.cooldownMult *= 0.88;
    },
  },
  {
    id: "scout_markers",
    title: "Метчики Разведки",
    desc: "Радиус башен +12px",
    apply: (buffs) => {
      buffs.rangeBonus += 12;
    },
  },
  {
    id: "stone_repair",
    title: "Каменная Латка",
    desc: "Прочность крепости +3",
    apply: (buffs, s) => {
      buffs.baseHpBonus += 3;
      s.baseHp += 3;
    },
  },
  {
    id: "bounty_writ",
    title: "Охотничья Грамота",
    desc: "Награда за волну: +1 билет",
    apply: (buffs) => {
      buffs.extraTickets += 1;
    },
  },
  {
    id: "frost_runes",
    title: "Руны Инея",
    desc: "Морозная башня сильнее замедляет",
    apply: (buffs) => {
      buffs.frostSlowBonus += 0.08;
      buffs.frostDurationBonus += 0.35;
    },
  },
];

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
  hoverPos: null,
  pendingChoices: null,
  buffs: null,
};

let canvas = null;
let ctx = null;
let onBackCb = null;
let spendGoldCb = null;
let getGoldCb = null;
let addTicketsCb = null;
let getTicketsCb = null;
let onStateChangedCb = null;
let toastTimer = null;

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
  showInfoToast(line, tone);
  renderHud();
}

function showInfoToast(line, tone = "neutral") {
  const toast = document.getElementById("td-float-toast");
  if (!toast) return;
  toast.className = `td-float-toast show tone-${tone}`;
  toast.textContent = line;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "td-float-toast";
  }, 2200);
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

function getTowerLevelStats(type, level = 1) {
  ensureBuffs();
  const lvlMul = 1 + (level - 1) * 0.42;
  return {
    damage: Math.round(type.damage * lvlMul * state.buffs.damageMult),
    range: Math.round(type.range + (level - 1) * 7 + state.buffs.rangeBonus),
    cooldown: Math.max(0.12, (type.cooldown / (1 + (level - 1) * 0.08)) * state.buffs.cooldownMult),
    special: type.slowMul
      ? `Замедление до ${Math.round(type.slowMul * 100)}% на ${type.slowDuration.toFixed(1)}с`
      : type.id === "cannon"
        ? "Урон по области"
        : "Фокус на одной цели",
  };
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

function ensureBuffs() {
  if (state.buffs) return;
  state.buffs = {
    damageMult: 1,
    cooldownMult: 1,
    rangeBonus: 0,
    extraTickets: 0,
    baseHpBonus: 0,
    frostSlowBonus: 0,
    frostDurationBonus: 0,
  };
}

function startNextWave() {
  ensureBuffs();
  if (state.baseHp <= 0) {
    pushMessage("База разрушена. Начни новую серию.", "bad");
    return;
  }
  if (state.pendingChoices?.length) {
    pushMessage("Выбери один из трех апгрейдов перед новой волной.", "neutral");
    showUpgradeChoicePanel();
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
  ensureBuffs();
  state.waveActive = false;
  const ticketReward = state.waveTickets + (state.buffs.extraTickets ?? 0);
  if (ticketReward > 0) {
    addTickets(ticketReward);
    state.totalTicketsSession += ticketReward;
    pushMessage(`Волна ${state.wave} очищена: +${ticketReward} билет(ов).`, "good");
    notifyStateChanged();
  }
  state.pendingChoices = pickUpgradeChoices();
  showUpgradeChoicePanel();
  renderHud();
}

function pickUpgradeChoices() {
  const pool = [...WAVE_UPGRADES];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function showUpgradeChoicePanel() {
  const panel = document.getElementById("td-upgrade-panel");
  const list = document.getElementById("td-upgrade-list");
  if (!panel || !list) return;
  const choices = state.pendingChoices ?? [];
  if (!choices.length) {
    panel.classList.remove("show");
    return;
  }
  list.innerHTML = choices
    .map(
      (u) => `
      <button class="td-upgrade-card" data-td-upgrade="${u.id}">
        <div class="td-upgrade-title">${u.title}</div>
        <div class="td-upgrade-desc">${u.desc}</div>
      </button>`,
    )
    .join("");

  list.querySelectorAll("[data-td-upgrade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-td-upgrade");
      const picked = choices.find((u) => u.id === id);
      if (!picked) return;
      picked.apply(state.buffs, state);
      state.pendingChoices = null;
      panel.classList.remove("show");
      pushMessage(`Выбран апгрейд: ${picked.title}.`, "good");
      renderHud();
    });
  });

  panel.classList.add("show");
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
  state.pendingChoices = null;
  state.buffs = {
    damageMult: 1,
    cooldownMult: 1,
    rangeBonus: 0,
    extraTickets: 0,
    baseHpBonus: 0,
    frostSlowBonus: 0,
    frostDurationBonus: 0,
  };
  pushMessage("Новая серия TD запущена.", "neutral");
  showUpgradeChoicePanel();
}

function getTowerAt(x, y) {
  return state.towers.find((t) => distance({ x, y }, t) <= TOWER_HIT_RADIUS) ?? null;
}

function canPlaceTowerAt(x, y) {
  if (
    x < MAP_PADDING ||
    y < MAP_PADDING ||
    x > 800 - MAP_PADDING ||
    y > 380 - MAP_PADDING
  ) {
    return false;
  }
  for (const tower of state.towers) {
    if (distance({ x, y }, tower) < TOWER_MIN_GAP) return false;
  }
  return true;
}

function handleCanvasClick(x, y) {
  const tower = getTowerAt(x, y);
  if (!tower) {
    const type = TOWER_TYPES[state.selectedTowerId];
    if (!type) return;
    if (!canPlaceTowerAt(x, y)) {
      pushMessage("Слишком близко к краю или другой башне. Выбери свободное место.", "bad");
      return;
    }
    if (!canSpendGold(type.cost)) {
      pushMessage(`Не хватает золота: нужно ${type.cost}.`, "bad");
      return;
    }
    state.towers.push({
      x,
      y,
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
  const nextCost = getTowerUpgradeCost(tower);
  pushMessage(`Башня улучшена до ур. ${tower.level}. След. апгрейд ${nextCost} золота.`, "neutral");
  notifyStateChanged();
  renderHud();
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
  let best = null;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (distance(tower, enemy) > range) continue;
    if (!best || enemy.progress > best.progress) best = enemy;
  }
  return best;
}

function updateTowers(dt) {
  ensureBuffs();
  for (const tower of state.towers) {
    const type = TOWER_TYPES[tower.typeId];
    const lvlMul = 1 + (tower.level - 1) * 0.42;
    const range = type.range + (tower.level - 1) * 7 + state.buffs.rangeBonus;
    const cd = Math.max(
      0.12,
      (type.cooldown / (1 + (tower.level - 1) * 0.08)) * state.buffs.cooldownMult,
    );
    tower.cooldownLeft = Math.max(0, tower.cooldownLeft - dt * state.speed);
    if (tower.cooldownLeft > 0) continue;

    const target = acquireTarget(tower, range);
    if (!target) continue;

    const damage = type.damage * lvlMul * state.buffs.damageMult;

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
      const boostedSlow = Math.max(0.25, type.slowMul - state.buffs.frostSlowBonus);
      target.slowMul = Math.min(target.slowMul, boostedSlow);
      target.slowLeft = Math.max(
        target.slowLeft,
        (type.slowDuration + state.buffs.frostDurationBonus) * lvlMul * 0.6,
      );
    }

    state.bullets.push({
      x1: tower.x,
      y1: tower.y,
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
  ctx.strokeStyle = "#3a2b1d";
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
  for (let i = 1; i < PATH_POINTS.length; i += 1) {
    ctx.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
  }
  ctx.stroke();

  ctx.strokeStyle = "#9f7746";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function drawTowers() {
  const selectedType = TOWER_TYPES[state.selectedTowerId];
  for (const tower of state.towers) {
    const type = TOWER_TYPES[tower.typeId];
    ctx.save();
    if (selectedType && tower.typeId === state.selectedTowerId) {
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.arc(tower.x, tower.y, selectedType.range, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(214, 173, 107, 0.24)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.arc(tower.x, tower.y, TOWER_HIT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = type.color;
    ctx.strokeStyle = "#0b1d29";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0d1720";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(tower.level), tower.x, tower.y + 4);
    ctx.restore();
  }

  if (!selectedType || !state.hoverPos) return;
  const valid = canPlaceTowerAt(state.hoverPos.x, state.hoverPos.y);
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([6, 6]);
  ctx.arc(state.hoverPos.x, state.hoverPos.y, selectedType.range, 0, Math.PI * 2);
  ctx.strokeStyle = valid ? "rgba(218, 176, 109, 0.28)" : "rgba(210, 118, 94, 0.24)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(state.hoverPos.x, state.hoverPos.y, TOWER_HIT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = valid ? "rgba(214, 168, 92, 0.32)" : "rgba(199, 106, 86, 0.35)";
  ctx.strokeStyle = valid ? "#d4a85c" : "#c96a56";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawEnemies() {
  for (const e of state.enemies) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#b45f42";
    ctx.fill();

    const hpPct = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(e.x - 12, e.y - 18, 24, 4);
    ctx.fillStyle = "#7fb46a";
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
  ctx.fillStyle = "#18120d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPath();
  drawTowers();
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
  const selectedNameEl = document.getElementById("td-selected-name");
  const selectedCostEl = document.getElementById("td-selected-cost");
  const selectedDamageEl = document.getElementById("td-selected-dmg");
  const selectedRangeEl = document.getElementById("td-selected-range");
  const selectedCdEl = document.getElementById("td-selected-cd");
  const selectedSpecialEl = document.getElementById("td-selected-special");
  const slotInfoEl = document.getElementById("td-slots-info");
  const buffsLineEl = document.getElementById("td-buffs-line");

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

  const selectedType = TOWER_TYPES[state.selectedTowerId];
  if (selectedType) {
    const stats = getTowerLevelStats(selectedType, 1);
    if (selectedNameEl) selectedNameEl.textContent = selectedType.label;
    if (selectedCostEl) selectedCostEl.textContent = `${selectedType.cost} золота`;
    if (selectedDamageEl) selectedDamageEl.textContent = `${stats.damage}`;
    if (selectedRangeEl) selectedRangeEl.textContent = `${stats.range}px`;
    if (selectedCdEl) selectedCdEl.textContent = `${stats.cooldown.toFixed(2)}с`;
    if (selectedSpecialEl) selectedSpecialEl.textContent = stats.special;
  }

  if (slotInfoEl) {
    const built = state.towers.length;
    slotInfoEl.textContent = `Построено башен: ${built} • Наложение запрещено`;
  }
  if (buffsLineEl) {
    ensureBuffs();
    const buffs = [];
    if (state.buffs.damageMult > 1.001) buffs.push(`урон x${state.buffs.damageMult.toFixed(2)}`);
    if (state.buffs.cooldownMult < 0.999) buffs.push(`перезарядка x${state.buffs.cooldownMult.toFixed(2)}`);
    if (state.buffs.rangeBonus > 0) buffs.push(`радиус +${state.buffs.rangeBonus}`);
    if (state.buffs.extraTickets > 0) buffs.push(`билеты +${state.buffs.extraTickets}/волну`);
    if (state.buffs.baseHpBonus > 0) buffs.push(`крепость +${state.buffs.baseHpBonus}`);
    buffsLineEl.textContent = `Бонусы серии: ${buffs.length ? buffs.join(" • ") : "нет"}`;
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
    handleCanvasClick(x, y);
  });

  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    state.hoverPos = {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  });
  canvas.addEventListener("pointerleave", () => {
    state.hoverPos = null;
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
        <div class="td-atmo-banner">
          <div class="td-atmo-title">Крепость Лазурного Шпиля</div>
          <div class="td-atmo-sub">Защити рудный тракт от налетчиков. Волны усиливаются, награда растет.</div>
        </div>
        <div class="td-top">
          <div class="td-chip"><span class="td-chip-ico">🌊</span>Волна: <strong id="td-wave">0</strong></div>
          <div class="td-chip"><span class="td-chip-ico">🏰</span>База: <strong id="td-base-hp">20</strong></div>
          <div class="td-chip"><span class="td-chip-ico">🪙</span>Золото: <strong id="td-gold">0</strong></div>
          <div class="td-chip"><span class="td-chip-ico">🎟</span>Билеты: <strong id="td-tickets">0</strong></div>
          <div class="td-chip"><span class="td-chip-ico">👹</span>Врагов: <strong id="td-queue">0</strong></div>
          <div class="td-chip"><span class="td-chip-ico">📜</span>Серия: <strong id="td-run-tickets">0</strong></div>
        </div>

        <div class="td-main">
          <div class="td-canvas-wrap">
            <canvas id="td-canvas" width="800" height="380"></canvas>
            <div class="td-canvas-tip">Ставь башни в любую точку поля. На одно место можно поставить только одну башню.</div>
            <div class="td-float-toast" id="td-float-toast"></div>
          </div>
          <div class="td-controls">
            <div class="td-control-block">
              <div class="td-sub" id="td-buffs-line">Бонусы серии: нет</div>
            </div>
            <div class="td-control-block">
              <div class="td-title">Башни (тратят только золото)</div>
              <div class="td-btn-row td-tower-grid">
                <button class="btn-primary td-tower-card active" data-td-tower="bolt">
                  <span class="td-tower-name">Болтовая</span>
                  <span class="td-tower-meta">90 золота • Быстрая single-target</span>
                </button>
                <button class="btn-primary td-tower-card" data-td-tower="cannon">
                  <span class="td-tower-name">Пушка</span>
                  <span class="td-tower-meta">160 золота • Урон по области</span>
                </button>
                <button class="btn-primary td-tower-card" data-td-tower="frost">
                  <span class="td-tower-name">Мороз</span>
                  <span class="td-tower-meta">145 золота • Замедление + урон</span>
                </button>
              </div>
              <div class="td-sub">Выбрано: <span id="td-selected-tower">Болтовая (90 золота)</span></div>
              <div class="td-sub td-quick-guide">Клик по свободной точке: построить. Клик по построенной башне: апгрейд.</div>
              <div class="td-sub" id="td-slots-info">Построено башен: 0 • Наложение запрещено</div>
              <div class="td-selected-stats">
                <div class="td-stat-row"><span>Тип</span><strong id="td-selected-name">Болтовая</strong></div>
                <div class="td-stat-row"><span>Цена</span><strong id="td-selected-cost">90 золота</strong></div>
                <div class="td-stat-row"><span>Урон (L1)</span><strong id="td-selected-dmg">18</strong></div>
                <div class="td-stat-row"><span>Радиус (L1)</span><strong id="td-selected-range">110px</strong></div>
                <div class="td-stat-row"><span>Перезарядка (L1)</span><strong id="td-selected-cd">0.55с</strong></div>
                <div class="td-stat-row"><span>Особенность</span><strong id="td-selected-special">Фокус на одной цели</strong></div>
              </div>
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
        <div class="td-upgrade-panel" id="td-upgrade-panel">
          <div class="td-upgrade-inner">
            <div class="td-upgrade-head">Выбери усиление перед следующей волной</div>
            <div class="td-upgrade-list" id="td-upgrade-list"></div>
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
