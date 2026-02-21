// ═══════════════════════════════════════════════════════════════════════════
// shop-ui.js — Экран магазина (DOM + тик)
// ═══════════════════════════════════════════════════════════════════════════

import shopIconUrl    from './icons/shop-house.png';
import copperOreUrl   from './icons/copper-ore.png';
import silverOreUrl   from './icons/silver-ore.png';
import goldOreUrl     from './icons/gold-ore.png';
import diamondOreUrl  from './icons/diamond-ore.png';
import {
  ADS_UPGRADES,
  getGold, getAdsLevel,
  getCurrentAdsUpgrade, getCurrentBulkMultiplier, getPreferredOreForSale,
  SHOP_CONFIG,
  buyAdsUpgrade,
  shopTick, isShopOpen,
  getOreBank, getOrePrice,
  getLossRate,
  getShopFlowState,
  getTotalOreInBank,
} from './shop.js';
import { ORE_COPPER, ORE_SILVER, ORE_GOLD, ORE_DIAMOND, ORE_CONFIG } from './game.js';
import { addShopReview, buildShopReview, buildEmptyShopReview, getShopReviews } from "./shop-reviews.js";
import {
  STAFF_ROLES, STAFF_MAX_LEVEL,
  getStaffLevel, getStaffHireCost,
  getStaffBonuses,
  getTotalSalaryPerSec, hireStaff,
  processStaffSalary,
} from './shop-staff.js';
import {
  CARAVAN_UPGRADES,
  CARAVAN_ROUTES,
  buyCaravanUpgrade,
  canSendCaravan,
  getEffectiveMaxActive,
  getEffectiveRoute,
  getCaravansState,
  getMaxSendForRoute,
  processCaravansTick,
  sendCaravan,
} from "./shop-caravans.js";

const ORE_ICONS = {
  [ORE_COPPER]:  copperOreUrl,
  [ORE_SILVER]:  silverOreUrl,
  [ORE_GOLD]:    goldOreUrl,
  [ORE_DIAMOND]: diamondOreUrl,
};

const ORE_ORDER = [ORE_COPPER, ORE_SILVER, ORE_GOLD, ORE_DIAMOND];

// ─── КОЛЛБЭКИ ────────────────────────────────────────────────────────────────

let _onBack       = null;
let _tickInterval = null;
let _onSale       = null;
let _onAdPurchase = null;
let _onCaravanEvent = null;
let _emptyStockTicks = 0;

// ─── HTML ЭКРАНА ──────────────────────────────────────────────────────────────

export function buildShopScreen() {
  return `
  <div id="screen-shop" class="screen">

    <!-- Навбар магазина -->
    <nav class="shop-topbar">
      <div class="shop-topbar-brand">
        <img class="shop-topbar-icon" src="${shopIconUrl}" draggable="false" alt="">
        <span class="shop-topbar-title">Торговая лавка</span>
      </div>
      <div class="shop-topbar-stats">
        <div class="resource-chip resource-gold">
          <span class="resource-dot resource-dot-gold"></span>
          <span class="resource-val" id="shop-gold-val">0</span>
          <span class="resource-label">монет</span>
        </div>
        <div class="resource-chip" id="shop-salary-row" style="display:none">
          <span class="resource-dot" style="background:var(--red);box-shadow:0 0 6px rgba(239,68,68,0.5)"></span>
          <span class="resource-val" style="color:var(--red-hi)" id="shop-salary-val">0</span>
          <span class="resource-label">зарплата/с</span>
        </div>
      </div>
      <button class="topbar-btn shop-back-btn" id="shop-back-btn">← Меню</button>
    </nav>

    <div class="shop-content">
      <div class="shop-layout">

        <!-- Левая колонка -->
        <div class="shop-left">

          <div class="card shop-stats-card">
            <div class="card-header">
              <span class="card-header-icon">📊</span>
              <span class="card-header-text">Состояние магазина</span>
            </div>
            <div class="card-body">
              <div class="shop-ore-bank-grid" id="shop-ore-bank-grid"></div>
              <div class="shop-stat-row">
                <span class="shop-stat-label">Посетителей</span>
                <span class="shop-stat-val" id="shop-visitor-rate">~1 / 25с</span>
              </div>
              <div class="shop-stat-row" id="shop-loss-row">
                <span class="shop-stat-label">Потери</span>
                <span class="shop-stat-val" id="shop-loss-val">6%</span>
              </div>
            </div>
          </div>

          <div class="card shop-log-card">
            <div class="card-header">
              <span class="card-header-icon">📋</span>
              <span class="card-header-text">Журнал сделок</span>
            </div>
            <div class="shop-log" id="shop-log">
              <div class="shop-log-empty">Ожидаем покупателей...</div>
            </div>
          </div>

          <div class="card shop-reviews-card">
            <div class="card-header">
              <span class="card-header-icon">⭐</span>
              <span class="card-header-text">Отзывы покупателей</span>
            </div>
            <div class="shop-reviews" id="shop-reviews"></div>
          </div>

        </div>

        <!-- Правая колонка -->
        <div class="shop-right">

          <div class="card shop-phase-card">
            <div class="shop-phase-bar">
              <div class="shop-phase-fill" id="shop-phase-fill"></div>
              <span class="shop-phase-label" id="shop-phase-label">Рабочий поток</span>
            </div>
          </div>

          <div class="card shop-econ-card">
            <div class="card-header">
              <span class="card-header-icon">📈</span>
              <span class="card-header-text">Экономика</span>
            </div>
            <div class="shop-econ-body" id="shop-econ-body"></div>
          </div>

          <div class="card shop-floor-card">
            <div class="card-header">
              <span class="card-header-icon">🏪</span>
              <span class="card-header-text">Торговый зал</span>
            </div>
            <div class="shop-flow-body" id="shop-flow-body">
              <div class="shop-counter" id="shop-counter"></div>
              <div class="shop-queue-lane" id="shop-queue-lane"></div>
              <div class="shop-queue-meta" id="shop-queue-meta"></div>
            </div>
          </div>

          <div class="card shop-events-card">
            <div class="card-header">
              <span class="card-header-icon">💬</span>
              <span class="card-header-text">Что происходит</span>
            </div>
            <div class="shop-events-feed" id="shop-events-feed"></div>
          </div>

          <div class="shop-tabs">
            <button class="shop-tab shop-tab-active" data-tab="ads">📣 Реклама</button>
            <button class="shop-tab" data-tab="staff">👥 Штат</button>
            <button class="shop-tab" data-tab="caravans">🚢 Караваны</button>
          </div>

          <div class="shop-tab-pane" id="shop-tab-ads">
            <div class="card shop-upgrades-card">
              <div class="cc-upgrades-bought" id="cc-bought"></div>
              <div class="cc-upgrade-available" id="cc-available"></div>
              <div class="shop-ads-info" id="shop-ads-info"></div>
            </div>
          </div>

          <div class="shop-tab-pane" id="shop-tab-staff" style="display:none">
            <div class="card shop-staff-card">
              <div class="staff-grid" id="staff-grid"></div>
            </div>
          </div>

          <div class="shop-tab-pane" id="shop-tab-caravans" style="display:none">
            <div class="card shop-caravans-card">
              <div class="caravans-top">
                <div class="caravans-ore-picker">
                  <label for="caravan-ore-select">Груз:</label>
                  <select id="caravan-ore-select" class="caravan-ore-select"></select>
                </div>
                <div class="caravans-active-meta" id="caravans-active-meta">Активно: 0/2</div>
              </div>
              <div class="caravans-summary" id="caravans-summary"></div>
              <div class="caravans-upgrades" id="caravans-upgrades"></div>
              <div class="caravans-route-grid" id="caravans-route-grid"></div>
              <div class="caravans-active-list" id="caravans-active-list"></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>`;
}

// ─── ИНИЦИАЛИЗАЦИЯ ЭКРАНА ─────────────────────────────────────────────────────

export function initShopScreen(onBackFn) {
  _onBack = onBackFn;

  document.getElementById('shop-back-btn')
    .addEventListener('click', () => _onBack?.());

  // Вкладки
  document.querySelectorAll('.shop-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shop-tab').forEach((b) => b.classList.remove('shop-tab-active'));
      btn.classList.add('shop-tab-active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.shop-tab-pane').forEach((p) => {
        p.style.display = p.id === `shop-tab-${tab}` ? '' : 'none';
      });
      if (tab === 'staff') renderStaffTab();
      if (tab === 'caravans') renderCaravansTab();
    });
  });

  renderPhaseIndicator();
  renderShopStats();
  renderShopEconomyPanel();
  renderShopFlowPanel();
  renderShopUpgrades();
  renderShopReviews();
  renderStaffTab();
  initCaravanControls();
  renderCaravansTab();
}

// ─── ТИК МАГАЗИНА ─────────────────────────────────────────────────────────────

export function startShopTick() {
  if (_tickInterval) return;
  _tickInterval = setInterval(() => {
    if (!isShopOpen()) return;

    // Зарплата штата
    processStaffSalary();

    const result = shopTick();
    if (result) {
      if (document.getElementById('screen-shop')?.classList.contains('active')) {
        addShopLogEntry(result);
      }
      _onSale?.(result);
      _emptyStockTicks = 0;
    } else if (getTotalOreInBank() <= 0) {
      _emptyStockTicks += 1;
      // Каждые ~15 секунд пустого склада — злой отзыв
      if (_emptyStockTicks % 15 === 0) {
        addShopReview(buildEmptyShopReview());
        renderShopReviews();
      }
    } else {
      _emptyStockTicks = 0;
    }
    const caravanTick = processCaravansTick();
    if (caravanTick?.results?.length) {
      caravanTick.results.forEach((r) => {
        _onCaravanEvent?.({ ...r, phase: "arrival" });
      });
    }
    renderPhaseIndicator();
    renderShopStats();
    renderShopEconomyPanel();
    renderShopFlowPanel();
    renderEventsFeed();
    renderCaravansTab();
  }, 1000);
}

export function stopShopTick() {
  clearInterval(_tickInterval);
  _tickInterval = null;
}

export function setShopSaleListener(listener)   { _onSale = listener; }
export function setAdPurchaseListener(listener)  { _onAdPurchase = listener; }
export function setCaravanEventListener(listener) { _onCaravanEvent = listener; }

// ─── РЕНДЕР СТАТИСТИКИ ────────────────────────────────────────────────────────

function ensureOreBankGrid(bankGridEl) {
  if (bankGridEl.children.length === ORE_ORDER.length) return;
  bankGridEl.innerHTML = ORE_ORDER.map((oreType) => {
    const cfg   = ORE_CONFIG[oreType];
    const price = getOrePrice(oreType);
    return `
      <div class="shop-ore-bank-row ore-bank-row-${oreType}">
        <img class="shop-ore-bank-icon" src="${ORE_ICONS[oreType]}" draggable="false" alt="">
        <span class="shop-ore-bank-name">${cfg.label}</span>
        <span class="shop-ore-bank-val ore-color-${oreType}" data-ore-val="${oreType}">0</span>
        <span class="shop-ore-bank-price gold-color">${price} монет</span>
      </div>`;
  }).join('');
}

export function renderShopStats() {
  const bankGridEl  = document.getElementById('shop-ore-bank-grid');
  const goldEl      = document.getElementById('shop-gold-val');
  const rateEl      = document.getElementById('shop-visitor-rate');
  const salaryRowEl = document.getElementById('shop-salary-row');
  const salaryValEl = document.getElementById('shop-salary-val');
  const lossValEl   = document.getElementById('shop-loss-val');
  if (!bankGridEl) return;

  ensureOreBankGrid(bankGridEl);
  ORE_ORDER.forEach((oreType) => {
    const el = bankGridEl.querySelector(`[data-ore-val="${oreType}"]`);
    if (el) el.textContent = getOreBank(oreType);
  });

  if (goldEl) goldEl.textContent = getGold() + ' монет';

  const flow = getShopFlowState();
  if (rateEl) rateEl.textContent = `${flow.expectedArrivalsPerSec.toFixed(2)} / сек`;

  const salaryPerSec = getTotalSalaryPerSec();
  if (salaryRowEl) salaryRowEl.style.display = salaryPerSec > 0 ? '' : 'none';
  if (salaryValEl) salaryValEl.textContent = `−${salaryPerSec.toFixed(2)} монет/сек`;

  const loss = getLossRate();
  if (lossValEl) {
    lossValEl.textContent = `${Math.round(loss * 100)}%`;
    lossValEl.className = `shop-stat-val ${loss < 0.03 ? 'color-green' : loss < 0.05 ? 'color-dim' : 'color-red'}`;
  }
}

// ─── ФАЗОВЫЙ ИНДИКАТОР ────────────────────────────────────────────────────

function renderPhaseIndicator() {
  const fillEl  = document.getElementById("shop-phase-fill");
  const labelEl = document.getElementById("shop-phase-label");
  if (!fillEl || !labelEl) return;

  const flow = getShopFlowState();
  fillEl.style.width = `${Math.round(flow.phaseProgress * 100)}%`;
  fillEl.className = `shop-phase-fill shop-phase-${flow.phaseId}`;
  labelEl.textContent = flow.phaseLabel;
}

// ─── ТОРГОВЫЙ ЗАЛ ────────────────────────────────────────────────────────

export function renderShopFlowPanel() {
  const counterEl  = document.getElementById("shop-counter");
  const laneEl     = document.getElementById("shop-queue-lane");
  const metaEl     = document.getElementById("shop-queue-meta");
  if (!counterEl || !laneEl || !metaEl) return;

  const flow = getShopFlowState();
  const sellerLvl = getStaffLevel("seller");

  // ─ Кассы (слоты продавцов) ─
  const totalSlots = Math.max(1, sellerLvl);
  const activeSlots = flow.servedLastTick;
  counterEl.innerHTML = Array.from({ length: totalSlots }, (_, i) => {
    const isActive = i < activeSlots;
    const emoji = sellerLvl > 0 ? "🧑‍💼" : "🪑";
    return `<div class="shop-counter-slot${isActive ? " shop-counter-active" : ""}">${emoji}${isActive ? '<span class="shop-counter-spark">💰</span>' : ""}</div>`;
  }).join("");

  // ─ Визуальная очередь (DOM-diffing) ─
  const queueIds = new Set(flow.queue.map((v) => String(v.id)));

  // Удаляем ушедших (с защитой от повторной анимации)
  Array.from(laneEl.children).forEach((el) => {
    if (el.classList.contains("shop-visitor-exit")) return;
    const vid = el.getAttribute("data-vid");
    if (!vid || !queueIds.has(vid)) {
      el.classList.add("shop-visitor-exit");
      setTimeout(() => el.remove(), 300);
    }
  });

  // Обновляем/добавляем (пропускаем элементы с exit-анимацией)
  flow.queue.forEach((v) => {
    const vid = String(v.id);
    let el = laneEl.querySelector(`[data-vid="${vid}"]:not(.shop-visitor-exit)`);
    const ratio = v.patienceRatio;
    const moodClass = ratio < 0.15 ? "shop-visitor-angry" : ratio < 0.35 ? "shop-visitor-worried" : "";

    if (!el) {
      el = document.createElement("div");
      el.className = "shop-visitor shop-visitor-enter";
      el.setAttribute("data-vid", vid);
      el.innerHTML = `
        <div class="shop-visitor-avatar">${v.avatar}</div>
        <div class="shop-visitor-patience"><div class="shop-visitor-patience-fill"></div></div>
        <div class="shop-visitor-name">${v.name}</div>`;
      laneEl.appendChild(el);
      requestAnimationFrame(() => el.classList.remove("shop-visitor-enter"));
    }

    // Обновляем patience bar
    const barFill = el.querySelector(".shop-visitor-patience-fill");
    if (barFill) {
      barFill.style.setProperty("--p", ratio.toFixed(2));
      barFill.className = `shop-visitor-patience-fill ${ratio > 0.5 ? "patience-ok" : ratio > 0.25 ? "patience-warn" : "patience-crit"}`;
    }

    // Mood
    el.classList.remove("shop-visitor-worried", "shop-visitor-angry");
    if (moodClass) el.classList.add(moodClass);
  });

  // ─ Мета ─
  const overflow = Math.max(0, flow.queueSize - flow.queue.length);
  metaEl.innerHTML = flow.queueSize > 0
    ? `<span>${flow.queueSize}/${flow.queueCapacity}</span>${overflow > 0 ? `<span class="shop-queue-overflow">+${overflow} за кадром</span>` : ""}`
    : '<span class="shop-queue-empty-msg">Очередь пуста</span>';
}

export function renderShopEconomyPanel() {
  const el = document.getElementById("shop-econ-body");
  if (!el) return;

  const bulkMult = getCurrentBulkMultiplier();
  const staff = getStaffBonuses();
  const flow = getShopFlowState();
  const avgVisitorsPerSec = flow.expectedArrivalsPerSec;
  const avgWantsBase = (SHOP_CONFIG.minBuy + SHOP_CONFIG.maxBuy) / 2;
  const avgBuy = avgWantsBase * staff.avgBuyMult * bulkMult;
  const oreType = getPreferredOreForSale();
  const orePrice = getOrePrice(oreType);
  const grossPerSec = avgVisitorsPerSec * avgBuy * orePrice;
  const lossRate = getLossRate();
  const lossPerSec = grossPerSec * lossRate;
  const salaryPerSec = getTotalSalaryPerSec();
  const netPerSec = grossPerSec - lossPerSec - salaryPerSec;
  const lossPct = Math.round(lossRate * 100);

  el.innerHTML = `
    <div class="shop-econ-grid">
      <div class="shop-econ-metric">
        <span class="shop-econ-val ${netPerSec >= 0 ? "color-green" : "color-red"}">${netPerSec.toFixed(1)}</span>
        <span class="shop-econ-unit">монет/с</span>
      </div>
      <div class="shop-econ-metric">
        <span class="shop-econ-val">${flow.checkoutRatePerSec.toFixed(2)}</span>
        <span class="shop-econ-unit">обсл./с</span>
      </div>
      <div class="shop-econ-metric">
        <span class="shop-econ-val ${lossPct > 4 ? "color-red" : "color-dim"}">${lossPct}%</span>
        <span class="shop-econ-unit">потери</span>
      </div>
    </div>
    <div class="shop-econ-breakdown">
      <span>Валовый ${grossPerSec.toFixed(1)}</span>
      <span>Потери −${lossPerSec.toFixed(1)}</span>
      <span>Зарплата −${salaryPerSec.toFixed(1)}</span>
    </div>
  `;
}

// ─── ЛЕНТА СОБЫТИЙ ────────────────────────────────────────────────────────

const EVENT_ICONS = { arrive: "🚪", sale: "💰", leave: "💨" };
const MAX_EVENTS = 6;

function renderEventsFeed() {
  const feedEl = document.getElementById("shop-events-feed");
  if (!feedEl) return;

  // Если товара нет — очистить ленту, показать заглушку
  if (getTotalOreInBank() <= 0) {
    if (!feedEl.querySelector(".shop-event-empty")) {
      feedEl.innerHTML = `
        <div class="shop-event shop-event-empty">
          <span class="shop-event-icon">🚫</span>
          <span class="shop-event-text">Прилавки пусты — покупатели уходят ни с чем</span>
        </div>`;
    }
    return;
  }

  // Убираем заглушку если товар появился
  const placeholder = feedEl.querySelector(".shop-event-empty");
  if (placeholder) placeholder.remove();

  const flow = getShopFlowState();
  const events = flow.lastTickEvents;
  if (!events.length) return;

  events.forEach((evt) => {
    const icon = EVENT_ICONS[evt.type] ?? "❓";
    let text = "";
    if (evt.type === "arrive") text = `${evt.avatar} ${evt.name} зашёл`;
    else if (evt.type === "sale") text = `${evt.avatar} ${evt.name} купил ${evt.oreBought} ${evt.oreLabel}`;
    else if (evt.type === "leave") text = `${evt.avatar} ${evt.name} ушёл`;

    const div = document.createElement("div");
    div.className = `shop-event shop-event-${evt.type} shop-event-in`;
    div.innerHTML = `<span class="shop-event-icon">${icon}</span><span class="shop-event-text">${text}</span>`;
    feedEl.insertBefore(div, feedEl.firstChild);
  });

  // Обрезаем до MAX — удаляем сразу чтобы не уйти в бесконечный цикл
  while (feedEl.children.length > MAX_EVENTS) {
    feedEl.lastChild.remove();
  }
}

// ─── РЕНДЕР ОТЗЫВОВ ───────────────────────────────────────────────────────────

export function renderShopReviews() {
  const reviewsEl = document.getElementById("shop-reviews");
  if (!reviewsEl) return;
  const list = getShopReviews().slice(-8).reverse();
  if (!list.length) {
    reviewsEl.innerHTML = '<div class="shop-review-empty">Пока тихо. Первый отзыв появится после продажи.</div>';
    return;
  }
  reviewsEl.innerHTML = list.map((r) => {
    const stars = "★".repeat(Math.max(1, Math.min(5, r.stars ?? 3)));
    const time  = new Date(r.at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    return `
      <div class="shop-review-item">
        <div class="shop-review-head">
          <span class="shop-review-stars">${stars}</span>
          <span class="shop-review-time">${time}</span>
        </div>
        <div class="shop-review-text">${r.text}</div>
      </div>`;
  }).join("");
}

export function addShopReviewFromContext(context) {
  addShopReview(buildShopReview(context));
  renderShopReviews();
}

// ─── РЕНДЕР РЕКЛАМЫ (Cookie Clicker стиль) ────────────────────────────────────

export function renderShopUpgrades() {
  const boughtEl = document.getElementById('cc-bought');
  const availEl  = document.getElementById('cc-available');
  const infoEl   = document.getElementById('shop-ads-info');
  if (!boughtEl) return;

  const currentLevel = getAdsLevel();
  const gold         = getGold();

  boughtEl.innerHTML = '';
  ADS_UPGRADES.filter(u => u.level <= currentLevel).forEach(u => {
    const badge = document.createElement('div');
    badge.className = 'cc-badge cc-badge-bought';
    badge.title = u.label;
    badge.textContent = '📣';
    boughtEl.appendChild(badge);
  });
  if (currentLevel === 0) {
    boughtEl.innerHTML = '<span class="cc-no-bought">Нет купленных улучшений</span>';
  }

  availEl.innerHTML = '';
  const upcoming = ADS_UPGRADES.filter(u => u.level > currentLevel);
  upcoming.forEach((u, idx) => {
    const card   = document.createElement('div');
    const canBuy = gold >= u.cost && idx === 0;
    const isNext = idx === 0;
    card.className = ['cc-upg-card',
      isNext ? 'cc-upg-next' : 'cc-upg-locked',
      isNext && canBuy  ? 'cc-upg-affordable'  : '',
      isNext && !canBuy ? 'cc-upg-cant-afford'  : '',
    ].join(' ').trim();
    card.innerHTML = `
      <div class="cc-upg-icon">📣</div>
      <div class="cc-upg-body">
        <div class="cc-upg-name">${u.label}</div>
        <div class="cc-upg-desc">${isNext ? u.desc : '???'}</div>
        <div class="cc-upg-cost ${canBuy ? 'cc-cost-ready' : ''}">
          ${isNext ? u.cost + ' монет' : '—'}
        </div>
      </div>`;
    if (canBuy) {
      card.addEventListener('click', () => {
        if (buyAdsUpgrade()) {
          _onAdPurchase?.(u.cost, u.level);
          renderShopStats();
          renderShopFlowPanel();
          renderShopUpgrades();
        }
      });
    }
    availEl.appendChild(card);
  });
  if (upcoming.length === 0) {
    availEl.innerHTML = '<div class="cc-maxed">✓ Все улучшения куплены</div>';
  }

  const cur = ADS_UPGRADES.find(u => u.level === currentLevel);
  if (infoEl) infoEl.textContent = cur
    ? `Текущий уровень: ${cur.label} (×${cur.mult} посетителей · ×${(cur.bulkMult ?? 1).toFixed(2)} размер покупки)`
    : 'Реклама не куплена. Посетители заходят редко.';
}

// ─── РЕНДЕР ШТАТА ─────────────────────────────────────────────────────────────

export function renderStaffTab() {
  const gridEl = document.getElementById('staff-grid');
  if (!gridEl) return;

  const gold = getGold();
  gridEl.innerHTML = '';

  STAFF_ROLES.forEach((role) => {
    const lvl      = getStaffLevel(role.id);
    const cost     = getStaffHireCost(role.id);
    const maxed    = lvl >= STAFF_MAX_LEVEL;
    const canHire  = !maxed && cost !== null && gold >= cost;
    const salary   = lvl > 0 ? role.salary[lvl - 1] : 0;

    // Точки уровня ●●●○
    const dots = Array.from({ length: STAFF_MAX_LEVEL }, (_, i) =>
      `<span class="staff-dot ${i < lvl ? 'staff-dot-filled' : ''}">${i < lvl ? '●' : '○'}</span>`
    ).join('');

    const card = document.createElement('div');
    card.className = `staff-card ${lvl > 0 ? 'staff-card-hired' : ''}`;
    card.innerHTML = `
      <div class="staff-card-top">
        <span class="staff-icon">${role.icon}</span>
        <div class="staff-info">
          <div class="staff-name">${role.label}</div>
          <div class="staff-desc">${role.desc}</div>
          <div class="staff-dots">${dots}</div>
        </div>
      </div>
      <div class="staff-card-bottom">
        ${lvl > 0
          ? `<div class="staff-salary">💸 ${salary.toFixed(1)} монет/мин</div>`
          : `<div class="staff-salary staff-salary-none">Не нанят</div>`}
        <button
          class="staff-hire-btn ${canHire ? 'btn-primary' : ''}"
          data-role="${role.id}"
          ${!canHire && !maxed ? 'disabled' : ''}
        >
          ${maxed ? '✓ МАК' : `Нанять · ${cost} монет`}
        </button>
      </div>`;

    card.querySelector('.staff-hire-btn')?.addEventListener('click', () => {
      if (maxed) return;
      if (hireStaff(role.id)) {
        renderStaffTab();
        renderShopStats(); // обновляем зарплату и потери в шапке
        renderShopFlowPanel();
      }
    });

    gridEl.appendChild(card);
  });
}

function getSelectedCaravanOreType() {
  const el = document.getElementById("caravan-ore-select");
  return el?.value || ORE_COPPER;
}

function buildCaravanOreOptions() {
  const selectEl = document.getElementById("caravan-ore-select");
  if (!selectEl) return;
  const current = selectEl.value || ORE_COPPER;
  selectEl.innerHTML = ORE_ORDER.map((oreType) => {
    const cfg = ORE_CONFIG[oreType];
    const amount = getOreBank(oreType);
    return `<option value="${oreType}">${cfg.label}: ${amount}</option>`;
  }).join("");
  selectEl.value = ORE_ORDER.includes(current) ? current : ORE_COPPER;
}

function bindCaravanRouteButtons() {
  const wrap = document.getElementById("caravans-route-grid");
  if (!wrap) return;
  wrap.querySelectorAll("[data-send-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const routeId = btn.getAttribute("data-send-route");
      const oreType = getSelectedCaravanOreType();
      const sent = sendCaravan(routeId, oreType);
      if (!sent) return;
      renderShopStats();
      renderCaravansTab();
      _onCaravanEvent?.({
        phase: "dispatch",
        ok: true,
        tone: "neutral",
        line: sent.eventLine,
        payout: 0,
        oreAmount: sent.caravan.oreAmount,
        oreType: sent.caravan.oreType,
        spent: sent.caravan.dispatchCost,
      });
    });
  });
}

function bindCaravanUpgradeButtons() {
  const wrap = document.getElementById("caravans-upgrades");
  if (!wrap) return;
  wrap.querySelectorAll("[data-buy-caravan-upg]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const upgId = btn.getAttribute("data-buy-caravan-upg");
      const result = buyCaravanUpgrade(upgId);
      if (!result) return;
      renderShopStats();
      renderCaravansTab();
      _onCaravanEvent?.({
        phase: "upgrade",
        ok: true,
        tone: "good",
        line: result.line,
        payout: 0,
        oreAmount: 0,
        spent: result.cost,
      });
    });
  });
}

function renderCaravanUpgrades(state) {
  const wrap = document.getElementById("caravans-upgrades");
  if (!wrap) return;
  const gold = getGold();
  wrap.innerHTML = CARAVAN_UPGRADES.map((u) => {
    const lvl = state.upgrades?.[u.id] ?? 0;
    const maxed = lvl >= u.maxLevel;
    const cost = maxed ? 0 : u.costs[lvl];
    const canBuy = !maxed && gold >= cost;
    return `
      <div class="caravan-upg-card ${maxed ? "maxed" : ""}">
        <div class="caravan-upg-head">${u.icon} ${u.label}</div>
        <div class="caravan-upg-desc">${u.desc}</div>
        <div class="caravan-upg-meta">Уровень: ${lvl}/${u.maxLevel}${maxed ? " · MAX" : ` · ${cost} монет`}</div>
        <button class="caravan-upg-btn btn-primary" data-buy-caravan-upg="${u.id}" ${canBuy ? "" : "disabled"}>
          ${maxed ? "MAX" : "Купить"}
        </button>
      </div>`;
  }).join("");
  bindCaravanUpgradeButtons();
}

function initCaravanControls() {
  const selectEl = document.getElementById("caravan-ore-select");
  if (!selectEl) return;
  selectEl.addEventListener("change", () => renderCaravansTab());
}

export function renderCaravansTab() {
  const routeWrap = document.getElementById("caravans-route-grid");
  const activeMetaEl = document.getElementById("caravans-active-meta");
  const activeListEl = document.getElementById("caravans-active-list");
  const summaryEl = document.getElementById("caravans-summary");
  if (!routeWrap || !activeMetaEl || !activeListEl || !summaryEl) return;

  buildCaravanOreOptions();
  const selectedOreType = getSelectedCaravanOreType();
  const state = getCaravansState();
  const maxActive = getEffectiveMaxActive(state);
  const successRate = state.stats.runsTotal
    ? Math.round((state.stats.successTotal / state.stats.runsTotal) * 100)
    : 0;

  activeMetaEl.textContent = `Активно: ${state.active.length}/${maxActive}`;
  summaryEl.innerHTML = `
    <div><span>Рейсов:</span><strong>${state.stats.runsTotal}</strong></div>
    <div><span>Успех:</span><strong>${successRate}%</strong></div>
    <div><span>Доход:</span><strong>${state.stats.incomeTotal} монет</strong></div>
    <div><span>Расходы:</span><strong>${state.stats.expensesTotal} монет</strong></div>
    <div><span>Лучший профит:</span><strong>${state.stats.bestProfit} монет</strong></div>
  `;
  renderCaravanUpgrades(state);

  routeWrap.innerHTML = CARAVAN_ROUTES.map((route) => {
    const effective = getEffectiveRoute(route, state);
    const cargo = getMaxSendForRoute(route.id, selectedOreType);
    const canSend = canSendCaravan(route.id, selectedOreType);
    const orePrice = getOrePrice(selectedOreType);
    const expected = Math.round(cargo * orePrice * effective.effectivePriceMult);
    return `
      <div class="caravan-card">
        <div class="caravan-card-head">
          <span class="caravan-icon">${route.icon}</span>
          <span class="caravan-name">${route.label}</span>
        </div>
        <div class="caravan-row"><span>Стоимость отправки</span><strong>${route.dispatchCost} монет</strong></div>
        <div class="caravan-row"><span>Время рейса</span><strong>${route.durationSec}с</strong></div>
        <div class="caravan-row"><span>Груз</span><strong>${cargo}/${effective.effectiveCargo}</strong></div>
        <div class="caravan-row"><span>Риск потери</span><strong>${Math.round(effective.effectiveRisk * 100)}%</strong></div>
        <div class="caravan-row"><span>Ожидаемая выплата</span><strong>${expected} монет</strong></div>
        <button class="caravan-send-btn btn-primary" data-send-route="${route.id}" ${canSend ? "" : "disabled"}>
          Отправить
        </button>
      </div>`;
  }).join("");
  bindCaravanRouteButtons();

  if (!state.active.length) {
    activeListEl.innerHTML = '<div class="guild-empty">Активных караванов нет.</div>';
    return;
  }

  const now = Date.now();
  activeListEl.innerHTML = state.active
    .map((c) => {
      const leftSec = Math.max(0, Math.ceil((c.finishesAt - now) / 1000));
      const oreLabel = ORE_CONFIG[c.oreType]?.label ?? "Руда";
      return `
        <div class="caravan-active-item">
          <div class="caravan-active-title">🚚 ${c.routeId.toUpperCase()} · ${c.oreAmount} ${oreLabel.toLowerCase()}</div>
          <div class="caravan-active-sub">До прибытия: ${leftSec}с</div>
        </div>`;
    })
    .join("");
}

// ─── ЖУРНАЛ СДЕЛОК ────────────────────────────────────────────────────────────

const LOG_MAX = 8;

function addShopLogEntry({ oreType, oreBought, goldEarned }) {
  const logEl = document.getElementById('shop-log');
  if (!logEl) return;

  const empty = logEl.querySelector('.shop-log-empty');
  if (empty) empty.remove();

  const oreLabel   = oreType ? (ORE_CONFIG[oreType]?.label ?? 'руды') : 'руды';
  const oreIconSrc = oreType ? ORE_ICONS[oreType] : '';

  const entry = document.createElement('div');
  entry.className = 'shop-log-entry shop-log-new';
  const time = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-text">Покупатель взял
      ${oreIconSrc ? `<img class="log-ore-icon" src="${oreIconSrc}" draggable="false" alt="">` : ''}
      <span class="ore-color-${oreType ?? 'copper'}">${oreBought} ${oreLabel}</span>
    </span>
    <span class="log-gold gold-color">+${goldEarned} монет</span>`;

  logEl.insertBefore(entry, logEl.firstChild);
  setTimeout(() => entry.classList.remove('shop-log-new'), 600);
  while (logEl.children.length > LOG_MAX) logEl.removeChild(logEl.lastChild);
}
