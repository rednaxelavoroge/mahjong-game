import Phaser from 'phaser';
import { LevelConfig } from './layouts';

export interface Tile {
  id: number;
  x: number;
  y: number;
  z: number;
  kind: string;
  category: 'nature' | 'dragon' | 'wind' | 'bamboo' | 'symbol';
  color: string;
  sprite?: Phaser.GameObjects.Container;
  selected?: boolean;
  removed?: boolean;
  isGold?: boolean;
}

export interface TileSymbolDef {
  char: string;
  category: 'nature' | 'dragon' | 'wind' | 'bamboo' | 'symbol';
  color: string;
}

export const TILE_SYMBOLS: TileSymbolDef[] = [
  // Драконы (классика маджонга)
  { char: '🀄', category: 'dragon', color: '#dc2626' }, // Красный дракон (Хунчжун)
  { char: '🀅', category: 'dragon', color: '#15803d' }, // Зеленый дракон (Фацай)
  { char: '🀆', category: 'dragon', color: '#0284c7' }, // Белый дракон (Байбань)
  { char: '☯', category: 'dragon', color: '#0f766e' }, // Инь-Ян
  { char: '❂', category: 'dragon', color: '#b45309' }, // Императорское Солнце

  // Иероглифы (Масть 萬 Wan - как в Vita Mahjong)
  { char: '一萬', category: 'symbol', color: '#b91c1c' }, // 1 Wan
  { char: '二萬', category: 'symbol', color: '#b91c1c' }, // 2 Wan
  { char: '三萬', category: 'symbol', color: '#b91c1c' }, // 3 Wan
  { char: '五萬', category: 'symbol', color: '#b91c1c' }, // 5 Wan
  { char: '八萬', category: 'symbol', color: '#b91c1c' }, // 8 Wan
  { char: '九萬', category: 'symbol', color: '#b91c1c' }, // 9 Wan

  // Цветы и сезоны (Традиционный маджонг)
  { char: '✿', category: 'nature', color: '#16a34a' }, // Лотос
  { char: '☘', category: 'nature', color: '#15803d' }, // Клевер удачи
  { char: '❀', category: 'nature', color: '#db2777' }, // Цветущая сакура
  { char: '❁', category: 'nature', color: '#0d9488' }, // Орхидея
  { char: '❃', category: 'nature', color: '#059669' }, // Бамбук

  // Ветра и звезды
  { char: '☀', category: 'wind', color: '#d97706' }, // Восток (Солнце)
  { char: '☾', category: 'wind', color: '#4f46e5' }, // Запад (Луна)
  { char: '★', category: 'wind', color: '#eab308' }, // Северная Звезда
  { char: '✦', category: 'wind', color: '#0284c7' }, // Полярное Сияние
  { char: '❖', category: 'wind', color: '#7c3aed' }, // Ветер Юга
];

/**
 * Checks if a tile is free according to traditional Mahjong Solitaire rules:
 * 1. No tile is directly on top of it.
 * 2. It has at least one lateral (left or right) side open.
 */
export function isFree(tile: Tile, all: Tile[], stepX: number, stepY: number): boolean {
  if (tile.removed) return false;

  // 1. Check tile directly above
  const above = all.some(
    other =>
      !other.removed &&
      other.z > tile.z &&
      other.z <= tile.z + 1 &&
      Math.abs(other.x - tile.x) < stepX * 0.88 &&
      Math.abs(other.y - tile.y) < stepY * 0.88
  );
  if (above) return false;

  // 2. Check lateral blocks (left and right) on the same layer
  const leftBlocked = all.some(
    other =>
      !other.removed &&
      other.z === tile.z &&
      other.id !== tile.id &&
      Math.abs(other.y - tile.y) < stepY * 0.82 &&
      other.x < tile.x &&
      tile.x - other.x < stepX * 1.05
  );

  const rightBlocked = all.some(
    other =>
      !other.removed &&
      other.z === tile.z &&
      other.id !== tile.id &&
      Math.abs(other.y - tile.y) < stepY * 0.82 &&
      other.x > tile.x &&
      other.x - tile.x < stepX * 1.05
  );

  return !leftBlocked || !rightBlocked;
}

/**
 * Generates a layout where a winning path is mathematically guaranteed.
 * Removes simulated free tiles step-by-step and assigns pairs in reverse order.
 */
export function generateGuaranteedLevel(config: LevelConfig): Tile[] {
  const raw = config.build();
  let id = 0;
  const base: Tile[] = raw.map(p => ({
    id: id++,
    x: p.x,
    y: p.y,
    z: p.z,
    kind: '',
    category: 'nature',
    color: '#15803d',
  }));

  const remaining = [...base];
  const order: Tile[] = [];

  while (remaining.length > 0) {
    const freeTiles = remaining.filter(t => isFree(t, remaining, config.stepX, config.stepY));
    const choice = freeTiles[Math.floor(Math.random() * freeTiles.length)] ?? remaining[remaining.length - 1];
    order.push(choice);
    const idx = remaining.findIndex(t => t.id === choice.id);
    if (idx !== -1) remaining.splice(idx, 1);
  }

  // Assign symbols in pairs along the guaranteed reverse-solution order
  // Designate one pair in the mid-game as special Gold Jackpot Tiles!
  const goldPairIndex = Math.min(2, Math.floor(order.length / 4) * 2);

  for (let i = 0; i < order.length; i += 2) {
    if (i === goldPairIndex) {
      order[i].kind = '🪙';
      order[i].category = 'symbol';
      order[i].color = '#eab308';
      order[i].isGold = true;

      if (i + 1 < order.length) {
        order[i + 1].kind = '🪙';
        order[i + 1].category = 'symbol';
        order[i + 1].color = '#eab308';
        order[i + 1].isGold = true;
      }
    } else {
      const symbolDef = TILE_SYMBOLS[(i / 2) % TILE_SYMBOLS.length];
      order[i].kind = symbolDef.char;
      order[i].category = symbolDef.category;
      order[i].color = symbolDef.color;

      if (i + 1 < order.length) {
        order[i + 1].kind = symbolDef.char;
        order[i + 1].category = symbolDef.category;
        order[i + 1].color = symbolDef.color;
      }
    }
  }

  return base;
}

/**
 * Finds at least one pair of matching free tiles for the Hint function
 */
export function findOpenPair(tiles: Tile[], stepX: number, stepY: number): [Tile, Tile] | null {
  const free = tiles.filter(t => !t.removed && isFree(t, tiles, stepX, stepY));
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (free[i].kind === free[j].kind) {
        return [free[i], free[j]];
      }
    }
  }
  return null;
}

/**
 * Reshuffles unremoved tiles on the board, ensuring that at least one pair is immediately free!
 */
export function smartShuffleRemaining(tiles: Tile[], stepX: number, stepY: number): boolean {
  const unremoved = tiles.filter(t => !t.removed);
  if (unremoved.length < 2) return false;

  // Extract all existing symbol definitions
  const pool = unremoved.map(t => ({
    kind: t.kind,
    category: t.category,
    color: t.color,
  }));

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Assign back
  unremoved.forEach((t, i) => {
    t.kind = pool[i].kind;
    t.category = pool[i].category;
    t.color = pool[i].color;
  });

  // Verify that at least one matching pair is currently free
  let pair = findOpenPair(tiles, stepX, stepY);
  if (!pair) {
    // Force a free pair: pick 2 free tiles and synchronize their kind
    const freeTiles = unremoved.filter(t => isFree(t, tiles, stepX, stepY));
    if (freeTiles.length >= 2) {
      const tileA = freeTiles[0];
      const tileB = freeTiles[1];

      // Find another tile in unremoved with tileA's kind to swap with tileB
      const matchForA = unremoved.find(t => t.id !== tileA.id && t.kind === tileA.kind);
      if (matchForA && matchForA.id !== tileB.id) {
        // Swap kinds of matchForA and tileB
        const oldBKind = tileB.kind;
        const oldBCat = tileB.category;
        const oldBCol = tileB.color;

        tileB.kind = matchForA.kind;
        tileB.category = matchForA.category;
        tileB.color = matchForA.color;

        matchForA.kind = oldBKind;
        matchForA.category = oldBCat;
        matchForA.color = oldBCol;
      }
    }
  }

  return true;
}
