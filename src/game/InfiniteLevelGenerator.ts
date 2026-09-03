import { RawTilePos, LevelConfig } from './layouts';

function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHAPTER_NAMES = [
  'Бамбуковая Долина',
  'Нефритовый Павильон',
  'Храм Белого Лотоса',
  'Золотой Дворец',
  'Пик Дракона',
  'Сад Цветущей Сакуры',
  'Обитель Горного Ветра',
  'Янтарные Чертоги',
  'Врата Небесного Озера',
  'Императорская Сокровищница',
  'Лунная Терраса',
  'Оазис Спокойствия',
  'Гряда Феникса',
  'Заповедный Лес',
  'Заоблачный Предел',
];

const ARCHETYPE_NAMES = [
  'Черепаха',
  'Пирамида',
  'Крест Стихий',
  'Крепость',
  'Цветок Лотоса',
  'Хребет Дракона',
  'Врата Храма',
  'Звезда Востока',
];

/**
 * Procedural Infinite Level Generator tuned for LARGE, LUXURY CHUNKY TILES
 * Maximum 5 columns wide to ensure cards fill the screen comfortably and are crystal clear.
 */
export class InfiniteLevelGenerator {
  public static getLevelConfig(levelNum: number): LevelConfig {
    const prng = mulberry32(levelNum * 7919 + 1337);

    const chapterIndex = Math.floor((levelNum - 1) / 10);
    const chapterName = CHAPTER_NAMES[chapterIndex % CHAPTER_NAMES.length];
    const levelInChapter = ((levelNum - 1) % 10) + 1;

    const archetypeIndex = Math.floor(prng() * ARCHETYPE_NAMES.length);
    const archetypeName = ARCHETYPE_NAMES[archetypeIndex];

    // Large, comfortable spacing for 60x80px tiles
    const stepX = 64;
    const stepY = 70;

    const timeLimit = Math.min(360, 120 + Math.floor(levelNum / 5) * 15);

    return {
      id: levelNum,
      name: archetypeName.toUpperCase(),
      subname: `Уровень ${levelNum} • Глава ${chapterIndex + 1}: ${chapterName} (${levelInChapter}/10)`,
      stepX,
      stepY,
      timeLimit,
      build: () => this.buildProceduralLayout(levelNum, archetypeIndex, prng, stepX, stepY),
    };
  }

  private static buildProceduralLayout(
    levelNum: number,
    archetypeIndex: number,
    prng: () => number,
    stepX: number,
    stepY: number
  ): RawTilePos[] {
    const list: RawTilePos[] = [];

    // Target pair counts (between 16 and 26 pairs = 32 to 52 large tiles)
    let targetPairs = 16; // 32 tiles base
    if (levelNum > 2) targetPairs = 18; // 36 tiles
    if (levelNum > 6) targetPairs = 20; // 40 tiles
    if (levelNum > 14) targetPairs = 22; // 44 tiles
    if (levelNum > 25) targetPairs = 24 + Math.floor(prng() * 2); // 48-50 tiles

    const totalTiles = targetPairs * 2;

    switch (archetypeIndex) {
      // 0: Черепаха (Turtle) - 5x4 base + 3x2 mid + 2x1 crown
      case 0: {
        // Base: 5 cols x 4 rows = 20
        for (let r = -1.5; r <= 1.5; r++) {
          for (let c = -2; c <= 2; c++) {
            list.push({ x: c * stepX, y: r * stepY, z: 0 });
          }
        }
        // Middle layer: 3 cols x 3 rows = 9
        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c++) {
            list.push({ x: c * stepX, y: r * stepY, z: 1 });
          }
        }
        // Top crown: 2x2 = 4
        list.push({ x: -0.5 * stepX, y: -0.5 * stepY, z: 2 });
        list.push({ x: 0.5 * stepX, y: -0.5 * stepY, z: 2 });
        list.push({ x: -0.5 * stepX, y: 0.5 * stepY, z: 2 });
        list.push({ x: 0.5 * stepX, y: 0.5 * stepY, z: 2 });

        // Peak = 1
        list.push({ x: 0, y: 0, z: 3 });
        break;
      }

      // 1: Пирамида (Pyramid) - Stepped concentric tiers
      case 1: {
        // Tier 0: 5 cols x 5 rows notched corners = 21
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (Math.abs(r) === 2 && Math.abs(c) === 2) continue;
            list.push({ x: c * stepX, y: r * stepY, z: 0 });
          }
        }
        // Tier 1: 3x3 = 9
        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c++) {
            list.push({ x: c * stepX, y: r * stepY, z: 1 });
          }
        }
        // Tier 2: 2x2 = 4
        list.push({ x: -0.5 * stepX, y: -0.5 * stepY, z: 2 });
        list.push({ x: 0.5 * stepX, y: -0.5 * stepY, z: 2 });
        list.push({ x: -0.5 * stepX, y: 0.5 * stepY, z: 2 });
        list.push({ x: 0.5 * stepX, y: 0.5 * stepY, z: 2 });
        // Peak
        list.push({ x: 0, y: 0, z: 3 });
        list.push({ x: 0, y: 0, z: 4 });
        break;
      }

      // 2: Крест Стихий (Cross & Diamond)
      case 2: {
        // Vertical column (3 cols x 5 rows)
        for (let r = -2; r <= 2; r++) {
          list.push({ x: 0, y: r * stepY, z: 0 });
          list.push({ x: -1 * stepX, y: r * stepY, z: 0 });
          list.push({ x: 1 * stepX, y: r * stepY, z: 0 });
        }
        // Horizontal wings
        list.push({ x: -2 * stepX, y: 0, z: 0 });
        list.push({ x: 2 * stepX, y: 0, z: 0 });
        list.push({ x: -2 * stepX, y: -1 * stepY, z: 0 });
        list.push({ x: 2 * stepX, y: -1 * stepY, z: 0 });

        // Layer 1 cross
        for (let r = -1; r <= 1; r++) {
          list.push({ x: 0, y: r * stepY, z: 1 });
        }
        list.push({ x: -1 * stepX, y: 0, z: 1 });
        list.push({ x: 1 * stepX, y: 0, z: 1 });

        // Layer 2
        list.push({ x: 0, y: 0, z: 2 });
        list.push({ x: 0, y: -0.5 * stepY, z: 2 });
        break;
      }

      // 3: Крепость (Fortress)
      case 3: {
        // Outer ring 4x5
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (Math.abs(r) < 2 && Math.abs(c) < 2) continue; // hollow courtyard
            list.push({ x: c * stepX, y: r * stepY, z: 0 });
          }
        }
        // Inner courtyard elevated
        list.push({ x: -0.5 * stepX, y: -0.5 * stepY, z: 1 });
        list.push({ x: 0.5 * stepX, y: -0.5 * stepY, z: 1 });
        list.push({ x: -0.5 * stepX, y: 0.5 * stepY, z: 1 });
        list.push({ x: 0.5 * stepX, y: 0.5 * stepY, z: 1 });

        // 4 Corner watchtowers on layer 1
        list.push({ x: -2 * stepX, y: -2 * stepY, z: 1 });
        list.push({ x: 2 * stepX, y: -2 * stepY, z: 1 });
        list.push({ x: -2 * stepX, y: 2 * stepY, z: 1 });
        list.push({ x: 2 * stepX, y: 2 * stepY, z: 1 });

        // Central Keep
        list.push({ x: 0, y: 0, z: 2 });
        list.push({ x: 0, y: 0, z: 3 });
        break;
      }

      // 4: Цветок Лотоса (Lotus Petals)
      case 4: {
        // Base petals: diamond formation
        const petals = [
          [0, -2], [0, 2], [-2, 0], [2, 0],
          [-1, -1], [1, -1], [-1, 1], [1, 1],
          [0, -1], [0, 1], [-1, 0], [1, 0],
          [-1.5, -0.5], [1.5, -0.5], [-1.5, 0.5], [1.5, 0.5],
          [-0.5, -1.5], [0.5, -1.5], [-0.5, 1.5], [0.5, 1.5],
        ];
        for (const [px, py] of petals) {
          list.push({ x: px * stepX, y: py * stepY, z: 0 });
        }
        // Lotus Core (Layer 1 & 2)
        list.push({ x: 0, y: -0.5 * stepY, z: 1 });
        list.push({ x: 0, y: 0.5 * stepY, z: 1 });
        list.push({ x: -0.5 * stepX, y: 0, z: 1 });
        list.push({ x: 0.5 * stepX, y: 0, z: 1 });
        list.push({ x: 0, y: 0, z: 2 });
        list.push({ x: 0, y: 0, z: 3 });
        break;
      }

      // Default: Храм (Temple Gateway)
      default: {
        // Two massive pillars
        for (let r = -2; r <= 2; r++) {
          list.push({ x: -1.5 * stepX, y: r * stepY, z: 0 });
          list.push({ x: 1.5 * stepX, y: r * stepY, z: 0 });
        }
        // Center floor
        list.push({ x: 0, y: -1 * stepY, z: 0 });
        list.push({ x: 0, y: 0, z: 0 });
        list.push({ x: 0, y: 1 * stepY, z: 0 });

        // Roof lintel (Layer 1)
        for (let c = -2; c <= 2; c++) {
          list.push({ x: c * stepX, y: -2 * stepY, z: 1 });
        }
        // Stepped roof peak (Layer 2)
        list.push({ x: -1 * stepX, y: -2 * stepY, z: 2 });
        list.push({ x: 0, y: -2 * stepY, z: 2 });
        list.push({ x: 1 * stepX, y: -2 * stepY, z: 2 });
        list.push({ x: 0, y: -2 * stepY, z: 3 });
        break;
      }
    }

    // Ensure total count is strictly EVEN (required for pairing)
    if (list.length % 2 !== 0) {
      list.pop();
    }

    // Adjust to target pair count
    while (list.length > totalTiles && list.length >= 32) {
      list.pop();
      list.pop();
    }

    return list;
  }
}
