import {
  PICKAXES,
  RARITY_ORDER,
  RARITY_LABEL,
  RARITY_CLASS,
  formatEffects,
  getInventory,
  getEquippedPickaxeId,
  getShards,
  getPickaxeLevel,
  getMaxLevel,
  getUpgradeCost,
  upgradePickaxe,
  getScaledEffects,
} from "./pickaxe-gacha.js";

/* ── State ──────────────────────────────────────────── */

let _onStateChanged = null;

/* ── Build ──────────────────────────────────────────── */

export function buildForgeScreen() {
  return `
  <div id="screen-forge" class="screen">

    <nav class="gacha-topbar">
      <div class="gacha-topbar-brand">
        <span class="gacha-topbar-emoji">🔨</span>
        <span class="gacha-topbar-title">Кузница кирок</span>
      </div>
      <div class="gacha-topbar-stats">
        <div class="resource-chip">
          <span class="resource-dot" style="background:#60a5fa;box-shadow:0 0 6px rgba(96,165,250,0.5)"></span>
          <span class="resource-val" id="forge-shards">0</span>
          <span class="resource-label">осколков</span>
        </div>
      </div>
      <button class="topbar-btn" id="forge-back">← Меню</button>
    </nav>

    <div class="gacha-content">
      <div class="gacha-layout">

        <div class="card forge-info-card">
          <div class="card-header">
            <span class="card-header-icon">💎</span>
            <span class="card-header-text">Осколки</span>
          </div>
          <div class="card-body">
            <p class="forge-info-text">
              Дубликаты кирок из гачи автоматически разбираются в осколки.
              Трать осколки, чтобы повышать уровень своих кирок и усиливать их эффекты.
              Каждый уровень усиливает все бонусы кирки на 20%.
            </p>
          </div>
        </div>

        <div class="card forge-list-card">
          <div class="card-header">
            <span class="card-header-icon">⛏</span>
            <span class="card-header-text">Ваши кирки</span>
          </div>
          <div class="card-body">
            <div class="forge-pickaxe-list" id="forge-pickaxe-list"></div>
          </div>
        </div>

      </div>
    </div>

  </div>`;
}

/* ── Init ───────────────────────────────────────────── */

export function initForgeScreen({ onBack, onStateChanged }) {
  _onStateChanged = onStateChanged;
  const backBtn = document.getElementById("forge-back");
  backBtn?.addEventListener("click", () => {
    if (typeof onBack === "function") onBack();
  });
}

/* ── Render ─────────────────────────────────────────── */

export function renderForgeScreen() {
  const shardsEl = document.getElementById("forge-shards");
  const listEl = document.getElementById("forge-pickaxe-list");
  if (!shardsEl || !listEl) return;

  shardsEl.textContent = String(getShards());

  const inv = getInventory();
  const owned = PICKAXES
    .filter((p) => (Number(inv[p.id]) || 0) > 0)
    .sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0));

  if (!owned.length) {
    listEl.innerHTML = `<div class="forge-empty">Нет кирок для улучшения. Получите кирки через гачу.</div>`;
    return;
  }

  const equippedId = getEquippedPickaxeId();
  const shards = getShards();

  listEl.innerHTML = owned
    .map((p) => {
      const level = getPickaxeLevel(p.id);
      const maxLvl = getMaxLevel(p.rarity);
      const atMax = level >= maxLvl;
      const cost = atMax ? 0 : getUpgradeCost(p.rarity, level);
      const canAfford = !atMax && shards >= cost;
      const isEquipped = p.id === equippedId;
      const hasEffects = Object.keys(p.effects).length > 0;
      const fx = hasEffects
        ? formatEffects(getScaledEffects(p.effects, level))
        : "Без эффектов";
      const pct = maxLvl > 1
        ? Math.round(((level - 1) / (maxLvl - 1)) * 100)
        : 100;

      return `
      <div class="forge-pickaxe-card ${RARITY_CLASS[p.rarity]} ${isEquipped ? "active" : ""}">
        <div class="forge-pickaxe-head">
          <div class="forge-pickaxe-name">${p.name}${isEquipped ? " ✓" : ""}</div>
          <div class="forge-pickaxe-rarity ${RARITY_CLASS[p.rarity]}">${RARITY_LABEL[p.rarity]}</div>
        </div>
        <div class="forge-pickaxe-level-row">
          <span class="forge-level-text">Ур. ${level} / ${maxLvl}</span>
          <div class="forge-level-bar">
            <div class="forge-level-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="forge-pickaxe-effects ${hasEffects ? "" : "forge-no-effects"}">${fx}</div>
        <div class="forge-pickaxe-action">
          ${atMax
            ? `<span class="forge-max-label">Макс. уровень</span>`
            : `<button class="btn-primary forge-upgrade-btn ${canAfford ? "" : "disabled"}"
                      data-forge-id="${p.id}" ${canAfford ? "" : "disabled"}>
                Улучшить (${cost} ос.)
              </button>`
          }
        </div>
      </div>`;
    })
    .join("");

  /* Attach upgrade click handlers */
  listEl.querySelectorAll("[data-forge-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-forge-id");
      if (!id) return;
      const ok = upgradePickaxe(id);
      if (!ok) return;
      renderForgeScreen();
      if (typeof _onStateChanged === "function") _onStateChanged();
    });
  });
}
