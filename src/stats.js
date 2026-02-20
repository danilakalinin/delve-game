const STATS_KEY = "delve_stats_v1";
export const APP_VERSION = "0.2.0";
const MAX_LEVEL = 60;
const XP_BASE = 100;
const XP_GROWTH = 1.08;

export const LEVEL_RANKS = [
  { title: "Человек, который упал в шахту", subtitle: "Падение было долгим. Ты всё ещё падаешь." },
  { title: "Временный житель подземелья", subtitle: "Срок аренды: до первой смерти." },
  { title: "Обладатель лопаты", subtitle: "Это всё, что у тебя есть. И этого достаточно, чтобы страдать." },
  { title: "Ищущий руду", subtitle: "Ищешь её. Ищешь себя. Пока безуспешно." },
  { title: "Тот, кто дышит пылью", subtitle: "Лёгкие помнят солнце. Скоро они забудут." },
  { title: "Спутник пустоты", subtitle: "Вы идёте вместе. Она не разговаривает. Ты тоже." },
  { title: "Коллекционер неудач", subtitle: "Собираешь их с завидным упорством." },
  { title: "Пациент шахты", subtitle: "Диагноз: хроническое нахождение под землёй." },
  { title: "Кандидат в вечность", subtitle: "Вечность уже прислала приглашение." },
  { title: "Тело, ещё не нашедшее покой", subtitle: "Покой ищет тебя активнее, чем ты руду." },
  { title: "Существо с лопатой", subtitle: "Вид: землеройное. Ареал: полный мрак." },
  { title: "Функция без названия", subtitle: "Ты копаешь. Значит, ты существуешь." },
  { title: "Экземпляр шахтной фауны", subtitle: "Местные крысы считают тебя своим." },
  { title: "Носитель каски", subtitle: "Каска пуста. Как и твои отчёты по самооценке." },
  { title: "Образец производственного травматизма", subtitle: "Статистика любит тебя. Ты её — нет." },
  { title: "Хроникёр собственной агонии", subtitle: "Каждый день записываешь в памяти: \"я ещё жив. зачем?\"" },
  { title: "Временное явление", subtitle: "Физики спорят: ты волна или частица? Ты — боль." },
  { title: "Амбулаторный труп", subtitle: "Ходишь, говоришь, копаешь. Мёртв внутри." },
  { title: "Персонаж без развития", subtitle: "Сюжетной арки нет. Есть только яма." },
  { title: "Иллюзия присутствия", subtitle: "Тебя здесь нет. Но руда почему-то убывает." },
  { title: "Философ подземелья", subtitle: "\"Копать или не копать\" — больше не вопрос." },
  { title: "Адепт пустоты", subtitle: "Поклоняешься тому, что внутри тебя." },
  { title: "Мастер малых форм", subtitle: "Форма существования: малая. Форма страдания: большая." },
  { title: "Знаток породы", subtitle: "Знаешь породу. Знаешь породу людей. Разницы нет." },
  { title: "Смотритель тьмы", subtitle: "Смотришь во тьму. Она смотрит в тебя. Вы квиты." },
  { title: "Проводник забвения", subtitle: "Ведёшь себя к забвению. Экскурсия в один конец." },
  { title: "Интерпретатор тишины", subtitle: "Тишина говорит с тобой. Ты переводишь: \"копай дальше\"." },
  { title: "Собиратель осколков", subtitle: "Собираешь осколки себя. Пасьянс не сходится." },
  { title: "Архитектор собственной клетки", subtitle: "Построил её сам. Лопатой. Годами." },
  { title: "Хранитель традиции", subtitle: "Традиция: спускаться и страдать. Ты чтишь её." },
  { title: "Распорядитель ресурсов", subtitle: "Распоряжаешься рудой. Жизнью распоряжается шахта." },
  { title: "Барон пустой породы", subtitle: "Владеешь пустотой. Поздравляю." },
  { title: "Управляющий безысходностью", subtitle: "Департамент безысходности работает без выходных." },
  { title: "Надзиратель над собой", subtitle: "Следишь, чтобы ты не расслаблялся. Расслабляться нельзя — умрёшь." },
  { title: "Эффект присутствия", subtitle: "Ты есть. Это влияет на показатели руды. Ты не влияешь ни на что." },
  { title: "Медиум подземелья", subtitle: "Общаешься с духами погибших шахтёров. Они советуют уволиться." },
  { title: "Институция страдания", subtitle: "Ты не человек. Ты учреждение. Круглосуточное. Без выходных." },
  { title: "Символ веры", subtitle: "Местные верят: пока ты копаешь, мир не рухнет. Мир рухнет. Но не сегодня." },
  { title: "Носитель традиции", subtitle: "Традиция: не выживать. Ты поддерживаешь её." },
  { title: "Эталон производственной нормы", subtitle: "Норма: 8 часов ада. Ты делаешь 12. Молодец." },
  { title: "Легенда в собственном воображении", subtitle: "В воображении других ты просто усталый человек с лопатой." },
  { title: "Герой подземных хроник", subtitle: "Хроники пишут: \"он всё ещё там\". Это не комплимент." },
  { title: "Объект фольклора", subtitle: "Дети в шахте боятся тебя. Ты боишься выходить на поверхность." },
  { title: "Мифологическая единица", subtitle: "О тебе слагают легенды. Страшные. Кровавые. Скучные." },
  { title: "Субстанция предания", subtitle: "Ты уже не человек. Ты сюжет для страшилок у костра." },
  { title: "Эпическое страдание", subtitle: "Гомер бы написал поэму. Гомер умер. Ты — нет. Пока." },
  { title: "Архетип копателя", subtitle: "Юнг бы гордился. Ты бы предпочёл просто поесть." },
  { title: "Безымянный ужас", subtitle: "Ужас в том, что у тебя есть имя. Ты просто его забыл." },
  { title: "Существо из снов шахты", subtitle: "Шахты видят тебя в кошмарах. Ты видишь руду. Вы квиты." },
  { title: "Тень среди теней", subtitle: "Ты стал неотличим от окружающей тьмы. Это не метафора." },
  { title: "Вечный двигатель", subtitle: "Двигатель: копает. Топливо: отчаяние." },
  { title: "Фундаментальная сила", subtitle: "Физики ищут тёмную материю. Ты — её источник." },
  { title: "Гравитационная аномалия", subtitle: "Всё падает в тебя. Даже свет. Даже надежда." },
  { title: "Сингулярность с лопатой", subtitle: "Внутри тебя ничего нет. Кроме руды. Много руды." },
  { title: "Абстракция труда", subtitle: "Ты не копаешь. Ты — само понятие \"копать\"." },
  { title: "Персонифицированная пустота", subtitle: "Пустота обрела имя. Твоё. Прости." },
  { title: "Энтропия в каске", subtitle: "Всё идёт к разрушению. Ты — проводник." },
  { title: "Последний довод шахты", subtitle: "Когда шахта хочет кого-то сломать, она посылает тебя." },
  { title: "Свидетель конца", subtitle: "Ты видел, как умирают другие. Ты видел, как умирал ты. Ты всё ещё здесь." },
  { title: "Тот, Кто Остаётся", subtitle: "Когда все уйдут, когда руда кончится, когда шахта рухнет — ты останешься. Потому что ты и есть шахта." },
];

export const LEVEL_TITLES = LEVEL_RANKS.map((x) => x.title);

const XP_TO_NEXT = Array.from({ length: MAX_LEVEL - 1 }, (_, i) =>
  Math.round(XP_BASE * Math.pow(XP_GROWTH, i)),
);
const XP_TOTAL_BY_LEVEL = [0];
for (let i = 1; i <= MAX_LEVEL; i++) {
  XP_TOTAL_BY_LEVEL[i] = XP_TOTAL_BY_LEVEL[i - 1] + (XP_TO_NEXT[i - 1] ?? 0);
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultStats() {
  const now = nowIso();
  return {
    meta: {
      version: APP_VERSION,
      firstLaunchAt: now,
      lastLaunchAt: now,
      launches: 0,
      resets: 0,
      savesLoaded: 0,
      savesSaved: 0,
      errorsCount: 0,
      totalPlaySeconds: 0,
    },
    resources: {
      totalOreMined: 0,
      totalOreSold: 0,
      totalGoldEarned: 0,
      goldSpent: 0,
      oreSpentOnUpgrades: 0,
    },
    runs: {
      total: 0,
      clear: 0,
      death: 0,
      escape: 0,
      longestSeconds: 0,
      shortestSeconds: 0,
      currentCollapseStreak: 0,
      currentEmptyStreak: 0,
      maxEmptyStreak: 0,
      currentRunCollapses: 0,
      speedWindow: [],
    },
    cells: {
      openedTotal: 0,
      emptyFound: 0,
      oreFoundCells: 0,
      unstableActivated: 0,
      flagsPlaced: 0,
      flagsRemoved: 0,
    },
    difficulty: {
      easy:   { total: 0, clear: 0, death: 0, escape: 0, bestOre: 0, minClearSeconds: 0 },
      normal: { total: 0, clear: 0, death: 0, escape: 0, bestOre: 0, minClearSeconds: 0 },
      hard:   { total: 0, clear: 0, death: 0, escape: 0, bestOre: 0, minClearSeconds: 0 },
    },
    shop: {
      visitorsTotal: 0,
      purchasesTotal: 0,
      avgCheckGold: 0,
      maxPurchaseGold: 0,
      visitorsPeakPerMinute: 0,
      visitorsPeakPerHour: 0,
      visitorsByMinute: {},
      visitorsByHour: {},
      lastPurchaseAt: null,
      incomeTotal: 0,
      emptySinceSeconds: 0,
    },
    collapses: {
      total: 0,
      byHit: 0,
      byIdle: 0,
      cellsDestroyed: 0,
      oreLost: 0,
      maxSingle: 0,
      lastAt: null,
    },
    character: {
      level: 1,
      xp: 0,
      title: LEVEL_RANKS[0].title,
      subtitle: LEVEL_RANKS[0].subtitle,
      xpIntoLevel: 0,
      xpForNextLevel: XP_TO_NEXT[0],
      xpToNextLevel: XP_TO_NEXT[0],
      rewardsUnlocked: {
        level10Helmet: false,
        level20Palette: false,
        level30TickerTag: false,
        level40OreSpark: false,
        level50MenuBg: false,
        level60ImmortalShovel: false,
      },
      nameChanges: 0,
      genderChanges: 0,
    },
    economics: {
      baseOrePrice: 3,
      currentOrePrice: 3,
      inflationPct: 100,
      orePerGold: 0.3333,
      productivityOrePerMin: 0,
      deathsPer1000Cells: 0,
      deathCostPerOre: 0,
    },
    atmosphere: {
      daysWithoutIncidents: 0,
      deathStreak: 0,
      successStreak: 0,
      lastDeathAt: null,
      lastRunAt: now,
      cursesCount: 0,
    },
    peaks: {
      maxBankOre: 0,
      maxGold: 0,
      maxHpInRun: 0,
    },
    achievements: {
      gravedigger100Deaths: false,
      digger1000Cells: false,
      oligarch10000Ore: false,
      trader1000Gold: false,
      sapper100Unstable: false,
      coward50Escapes: false,
      lucky1HpSurvivor: false,
      problems5CollapsesRun: false,
      speed50cells10s: false,
    },
  };
}

function deepMerge(base, patch) {
  if (Array.isArray(base)) {
    return Array.isArray(patch) ? patch : base.slice();
  }
  if (base && typeof base === "object") {
    const out = { ...base };
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return out;
    for (const key of Object.keys(patch)) {
      const baseVal = base[key];
      const patchVal = patch[key];
      if (baseVal && typeof baseVal === "object" && !Array.isArray(baseVal)) {
        out[key] = deepMerge(baseVal, patchVal);
      } else if (Array.isArray(baseVal)) {
        out[key] = Array.isArray(patchVal) ? patchVal : baseVal.slice();
      } else {
        out[key] = patchVal;
      }
    }
    return out;
  }
  return patch ?? base;
}

export function getStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return createDefaultStats();
    return deepMerge(createDefaultStats(), JSON.parse(raw));
  } catch {
    const fallback = createDefaultStats();
    fallback.meta.errorsCount += 1;
    return fallback;
  }
}

export function getDifficultyXpMultiplier(diffKey) {
  if (diffKey === "easy") return 0.8;
  if (diffKey === "hard") return 1.5;
  return 1.0;
}

export function getLevelFromXp(totalXp) {
  let level = 1;
  while (level < MAX_LEVEL && totalXp >= XP_TOTAL_BY_LEVEL[level]) {
    level += 1;
  }
  return Math.min(MAX_LEVEL, level);
}

export function getXpNeedForLevel(level) {
  if (level <= 1) return XP_TO_NEXT[0];
  return XP_TO_NEXT[Math.min(MAX_LEVEL - 2, level - 1)] ?? 0;
}

export function addXp(stats, amount) {
  stats.character.xp = Math.max(0, stats.character.xp + amount);
}

function recalcDerived(stats) {
  const sec = Math.max(1, stats.meta.totalPlaySeconds);
  stats.economics.currentOrePrice = stats.economics.baseOrePrice;
  stats.economics.inflationPct =
    (stats.economics.currentOrePrice / Math.max(0.0001, stats.economics.baseOrePrice)) * 100;
  stats.economics.orePerGold = 1 / Math.max(1, stats.economics.currentOrePrice);
  stats.economics.productivityOrePerMin = stats.resources.totalOreMined / (sec / 60);
  stats.economics.deathsPer1000Cells = (stats.runs.death / Math.max(1, stats.cells.openedTotal)) * 1000;
  stats.economics.deathCostPerOre = stats.runs.death / Math.max(1, stats.resources.totalOreMined);
  stats.shop.avgCheckGold = stats.shop.incomeTotal / Math.max(1, stats.shop.purchasesTotal);

  const level = getLevelFromXp(stats.character.xp);
  const rank = LEVEL_RANKS[level - 1] ?? LEVEL_RANKS[LEVEL_RANKS.length - 1];
  stats.character.level = level;
  stats.character.title = rank.title;
  stats.character.subtitle = rank.subtitle;
  const levelStartXp = XP_TOTAL_BY_LEVEL[level - 1] ?? 0;
  const nextLevelXpTotal = XP_TOTAL_BY_LEVEL[level] ?? levelStartXp;
  const xpInto = stats.character.xp - levelStartXp;
  const need = Math.max(0, nextLevelXpTotal - levelStartXp);
  stats.character.xpIntoLevel = xpInto;
  stats.character.xpForNextLevel = need;
  stats.character.xpToNextLevel = Math.max(0, nextLevelXpTotal - stats.character.xp);

  stats.character.rewardsUnlocked.level10Helmet = level >= 10;
  stats.character.rewardsUnlocked.level20Palette = level >= 20;
  stats.character.rewardsUnlocked.level30TickerTag = level >= 30;
  stats.character.rewardsUnlocked.level40OreSpark = level >= 40;
  stats.character.rewardsUnlocked.level50MenuBg = level >= 50;
  stats.character.rewardsUnlocked.level60ImmortalShovel = level >= 60;

  if (stats.collapses.lastAt) {
    const diffMs = Date.now() - new Date(stats.collapses.lastAt).getTime();
    stats.atmosphere.daysWithoutIncidents = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  } else {
    stats.atmosphere.daysWithoutIncidents = 0;
  }

  stats.achievements.gravedigger100Deaths = stats.runs.death >= 100;
  stats.achievements.digger1000Cells = stats.cells.openedTotal >= 1000;
  stats.achievements.oligarch10000Ore = stats.peaks.maxBankOre >= 10000;
  stats.achievements.trader1000Gold = stats.resources.totalGoldEarned >= 1000;
  stats.achievements.sapper100Unstable = stats.cells.unstableActivated >= 100;
  stats.achievements.coward50Escapes = stats.runs.escape >= 50;
}

function saveStats(stats) {
  stats.meta.savesSaved += 1;
  const payload = JSON.stringify(stats);
  try {
    localStorage.setItem(STATS_KEY, payload);
    return;
  } catch {
    // storage full: пробуем подрезать самые "тяжёлые" временные корзины
  }

  const minute = stats.shop?.visitorsByMinute ?? {};
  const hour = stats.shop?.visitorsByHour ?? {};
  const minuteKeys = Object.keys(minute).sort();
  const hourKeys = Object.keys(hour).sort();
  const keepMinute = minuteKeys.slice(-240);
  const keepHour = hourKeys.slice(-240);
  const minuteTrimmed = {};
  const hourTrimmed = {};
  keepMinute.forEach((k) => { minuteTrimmed[k] = minute[k]; });
  keepHour.forEach((k) => { hourTrimmed[k] = hour[k]; });
  if (stats.shop) {
    stats.shop.visitorsByMinute = minuteTrimmed;
    stats.shop.visitorsByHour = hourTrimmed;
  }

  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Последняя попытка: удаляем резервную копию и пробуем ещё раз.
    try {
      localStorage.removeItem("delve_backup_v1");
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
      // Не бросаем исключение наружу, чтобы UI не ломался.
    }
  }
}

export function updateStats(mutator) {
  const stats = getStats();
  mutator(stats);
  recalcDerived(stats);
  saveStats(stats);
  return stats;
}

export function initStatsSession() {
  return updateStats((s) => {
    s.meta.launches += 1;
    s.meta.savesLoaded += 1;
    s.meta.lastLaunchAt = nowIso();
    s.meta.version = APP_VERSION;
    s.atmosphere.lastRunAt = nowIso();
  });
}

export function resetStatsForNewProfile() {
  const prev = getStats();
  const fresh = createDefaultStats();
  fresh.meta.resets = (prev.meta?.resets ?? 0) + 1;
  fresh.meta.launches = prev.meta?.launches ?? 0;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(fresh));
  } catch {
    // ignore
  }
  return fresh;
}

export function getXpTables() {
  return {
    xpToNext: XP_TO_NEXT,
    xpTotalByLevel: XP_TOTAL_BY_LEVEL,
    maxLevel: MAX_LEVEL,
  };
}
