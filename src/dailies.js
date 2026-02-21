import { addShards, addTickets } from "./pickaxe-gacha.js";

/* ── Constants ──────────────────────────────────────── */

const KEY_DAILIES = "delve_dailies_v1";

const QUEST_POOL = [
  // Майнинг
  { id: "run_complete_1", type: "run_any",    target: 1,  label: "Заверши 1 рейд",            icon: "⛏", reward: 15 },
  { id: "run_complete_3", type: "run_any",    target: 3,  label: "Заверши 3 рейда",           icon: "⛏", reward: 35 },
  { id: "run_clear",      type: "run_clear",  target: 1,  label: "Зачисти шахту полностью",    icon: "🏆", reward: 30 },
  { id: "run_escape",     type: "run_escape", target: 1,  label: "Сбеги из шахты",             icon: "🏃", reward: 20 },
  { id: "ore_mine_20",    type: "ore_mine",   target: 20, label: "Добудь 20 руды",             icon: "💎", reward: 15 },
  { id: "ore_mine_60",    type: "ore_mine",   target: 60, label: "Добудь 60 руды",             icon: "💎", reward: 30 },
  // Магазин
  { id: "ore_sell_15",    type: "ore_sell",   target: 15, label: "Продай 15 руды в магазине",  icon: "🏪", reward: 15 },
  { id: "ore_sell_40",    type: "ore_sell",   target: 40, label: "Продай 40 руды в магазине",  icon: "🏪", reward: 25 },
  { id: "gold_earn_80",   type: "gold_earn",  target: 80, label: "Заработай 80 золота",        icon: "💰", reward: 20 },
  // TD
  { id: "td_wave_1",      type: "td_wave",    target: 1,  label: "Очисти 1 волну в TD",        icon: "🛡", reward: 20 },
  { id: "td_wave_3",      type: "td_wave",    target: 3,  label: "Очисти 3 волны в TD",        icon: "🛡", reward: 40 },
  // Гача
  { id: "gacha_pull_1",   type: "gacha_pull", target: 1,  label: "Сделай 1 крутку",            icon: "🎰", reward: 15 },
  { id: "gacha_pull_5",   type: "gacha_pull", target: 5,  label: "Сделай 5 круток",            icon: "🎰", reward: 35 },
  // Расходники
  { id: "consumable_1",   type: "consumable", target: 1,  label: "Используй расходник",        icon: "🧪", reward: 15 },
];

const DAILY_BONUS = {
  1: { shards: 15, ticket: 0 },
  2: { shards: 20, ticket: 0 },
  3: { shards: 30, ticket: 1 },
};

/* ── Helpers ────────────────────────────────────────── */

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(from, to) {
  const ms = new Date(to) - new Date(from);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function safeParse(json, fallback) {
  try {
    const out = JSON.parse(json ?? "");
    return out && typeof out === "object" ? out : fallback;
  } catch {
    return fallback;
  }
}

/* ── Quest seeding (deterministic by date) ──────────── */

function getDailyQuestIds(dateStr) {
  let seed = 0;
  for (const c of dateStr) seed = (seed * 31 + c.charCodeAt(0)) & 0xffffffff;
  const pool = QUEST_POOL.map((q) => q.id);
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 5);
}

/* ── State ──────────────────────────────────────────── */

function loadState() {
  const raw = safeParse(localStorage.getItem(KEY_DAILIES), null);
  const today = getTodayKey();

  if (!raw) {
    return { date: today, progress: {}, claimed: [], bonusDate: null, bonusStreak: 0 };
  }

  // New day — reset quest progress and claimed
  if (raw.date !== today) {
    return {
      date: today,
      progress: {},
      claimed: [],
      bonusDate: raw.bonusDate ?? null,
      bonusStreak: raw.bonusStreak ?? 0,
    };
  }

  return {
    date: raw.date ?? today,
    progress: raw.progress ?? {},
    claimed: Array.isArray(raw.claimed) ? raw.claimed : [],
    bonusDate: raw.bonusDate ?? null,
    bonusStreak: Math.max(0, Number(raw.bonusStreak) || 0),
  };
}

function saveState(s) {
  localStorage.setItem(KEY_DAILIES, JSON.stringify(s));
}

/* ── Public API — Progress ──────────────────────────── */

export function trackDailyProgress(type, amount) {
  if (!type || amount <= 0) return;
  const s = loadState();
  s.progress[type] = (s.progress[type] ?? 0) + amount;
  saveState(s);
}

/* ── Public API — Quests ────────────────────────────── */

export function getDailyQuests() {
  const today = getTodayKey();
  const s = loadState();
  const ids = getDailyQuestIds(today);
  return ids.map((id) => {
    const q = QUEST_POOL.find((x) => x.id === id);
    if (!q) return null;
    const progress = Math.min(s.progress[q.type] ?? 0, q.target);
    const completed = progress >= q.target;
    const claimed = s.claimed.includes(id);
    return { ...q, progress, completed, claimed };
  }).filter(Boolean);
}

export function claimDailyQuest(id) {
  const s = loadState();
  if (s.claimed.includes(id)) return false;
  const q = QUEST_POOL.find((x) => x.id === id);
  if (!q) return false;
  const progress = s.progress[q.type] ?? 0;
  if (progress < q.target) return false;
  s.claimed.push(id);
  saveState(s);
  addShards(q.reward);
  return true;
}

/* ── Public API — Daily Bonus ───────────────────────── */

export function getDailyBonusInfo() {
  const today = getTodayKey();
  const s = loadState();
  const canClaim = s.bonusDate !== today;

  // Calculate what streak day would be if claimed now
  let nextStreak;
  if (!s.bonusDate) {
    nextStreak = 1;
  } else {
    const diff = dayDiff(s.bonusDate, today);
    nextStreak = diff === 1 ? (s.bonusStreak % 3) + 1 : 1;
  }

  const bonus = DAILY_BONUS[nextStreak] ?? DAILY_BONUS[1];
  return {
    currentStreak: s.bonusStreak,
    nextStreak,
    shards: bonus.shards,
    ticket: bonus.ticket,
    canClaim,
    bonusDate: s.bonusDate,
  };
}

export function claimDailyBonus() {
  const today = getTodayKey();
  const s = loadState();
  if (s.bonusDate === today) return false;

  const info = getDailyBonusInfo();
  addShards(info.shards);
  if (info.ticket > 0) addTickets(info.ticket);

  s.bonusDate = today;
  s.bonusStreak = info.nextStreak;
  saveState(s);
  return true;
}

/* ── Reset (called by main.js on full reset) ─────────── */

export function resetDailies() {
  localStorage.removeItem(KEY_DAILIES);
}

/* ── UI ─────────────────────────────────────────────── */

let _onClaimQuest = null;
let _onClaimBonus = null;

export function initDailyCard({ onClaimQuest, onClaimBonus }) {
  _onClaimQuest = onClaimQuest;
  _onClaimBonus = onClaimBonus;
}

function streakDots(current, nextStreak) {
  return [1, 2, 3]
    .map((i) => {
      if (i < nextStreak) return `<span class="daily-streak-dot daily-streak-done">●</span>`;
      if (i === nextStreak) return `<span class="daily-streak-dot daily-streak-current">●</span>`;
      return `<span class="daily-streak-dot daily-streak-empty">○</span>`;
    })
    .join("");
}

export function renderDailyCard() {
  const mount = document.getElementById("daily-card-mount");
  if (!mount) return;

  const quests = getDailyQuests();
  const bonus = getDailyBonusInfo();

  // Bonus row
  const bonusLabel = bonus.canClaim
    ? `День ${bonus.nextStreak}: <strong>+${bonus.shards} ос.${bonus.ticket ? " + 1 билет 🎟" : ""}</strong>`
    : `Следующий бонус завтра`;
  const bonusBtn = bonus.canClaim
    ? `<button class="btn-primary daily-claim-btn" data-daily-bonus="1">Забрать</button>`
    : `<span class="daily-claimed-label">✓ Получено</span>`;

  // Quest rows
  const questRows = quests.map((q) => {
    const pct = Math.round((q.progress / q.target) * 100);
    const progressText = `${q.progress} / ${q.target}`;
    let actionBtn = "";
    if (q.claimed) {
      actionBtn = `<span class="daily-claimed-label">✓ +${q.reward} ос.</span>`;
    } else if (q.completed) {
      actionBtn = `<button class="btn-primary daily-claim-btn" data-daily-quest-id="${q.id}">+${q.reward} ос.</button>`;
    } else {
      actionBtn = `<span class="daily-reward-hint">+${q.reward} ос.</span>`;
    }
    return `
    <div class="daily-quest-row ${q.claimed ? "daily-quest-done" : ""}">
      <span class="daily-quest-icon">${q.icon}</span>
      <div class="daily-quest-body">
        <div class="daily-quest-label">${q.label}</div>
        <div class="daily-quest-progress-row">
          <div class="daily-quest-bar">
            <div class="daily-quest-fill" style="width:${pct}%"></div>
          </div>
          <span class="daily-quest-count">${progressText}</span>
        </div>
      </div>
      <div class="daily-quest-action">${actionBtn}</div>
    </div>`;
  }).join("");

  mount.innerHTML = `
  <div class="card daily-card">
    <div class="card-header">
      <span class="card-header-icon">📅</span>
      <span class="card-header-text">Дейлики</span>
    </div>
    <div class="card-body daily-card-body">

      <div class="daily-bonus-row">
        <div class="daily-bonus-left">
          <div class="daily-bonus-streak">${streakDots(bonus.currentStreak, bonus.nextStreak)}</div>
          <div class="daily-bonus-label">${bonusLabel}</div>
        </div>
        <div class="daily-bonus-action">${bonusBtn}</div>
      </div>

      <div class="daily-divider"></div>

      <div class="daily-quest-list">
        ${questRows}
      </div>

    </div>
  </div>`;

  // Attach click handlers
  mount.querySelectorAll("[data-daily-quest-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-daily-quest-id");
      if (!id) return;
      const ok = claimDailyQuest(id);
      if (!ok) return;
      renderDailyCard();
      if (typeof _onClaimQuest === "function") _onClaimQuest(id);
    });
  });

  mount.querySelectorAll("[data-daily-bonus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ok = claimDailyBonus();
      if (!ok) return;
      renderDailyCard();
      if (typeof _onClaimBonus === "function") _onClaimBonus();
    });
  });
}
