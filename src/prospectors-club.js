const KEY_PROSPECTORS_OPEN = "delve_prospectors_open";
const KEY_PROSPECTORS_STATE = "delve_prospectors_state_v1";

export const PROSPECTORS_UNLOCK_COST = 120;

export const PROSPECTOR_TOOLS = [
  {
    id: "dynamite",
    label: "Динамит",
    icon: "💣",
    desc: "Расчищает область 3x3 без урона по HP.",
    priceSilver: 28,
    baseQty: 1,
    targeted: true,
  },
  {
    id: "flare",
    label: "Фальшфейер",
    icon: "🔦",
    desc: "Подсвечивает руду в области 5x5.",
    priceSilver: 18,
    baseQty: 1,
    targeted: true,
  },
  {
    id: "stabilizer",
    label: "Стабилизатор",
    icon: "🧯",
    desc: "Делает нестабильную клетку безопасной.",
    priceSilver: 24,
    baseQty: 1,
    targeted: true,
  },
  {
    id: "medkit",
    label: "Аптечка",
    icon: "🩹",
    desc: "Восстанавливает 1 HP в вылазке.",
    priceSilver: 20,
    baseQty: 1,
    targeted: false,
  },
  {
    id: "magnet",
    label: "Магнит руды",
    icon: "🧲",
    desc: "Собирает всю уже подсвеченную руду.",
    priceSilver: 34,
    baseQty: 1,
    targeted: false,
  },
];

export const PROSPECTOR_UPGRADES = [
  {
    id: "insurance",
    label: "Страховой полис",
    icon: "🛡",
    desc: "Снижает потери руды при досрочном выходе на 20%.",
    priceSilver: 120,
  },
  {
    id: "helmet",
    label: "Усиленная каска",
    icon: "⛑",
    desc: "+1 к стартовому HP в вылазке.",
    priceSilver: 140,
  },
  {
    id: "discount",
    label: "Карта скидок",
    icon: "💸",
    desc: "-20% стоимость расходников клуба.",
    priceSilver: 150,
  },
  {
    id: "supplier",
    label: "Контракт снабжения",
    icon: "📦",
    desc: "При покупке расходника получаешь +1 доп. шт.",
    priceSilver: 130,
  },
  {
    id: "buzz",
    label: "Сарафанное радио",
    icon: "📣",
    desc: "+20% к потоку покупателей в магазине.",
    priceSilver: 170,
  },
];

let _getSilver = null;
let _spendSilver = null;
let _onBack = null;
let _onStateChanged = null;
let _onSpendSilver = null;

function createDefaultState() {
  return {
    inventory: Object.fromEntries(PROSPECTOR_TOOLS.map((t) => [t.id, 0])),
    upgrades: Object.fromEntries(PROSPECTOR_UPGRADES.map((u) => [u.id, false])),
    spentSilver: 0,
    boughtTools: 0,
  };
}

function deepMerge(base, patch) {
  if (!base || typeof base !== "object") return patch ?? base;
  if (!patch || typeof patch !== "object") return { ...base };
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const baseVal = base[key];
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

export function hasProspectorUpgrade(id) {
  return !!getProspectorsState().upgrades[id];
}

export function getProspectorPassiveEffects() {
  const s = getProspectorsState();
  return {
    extraStartHp: s.upgrades.helmet ? 1 : 0,
    escapeLossMultiplier: s.upgrades.insurance ? 0.8 : 1,
    toolsDiscountMultiplier: s.upgrades.discount ? 0.8 : 1,
    purchaseBonusQty: s.upgrades.supplier ? 1 : 0,
    shopVisitorMultiplier: s.upgrades.buzz ? 1.2 : 1,
  };
}

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

function getToolPrice(tool, state = getProspectorsState()) {
  const hasDiscount = !!state.upgrades.discount;
  return Math.max(1, Math.round(tool.priceSilver * (hasDiscount ? 0.8 : 1)));
}

function getToolQtyGain(state = getProspectorsState()) {
  return 1 + (state.upgrades.supplier ? 1 : 0);
}

function buyTool(toolId) {
  const state = getProspectorsState();
  const tool = PROSPECTOR_TOOLS.find((x) => x.id === toolId);
  if (!tool) return false;
  const price = getToolPrice(tool, state);
  if (!_spendSilver || !_spendSilver(price)) return false;

  const qty = tool.baseQty + getToolQtyGain(state) - 1;
  state.inventory[toolId] = (state.inventory[toolId] ?? 0) + qty;
  state.spentSilver += price;
  state.boughtTools += qty;
  saveProspectorsState(state);
  _onSpendSilver?.(price);
  return true;
}

function buyUpgrade(upgradeId) {
  const state = getProspectorsState();
  const upg = PROSPECTOR_UPGRADES.find((x) => x.id === upgradeId);
  if (!upg || state.upgrades[upgradeId]) return false;
  if (!_spendSilver || !_spendSilver(upg.priceSilver)) return false;

  state.upgrades[upgradeId] = true;
  state.spentSilver += upg.priceSilver;
  saveProspectorsState(state);
  _onSpendSilver?.(upg.priceSilver);
  return true;
}

function renderConsumables(state) {
  const wrap = document.getElementById("prospectors-consumables");
  if (!wrap) return;
  const silver = _getSilver ? _getSilver() : 0;

  wrap.innerHTML = PROSPECTOR_TOOLS.map((tool) => {
    const price = getToolPrice(tool, state);
    const canBuy = silver >= price;
    const gain = tool.baseQty + getToolQtyGain(state) - 1;
    const stock = state.inventory[tool.id] ?? 0;
    return `
      <div class="prospectors-item">
        <div class="prospectors-icon">${tool.icon}</div>
        <div class="prospectors-body">
          <div class="prospectors-title">${tool.label}</div>
          <div class="prospectors-desc">${tool.desc}</div>
          <div class="prospectors-meta">Цена: ${price} 🪙 монет · На складе: ${stock}</div>
        </div>
        <button class="prospectors-buy-btn btn-primary" data-buy-tool="${tool.id}" ${canBuy ? "" : "disabled"}>
          Купить (+${gain})
        </button>
      </div>`;
  }).join("");
}

function renderUpgrades(state) {
  const wrap = document.getElementById("prospectors-upgrades");
  if (!wrap) return;
  const silver = _getSilver ? _getSilver() : 0;

  wrap.innerHTML = PROSPECTOR_UPGRADES.map((upg) => {
    const owned = !!state.upgrades[upg.id];
    const canBuy = !owned && silver >= upg.priceSilver;
    return `
      <div class="prospectors-item ${owned ? "prospectors-item-owned" : ""}">
        <div class="prospectors-icon">${upg.icon}</div>
        <div class="prospectors-body">
          <div class="prospectors-title">${upg.label}</div>
          <div class="prospectors-desc">${upg.desc}</div>
          <div class="prospectors-meta">${owned ? "Куплено" : `Цена: ${upg.priceSilver} 🪙 монет`}</div>
        </div>
        <button class="prospectors-buy-btn btn-primary" data-buy-upgrade="${upg.id}" ${canBuy ? "" : "disabled"}>
          ${owned ? "✓ Есть" : "Купить"}
        </button>
      </div>`;
  }).join("");
}

function renderSummary(state) {
  const silverEl = document.getElementById("prospectors-silver");
  const spentEl = document.getElementById("prospectors-spent");
  const boughtEl = document.getElementById("prospectors-bought");
  if (silverEl) silverEl.textContent = `${_getSilver ? _getSilver() : 0} 🪙 монет`;
  if (spentEl) spentEl.textContent = `${state.spentSilver}`;
  if (boughtEl) boughtEl.textContent = `${state.boughtTools}`;
}

export function renderProspectorsUpgrades() {
  const state = getProspectorsState();
  renderSummary(state);
  renderConsumables(state);
  renderUpgrades(state);
}

function bindProspectorActions() {
  const toolsWrap = document.getElementById("prospectors-consumables");
  const upgradesWrap = document.getElementById("prospectors-upgrades");
  if (toolsWrap) {
    toolsWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-buy-tool]");
      if (!btn) return;
      const id = btn.getAttribute("data-buy-tool");
      if (buyTool(id)) renderProspectorsUpgrades();
    });
  }
  if (upgradesWrap) {
    upgradesWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-buy-upgrade]");
      if (!btn) return;
      const id = btn.getAttribute("data-buy-upgrade");
      if (buyUpgrade(id)) renderProspectorsUpgrades();
    });
  }
}

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
          Арсенал для рискованных вылазок: расходники + постоянные апгрейды.
        </p>
        <div class="prospectors-summary">
          <span>Баланс: <strong id="prospectors-silver">0</strong></span>
          <span>Потрачено: <strong id="prospectors-spent">0</strong></span>
          <span>Куплено предметов: <strong id="prospectors-bought">0</strong></span>
        </div>

        <div class="prospectors-section">
          <h3 class="prospectors-section-title">Расходники</h3>
          <div id="prospectors-consumables" class="prospectors-list"></div>
        </div>

        <div class="prospectors-section">
          <h3 class="prospectors-section-title">Постоянные улучшения</h3>
          <div id="prospectors-upgrades" class="prospectors-list"></div>
        </div>
      </div>
    </div>
  </div>`;
}

export function initProspectorsScreen({
  onBack,
  getSilver,
  spendSilver,
  onStateChanged,
  onSpendSilver,
}) {
  _onBack = onBack;
  _getSilver = getSilver;
  _spendSilver = spendSilver;
  _onStateChanged = onStateChanged;
  _onSpendSilver = onSpendSilver;

  const backBtn = document.getElementById("prospectors-back-btn");
  if (backBtn) backBtn.addEventListener("click", () => _onBack?.());
  bindProspectorActions();
  renderProspectorsUpgrades();
}
