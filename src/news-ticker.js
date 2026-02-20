// ═══════════════════════════════════════════════════════════════════════════
// news-ticker.js — Бегущая строка в главном меню
//
// Ответственность:
//   - Создать DOM-элемент бегущей строки
//   - Периодически менять текст (каждые ~20с)
//   - Получать контекст из main.js для выбора цитаты
// ═══════════════════════════════════════════════════════════════════════════

import { pickHeadline } from './news.js';

const ROTATE_INTERVAL_MS = 22000; // менять заголовок каждые 22 секунды

let _tickerEl    = null;
let _innerEl     = null;
let _rotateTimer = null;
let _getCtx      = null;  // функция () => { ore, gold, adsLevel, shopOpen }

// ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────────────────────

/**
 * Создаёт и возвращает DOM-элемент тикера.
 * @param {() => { ore, gold, adsLevel, shopOpen }} getCtxFn
 */
export function createTicker(getCtxFn) {
  _getCtx = getCtxFn;

  _tickerEl = document.createElement('div');
  _tickerEl.className = 'news-ticker';

  const label = document.createElement('span');
  label.className = 'news-ticker-label';
  label.textContent = '📰 ВЕСТНИК';

  _innerEl = document.createElement('div');
  _innerEl.className = 'news-ticker-inner';

  const track = document.createElement('div');
  track.className = 'news-ticker-track';
  _innerEl.appendChild(track);

  _tickerEl.appendChild(label);
  _tickerEl.appendChild(_innerEl);

  _setHeadline(track);

  _rotateTimer = setInterval(() => {
    _fadeTo(track);
  }, ROTATE_INTERVAL_MS);

  return _tickerEl;
}

/** Останавливает ротацию (при смене экрана) */
export function destroyTicker() {
  clearInterval(_rotateTimer);
  _rotateTimer = null;
}

// ─── ВНУТРЕННИЕ ФУНКЦИИ ───────────────────────────────────────────────────────

function _setHeadline(track) {
  const ctx  = _getCtx ? _getCtx() : { ore: 0, gold: 0, adsLevel: 0, shopOpen: false };
  track.textContent = pickHeadline(ctx);
}

function _fadeTo(track) {
  track.classList.add('ticker-fade-out');
  setTimeout(() => {
    _setHeadline(track);
    track.classList.remove('ticker-fade-out');
    track.classList.add('ticker-fade-in');
    setTimeout(() => track.classList.remove('ticker-fade-in'), 600);
  }, 400);
}
