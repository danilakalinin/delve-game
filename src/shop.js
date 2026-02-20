// ═══════════════════════════════════════════════════════════════════════════
// shop.js — Логика idle-магазина
// ═══════════════════════════════════════════════════════════════════════════

import { getProspectorPassiveEffects } from "./prospectors-club.js";
import { ORE_COPPER, ORE_SILVER, ORE_GOLD, ORE_DIAMOND, ORE_CONFIG } from "./game.js";
import { getStaffBonuses, getStaffLevel } from "./shop-staff.js";

// ─── КЛЮЧИ ХРАНИЛИЩА ──────────────────────────────────────────────────────────

const KEY_GOLD      = "delve_gold";
const KEY_ADS_LEVEL = "delve_ads_level";
const KEY_SHOP_OPEN = "delve_shop_open";

// Банки руды по каждому типу
export const ORE_BANK_KEYS = {
  [ORE_COPPER]:  "delve_bank_copper",
  [ORE_SILVER]:  "delve_bank_silver",
  [ORE_GOLD]:    "delve_bank_gold",
  [ORE_DIAMOND]: "delve_bank_diamond",
};

// ─── КОНФИГУРАЦИЯ ─────────────────────────────────────────────────────────────

// Базовая цена за 1 медную руду (остальные умножаются на priceMultiplier из ORE_CONFIG)
export const BASE_ORE_PRICE = 5;

export const SHOP_CONFIG = {
  visitorChance: 0.06,  // ~1 посетитель / 16 сек без рекламы
  minBuy: 2,
  maxBuy: 6,
};

export const VISITOR_NAMES = [
  "Артем", "Лера", "Вика", "Кирилл", "Мирон", "Даша", "Илья", "Соня", "Ярослав", "Кира",
  "Тимур", "Злата", "Никита", "Ева", "Лев", "Алиса", "Макс", "Агата", "Роман", "Мила",
  "Денис", "Ника", "Олег", "Полина", "Егор", "Тася", "Глеб", "Арина", "Савва", "Рита",
  "Семен", "Лина", "Влад", "Лиана", "Павел", "Эля", "Антон", "Юля", "Богдан", "Яна",
  "Костя", "Марта", "Руслан", "Диана", "Вадим", "Варя", "Стас", "Эмма", "Матвей", "Майя",
];

const FLOW_PHASES = [
  { id: "quiet", label: "Тихий час", durationSec: 40, flowMult: 0.65 },
  { id: "normal", label: "Рабочий поток", durationSec: 80, flowMult: 1.0 },
  { id: "peak", label: "Час пик", durationSec: 45, flowMult: 1.65 },
  { id: "rush", label: "Наплыв", durationSec: 25, flowMult: 2.15 },
];

const FLOW_STATE = {
  phaseIndex: 0,
  phaseElapsedSec: 0,
  queue: [],
  nextVisitorId: 1,
  arrivedLastTick: 0,
  servedLastTick: 0,
  leftLastTick: 0,
  overflowLastTick: 0,
  expectedArrivalsPerSec: 0,
  checkoutRatePerSec: 1,
  arrivedPreview: [],
};

// Цена конкретного вида руды
export function getOrePrice(oreType) {
  const cfg = ORE_CONFIG[oreType];
  return cfg ? BASE_ORE_PRICE * cfg.priceMultiplier : BASE_ORE_PRICE;
}

// ─── УРОВНИ РЕКЛАМЫ ───────────────────────────────────────────────────────────

export const ADS_UPGRADES = [
  {
    level: 1,
    label: "Листовки",
    desc: "Расклеить объявления у рынка. +100% посетителей.",
    cost: 20,
    mult: 2.0,
    bulkMult: 1.0,
  },
  {
    level: 2,
    label: "Глашатай",
    desc: "Нанять зазывалу. +200% посетителей.",
    cost: 80,
    mult: 3.0,
    bulkMult: 1.0,
  },
  {
    level: 3,
    label: "Репутация",
    desc: "Слухи о шахтёре ходят по всему краю. +400% посетителей.",
    cost: 200,
    mult: 5.0,
    bulkMult: 1.1,
  },
  {
    level: 4,
    label: "Торговые агенты",
    desc: "Сеть перекупов в соседних городах. +700% посетителей и больше оптовых заказов.",
    cost: 420,
    mult: 8.0,
    bulkMult: 1.25,
  },
  {
    level: 5,
    label: "Складской хаб",
    desc: "Поток клиентов через центральный склад. +1100% посетителей и крупные покупки.",
    cost: 820,
    mult: 12.0,
    bulkMult: 1.45,
  },
  {
    level: 6,
    label: "Оптовая сеть",
    desc: "Контракты с артелью и фабриками. +1700% посетителей и мощный опт.",
    cost: 1500,
    mult: 18.0,
    bulkMult: 1.7,
  },
];

// ─── БАНКИ РУД ────────────────────────────────────────────────────────────────

export function getOreBank(oreType) {
  const key = ORE_BANK_KEYS[oreType];
  if (!key) return 0;
  return parseInt(localStorage.getItem(key) ?? "0", 10);
}

export function addOreToBank(oreType, n) {
  const key = ORE_BANK_KEYS[oreType];
  if (!key || n <= 0) return;
  localStorage.setItem(key, String(getOreBank(oreType) + n));
}

export function spendOreFromBank(oreType, n) {
  const key = ORE_BANK_KEYS[oreType];
  if (!key) return false;
  const cur = getOreBank(oreType);
  if (cur < n) return false;
  localStorage.setItem(key, String(cur - n));
  return true;
}

// Суммарное количество всей руды в банке
export function getTotalOreInBank() {
  return Object.keys(ORE_BANK_KEYS).reduce((s, t) => s + getOreBank(t), 0);
}

// ─── ЧИТАЕМ/ПИШЕМ ЗОЛОТО ──────────────────────────────────────────────────────

export function getGold() {
  return parseInt(localStorage.getItem(KEY_GOLD) ?? "0", 10);
}
export function addGold(n) {
  localStorage.setItem(KEY_GOLD, String(getGold() + n));
}
export function spendGold(n) {
  const cur = getGold();
  if (cur < n) return false;
  localStorage.setItem(KEY_GOLD, String(cur - n));
  return true;
}

export function getAdsLevel() {
  return parseInt(localStorage.getItem(KEY_ADS_LEVEL) ?? "0", 10);
}
export function isShopOpen() {
  return localStorage.getItem(KEY_SHOP_OPEN) === "1";
}
export function openShop() {
  localStorage.setItem(KEY_SHOP_OPEN, "1");
}

export function resetShop() {
  localStorage.removeItem(KEY_GOLD);
  localStorage.removeItem(KEY_ADS_LEVEL);
  // Банки руд сбрасываем отдельно (совместно с resetProgress в main.js)
}

// ─── ВЫЧИСЛЕНИЕ ШАНСА ПОСЕТИТЕЛЯ ─────────────────────────────────────────────

export function getCurrentVisitorChance() {
  const adsLevel = getAdsLevel();
  const adUpg = ADS_UPGRADES.find((u) => u.level === adsLevel);
  const mult = adUpg ? adUpg.mult : 1.0;
  const passives = getProspectorPassiveEffects();
  const staffBonuses = getStaffBonuses();
  const chance = (
    SHOP_CONFIG.visitorChance * mult
    * (passives.shopVisitorMultiplier ?? 1)
    * staffBonuses.visitorChanceMult
  );
  return Math.min(0.95, chance);
}

export function getCurrentBulkMultiplier() {
  const adsLevel = getAdsLevel();
  const adUpg = ADS_UPGRADES.find((u) => u.level === adsLevel);
  return adUpg?.bulkMult ?? 1.0;
}

export function getCurrentAdsUpgrade() {
  const adsLevel = getAdsLevel();
  return ADS_UPGRADES.find((u) => u.level === adsLevel) ?? null;
}

export function getPreferredOreForSale() {
  const oreOrder = [ORE_DIAMOND, ORE_GOLD, ORE_SILVER, ORE_COPPER];
  for (const t of oreOrder) {
    if (getOreBank(t) > 0) return t;
  }
  return ORE_COPPER;
}

// ─── УТИЛИТЫ ДЛЯ UI ──────────────────────────────────────────────────────────

export function getLossRate() {
  return getStaffBonuses().lossRate;
}

function getCurrentPhase() {
  return FLOW_PHASES[FLOW_STATE.phaseIndex] ?? FLOW_PHASES[0];
}

function advanceFlowPhase() {
  FLOW_STATE.phaseElapsedSec += 1;
  const phase = getCurrentPhase();
  if (FLOW_STATE.phaseElapsedSec >= phase.durationSec) {
    FLOW_STATE.phaseIndex = (FLOW_STATE.phaseIndex + 1) % FLOW_PHASES.length;
    FLOW_STATE.phaseElapsedSec = 0;
  }
}

function pickVisitorName() {
  const idx = Math.floor(Math.random() * VISITOR_NAMES.length);
  return VISITOR_NAMES[idx] ?? "Гость";
}

function getQueueCapacity() {
  const adsLevel = getAdsLevel();
  return 10 + adsLevel * 3;
}

function spawnQueueVisitors(expectedPerSec) {
  let arrivals = Math.floor(expectedPerSec);
  const frac = expectedPerSec - arrivals;
  if (Math.random() < frac) arrivals += 1;

  FLOW_STATE.arrivedLastTick = arrivals;
  FLOW_STATE.overflowLastTick = 0;
  FLOW_STATE.arrivedPreview = [];

  const queueCap = getQueueCapacity();
  for (let i = 0; i < arrivals; i += 1) {
    if (FLOW_STATE.queue.length >= queueCap) {
      FLOW_STATE.overflowLastTick += 1;
      continue;
    }
    FLOW_STATE.queue.push({
      id: FLOW_STATE.nextVisitorId++,
      name: pickVisitorName(),
      patienceSec: 14 + Math.floor(Math.random() * 20),
      orderScale: 0.85 + Math.random() * 0.6,
    });
    if (FLOW_STATE.arrivedPreview.length < 6) {
      FLOW_STATE.arrivedPreview.push(FLOW_STATE.queue[FLOW_STATE.queue.length - 1].name);
    }
  }
}

function applyQueuePatienceLoss() {
  let left = 0;
  FLOW_STATE.queue.forEach((v) => { v.patienceSec -= 1; });
  FLOW_STATE.queue = FLOW_STATE.queue.filter((v) => {
    if (v.patienceSec > 0) return true;
    left += 1;
    return false;
  });
  FLOW_STATE.leftLastTick = left + FLOW_STATE.overflowLastTick;
}

function getCheckoutRatePerSec() {
  const sellerLvl = getStaffLevel("seller");
  const managerLvl = getStaffLevel("manager");
  // Без продавцов касса работает очень медленно, поэтому очередь заметна.
  // Нанятые продавцы резко ускоряют разгрузку очереди.
  return Math.min(2.8, 0.06 + sellerLvl * 0.40 + managerLvl * 0.12);
}

function getCheckoutSlotsPerTick() {
  const rate = FLOW_STATE.checkoutRatePerSec;
  let slots = Math.floor(rate);
  if (Math.random() < rate - slots) slots += 1;
  return Math.max(1, slots);
}

export function getShopFlowState() {
  const phase = getCurrentPhase();
  return {
    phaseId: phase.id,
    phaseLabel: phase.label,
    phaseFlowMult: phase.flowMult,
    phaseProgress: phase.durationSec > 0 ? (FLOW_STATE.phaseElapsedSec / phase.durationSec) : 0,
    queueSize: FLOW_STATE.queue.length,
    queueCapacity: getQueueCapacity(),
    queue: FLOW_STATE.queue.slice(0, 12).map((v) => ({
      id: v.id,
      name: v.name,
      patienceSec: v.patienceSec,
    })),
    arrivedLastTick: FLOW_STATE.arrivedLastTick,
    servedLastTick: FLOW_STATE.servedLastTick,
    leftLastTick: FLOW_STATE.leftLastTick,
    expectedArrivalsPerSec: FLOW_STATE.expectedArrivalsPerSec,
    checkoutRatePerSec: FLOW_STATE.checkoutRatePerSec,
    arrivedPreview: FLOW_STATE.arrivedPreview.slice(),
  };
}

// ─── NEXT ADS UPGRADE ─────────────────────────────────────────────────────────

export function getNextAdsUpgrade() {
  const cur = getAdsLevel();
  return ADS_UPGRADES.find((u) => u.level === cur + 1) ?? null;
}

export function buyAdsUpgrade() {
  const next = getNextAdsUpgrade();
  if (!next) return false;
  if (!spendGold(next.cost)) return false;
  localStorage.setItem(KEY_ADS_LEVEL, String(next.level));
  return true;
}

// ─── ТИК МАГАЗИНА ─────────────────────────────────────────────────────────────
//
// Посетитель выбирает самую ценную доступную руду и покупает её.
// Возвращает null | { oreType, oreBought, goldEarned }

export function shopTick() {
  if (!isShopOpen()) return null;

  advanceFlowPhase();
  const phase = getCurrentPhase();
  const chance = getCurrentVisitorChance();
  const hasStock = getTotalOreInBank() > 0;
  const baseArrivalsPerSec = Math.min(3.6, chance * phase.flowMult * (hasStock ? 1 : 0.65));
  FLOW_STATE.expectedArrivalsPerSec = baseArrivalsPerSec;
  spawnQueueVisitors(baseArrivalsPerSec);
  applyQueuePatienceLoss();

  const staffBonuses = getStaffBonuses();
  const { minBuy, maxBuy } = SHOP_CONFIG;
  const bulkMult = getCurrentBulkMultiplier();
  FLOW_STATE.checkoutRatePerSec = getCheckoutRatePerSec();
  const checkoutSlots = getCheckoutSlotsPerTick();

  let served = 0;
  let oreBoughtTotal = 0;
  let goldEarnedTotal = 0;
  let soldOreType = null;

  for (let i = 0; i < checkoutSlots; i += 1) {
    if (!FLOW_STATE.queue.length) break;

    const visitor = FLOW_STATE.queue.shift();
    if (!visitor) break;
    served += 1;

    // Выбираем руду для покупки — приоритет самой ценной (которая есть в банке)
    const oreOrder = [ORE_DIAMOND, ORE_GOLD, ORE_SILVER, ORE_COPPER];
    let chosenType = null;
    for (const t of oreOrder) {
      if (getOreBank(t) > 0) { chosenType = t; break; }
    }
    if (!chosenType) continue;

    const baseWants = minBuy + Math.floor(Math.random() * (maxBuy - minBuy + 1));
    const wants = Math.max(1, Math.round(baseWants * staffBonuses.avgBuyMult * bulkMult * visitor.orderScale));
    const avail = getOreBank(chosenType);
    const oreBought = Math.min(wants, avail);
    if (oreBought <= 0) continue;

    const price = getOrePrice(chosenType);
    const grossEarned = oreBought * price;
    const goldEarned = Math.max(1, Math.round(grossEarned * (1 - staffBonuses.lossRate)));

    spendOreFromBank(chosenType, oreBought);
    addGold(goldEarned);

    oreBoughtTotal += oreBought;
    goldEarnedTotal += goldEarned;
    soldOreType = soldOreType ?? chosenType;
  }

  FLOW_STATE.servedLastTick = served;
  if (oreBoughtTotal <= 0 || goldEarnedTotal <= 0 || !soldOreType) return null;

  return { oreType: soldOreType, oreBought: oreBoughtTotal, goldEarned: goldEarnedTotal, buyersServed: served };
}
