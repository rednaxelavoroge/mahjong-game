export interface RawTilePos {
  x: number;
  y: number;
  z: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  subname: string;
  stepX: number;
  stepY: number;
  timeLimit: number; // in seconds
  build: () => RawTilePos[];
}

export const LEVELS: LevelConfig[] = [
  // УРОВЕНЬ 1: "Росток" (Sprout) - 32 кости, легкий и приятный старт
  {
    id: 1,
    name: 'РОСТОК',
    subname: 'Уровень 01 • Обучение',
    stepX: 45,
    stepY: 50,
    timeLimit: 120,
    build: () => {
      const list: RawTilePos[] = [];
      // Слой 0: прямоугольник 6x4 = 24 кости
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) {
          list.push({ x: (c - 2.5) * 45, y: (r - 1.5) * 50, z: 0 });
        }
      }
      // Слой 1: крест из 8 костей
      const layer1 = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1],
      ];
      for (const [x, y] of layer1) {
        list.push({ x: x * 45, y: y * 50, z: 1 });
      }
      return list; // 32 tiles
    },
  },

  // УРОВЕНЬ 2: "Черепаха" (Turtle) - 44 кости, классика
  {
    id: 2,
    name: 'ЧЕРЕПАХА',
    subname: 'Уровень 02 • Казуальный',
    stepX: 44,
    stepY: 48,
    timeLimit: 180,
    build: () => {
      const list: RawTilePos[] = [];
      // База 7x4 = 28 костей
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 7; c++) {
          list.push({ x: (c - 3) * 44, y: (r - 1.5) * 48, z: 0 });
        }
      }
      // Слой 1: 12 костей в центре
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          list.push({ x: (c - 1.5) * 44, y: (r - 1) * 48, z: 1 });
        }
      }
      // Слой 2: корона из 4 костей
      for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        list.push({ x: x * 44, y: y * 48, z: 2 });
      }
      return list; // 28 + 12 + 4 = 44 tiles
    },
  },

  // УРОВЕНЬ 3: "Пирамида" (Pyramid) - 52 кости
  {
    id: 3,
    name: 'ПИРАМИДА',
    subname: 'Уровень 03 • Тактика',
    stepX: 43,
    stepY: 46,
    timeLimit: 210,
    build: () => {
      const list: RawTilePos[] = [];
      // База 8x4 = 32 кости
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 8; c++) {
          list.push({ x: (c - 3.5) * 43, y: (r - 1.5) * 46, z: 0 });
        }
      }
      // Слой 1: 14 костей
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 6; c++) {
          list.push({ x: (c - 2.5) * 43, y: (r - 0.5) * 46, z: 1 });
        }
      }
      list.push({ x: -1.5 * 43, y: -1.5 * 46, z: 1 });
      list.push({ x: 1.5 * 43, y: -1.5 * 46, z: 1 });

      // Слой 2: 6 костей
      for (let c = 0; c < 3; c++) {
        list.push({ x: (c - 1) * 43, y: -0.5 * 46, z: 2 });
        list.push({ x: (c - 1) * 43, y: 0.5 * 46, z: 2 });
      }
      return list; // 32 + 14 + 6 = 52 tiles
    },
  },

  // УРОВЕНЬ 4: "Крепость" (Fortress) - 60 костей
  {
    id: 4,
    name: 'КРЕПОСТЬ',
    subname: 'Уровень 04 • Мастер',
    stepX: 42,
    stepY: 45,
    timeLimit: 240,
    build: () => {
      const list: RawTilePos[] = [];
      // База: периметр и центр
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
          // убираем 4 пустых угла
          if ((r === 0 || r === 4) && (c === 0 || c === 7)) continue;
          list.push({ x: (c - 3.5) * 42, y: (r - 2) * 45, z: 0 });
        }
      } // 40 - 4 = 36 костей

      // Слой 1: две башни по 8 костей = 16
      for (let r = 0; r < 4; r++) {
        list.push({ x: -2 * 42, y: (r - 1.5) * 45, z: 1 });
        list.push({ x: -1 * 42, y: (r - 1.5) * 45, z: 1 });
        list.push({ x: 1 * 42, y: (r - 1.5) * 45, z: 1 });
        list.push({ x: 2 * 42, y: (r - 1.5) * 45, z: 1 });
      } // 16 костей

      // Слой 2: мост и верхушки = 8 костей
      for (const [x, y] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1], [-0.5, 0], [0.5, 0], [-0.5, -1], [0.5, -1]]) {
        list.push({ x: x * 42, y: y * 45, z: 2 });
      }
      return list; // 36 + 16 + 8 = 60 tiles
    },
  },

  // УРОВЕНЬ 5: "Дракон" (Dragon) - 68 костей, гранд-мастер
  {
    id: 5,
    name: 'ДРАКОН',
    subname: 'Уровень 05 • Эксперт',
    stepX: 41,
    stepY: 44,
    timeLimit: 300,
    build: () => {
      const list: RawTilePos[] = [];
      // Тело дракона (база)
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 8; c++) {
          if ((r === 0 && c < 2) || (r === 5 && c > 5)) continue;
          list.push({ x: (c - 3.5) * 41, y: (r - 2.5) * 44, z: 0 });
        }
      } // 48 - 4 = 44 кости

      // Хребет (слой 1)
      for (let c = 0; c < 8; c++) {
        list.push({ x: (c - 3.5) * 41, y: -0.5 * 44, z: 1 });
        list.push({ x: (c - 3.5) * 41, y: 0.5 * 44, z: 1 });
      } // 16 костей

      // Гребень (слой 2)
      for (let c = 0; c < 4; c++) {
        list.push({ x: (c - 1.5) * 41, y: -0.5 * 44, z: 2 });
        list.push({ x: (c - 1.5) * 41, y: 0.5 * 44, z: 2 });
      } // 8 костей
      return list; // 44 + 16 + 8 = 68 tiles
    },
  },
];
