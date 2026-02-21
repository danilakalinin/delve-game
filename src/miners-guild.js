import { ORE_COPPER, ORE_SILVER, ORE_GOLD, ORE_DIAMOND } from "./game.js";

const KEY_GUILD_OPEN = "delve_miners_guild_open";
const KEY_GUILD_STATE = "delve_miners_guild_state_v2";
const KEY_GUILD_CANDIDATES_COLLAPSED = "delve_guild_candidates_collapsed";

export const MINERS_GUILD_UNLOCK_COST = 240;

const SALARY_MIN = 3;
const SALARY_MAX = 40;
const CANDIDATE_POOL_SIZE = 3;

const GUILD_DIFFS = {
  easy: {
    label: "Легкая",
    runSec: 55,
    oreMin: 1,
    oreMax: 3,
    deathChance: 0.008,
  },
  normal: {
    label: "Средняя",
    runSec: 40,
    oreMin: 2,
    oreMax: 5,
    deathChance: 0.022,
  },
  hard: {
    label: "Сложная",
    runSec: 28,
    oreMin: 3,
    oreMax: 8,
    deathChance: 0.055,
  },
};

const GUILD_UPGRADES = [
  {
    id: "bunks",
    label: "Бараки",
    icon: "🛏",
    desc: "Увеличивает лимит наёмников на +2.",
    maxLevel: 3,
    costs: [90, 150, 230],
  },
  {
    id: "safety",
    label: "Техника безопасности",
    icon: "🦺",
    desc: "Снижает базовый шанс гибели бригады.",
    maxLevel: 3,
    costs: [80, 140, 220],
  },
  {
    id: "tools",
    label: "Инструменты бригады",
    icon: "⛏",
    desc: "Повышает добычу руды за рейс.",
    maxLevel: 3,
    costs: [100, 170, 260],
  },
  {
    id: "dispatch",
    label: "Диспетчер",
    icon: "📋",
    desc: "Ускоряет завершение рейсов.",
    maxLevel: 2,
    costs: [120, 210],
  },
];

const FIRST_NAMES = [
  "Артем",
  "Марк",
  "Лев",
  "Илья",
  "Егор",
  "Олег",
  "Тимур",
  "Никита",
  "Роман",
  "Денис",
  "София",
  "Мира",
  "Ева",
  "Алиса",
  "Лина",
  "Дарья",
  "Полина",
  "Яна",
];

const NICKNAMES = [
  "Кувалда",
  "Пыльник",
  "Тихоня",
  "Скала",
  "Факел",
  "Крот",
  "Глыба",
  "Рубило",
  "Шторм",
  "Радар",
  "Норд",
  "Вольт",
];

let _getSilver = null;
let _spendSilver = null;
let _onBack = null;
let _onStateChanged = null;
let _onSpendSilver = null;
let _onRequestRename = null;

function nowMs() {
  return Date.now();
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function deepMerge(base, patch) {
  if (Array.isArray(base)) {
    return Array.isArray(patch) ? patch : base.slice();
  }
  if (!base || typeof base !== "object") return patch ?? base;
  const out = { ...base };
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return out;
  for (const key of Object.keys(base)) {
    const baseVal = base[key];
    const patchVal = patch[key];
    if (Array.isArray(baseVal)) out[key] = Array.isArray(patchVal) ? patchVal : baseVal.slice();
    else if (baseVal && typeof baseVal === "object") out[key] = deepMerge(baseVal, patchVal);
    else out[key] = patchVal ?? baseVal;
  }
  return out;
}

function randomCandidateName() {
  return `${FIRST_NAMES[randInt(0, FIRST_NAMES.length - 1)]} «${NICKNAMES[randInt(0, NICKNAMES.length - 1)]}»`;
}

function createCandidate(id) {
  const speed = randInt(2, 5);
  const safety = randInt(2, 5);
  const yieldStat = randInt(2, 5);
  const expectedSalary = 4 + speed + safety + yieldStat;
  return {
    id,
    name: randomCandidateName(),
    stats: { speed, safety, yield: yieldStat },
    expectedSalary,
  };
}

function createDefaultState() {
  return {
    name: "",
    difficulty: "normal",
    miners: [],
    candidates: [createCandidate(1), createCandidate(2), createCandidate(3)],
    nextMinerId: 1,
    nextCandidateId: 4,
    upgrades: Object.fromEntries(GUILD_UPGRADES.map((u) => [u.id, 0])),
    stats: {
      hiredTotal: 0,
      deathsTotal: 0,
      quitsTotal: 0,
      oreMinedTotal: 0,
      oreByType: {
        [ORE_COPPER]: 0,
        [ORE_SILVER]: 0,
        [ORE_GOLD]: 0,
        [ORE_DIAMOND]: 0,
      },
      silverSpentTotal: 0,
      salaryPaidTotal: 0,
      trainingSpentTotal: 0,
      runsTotal: 0,
    },
    logs: [],
    lastTickAt: nowMs(),
  };
}

function isCandidatesCollapsed() {
  return localStorage.getItem(KEY_GUILD_CANDIDATES_COLLAPSED) === "1";
}

function setCandidatesCollapsed(v) {
  localStorage.setItem(KEY_GUILD_CANDIDATES_COLLAPSED, v ? "1" : "0");
}

export function getMinersGuildState() {
  try {
    const raw = localStorage.getItem(KEY_GUILD_STATE);
    if (!raw) return createDefaultState();
    const merged = deepMerge(createDefaultState(), JSON.parse(raw));
    if (!Array.isArray(merged.candidates)) merged.candidates = [];
    while (merged.candidates.length < CANDIDATE_POOL_SIZE) {
      merged.candidates.push(createCandidate(merged.nextCandidateId++));
    }
    return merged;
  } catch {
    return createDefaultState();
  }
}

function saveState(state) {
  localStorage.setItem(KEY_GUILD_STATE, JSON.stringify(state));
  _onStateChanged?.(state);
}

export function isMinersGuildOpen() {
  return localStorage.getItem(KEY_GUILD_OPEN) === "1";
}

export function openMinersGuild() {
  localStorage.setItem(KEY_GUILD_OPEN, "1");
}

export function resetMinersGuild() {
  localStorage.removeItem(KEY_GUILD_OPEN);
  localStorage.removeItem(KEY_GUILD_STATE);
}

export function getMinersGuildName() {
  return getMinersGuildState().name?.trim() ?? "";
}

export function setMinersGuildName(name) {
  const state = getMinersGuildState();
  state.name = (name || "").trim();
  saveState(state);
}

function getGuildCapacity(state) {
  return 2 + (state.upgrades.bunks ?? 0) * 2;
}

function getHireCost(state) {
  return 28 + state.miners.length * 9 + Math.floor(state.stats.hiredTotal * 2.0);
}

function getDifficultyConfig(state) {
  return GUILD_DIFFS[state.difficulty] ?? GUILD_DIFFS.normal;
}

function getEffectiveRunSecBase(state) {
  const base = getDifficultyConfig(state).runSec;
  const dispatchLvl = state.upgrades.dispatch ?? 0;
  return Math.max(12, Math.round(base * Math.pow(0.9, dispatchLvl)));
}

function getEffectiveDeathChanceBase(state) {
  const base = getDifficultyConfig(state).deathChance;
  const safetyLvl = state.upgrades.safety ?? 0;
  return Math.max(0.003, base * Math.pow(0.84, safetyLvl));
}

function getEffectiveOreRangeBase(state) {
  const cfg = getDifficultyConfig(state);
  const bonus = state.upgrades.tools ?? 0;
  return {
    min: cfg.oreMin + bonus,
    max: cfg.oreMax + bonus * 2,
  };
}

function pushLog(state, text, tone = "neutral") {
  state.logs.unshift({ at: new Date().toISOString(), text, tone });
  state.logs = state.logs.slice(0, 40);
}

function refillCandidates(state) {
  while (state.candidates.length < CANDIDATE_POOL_SIZE) {
    state.candidates.push(createCandidate(state.nextCandidateId++));
  }
}

function estimateMoodTarget(miner) {
  const salaryRatio = miner.salaryPerMin / Math.max(1, miner.expectedSalary);
  if (salaryRatio >= 1.45) return 94;
  if (salaryRatio >= 1.2) return 84;
  if (salaryRatio >= 1.0) return 73;
  if (salaryRatio >= 0.8) return 56;
  return 42;
}

function normalizeMiner(miner, runSec) {
  if (!miner.stats) miner.stats = { speed: 3, safety: 3, yield: 3 };
  miner.stats.speed = clamp(miner.stats.speed ?? 3, 1, 8);
  miner.stats.safety = clamp(miner.stats.safety ?? 3, 1, 8);
  miner.stats.yield = clamp(miner.stats.yield ?? 3, 1, 8);
  miner.expectedSalary = clamp(miner.expectedSalary ?? (4 + miner.stats.speed + miner.stats.safety + miner.stats.yield), SALARY_MIN, SALARY_MAX);
  miner.salaryPerMin = clamp(miner.salaryPerMin ?? miner.expectedSalary, SALARY_MIN, SALARY_MAX);
  miner.mood = clamp(miner.mood ?? 72, 0, 100);
  miner.cooldown = clamp(miner.cooldown ?? runSec, 1, 999999);
}

function hireCandidate(candidateId) {
  const state = getMinersGuildState();
  const cap = getGuildCapacity(state);
  if (state.miners.length >= cap) return false;

  const idx = state.candidates.findIndex((c) => c.id === candidateId);
  if (idx < 0) return false;

  const cost = getHireCost(state);
  if (!_spendSilver || !_spendSilver(cost)) return false;

  const candidate = state.candidates[idx];
  const runSec = getEffectiveRunSecBase(state);
  state.miners.push({
    id: state.nextMinerId++,
    name: candidate.name,
    stats: { ...candidate.stats },
    expectedSalary: candidate.expectedSalary,
    salaryPerMin: candidate.expectedSalary,
    mood: 72,
    cooldown: randInt(Math.max(10, Math.round(runSec * 0.35)), runSec),
  });
  state.candidates.splice(idx, 1);
  refillCandidates(state);

  state.stats.hiredTotal += 1;
  state.stats.silverSpentTotal += cost;
  pushLog(state, `👷 Нанят ${candidate.name}.`, "good");
  saveState(state);
  _onSpendSilver?.(cost);
  return true;
}

function fireMiner(id) {
  const state = getMinersGuildState();
  const idx = state.miners.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  const miner = state.miners[idx];
  state.miners.splice(idx, 1);
  pushLog(state, `📤 ${miner.name} уволен из гильдии.`, "neutral");
  saveState(state);
  return true;
}

function adjustMinerSalary(id, delta) {
  const state = getMinersGuildState();
  const miner = state.miners.find((m) => m.id === id);
  if (!miner) return false;
  const next = clamp((miner.salaryPerMin ?? miner.expectedSalary) + delta, SALARY_MIN, SALARY_MAX);
  if (next === miner.salaryPerMin) return false;
  miner.salaryPerMin = next;
  saveState(state);
  return true;
}

function getTrainingCost(miner, statKey) {
  return 24 + (miner.stats[statKey] ?? 1) * 18;
}

function trainMinerStat(minerId, statKey) {
  if (!["speed", "safety", "yield"].includes(statKey)) return false;
  const state = getMinersGuildState();
  const miner = state.miners.find((m) => m.id === minerId);
  if (!miner) return false;
  if ((miner.stats[statKey] ?? 1) >= 8) return false;

  const cost = getTrainingCost(miner, statKey);
  if (!_spendSilver || !_spendSilver(cost)) return false;

  miner.stats[statKey] += 1;
  miner.expectedSalary = clamp(miner.expectedSalary + 1, SALARY_MIN, SALARY_MAX);
  state.stats.silverSpentTotal += cost;
  state.stats.trainingSpentTotal += cost;
  pushLog(state, `📘 ${miner.name}: ${statKey.toUpperCase()} повышен до ${miner.stats[statKey]}.`, "good");
  saveState(state);
  _onSpendSilver?.(cost);
  return true;
}

function getUpgradeCfg(id) {
  return GUILD_UPGRADES.find((u) => u.id === id) ?? null;
}

function buyGuildUpgrade(id) {
  const cfg = getUpgradeCfg(id);
  if (!cfg) return false;
  const state = getMinersGuildState();
  const lvl = state.upgrades[id] ?? 0;
  if (lvl >= cfg.maxLevel) return false;
  const cost = cfg.costs[lvl];
  if (!_spendSilver || !_spendSilver(cost)) return false;

  state.upgrades[id] = lvl + 1;
  state.stats.silverSpentTotal += cost;
  pushLog(state, `${cfg.icon} Улучшение \"${cfg.label}\" повышено до ${lvl + 1}.`, "good");
  saveState(state);
  _onSpendSilver?.(cost);
  return true;
}

function setGuildDifficulty(diffKey) {
  if (!GUILD_DIFFS[diffKey]) return;
  const state = getMinersGuildState();
  state.difficulty = diffKey;
  pushLog(state, `🧭 Режим гильдии: ${GUILD_DIFFS[diffKey].label}.`, "neutral");
  saveState(state);
}

function getRunSalaryCost(miner, state) {
  const runSec = getMinerRunSec(miner, state);
  return Math.max(1, Math.round((miner.salaryPerMin * runSec) / 60));
}

function applyRunSalary(miner, state) {
  if (!_getSilver || !_spendSilver) return { paid: 0, expected: 0, underpayRatio: 1 };
  const expected = getRunSalaryCost(miner, state);
  const paid = Math.min(expected, _getSilver());
  if (paid > 0) _spendSilver(paid);
  const underpayRatio = expected > 0 ? (expected - paid) / expected : 0;

  const targetMood = estimateMoodTarget(miner);
  const drift = (targetMood - miner.mood) * 0.14;
  const penalty = underpayRatio * 20;
  miner.mood = clamp(miner.mood + drift - penalty, 0, 100);

  state.stats.salaryPaidTotal += paid;
  return { paid, expected, underpayRatio };
}

function getMinerRunSec(miner, state) {
  const base = getEffectiveRunSecBase(state);
  const speedBonus = (miner.stats.speed - 3) * 0.07;
  const safetyBonus = (miner.stats.safety - 3) * 0.015;
  const moodBonus = ((miner.mood - 50) / 50) * 0.12;
  const yieldPenalty = Math.max(0, miner.stats.yield - 5) * 0.01;
  const totalBonus = speedBonus + safetyBonus + moodBonus - yieldPenalty;
  return Math.max(8, Math.round(base * (1 - totalBonus)));
}

function getMinerDeathChance(miner, state) {
  const base = getEffectiveDeathChanceBase(state);
  const safetyBonus = (miner.stats.safety - 3) * 0.09;
  const speedPenalty = Math.max(0, miner.stats.speed - 5) * 0.012;
  const moodBonus = ((miner.mood - 50) / 50) * 0.16;
  return clamp(base * (1 - safetyBonus - moodBonus + speedPenalty), 0.0015, 0.55);
}

function getMinerOreGain(miner, state) {
  const range = getEffectiveOreRangeBase(state);
  const yieldBonus = (miner.stats.yield - 3) * 0.18;
  const speedBonus = (miner.stats.speed - 3) * 0.04;
  const moodBonus = ((miner.mood - 50) / 50) * 0.2;
  const mult = clamp(1 + yieldBonus + speedBonus + moodBonus, 0.5, 2.6);
  const min = Math.max(1, Math.round(range.min * mult));
  const max = Math.max(min, Math.round(range.max * mult));
  return randInt(min, max);
}

function pickGuildOreType(miner, state) {
  const diff = getDifficultyConfig(state);
  const yieldStat = miner.stats.yield ?? 3;
  const moodNorm = clamp((miner.mood - 50) / 50, -1, 1);

  const rareBias = (yieldStat - 3) * 0.012 + moodNorm * 0.008;
  const diffRare =
    state.difficulty === "hard" ? 0.02 : state.difficulty === "easy" ? -0.01 : 0;

  let pDiamond = 0.010 + rareBias * 0.55 + diffRare * 0.7;
  let pGold = 0.050 + rareBias * 1.1 + diffRare * 0.9;
  let pSilver = 0.180 + rareBias * 1.35 + diffRare * 0.7;

  pDiamond = clamp(pDiamond, 0.002, 0.08);
  pGold = clamp(pGold, 0.015, 0.22);
  pSilver = clamp(pSilver, 0.08, 0.38);

  const totalRare = pDiamond + pGold + pSilver;
  const pCopper = clamp(1 - totalRare, 0.35, 0.95);

  const roll = Math.random();
  if (roll < pDiamond) return ORE_DIAMOND;
  if (roll < pDiamond + pGold) return ORE_GOLD;
  if (roll < pDiamond + pGold + pSilver) return ORE_SILVER;
  void diff;
  return ORE_COPPER;
}

function getMinerOreBundle(miner, state) {
  const count = getMinerOreGain(miner, state);
  const byType = {
    [ORE_COPPER]: 0,
    [ORE_SILVER]: 0,
    [ORE_GOLD]: 0,
    [ORE_DIAMOND]: 0,
  };
  for (let i = 0; i < count; i++) {
    const type = pickGuildOreType(miner, state);
    byType[type] += 1;
  }
  return { total: count, byType };
}

function getMinerYieldRange(miner, state) {
  const range = getEffectiveOreRangeBase(state);
  const yieldBonus = (miner.stats.yield - 3) * 0.18;
  const speedBonus = (miner.stats.speed - 3) * 0.04;
  const moodBonus = ((miner.mood - 50) / 50) * 0.2;
  const mult = clamp(1 + yieldBonus + speedBonus + moodBonus, 0.5, 2.6);
  return {
    min: Math.max(1, Math.round(range.min * mult)),
    max: Math.max(1, Math.round(range.max * mult)),
  };
}

function getCandidatePreview(candidate, state) {
  const pseudo = {
    stats: { ...candidate.stats },
    mood: 72,
  };
  const runSec = getMinerRunSec(pseudo, state);
  const deathChance = getMinerDeathChance(pseudo, state);
  const yieldRange = getMinerYieldRange(pseudo, state);
  return { runSec, deathChance, yieldRange };
}

export function processMinersGuildTick() {
  if (!isMinersGuildOpen()) return null;
  const state = getMinersGuildState();
  const now = nowMs();
  let elapsed = Math.floor((now - state.lastTickAt) / 1000);
  if (elapsed <= 0) return null;
  elapsed = Math.min(elapsed, 21600);
  state.lastTickAt = now;

  refillCandidates(state);
  for (const miner of state.miners) {
    normalizeMiner(miner, getEffectiveRunSecBase(state));
  }

  let payrollSpent = 0;
  let oreGained = 0;
  const oreByType = {
    [ORE_COPPER]: 0,
    [ORE_SILVER]: 0,
    [ORE_GOLD]: 0,
    [ORE_DIAMOND]: 0,
  };
  let deaths = 0;
  let quits = 0;
  let completedRuns = 0;
  const eventLines = [];

  for (let i = state.miners.length - 1; i >= 0; i--) {
    const miner = state.miners[i];
    let local = elapsed;
    let guard = 0;

    while (local > 0 && guard < 300) {
      guard += 1;
      if (miner.cooldown > local) {
        miner.cooldown -= local;
        local = 0;
        continue;
      }

      local -= miner.cooldown;
      completedRuns += 1;
      state.stats.runsTotal += 1;

      const deathChance = getMinerDeathChance(miner, state);
      if (Math.random() < deathChance) {
        deaths += 1;
        state.stats.deathsTotal += 1;
        if (eventLines.length < 3) eventLines.push(`☠ ${miner.name} не вернулся с вылазки.`);
        state.miners.splice(i, 1);
        break;
      }

      const bundle = getMinerOreBundle(miner, state);
      const mined = bundle.total;
      oreGained += mined;
      state.stats.oreMinedTotal += mined;
      oreByType[ORE_COPPER] += bundle.byType[ORE_COPPER];
      oreByType[ORE_SILVER] += bundle.byType[ORE_SILVER];
      oreByType[ORE_GOLD] += bundle.byType[ORE_GOLD];
      oreByType[ORE_DIAMOND] += bundle.byType[ORE_DIAMOND];
      state.stats.oreByType[ORE_COPPER] += bundle.byType[ORE_COPPER];
      state.stats.oreByType[ORE_SILVER] += bundle.byType[ORE_SILVER];
      state.stats.oreByType[ORE_GOLD] += bundle.byType[ORE_GOLD];
      state.stats.oreByType[ORE_DIAMOND] += bundle.byType[ORE_DIAMOND];
      const salary = applyRunSalary(miner, state);
      payrollSpent += salary.paid;
      if (salary.underpayRatio > 0.25 && eventLines.length < 3) {
        eventLines.push(`💸 ${miner.name}: недоплата за рейс (${salary.paid}/${salary.expected} монет).`);
      }
      if (salary.underpayRatio < 0.15) {
        miner.mood = clamp(miner.mood + 1.2, 0, 100);
      }

      if (miner.mood < 18 && Math.random() < 0.1) {
        quits += 1;
        state.stats.quitsTotal += 1;
        if (eventLines.length < 3) eventLines.push(`🚪 ${miner.name} уволился: недоволен условиями.`);
        state.miners.splice(i, 1);
        break;
      }

      if (eventLines.length < 3) eventLines.push(`⛏ ${miner.name} привёз ${mined} руды.`);
      miner.cooldown = getMinerRunSec(miner, state);
    }
  }

  if (oreGained > 0) pushLog(state, `⛏ Бригада добыла ${oreGained} руды за смену.`, "good");
  if (deaths > 0) pushLog(state, `☠ Потери гильдии: ${deaths} шахтёр(ов).`, "bad");
  if (quits > 0) pushLog(state, `🚪 Уволились: ${quits} шахтёр(ов).`, "neutral");
  if (payrollSpent > 0) pushLog(state, `💰 Выплачено зарплат за рейсы: ${payrollSpent} монет.`, "neutral");

  saveState(state);

  if (oreGained <= 0 && deaths <= 0 && quits <= 0 && completedRuns <= 0 && payrollSpent <= 0) {
    return null;
  }
  return {
    oreGained,
    oreByType,
    deaths,
    quits,
    payrollSpent,
    completedRuns,
    eventLines,
    aliveMiners: state.miners.length,
  };
}

function fmtTime(sec) {
  const v = Math.max(0, Math.floor(sec));
  const m = Math.floor(v / 60);
  const s = v % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function moodClass(mood) {
  if (mood >= 65) return "good";
  if (mood >= 40) return "ok";
  return "bad";
}

function moodEmoji(mood) {
  if (mood >= 65) return "😊";
  if (mood >= 40) return "😐";
  return "😟";
}

function renderGuildStats(state) {
  const nameEl    = document.getElementById("guild-name");
  const silverEl  = document.getElementById("guild-silver");
  const minersEl  = document.getElementById("guild-miners");
  const deathsEl  = document.getElementById("guild-deaths");
  const oreEl     = document.getElementById("guild-ore-mined");
  const runSecEl  = document.getElementById("guild-run-time");
  const deathEl   = document.getElementById("guild-death-risk");
  const moodEl    = document.getElementById("guild-mood");
  const salaryEl  = document.getElementById("guild-salary-paid");

  const avgMood = state.miners.length
    ? Math.round(state.miners.reduce((s, m) => s + (m.mood ?? 0), 0) / state.miners.length)
    : 0;

  if (nameEl)   nameEl.textContent   = state.name || "Безымянная гильдия";
  if (silverEl) silverEl.textContent = String(_getSilver ? _getSilver() : 0);
  if (minersEl) minersEl.textContent = `${state.miners.length}/${getGuildCapacity(state)}`;
  if (deathsEl) deathsEl.textContent = String(state.stats.deathsTotal);
  if (oreEl)    oreEl.textContent    = String(state.stats.oreMinedTotal);
  if (runSecEl) runSecEl.textContent = `${getEffectiveRunSecBase(state)}с`;
  if (deathEl)  deathEl.textContent  = `${(getEffectiveDeathChanceBase(state) * 100).toFixed(1)}%`;
  if (moodEl) {
    moodEl.textContent = state.miners.length ? `${moodEmoji(avgMood)} ${avgMood}%` : "—";
  }
  if (salaryEl) salaryEl.textContent = `${state.stats.salaryPaidTotal}`;
}

function renderGuildCandidates(state) {
  const collapseWrap = document.getElementById("guild-candidate-wrap");
  const list = document.getElementById("guild-candidate-list");
  const toggleBtn = document.getElementById("guild-candidate-toggle");
  if (!list) return;
  const collapsed = isCandidatesCollapsed();
  if (collapseWrap) collapseWrap.style.display = collapsed ? "none" : "";
  if (toggleBtn) toggleBtn.textContent = collapsed ? "Развернуть" : "Свернуть";
  if (collapsed) return;

  const cap = getGuildCapacity(state);
  const hireCost = getHireCost(state);
  const canHireAny = state.miners.length < cap;

  list.innerHTML = state.candidates
    .slice(0, CANDIDATE_POOL_SIZE)
    .map((c) => {
      const canAfford = _getSilver ? _getSilver() >= hireCost : false;
      const canHire = canHireAny && canAfford;
      const preview = getCandidatePreview(c, state);
      const disabledReason = !canHireAny ? "Бригада полна" : !canAfford ? `Нужно ${hireCost} монет` : "";
      return `
      <div class="guild-candidate-card">
        <div class="guild-candidate-header">
          <span class="guild-candidate-name">🧑‍🔧 ${c.name}</span>
          <span class="guild-candidate-salary">${c.expectedSalary} м/мин</span>
        </div>
        <div class="guild-stat-pills">
          <span class="guild-stat-pill" title="Скорость: влияет на время рейса">⚡ <strong>${c.stats.speed}</strong></span>
          <span class="guild-stat-pill" title="Безопасность: снижает риск гибели">🛡 <strong>${c.stats.safety}</strong></span>
          <span class="guild-stat-pill" title="Добыча: объём и шанс редкой руды">⛏ <strong>${c.stats.yield}</strong></span>
          <span class="guild-forecast">${preview.yieldRange.min}–${preview.yieldRange.max} руды · ${preview.runSec}с · ${(preview.deathChance * 100).toFixed(1)}%</span>
        </div>
        <button class="guild-hire-btn" data-hire-candidate="${c.id}" ${canHire ? "" : "disabled"} title="${disabledReason || "Нанять в бригаду"}">
          Нанять · ${hireCost} монет
        </button>
      </div>`;
    })
    .join("");
}

function renderGuildMiners(state) {
  const listEl = document.getElementById("guild-miner-list");
  if (!listEl) return;

  if (!state.miners.length) {
    listEl.innerHTML = '<div class="guild-empty-state">Бригада пуста — наними шахтёра из кандидатов ниже.</div>';
    return;
  }

  const silver = _getSilver ? _getSilver() : 0;

  listEl.innerHTML = state.miners
    .map((m) => {
      const costSpeed  = m.stats.speed  < 8 ? getTrainingCost(m, "speed")  : 0;
      const costSafety = m.stats.safety < 8 ? getTrainingCost(m, "safety") : 0;
      const costYield  = m.stats.yield  < 8 ? getTrainingCost(m, "yield")  : 0;
      const runSec     = getMinerRunSec(m, state);
      const deathChance = getMinerDeathChance(m, state);
      const yieldRange  = getMinerYieldRange(m, state);
      const mood = Math.round(m.mood);
      const mc = moodClass(mood);

      const trainDisSpeed  = m.stats.speed  >= 8 || silver < costSpeed;
      const trainDisSafety = m.stats.safety >= 8 || silver < costSafety;
      const trainDisYield  = m.stats.yield  >= 8 || silver < costYield;

      return `
      <div class="guild-miner-card">
        <div class="guild-miner-header">
          <span class="guild-miner-name">👷 ${m.name}</span>
          <div class="guild-miner-chips">
            <span class="guild-eta-chip" title="До конца рейса">⏱ ${fmtTime(m.cooldown)}</span>
            <span class="guild-mood-chip ${mc}" title="Настроение влияет на скорость, риск и добычу">${moodEmoji(mood)} ${mood}%</span>
          </div>
        </div>
        <div class="guild-stat-pills">
          <span class="guild-stat-pill" title="Скорость: быстрее рейс">⚡ <strong>${m.stats.speed}</strong></span>
          <span class="guild-stat-pill" title="Безопасность: меньше риск гибели">🛡 <strong>${m.stats.safety}</strong></span>
          <span class="guild-stat-pill" title="Добыча: больше руды и редких типов">⛏ <strong>${m.stats.yield}</strong></span>
          <span class="guild-forecast" title="Прогноз за рейс">${yieldRange.min}–${yieldRange.max} руды · ${runSec}с · ${(deathChance * 100).toFixed(1)}%</span>
        </div>
        <div class="guild-miner-controls">
          <div class="guild-salary-ctrl">
            <button class="guild-ctrl-btn" data-salary-miner="${m.id}" data-salary-delta="-1" title="Снизить зарплату">−</button>
            <span class="guild-salary-label" title="Зарплата списывается за рейс">${m.salaryPerMin} м/мин</span>
            <button class="guild-ctrl-btn" data-salary-miner="${m.id}" data-salary-delta="1" title="Повысить зарплату">+</button>
          </div>
          <div class="guild-actions">
            <button class="guild-train-btn" data-train-miner="${m.id}" data-train-stat="speed" ${trainDisSpeed ? "disabled" : ""} title="Скорость ур.${m.stats.speed}→${m.stats.speed+1}: ${costSpeed} монет">⚡ ${m.stats.speed >= 8 ? "MAX" : costSpeed + " мн"}</button>
            <button class="guild-train-btn" data-train-miner="${m.id}" data-train-stat="safety" ${trainDisSafety ? "disabled" : ""} title="Безопасность ур.${m.stats.safety}→${m.stats.safety+1}: ${costSafety} монет">🛡 ${m.stats.safety >= 8 ? "MAX" : costSafety + " мн"}</button>
            <button class="guild-train-btn" data-train-miner="${m.id}" data-train-stat="yield" ${trainDisYield ? "disabled" : ""} title="Добыча ур.${m.stats.yield}→${m.stats.yield+1}: ${costYield} монет">⛏ ${m.stats.yield >= 8 ? "MAX" : costYield + " мн"}</button>
            <button class="guild-fire-btn" data-fire-miner="${m.id}" title="Уволить шахтёра">Уволить</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function renderGuildDiff(state) {
  const wrap = document.getElementById("guild-diff-buttons");
  if (!wrap) return;
  wrap.querySelectorAll("[data-guild-diff]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-guild-diff") === state.difficulty);
  });
}

function renderGuildUpgrades(state) {
  const wrap = document.getElementById("guild-upgrades");
  if (!wrap) return;
  const silver = _getSilver ? _getSilver() : 0;
  wrap.innerHTML = GUILD_UPGRADES.map((u) => {
    const lvl = state.upgrades[u.id] ?? 0;
    const maxed = lvl >= u.maxLevel;
    const nextCost = maxed ? 0 : u.costs[lvl];
    const canBuy = !maxed && silver >= nextCost;
    const dots = Array.from({ length: u.maxLevel }, (_, i) =>
      `<span class="guild-upg-dot${i < lvl ? " filled" : ""}"></span>`
    ).join("");
    return `
      <div class="guild-upg-row${maxed ? " maxed" : ""}">
        <div class="guild-upg-icon">${u.icon}</div>
        <div class="guild-upg-info">
          <div class="guild-upg-name">${u.label}</div>
          <div class="guild-upg-desc">${u.desc}</div>
          <div class="guild-upg-progress">${dots}</div>
        </div>
        <div class="guild-upg-side">
          <span class="guild-upg-cost">${maxed ? "МАКСИМУМ" : `${nextCost} монет`}</span>
          <button class="guild-buy-btn" data-buy-guild-upg="${u.id}" ${canBuy ? "" : "disabled"}>
            ${maxed ? "✓" : "Купить"}
          </button>
        </div>
      </div>`;
  }).join("");
}

function renderGuildLogs(state) {
  const wrap = document.getElementById("guild-log");
  if (!wrap) return;
  if (!state.logs.length) {
    wrap.innerHTML = '<div class="guild-empty-state">Журнал пуст — события появятся после первых рейсов.</div>';
    return;
  }
  wrap.innerHTML = state.logs
    .slice(0, 15)
    .map((x) => {
      const t = new Date(x.at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
      return `<div class="guild-log-row ${x.tone ?? "neutral"}"><span class="guild-log-time">${t}</span><span class="guild-log-text">${x.text}</span></div>`;
    })
    .join("");
}

export function renderMinersGuildScreen() {
  const state = getMinersGuildState();
  renderGuildStats(state);
  renderGuildCandidates(state);
  renderGuildMiners(state);
  renderGuildDiff(state);
  renderGuildUpgrades(state);
  renderGuildLogs(state);
}

function bindGuildHandlers() {
  const backBtn = document.getElementById("guild-back-btn");
  const diffWrap = document.getElementById("guild-diff-buttons");
  const candidateWrap = document.getElementById("guild-candidate-list");
  const minersWrap = document.getElementById("guild-miner-list");
  const upgWrap = document.getElementById("guild-upgrades");
  const renameBtn = document.getElementById("guild-rename-btn");
  const candidateToggleBtn = document.getElementById("guild-candidate-toggle");

  if (backBtn) backBtn.addEventListener("click", () => _onBack?.());
  if (renameBtn) renameBtn.addEventListener("click", () => _onRequestRename?.());
  if (candidateToggleBtn) {
    candidateToggleBtn.addEventListener("click", () => {
      setCandidatesCollapsed(!isCandidatesCollapsed());
      renderMinersGuildScreen();
    });
  }

  if (diffWrap) {
    diffWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-guild-diff]");
      if (!btn) return;
      const k = btn.getAttribute("data-guild-diff");
      setGuildDifficulty(k);
      renderMinersGuildScreen();
    });
  }

  if (candidateWrap) {
    candidateWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-hire-candidate]");
      if (!btn) return;
      const id = parseInt(btn.getAttribute("data-hire-candidate"), 10);
      if (Number.isNaN(id)) return;
      if (hireCandidate(id)) renderMinersGuildScreen();
    });
  }

  if (minersWrap) {
    minersWrap.addEventListener("click", (e) => {
      const fireBtn = e.target.closest("[data-fire-miner]");
      if (fireBtn) {
        const id = parseInt(fireBtn.getAttribute("data-fire-miner"), 10);
        if (Number.isNaN(id)) return;
        if (fireMiner(id)) renderMinersGuildScreen();
        return;
      }

      const salaryBtn = e.target.closest("[data-salary-miner]");
      if (salaryBtn) {
        const id = parseInt(salaryBtn.getAttribute("data-salary-miner"), 10);
        const delta = parseInt(salaryBtn.getAttribute("data-salary-delta"), 10);
        if (Number.isNaN(id) || Number.isNaN(delta)) return;
        if (adjustMinerSalary(id, delta)) renderMinersGuildScreen();
        return;
      }

      const trainBtn = e.target.closest("[data-train-miner]");
      if (trainBtn) {
        const id = parseInt(trainBtn.getAttribute("data-train-miner"), 10);
        const stat = trainBtn.getAttribute("data-train-stat");
        if (Number.isNaN(id) || !stat) return;
        if (trainMinerStat(id, stat)) renderMinersGuildScreen();
      }
    });
  }

  if (upgWrap) {
    upgWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-buy-guild-upg]");
      if (!btn) return;
      const id = btn.getAttribute("data-buy-guild-upg");
      if (buyGuildUpgrade(id)) renderMinersGuildScreen();
    });
  }
}

export function buildMinersGuildScreen() {
  return `
  <div id="screen-guild" class="screen">

    <nav class="gacha-topbar">
      <div class="gacha-topbar-brand">
        <span class="gacha-topbar-emoji">🏛</span>
        <span class="gacha-topbar-title" id="guild-name">Гильдия шахтёров</span>
      </div>
      <div class="gacha-topbar-stats">
        <div class="resource-chip">
          <span class="resource-dot" style="background:#fbbf24;box-shadow:0 0 6px rgba(251,191,36,0.5)"></span>
          <span class="resource-val" id="guild-silver">0</span>
          <span class="resource-label">монет</span>
        </div>
        <div class="resource-chip">
          <span>👷</span>
          <span class="resource-val" id="guild-miners">0/0</span>
        </div>
        <div class="resource-chip">
          <span class="resource-val" id="guild-ore-mined">0</span>
          <span class="resource-label">руды добыто</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="topbar-btn" id="guild-rename-btn">✏ Название</button>
        <button class="topbar-btn" id="guild-back-btn">← Меню</button>
      </div>
    </nav>

    <div class="guild-content">
      <div class="guild-layout">

        <!-- LEFT: режим + бригада + кандидаты -->
        <div class="guild-left-col">

          <!-- Режим & метрики -->
          <div class="card">
            <div class="card-header">
              <span class="card-header-icon">🧭</span>
              <span class="card-header-text">Режим гильдии</span>
            </div>
            <div class="card-body">
              <div class="guild-diff-btns" id="guild-diff-buttons">
                <button class="guild-diff-btn" data-guild-diff="easy" title="Низкий риск и добыча">🟢 Лёгкая</button>
                <button class="guild-diff-btn" data-guild-diff="normal" title="Сбалансированный режим">🟡 Средняя</button>
                <button class="guild-diff-btn" data-guild-diff="hard" title="Высокий риск и добыча">🔴 Сложная</button>
              </div>
              <div class="guild-metrics-row">
                <div class="guild-metric" title="Базовое время рейса"><div class="guild-metric-label">⏱ Рейс</div><div class="guild-metric-val" id="guild-run-time">—</div></div>
                <div class="guild-metric" title="Базовый риск гибели за рейс"><div class="guild-metric-label">☠ Риск</div><div class="guild-metric-val" id="guild-death-risk">—</div></div>
                <div class="guild-metric" title="Среднее настроение бригады"><div class="guild-metric-label">🙂 Настрой</div><div class="guild-metric-val" id="guild-mood">—</div></div>
                <div class="guild-metric" title="Всего выплачено зарплат"><div class="guild-metric-label">💰 Зарплаты</div><div class="guild-metric-val" id="guild-salary-paid">0</div></div>
                <div class="guild-metric" title="Погибших за всё время"><div class="guild-metric-label">☠ Потери</div><div class="guild-metric-val" id="guild-deaths">0</div></div>
              </div>
            </div>
          </div>

          <!-- Бригада -->
          <div class="card">
            <div class="card-header">
              <span class="card-header-icon">👷</span>
              <span class="card-header-text">Бригада</span>
            </div>
            <div class="card-body card-body-flush">
              <div id="guild-miner-list"></div>
            </div>
          </div>

          <!-- Кандидаты -->
          <div class="card">
            <div class="card-header">
              <span class="card-header-icon">🧑‍💼</span>
              <span class="card-header-text">Кандидаты</span>
              <button class="topbar-btn" id="guild-candidate-toggle" style="margin-left:auto;">Свернуть</button>
            </div>
            <div id="guild-candidate-wrap">
              <div class="card-body card-body-flush">
                <div id="guild-candidate-list"></div>
              </div>
            </div>
          </div>

        </div>

        <!-- RIGHT: улучшения + журнал -->
        <div class="guild-right-col">

          <!-- Улучшения -->
          <div class="card">
            <div class="card-header">
              <span class="card-header-icon">⚙</span>
              <span class="card-header-text">Улучшения</span>
            </div>
            <div class="card-body">
              <div id="guild-upgrades"></div>
            </div>
          </div>

          <!-- Журнал -->
          <div class="card">
            <div class="card-header">
              <span class="card-header-icon">📜</span>
              <span class="card-header-text">Журнал событий</span>
            </div>
            <div class="card-body card-body-flush">
              <div id="guild-log"></div>
            </div>
          </div>

        </div>
      </div>
    </div>

  </div>`;
}

export function initMinersGuildScreen({
  onBack,
  getSilver,
  spendSilver,
  onStateChanged,
  onSpendSilver,
  onRequestRename,
}) {
  _onBack = onBack;
  _getSilver = getSilver;
  _spendSilver = spendSilver;
  _onStateChanged = onStateChanged;
  _onSpendSilver = onSpendSilver;
  _onRequestRename = onRequestRename;

  bindGuildHandlers();
  renderMinersGuildScreen();
}
