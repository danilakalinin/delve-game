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
let onWaveClearedCb = null;
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

function waveStartCost(wave) {
  return Math.round(70 + wave * 55 + wave * wave * 8);
}

function getTowerBuildCost(type) {
  const wavePressure = 1 + Math.max(0, state.wave) * 0.11;
  const densityPressure = 1 + Math.max(0, state.towers.length - 3) * 0.06;
  return Math.round(type.cost * wavePressure * densityPressure);
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
  const levelPressure = 0.8 + tower.level * 0.78;
  const wavePressure = 1 + Math.max(0, state.wave) * 0.09;
  return Math.round(type.cost * levelPressure * wavePressure);
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
  const nextWave = state.wave + 1;
  const startCost = waveStartCost(nextWave);
  if (!canSpendGold(startCost)) {
    pushMessage(`Не хватает золота для старта волны ${nextWave}: нужно ${startCost}.`, "bad");
    return;
  }
  state.wave += 1;
  state.waveActive = true;
  state.spawnQueue = waveEnemyCount(state.wave);
  state.spawnCd = 0;
  state.waveTickets = ticketsForWave(state.wave);
  pushMessage(`Волна ${state.wave}: врагов ${state.spawnQueue} • вход ${startCost} золота`, "good");
  notifyStateChanged();
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
  if (typeof onWaveClearedCb === "function") onWaveClearedCb(state.wave);
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

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isOnPath(x, y, margin = 28) {
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const a = PATH_POINTS[i], b = PATH_POINTS[i + 1];
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) < margin) return true;
  }
  return false;
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
  if (isOnPath(x, y)) return false;
  for (const tower of state.towers) {
    if (distance({ x, y }, tower) < TOWER_MIN_GAP) return false;
  }
  return true;
}

function handleCanvasClick(x, y) {
  const tower = getTowerAt(x, y);
  if (!tower) {
    const type = TOWER_TYPES[state.selectedTowerId];
    const buildCost = type ? getTowerBuildCost(type) : 0;
    if (!type) return;
    if (!canPlaceTowerAt(x, y)) {
      pushMessage("Слишком близко к краю или другой башне. Выбери свободное место.", "bad");
      return;
    }
    if (!canSpendGold(buildCost)) {
      pushMessage(`Не хватает золота: нужно ${buildCost}.`, "bad");
      return;
    }
    state.towers.push({
      x,
      y,
      typeId: type.id,
      level: 1,
      cooldownLeft: 0,
    });
    pushMessage(`${type.label} построена за ${buildCost} золота.`, "neutral");
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
      typeId: type.id,
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
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";

  const pts = PATH_POINTS;

  // Helper: draw the path shape
  function tracePath() {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  // 1. Outermost dark border
  tracePath();
  ctx.strokeStyle = "#1a1108";
  ctx.lineWidth = 48;
  ctx.stroke();

  // 2. Stone base
  tracePath();
  ctx.strokeStyle = "#3d2e1e";
  ctx.lineWidth = 40;
  ctx.stroke();

  // 3. Mid stone
  tracePath();
  ctx.strokeStyle = "#55402e";
  ctx.lineWidth = 32;
  ctx.stroke();

  // 4. Surface with texture
  tracePath();
  ctx.strokeStyle = "#6b5038";
  ctx.lineWidth = 24;
  ctx.stroke();

  // 5. Inner lighter center strip
  tracePath();
  ctx.strokeStyle = "#7d5f42";
  ctx.lineWidth = 10;
  ctx.stroke();

  // 6. Stone joint lines (dashed crosshatch look)
  ctx.lineCap = "butt";
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = "rgba(40,25,12,0.55)";
  ctx.lineWidth = 28;
  ctx.lineDashOffset = 0;
  tracePath();
  ctx.stroke();

  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = 12;
  ctx.strokeStyle = "rgba(40,25,12,0.3)";
  ctx.lineWidth = 14;
  tracePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // 7. Edge highlight (top-lit feel)
  ctx.lineCap = "round";
  tracePath();
  ctx.strokeStyle = "rgba(160,120,70,0.14)";
  ctx.lineWidth = 22;
  ctx.stroke();

  // Entrance marker (green arrow-down)
  const s = pts[0];
  ctx.shadowColor = "rgba(110,231,160,0.6)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.moveTo(s.x - 8, s.y - 20);
  ctx.lineTo(s.x + 8, s.y - 20);
  ctx.lineTo(s.x + 8, s.y - 12);
  ctx.lineTo(s.x + 14, s.y - 12);
  ctx.lineTo(s.x, s.y - 2);
  ctx.lineTo(s.x - 14, s.y - 12);
  ctx.lineTo(s.x - 8, s.y - 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Fortress marker at end (castle silhouette)
  const e = pts[pts.length - 1];
  ctx.shadowColor = "rgba(248,113,113,0.5)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#dc2626";
  // Wall base
  ctx.fillRect(e.x - 12, e.y - 18, 24, 16);
  // Battlements (3 merlons)
  ctx.fillRect(e.x - 12, e.y - 26, 6, 10);
  ctx.fillRect(e.x - 3,  e.y - 26, 6, 10);
  ctx.fillRect(e.x + 6,  e.y - 26, 6, 10);
  // Gate arch
  ctx.fillStyle = "#1a0a0a";
  ctx.beginPath();
  ctx.arc(e.x, e.y - 8, 4, Math.PI, 0);
  ctx.rect(e.x - 4, e.y - 8, 8, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawTowerShape(x, y, typeId, r) {
  ctx.beginPath();
  if (typeId === "bolt") {
    // Diamond
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else if (typeId === "cannon") {
    // Rounded square
    const s = r * 0.82;
    const cr = 3;
    ctx.moveTo(x - s + cr, y - s);
    ctx.lineTo(x + s - cr, y - s);
    ctx.quadraticCurveTo(x + s, y - s, x + s, y - s + cr);
    ctx.lineTo(x + s, y + s - cr);
    ctx.quadraticCurveTo(x + s, y + s, x + s - cr, y + s);
    ctx.lineTo(x - s + cr, y + s);
    ctx.quadraticCurveTo(x - s, y + s, x - s, y + s - cr);
    ctx.lineTo(x - s, y - s + cr);
    ctx.quadraticCurveTo(x - s, y - s, x - s + cr, y - s);
    ctx.closePath();
  } else {
    // Hexagon (frost)
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + r * Math.cos(angle);
      const py = y + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}

function drawTowers() {
  const selectedType = TOWER_TYPES[state.selectedTowerId];
  for (const tower of state.towers) {
    const type = TOWER_TYPES[tower.typeId];
    const stats = getTowerLevelStats(type, tower.level);
    ctx.save();

    // Range circle (translucent fill, not dashed)
    if (selectedType && tower.typeId === state.selectedTowerId) {
      const grad = ctx.createRadialGradient(tower.x, tower.y, stats.range * 0.7, tower.x, tower.y, stats.range);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, type.color.replace(")", ",0.08)").replace("rgb(", "rgba(").replace("#", ""));
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, stats.range, 0, Math.PI * 2);
      ctx.fillStyle = `${type.color}11`;
      ctx.fill();
      ctx.strokeStyle = `${type.color}33`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Glow effect
    ctx.shadowColor = type.color + "88";
    ctx.shadowBlur = 10;

    // Tower shape
    drawTowerShape(tower.x, tower.y, type.id, TOWER_HIT_RADIUS);
    ctx.fillStyle = type.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#0b1d29";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cooldown arc
    if (tower.cooldownLeft > 0) {
      const cd = Math.max(0.12, (type.cooldown / (1 + (tower.level - 1) * 0.08)) * (state.buffs?.cooldownMult ?? 1));
      const progress = 1 - tower.cooldownLeft / cd;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, TOWER_HIT_RADIUS + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.strokeStyle = type.color + "66";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Level dots
    const dots = tower.level;
    const dotY = tower.y + TOWER_HIT_RADIUS + 6;
    const dotSpacing = 6;
    const startX = tower.x - ((dots - 1) * dotSpacing) / 2;
    for (let d = 0; d < Math.min(dots, 5); d++) {
      ctx.beginPath();
      ctx.arc(startX + d * dotSpacing, dotY, 2, 0, Math.PI * 2);
      ctx.fillStyle = type.color;
      ctx.fill();
    }

    ctx.restore();
  }

  // Hover preview
  if (!selectedType || !state.hoverPos) return;
  const valid = canPlaceTowerAt(state.hoverPos.x, state.hoverPos.y);
  ctx.save();

  // Range preview
  ctx.beginPath();
  ctx.arc(state.hoverPos.x, state.hoverPos.y, selectedType.range, 0, Math.PI * 2);
  ctx.fillStyle = valid ? "rgba(110,231,160,0.06)" : "rgba(248,113,113,0.06)";
  ctx.fill();
  ctx.strokeStyle = valid ? "rgba(110,231,160,0.25)" : "rgba(248,113,113,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tower preview shape
  ctx.globalAlpha = 0.5;
  drawTowerShape(state.hoverPos.x, state.hoverPos.y, state.selectedTowerId, TOWER_HIT_RADIUS);
  ctx.fillStyle = valid ? selectedType.color : "#c96a56";
  ctx.fill();
  ctx.strokeStyle = valid ? "#fff" : "#c96a56";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawEnemies() {
  for (const e of state.enemies) {
    ctx.save();

    // Calculate direction from path
    const nextProg = Math.min(1, e.progress + 0.02);
    const next = pathPoint(nextProg);
    const angle = Math.atan2(next.y - e.y, next.x - e.x);

    // Slow effect ring
    if (e.slowLeft > 0) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(135,242,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Directional triangle body
    ctx.translate(e.x, e.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-7, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, 7);
    ctx.closePath();

    ctx.shadowColor = "rgba(220,80,50,0.4)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = e.slowLeft > 0 ? "#7badc4" : "#dc5032";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#1a0f0a";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eye dot
    ctx.beginPath();
    ctx.arc(3, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Health bar — gradient color based on HP
    const hpPct = clamp(e.hp / e.maxHp, 0, 1);
    const barW = 28;
    const barH = 4;
    const barX = e.x - barW / 2;
    const barY = e.y - 18;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    const barR = 2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barR);
    ctx.fill();

    // Health fill with color gradient
    const hpColor = hpPct > 0.6 ? "#4ade80" : hpPct > 0.3 ? "#fbbf24" : "#f87171";
    if (hpPct > 0) {
      ctx.fillStyle = hpColor;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * hpPct, barH, barR);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawBullets() {
  for (const b of state.bullets) {
    ctx.save();
    ctx.shadowColor = b.color + "88";
    ctx.shadowBlur = 6;

    if (b.typeId === "cannon") {
      // Cannonball
      ctx.beginPath();
      ctx.arc(b.x2, b.y2, 4, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
    } else if (b.typeId === "frost") {
      // Star shape
      ctx.translate(b.x2, b.y2);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
      }
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Trail line
      ctx.strokeStyle = b.color + "44";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    } else {
      // Bolt — glowing line with tip
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      // Bright tip
      ctx.beginPath();
      ctx.arc(b.x2, b.y2, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

const TREE_DECO = [
  {x:22,y:28,r:16},{x:58,y:18,r:12},{x:88,y:38,r:14},{x:40,y:58,r:10},
  {x:716,y:22,r:15},{x:755,y:38,r:12},{x:778,y:18,r:10},{x:740,y:58,r:11},
  {x:22,y:335,r:14},{x:52,y:358,r:11},{x:82,y:345,r:12},
  {x:598,y:340,r:13},{x:635,y:358,r:11},{x:666,y:344,r:10},
  {x:232,y:22,r:12},{x:268,y:15,r:10},
  {x:412,y:22,r:13},{x:462,y:16,r:10},
  {x:760,y:195,r:12},{x:788,y:225,r:9},
  {x:22,y:170,r:10},{x:22,y:290,r:11},
];

function drawTerrain() {
  // Base gradient
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#131c12");
  bg.addColorStop(0.45, "#181c10");
  bg.addColorStop(1, "#16110d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle dot grid (tower placement guide)
  ctx.fillStyle = "rgba(255,255,255,0.028)";
  for (let gx = 30; gx < canvas.width; gx += 34) {
    for (let gy = 30; gy < canvas.height; gy += 34) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Trees
  for (const t of TREE_DECO) {
    // Shadow
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r * 0.9, t.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fill();
    // Dark canopy
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fillStyle = "#1a3318";
    ctx.fill();
    // Mid layer
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.2, t.y - t.r * 0.15, t.r * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = "#243f20";
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(72,110,48,0.5)";
    ctx.fill();
  }

  // Vignette
  const vig = ctx.createRadialGradient(400, 190, 160, 400, 190, 420);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTerrain();
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
  const selectedDamageEl = document.getElementById("td-selected-dmg");
  const selectedRangeEl = document.getElementById("td-selected-range");
  const selectedCdEl = document.getElementById("td-selected-cd");
  const selectedSpecialEl = document.getElementById("td-selected-special");
  const slotInfoEl = document.getElementById("td-slots-info");
  const buffsLineEl = document.getElementById("td-buffs-line");
  const boltCostEl = document.getElementById("td-cost-bolt");
  const cannonCostEl = document.getElementById("td-cost-cannon");
  const frostCostEl = document.getElementById("td-cost-frost");
  const startWaveBtn = document.getElementById("td-start-wave");

  if (waveEl) waveEl.textContent = String(state.wave);
  if (hpEl) hpEl.textContent = String(state.baseHp);
  if (goldEl) goldEl.textContent = String(getGold());
  if (ticketsEl) ticketsEl.textContent = String(getTickets());
  if (queueEl) queueEl.textContent = String(state.spawnQueue + state.enemies.length);
  if (runEl) runEl.textContent = String(state.totalTicketsSession);
  const nextCost = waveStartCost(state.wave + 1);
  if (startWaveBtn) startWaveBtn.textContent = `▶ Старт волны · −${nextCost}🪙`;

  if (logEl) {
    logEl.innerHTML = state.messages
      .slice(0, 4)
      .map((m) => `<div class="td-log-line td-${m.tone}">${m.line}</div>`)
      .join("");
  }

  const selectedType = TOWER_TYPES[state.selectedTowerId];
  if (selectedType) {
    const stats = getTowerLevelStats(selectedType, 1);
    if (selectedDamageEl) selectedDamageEl.textContent = `${stats.damage}`;
    if (selectedRangeEl) selectedRangeEl.textContent = `${stats.range}`;
    if (selectedCdEl) selectedCdEl.textContent = `${stats.cooldown.toFixed(2)}с`;
    if (selectedSpecialEl) selectedSpecialEl.textContent = stats.special;
  }
  if (boltCostEl) boltCostEl.textContent = `${getTowerBuildCost(TOWER_TYPES.bolt)}`;
  if (cannonCostEl) cannonCostEl.textContent = `${getTowerBuildCost(TOWER_TYPES.cannon)}`;
  if (frostCostEl) frostCostEl.textContent = `${getTowerBuildCost(TOWER_TYPES.frost)}`;

  if (slotInfoEl) {
    slotInfoEl.textContent = `Башен: ${state.towers.length}`;
  }
  if (buffsLineEl) {
    ensureBuffs();
    const buffs = [];
    if (state.buffs.damageMult > 1.001) buffs.push(`урон x${state.buffs.damageMult.toFixed(2)}`);
    if (state.buffs.cooldownMult < 0.999) buffs.push(`перезарядка x${state.buffs.cooldownMult.toFixed(2)}`);
    if (state.buffs.rangeBonus > 0) buffs.push(`+${state.buffs.rangeBonus} радиус`);
    if (state.buffs.extraTickets > 0) buffs.push(`+${state.buffs.extraTickets} билет/волну`);
    if (state.buffs.baseHpBonus > 0) buffs.push(`+${state.buffs.baseHpBonus} HP`);
    buffsLineEl.textContent = buffs.length ? `Бонусы: ${buffs.join(" · ")}` : "Бонусы: нет";
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
    if (btn) btn.textContent = `x${state.speed}`;
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

    <nav class="gacha-topbar">
      <div class="gacha-topbar-brand">
        <span class="gacha-topbar-emoji">🏰</span>
        <span class="gacha-topbar-title">Крепость</span>
      </div>
      <div class="gacha-topbar-stats">
        <div class="resource-chip">
          <span>🌊</span>
          <span class="resource-val" id="td-wave">0</span>
          <span class="resource-label">волна</span>
        </div>
        <div class="resource-chip">
          <span>🏰</span>
          <span class="resource-val" id="td-base-hp">20</span>
          <span class="resource-label">HP</span>
        </div>
        <div class="resource-chip">
          <span class="resource-dot" style="background:#fbbf24;box-shadow:0 0 6px rgba(251,191,36,0.5)"></span>
          <span class="resource-val" id="td-gold">0</span>
          <span class="resource-label">золото</span>
        </div>
        <div class="resource-chip">
          <span>🎟</span>
          <span class="resource-val" id="td-tickets">0</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="topbar-btn" id="td-speed">x1</button>
        <button class="topbar-btn" id="td-reset-run">Сброс</button>
        <button class="topbar-btn" id="td-back">← Меню</button>
      </div>
    </nav>

    <div class="td-content">
      <div class="td-field-layout">

        <div class="td-canvas-area">
          <canvas id="td-canvas" width="800" height="380"></canvas>
          <div class="td-float-toast" id="td-float-toast"></div>
        </div>

        <div class="td-sidebar">

          <!-- Tower selection -->
          <div class="card">
            <div class="card-header">
              <span class="card-header-icon">⚔</span>
              <span class="card-header-text">Башни</span>
            </div>
            <div class="card-body">
              <div class="td-tower-grid">
                <button class="td-tower-card active" data-td-tower="bolt">
                  <span class="td-tower-icon" style="color:#8cc7ff">⚡</span>
                  <div class="td-tower-info">
                    <span class="td-tower-name">Болтовая</span>
                    <span class="td-tower-meta"><span id="td-cost-bolt">90</span>🪙 · Быстрая</span>
                  </div>
                </button>
                <button class="td-tower-card" data-td-tower="cannon">
                  <span class="td-tower-icon" style="color:#f6b36b">💣</span>
                  <div class="td-tower-info">
                    <span class="td-tower-name">Пушка</span>
                    <span class="td-tower-meta"><span id="td-cost-cannon">160</span>🪙 · Область</span>
                  </div>
                </button>
                <button class="td-tower-card" data-td-tower="frost">
                  <span class="td-tower-icon" style="color:#87f2ff">❄️</span>
                  <div class="td-tower-info">
                    <span class="td-tower-name">Мороз</span>
                    <span class="td-tower-meta"><span id="td-cost-frost">145</span>🪙 · Замедление</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- Info card -->
          <div class="card">
            <div class="card-header">
              <span class="card-header-icon">📊</span>
              <span class="card-header-text">Инфо</span>
            </div>
            <div class="card-body td-info-body">
              <div class="td-stats-grid">
                <div class="td-stat-cell"><span class="td-stat-lbl">Урон</span><strong id="td-selected-dmg">18</strong></div>
                <div class="td-stat-cell"><span class="td-stat-lbl">Радиус</span><strong id="td-selected-range">110</strong></div>
                <div class="td-stat-cell"><span class="td-stat-lbl">Скор.</span><strong id="td-selected-cd">0.55с</strong></div>
                <div class="td-stat-cell"><span class="td-stat-lbl">Тип</span><strong id="td-selected-special">Фокус</strong></div>
              </div>
              <div class="td-info-line" id="td-buffs-line">Бонусы: нет</div>
              <div class="td-info-line">👹 Врагов: <strong id="td-queue">0</strong> · 📜 Серия: <strong id="td-run-tickets">0</strong> билетов</div>
              <div class="td-info-line" id="td-slots-info">Башен: 0</div>
              <div class="td-info-tip">Клик: построить · Клик по башне: улучшить</div>
            </div>
          </div>

          <!-- Start wave button -->
          <button class="td-start-btn" id="td-start-wave">▶ Старт волны</button>

          <!-- Game log -->
          <div class="card td-log-card">
            <div class="card-header">
              <span class="card-header-icon">📜</span>
              <span class="card-header-text">Журнал</span>
            </div>
            <div class="card-body card-body-flush">
              <div class="td-log" id="td-log"></div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div class="td-upgrade-panel" id="td-upgrade-panel">
      <div class="td-upgrade-inner">
        <div class="td-upgrade-head">Выбери усиление</div>
        <div class="td-upgrade-list" id="td-upgrade-list"></div>
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
  onWaveCleared,
}) {
  onBackCb = onBack;
  spendGoldCb = spendGold;
  getGoldCb = getGold;
  addTicketsCb = addTickets;
  getTicketsCb = getTickets;
  onStateChangedCb = onStateChanged;
  onWaveClearedCb = onWaveCleared ?? null;
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
