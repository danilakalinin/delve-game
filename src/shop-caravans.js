import {
  ORE_COPPER,
  ORE_SILVER,
  ORE_GOLD,
  ORE_DIAMOND,
  ORE_CONFIG,
} from "./game.js";
import {
  addGold,
  getGold,
  getOreBank,
  getOrePrice,
  spendGold,
  spendOreFromBank,
} from "./shop.js";

const KEY_CARAVANS = "delve_caravans_v1";

export const BASE_MAX_ACTIVE_CARAVANS = 2;

export const CARAVAN_ROUTES = [
  {
    id: "small",
    label: "Малый караван",
    icon: "🐎",
    dispatchCost: 120,
    durationSec: 120,
    cargo: 80,
    risk: 0.10,
    priceMult: 1.25,
  },
  {
    id: "medium",
    label: "Средний караван",
    icon: "🚚",
    dispatchCost: 280,
    durationSec: 240,
    cargo: 220,
    risk: 0.18,
    priceMult: 1.45,
  },
  {
    id: "large",
    label: "Большой караван",
    icon: "🚂",
    dispatchCost: 620,
    durationSec: 420,
    cargo: 520,
    risk: 0.27,
    priceMult: 1.75,
  },
];

export const CARAVAN_UPGRADES = [
  {
    id: "logistics",
    icon: "🗺",
    label: "Логистика",
    desc: "+1 активный караван за уровень.",
    maxLevel: 2,
    costs: [240, 420],
  },
  {
    id: "safety",
    icon: "🛡",
    label: "Охрана маршрутов",
    desc: "Снижает риск потери рейса.",
    maxLevel: 3,
    costs: [160, 280, 460],
  },
  {
    id: "cargo",
    icon: "📦",
    label: "Грузовые платформы",
    desc: "Увеличивает объем груза.",
    maxLevel: 3,
    costs: [180, 320, 520],
  },
  {
    id: "broker",
    icon: "🤝",
    label: "Торговые агенты",
    desc: "Повышает выплату за доставленный груз.",
    maxLevel: 3,
    costs: [200, 360, 580],
  },
];

const ORE_ORDER = [ORE_COPPER, ORE_SILVER, ORE_GOLD, ORE_DIAMOND];

function nowMs() {
  return Date.now();
}

function createDefaultState() {
  return {
    active: [],
    nextId: 1,
    upgrades: Object.fromEntries(CARAVAN_UPGRADES.map((u) => [u.id, 0])),
    stats: {
      runsTotal: 0,
      successTotal: 0,
      failTotal: 0,
      oreSentTotal: 0,
      incomeTotal: 0,
      expensesTotal: 0,
      bestProfit: 0,
      worstLoss: 0,
      upgradeSpent: 0,
    },
  };
}

export function getCaravansState() {
  try {
    const raw = localStorage.getItem(KEY_CARAVANS);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return {
      ...createDefaultState(),
      ...parsed,
      upgrades: {
        ...createDefaultState().upgrades,
        ...(parsed?.upgrades ?? {}),
      },
      stats: {
        ...createDefaultState().stats,
        ...(parsed?.stats ?? {}),
      },
      active: Array.isArray(parsed?.active) ? parsed.active : [],
    };
  } catch {
    return createDefaultState();
  }
}

function saveCaravansState(state) {
  localStorage.setItem(KEY_CARAVANS, JSON.stringify(state));
}

export function resetCaravans() {
  localStorage.removeItem(KEY_CARAVANS);
}

export function getRouteById(routeId) {
  return CARAVAN_ROUTES.find((r) => r.id === routeId) ?? null;
}

function nextOreType(oreType) {
  return ORE_ORDER.includes(oreType) ? oreType : ORE_COPPER;
}

function getUpgradeLevel(state, upgradeId) {
  return state.upgrades?.[upgradeId] ?? 0;
}

export function getEffectiveMaxActive(state = getCaravansState()) {
  return BASE_MAX_ACTIVE_CARAVANS + getUpgradeLevel(state, "logistics");
}

export function getEffectiveRoute(route, state = getCaravansState()) {
  const safetyLvl = getUpgradeLevel(state, "safety");
  const cargoLvl = getUpgradeLevel(state, "cargo");
  const brokerLvl = getUpgradeLevel(state, "broker");

  const effectiveRisk = Math.max(0.03, route.risk * Math.pow(0.87, safetyLvl));
  const effectiveCargo = Math.max(1, Math.round(route.cargo * Math.pow(1.18, cargoLvl)));
  const effectivePriceMult = route.priceMult * Math.pow(1.10, brokerLvl);

  return {
    ...route,
    effectiveRisk,
    effectiveCargo,
    effectivePriceMult,
  };
}

export function getMaxSendForRoute(routeId, oreType) {
  const route = getRouteById(routeId);
  if (!route) return 0;
  const state = getCaravansState();
  const effective = getEffectiveRoute(route, state);
  return Math.min(effective.effectiveCargo, getOreBank(nextOreType(oreType)));
}

export function canSendCaravan(routeId, oreType) {
  const route = getRouteById(routeId);
  if (!route) return false;
  const state = getCaravansState();
  if (state.active.length >= getEffectiveMaxActive(state)) return false;
  if (getGold() < route.dispatchCost) return false;
  if (getMaxSendForRoute(routeId, oreType) <= 0) return false;
  return true;
}

export function buyCaravanUpgrade(upgradeId) {
  const state = getCaravansState();
  const cfg = CARAVAN_UPGRADES.find((u) => u.id === upgradeId);
  if (!cfg) return null;
  const lvl = getUpgradeLevel(state, upgradeId);
  if (lvl >= cfg.maxLevel) return null;
  const cost = cfg.costs[lvl];
  if (!spendGold(cost)) return null;

  state.upgrades[upgradeId] = lvl + 1;
  state.stats.upgradeSpent += cost;
  saveCaravansState(state);

  return {
    upgradeId,
    level: lvl + 1,
    cost,
    line: `${cfg.icon} Улучшение «${cfg.label}» повышено до ${lvl + 1} ур.`,
  };
}

export function sendCaravan(routeId, oreType) {
  const route = getRouteById(routeId);
  if (!route) return null;
  const type = nextOreType(oreType);
  const state = getCaravansState();
  const effective = getEffectiveRoute(route, state);

  if (state.active.length >= getEffectiveMaxActive(state)) return null;
  if (!spendGold(route.dispatchCost)) return null;

  const amount = Math.min(effective.effectiveCargo, getOreBank(type));
  if (amount <= 0) {
    addGold(route.dispatchCost);
    return null;
  }
  if (!spendOreFromBank(type, amount)) {
    addGold(route.dispatchCost);
    return null;
  }

  const startedAt = nowMs();
  const finishesAt = startedAt + route.durationSec * 1000;
  const caravan = {
    id: state.nextId++,
    routeId: route.id,
    oreType: type,
    oreAmount: amount,
    dispatchCost: route.dispatchCost,
    durationSec: route.durationSec,
    risk: effective.effectiveRisk,
    priceMult: effective.effectivePriceMult,
    startedAt,
    finishesAt,
  };
  state.active.push(caravan);
  state.stats.runsTotal += 1;
  state.stats.oreSentTotal += amount;
  state.stats.expensesTotal += route.dispatchCost;
  saveCaravansState(state);

  return {
    caravan,
    eventLine: `${route.icon} ${route.label} отправлен: ${amount} ${ORE_CONFIG[type].label.toLowerCase()}.`,
  };
}

function finishCaravan(caravan, state) {
  const basePrice = getOrePrice(caravan.oreType);
  const gross = caravan.oreAmount * basePrice * caravan.priceMult;
  const success = Math.random() >= caravan.risk;

  if (!success) {
    state.stats.failTotal += 1;
    const loss = caravan.dispatchCost;
    state.stats.worstLoss = Math.max(state.stats.worstLoss, loss);
    return {
      ok: false,
      profit: -caravan.dispatchCost,
      payout: 0,
      oreType: caravan.oreType,
      oreAmount: caravan.oreAmount,
      routeId: caravan.routeId,
      line: `☠ Караван потерян: ${caravan.oreAmount} груза пропало.`,
      tone: "bad",
    };
  }

  const payout = Math.max(1, Math.round(gross));
  addGold(payout);
  state.stats.successTotal += 1;
  state.stats.incomeTotal += payout;
  const profit = payout - caravan.dispatchCost;
  state.stats.bestProfit = Math.max(state.stats.bestProfit, profit);
  return {
    ok: true,
    profit,
    payout,
    oreType: caravan.oreType,
    oreAmount: caravan.oreAmount,
    routeId: caravan.routeId,
    line: `✅ Караван вернулся: +${payout} монет.`,
    tone: "good",
  };
}

export function processCaravansTick() {
  const state = getCaravansState();
  if (!state.active.length) return null;
  const now = nowMs();
  const finished = [];
  const ongoing = [];

  for (const caravan of state.active) {
    if (now >= caravan.finishesAt) finished.push(caravan);
    else ongoing.push(caravan);
  }
  if (!finished.length) return null;

  state.active = ongoing;
  const results = finished.map((caravan) => finishCaravan(caravan, state));
  saveCaravansState(state);
  return {
    results,
    state,
  };
}
