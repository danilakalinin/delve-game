const KEY_TICKETS = "delve_td_tickets";
const KEY_PICKAXE_INV = "delve_pickaxe_inventory_v1";
const KEY_PICKAXE_EQUIPPED = "delve_pickaxe_equipped_v1";
const KEY_GACHA_PITY = "delve_gacha_pity_v1";
const STARTER_TICKETS = 2;

const RARITY_ORDER = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  ultra: 6,
};

const RARITY_LABEL = {
  common: "Обычная",
  uncommon: "Необычная",
  rare: "Редкая",
  epic: "Эпическая",
  legendary: "Легендарная",
  ultra: "Ультра",
};

const RARITY_CLASS = {
  common: "rarity-common",
  uncommon: "rarity-uncommon",
  rare: "rarity-rare",
  epic: "rarity-epic",
  legendary: "rarity-legendary",
  ultra: "rarity-ultra",
};

export const PICKAXES = [
  {
    id: "rusty_tooth",
    name: "Ржавый зуб",
    rarity: "common",
    weight: 360,
    desc: "Старый, но надежный. Без бонусов.",
    effects: {},
  },
  {
    id: "coal_biter",
    name: "Укус угля",
    rarity: "common",
    weight: 300,
    desc: "+1 стартовой руды в каждом забеге.",
    effects: { startOreBonus: 1 },
  },
  {
    id: "copper_whistle",
    name: "Медный свист",
    rarity: "common",
    weight: 270,
    desc: "5% шанс на двойную руду.",
    effects: { doubleOreChance: 0.05 },
  },
  {
    id: "drifter_pick",
    name: "Кирка бродяги",
    rarity: "uncommon",
    weight: 200,
    desc: "+1 к максимальному HP.",
    effects: { extraStartHp: 1 },
  },
  {
    id: "lamp_keeper",
    name: "Светляк штрека",
    rarity: "uncommon",
    weight: 185,
    desc: "Обвал от бездействия наступает позже (+8 сек).",
    effects: { idleCollapseDelaySec: 8 },
  },
  {
    id: "vein_ear",
    name: "Слух жилы",
    rarity: "uncommon",
    weight: 175,
    desc: "В начале забега раскрывает 2 рудные клетки.",
    effects: { revealOreAtStart: 2 },
  },
  {
    id: "steel_fang",
    name: "Стальной клык",
    rarity: "rare",
    weight: 140,
    desc: "12% шанс на двойную руду.",
    effects: { doubleOreChance: 0.12 },
  },
  {
    id: "second_breath",
    name: "Второе дыхание",
    rarity: "rare",
    weight: 130,
    desc: "18% шанс пережить смертельный удар (1 раз за вылазку).",
    effects: { secondWindChance: 0.18 },
  },
  {
    id: "escape_hook",
    name: "Крюк беглеца",
    rarity: "rare",
    weight: 125,
    desc: "+8% к сохранению руды при побеге.",
    effects: { escapeKeepBonus: 0.08 },
  },
  {
    id: "magnetic_head",
    name: "Магнитная голова",
    rarity: "epic",
    weight: 78,
    desc: "18% шанс на доп. руду при сборе жилы.",
    effects: { gatherBonusChance: 0.18 },
  },
  {
    id: "adamant_reach",
    name: "Адамантовый шаг",
    rarity: "epic",
    weight: 70,
    desc: "+1 HP и 15% шанс на двойную руду.",
    effects: { extraStartHp: 1, doubleOreChance: 0.15 },
  },
  {
    id: "foreman_mark",
    name: "Знак бригадира",
    rarity: "epic",
    weight: 66,
    desc: "+12% к бонусу за полную зачистку.",
    effects: { clearBonusBonus: 0.12 },
  },
  {
    id: "dragon_spine",
    name: "Хребет дракона",
    rarity: "legendary",
    weight: 34,
    desc: "22% шанс на двойную руду и 35% second wind.",
    effects: { doubleOreChance: 0.22, secondWindChance: 0.35 },
  },
  {
    id: "core_heart",
    name: "Сердце ядра",
    rarity: "legendary",
    weight: 26,
    desc: "+2 HP, +15% к побегу и зачистке.",
    effects: {
      extraStartHp: 2,
      escapeKeepBonus: 0.15,
      clearBonusBonus: 0.15,
    },
  },
  {
    id: "void_archidrill",
    name: "Пустотный Архи-Бур",
    rarity: "ultra",
    weight: 8,
    desc: "+2 HP, 35% двойной руды, мощные бонусы выживания.",
    effects: {
      extraStartHp: 2,
      doubleOreChance: 0.35,
      secondWindChance: 0.5,
      clearBonusBonus: 0.25,
      escapeKeepBonus: 0.2,
      gatherBonusChance: 0.25,
    },
  },
];

let onStateChanged = null;
let rolling = false;

function emitStateChanged() {
  if (typeof onStateChanged === "function") onStateChanged();
}

function setRollButtonsDisabled(disabled) {
  const roll1 = document.getElementById("gacha-roll-1");
  const roll5 = document.getElementById("gacha-roll-5");
  if (roll1) roll1.disabled = disabled;
  if (roll5) roll5.disabled = disabled;
}

function safeParse(json, fallback) {
  try {
    const out = JSON.parse(json ?? "");
    return out && typeof out === "object" ? out : fallback;
  } catch {
    return fallback;
  }
}

function getInventory() {
  const inv = safeParse(localStorage.getItem(KEY_PICKAXE_INV), {});
  return inv && typeof inv === "object" ? inv : {};
}

function saveInventory(inv) {
  localStorage.setItem(KEY_PICKAXE_INV, JSON.stringify(inv));
}

function getPity() {
  const pity = safeParse(localStorage.getItem(KEY_GACHA_PITY), {
    sinceRare: 0,
    sinceLegendary: 0,
  });
  return {
    sinceRare: Math.max(0, Number(pity.sinceRare) || 0),
    sinceLegendary: Math.max(0, Number(pity.sinceLegendary) || 0),
  };
}

function savePity(pity) {
  localStorage.setItem(KEY_GACHA_PITY, JSON.stringify(pity));
}

function pickWeighted(pool) {
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1] ?? PICKAXES[0];
}

function formatEffects(effects) {
  const parts = [];
  if (effects.extraStartHp) parts.push(`+${effects.extraStartHp} HP`);
  if (effects.doubleOreChance)
    parts.push(`${Math.round(effects.doubleOreChance * 100)}% x2 руда`);
  if (effects.secondWindChance)
    parts.push(`${Math.round(effects.secondWindChance * 100)}% шанс выжить`);
  if (effects.escapeKeepBonus)
    parts.push(`+${Math.round(effects.escapeKeepBonus * 100)}% побег`);
  if (effects.clearBonusBonus)
    parts.push(`+${Math.round(effects.clearBonusBonus * 100)}% зачистка`);
  if (effects.idleCollapseDelaySec)
    parts.push(`+${effects.idleCollapseDelaySec}с к AFK-таймеру`);
  if (effects.startOreBonus) parts.push(`+${effects.startOreBonus} старт. руды`);
  if (effects.revealOreAtStart)
    parts.push(`${effects.revealOreAtStart} рудных клетки в старте`);
  if (effects.gatherBonusChance)
    parts.push(`${Math.round(effects.gatherBonusChance * 100)}% доп. добычи`);
  return parts.length ? parts.join(" • ") : "Без эффектов";
}

function getOwnedPickaxes() {
  const inv = getInventory();
  return PICKAXES.map((p) => ({
    ...p,
    owned: Math.max(0, Number(inv[p.id]) || 0),
  }));
}

function updateGachaResult(result) {
  const titleEl = document.getElementById("gacha-last-title");
  const bodyEl = document.getElementById("gacha-last-body");
  if (!titleEl || !bodyEl) return;

  if (!result) {
    titleEl.textContent = "Последняя крутка";
    bodyEl.textContent = "Сделай крутку за билет, чтобы получить кирку.";
    titleEl.className = "gacha-last-title";
    return;
  }

  titleEl.textContent = `${result.pickaxe.name} (${RARITY_LABEL[result.pickaxe.rarity]})`;
  titleEl.className = `gacha-last-title ${RARITY_CLASS[result.pickaxe.rarity]}`;
  bodyEl.textContent = `${result.isNew ? "Новая" : "Повтор"}: ${formatEffects(result.pickaxe.effects)}`;
}

function shortName(name) {
  const parts = name.split(" ");
  return parts.slice(0, 2).join(" ").toUpperCase();
}

function setMachineState({ reels, statusText, machineClass = "" }) {
  const machine = document.getElementById("gacha-machine");
  const r1 = document.getElementById("gacha-reel-a");
  const r2 = document.getElementById("gacha-reel-b");
  const r3 = document.getElementById("gacha-reel-c");
  const status = document.getElementById("gacha-reel-status");
  if (!machine || !r1 || !r2 || !r3 || !status) return;
  machine.className = `gacha-machine ${machineClass}`.trim();
  const arr = reels?.length ? reels : ["⛏", "⛏", "⛏"];
  r1.textContent = arr[0] ?? "⛏";
  r2.textContent = arr[1] ?? "⛏";
  r3.textContent = arr[2] ?? "⛏";
  status.textContent = statusText ?? "";
}

function renderGachaCollection() {
  const mount = document.getElementById("gacha-pickaxe-list");
  const equippedLabel = document.getElementById("gacha-equipped");
  const tickets = document.getElementById("gacha-tickets");
  if (!mount || !equippedLabel || !tickets) return;

  const inv = getOwnedPickaxes();
  const equipped = getEquippedPickaxe();

  tickets.textContent = String(getTickets());
  equippedLabel.textContent = equipped
    ? `${equipped.name} — ${formatEffects(equipped.effects)}`
    : "Нет экипированной кирки";

  mount.innerHTML = inv
    .map((p) => {
      const ownedLabel = p.owned > 0 ? `×${p.owned}` : "—";
      const dimClass = p.owned === 0 ? "gacha-pickaxe-locked" : "";
      return `
      <div class="gacha-pickaxe-card ${RARITY_CLASS[p.rarity]} ${equipped?.id === p.id ? "active" : ""} ${dimClass}">
        <div class="gacha-pickaxe-head">
          <div class="gacha-pickaxe-name">${p.name}</div>
          <div class="gacha-pickaxe-rarity ${RARITY_CLASS[p.rarity]}">${RARITY_LABEL[p.rarity]}</div>
        </div>
        <div class="gacha-pickaxe-desc">${p.desc}</div>
        <div class="gacha-pickaxe-effects">${formatEffects(p.effects)}</div>
        <div class="gacha-pickaxe-foot"><span>${ownedLabel}</span></div>
      </div>`;
    })
    .join("");
}

function renderInventoryCollection() {
  const mount = document.getElementById("inventory-pickaxe-list");
  const equippedLabel = document.getElementById("inventory-equipped");
  const stats = document.getElementById("inventory-stats");
  if (!mount || !equippedLabel || !stats) return;

  const inv = getOwnedPickaxes();
  const equipped = getEquippedPickaxe();
  const ownedTotal = inv.reduce((sum, p) => sum + p.owned, 0);
  const uniqueOwned = inv.filter((p) => p.owned > 0).length;

  equippedLabel.textContent = equipped
    ? `${equipped.name} — ${formatEffects(equipped.effects)}`
    : "Нет экипированной кирки";
  stats.textContent = `${uniqueOwned} / ${PICKAXES.length} уник.`;

  const owned = inv.filter((p) => p.owned > 0);
  if (!owned.length) {
    mount.innerHTML = `
      <div class="gacha-pickaxe-empty">
        Инвентарь пуст. Сделай крутки в разделе «Гача».
      </div>`;
    return;
  }

  mount.innerHTML = owned
    .map((p) => {
      const active = equipped?.id === p.id;
      const btnLabel = active ? "✓ Экипировано" : "Экипировать";
      return `
      <div class="gacha-pickaxe-card ${RARITY_CLASS[p.rarity]} ${active ? "active" : ""}">
        <div class="gacha-pickaxe-head">
          <div class="gacha-pickaxe-name">${p.name}</div>
          <div class="gacha-pickaxe-rarity ${RARITY_CLASS[p.rarity]}">${RARITY_LABEL[p.rarity]}</div>
        </div>
        <div class="gacha-pickaxe-desc">${p.desc}</div>
        <div class="gacha-pickaxe-effects">${formatEffects(p.effects)}</div>
        <div class="gacha-pickaxe-foot">
          <span>×${p.owned}</span>
          <button class="btn-primary gacha-equip-btn ${active ? "gacha-equip-active" : ""}" data-inventory-pickaxe-id="${p.id}">${btnLabel}</button>
        </div>
      </div>`;
    })
    .join("");

  mount.querySelectorAll("[data-inventory-pickaxe-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-inventory-pickaxe-id");
      if (!id) return;
      equipPickaxe(id);
      renderInventoryScreen();
      renderGachaScreen();
      emitStateChanged();
    });
  });
}

function rollOneInternal() {
  if (!spendTickets(1)) return null;

  const pity = getPity();
  let pool = PICKAXES;
  if (pity.sinceLegendary >= 34) {
    pool = PICKAXES.filter((p) => RARITY_ORDER[p.rarity] >= RARITY_ORDER.legendary);
  } else if (pity.sinceRare >= 9) {
    pool = PICKAXES.filter((p) => RARITY_ORDER[p.rarity] >= RARITY_ORDER.rare);
  }

  const pickaxe = pickWeighted(pool);
  const inv = getInventory();
  const prev = Math.max(0, Number(inv[pickaxe.id]) || 0);
  inv[pickaxe.id] = prev + 1;
  saveInventory(inv);

  const rarityRank = RARITY_ORDER[pickaxe.rarity] ?? 1;
  const nextPity = {
    sinceRare: rarityRank >= RARITY_ORDER.rare ? 0 : pity.sinceRare + 1,
    sinceLegendary:
      rarityRank >= RARITY_ORDER.legendary ? 0 : pity.sinceLegendary + 1,
  };
  savePity(nextPity);

  if (!getEquippedPickaxeId()) {
    localStorage.setItem(KEY_PICKAXE_EQUIPPED, pickaxe.id);
  }

  return {
    pickaxe,
    isNew: prev === 0,
  };
}

export function buildGachaScreen() {
  return `
  <div id="screen-gacha" class="screen">

    <nav class="gacha-topbar">
      <div class="gacha-topbar-brand">
        <span class="gacha-topbar-emoji">🎰</span>
        <span class="gacha-topbar-title">Бюро круток</span>
      </div>
      <div class="gacha-topbar-stats">
        <div class="resource-chip">
          <span class="resource-dot" style="background:#a78bfa;box-shadow:0 0 6px rgba(167,139,250,0.5)"></span>
          <span class="resource-val" id="gacha-tickets">0</span>
          <span class="resource-label">билетов</span>
        </div>
      </div>
      <button class="topbar-btn" id="gacha-back">← Меню</button>
    </nav>

    <div class="gacha-content">
      <div class="gacha-layout">

        <div class="card gacha-machine-card">
          <div class="card-header">
            <span class="card-header-icon">⛏</span>
            <span class="card-header-text">Барабаны</span>
          </div>
          <div class="card-body">
            <div class="gacha-machine" id="gacha-machine">
              <div class="gacha-machine-head">MINE JACKPOT</div>
              <div class="gacha-reels">
                <div class="gacha-reel-window"><div class="gacha-reel" id="gacha-reel-a">⛏</div></div>
                <div class="gacha-reel-window"><div class="gacha-reel" id="gacha-reel-b">⛏</div></div>
                <div class="gacha-reel-window"><div class="gacha-reel" id="gacha-reel-c">⛏</div></div>
              </div>
              <div class="gacha-reel-status" id="gacha-reel-status">ГОТОВ К КРУТКЕ</div>
            </div>
            <div class="gacha-roll-actions">
              <button class="btn-primary" id="gacha-roll-1">Крутка ×1</button>
              <button class="btn-primary" id="gacha-roll-5">Крутка ×5</button>
            </div>
            <div class="gacha-last-roll">
              <div class="gacha-last-title" id="gacha-last-title">Последняя крутка</div>
              <div class="gacha-last-body" id="gacha-last-body">Сделай крутку за билет, чтобы получить кирку.</div>
            </div>
          </div>
        </div>

        <div class="card gacha-equipped-card">
          <div class="card-header">
            <span class="card-header-icon">🎒</span>
            <span class="card-header-text">Экипировано</span>
          </div>
          <div class="card-body">
            <div class="gacha-equipped-info" id="gacha-equipped">Нет экипированной кирки</div>
          </div>
        </div>

        <div class="card gacha-collection-card">
          <div class="card-header">
            <span class="card-header-icon">📋</span>
            <span class="card-header-text">Коллекция кирок</span>
          </div>
          <div class="card-body">
            <div class="gacha-pickaxe-list" id="gacha-pickaxe-list"></div>
          </div>
        </div>

      </div>
    </div>
  </div>`;
}

export function buildInventoryScreen() {
  return `
  <div id="screen-inventory" class="screen">

    <nav class="gacha-topbar">
      <div class="gacha-topbar-brand">
        <span class="gacha-topbar-emoji">🎒</span>
        <span class="gacha-topbar-title">Инвентарь кирок</span>
      </div>
      <div class="gacha-topbar-stats">
        <div class="resource-chip">
          <span class="resource-val" id="inventory-stats" style="font-size:11px">0 / ${PICKAXES.length}</span>
        </div>
      </div>
      <button class="topbar-btn" id="inventory-back">← Меню</button>
    </nav>

    <div class="gacha-content">
      <div class="gacha-layout">

        <div class="card gacha-equipped-card">
          <div class="card-header">
            <span class="card-header-icon">⚒️</span>
            <span class="card-header-text">Экипировано</span>
          </div>
          <div class="card-body">
            <div class="gacha-equipped-info" id="inventory-equipped">Нет экипированной кирки</div>
          </div>
        </div>

        <div class="card gacha-collection-card">
          <div class="card-header">
            <span class="card-header-icon">📋</span>
            <span class="card-header-text">Коллекция</span>
          </div>
          <div class="card-body">
            <div class="gacha-pickaxe-list" id="inventory-pickaxe-list"></div>
          </div>
        </div>

      </div>
    </div>
  </div>`;
}

export function initGachaScreen({ onBack, onStateChanged: onState }) {
  onStateChanged = onState;
  const back = document.getElementById("gacha-back");
  const roll1 = document.getElementById("gacha-roll-1");
  const roll5 = document.getElementById("gacha-roll-5");

  back?.addEventListener("click", () => {
    if (typeof onBack === "function") onBack();
  });

  const spin = async (count) => {
    if (rolling) return;
    rolling = true;
    setRollButtonsDisabled(true);
    setMachineState({
      reels: ["КРУТКА", "КРУТКА", "КРУТКА"],
      statusText: "БАРАБАНЫ КРУТЯТСЯ...",
      machineClass: "rolling",
    });

    let ticks = 0;
    const spinTimer = setInterval(() => {
      ticks += 1;
      const p1 = PICKAXES[Math.floor(Math.random() * PICKAXES.length)];
      const p2 = PICKAXES[Math.floor(Math.random() * PICKAXES.length)];
      const p3 = PICKAXES[Math.floor(Math.random() * PICKAXES.length)];
      setMachineState({
        reels: [shortName(p1.name), shortName(p2.name), shortName(p3.name)],
        statusText: `СПИН x${count} • ${ticks}`,
        machineClass: "rolling",
      });
    }, 70);

    await new Promise((resolve) => setTimeout(resolve, count === 1 ? 900 : 1500));

    clearInterval(spinTimer);
    let last = null;
    const got = [];
    for (let i = 0; i < count; i += 1) {
      const result = rollOneInternal();
      if (!result) break;
      last = result;
      got.push(result);
    }

    updateGachaResult(last);
    if (last?.pickaxe) {
      const top3 = got.slice(-3).map((r) => shortName(r.pickaxe.name));
      while (top3.length < 3) top3.unshift(shortName(last.pickaxe.name));
      setMachineState({
        reels: top3,
        statusText:
          count === 1
            ? `ВЫПАЛА: ${last.pickaxe.name.toUpperCase()}`
            : `x${got.length} КРУТОК • ЛУЧШАЯ: ${last.pickaxe.name.toUpperCase()}`,
        machineClass: `${RARITY_CLASS[last.pickaxe.rarity]} landed`,
      });
    } else {
      setMachineState({
        reels: ["НЕТ", "БИЛЕТОВ", "❌"],
        statusText: "НЕТ БИЛЕТОВ ДЛЯ КРУТКИ",
        machineClass: "empty",
      });
    }
    renderGachaScreen();
    renderInventoryScreen();
    emitStateChanged();
    setRollButtonsDisabled(false);
    rolling = false;
  };

  roll1?.addEventListener("click", () => {
    spin(1);
  });

  roll5?.addEventListener("click", () => {
    spin(5);
  });
}

export function initInventoryScreen({ onBack }) {
  const back = document.getElementById("inventory-back");
  back?.addEventListener("click", () => {
    if (typeof onBack === "function") onBack();
  });
}

export function renderGachaScreen() {
  renderGachaCollection();
}

export function renderInventoryScreen() {
  renderInventoryCollection();
}

export function getTickets() {
  const raw = localStorage.getItem(KEY_TICKETS);
  if (raw === null) {
    localStorage.setItem(KEY_TICKETS, String(STARTER_TICKETS));
    return STARTER_TICKETS;
  }
  return Math.max(0, parseInt(raw, 10) || 0);
}

export function addTickets(amount) {
  if (amount <= 0) return;
  localStorage.setItem(KEY_TICKETS, String(getTickets() + amount));
}

export function spendTickets(amount) {
  const cur = getTickets();
  if (cur < amount) return false;
  localStorage.setItem(KEY_TICKETS, String(cur - amount));
  return true;
}

export function resetGacha() {
  localStorage.removeItem(KEY_TICKETS);
  localStorage.removeItem(KEY_PICKAXE_INV);
  localStorage.removeItem(KEY_PICKAXE_EQUIPPED);
  localStorage.removeItem(KEY_GACHA_PITY);
}

export function getEquippedPickaxeId() {
  return localStorage.getItem(KEY_PICKAXE_EQUIPPED) ?? "";
}

export function getEquippedPickaxe() {
  const equippedId = getEquippedPickaxeId();
  if (!equippedId) return null;
  const inv = getInventory();
  if ((Number(inv[equippedId]) || 0) <= 0) return null;
  return PICKAXES.find((p) => p.id === equippedId) ?? null;
}

export function equipPickaxe(id) {
  const inv = getInventory();
  if ((Number(inv[id]) || 0) <= 0) return false;
  localStorage.setItem(KEY_PICKAXE_EQUIPPED, id);
  return true;
}

export function getEquippedPickaxeEffects() {
  const pickaxe = getEquippedPickaxe();
  return pickaxe?.effects ?? {};
}

export function getEquippedPickaxeSummary() {
  const pickaxe = getEquippedPickaxe();
  if (!pickaxe) return "Без кирки";
  return `${pickaxe.name} (${RARITY_LABEL[pickaxe.rarity]})`;
}
