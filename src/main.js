import "./style.css";
import {
  CELL_FLAGGED,
  CELL_HIDDEN,
  CELL_OPEN,
  CELL_REVEALED,
  TYPE_EMPTY,
  TYPE_ORE,
  TYPE_UNSTABLE,
  computeNeighborCounts,
  createGameState,
  getNeighbors,
  openCell,
  revealAdjacentOre,
  toggleFlag,
  triggerIdleCollapse,
  checkVictory,
  DIFFICULTIES,
} from "./game.js";
import hearth from "./icons/hearth.png";
import rocksImg from "./icons/rocks.png";
import oreImg from "./icons/copper-ore.png";
import shopIcon from "./icons/shop-house.png";
import prospectorsIcon from "./icons/prospectors.png";
import guildIcon from "./icons/mines-guild.png";
import bgMusicSrc from "./music/music-background.mp3";
import { renderGrid, updateCells, flashCollapse } from "./render.js";
import { createTicker } from "./news-ticker.js";
import {
  buildShopScreen,
  initShopScreen,
  startShopTick,
  setShopSaleListener,
  setAdPurchaseListener,
  setCaravanEventListener,
  addShopReviewFromContext,
  renderShopReviews,
  renderShopStats,
  renderShopUpgrades,
  renderShopFlowPanel,
  renderCaravansTab,
  renderStaffTab,
} from "./shop-ui.js";
import {
  getGold,
  getAdsLevel,
  isShopOpen,
  openShop,
  resetShop,
  spendGold,
  getOreBank,
  addOreToBank,
  spendOreFromBank,
  getTotalOreInBank,
  ORE_BANK_KEYS,
} from "./shop.js";
import {
  ORE_COPPER,
  ORE_SILVER,
  ORE_GOLD,
  ORE_DIAMOND,
  ORE_CONFIG,
} from "./game.js";
import { LINES } from "./narrator-lines.js";
import {
  buildProspectorsScreen,
  consumeProspectorTool,
  getProspectorInventory,
  getProspectorPassiveEffects,
  PROSPECTOR_TOOLS,
  initProspectorsScreen,
  isProspectorsClubOpen,
  openProspectorsClub,
  PROSPECTORS_UNLOCK_COST,
  renderProspectorsUpgrades,
  resetProspectorsClub,
} from "./prospectors-club.js";
import {
  buildMinersGuildScreen,
  getMinersGuildName,
  initMinersGuildScreen,
  isMinersGuildOpen,
  MINERS_GUILD_UNLOCK_COST,
  openMinersGuild,
  processMinersGuildTick,
  renderMinersGuildScreen,
  resetMinersGuild,
  setMinersGuildName,
} from "./miners-guild.js";
import { resetShopReviews } from "./shop-reviews.js";
import { resetStaff } from "./shop-staff.js";
import { getCaravansState, resetCaravans } from "./shop-caravans.js";
import {
  addXp,
  getDifficultyXpMultiplier,
  getStats,
  initStatsSession,
  resetStatsForNewProfile,
  updateStats,
} from "./stats.js";
import {
  buildTdScreen,
  initTdScreen,
  isTdOpen,
  openTd,
  renderTdScreen,
  pauseTdScreen,
  resumeTdScreen,
  resetTd,
} from "./endgame-td.js";
import {
  buildGachaScreen,
  buildInventoryScreen,
  initGachaScreen,
  initInventoryScreen,
  renderGachaScreen,
  renderInventoryScreen,
  getTickets,
  addTickets,
  resetGacha,
  getEquippedPickaxeEffects,
  getEquippedPickaxeSummary,
} from "./pickaxe-gacha.js";

// ─── МЕТА-ПРОГРЕССИЯ ──────────────────────────────────────────────────────────

const SHOP_UNLOCK_COST = 50;
const TD_UNLOCK_COST = 1200;
const PLAYER_NAME_KEY = "delve_player_name";
const PLAYER_GENDER_KEY = "delve_player_gender";
const MUSIC_VOLUME_KEY = "delve_music_volume";
const MUSIC_MUTED_KEY = "delve_music_muted";
const SAVE_BACKUP_KEY = "delve_backup_v1";
const RESET_STAMP_KEY = "delve_last_reset_at";
const ESCAPE_STREAK_KEY = "delve_escape_streak_v1";
let runtimePlayerName = "";
let runtimePlayerGender = "male";

const ESCAPE_KEEP_BASE = {
  easy: 0.1,
  normal: 0.2,
  hard: 0.35,
};
const ESCAPE_KEEP_MIN = 0.05;
const ESCAPE_STREAK_KEEP_PENALTY = 0.05;
const EARLY_ESCAPE_MIN_COVERAGE = 0.12;
const CLEAR_BONUS_MULT = {
  easy: 0.1,
  normal: 0.25,
  hard: 0.45,
};

// Совместимость: total ore across all banks
function getBank() {
  return getTotalOreInBank();
}

function isUpgBought(id) {
  return localStorage.getItem(`delve_upg_${id}`) === "1";
}
function buyUpg(id) {
  localStorage.setItem(`delve_upg_${id}`, "1");
}

function resetProgress() {
  // Удаляем банки руды (все 4 типа)
  Object.values(ORE_BANK_KEYS).forEach((k) => localStorage.removeItem(k));
  // Удаляем старый единый ключ банка (на случай миграции)
  localStorage.removeItem("delve_ore_bank");
  localStorage.removeItem(PLAYER_NAME_KEY);
  localStorage.removeItem(PLAYER_GENDER_KEY);
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith("delve_upg_")) localStorage.removeItem(k);
  });
  resetShop();
  resetStaff();
  resetCaravans();
  resetTd();
  resetGacha();
  resetProspectorsClub();
  resetMinersGuild();
  resetShopReviews();
  localStorage.removeItem("delve_shop_open");
  localStorage.removeItem(ESCAPE_STREAK_KEY);
  localStorage.removeItem(SAVE_BACKUP_KEY);
  localStorage.setItem(RESET_STAMP_KEY, new Date().toISOString());
}

function getEscapeStreak() {
  const v = parseInt(localStorage.getItem(ESCAPE_STREAK_KEY) ?? "0", 10);
  return Number.isNaN(v) ? 0 : Math.max(0, v);
}

function setEscapeStreak(v) {
  localStorage.setItem(ESCAPE_STREAK_KEY, String(Math.max(0, Math.floor(v))));
}

function hasShopUnlocked() {
  return isUpgBought("shop") || isShopOpen();
}

function hasProspectorsUnlocked() {
  return isUpgBought("prospectors") || isProspectorsClubOpen();
}

function hasGuildUnlocked() {
  return isUpgBought("guild") || isMinersGuildOpen();
}

function hasTdUnlocked() {
  return isUpgBought("td") || isTdOpen();
}

function hasGachaUnlocked() {
  return true;
}

function syncShopUnlockState() {
  if (hasShopUnlocked() && !isShopOpen()) openShop();
}

function getPlayerName() {
  try {
    const fromStorage = (localStorage.getItem(PLAYER_NAME_KEY) ?? "").trim();
    return fromStorage || runtimePlayerName;
  } catch {
    return runtimePlayerName;
  }
}

function getPlayerGender() {
  try {
    const g = localStorage.getItem(PLAYER_GENDER_KEY);
    if (g === "female") return "female";
  } catch {
    // ignore
  }
  return runtimePlayerGender === "female" ? "female" : "male";
}

function savePlayerProfile(name, gender) {
  runtimePlayerName = name.trim();
  runtimePlayerGender = gender === "female" ? "female" : "male";
  try {
    localStorage.setItem(PLAYER_NAME_KEY, runtimePlayerName);
    localStorage.setItem(PLAYER_GENDER_KEY, runtimePlayerGender);
  } catch {
    // Если localStorage переполнен, используем runtime-профиль до перезапуска.
  }
}

function getDelveStorageSnapshot() {
  const allowPrefixes = ["delve_upg_", "delve_bank_", "delve_staff_"];
  const allowExact = new Set([
    "delve_gold",
    "delve_ads_level",
    "delve_shop_open",
    "delve_player_name",
    "delve_player_gender",
    "delve_caravans_v1",
    "delve_prospectors_open",
    "delve_prospectors_state",
    "delve_guild_open",
    "delve_guild_state",
    "delve_td_open",
    "delve_gacha_open",
    "delve_td_tickets",
    "delve_pickaxe_inv_v1",
    "delve_pickaxe_equipped_v1",
    "delve_gacha_pity_v1",
  ]);
  const out = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    const allowed =
      allowExact.has(key) || allowPrefixes.some((p) => key.startsWith(p));
    if (!allowed) continue;
    if (key === SAVE_BACKUP_KEY) continue;
    out[key] = localStorage.getItem(key);
  }
  return out;
}

function hasMeaningfulProgress(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  const keys = Object.keys(snapshot);
  if (!keys.length) return false;

  const upgBought = keys.some(
    (k) => k.startsWith("delve_upg_") && snapshot[k] === "1",
  );
  const oreTotal = Object.values(ORE_BANK_KEYS).reduce(
    (sum, k) => sum + parseInt(snapshot[k] ?? "0", 10),
    0,
  );
  const gold = parseInt(snapshot.delve_gold ?? "0", 10);
  const tickets = parseInt(snapshot.delve_td_tickets ?? "0", 10);
  const shopOpen = snapshot.delve_shop_open === "1";

  return upgBought || oreTotal > 0 || gold > 0 || tickets > 0 || shopOpen;
}

function backupProgressSnapshot() {
  // Временное отключение автоснапшота: мешал стабильному старту у части сохранений.
}

function restoreProgressFromBackupIfNeeded() {
  // Временное отключение автовосстановления до полной стабилизации.
  try {
    localStorage.removeItem(SAVE_BACKUP_KEY);
  } catch {
    // ignore
  }
  return false;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

document.getElementById("app").innerHTML = `
  <!-- ══ ГЛАВНОЕ МЕНЮ ══ -->
  <div id="screen-start" class="screen active">

    <!-- ── Заголовок + статус-бар ── -->
    <div class="start-header">
      <div class="start-title-block">
        <div class="start-title">⛏ DELVE</div>
        <div class="start-sub">Спуск в шахту · выживи и обогатись</div>
      </div>
      <div class="start-status-bar">
        <div class="status-currencies">
          <div class="status-bank-group ore-type-copper" id="bank-group-copper">
            <span class="bank-ore-dot ore-dot-copper">●</span>
            <span class="status-bank-val" id="bank-val-copper">0</span>
            <span class="status-bank-unit">меди</span>
          </div>
          <div class="status-bank-group ore-type-silver" id="bank-group-silver" style="display:none">
            <span class="bank-ore-dot ore-dot-silver">●</span>
            <span class="status-bank-val" id="bank-val-silver">0</span>
            <span class="status-bank-unit">серебр.</span>
          </div>
          <div class="status-bank-group ore-type-gold" id="bank-group-gold" style="display:none">
            <span class="bank-ore-dot ore-dot-gold">●</span>
            <span class="status-bank-val" id="bank-val-gold">0</span>
            <span class="status-bank-unit">золота</span>
          </div>
          <div class="status-bank-group ore-type-diamond" id="bank-group-diamond" style="display:none">
            <span class="bank-ore-dot ore-dot-diamond">●</span>
            <span class="status-bank-val" id="bank-val-diamond">0</span>
            <span class="status-bank-unit">алмазов</span>
          </div>
          <div class="status-gold-group" id="status-gold-group" style="display:none">
            <span class="status-gold-icon">●</span>
            <span class="status-gold-val" id="gold-display">0</span>
            <span class="status-gold-unit">монет</span>
          </div>
          <div class="status-gold-group" id="status-ticket-group" style="display:none">
            <span class="status-gold-icon">🎟</span>
            <span class="status-gold-val" id="ticket-display">0</span>
            <span class="status-gold-unit">билетов</span>
          </div>
        </div>
        <div class="status-actions">
          <button class="shop-open-btn btn-primary" id="open-shop-btn">🏪 МАГАЗИН</button>
          <button class="shop-open-btn btn-primary" id="open-td-btn">🛡 TD</button>
          <button class="shop-open-btn btn-primary" id="open-gacha-btn">🎰 ГАЧА</button>
          <button class="shop-open-btn btn-primary" id="open-inventory-btn">🎒 ИНВЕНТАРЬ</button>
          <button class="music-mute-btn btn-primary" id="music-mute-btn" type="button">🔊</button>
          <input id="music-volume" class="music-slider status-music-slider" type="range" min="0" max="100" step="1" value="55">
          <span class="music-value" id="music-volume-value">55%</span>
          <button class="reset-btn btn-danger" id="reset-btn" title="Сбросить прогресс">↺</button>
        </div>
        <button class="help-btn" id="help-btn">? СПРАВКА</button>
      </div>
    </div>

    <div id="ticker-mount"></div>

    <div class="start-columns">

      <!-- ── Левая колонка: вылазка + улучшения ── -->
      <div class="start-left-col">

        <div class="panel start-expedition-panel">
          <div class="panel-header"><span class="icon">🗺</span> ВЫБЕРИТЕ ВЫЛАЗКУ</div>
          <div id="diff-options"></div>
        </div>

        <div class="panel upgrades-panel">
          <div class="panel-header"><span class="icon">🏗</span> УЛУЧШЕНИЯ</div>
          <div class="upgrades-grid" id="upgrades-grid"></div>
        </div>

      </div>

      <!-- ── Правая колонка: персонаж + статистика ── -->
      <div class="start-right-col">

        <!-- Виджет уровня игрока -->
        <div class="panel player-widget-panel" id="player-widget-panel">
          <div class="panel-header"><span class="icon">🧑‍🏭</span> ПЕРСОНАЖ</div>
          <div class="player-widget" id="player-widget">
            <div class="pw-avatar-col">
              <div class="pw-avatar" id="pw-avatar">👨</div>
              <div class="pw-name" id="pw-name">Шахтер</div>
            </div>
            <div class="pw-level-col">
              <div class="pw-level-row">
                <span class="pw-level-label">УР.</span>
                <span class="pw-level-num" id="pw-level-num">1</span>
                <span class="pw-level-max">/60</span>
                <span class="pw-title" id="pw-title">Копатель-неудачник</span>
              </div>
              <div class="pw-subtitle" id="pw-subtitle">Падение было долгим. Ты всё ещё падаешь.</div>
              <div class="pw-xp-bar-wrap">
                <div class="pw-xp-bar" id="pw-xp-bar" style="width:0%"></div>
                <div class="pw-xp-label" id="pw-xp-label">0 / 100 XP</div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel stats-panel">
          <div class="panel-header"><span class="icon">📊</span> СТАТИСТИКА</div>
          <div class="stats-content" id="stats-content"></div>
        </div>

        <div class="panel help-panel" id="help-panel" style="display:none;">
          <div class="panel-header">
            <span class="icon">📖</span> СПРАВКА
            <button class="help-close-btn" id="help-close-btn">✕</button>
          </div>
          <div class="panel-body">
            <div class="legend-grid">
              <div class="legend-sym"><img class="legend-icon" id="legend-rocks" src="" draggable="false"></div>
              <div class="legend-text"><strong>Порода</strong> — нераскопано. ЛКМ — копать.</div>

              <div class="legend-sym open-cell">!</div>
              <div class="legend-text"><strong>Метка опасности</strong> — ПКМ поставить / снять.</div>

              <div class="legend-sym open-cell"><img class="legend-icon" id="legend-ore" src="" draggable="false"></div>
              <div class="legend-text"><strong>Руда</strong> — кликни чтобы собрать, идёт в банк.</div>

              <div class="legend-sym open-cell" style="color:#ee4444;">*</div>
              <div class="legend-text"><strong>Нестабильная порода</strong> — удар → -1 HP + обвал!</div>

              <div class="legend-sym open-cell" style="color:#5599dd;font-size:10px;">1–4</div>
              <div class="legend-text"><strong>Цифра</strong> — нестабильных соседей рядом.</div>

              <hr class="legend-sep">

              <div class="legend-sym open-cell"><img class="legend-icon" id="legend-hearth" src="" draggable="false"></div>
              <div class="legend-text">При нуле HP — вылазка заканчивается.</div>

              <div class="legend-sym open-cell" style="color:#ee8833;font-size:24px;">⚠</div>
              <div class="legend-text">
                <strong>Обвал при ударе</strong> — мгновенно по нестаб. клетке.<br>
                <strong>Обвал при простое</strong> — если долго не копать.
              </div>

              <hr class="legend-sep">

              <div class="legend-sym open-cell" style="color:#c8a84b;">🚪</div>
              <div class="legend-text"><strong>Выход</strong> — кнопка в HUD. Теряешь часть руды.</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  ${buildShopScreen()}
  ${buildProspectorsScreen()}
  ${buildMinersGuildScreen()}
  ${buildTdScreen()}
  ${buildGachaScreen()}
  ${buildInventoryScreen()}

  <!-- ══ ИГРА ══ -->
  <div id="screen-game" class="screen">

    <div id="hud">
      <!-- HP -->
      <div class="hud-section hud-hp">
        <div class="hud-section-label">ЗДОРОВЬЕ</div>
        <div id="hud-hearts" class="hud-hearts-row"></div>
      </div>

      <!-- Руда вылазки -->
      <div class="hud-section hud-ore-sec">
        <div class="hud-section-label">РУДА</div>
        <div class="hud-ore-row">
          <img class="hud-ore-icon" id="hud-ore-icon" src="" draggable="false" alt="">
          <span class="hud-big-val ore-color" id="hud-ore-val">0</span>
        </div>
      </div>

      <!-- Банк -->
      <div class="hud-section hud-bank-sec">
        <div class="hud-section-label">БАНК</div>
        <span class="hud-big-val gold-color" id="hud-bank-val">0</span>
      </div>

      <!-- Таймер -->
      <div class="hud-section hud-timer-sec">
        <div class="hud-section-label">ВРЕМЯ</div>
        <span class="hud-timer" id="hud-timer-val">00:00</span>
      </div>

      <!-- Сложность -->
      <div class="hud-section hud-diff-sec">
        <div class="hud-section-label">РЕЖИМ</div>
        <span class="hud-diff-val" id="hud-diff-val">—</span>
      </div>

      <!-- Массовый сбор руды -->
      <div class="hud-section hud-collect-sec">
        <button class="collect-ore-btn btn-primary" id="collect-ore-btn">📥 СБОР РУДЫ</button>
      </div>

      <!-- Предупреждения (idle countdown) -->
      <div class="hud-section hud-events-sec">
        <span id="event-warning" class="event-warning-hud"></span>
      </div>

      <!-- Кнопка выхода -->
      <div class="hud-section hud-escape-sec">
        <button class="escape-btn btn-danger" id="escape-btn">🚪 УЙТИ</button>
      </div>

      <div class="hud-section hud-mobile-flag-sec" id="hud-mobile-flag-sec">
        <button class="collect-ore-btn" id="mobile-flag-toggle-btn">🚩 ФЛАГ: OFF</button>
      </div>
    </div>

    <div class="game-main-layout">
      <div id="grid-wrapper">
        <div id="grid"></div>
        <div id="miner-sprite" aria-hidden="true">⛏️</div>
      </div>

      <aside class="panel game-guide-panel" id="game-guide-panel">
        <div class="panel-header"><span class="icon">🧭</span> ГАЙД ПО САПЕРУ DELVE</div>
        <div class="panel-body game-guide-body">
          <div class="game-music-inline">
            <div class="game-guide-subtitle">Музыка</div>
            <div class="game-music-controls">
              <button class="music-mute-btn btn-primary" id="game-music-mute-btn" type="button">🔊 ВКЛ</button>
              <input id="game-music-volume" class="music-slider game-music-slider" type="range" min="0" max="100" step="1" value="55">
              <span class="music-value" id="game-music-volume-value">55%</span>
            </div>
          </div>

          <div class="game-tools-inline">
            <div class="game-guide-subtitle">Инструменты клуба</div>
            <div class="run-tools" id="run-tools"></div>
            <div class="run-tools-hint" id="run-tools-hint">Открой «Клуб старателей» и закупи расходники перед вылазкой.</div>
          </div>

          <div class="game-guide-subtitle">Как играть</div>
          <ul class="game-guide-list">
            <li>🖱 ЛКМ по 🪨: открываешь клетки.</li>
            <li>⛏ Нашел подсвеченную руду: кликни и забери в банк.</li>
            <li>🧰 Инструменты справа: выбери предмет и применяй его в вылазке.</li>
            <li>🚩 ПКМ: поставить/снять флаг на опасной клетке.</li>
            <li>💥 Красная нестабильная клетка: урон по HP + обвал.</li>
            <li>😴 Долго AFK: будет бвал (смотри предупреждение).</li>
            <li>🚪 «УЙТИ»: безопаснее для жизни, но часть руды потеряешь.</li>
            <li>✅ Победа: открыты все безопасные клетки. ☠ Поражение: HP = 0.</li>
          </ul>

          <div class="game-guide-subtitle">Полезно</div>
          <p class="game-guide-note">🟢 Easy: меньше руды и риска. 🔴 Hard: больше руды, но ошибки наказываются жёстче.</p>
        </div>
      </aside>
    </div>
  </div>

  <!-- ══ РЕЗУЛЬТАТЫ ══ -->
  <div id="screen-result" class="screen">
    <div class="panel result-panel">
      <div class="panel-header" id="result-header"></div>
      <div class="result-rows" id="result-rows"></div>
      <div class="result-reason" id="result-reason"></div>
    </div>
    <button class="new-run-btn btn-primary" id="new-run-btn">⛏ НОВАЯ ВЫЛАЗКА</button>
  </div>

  <!-- ══ ДИАЛОГ ВЫХОДА ══ -->
  <div id="escape-modal" class="modal-overlay" style="display:none;">
    <div class="modal panel">
      <div class="panel-header">🚪 ДОСРОЧНЫЙ ВЫХОД</div>
      <div class="modal-body">
        <div id="escape-modal-text" class="modal-text"></div>
        <div class="modal-buttons">
          <button class="modal-btn modal-btn-danger btn-danger"  id="escape-confirm">Уйти</button>
          <button class="modal-btn modal-btn-cancel btn-primary"  id="escape-cancel">Остаться</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ ДИАЛОГ СБРОСА ══ -->
  <div id="reset-modal" class="modal-overlay" style="display:none;">
    <div class="modal panel">
      <div class="panel-header">↺ СБРОС ПРОГРЕССА</div>
      <div class="modal-body">
        <div class="modal-text">
          <p>Сбросить весь прогресс?</p>
          <p class="modal-warn">Банк руды и все купленные улучшения будут удалены.</p>
        </div>
        <div class="modal-buttons">
          <button class="modal-btn modal-btn-danger btn-danger" id="reset-confirm">Сбросить</button>
          <button class="modal-btn modal-btn-cancel btn-primary" id="reset-cancel">Отмена</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ ПОПАП ОБВАЛА (центр экрана) ══ -->
  <div id="collapse-popup" class="collapse-popup" style="display:none;">
    <div class="collapse-popup-inner">
      <div class="collapse-popup-icon">💤</div>
      <div class="collapse-popup-title">ОБВАЛ ОТ БЕЗДЕЙСТВИЯ</div>
      <div class="collapse-popup-sub" id="collapse-popup-sub"></div>
    </div>
  </div>

  <div id="shop-toast-stack" class="shop-toast-stack" aria-live="polite"></div>
  <aside id="commentator" class="commentator">
    <div class="commentator-rank" id="commentator-rank">Ур. 1 · Копатель-неудачник</div>
    <div class="commentator-rank-sub" id="commentator-rank-sub">Падение было долгим. Ты всё ещё падаешь.</div>
    <div class="commentator-main">
      <div class="commentator-avatar" id="commentator-avatar">👨</div>
      <div class="commentator-box">
        <div class="commentator-name" id="commentator-name">Шахтер</div>
        <div class="commentator-text" id="commentator-text">Передышка перед новой сменой.</div>
      </div>
    </div>
  </aside>

  <div id="character-modal" class="modal-overlay" style="display:none;">
    <div class="modal panel">
      <div class="panel-header" id="character-modal-title">🪪 НОВЫЙ ШАХТЕР</div>
      <div class="modal-body">
        <div class="modal-text">
          <p>Назови нового шахтера и выбери пол:</p>
          <input id="character-name-input" class="char-name-input" type="text" maxlength="24" placeholder="Имя шахтера">
          <div class="char-gender-row">
            <button id="gender-male-btn" class="char-gender-btn selected" type="button">👨 Мужчина</button>
            <button id="gender-female-btn" class="char-gender-btn" type="button">👩 Женщина</button>
          </div>
        </div>
        <div class="modal-buttons">
          <button class="modal-btn btn-primary" id="character-save-btn">СОЗДАТЬ</button>
        </div>
      </div>
    </div>
  </div>

  <div id="guild-name-modal" class="modal-overlay" style="display:none;">
    <div class="modal panel">
      <div class="panel-header" id="guild-name-modal-title">🏛 НАЗВАНИЕ ГИЛЬДИИ</div>
      <div class="modal-body">
        <div class="modal-text">
          <p>Дай название своей гильдии шахтеров:</p>
          <input
            id="guild-name-input"
            class="char-name-input"
            type="text"
            maxlength="32"
            placeholder="Например: Стальной Забой"
          >
        </div>
        <div class="modal-buttons">
          <button class="modal-btn modal-btn-cancel btn-primary" id="guild-name-cancel">Отмена</button>
          <button class="modal-btn btn-primary" id="guild-name-save">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
`;

// ─── REFS ─────────────────────────────────────────────────────────────────────

const screenStart = document.getElementById("screen-start");
const screenShop = document.getElementById("screen-shop");
const screenProspectors = document.getElementById("screen-prospectors");
const screenGuild = document.getElementById("screen-guild");
const screenTd = document.getElementById("screen-td");
const screenGacha = document.getElementById("screen-gacha");
const screenInventory = document.getElementById("screen-inventory");
const screenGame = document.getElementById("screen-game");
const screenResult = document.getElementById("screen-result");
const diffOptions = document.getElementById("diff-options");
const upgradesGrid = document.getElementById("upgrades-grid");
const goldDisplay = document.getElementById("gold-display");
const statusGoldGroup = document.getElementById("status-gold-group");
const statusTicketGroup = document.getElementById("status-ticket-group");
const ticketDisplay = document.getElementById("ticket-display");
const openShopBtn = document.getElementById("open-shop-btn");
const openTdBtn = document.getElementById("open-td-btn");
const openGachaBtn = document.getElementById("open-gacha-btn");
const openInventoryBtn = document.getElementById("open-inventory-btn");
const statsContent = document.getElementById("stats-content");
const helpPanel = document.getElementById("help-panel");
const helpBtn = document.getElementById("help-btn");
const helpCloseBtn = document.getElementById("help-close-btn");
const resetBtn = document.getElementById("reset-btn");
const resetModal = document.getElementById("reset-modal");
const resetConfirm = document.getElementById("reset-confirm");
const resetCancel = document.getElementById("reset-cancel");
const gridEl = document.getElementById("grid");
const hudHeartsEl = document.getElementById("hud-hearts");
const hudOreEl = document.getElementById("hud-ore-val");
const hudBankEl = document.getElementById("hud-bank-val");
const hudTimerEl = document.getElementById("hud-timer-val");
const hudDiffEl = document.getElementById("hud-diff-val");
const eventWarnEl = document.getElementById("event-warning");
const collectOreBtn = document.getElementById("collect-ore-btn");
const escapeBtn = document.getElementById("escape-btn");
const mobileFlagToggleBtn = document.getElementById("mobile-flag-toggle-btn");
const escapeModal = document.getElementById("escape-modal");
const escapeMsgEl = document.getElementById("escape-modal-text");
const escapeConfirm = document.getElementById("escape-confirm");
const escapeCancel = document.getElementById("escape-cancel");
const resultHeader = document.getElementById("result-header");
const resultRows = document.getElementById("result-rows");
const resultReason = document.getElementById("result-reason");
const newRunBtn = document.getElementById("new-run-btn");
const collapsePopup = document.getElementById("collapse-popup");
const collapsePopupSub = document.getElementById("collapse-popup-sub");
const tickerMount = document.getElementById("ticker-mount");
const shopToastStack = document.getElementById("shop-toast-stack");
const minerSprite = document.getElementById("miner-sprite");
const commentatorText = document.getElementById("commentator-text");
const commentatorAvatar = document.getElementById("commentator-avatar");
const commentatorName = document.getElementById("commentator-name");
const commentatorRank = document.getElementById("commentator-rank");
const commentatorRankSub = document.getElementById("commentator-rank-sub");
const runToolsEl = document.getElementById("run-tools");
const runToolsHint = document.getElementById("run-tools-hint");
const characterModal = document.getElementById("character-modal");
const characterModalTitle = document.getElementById("character-modal-title");
const characterNameInput = document.getElementById("character-name-input");
const genderMaleBtn = document.getElementById("gender-male-btn");
const genderFemaleBtn = document.getElementById("gender-female-btn");
const characterSaveBtn = document.getElementById("character-save-btn");
const guildNameModal = document.getElementById("guild-name-modal");
const guildNameModalTitle = document.getElementById("guild-name-modal-title");
const guildNameInput = document.getElementById("guild-name-input");
const guildNameCancelBtn = document.getElementById("guild-name-cancel");
const guildNameSaveBtn = document.getElementById("guild-name-save");
const musicMuteBtn = document.getElementById("music-mute-btn");
const musicVolumeInput = document.getElementById("music-volume");
const musicVolumeValue = document.getElementById("music-volume-value");
const gameMusicMuteBtn = document.getElementById("game-music-mute-btn");
const gameMusicVolumeInput = document.getElementById("game-music-volume");
const gameMusicVolumeValue = document.getElementById("game-music-volume-value");

// Выставляем иконки через JS (чтобы Vite правильно хэшировал пути)
document.getElementById("hud-ore-icon").src = oreImg;
if (tickerMount) tickerMount.appendChild(createTicker(getNewsContext));

// Создаём сердца один раз (с учетом апгрейдов клуба)
const MAX_HEARTS = 6;
const heartImgs = [];
for (let i = 0; i < MAX_HEARTS; i++) {
  const img = document.createElement("img");
  img.src = hearth;
  img.draggable = false;
  img.className = "heart empty";
  hudHeartsEl.appendChild(img);
  heartImgs.push(img);
}

// ─── СТАТУС-БАР ───────────────────────────────────────────────────────────────

function refreshStatusBar() {
  // Обновляем каждый тип руды в статус-баре
  const ORE_ORDER = [ORE_COPPER, ORE_SILVER, ORE_GOLD, ORE_DIAMOND];
  ORE_ORDER.forEach((oreType) => {
    const el = document.getElementById(`bank-val-${oreType}`);
    const group = document.getElementById(`bank-group-${oreType}`);
    if (!el || !group) return;
    const amount = getOreBank(oreType);
    el.textContent = amount;
    // Скрываем нулевые типы руды если магазин не открыт (кроме меди)
    const show = oreType === ORE_COPPER || amount > 0;
    group.style.display = show ? "" : "none";
  });

  const gold = getGold();
  const shopUnlocked = hasShopUnlocked();
  if (statusGoldGroup) {
    statusGoldGroup.style.display = shopUnlocked ? "" : "none";
  }
  if (goldDisplay && shopUnlocked) {
    goldDisplay.textContent = gold;
  }

  if (statusTicketGroup) {
    statusTicketGroup.style.display = hasTdUnlocked() ? "" : "none";
  }
  if (ticketDisplay && hasTdUnlocked()) {
    ticketDisplay.textContent = String(getTickets());
  }
  refreshEndgameButtons();
}

// ─── СОСТОЯНИЕ ────────────────────────────────────────────────────────────────

let state = null;
let tickInterval = null;
let idleCheckInterval = null;
let idleTriggered = false;
let lastNarrationAt = 0;
let escapeModalOpen = false;
let selectedToolId = null;
let runToolInventory = {};
let bgMusicStarted = false;
let runPickaxeEffects = {};
let runSecondWindUsed = false;
let mobileFlagMode = false;
const bgMusic = new Audio(bgMusicSrc);
bgMusic.loop = true;
bgMusic.preload = "auto";

function withRunXp(baseAmount) {
  if (!state) return baseAmount;
  const mult = getDifficultyXpMultiplier(state.diffKey);
  return Math.round(baseAmount * mult);
}

function getGridCellSize() {
  if (!gridEl) return 44;
  const w = gridEl.clientWidth;
  if (!w) return 44;
  return w / 15;
}

function getSavedMusicVolume() {
  const raw = parseInt(localStorage.getItem(MUSIC_VOLUME_KEY) ?? "55", 10);
  if (Number.isNaN(raw)) return 55;
  return Math.max(0, Math.min(100, raw));
}

function isMusicMuted() {
  return localStorage.getItem(MUSIC_MUTED_KEY) === "1";
}

function applyMusicSettings() {
  const volume = getSavedMusicVolume();
  const muted = isMusicMuted();
  bgMusic.volume = volume / 100;
  bgMusic.muted = muted;
  [musicVolumeInput, gameMusicVolumeInput].forEach((input) => {
    if (input) input.value = String(volume);
  });
  [musicVolumeValue, gameMusicVolumeValue].forEach((label) => {
    if (label) label.textContent = `${volume}%`;
  });
  [musicMuteBtn, gameMusicMuteBtn].forEach((btn) => {
    if (btn) btn.textContent = muted ? "🔇 ВЫКЛ" : "🔊 ВКЛ";
  });
}

function tryStartMusic() {
  if (bgMusicStarted) return;
  bgMusic
    .play()
    .then(() => {
      bgMusicStarted = true;
    })
    .catch(() => {});
}

function getToolById(id) {
  return PROSPECTOR_TOOLS.find((t) => t.id === id) ?? null;
}

function setRunToolHint(text) {
  if (runToolsHint) runToolsHint.textContent = text;
}

function renderRunTools() {
  if (!runToolsEl) return;
  if (!hasProspectorsUnlocked()) {
    runToolsEl.innerHTML = "";
    setRunToolHint(
      "Открой «Клуб старателей», чтобы получить доступ к инструментам.",
    );
    return;
  }

  const inventory = runToolInventory || {};
  runToolsEl.innerHTML = PROSPECTOR_TOOLS.map((tool) => {
    const count = inventory[tool.id] ?? 0;
    const disabled = !state || state.ended || count <= 0;
    const selected = selectedToolId === tool.id;
    return `
      <button
        class="run-tool-btn ${selected ? "active" : ""}"
        data-tool="${tool.id}"
        ${disabled ? "disabled" : ""}
        title="${tool.desc}"
      >
        <span class="run-tool-ico">${tool.icon}</span>
        <span class="run-tool-name">${tool.label}</span>
        <span class="run-tool-count">x${count}</span>
      </button>`;
  }).join("");

  runToolsEl.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-tool");
      const tool = getToolById(id);
      if (!tool || !state || state.ended) return;
      if (tool.targeted) {
        selectedToolId = selectedToolId === id ? null : id;
        if (selectedToolId) {
          setRunToolHint(`${tool.icon} ${tool.label}: выбери клетку на поле.`);
        } else {
          setRunToolHint("Инструмент снят. Обычный режим копки.");
        }
        renderRunTools();
      } else {
        const ok = useInstantTool(id);
        if (ok) {
          selectedToolId = null;
          renderRunTools();
        }
      }
    });
  });
}

function consumeRunTool(toolId) {
  if (!consumeProspectorTool(toolId, 1)) return false;
  runToolInventory[toolId] = Math.max(0, (runToolInventory[toolId] ?? 0) - 1);
  return true;
}

function applyRunPassives() {
  const passives = getProspectorPassiveEffects();
  const pickaxeFx = runPickaxeEffects ?? {};
  state.diff = { ...state.diff };
  state.diff.startHp = Math.min(
    6,
    state.diff.startHp +
      (passives.extraStartHp ?? 0) +
      (pickaxeFx.extraStartHp ?? 0),
  );
  state.hp = state.diff.startHp;
}

function calcOreGainMultiplier() {
  const fx = runPickaxeEffects ?? {};
  let bonus = 0;
  if (fx.doubleOreChance && Math.random() < fx.doubleOreChance) bonus += 1;
  if (fx.gatherBonusChance && Math.random() < fx.gatherBonusChance) bonus += 1;
  return 1 + bonus;
}

function grantRunOre(oreType, baseAmount = 1) {
  if (!state || baseAmount <= 0) return 0;
  const t = oreType ?? ORE_COPPER;
  let granted = 0;
  for (let i = 0; i < baseAmount; i += 1) {
    granted += calcOreGainMultiplier();
  }
  state.ores[t] = (state.ores[t] ?? 0) + granted;
  return granted;
}

function applyStartPickaxeEffects() {
  const fx = runPickaxeEffects ?? {};
  if (fx.startOreBonus) {
    grantRunOre(ORE_COPPER, fx.startOreBonus);
  }
  if (!fx.revealOreAtStart || fx.revealOreAtStart <= 0) return;
  const hiddenOres = [];
  for (let r = 0; r < state.grid.length; r += 1) {
    for (let c = 0; c < state.grid[r].length; c += 1) {
      const cell = state.grid[r][c];
      if (cell.type === TYPE_ORE && cell.state === CELL_HIDDEN) {
        hiddenOres.push({ r, c });
      }
    }
  }
  if (!hiddenOres.length) return;
  for (let i = hiddenOres.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [hiddenOres[i], hiddenOres[j]] = [hiddenOres[j], hiddenOres[i]];
  }
  const toReveal = hiddenOres.slice(0, fx.revealOreAtStart);
  toReveal.forEach(({ r, c }) => {
    state.grid[r][c].state = CELL_REVEALED;
  });
}

// ─── ГЛАВНОЕ МЕНЮ ─────────────────────────────────────────────────────────────

function showStartScreen() {
  syncShopUnlockState();
  setActive(screenStart);
  diffOptions.innerHTML = "";
  screenStart.classList.toggle("shop-bg", hasShopUnlocked());
  updatePlayerIdentityUI();

  const lr = document.getElementById("legend-rocks");
  const lh = document.getElementById("legend-hearth");
  const lo = document.getElementById("legend-ore");
  if (lr) lr.src = rocksImg;
  if (lh) lh.src = hearth;
  if (lo) lo.src = oreImg;

  refreshStatusBar();
  refreshShopButtonState();
  refreshEndgameButtons();

  const DIFF_FLAVOR = {
    easy: { hint: "Меньше руды, меньше угроз. Обвалы небольшие.", mood: "🟢" },
    normal: { hint: "Стандартный баланс риска и награды.", mood: "🟡" },
    hard: {
      hint: "Много угроз, жёсткие обвалы. Побег — дорогое дело.",
      mood: "🔴",
    },
  };

  Object.entries(DIFFICULTIES).forEach(([key, d]) => {
    const btn = document.createElement("button");
    btn.className = "time-option";
    const f = DIFF_FLAVOR[key];
    const keepPct = Math.round((ESCAPE_KEEP_BASE[key] ?? 0.2) * 100);
    btn.innerHTML = `
      <span class="opt-dur">${f.mood} ${d.label}</span>
      <span class="opt-desc">${f.hint}</span>
      <span class="opt-collapse">HP: ${d.startHp} · при побеге базово сохраняешь ${keepPct}% руды</span>`;
    btn.addEventListener("click", () => startGame(key));
    diffOptions.appendChild(btn);
  });

  renderUpgrades();
  renderStatsPanel();
  helpPanel.style.display = "none";
  selectedToolId = null;
  runToolInventory = getProspectorInventory();
  renderRunTools();
  setRunToolHint(
    `Кирка: ${getEquippedPickaxeSummary()}. Подготовь расходники в «Клубе старателей».`,
  );
  narrate("openMenu");
}

function refreshShopButtonState() {
  const shopOpened = hasShopUnlocked();
  openShopBtn.disabled = !shopOpened;
  openShopBtn.textContent = shopOpened ? "🏪 МАГАЗИН" : "🏪 ЗАКРЫТ";
  openShopBtn.title = shopOpened
    ? "Открыть торговую лавку"
    : `Купи улучшение «Магазин» за ${SHOP_UNLOCK_COST} меди`;
}

function refreshEndgameButtons() {
  const tdOpen = hasTdUnlocked();
  const gachaOpen = hasGachaUnlocked();
  if (openTdBtn) {
    openTdBtn.disabled = !tdOpen;
    openTdBtn.textContent = tdOpen ? "🛡 TD" : "🛡 TD 🔒";
  }
  if (openGachaBtn) {
    openGachaBtn.disabled = !gachaOpen;
    openGachaBtn.textContent = gachaOpen ? "🎰 ГАЧА" : "🎰 ГАЧА 🔒";
  }
  if (openInventoryBtn) {
    openInventoryBtn.disabled = false;
    openInventoryBtn.textContent = "🎒 ИНВЕНТАРЬ";
  }
}

// ─── УЛУЧШЕНИЯ ────────────────────────────────────────────────────────────────

const UPGRADES_DEF = [
  {
    id: "shop",
    label: "Магазин",
    cost: SHOP_UNLOCK_COST,
    icon: shopIcon,
    desc: "Открыть свою торговлю",
  },
  {
    id: "prospectors",
    label: "Клуб старателей",
    cost: PROSPECTORS_UNLOCK_COST,
    currency: "gold",
    icon: prospectorsIcon,
    desc: "Новые инструменты: бомбы и т.д.",
  },
  {
    id: "guild",
    label: "Гильдия шахтеров",
    cost: MINERS_GUILD_UNLOCK_COST,
    currency: "gold",
    icon: guildIcon,
    desc: "Найм бригады для пассивной добычи руды.",
  },
  {
    id: "td",
    label: "Полигон TD",
    cost: TD_UNLOCK_COST,
    currency: "gold",
    icon: guildIcon,
    desc: "Энд-гейм оборона. Тратишь золото, получаешь билеты.",
  },
];

function renderUpgrades() {
  upgradesGrid.innerHTML = "";
  const copperBank = getOreBank(ORE_COPPER);

  UPGRADES_DEF.forEach((upg) => {
    const boughtMap = {
      shop: hasShopUnlocked(),
      prospectors: hasProspectorsUnlocked(),
      guild: hasGuildUnlocked(),
      td: hasTdUnlocked(),
      gacha: hasGachaUnlocked(),
    };
    const bought = boughtMap[upg.id] ?? isUpgBought(upg.id);
    const currency = upg.currency ?? "ore";
    const lockedByChain =
      (upg.id === "td" && !hasGuildUnlocked());
    const canAfford =
      !bought &&
      !lockedByChain &&
      (currency === "gold" ? getGold() >= upg.cost : copperBank >= upg.cost);
    const costLabel = upg.id === "shop"
      ? `${upg.cost} меди`
      : `${upg.cost} ${currency === "gold" ? "монет" : "руды"}`;
    const lockText =
      upg.id === "td"
        ? "Сначала открой Гильдию шахтеров"
        : "";

    const tile = document.createElement("div");
    tile.className = [
      "upg-tile",
      bought ? "upg-bought" : canAfford ? "upg-available" : "",
    ]
      .join(" ")
      .trim();

    tile.innerHTML = `
      <img class="upg-icon" src="${upg.icon}" draggable="false" alt="${upg.label}">
      <div class="upg-label">${upg.label}</div>
      <div class="upg-desc">${bought ? "✓ Куплено" : lockedByChain ? lockText : upg.desc}</div>
      <div class="upg-cost ${bought ? "hidden" : canAfford ? "upg-cost-ready" : ""}">${lockedByChain ? "🔒 Заблокировано" : costLabel}</div>
      ${
        bought
          ? `<button class="upg-action-btn upg-open-btn">Открыть</button>`
          : canAfford
            ? `<button class="upg-action-btn upg-buy-btn">Купить</button>`
            : `<button class="upg-action-btn upg-buy-btn" disabled>Купить</button>`
      }`;

    if (!bought) {
      tile.style.cursor = canAfford ? "pointer" : "default";
      tile.addEventListener("click", () => {
        if (!canAfford) return;
        if (currency === "gold") {
          if (!spendGold(upg.cost)) return;
        } else {
          // Тратим медную руду из банка (апгрейды всегда стоят медью)
          if (!spendOreFromBank(ORE_COPPER, upg.cost)) return;
        }
        updateStats((s) => {
          if (currency === "gold") s.resources.goldSpent += upg.cost;
          else s.resources.oreSpentOnUpgrades += upg.cost;
          addXp(s, 15);
        });
        buyUpg(upg.id);
        if (upg.id === "shop") {
          openShop();
          screenStart.classList.add("shop-bg");
          narrate("shopUnlock");
        } else if (upg.id === "prospectors") {
          openProspectorsClub();
        } else if (upg.id === "guild") {
          openMinersGuild();
          if (!getMinersGuildName()) openGuildNameModal(true);
        } else if (upg.id === "td") {
          openTd();
        }
        refreshStatusBar();
        refreshShopButtonState();
        refreshEndgameButtons();
        renderUpgrades();
        renderStatsPanel();
      });
    } else if (upg.id === "shop") {
      tile.style.cursor = "pointer";
      tile.addEventListener("click", openShopScreen);
    } else if (upg.id === "prospectors") {
      tile.style.cursor = "pointer";
      tile.addEventListener("click", openProspectorsScreen);
    } else if (upg.id === "guild") {
      tile.style.cursor = "pointer";
      tile.addEventListener("click", openGuildScreen);
    } else if (upg.id === "td") {
      tile.style.cursor = "pointer";
      tile.addEventListener("click", openTdScreen);
    }

    upgradesGrid.appendChild(tile);
  });
}

// ─── СПРАВКА ──────────────────────────────────────────────────────────────────

helpBtn.addEventListener("click", () => {
  helpPanel.style.display = helpPanel.style.display === "none" ? "" : "none";
});
helpCloseBtn.addEventListener("click", () => {
  helpPanel.style.display = "none";
});

// ─── СБРОС ПРОГРЕССА ──────────────────────────────────────────────────────────

resetBtn.addEventListener("click", () => {
  resetModal.style.display = "flex";
});

resetConfirm.addEventListener("click", () => {
  resetModal.style.display = "none";
  closeGuildNameModal();
  resetProgress();
  resetStatsForNewProfile();
  refreshStatusBar();
  renderUpgrades();
  screenStart.classList.remove("shop-bg");
  refreshShopButtonState();
  renderStatsPanel();
  openCharacterModal("🪪 НОВЫЙ ШАХТЕР ПОСЛЕ СБРОСА");
  narrate("sessionStart");
});

resetCancel.addEventListener("click", () => {
  resetModal.style.display = "none";
});

// ─── СТАРТ ВЫЛАЗКИ ────────────────────────────────────────────────────────────

function startGame(diffKey) {
  state = createGameState(diffKey);
  runPickaxeEffects = getEquippedPickaxeEffects();
  runSecondWindUsed = false;
  mobileFlagMode = false;
  applyRunPassives();
  state.playerPos = { r: 14, c: 7 };
  state.statsRecorded = false;
  state.bankSettled = false;
  state.rawOres = null;
  state.rewardMeta = null;
  state.settlementApplied = false;
  idleTriggered = false;
  selectedToolId = null;
  runToolInventory = getProspectorInventory();
  applyStartPickaxeEffects();
  renderGrid(state.grid, gridEl);
  setMinerPosition(state.playerPos.r, state.playerPos.c, true);
  minerSprite.classList.remove("dead");
  screenGame.classList.remove("screen-death-flash");
  renderRunTools();
  setRunToolHint("Выбери инструмент или копай обычным кликом.");
  updateHUD();
  setActive(screenGame);
  tickInterval = setInterval(gameTick, 1000);
  idleCheckInterval = setInterval(checkIdle, 1000);
  updateStats((s) => {
    s.runs.total += 1;
    s.difficulty[diffKey].total += 1;
    s.peaks.maxHpInRun = Math.max(s.peaks.maxHpInRun, state.diff.startHp);
    s.runs.currentRunCollapses = 0;
    s.runs.currentEmptyStreak = 0;
    s.runs.speedWindow = [];
    s.atmosphere.lastRunAt = new Date().toISOString();
  });
  narrate("runStart");
}

function openShopScreen() {
  if (!hasShopUnlocked()) return;
  syncShopUnlockState();
  setActive(screenShop);
  renderShopStats();
  renderShopFlowPanel();
  renderShopUpgrades();
  renderShopReviews();
  renderStaffTab();
  renderCaravansTab();
  narrate("shopOpen");
}

function openProspectorsScreen() {
  if (!hasProspectorsUnlocked()) return;
  renderProspectorsUpgrades();
  setActive(screenProspectors);
}

function openGuildScreen() {
  if (!hasGuildUnlocked()) return;
  renderMinersGuildScreen();
  setActive(screenGuild);
}

function openTdScreen() {
  if (!hasTdUnlocked()) return;
  renderTdScreen();
  setActive(screenTd);
}

function openGachaScreen() {
  if (!hasGachaUnlocked()) return;
  renderGachaScreen();
  setActive(screenGacha);
}

function openInventoryScreen() {
  renderInventoryScreen();
  setActive(screenInventory);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function updateHUD() {
  const maxHp = state.diff.startHp;
  heartImgs.forEach((img, i) => {
    img.style.display = i < maxHp ? "" : "none";
    if (i < maxHp) img.className = "heart " + (i < state.hp ? "full" : "empty");
  });
  hudOreEl.textContent = state.ore;
  hudBankEl.textContent = getBank();
  hudTimerEl.textContent = formatTime(state.elapsedSeconds);
  hudDiffEl.textContent = state.diff.label.toUpperCase();
  hudDiffEl.className = "hud-diff-val diff-" + state.diffKey;
  if (collectOreBtn) {
    const availableOre = countRevealedOre();
    collectOreBtn.textContent = `📥 СБОР РУДЫ (${availableOre})`;
    collectOreBtn.disabled = state.ended || availableOre <= 0;
  }
  if (mobileFlagToggleBtn) {
    mobileFlagToggleBtn.textContent = `🚩 ФЛАГ: ${mobileFlagMode ? "ON" : "OFF"}`;
  }
  updatePlayerIdentityUI();
}

// Показываем предупреждение в HUD (idle countdown)
function showHudWarning(text) {
  eventWarnEl.textContent = text;
  eventWarnEl.classList.add("visible");
}

function hideHudWarning() {
  eventWarnEl.classList.remove("visible");
  eventWarnEl.textContent = "";
}

// ─── ЦЕНТРАЛЬНЫЙ ПОПАП ОБВАЛА ──────────────────────────────────────────────────

let collapsePopupTimer = null;

function showCollapsePopup(count) {
  collapsePopupSub.textContent = `Обрушилось ${count} блоков породы`;
  collapsePopup.style.display = "flex";
  collapsePopup.classList.remove("popup-hide");
  collapsePopup.classList.add("popup-show");

  clearTimeout(collapsePopupTimer);
  collapsePopupTimer = setTimeout(() => {
    collapsePopup.classList.remove("popup-show");
    collapsePopup.classList.add("popup-hide");
    collapsePopupTimer = setTimeout(() => {
      collapsePopup.style.display = "none";
      collapsePopup.classList.remove("popup-hide");
    }, 400);
  }, 2800);
}

function setMinerPosition(r, c, instant = false) {
  if (!minerSprite) return;
  const cell = getGridCellSize();
  const x = c * cell + cell / 2;
  const y = r * cell + cell / 2;
  if (instant) minerSprite.classList.add("instant");
  else minerSprite.classList.remove("instant");
  minerSprite.style.left = `${x}px`;
  minerSprite.style.top = `${y}px`;
  if (state) state.playerPos = { r, c };
}

function animateCell(r, c, cls) {
  const idx = r * 15 + c;
  const el = gridEl.children[idx];
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener("animationend", () => el.classList.remove(cls), {
    once: true,
  });
}

function animateMiner(mode) {
  if (!minerSprite) return;
  minerSprite.classList.remove("mining", "pickup");
  void minerSprite.offsetWidth;
  if (mode) {
    minerSprite.classList.add(mode);
    setTimeout(() => minerSprite.classList.remove(mode), 260);
  }
}

function uniqueCells(cells) {
  const seen = new Set();
  const out = [];
  for (const p of cells) {
    const key = `${p.r},${p.c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function applyToolGridChanges(
  changed,
  oreGain = 0,
  hpGain = 0,
  oreType = ORE_COPPER,
) {
  if (!state) return;
  const uniq = uniqueCells(changed);
  if (uniq.length) updateCells(state.grid, gridEl, uniq);
  if (oreGain > 0) {
    const gained = grantRunOre(oreType, oreGain);
    updateStats((s) => {
      s.cells.oreFoundCells += gained;
      s.resources.totalOreMined += gained;
      addXp(s, withRunXp(Math.max(1, Math.round(gained * 0.8))));
    });
  }
  if (hpGain > 0) state.hp = Math.min(state.diff.startHp, state.hp + hpGain);
  state.lastActionTime = Date.now();
  updateHUD();
}

function useInstantTool(toolId) {
  if (!state || state.ended) return false;
  if ((runToolInventory[toolId] ?? 0) <= 0) return false;

  if (toolId === "medkit") {
    if (state.hp >= state.diff.startHp) {
      setRunToolHint("🩹 HP уже полный.");
      return false;
    }
    if (!consumeRunTool(toolId)) return false;
    applyToolGridChanges([], 0, 1);
    setRunToolHint("🩹 Аптечка применена: +1 HP.");
    updateStats((s) => addXp(s, withRunXp(1)));
    return true;
  }

  if (toolId === "magnet") {
    const changed = [];
    const oreByType = {
      [ORE_COPPER]: 0,
      [ORE_SILVER]: 0,
      [ORE_GOLD]: 0,
      [ORE_DIAMOND]: 0,
    };
    for (let r = 0; r < state.grid.length; r++) {
      for (let c = 0; c < state.grid[r].length; c++) {
        const cell = state.grid[r][c];
        if (cell.type === TYPE_ORE && cell.state === CELL_REVEALED) {
          const oreType = cell.oreType ?? ORE_COPPER;
          cell.type = TYPE_EMPTY;
          cell.state = CELL_OPEN;
          oreByType[oreType] += 1;
          changed.push({ r, c });
          for (const [nr, nc] of getNeighbors(r, c)) {
            if (state.grid[nr][nc].state === CELL_OPEN)
              changed.push({ r: nr, c: nc });
          }
        }
      }
    }
    const oreGain = Object.values(oreByType).reduce((s, v) => s + v, 0);
    if (oreGain <= 0) {
      setRunToolHint("🧲 Нет подсвеченной руды для сбора.");
      return false;
    }
    if (!consumeRunTool(toolId)) return false;
    computeNeighborCounts(state.grid);
    changed.push(...revealAdjacentOre(state.grid));
    let totalGranted = 0;
    Object.entries(oreByType).forEach(([oreType, amount]) => {
      if (amount > 0) totalGranted += grantRunOre(oreType, amount);
    });
    applyToolGridChanges(changed, 0, 0);
    updateStats((s) => {
      s.cells.oreFoundCells += totalGranted;
      s.resources.totalOreMined += totalGranted;
      addXp(s, withRunXp(Math.max(1, Math.round(totalGranted * 0.8))));
    });
    setRunToolHint(`🧲 Магнит собрал ${totalGranted} руды.`);
    animateMiner("pickup");
    return true;
  }

  return false;
}

function useTargetedTool(toolId, r, c) {
  if (!state || state.ended) return false;
  if ((runToolInventory[toolId] ?? 0) <= 0) return false;
  const changed = [];

  if (toolId === "dynamite") {
    for (let rr = r - 1; rr <= r + 1; rr++) {
      for (let cc = c - 1; cc <= c + 1; cc++) {
        if (
          rr < 0 ||
          rr >= state.grid.length ||
          cc < 0 ||
          cc >= state.grid[rr].length
        )
          continue;
        const cell = state.grid[rr][cc];
        if (cell.state === CELL_OPEN) continue;
        if (cell.type === TYPE_UNSTABLE) {
          if (cell.state !== CELL_FLAGGED) {
            cell.state = CELL_FLAGGED;
            changed.push({ r: rr, c: cc });
          }
        } else if (cell.type === TYPE_ORE) {
          if (cell.state !== CELL_REVEALED) {
            cell.state = CELL_REVEALED;
            changed.push({ r: rr, c: cc });
          }
        } else {
          cell.state = CELL_OPEN;
          changed.push({ r: rr, c: cc });
        }
      }
    }
    if (!changed.length) {
      setRunToolHint("💣 Здесь динамит ничего не изменил.");
      return false;
    }
    if (!consumeRunTool(toolId)) return false;
    changed.push(...revealAdjacentOre(state.grid));
    applyToolGridChanges(changed);
    setRunToolHint("💣 Заряд сработал. Зона расчищена.");
    animateMiner("mining");
    updateStats((s) => addXp(s, withRunXp(2)));
    return true;
  }

  if (toolId === "flare") {
    let oreShown = 0;
    for (let rr = r - 2; rr <= r + 2; rr++) {
      for (let cc = c - 2; cc <= c + 2; cc++) {
        if (
          rr < 0 ||
          rr >= state.grid.length ||
          cc < 0 ||
          cc >= state.grid[rr].length
        )
          continue;
        const cell = state.grid[rr][cc];
        if (cell.type === TYPE_ORE && cell.state === CELL_HIDDEN) {
          cell.state = CELL_REVEALED;
          changed.push({ r: rr, c: cc });
          oreShown += 1;
        }
      }
    }
    if (!consumeRunTool(toolId)) return false;
    applyToolGridChanges(changed);
    setRunToolHint(
      oreShown > 0
        ? `🔦 Подсвечено руды: ${oreShown}.`
        : "🔦 Пустая область, руды не видно.",
    );
    updateStats((s) => addXp(s, withRunXp(1)));
    return true;
  }

  if (toolId === "stabilizer") {
    const cell = state.grid[r][c];
    if (cell.type !== TYPE_UNSTABLE || cell.state === CELL_OPEN) {
      setRunToolHint(
        "🧯 Стабилизатор работает только по скрытой нестабильной клетке.",
      );
      return false;
    }
    if (!consumeRunTool(toolId)) return false;
    cell.type = TYPE_EMPTY;
    cell.state = CELL_OPEN;
    changed.push({ r, c });
    computeNeighborCounts(state.grid);
    changed.push(...revealAdjacentOre(state.grid));
    for (const [nr, nc] of getNeighbors(r, c)) {
      if (
        state.grid[nr][nc].state === CELL_OPEN ||
        state.grid[nr][nc].state === CELL_REVEALED
      ) {
        changed.push({ r: nr, c: nc });
      }
    }
    applyToolGridChanges(changed);
    setRunToolHint("🧯 Клетка стабилизирована.");
    updateStats((s) => addXp(s, withRunXp(2)));
    return true;
  }

  return false;
}

// ─── БЕЗДЕЙСТВИЕ ──────────────────────────────────────────────────────────────

function checkIdle() {
  if (!state || state.ended) return;
  if (escapeModalOpen) return;
  const idleSec = (Date.now() - state.lastActionTime) / 1000;
  const threshold =
    state.diff.idleCollapseSec + (runPickaxeEffects.idleCollapseDelaySec ?? 0);
  const secsLeft = Math.ceil(threshold - idleSec);

  if (idleSec >= threshold && !idleTriggered) {
    idleTriggered = true;
    hideHudWarning();
    const prevRevealedOre = countRevealedOre();

    const collapsed = triggerIdleCollapse(state);
    if (collapsed.length > 0) {
      updateCells(state.grid, gridEl, collapsed);
      flashCollapse(state.grid, gridEl, collapsed);
      const newHidden = collapsed.filter(
        ({ r, c }) => state.grid[r][c].state === "hidden",
      );
      showCollapsePopup(newHidden.length);
      narrate("idleCollapse");
      const nowRevealedOre = countRevealedOre();
      updateStats((s) => {
        s.collapses.total += 1;
        s.collapses.byIdle += 1;
        s.collapses.cellsDestroyed += newHidden.length;
        s.collapses.maxSingle = Math.max(
          s.collapses.maxSingle,
          newHidden.length,
        );
        s.collapses.lastAt = new Date().toISOString();
        s.collapses.oreLost += Math.max(0, prevRevealedOre - nowRevealedOre);
        s.runs.currentRunCollapses += 1;
        s.atmosphere.cursesCount += 1;
        addXp(s, -10);
      });
    }

    updateHUD();
    setTimeout(() => {
      idleTriggered = false;
    }, 1000);
  } else if (!idleTriggered && secsLeft <= 15 && secsLeft > 0) {
    showHudWarning(`💤 ОБВАЛ ЧЕРЕЗ ${secsLeft}с`);
  } else if (!idleTriggered && secsLeft > 15) {
    hideHudWarning();
  }
}

// ─── ТИКИ ─────────────────────────────────────────────────────────────────────

function gameTick() {
  if (!state || state.ended) return;
  state.elapsedSeconds += 1;
  updateHUD();
}

// ─── ВВОД ─────────────────────────────────────────────────────────────────────

gridEl.addEventListener("click", (e) => {
  if (!state || state.ended) return;
  const el = e.target.closest("[data-r]");
  if (!el) return;
  const clickR = parseInt(el.dataset.r, 10);
  const clickC = parseInt(el.dataset.c, 10);
  if (mobileFlagMode) {
    const targetCell = state.grid[clickR][clickC];
    const wasFlagged = targetCell.state === CELL_FLAGGED;
    const toggled = toggleFlag(state, clickR, clickC);
    if (toggled) {
      updateCells(state.grid, gridEl, [toggled]);
      updateStats((s) => {
        if (wasFlagged) s.cells.flagsRemoved += 1;
        else {
          s.cells.flagsPlaced += 1;
          if (targetCell.type === TYPE_UNSTABLE) addXp(s, withRunXp(2));
        }
      });
      narrate(wasFlagged ? "flagUnset" : "flagSet");
      setMinerPosition(clickR, clickC);
    }
    return;
  }
  if (selectedToolId) {
    const tool = getToolById(selectedToolId);
    if (tool?.targeted) {
      const used = useTargetedTool(selectedToolId, clickR, clickC);
      if (used) {
        if ((runToolInventory[selectedToolId] ?? 0) <= 0) selectedToolId = null;
      }
      renderRunTools();
      return;
    }
  }
  const prevRevealedOre = countRevealedOre();
  const prevStates = state.grid.map((row) => row.map((cell) => cell.state));

  const prevOre = state.ore;
  const result = openCell(state, clickR, clickC);
  if (!result) return;
  setMinerPosition(clickR, clickC);

  let gained = state.ore - prevOre;
  if (gained > 0) {
    const oreType = result.collectedOreType ?? ORE_COPPER;
    const extra = grantRunOre(oreType, gained) - gained;
    if (extra > 0) gained += extra;
  }
  const newlyOpened = countNewlyOpenedCells(prevStates);
  const emptyOpened = countNewlyOpenedEmptyCells(prevStates);
  const newlyRevealedOre = countNewlyRevealedOre(prevStates);

  updateCells(state.grid, gridEl, result.changed);

  updateStats((s) => {
    s.cells.openedTotal += newlyOpened;
    s.cells.emptyFound += emptyOpened;
    if (gained > 0) {
      s.cells.oreFoundCells += gained;
      s.resources.totalOreMined += gained;
      s.runs.currentEmptyStreak = 0;
    } else if (!result.hitCollapse) {
      s.runs.currentEmptyStreak += 1;
      s.runs.maxEmptyStreak = Math.max(
        s.runs.maxEmptyStreak,
        s.runs.currentEmptyStreak,
      );
    }
    const nowTs = Date.now();
    for (let i = 0; i < newlyOpened; i++) s.runs.speedWindow.push(nowTs);
    s.runs.speedWindow = s.runs.speedWindow.filter((t) => nowTs - t <= 10000);
    if (s.runs.speedWindow.length >= 50) s.achievements.speed50cells10s = true;
    s.peaks.maxBankOre = Math.max(s.peaks.maxBankOre, getBank());

    if (newlyOpened > 0) addXp(s, withRunXp(newlyOpened));
    if (newlyRevealedOre > 0) addXp(s, withRunXp(newlyRevealedOre * 2));
    if (gained > 0) addXp(s, withRunXp(gained));
  });

  if (result.hitCollapse && result.hitCollapse.length > 0) {
    // result.hitCollapse содержит как обрушенные, так и соседей для обновления чисел
    updateCells(state.grid, gridEl, result.hitCollapse);
    flashCollapse(state.grid, gridEl, result.hitCollapse);
    // Показываем только число реально обрушенных (те что стали hidden)
    const newHidden = result.hitCollapse.filter(
      ({ r, c }) => state.grid[r][c].state === "hidden",
    );
    showHudWarning(`💥 ОБВАЛ! −${newHidden.length} кл.`);
    clearTimeout(showHudWarning._t);
    showHudWarning._t = setTimeout(hideHudWarning, 2500);
    narrate("unstableHit");
    animateMiner("mining");
    animateCell(clickR, clickC, "dig-anim");
    const nowRevealedOre = countRevealedOre();
    updateStats((s) => {
      s.cells.unstableActivated += 1;
      s.collapses.total += 1;
      s.collapses.byHit += 1;
      s.collapses.cellsDestroyed += newHidden.length;
      s.collapses.maxSingle = Math.max(s.collapses.maxSingle, newHidden.length);
      s.collapses.lastAt = new Date().toISOString();
      s.collapses.oreLost += Math.max(0, prevRevealedOre - nowRevealedOre);
      s.runs.currentRunCollapses += 1;
      s.atmosphere.cursesCount += 1;
      if (state.hp > 0) addXp(s, withRunXp(1));
    });
  } else if (gained > 0) {
    animateMiner("pickup");
    animateCell(clickR, clickC, "pickup-anim");
    narrate("ore");
  } else {
    animateMiner("mining");
    animateCell(clickR, clickC, "dig-anim");
    narrate("empty");
  }

  updateHUD();
  if (state.hp <= 0) {
    if (!runSecondWindUsed && runPickaxeEffects.secondWindChance) {
      if (Math.random() < runPickaxeEffects.secondWindChance) {
        runSecondWindUsed = true;
        state.hp = 1;
        showHudWarning("🛡 Кирка спасла от смертельного удара!");
        clearTimeout(showHudWarning._t);
        showHudWarning._t = setTimeout(hideHudWarning, 2200);
        updateHUD();
        return;
      }
    }
    minerSprite.classList.add("dead");
    screenGame.classList.add("screen-death-flash");
    narrate("death");
    endGame("death");
    return;
  }
  if (checkVictory(state)) {
    narrate("clear");
    endGame("clear");
    return;
  }
});

gridEl.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (!state || state.ended) return;
  const el = e.target.closest("[data-r]");
  if (!el) return;
  const rr = parseInt(el.dataset.r, 10);
  const cc = parseInt(el.dataset.c, 10);
  const targetCell = state.grid[rr][cc];
  const wasFlagged = state.grid[rr][cc].state === "flagged";
  const r = toggleFlag(state, rr, cc);
  if (r) {
    updateCells(state.grid, gridEl, [r]);
    updateStats((s) => {
      if (wasFlagged) s.cells.flagsRemoved += 1;
      else {
        s.cells.flagsPlaced += 1;
        if (targetCell.type === "unstable") addXp(s, withRunXp(2));
      }
    });
    narrate(wasFlagged ? "flagUnset" : "flagSet");
  }
});

collectOreBtn?.addEventListener("click", () => {
  collectAllAvailableOre();
});

mobileFlagToggleBtn?.addEventListener("click", () => {
  mobileFlagMode = !mobileFlagMode;
  updateHUD();
});

// ─── ВЫХОД ────────────────────────────────────────────────────────────────────

escapeBtn.addEventListener("click", () => {
  if (!state || state.ended) return;
  // Скрываем попап обвала если он был виден
  collapsePopup.classList.remove("popup-show");
  collapsePopup.classList.add("popup-hide");
  clearTimeout(collapsePopupTimer);
  collapsePopupTimer = setTimeout(() => {
    collapsePopup.style.display = "none";
    collapsePopup.classList.remove("popup-hide");
  }, 300);

  const totalOre = state.ore;
  const { quality, coverage } = calcRunQuality(state);
  const streak = getEscapeStreak();
  const baseKeep = ESCAPE_KEEP_BASE[state.diffKey] ?? 0.2;
  const keepBeforeQuality = Math.max(
    ESCAPE_KEEP_MIN,
    baseKeep -
      streak * ESCAPE_STREAK_KEEP_PENALTY +
      (runPickaxeEffects.escapeKeepBonus ?? 0),
  );
  const earlyEscape = coverage < EARLY_ESCAPE_MIN_COVERAGE;
  const effectiveKeep = earlyEscape ? 0 : keepBeforeQuality * quality;
  const willKeepTotal = Math.floor(totalOre * effectiveKeep);
  const willLoseTotal = totalOre - willKeepTotal;
  escapeMsgEl.innerHTML = `
    <p>Уйти с вылазки досрочно?</p>
    <p class="modal-warn">Потеряешь <strong>${willLoseTotal} ед.</strong> руды.</p>
    <p class="modal-keep">Сохранишь: <strong>${willKeepTotal} ед.</strong></p>`;
  if (earlyEscape) {
    escapeMsgEl.innerHTML += `<p class="modal-warn">Слишком ранний выход: прогресс рейса <strong>${Math.round(coverage * 100)}%</strong> (нужно минимум ${Math.round(EARLY_ESCAPE_MIN_COVERAGE * 100)}%).</p>`;
  } else {
    escapeMsgEl.innerHTML += `<p>Качество рейса: <strong>${Math.round(quality * 100)}%</strong> · Серия побегов: <strong>${streak}</strong></p>`;
  }
  escapeModal.style.display = "flex";
  escapeModalOpen = true;
});

escapeConfirm.addEventListener("click", () => {
  escapeModal.style.display = "none";
  escapeModalOpen = false;
  if (!state || state.ended) return;
  narrate("escape");
  endGame("escape");
});

escapeCancel.addEventListener("click", () => {
  escapeModal.style.display = "none";
  escapeModalOpen = false;
  if (state) state.lastActionTime = Date.now();
});

// ─── КОНЕЦ ИГРЫ ───────────────────────────────────────────────────────────────

function endGame(reason) {
  state.ended = true;
  state.endReason = reason;
  applyRunSettlement();
  stopTimers();
  showResult();
}

function stopTimers() {
  clearInterval(tickInterval);
  clearInterval(idleCheckInterval);
  tickInterval = null;
  idleCheckInterval = null;
}

function showResult() {
  const { endReason: reason, elapsedSeconds: elapsed, diff } = state;
  if (!state.bankSettled) {
    // Кладём каждый тип руды в соответствующий банк
    Object.entries(state.ores).forEach(([oreType, amount]) => {
      if (amount > 0) addOreToBank(oreType, amount);
    });
    state.bankSettled = true;
  }
  const ore = state.ore; // total after settlement
  const rawOre = state.rawOres
    ? Object.values(state.rawOres).reduce((s, v) => s + v, 0)
    : ore;
  const hp = Math.max(0, state.hp);
  const bank = getBank(); // total across all types
  const diffKey = state.diffKey;

  if (!state.statsRecorded) {
    updateStats((s) => {
      addXp(s, withRunXp(4));
      s.runs.longestSeconds = Math.max(s.runs.longestSeconds, elapsed);
      s.runs.shortestSeconds =
        s.runs.shortestSeconds === 0
          ? elapsed
          : Math.min(s.runs.shortestSeconds, elapsed);

      if (reason === "clear") {
        addXp(s, withRunXp(20));
        s.runs.clear += 1;
        s.difficulty[diffKey].clear += 1;
        s.atmosphere.successStreak += 1;
        s.atmosphere.deathStreak = 0;
        if (s.difficulty[diffKey].minClearSeconds === 0)
          s.difficulty[diffKey].minClearSeconds = elapsed;
        else
          s.difficulty[diffKey].minClearSeconds = Math.min(
            s.difficulty[diffKey].minClearSeconds,
            elapsed,
          );
      } else if (reason === "death") {
        s.runs.death += 1;
        s.difficulty[diffKey].death += 1;
        s.atmosphere.deathStreak += 1;
        s.atmosphere.successStreak = 0;
        s.atmosphere.lastDeathAt = new Date().toISOString();
      } else if (reason === "escape") {
        addXp(s, withRunXp(2));
        s.runs.escape += 1;
        s.difficulty[diffKey].escape += 1;
        s.atmosphere.successStreak += 1;
        s.atmosphere.deathStreak = 0;
      }

      if (reason !== "death") addXp(s, withRunXp(8 + hp));

      s.difficulty[diffKey].bestOre = Math.max(
        s.difficulty[diffKey].bestOre,
        ore,
      );
      s.peaks.maxBankOre = Math.max(s.peaks.maxBankOre, bank);
      if ((reason === "clear" || reason === "escape") && hp === 1)
        s.achievements.lucky1HpSurvivor = true;
      if (s.runs.currentRunCollapses >= 5)
        s.achievements.problems5CollapsesRun = true;
    });
    state.statsRecorded = true;
  }

  const titles = {
    death: "💀 ШАХТЁР ПОГИБ",
    escape: "🚪 ВЫЛАЗКА ПРЕРВАНА",
    clear: "✅ ПОЛЕ ЗАЧИЩЕНО",
  };
  resultHeader.textContent = titles[reason] ?? "📋 ИТОГИ ВЫЛАЗКИ";

  // Строим строки по типам руды (только те, которых добыто > 0)
  const ORE_ORDER = [ORE_COPPER, ORE_SILVER, ORE_GOLD, ORE_DIAMOND];
  const oreRows = ORE_ORDER.filter((t) => (state.ores[t] ?? 0) > 0).map(
    (t) => ({
      label: `↳ ${ORE_CONFIG[t].label}`,
      val: `${state.ores[t]} ед.`,
      cls: `ore-result-${t}`,
    }),
  );

  const rows = [
    { label: "Собрано в вылазке", val: `${rawOre} ед.`, cls: "gold" },
    { label: "Доставлено в банк", val: `${ore} ед.`, cls: "gold-dim" },
    ...oreRows,
    { label: "Банк (всего)", val: `${bank} ед.`, cls: "gold-dim" },
    {
      label: "HP осталось",
      val: hpStr(hp, diff.startHp),
      cls: reason === "death" ? "red" : "green",
    },
    { label: "Прошло времени", val: formatTime(elapsed), cls: "blue" },
  ];

  resultRows.innerHTML = rows
    .map(
      ({ label, val, cls }) => `
    <div class="result-row">
      <span class="result-row-label">${label}</span>
      <span class="result-row-val ${cls}">${val}</span>
    </div>`,
    )
    .join("");

  if (state.rewardMeta) {
    const metaRows = [];
    if (reason === "escape") {
      metaRows.push({
        label: "Качество рейса",
        val: `${Math.round((state.rewardMeta.quality ?? 0) * 100)}%`,
        cls: "blue",
      });
      metaRows.push({
        label: "Коэфф. сохранения",
        val: `${Math.round((state.rewardMeta.effectiveKeepRate ?? 0) * 100)}%`,
        cls: "blue",
      });
      metaRows.push({
        label: "Серия побегов",
        val: `${state.rewardMeta.escapeStreakBefore ?? 0}`,
        cls: "blue",
      });
    } else if (reason === "clear") {
      metaRows.push({
        label: "Бонус зачистки",
        val: `+${Math.round((state.rewardMeta.clearBonus ?? 0) * 100)}%`,
        cls: "green",
      });
    }
    if (metaRows.length > 0) {
      resultRows.innerHTML += metaRows
        .map(
          ({ label, val, cls }) => `
    <div class="result-row">
      <span class="result-row-label">${label}</span>
      <span class="result-row-val ${cls}">${val}</span>
    </div>`,
        )
        .join("");
    }
  }

  const flavours = {
    death: "Шахтёр не вернулся из глубин...",
    escape: "Побег спас жизнь, но плохо окупается без прогресса в рейсе.",
    clear: "Поле зачищено! Выдан бонус за полный контроль шахты.",
  };
  resultReason.textContent = flavours[reason] ?? "";

  selectedToolId = null;
  renderRunTools();
  setActive(screenResult);
}

function cloneOreMap(src) {
  return {
    [ORE_COPPER]: src[ORE_COPPER] ?? 0,
    [ORE_SILVER]: src[ORE_SILVER] ?? 0,
    [ORE_GOLD]: src[ORE_GOLD] ?? 0,
    [ORE_DIAMOND]: src[ORE_DIAMOND] ?? 0,
  };
}

function countSafeCells(stateRef) {
  let safeTotal = 0;
  let safeOpened = 0;
  let flagsTotal = 0;
  let flagsCorrect = 0;
  for (let r = 0; r < stateRef.grid.length; r += 1) {
    for (let c = 0; c < stateRef.grid[r].length; c += 1) {
      const cell = stateRef.grid[r][c];
      if (cell.type !== TYPE_UNSTABLE) {
        safeTotal += 1;
        if (cell.state === CELL_OPEN) safeOpened += 1;
      }
      if (cell.state === CELL_FLAGGED) {
        flagsTotal += 1;
        if (cell.type === TYPE_UNSTABLE) flagsCorrect += 1;
      }
    }
  }
  return { safeTotal, safeOpened, flagsTotal, flagsCorrect };
}

function calcRunQuality(stateRef) {
  const { safeTotal, safeOpened, flagsTotal, flagsCorrect } =
    countSafeCells(stateRef);
  const coverage = safeTotal > 0 ? safeOpened / safeTotal : 0;
  const hpRatio = Math.max(
    0,
    Math.min(1, stateRef.hp / Math.max(1, stateRef.diff.startHp)),
  );
  const flagPrecision = flagsTotal > 0 ? flagsCorrect / flagsTotal : 0.5;
  const qualityRaw =
    0.2 + coverage * 0.55 + hpRatio * 0.2 + flagPrecision * 0.05;
  const quality = Math.max(0.2, Math.min(1, qualityRaw));
  return { quality, coverage, hpRatio, flagPrecision, safeTotal, safeOpened };
}

function applyRunSettlement() {
  if (!state || state.settlementApplied) return;

  const raw = cloneOreMap(state.ores);
  const reason = state.endReason;
  const { quality, coverage } = calcRunQuality(state);
  const escapeStreakBefore = getEscapeStreak();
  const pickaxeFx = runPickaxeEffects ?? {};

  let finalOres = cloneOreMap(raw);
  const meta = {
    quality,
    coverage,
    escapeStreakBefore,
  };

  if (reason === "clear") {
    const bonus =
      (CLEAR_BONUS_MULT[state.diffKey] ?? 0.2) +
      (pickaxeFx.clearBonusBonus ?? 0);
    Object.keys(finalOres).forEach((t) => {
      finalOres[t] = Math.round(finalOres[t] * (1 + bonus));
    });
    meta.clearBonus = bonus;
    setEscapeStreak(0);
  } else if (reason === "escape") {
    const baseKeep = ESCAPE_KEEP_BASE[state.diffKey] ?? 0.2;
    const streakPenalty = escapeStreakBefore * ESCAPE_STREAK_KEEP_PENALTY;
    const keepBeforeQuality = Math.max(
      ESCAPE_KEEP_MIN,
      baseKeep - streakPenalty + (pickaxeFx.escapeKeepBonus ?? 0),
    );
    const earlyEscape = coverage < EARLY_ESCAPE_MIN_COVERAGE;
    const effectiveKeepRate = earlyEscape
      ? 0
      : Math.max(0, keepBeforeQuality * quality);

    Object.keys(finalOres).forEach((t) => {
      finalOres[t] = Math.floor(finalOres[t] * effectiveKeepRate);
    });

    meta.baseKeep = baseKeep;
    meta.keepBeforeQuality = keepBeforeQuality;
    meta.effectiveKeepRate = effectiveKeepRate;
    meta.earlyEscape = earlyEscape;
    setEscapeStreak(escapeStreakBefore + 1);
  } else if (reason === "death") {
    // При смерти шахтер теряет всю руду из текущей вылазки.
    Object.keys(finalOres).forEach((t) => {
      finalOres[t] = 0;
    });
    meta.deathPenalty = true;
    setEscapeStreak(0);
  } else {
    setEscapeStreak(0);
  }

  state.rawOres = raw;
  state.ores = finalOres;
  state.rewardMeta = meta;
  state.settlementApplied = true;
}

newRunBtn.addEventListener("click", showStartScreen);
openShopBtn.addEventListener("click", () => {
  if (!hasShopUnlocked()) return;
  openShopScreen();
});
openTdBtn?.addEventListener("click", () => {
  if (!hasTdUnlocked()) return;
  openTdScreen();
});
openGachaBtn?.addEventListener("click", () => {
  if (!hasGachaUnlocked()) return;
  openGachaScreen();
});
openInventoryBtn?.addEventListener("click", () => {
  openInventoryScreen();
});

// ─── УТИЛИТЫ ──────────────────────────────────────────────────────────────────

function hpStr(hp, max) {
  return "♥".repeat(hp) + "♡".repeat(max - hp);
}
function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function setActive(s) {
  if (s !== screenTd) pauseTdScreen();
  if (s === screenTd) resumeTdScreen();
  [
    screenStart,
    screenShop,
    screenProspectors,
    screenGuild,
    screenTd,
    screenGacha,
    screenInventory,
    screenGame,
    screenResult,
  ].forEach((x) => x.classList.remove("active"));
  s.classList.add("active");
}

function getNewsContext() {
  return {
    ore: getBank(),
    gold: getGold(),
    adsLevel: getAdsLevel(),
    shopOpen: isShopOpen(),
    guildOpen: isMinersGuildOpen(),
  };
}

function countRevealedOre() {
  let n = 0;
  if (!state) return 0;
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < state.grid[r].length; c++) {
      const cell = state.grid[r][c];
      if (cell.type === "ore" && cell.state === "revealed") n += 1;
    }
  }
  return n;
}

function collectAllAvailableOre() {
  if (!state || state.ended) return;
  if (countRevealedOre() <= 0) return;

  const prevStates = state.grid.map((row) => row.map((cell) => cell.state));
  const prevOre = state.ore;
  const changed = [];

  // Собираем руду волнами: после сбора могут открыться новые доступные жилы.
  while (true) {
    const batch = [];
    for (let r = 0; r < state.grid.length; r++) {
      for (let c = 0; c < state.grid[r].length; c++) {
        const cell = state.grid[r][c];
        if (cell.type === TYPE_ORE && cell.state === CELL_REVEALED) {
          batch.push({ r, c });
        }
      }
    }
    if (!batch.length) break;

    for (const { r, c } of batch) {
      const cell = state.grid[r][c];
      const oreType = cell.oreType ?? ORE_COPPER;
      cell.type = TYPE_EMPTY;
      cell.oreType = null;
      cell.state = CELL_OPEN;
      grantRunOre(oreType, 1);
      changed.push({ r, c });

      for (const [nr, nc] of getNeighbors(r, c)) {
        const nb = state.grid[nr][nc];
        if (nb.state === CELL_OPEN || nb.state === CELL_REVEALED) {
          changed.push({ r: nr, c: nc });
        }
      }
    }

    computeNeighborCounts(state.grid);
    changed.push(...revealAdjacentOre(state.grid));
  }

  const gained = state.ore - prevOre;
  if (gained <= 0) return;

  updateCells(state.grid, gridEl, uniqueCells(changed));

  const newlyOpened = countNewlyOpenedCells(prevStates);
  const emptyOpened = countNewlyOpenedEmptyCells(prevStates);
  const newlyRevealedOre = countNewlyRevealedOre(prevStates);

  updateStats((s) => {
    s.cells.openedTotal += newlyOpened;
    s.cells.emptyFound += emptyOpened;
    s.cells.oreFoundCells += gained;
    s.resources.totalOreMined += gained;
    s.runs.currentEmptyStreak = 0;
    s.peaks.maxBankOre = Math.max(s.peaks.maxBankOre, getBank());
    if (newlyOpened > 0) addXp(s, withRunXp(newlyOpened));
    if (newlyRevealedOre > 0) addXp(s, withRunXp(newlyRevealedOre * 2));
    addXp(s, withRunXp(gained));
  });

  state.lastActionTime = Date.now();
  animateMiner("pickup");
  narrate("ore");
  updateHUD();

  if (checkVictory(state)) {
    narrate("clear");
    endGame("clear");
  }
}

function countNewlyOpenedCells(prevStates) {
  let n = 0;
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < state.grid[r].length; c++) {
      if (prevStates[r][c] !== "open" && state.grid[r][c].state === "open")
        n += 1;
    }
  }
  return n;
}

function countNewlyOpenedEmptyCells(prevStates) {
  let n = 0;
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < state.grid[r].length; c++) {
      const cell = state.grid[r][c];
      if (
        prevStates[r][c] !== "open" &&
        cell.state === "open" &&
        cell.type === "empty"
      )
        n += 1;
    }
  }
  return n;
}

function countNewlyRevealedOre(prevStates) {
  let n = 0;
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < state.grid[r].length; c++) {
      const cell = state.grid[r][c];
      if (
        prevStates[r][c] !== "revealed" &&
        cell.state === "revealed" &&
        cell.type === "ore"
      )
        n += 1;
    }
  }
  return n;
}

function pct(part, total) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function fmtDur(sec) {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderStatsPanel() {
  if (!statsContent) return;
  updatePlayerIdentityUI();
  const s = getStats();
  const visitorMinutePeak = s.shop.visitorsPeakPerMinute || 0;
  const visitorHourPeak = s.shop.visitorsPeakPerHour || 0;
  const secondsSinceSale = s.shop.lastPurchaseAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(s.shop.lastPurchaseAt).getTime()) / 1000,
        ),
      )
    : 0;
  const sinceDeath = s.atmosphere.lastDeathAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(s.atmosphere.lastDeathAt).getTime()) / 1000,
        ),
      )
    : 0;
  const caravan = getCaravansState();
  const caravanSuccessRate = caravan.stats.runsTotal
    ? Math.round((caravan.stats.successTotal / caravan.stats.runsTotal) * 100)
    : 0;

  statsContent.innerHTML = `
    <div class="stats-group"><div class="stats-group-title">РЕСУРСЫ</div>
      <div>Добыто руды: <strong>${s.resources.totalOreMined}</strong></div>
      <div>Продано руды: <strong>${s.resources.totalOreSold}</strong></div>
      <div>Заработано монет: <strong>${s.resources.totalGoldEarned}</strong></div>
      <div>Потрачено монет: <strong>${s.resources.goldSpent}</strong></div>
      <div>Потрачено руды на апгрейды: <strong>${s.resources.oreSpentOnUpgrades}</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">ВЫЛАЗКИ</div>
      <div>Всего вылазок: <strong>${s.runs.total}</strong></div>
      <div>Успешных: <strong>${s.runs.clear}</strong></div>
      <div>Смертей: <strong>${s.runs.death}</strong></div>
      <div>Побегов: <strong>${s.runs.escape}</strong></div>
      <div>Самая длинная: <strong>${fmtDur(s.runs.longestSeconds)}</strong></div>
      <div>Самая короткая: <strong>${fmtDur(s.runs.shortestSeconds)}</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">КЛЕТКИ</div>
      <div>Открыто клеток: <strong>${s.cells.openedTotal}</strong></div>
      <div>Пустых найдено: <strong>${s.cells.emptyFound}</strong></div>
      <div>Рудных найдено: <strong>${s.cells.oreFoundCells}</strong></div>
      <div>Нестабильных активировано: <strong>${s.cells.unstableActivated}</strong></div>
      <div>Флагов поставлено/снято: <strong>${s.cells.flagsPlaced}/${s.cells.flagsRemoved}</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">СЛОЖНОСТИ</div>
      <div>Easy: best ${s.difficulty.easy.bestOre}, win ${pct(s.difficulty.easy.clear, s.difficulty.easy.total)}</div>
      <div>Normal: best ${s.difficulty.normal.bestOre}, win ${pct(s.difficulty.normal.clear, s.difficulty.normal.total)}</div>
      <div>Hard: best ${s.difficulty.hard.bestOre}, win ${pct(s.difficulty.hard.clear, s.difficulty.hard.total)}</div>
    </div>
    <div class="stats-group"><div class="stats-group-title">МАГАЗИН</div>
      <div>Посетителей/покупок: <strong>${s.shop.visitorsTotal}/${s.shop.purchasesTotal}</strong></div>
      <div>Средний чек: <strong>${s.shop.avgCheckGold.toFixed(1)}</strong></div>
      <div>Макс. покупка: <strong>${s.shop.maxPurchaseGold}</strong></div>
      <div>Пик посетителей: <strong>${visitorMinutePeak}/мин · ${visitorHourPeak}/час</strong></div>
      <div>С последней покупки: <strong>${fmtDur(secondsSinceSale)}</strong></div>
      <div>Доход магазина: <strong>${s.shop.incomeTotal}</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">КАРАВАНЫ</div>
      <div>Рейсов: <strong>${caravan.stats.runsTotal}</strong></div>
      <div>Успешных/потерь: <strong>${caravan.stats.successTotal}/${caravan.stats.failTotal}</strong></div>
      <div>Успешность: <strong>${caravanSuccessRate}%</strong></div>
      <div>Отправлено руды: <strong>${caravan.stats.oreSentTotal}</strong></div>
      <div>Доход/расход: <strong>${caravan.stats.incomeTotal}/${caravan.stats.expensesTotal} монет</strong></div>
      <div>Лучший профит: <strong>${caravan.stats.bestProfit} монет</strong></div>
      <div>Потрачено на апгрейды: <strong>${caravan.stats.upgradeSpent} монет</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">ОБВАЛЫ И ОПАСНОСТИ</div>
      <div>Всего обвалов: <strong>${s.collapses.total}</strong></div>
      <div>Клеток уничтожено: <strong>${s.collapses.cellsDestroyed}</strong></div>
      <div>Руды потеряно: <strong>${s.collapses.oreLost}</strong></div>
      <div>Макс. обвал: <strong>${s.collapses.maxSingle}</strong></div>
      <div>Обвалы (удар/idle): <strong>${s.collapses.byHit}/${s.collapses.byIdle}</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">ПЕРСОНАЖ</div>
      <div>Первый запуск: <strong>${new Date(s.meta.firstLaunchAt).toLocaleDateString("ru-RU")}</strong></div>
      <div>Наиграно: <strong>${fmtDur(s.meta.totalPlaySeconds)}</strong></div>
      <div>Смена имени/пола: <strong>${s.character.nameChanges}/${s.character.genderChanges}</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">ЭКОНОМИКА</div>
      <div>Инфляция: <strong>${s.economics.inflationPct.toFixed(0)}%</strong></div>
      <div>Руды за 1 монету: <strong>${s.economics.orePerGold.toFixed(3)}</strong></div>
      <div>Производительность: <strong>${s.economics.productivityOrePerMin.toFixed(2)} руды/мин</strong></div>
      <div>Травматизм: <strong>${s.economics.deathsPer1000Cells.toFixed(1)} смертей/1000 клеток</strong></div>
      <div>Себестоимость руды: <strong>${s.economics.deathCostPerOre.toFixed(3)} смертей/руду</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">АТМОСФЕРА</div>
      <div>Дней без происшествий: <strong>${s.atmosphere.daysWithoutIncidents}</strong></div>
      <div>Серия смертей/успехов: <strong>${s.atmosphere.deathStreak}/${s.atmosphere.successStreak}</strong></div>
      <div>Последняя смерть: <strong>${fmtDur(sinceDeath)} назад</strong></div>
      <div>Серия без руды (макс): <strong>${s.runs.maxEmptyStreak}</strong></div>
      <div>Проклятий на свете: <strong>${s.atmosphere.cursesCount}</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">ГЛОБАЛЬНЫЕ ПИКИ</div>
      <div>Пик банка руды: <strong>${s.peaks.maxBankOre}</strong></div>
      <div>Пик монет: <strong>${s.peaks.maxGold}</strong></div>
      <div>Макс HP в вылазке: <strong>${s.peaks.maxHpInRun}</strong></div>
      <div>Min clear Easy/Normal/Hard: <strong>${fmtDur(s.difficulty.easy.minClearSeconds)} / ${fmtDur(s.difficulty.normal.minClearSeconds)} / ${fmtDur(s.difficulty.hard.minClearSeconds)}</strong></div>
    </div>
    <div class="stats-group"><div class="stats-group-title">ТЕХНИЧЕСКОЕ</div>
      <div>Запусков игры: <strong>${s.meta.launches}</strong></div>
      <div>Сбросов: <strong>${s.meta.resets}</strong></div>
      <div>Версия: <strong>${s.meta.version}</strong></div>
      <div>Ошибок: <strong>${s.meta.errorsCount}</strong></div>
    </div>
  `;
}

function updatePlayerIdentityUI() {
  if (!commentatorName || !commentatorAvatar) return;
  const name = getPlayerName() || "Безымянный";
  const gender = getPlayerGender();
  const s = getStats();
  const avatarEmoji = gender === "female" ? "👩" : "👨";
  commentatorName.textContent = `Шахтер ${name}`;
  commentatorAvatar.textContent = avatarEmoji;
  if (commentatorRank) {
    commentatorRank.textContent = `Ур. ${s.character.level} · ${s.character.title}`;
  }
  if (commentatorRankSub) {
    commentatorRankSub.textContent = s.character.subtitle ?? "";
  }

  // Обновляем виджет персонажа в главном меню
  const pwAvatar = document.getElementById("pw-avatar");
  const pwName = document.getElementById("pw-name");
  const pwLevel = document.getElementById("pw-level-num");
  const pwTitle = document.getElementById("pw-title");
  const pwSubtitle = document.getElementById("pw-subtitle");
  const pwXpBar = document.getElementById("pw-xp-bar");
  const pwXpLbl = document.getElementById("pw-xp-label");
  if (pwAvatar) pwAvatar.textContent = avatarEmoji;
  if (pwName) pwName.textContent = name;
  if (pwLevel) pwLevel.textContent = s.character.level;
  if (pwTitle) pwTitle.textContent = s.character.title;
  if (pwSubtitle) pwSubtitle.textContent = s.character.subtitle ?? "";
  if (pwXpBar) {
    const pct =
      s.character.xpForNextLevel > 0
        ? Math.min(
            100,
            Math.round(
              (s.character.xpIntoLevel / s.character.xpForNextLevel) * 100,
            ),
          )
        : 100;
    pwXpBar.style.width = pct + "%";
  }
  if (pwXpLbl) {
    if (s.character.level >= 60) {
      pwXpLbl.textContent = "Максимальный уровень";
    } else {
      pwXpLbl.textContent = `${s.character.xpIntoLevel} / ${s.character.xpForNextLevel} XP`;
    }
  }
}

function narrate(key) {
  const lines = LINES[key];
  if (!lines || !commentatorText) return;
  const now = Date.now();
  if (now - lastNarrationAt < 650 && key !== "death") return;
  lastNarrationAt = now;
  commentatorText.textContent = pickWeightedLine(lines);
}

function pickWeightedLine(lines) {
  const normalized = lines.map((item) =>
    typeof item === "string"
      ? { text: item, weight: 1 }
      : { text: item.text, weight: item.weight ?? 1 },
  );
  const total = normalized.reduce((sum, x) => sum + x.weight, 0);
  let roll = Math.random() * total;
  for (const x of normalized) {
    roll -= x.weight;
    if (roll <= 0) return x.text;
  }
  return normalized[normalized.length - 1]?.text ?? "";
}

function openCharacterModal(title) {
  if (!characterModal) return;
  characterModal.style.display = "flex";
  characterModalTitle.textContent = title;
  const savedName = getPlayerName();
  const savedGender = getPlayerGender();
  characterNameInput.value = savedName;
  selectGender(savedGender);
  setTimeout(() => characterNameInput.focus(), 0);
}

function selectGender(gender) {
  const isFemale = gender === "female";
  genderMaleBtn.classList.toggle("selected", !isFemale);
  genderFemaleBtn.classList.toggle("selected", isFemale);
  genderMaleBtn.dataset.gender = "male";
  genderFemaleBtn.dataset.gender = "female";
}

function openGuildNameModal(forced = false) {
  if (!guildNameModal || !guildNameInput) return;
  guildNameModal.style.display = "flex";
  guildNameModal.dataset.forced = forced ? "1" : "0";
  if (guildNameModalTitle) {
    guildNameModalTitle.textContent = forced
      ? "🏛 НАЗОВИ СВОЮ ГИЛЬДИЮ"
      : "🏛 ПЕРЕИМЕНОВАТЬ ГИЛЬДИЮ";
  }
  if (guildNameCancelBtn)
    guildNameCancelBtn.style.display = forced ? "none" : "";
  guildNameInput.value = getMinersGuildName();
  setTimeout(() => guildNameInput.focus(), 0);
}

function closeGuildNameModal() {
  if (!guildNameModal) return;
  guildNameModal.style.display = "none";
  guildNameModal.dataset.forced = "0";
}

function pushGlobalToast(title, text, tone = "good") {
  if (!shopToastStack) return;
  const toast = document.createElement("div");
  toast.className = `shop-toast toast-${tone}`;
  toast.innerHTML = `
    <div class="shop-toast-title">${title}</div>
    <div class="shop-toast-text">${text}</div>
  `;
  shopToastStack.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 260);
  }, 2800);
}

function showShopToast({ oreType, oreBought, goldEarned }) {
  const oreLabel = oreType ? (ORE_CONFIG[oreType]?.label ?? "руды") : "руды";
  const stats = updateStats((s) => {
    s.shop.visitorsTotal += 1;
    s.shop.purchasesTotal += 1;
    s.shop.lastPurchaseAt = new Date().toISOString();
    s.shop.incomeTotal += goldEarned;
    s.shop.maxPurchaseGold = Math.max(s.shop.maxPurchaseGold, goldEarned);
    s.resources.totalOreSold += oreBought;
    s.resources.totalGoldEarned += goldEarned;
    s.peaks.maxGold = Math.max(s.peaks.maxGold, getGold());

    const minuteKey = new Date().toISOString().slice(0, 16);
    const hourKey = new Date().toISOString().slice(0, 13);
    s.shop.visitorsByMinute[minuteKey] =
      (s.shop.visitorsByMinute[minuteKey] ?? 0) + 1;
    s.shop.visitorsByHour[hourKey] = (s.shop.visitorsByHour[hourKey] ?? 0) + 1;
    s.shop.visitorsPeakPerMinute = Math.max(
      s.shop.visitorsPeakPerMinute,
      s.shop.visitorsByMinute[minuteKey],
    );
    s.shop.visitorsPeakPerHour = Math.max(
      s.shop.visitorsPeakPerHour,
      s.shop.visitorsByHour[hourKey],
    );
    s.shop.emptySinceSeconds = 0;
    addXp(s, 1);
    addXp(s, Math.floor(oreBought / 20));
  });
  addShopReviewFromContext({
    totalOreSold: stats.resources.totalOreSold,
    totalSilverEarned: stats.resources.totalGoldEarned,
    adsLevel: getAdsLevel(),
    purchasesTotal: stats.shop.purchasesTotal,
    lastSaleOre: oreBought,
    lastSaleSilver: goldEarned,
  });
  if (
    shopToastStack &&
    hasShopUnlocked() &&
    !screenShop?.classList.contains("active")
  ) {
    pushGlobalToast(
      "🏪 Продажа",
      `-${oreBought} ${oreLabel} • +${goldEarned} монет`,
      "good",
    );
  }
  narrate("shopSale");
  if (screenStart.classList.contains("active")) refreshStatusBar();
}

function showCaravanEventToast(result) {
  if (!result) return;
  const tone = result.tone ?? (result.ok ? "good" : "bad");
  pushGlobalToast("🚢 Караваны", result.line ?? "Событие каравана", tone);

  if (result.phase === "upgrade" && result.spent > 0) {
    updateStats((s) => {
      s.resources.goldSpent += result.spent;
    });
  }
  if (result.phase === "dispatch" && result.spent > 0) {
    updateStats((s) => {
      s.resources.goldSpent += result.spent;
    });
  }

  if (
    result.phase === "arrival" &&
    (result.payout > 0 || result.oreAmount > 0)
  ) {
    updateStats((s) => {
      if (result.payout > 0) {
        s.resources.totalGoldEarned += result.payout;
        s.shop.incomeTotal += result.payout;
        s.peaks.maxGold = Math.max(s.peaks.maxGold, getGold());
      }
      if (result.oreAmount > 0 && result.ok) {
        s.resources.totalOreSold += result.oreAmount;
      }
    });
  }

  if (screenStart.classList.contains("active")) {
    refreshStatusBar();
    renderStatsPanel();
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

restoreProgressFromBackupIfNeeded();
function safeInit(label, fn) {
  try {
    fn();
    return true;
  } catch (err) {
    console.error(`[init:${label}]`, err);
    return false;
  }
}

safeInit("shop-ui", () => initShopScreen(showStartScreen));
safeInit("prospectors-ui", () =>
  initProspectorsScreen({
    onBack: showStartScreen,
    getSilver: getGold,
    spendSilver: spendGold,
    onStateChanged: () => {
      renderRunTools();
      if (screenProspectors.classList.contains("active"))
        renderProspectorsUpgrades();
    },
    onSpendSilver: (amount) => {
      updateStats((s) => {
        s.resources.goldSpent += amount;
        addXp(s, 8);
      });
      renderStatsPanel();
      renderUpgrades();
      if (screenStart.classList.contains("active")) refreshStatusBar();
    },
  }),
);
safeInit("guild-ui", () =>
  initMinersGuildScreen({
    onBack: showStartScreen,
    getSilver: getGold,
    spendSilver: spendGold,
    onStateChanged: () => {
      if (screenGuild.classList.contains("active")) renderMinersGuildScreen();
    },
    onSpendSilver: (amount) => {
      updateStats((s) => {
        s.resources.goldSpent += amount;
        addXp(s, 10);
        s.peaks.maxGold = Math.max(s.peaks.maxGold, getGold());
      });
      renderUpgrades();
      if (screenStart.classList.contains("active")) {
        renderStatsPanel();
        refreshStatusBar();
      }
      if (screenGuild.classList.contains("active")) renderMinersGuildScreen();
    },
    onRequestRename: () => openGuildNameModal(false),
  }),
);
safeInit("td-ui", () =>
  initTdScreen({
    onBack: showStartScreen,
    getGold,
    spendGold: (amount) => {
      const ok = spendGold(amount);
      if (!ok) return false;
      updateStats((s) => {
        s.resources.goldSpent += amount;
        addXp(s, 6);
      });
      refreshStatusBar();
      renderUpgrades();
      return true;
    },
    addTickets: (amount) => {
      addTickets(amount);
      updateStats((s) => {
        addXp(s, Math.max(2, amount * 3));
      });
      refreshStatusBar();
    },
    getTickets,
    onStateChanged: () => {
      refreshStatusBar();
      renderStatsPanel();
      renderUpgrades();
    },
  }),
);
safeInit("gacha-ui", () =>
  initGachaScreen({
    onBack: showStartScreen,
    onStateChanged: () => {
      refreshStatusBar();
      renderStatsPanel();
      renderUpgrades();
      if (screenInventory.classList.contains("active")) renderInventoryScreen();
    },
  }),
);
safeInit("inventory-ui", () =>
  initInventoryScreen({
    onBack: showStartScreen,
  }),
);
setShopSaleListener(showShopToast);
setAdPurchaseListener((cost) => {
  updateStats((s) => {
    s.resources.goldSpent += cost;
    addXp(s, 25);
  });
  renderStatsPanel();
  if (screenStart.classList.contains("active")) refreshStatusBar();
});
setCaravanEventListener(showCaravanEventToast);
safeInit("shop-tick", () => startShopTick());
initStatsSession();
backupProgressSnapshot();
applyMusicSettings();
document.addEventListener("pointerdown", tryStartMusic, { once: true });
document.addEventListener("keydown", tryStartMusic, { once: true });

musicMuteBtn?.addEventListener("click", () => {
  const nextMuted = !isMusicMuted();
  localStorage.setItem(MUSIC_MUTED_KEY, nextMuted ? "1" : "0");
  applyMusicSettings();
  tryStartMusic();
});

gameMusicMuteBtn?.addEventListener("click", () => {
  const nextMuted = !isMusicMuted();
  localStorage.setItem(MUSIC_MUTED_KEY, nextMuted ? "1" : "0");
  applyMusicSettings();
  tryStartMusic();
});

musicVolumeInput?.addEventListener("input", () => {
  const volume = Math.max(
    0,
    Math.min(100, parseInt(musicVolumeInput.value, 10) || 0),
  );
  localStorage.setItem(MUSIC_VOLUME_KEY, String(volume));
  applyMusicSettings();
  if (volume > 0 && isMusicMuted()) {
    localStorage.setItem(MUSIC_MUTED_KEY, "0");
    applyMusicSettings();
  }
  tryStartMusic();
});

gameMusicVolumeInput?.addEventListener("input", () => {
  const volume = Math.max(
    0,
    Math.min(100, parseInt(gameMusicVolumeInput.value, 10) || 0),
  );
  localStorage.setItem(MUSIC_VOLUME_KEY, String(volume));
  applyMusicSettings();
  if (volume > 0 && isMusicMuted()) {
    localStorage.setItem(MUSIC_MUTED_KEY, "0");
    applyMusicSettings();
  }
  tryStartMusic();
});

setInterval(() => {
  const guildTick = processMinersGuildTick();
  if (guildTick) {
    if (guildTick.oreByType) {
      addOreToBank(ORE_COPPER, guildTick.oreByType[ORE_COPPER] ?? 0);
      addOreToBank(ORE_SILVER, guildTick.oreByType[ORE_SILVER] ?? 0);
      addOreToBank(ORE_GOLD, guildTick.oreByType[ORE_GOLD] ?? 0);
      addOreToBank(ORE_DIAMOND, guildTick.oreByType[ORE_DIAMOND] ?? 0);
    } else if (guildTick.oreGained > 0) {
      addOreToBank(ORE_COPPER, guildTick.oreGained);
    }
    updateStats((s) => {
      if (guildTick.oreGained > 0) {
        s.resources.totalOreMined += guildTick.oreGained;
        s.peaks.maxBankOre = Math.max(s.peaks.maxBankOre, getBank());
        addXp(s, Math.max(1, Math.floor(guildTick.oreGained / 3)));
      }
      if (guildTick.deaths > 0) {
        s.atmosphere.cursesCount += guildTick.deaths;
      }
      if (guildTick.payrollSpent > 0) {
        s.resources.goldSpent += guildTick.payrollSpent;
      }
    });
    if (guildTick.eventLines?.length) {
      guildTick.eventLines.forEach((line) => {
        const tone = line.includes("☠")
          ? "bad"
          : line.includes("🚪") || line.includes("💰")
            ? "neutral"
            : "good";
        pushGlobalToast("🏛 Гильдия", line, tone);
      });
    }
    if (screenGuild.classList.contains("active")) renderMinersGuildScreen();
    if (screenStart.classList.contains("active")) {
      refreshStatusBar();
      renderUpgrades();
    }
  }

  updateStats((s) => {
    s.meta.totalPlaySeconds += 1;
    if (s.shop.lastPurchaseAt) {
      s.shop.emptySinceSeconds = Math.floor(
        (Date.now() - new Date(s.shop.lastPurchaseAt).getTime()) / 1000,
      );
    } else {
      s.shop.emptySinceSeconds += 1;
    }
  });
  if (screenStart.classList.contains("active")) {
    refreshStatusBar();
    renderStatsPanel();
  }
}, 1000);
setInterval(() => {
  backupProgressSnapshot();
}, 30000);
window.addEventListener("beforeunload", backupProgressSnapshot);
showStartScreen();

genderMaleBtn.addEventListener("click", () => selectGender("male"));
genderFemaleBtn.addEventListener("click", () => selectGender("female"));
characterSaveBtn.addEventListener("click", () => {
  const prevName = getPlayerName() || "Безымянный";
  const prevGender = getPlayerGender();
  const name = characterNameInput.value.trim() || "Безымянный";
  const gender = genderFemaleBtn.classList.contains("selected")
    ? "female"
    : "male";
  savePlayerProfile(name, gender);
  updatePlayerIdentityUI();
  characterModal.style.display = "none";
  try {
    updateStats((s) => {
      if (name !== prevName) s.character.nameChanges += 1;
      if (gender !== prevGender) s.character.genderChanges += 1;
    });
  } catch {
    // Не блокируем старт игры из-за ошибки сохранения статистики.
  }
  try {
    renderStatsPanel();
  } catch {
    // ignore
  }
  narrate("sessionStart");
});

guildNameCancelBtn?.addEventListener("click", () => {
  const forced = guildNameModal?.dataset.forced === "1";
  if (forced && !getMinersGuildName()) return;
  closeGuildNameModal();
});

guildNameSaveBtn?.addEventListener("click", () => {
  const value = (guildNameInput?.value ?? "").trim();
  if (!value) {
    if (guildNameInput)
      guildNameInput.value = getMinersGuildName() || "Стальной Забой";
  }
  const finalName = (guildNameInput?.value ?? "").trim();
  setMinersGuildName(finalName || "Стальной Забой");
  closeGuildNameModal();
  if (screenGuild.classList.contains("active")) renderMinersGuildScreen();
});

guildNameInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") guildNameSaveBtn?.click();
});

window.addEventListener("resize", () => {
  if (!state || !state.playerPos) return;
  setMinerPosition(state.playerPos.r, state.playerPos.c, true);
});

if (!getPlayerName()) {
  openCharacterModal("🪪 НОВЫЙ ШАХТЕР");
  narrate("sessionStart");
}
