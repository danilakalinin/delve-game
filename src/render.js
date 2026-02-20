import {
  GRID_SIZE,
  CELL_HIDDEN, CELL_OPEN, CELL_FLAGGED, CELL_REVEALED,
  TYPE_UNSTABLE, TYPE_ORE,
  ORE_COPPER, ORE_SILVER, ORE_GOLD, ORE_DIAMOND,
} from './game.js';
import rocksUrl       from './icons/rocks.png';
import copperOreUrl   from './icons/copper-ore.png';
import silverOreUrl   from './icons/silver-ore.png';
import goldOreUrl     from './icons/gold-ore.png';
import diamondOreUrl  from './icons/diamond-ore.png';

// Карта oreType → иконка
const ORE_ICONS = {
  [ORE_COPPER]:  copperOreUrl,
  [ORE_SILVER]:  silverOreUrl,
  [ORE_GOLD]:    goldOreUrl,
  [ORE_DIAMOND]: diamondOreUrl,
};

// ─── CELL DISPLAY ─────────────────────────────────────────────────────────────

function applyCell(el, cell) {
  el.className   = getCellClasses(cell);
  el.innerHTML   = '';
  el.textContent = '';

  // Скрытая клетка — обычная порода
  if (cell.state === CELL_HIDDEN) {
    const img = document.createElement('img');
    img.src       = rocksUrl;
    img.className = 'cell-rock-icon';
    img.draggable = false;
    el.appendChild(img);
    return;
  }

  // Руда обнаружена — показываем иконку нужного типа
  if (cell.state === CELL_REVEALED) {
    const img = document.createElement('img');
    img.src       = ORE_ICONS[cell.oreType] ?? copperOreUrl;
    img.className = 'cell-ore-icon';
    img.draggable = false;
    el.appendChild(img);
    return;
  }

  if (cell.state === CELL_FLAGGED) {
    el.textContent = '!';
    return;
  }

  // OPEN
  if (cell.type === TYPE_UNSTABLE) { el.textContent = '*'; return; }

  const n = cell.neighborUnstable;
  if (n > 0) el.textContent = String(n);
}

export function getCellClasses(cell) {
  const classes = ['cell'];

  if (cell.state === CELL_REVEALED) {
    classes.push('ore-revealed');
    // Добавляем класс конкретного типа руды для CSS-окраски фона
    if (cell.oreType) classes.push(`ore-${cell.oreType}`);
  } else if (cell.state === CELL_OPEN) {
    classes.push('open');
    if (cell.type === TYPE_UNSTABLE) {
      classes.push('unstable-open');
    } else {
      const n = cell.neighborUnstable;
      if (n >= 1 && n <= 4) classes.push(`n${n}`);
    }
  } else if (cell.state === CELL_FLAGGED) {
    classes.push('flagged');
  }

  return classes.join(' ');
}

// ─── GRID RENDER ──────────────────────────────────────────────────────────────

export function renderGrid(grid, gridEl) {
  gridEl.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = grid[r][c];
      const el   = document.createElement('div');
      el.dataset.r = r;
      el.dataset.c = c;
      applyCell(el, cell);
      gridEl.appendChild(el);
    }
  }
}

export function updateCells(grid, gridEl, cells) {
  for (const { r, c } of cells) {
    const idx = r * GRID_SIZE + c;
    const el  = gridEl.children[idx];
    if (!el) continue;
    applyCell(el, grid[r][c]);
  }
}

export function flashCollapse(grid, gridEl, cells) {
  for (const { r, c } of cells) {
    const cell = grid[r][c];
    if (cell.state !== CELL_HIDDEN && cell.state !== CELL_REVEALED) continue;
    const idx = r * GRID_SIZE + c;
    const el  = gridEl.children[idx];
    if (!el) continue;
    el.classList.add('collapsing');
    el.addEventListener('animationend', () => {
      el.classList.remove('collapsing');
      applyCell(el, grid[r][c]);
    }, { once: true });
  }
}
