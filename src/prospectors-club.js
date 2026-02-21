const KEY_PROSPECTORS_OPEN = "delve_prospectors_open";
const KEY_PROSPECTORS_STATE = "delve_prospectors_state_v1";

export const PROSPECTORS_UNLOCK_COST = 120;

// ─── РАСХОДНИКИ (определения для пре-рейд магазина) ───────────────────────────
// basePrice — стоимость в монетах на глубине 1 (растёт с глубиной в main.js)
// targeted: true  → нужно кликнуть по клетке после активации
// targeted: false → мгновенное использование без выбора цели

export const PROSPECTOR_TOOLS = [
  {
    id: "medkit",
    label: "Аптечка",
    icon: "🩹",
    desc: "Мгновенно восстанавливает 1 HP.",
    basePrice: 30,
    targeted: false,
  },
  {
    id: "shield",
    label: "Щит шахтера",
    icon: "🛡️",
    desc: "Следующий удар по нестабильной клетке: нет урона HP и нет обвала.",
    basePrice: 55,
    targeted: false,
  },
  {
    id: "dynamite",
    label: "Фугас",
    icon: "💥",
    desc: "Расчищает область 5×5: нестабильные помечаются флагом, пустые открываются.",
    basePrice: 50,
    targeted: true,
  },
  {
    id: "detector",
    label: "Сканер угроз",
    icon: "📡",
    desc: "Помечает флагами все нестабильные клетки в области 9×9 вокруг цели.",
    basePrice: 55,
    targeted: true,
  },
  {
    id: "coffee",
    label: "Термос",
    icon: "☕",
    desc: "Сбрасывает таймер AFK-обвала: даёт полный запас времени снова.",
    basePrice: 20,
    targeted: false,
  },
];

// ─── ПАССИВНЫЕ УЛУЧШЕНИЯ (покупаются в клубе, работают постоянно) ─────────────

export const PROSPECTOR_UPGRADES = [
  {
    id: "insurance",
    label: "Страховой полис",
    icon: "🛡",
    desc: "Снижает потери руды при досрочном выходе на 20%.",
    priceGold: 200,
  },
  {
    id: "helmet",
    label: "Усиленная каска",
    icon: "⛑",
    desc: "+1 к стартовому HP в вылазке.",
    priceGold: 250,
  },
  {
    id: "buzz",
    label: "Сарафанное радио",
    icon: "📣",
    desc: "+20% к потоку покупателей в магазине.",
    priceGold: 300,
  },
  {
    id: "vein_sense",
    label: "Рудная жилка",
    icon: "💎",
    desc: "При добыче руды 15% шанс получить +1 руду следующего ценового уровня (медь→серебро, и т.д.).",
    priceGold: 380,
  },
  {
    id: "experienced",
    label: "Шахтерский опыт",
    icon: "⏱",
    desc: "Сокращает штраф AFK-обвала от глубины на 10 секунд.",
    priceGold: 260,
  },
];

// ─── СОСТОЯНИЕ КОЛБЭКОВ ────────────────────────────────────────────────────────

let _getGold       = null;
let _spendGold     = null;
let _onBack        = null;
let _onStateChanged = null;
let _onSpendGold   = null;

// ─── ХРАНИЛИЩЕ ────────────────────────────────────────────────────────────────

function createDefaultState() {
  return {
    inventory: Object.fromEntries(PROSPECTOR_TOOLS.map((t) => [t.id, 0])),
    upgrades:  Object.fromEntries(PROSPECTOR_UPGRADES.map((u) => [u.id, false])),
    spentGold:  0,
    boughtTools: 0,
  };
}

function deepMerge(base, patch) {
  if (!base || typeof base !== "object") return patch ?? base;
  if (!patch || typeof patch !== "object") return { ...base };
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const baseVal  = base[key];
    const patchVal = patch[key];
    if (baseVal && typeof baseVal === "object" && !Array.isArray(baseVal)) {
      out[key] = deepMerge(baseVal, patchVal);
    } else {
      out[key] = patchVal ?? baseVal;
    }
  }
  return out;
}

export function getProspectorsState() {
  try {
    const raw = localStorage.getItem(KEY_PROSPECTORS_STATE);
    if (!raw) return createDefaultState();
    return deepMerge(createDefaultState(), JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

function saveProspectorsState(state) {
  localStorage.setItem(KEY_PROSPECTORS_STATE, JSON.stringify(state));
  _onStateChanged?.(state);
}

export function isProspectorsClubOpen() {
  return localStorage.getItem(KEY_PROSPECTORS_OPEN) === "1";
}

export function openProspectorsClub() {
  localStorage.setItem(KEY_PROSPECTORS_OPEN, "1");
}

export function resetProspectorsClub() {
  localStorage.removeItem(KEY_PROSPECTORS_OPEN);
  localStorage.removeItem(KEY_PROSPECTORS_STATE);
}

// ─── ПАССИВНЫЕ ЭФФЕКТЫ ────────────────────────────────────────────────────────

export function hasProspectorUpgrade(id) {
  return !!getProspectorsState().upgrades[id];
}

export function getProspectorPassiveEffects() {
  const s = getProspectorsState();
  return {
    extraStartHp:          s.upgrades.helmet      ? 1    : 0,
    escapeLossMultiplier:  s.upgrades.insurance   ? 0.8  : 1,
    shopVisitorMultiplier: s.upgrades.buzz        ? 1.2  : 1,
    veinSenseChance:       s.upgrades.vein_sense  ? 0.15 : 0,
    idleCollapseBonus:     s.upgrades.experienced ? 10   : 0,
  };
}

// ─── ИНВЕНТАРЬ ────────────────────────────────────────────────────────────────

export function getProspectorInventory() {
  return { ...getProspectorsState().inventory };
}

export function consumeProspectorTool(toolId, qty = 1) {
  const state = getProspectorsState();
  const cur = state.inventory[toolId] ?? 0;
  if (cur < qty) return false;
  state.inventory[toolId] = cur - qty;
  saveProspectorsState(state);
  return true;
}

// Добавить расходник в инвентарь (вызывается из pre-raid магазина в main.js)
export function addConsumableToInventory(toolId, qty = 1, goldSpent = 0) {
  const state = getProspectorsState();
  if (!(toolId in state.inventory)) return false;
  state.inventory[toolId] = (state.inventory[toolId] ?? 0) + qty;
  state.boughtTools = (state.boughtTools ?? 0) + qty;
  state.spentGold   = (state.spentGold   ?? 0) + goldSpent;
  saveProspectorsState(state);
  return true;
}

// ─── ПОКУПКА АПГРЕЙДА В КЛУБЕ ─────────────────────────────────────────────────

function buyUpgrade(upgradeId) {
  const state = getProspectorsState();
  const upg = PROSPECTOR_UPGRADES.find((x) => x.id === upgradeId);
  if (!upg || state.upgrades[upgradeId]) return false;
  if (!_spendGold || !_spendGold(upg.priceGold)) return false;

  state.upgrades[upgradeId] = true;
  state.spentGold = (state.spentGold ?? 0) + upg.priceGold;
  saveProspectorsState(state);
  _onSpendGold?.(upg.priceGold);
  return true;
}

// ─── РЕНДЕР ЭКРАНА КЛУБА ──────────────────────────────────────────────────────

function renderSummary(state) {
  const spentEl  = document.getElementById("prospectors-spent");
  const boughtEl = document.getElementById("prospectors-bought");
  if (spentEl)  spentEl.textContent  = `${state.spentGold ?? 0}`;
  if (boughtEl) boughtEl.textContent = `${state.boughtTools}`;
}

function renderUpgrades(state) {
  const wrap = document.getElementById("prospectors-upgrades");
  if (!wrap) return;

  wrap.innerHTML = PROSPECTOR_UPGRADES.map((upg) => {
    const owned  = !!state.upgrades[upg.id];
    const canBuy = !owned && _getGold && _getGold() >= upg.priceGold;
    return `
      <div class="prospectors-item ${owned ? "prospectors-item-owned" : ""}">
        <div class="prospectors-icon">${upg.icon}</div>
        <div class="prospectors-body">
          <div class="prospectors-title">${upg.label}</div>
          <div class="prospectors-desc">${upg.desc}</div>
          <div class="prospectors-meta">${owned ? "✓ Куплено" : `Цена: ${upg.priceGold} монет`}</div>
        </div>
        <button class="prospectors-buy-btn btn-primary" data-buy-upgrade="${upg.id}" ${canBuy ? "" : "disabled"}>
          ${owned ? "✓ Есть" : "Купить"}
        </button>
      </div>`;
  }).join("");
}

export function renderProspectorsUpgrades() {
  const state = getProspectorsState();
  renderSummary(state);
  renderUpgrades(state);
}

// ─── HTML ЭКРАНА ──────────────────────────────────────────────────────────────

export function buildProspectorsScreen() {
  return `
  <div id="screen-prospectors" class="screen">
    <div class="panel prospectors-panel">
      <div class="panel-header">
        <span class="icon">⛏</span> КЛУБ СТАРАТЕЛЕЙ
        <button class="shop-back-btn btn-primary" id="prospectors-back-btn">← МЕНЮ</button>
      </div>
      <div class="panel-body">
        <p class="prospectors-intro">
          Постоянные улучшения шахтера. Расходники покупай прямо перед вылазкой.
        </p>
        <div class="prospectors-summary">
          <span>Потрачено: <strong id="prospectors-spent">0</strong> монет</span>
          <span>Инструментов куплено: <strong id="prospectors-bought">0</strong></span>
        </div>

        <div class="prospectors-section">
          <h3 class="prospectors-section-title">Постоянные улучшения</h3>
          <div id="prospectors-upgrades" class="prospectors-list"></div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────────────────────

export function initProspectorsScreen({ onBack, getGold, spendGold, onStateChanged, onSpendGold }) {
  _onBack         = onBack;
  _getGold        = getGold;
  _spendGold      = spendGold;
  _onStateChanged = onStateChanged;
  _onSpendGold    = onSpendGold;

  const backBtn = document.getElementById("prospectors-back-btn");
  if (backBtn) backBtn.addEventListener("click", () => _onBack?.());

  const upgradesWrap = document.getElementById("prospectors-upgrades");
  if (upgradesWrap) {
    upgradesWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-buy-upgrade]");
      if (!btn) return;
      const id = btn.getAttribute("data-buy-upgrade");
      if (buyUpgrade(id)) renderProspectorsUpgrades();
    });
  }

  renderProspectorsUpgrades();
}
