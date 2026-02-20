// ═══════════════════════════════════════════════════════════════════════════
// shop-staff.js — Штат магазина (логика найма, зарплат, бонусов)
// ═══════════════════════════════════════════════════════════════════════════

import { spendGold, getGold } from "./shop.js";

// ─── КОНФИГ РОЛЕЙ ─────────────────────────────────────────────────────────────

export const STAFF_ROLES = [
  {
    id:       'seller',
    label:    'Продавец',
    icon:     '🧑‍💼',
    desc:     'Убеждает посетителей совершить покупку.',
    bonus:    '+12% к шансу покупки за уровень',
    // Цена найма каждого следующего уровня (индекс = уровень - 1)
    hireCost: [35, 80, 160],
    // Зарплата в монетах/мин за каждый уровень
    salary:   [4.0, 6.0, 9.0],
  },
  {
    id:       'cashier',
    label:    'Кассир',
    icon:     '🧾',
    desc:     'Продаёт больше руды каждому покупателю.',
    bonus:    '+10% к среднему чеку за уровень',
    hireCost: [50, 110, 210],
    salary:   [5.0, 7.5, 11.0],
  },
  {
    id:       'guard',
    label:    'Охранник',
    icon:     '💂',
    desc:     'Снижает потери от краж и утечек.',
    bonus:    '-35% потерь за уровень',
    hireCost: [60, 130, 240],
    salary:   [5.5, 8.0, 12.0],
  },
  {
    id:       'manager',
    label:    'Управляющий',
    icon:     '🎩',
    desc:     'Повышает эффективность всего персонала.',
    bonus:    '+6% ко всем бонусам штата за уровень',
    hireCost: [120, 250, 450],
    salary:   [9.0, 13.0, 18.0],
  },
];

export const STAFF_MAX_LEVEL = 3;
export const STAFF_BASE_LOSS = 0.06; // 6% базовые потери (без охраны)

// ─── LOCALSTORAGE ─────────────────────────────────────────────────────────────

function staffKey(roleId) {
  return `delve_staff_${roleId}`;
}

// ─── ГЕТТЕРЫ ──────────────────────────────────────────────────────────────────

export function getStaffLevel(roleId) {
  return parseInt(localStorage.getItem(staffKey(roleId)) ?? '0', 10);
}

export function getRoleConfig(roleId) {
  return STAFF_ROLES.find((r) => r.id === roleId) ?? null;
}

// Возвращает стоимость следующего апгрейда или null (если макс)
export function getStaffHireCost(roleId) {
  const lvl = getStaffLevel(roleId);
  if (lvl >= STAFF_MAX_LEVEL) return null;
  const role = getRoleConfig(roleId);
  return role ? role.hireCost[lvl] : null;
}

// Зарплата в монетах/сек (0 если не нанят)
export function getStaffSalaryPerSec(roleId) {
  const lvl = getStaffLevel(roleId);
  if (lvl === 0) return 0;
  const role = getRoleConfig(roleId);
  return role ? role.salary[lvl - 1] / 60 : 0;
}

// Суммарная зарплата всего штата в монетах/сек
export function getTotalSalaryPerSec() {
  return STAFF_ROLES.reduce((sum, r) => sum + getStaffSalaryPerSec(r.id), 0);
}

// ─── ВЫЧИСЛЕНИЕ БОНУСОВ ───────────────────────────────────────────────────────

export function getStaffBonuses() {
  const sellerLvl  = getStaffLevel('seller');
  const cashierLvl = getStaffLevel('cashier');
  const guardLvl   = getStaffLevel('guard');
  const managerLvl = getStaffLevel('manager');

  // Управляющий усиливает всех остальных
  const managerMult = 1 + 0.06 * managerLvl;

  // +12% к шансу покупки за уровень продавца
  const visitorChanceMult = (1 + 0.12 * sellerLvl) * managerMult;

  // +10% к среднему чеку (кол-во руды) за уровень кассира
  const avgBuyMult = (1 + 0.10 * cashierLvl) * managerMult;

  // Потери: 6% базово, охранник снижает на 35% за уровень
  const lossRate = STAFF_BASE_LOSS * Math.pow(1 - 0.35, guardLvl);

  return { visitorChanceMult, avgBuyMult, lossRate };
}

// Удобный геттер текущего процента потерь для UI
export function getCurrentLossRate() {
  return getStaffBonuses().lossRate;
}

// ─── НАЙМ ─────────────────────────────────────────────────────────────────────

export function hireStaff(roleId) {
  const cost = getStaffHireCost(roleId);
  if (cost === null) return false;          // уже макс уровень
  if (getGold() < cost) return false;       // не хватает монет
  if (!spendGold(cost)) return false;
  const newLevel = getStaffLevel(roleId) + 1;
  localStorage.setItem(staffKey(roleId), String(newLevel));
  return true;
}

// ─── ЗАРПЛАТА (вызывать каждую секунду) ──────────────────────────────────────

let _salaryAccumulator = 0; // дробные монеты накапливаются

export function processStaffSalary() {
  const perSec = getTotalSalaryPerSec();
  if (perSec <= 0) return { paid: 0 };
  _salaryAccumulator += perSec;
  const toPay = Math.floor(_salaryAccumulator);
  if (toPay <= 0) return { paid: 0 };
  _salaryAccumulator -= toPay;
  // Вычитаем из золота; если не хватает — платим сколько есть
  const gold = getGold();
  const actual = Math.min(toPay, gold);
  if (actual > 0) {
    localStorage.setItem('delve_gold', String(gold - actual));
  }
  return { paid: actual };
}

// ─── СБРОС ────────────────────────────────────────────────────────────────────

export function resetStaff() {
  STAFF_ROLES.forEach((r) => localStorage.removeItem(staffKey(r.id)));
  _salaryAccumulator = 0;
}
