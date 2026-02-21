// ─── КОНСТАНТЫ ────────────────────────────────────────────────────────────────

export const GRID_SIZE = 15;
export const MAX_HP    = 5; // переопределяется сложностью

export const CELL_HIDDEN   = 'hidden';
export const CELL_OPEN     = 'open';
export const CELL_FLAGGED  = 'flagged';
export const CELL_REVEALED = 'revealed'; // руда обнаружена (сосед открыт), ещё не собрана

export const TYPE_EMPTY    = 'empty';
export const TYPE_ORE      = 'ore';       // общий маркер — используется в логике BFS
export const TYPE_UNSTABLE = 'unstable';

// ─── ТИПЫ РУДЫ ────────────────────────────────────────────────────────────────
//
// Каждая рудная клетка хранит oreType — конкретный вид руды.
// TYPE_ORE остаётся как общий маркер типа ячейки (для BFS и проверок).

export const ORE_COPPER  = 'copper';
export const ORE_SILVER  = 'silver';
export const ORE_GOLD    = 'gold';
export const ORE_DIAMOND = 'diamond';

// Конфигурация видов руды: label, ценность (множитель к baseOrePrice в shop.js)
export const ORE_CONFIG = {
  [ORE_COPPER]:  { label: 'Медная руда',    priceMultiplier: 1,  color: '#d4845a' },
  [ORE_SILVER]:  { label: 'Серебряная руда', priceMultiplier: 3,  color: '#c0c8d8' },
  [ORE_GOLD]:    { label: 'Золотая руда',   priceMultiplier: 8,  color: '#e8c84a' },
  [ORE_DIAMOND]: { label: 'Алмаз',          priceMultiplier: 25, color: '#88eeff' },
};

// ─── СЛОЖНОСТИ ────────────────────────────────────────────────────────────────
//
// oreChances — шансы для каждого вида руды [copper, silver, gold, diamond]
// Сумма не должна превышать (1 - unstableChance)

export const DIFFICULTIES = {
  easy: {
    label:           'Лёгкая',
    unstableChance:  0.08,
    // руды мало, почти всё медь
    oreChances: { [ORE_COPPER]: 0.06, [ORE_SILVER]: 0.01, [ORE_GOLD]: 0.004, [ORE_DIAMOND]: 0.001 },
    startHp:         5,
    hitCollapseMin:  0.08,
    hitCollapseMax:  0.18,
    idleCollapseSec: 90,
    idleCollapseMin: 0.04,
    idleCollapseMax: 0.10,
    escapeOreLoss:   0.15,
  },
  normal: {
    label:           'Средняя',
    unstableChance:  0.16,
    // стандартный баланс
    oreChances: { [ORE_COPPER]: 0.07, [ORE_SILVER]: 0.025, [ORE_GOLD]: 0.010, [ORE_DIAMOND]: 0.003 },
    startHp:         5,
    hitCollapseMin:  0.18,
    hitCollapseMax:  0.32,
    idleCollapseSec: 60,
    idleCollapseMin: 0.10,
    idleCollapseMax: 0.20,
    escapeOreLoss:   0.40,
  },
  hard: {
    label:           'Сложная',
    unstableChance:  0.26,
    // много угроз, зато много ценных руд
    oreChances: { [ORE_COPPER]: 0.04, [ORE_SILVER]: 0.035, [ORE_GOLD]: 0.020, [ORE_DIAMOND]: 0.010 },
    startHp:         3,
    hitCollapseMin:  0.28,
    hitCollapseMax:  0.48,
    idleCollapseSec: 30,
    idleCollapseMin: 0.18,
    idleCollapseMax: 0.33,
    escapeOreLoss:   0.80,
  },
};

// Суммарная вероятность появления любой руды для diff
export function totalOreChance(diff) {
  return Object.values(diff.oreChances).reduce((s, v) => s + v, 0);
}

// ─── ГЕНЕРАЦИЯ КЛЕТКИ ─────────────────────────────────────────────────────────

export function randomOreType(oreChances) {
  const r = Math.random();
  let acc = 0;
  for (const [oreType, chance] of Object.entries(oreChances)) {
    acc += chance;
    if (r < acc) return oreType;
  }
  return ORE_COPPER; // fallback
}

export function randomCellType(diff) {
  const r = Math.random();
  if (r < diff.unstableChance) return { type: TYPE_UNSTABLE, oreType: null };
  const total = totalOreChance(diff);
  if (r < diff.unstableChance + total) {
    return { type: TYPE_ORE, oreType: randomOreType(diff.oreChances) };
  }
  return { type: TYPE_EMPTY, oreType: null };
}

export function buildGrid(diff) {
  const grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const { type, oreType } = randomCellType(diff);
      row.push({
        type,
        oreType,          // null для non-ore, ORE_* для руды
        state:            CELL_HIDDEN,
        neighborUnstable: 0,
      });
    }
    grid.push(row);
  }
  computeNeighborCounts(grid);
  return grid;
}

export function computeNeighborCounts(grid) {
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      grid[r][c].neighborUnstable = countUnstableNeighbors(grid, r, c);
}

export function getNeighbors(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE)
        out.push([nr, nc]);
    }
  return out;
}

export function countUnstableNeighbors(grid, r, c) {
  return getNeighbors(r, c).filter(([nr, nc]) => grid[nr][nc].type === TYPE_UNSTABLE).length;
}

// ─── СОСТОЯНИЕ ИГРЫ ───────────────────────────────────────────────────────────

export function createGameState(diffKey, diffOverrides = null) {
  const baseDiff = DIFFICULTIES[diffKey];
  const diff = {
    ...baseDiff,
    ...(diffOverrides ?? {}),
    oreChances: {
      ...baseDiff.oreChances,
      ...(diffOverrides?.oreChances ?? {}),
    },
  };
  const grid = buildGrid(diff);
  openStartCells(grid);
  return {
    grid,
    diff,
    diffKey,
    hp:               diff.startHp,
    // Руда по каждому типу за эту вылазку
    ores: {
      [ORE_COPPER]:  0,
      [ORE_SILVER]:  0,
      [ORE_GOLD]:    0,
      [ORE_DIAMOND]: 0,
    },
    // Итого руды (любой) — для обратной совместимости HUD
    get ore() { return Object.values(this.ores).reduce((s, v) => s + v, 0); },
    startTime:        Date.now(),
    elapsedSeconds:   0,
    ended:            false,
    endReason:        null,        // 'death' | 'escape' | 'clear'
    lastActionTime:   Date.now(),
  };
}

// ─── СТАРТОВЫЕ КЛЕТКИ ─────────────────────────────────────────────────────────

function openStartCells(grid) {
  const midCol = Math.floor(GRID_SIZE / 2);
  const cols   = [midCol - 1, midCol, midCol + 1];
  const rows   = [GRID_SIZE - 1, GRID_SIZE - 2];

  for (const r of rows) {
    for (const c of cols) {
      const cell = grid[r][c];
      cell.type    = TYPE_EMPTY;
      cell.oreType = null;
      cell.state   = CELL_OPEN;
    }
  }
  computeNeighborCounts(grid);
  revealAdjacentOre(grid);
}

// ─── ОТКРЫТИЕ КЛЕТКИ ──────────────────────────────────────────────────────────

export function openCell(state, r, c) {
  const cell = state.grid[r][c];
  if (cell.state === CELL_OPEN || cell.state === CELL_FLAGGED) return null;

  state.lastActionTime = Date.now();

  // Удар по нестабильной породе
  if (cell.type === TYPE_UNSTABLE) {
    cell.state = CELL_OPEN;
    state.hp  -= 1;
    const hitCollapse = triggerHitCollapse(state);
    return { changed: [{ r, c }], hitCollapse };
  }

  // Прямой клик по обнаруженной руде — собираем её
  if (cell.type === TYPE_ORE && cell.state === CELL_REVEALED) {
    const oreType = cell.oreType ?? ORE_COPPER;
    cell.type    = TYPE_EMPTY;
    cell.oreType = null;
    cell.state   = CELL_OPEN;
    state.ores[oreType] = (state.ores[oreType] ?? 0) + 1;
    computeNeighborCounts(state.grid);
    const changed = [{ r, c }];
    for (const [nr, nc] of getNeighbors(r, c)) {
      if (state.grid[nr][nc].state === CELL_OPEN) changed.push({ r: nr, c: nc });
    }
    const newRevealed = revealAdjacentOre(state.grid);
    return { changed: [...changed, ...newRevealed], hitCollapse: null, collectedOreType: oreType };
  }

  // Клик по скрытой руде — сразу собираем (раскопал и подобрал за один удар)
  if (cell.type === TYPE_ORE && cell.state === CELL_HIDDEN) {
    const oreType = cell.oreType ?? ORE_COPPER;
    cell.type    = TYPE_EMPTY;
    cell.oreType = null;
    cell.state   = CELL_OPEN;
    state.ores[oreType] = (state.ores[oreType] ?? 0) + 1;
    computeNeighborCounts(state.grid);
    const changed = [{ r, c }];
    for (const [nr, nc] of getNeighbors(r, c)) {
      if (state.grid[nr][nc].state === CELL_OPEN) changed.push({ r: nr, c: nc });
    }
    const newRevealed = revealAdjacentOre(state.grid);
    return { changed: [...changed, ...newRevealed], hitCollapse: null, collectedOreType: oreType };
  }

  // BFS flood-fill для пустых клеток
  const changed = [];
  const queue   = [[r, c]];
  const visited = new Set([`${r},${c}`]);

  while (queue.length > 0) {
    const [cr, cc] = queue.shift();
    const cur = state.grid[cr][cc];
    if (cur.state === CELL_OPEN || cur.state === CELL_FLAGGED || cur.state === CELL_REVEALED) continue;
    if (cur.type === TYPE_UNSTABLE || cur.type === TYPE_ORE) continue;

    cur.state = CELL_OPEN;
    changed.push({ r: cr, c: cc });

    if (cur.neighborUnstable === 0) {
      for (const [nr, nc] of getNeighbors(cr, cc)) {
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          visited.add(key);
          const nb = state.grid[nr][nc];
          if (nb.state !== CELL_OPEN && nb.state !== CELL_FLAGGED && nb.state !== CELL_REVEALED
              && nb.type !== TYPE_UNSTABLE && nb.type !== TYPE_ORE)
            queue.push([nr, nc]);
        }
      }
    }
  }

  const newRevealed = revealAdjacentOre(state.grid);
  return { changed: [...changed, ...newRevealed], hitCollapse: null };
}

// ─── ОБНАРУЖЕНИЕ РУДЫ ─────────────────────────────────────────────────────────

export function revealAdjacentOre(grid) {
  const changed = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = grid[r][c];
      if (cell.type !== TYPE_ORE) continue;
      if (cell.state === CELL_OPEN || cell.state === CELL_FLAGGED) continue;

      const hasOpenNeighbor = getNeighbors(r, c).some(
        ([nr, nc]) => grid[nr][nc].state === CELL_OPEN
      );

      if (hasOpenNeighbor && cell.state === CELL_HIDDEN) {
        cell.state = CELL_REVEALED;
        changed.push({ r, c });
      } else if (!hasOpenNeighbor && cell.state === CELL_REVEALED) {
        cell.state = CELL_HIDDEN;
        changed.push({ r, c });
      }
    }
  }
  return changed;
}

// ─── ФЛАГ ─────────────────────────────────────────────────────────────────────

export function toggleFlag(state, r, c) {
  const cell = state.grid[r][c];
  if (cell.state === CELL_OPEN) return null;
  state.lastActionTime = Date.now();
  if (cell.state === CELL_HIDDEN || cell.state === CELL_REVEALED) {
    cell.state = CELL_FLAGGED;
  } else {
    cell.state = CELL_HIDDEN;
    if (cell.type === TYPE_ORE) {
      const hasOpen = getNeighbors(r, c).some(
        ([nr, nc]) => state.grid[nr][nc].state === CELL_OPEN
      );
      if (hasOpen) cell.state = CELL_REVEALED;
    }
  }
  return { r, c };
}

// ─── ОБВАЛ ПРИ УДАРЕ ──────────────────────────────────────────────────────────

export function triggerHitCollapse(state) {
  return _doCollapse(state, state.diff.hitCollapseMin, state.diff.hitCollapseMax);
}

// ─── ОБВАЛ ПРИ БЕЗДЕЙСТВИИ ────────────────────────────────────────────────────

export function triggerIdleCollapse(state) {
  return _doCollapse(state, state.diff.idleCollapseMin, state.diff.idleCollapseMax);
}

// ─── ВНУТРЕННИЙ ОБВАЛ ─────────────────────────────────────────────────────────

function _doCollapse(state, rateMin, rateMax) {
  const openCells = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = state.grid[r][c];
      if (cell.state === CELL_OPEN && cell.type !== TYPE_UNSTABLE)
        openCells.push([r, c]);
    }

  if (openCells.length === 0) return [];

  const rate  = rateMin + Math.random() * (rateMax - rateMin);
  const count = Math.max(1, Math.round(openCells.length * rate));
  shuffle(openCells);
  const collapsed = openCells.slice(0, count);

  for (const [r, c] of collapsed) {
    const cell      = state.grid[r][c];
    const { type, oreType } = randomCellType(state.diff);
    cell.state   = CELL_HIDDEN;
    cell.type    = type;
    cell.oreType = oreType;
  }
  computeNeighborCounts(state.grid);

  const oreChanges = revealAdjacentOre(state.grid);

  const toRedraw = new Set(collapsed.map(([r, c]) => `${r},${c}`));
  for (const [r, c] of collapsed) {
    for (const [nr, nc] of getNeighbors(r, c)) {
      const nb = state.grid[nr][nc];
      if (nb.state === CELL_OPEN || nb.state === CELL_REVEALED) toRedraw.add(`${nr},${nc}`);
    }
  }
  for (const { r, c } of oreChanges) toRedraw.add(`${r},${c}`);

  return Array.from(toRedraw).map(key => {
    const [r, c] = key.split(',').map(Number);
    return { r, c };
  });
}

// ─── ДОСРОЧНЫЙ ВЫХОД ──────────────────────────────────────────────────────────

export function escapeRun(state) {
  const lossFraction = state.diff.escapeOreLoss;
  // Каждый тип руды теряем пропорционально
  const kept = {};
  const lost = {};
  for (const oreType of Object.keys(state.ores)) {
    const total = state.ores[oreType];
    const lostAmt = Math.round(total * lossFraction);
    lost[oreType] = lostAmt;
    kept[oreType] = total - lostAmt;
    state.ores[oreType] = kept[oreType];
  }
  state.ended = true;
  state.endReason = 'escape';
  const totalKept = Object.values(kept).reduce((s, v) => s + v, 0);
  const totalLost = Object.values(lost).reduce((s, v) => s + v, 0);
  return { kept, lost, totalKept, totalLost };
}

// ─── ПРОВЕРКА ПОБЕДЫ ──────────────────────────────────────────────────────────

export function checkVictory(state) {
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = state.grid[r][c];
      if (cell.type !== TYPE_UNSTABLE && cell.state !== CELL_OPEN) return false;
    }
  return true;
}

// ─── УТИЛИТЫ ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
