const KEY_TICKETS = "delve_td_tickets";
const KEY_GACHA_OPEN = "delve_gacha_open";
const KEY_PICKAXE_INV = "delve_pickaxe_inventory_v1";
const KEY_PICKAXE_EQUIPPED = "delve_pickaxe_equipped_v1";
const KEY_GACHA_PITY = "delve_gacha_pity_v1";

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
    effects: { extraStartHp: 2, escapeKeepBonus: 0.15, clearBonusBonus: 0.15 },
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

function emitStateChanged() {
  if (typeof onStateChanged === "function") onStateChanged();
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

function renderInventory() {
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
      const canEquip = p.owned > 0;
      const active = equipped?.id === p.id;
      const btnLabel = active ? "Экип." : "Экипировать";
      return `
      <div class="gacha-pickaxe-card ${RARITY_CLASS[p.rarity]} ${active ? "active" : ""}">
        <div class="gacha-pickaxe-head">
          <div class="gacha-pickaxe-name">${p.name}</div>
          <div class="gacha-pickaxe-rarity">${RARITY_LABEL[p.rarity]}</div>
        </div>
        <div class="gacha-pickaxe-desc">${p.desc}</div>
        <div class="gacha-pickaxe-effects">${formatEffects(p.effects)}</div>
        <div class="gacha-pickaxe-foot">
          <span>В инвентаре: x${p.owned}</span>
          <button class="btn-primary gacha-equip-btn" data-pickaxe-id="${p.id}" ${canEquip ? "" : "disabled"}>${btnLabel}</button>
        </div>
      </div>`;
    })
    .join("");

  mount.querySelectorAll("[data-pickaxe-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pickaxe-id");
      equipPickaxe(id);
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
    <div class="panel gacha-panel">
      <div class="panel-header"><span class="icon">🎰</span> БЮРО КРУТОК КИРОК</div>
      <div class="panel-body gacha-layout">
        <div class="gacha-main-card">
          <div class="gacha-row">
            <div class="gacha-ticket-line">🎟 Билеты: <strong id="gacha-tickets">0</strong></div>
            <div class="gacha-actions">
              <button class="btn-primary" id="gacha-roll-1">Крутка x1</button>
              <button class="btn-primary" id="gacha-roll-5">Крутка x5</button>
            </div>
          </div>
          <div class="gacha-last-roll">
            <div class="gacha-last-title" id="gacha-last-title">Последняя крутка</div>
            <div class="gacha-last-body" id="gacha-last-body">Сделай крутку за билет, чтобы получить кирку.</div>
          </div>
          <div class="gacha-equipped-line">Экипировано: <span id="gacha-equipped">Нет экипированной кирки</span></div>
        </div>

        <div class="gacha-pickaxe-list" id="gacha-pickaxe-list"></div>

        <div class="gacha-footer-actions">
          <button class="btn-primary" id="gacha-back">← Назад</button>
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

  roll1?.addEventListener("click", () => {
    const result = rollOneInternal();
    updateGachaResult(result);
    renderGachaScreen();
    emitStateChanged();
  });

  roll5?.addEventListener("click", () => {
    let last = null;
    for (let i = 0; i < 5; i += 1) {
      const result = rollOneInternal();
      if (!result) break;
      last = result;
    }
    updateGachaResult(last);
    renderGachaScreen();
    emitStateChanged();
  });
}

export function renderGachaScreen() {
  renderInventory();
}

export function getTickets() {
  return Math.max(0, parseInt(localStorage.getItem(KEY_TICKETS) ?? "0", 10) || 0);
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

export function isGachaOpen() {
  return localStorage.getItem(KEY_GACHA_OPEN) === "1";
}

export function openGacha() {
  localStorage.setItem(KEY_GACHA_OPEN, "1");
}

export function resetGacha() {
  localStorage.removeItem(KEY_TICKETS);
  localStorage.removeItem(KEY_GACHA_OPEN);
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
