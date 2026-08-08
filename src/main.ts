import Phaser from 'phaser';
import './style.css';

type Tile = {
  id: number;
  x: number;
  y: number;
  z: number;
  kind: string;
  sprite?: Phaser.GameObjects.Container;
  selected?: boolean;
  removed?: boolean;
};

const W = 390;
const H = 760;
const TILE_W = 43;
const TILE_H = 58;
const STEP_X = 45;
const STEP_Y = 48;

const SYMBOLS = ['●●', '◆◆', '♣', '✿', '☀', '☾', '◇', '♠', '♥', '♣', '★', '✦', '☘', '❖', '✤', '◉', '⬟', '❀', '☯', '⚜', '✧', '❂', '✥', '❁'];

function buildLayout(): Omit<Tile, 'kind'>[] {
  const layout: Omit<Tile, 'kind'>[] = [];
  let id = 0;
  // Broad foundation: 8 x 4 tiles.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      layout.push({ id: id++, x: (col - 3.5) * STEP_X, y: (row - 1.5) * STEP_Y, z: 0 });
    }
  }
  // Middle layer: deliberately irregular so the player must expose lanes.
  const middle = [
    [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  for (const [x, y] of middle) layout.push({ id: id++, x: x * STEP_X, y: y * STEP_Y, z: 1 });
  // Crown layer: four central tiles.
  for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    layout.push({ id: id++, x: x * STEP_X, y: y * STEP_Y, z: 2 });
  }
  return layout;
}

function isFree(tile: Tile, all: Tile[]): boolean {
  if (tile.removed) return false;
  const above = all.some(other => !other.removed && other.z > tile.z && other.z <= tile.z + 1 && Math.abs(other.x - tile.x) < STEP_X * 0.9 && Math.abs(other.y - tile.y) < STEP_Y * 0.9);
  if (above) return false;
  const leftBlocked = all.some(other => !other.removed && other.z === tile.z && other.id !== tile.id && Math.abs(other.y - tile.y) < STEP_Y * 0.82 && other.x < tile.x && tile.x - other.x < STEP_X * 1.05);
  const rightBlocked = all.some(other => !other.removed && other.z === tile.z && other.id !== tile.id && Math.abs(other.y - tile.y) < STEP_Y * 0.82 && other.x > tile.x && other.x - tile.x < STEP_X * 1.05);
  return !leftBlocked || !rightBlocked;
}

function makeGuaranteedLevel(): Tile[] {
  const base = buildLayout().map(t => ({ ...t, kind: '' }));
  const remaining = [...base];
  const order: Tile[] = [];
  while (remaining.length) {
    const free = remaining.filter(tile => isFree(tile, remaining));
    const choice = free[Math.floor(free.length / 2)] ?? remaining[remaining.length - 1];
    order.push(choice);
    remaining.splice(remaining.findIndex(t => t.id === choice.id), 1);
  }
  // Consecutive tiles in the removal order form a guaranteed legal pair.
  for (let i = 0; i < order.length; i += 2) {
    const symbol = SYMBOLS[(i / 2) % SYMBOLS.length];
    order[i].kind = symbol;
    order[i + 1].kind = symbol;
  }
  return base;
}

class MahjongScene extends Phaser.Scene {
  private tiles: Tile[] = [];
  private selected: Tile | null = null;
  private moves = 0;
  private mistakes = 0;
  private focusText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private board!: Phaser.GameObjects.Container;
  private history: number[] = [];

  constructor() { super('MahjongScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#0d6656');
    this.drawBackground();
    this.drawHeader();
    this.board = this.add.container(W / 2, 315);
    this.tiles = makeGuaranteedLevel();
    this.renderTiles();
    this.drawControls();
    this.updateHud();
  }

  private drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0b765e, 0x0b765e, 0x075b4e, 0x075b4e, 1);
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) {
      g.fillStyle(0x2a8b69, 0.08);
      g.fillCircle(20 + (i * 83) % W, 90 + (i * 137) % 650, 55 + (i % 3) * 20);
    }
  }

  private drawHeader() {
    const title = this.add.text(W / 2, 35, 'LEAF MAHJONG', { fontFamily: 'Arial', fontSize: '20px', color: '#fff1c7', fontStyle: 'bold' }).setOrigin(0.5);
    title.setShadow(0, 2, '#063f36', 4, true, true);
    this.add.text(W / 2, 60, 'FOCUS 65', { fontFamily: 'Arial', fontSize: '12px', color: '#d7f1dc', fontStyle: 'bold' }).setOrigin(0.5);
    const level = this.add.text(24, 32, 'LEVEL 01', { fontFamily: 'Arial', fontSize: '12px', color: '#f6dfae', fontStyle: 'bold' });
    level.setPadding(10, 6);
    const pill = this.add.graphics();
    pill.fillStyle(0x154b40, 0.85);
    pill.fillRoundedRect(16, 19, 78, 27, 13);
    level.setDepth(2);
    this.focusText = this.add.text(W - 24, 32, '48', { fontFamily: 'Arial', fontSize: '15px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0.5);
    this.add.text(W - 24, 48, 'tiles', { fontFamily: 'Arial', fontSize: '9px', color: '#b9e5d3' }).setOrigin(1, 0.5);
  }

  private renderTiles() {
    this.board.removeAll(true);
    const sorted = [...this.tiles].sort((a, b) => a.z - b.z || a.id - b.id);
    for (const tile of sorted) {
      if (tile.removed) continue;
      const c = this.makeTile(tile);
      tile.sprite = c;
      this.board.add(c);
    }
  }

  private makeTile(tile: Tile): Phaser.GameObjects.Container {
    const c = this.add.container(tile.x, tile.y - tile.z * 5);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x062f2a, 0.45);
    shadow.fillRoundedRect(-TILE_W / 2 + 3, -TILE_H / 2 + 5, TILE_W, TILE_H, 7);
    const body = this.add.graphics();
    body.fillStyle(0xf7f0da, 1);
    body.lineStyle(2, 0xd7c8a5, 1);
    body.fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 7);
    body.strokeRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 7);
    const accent = this.add.graphics();
    accent.fillStyle(0xffffff, 0.35);
    accent.fillRoundedRect(-TILE_W / 2 + 4, -TILE_H / 2 + 4, TILE_W - 8, 8, 4);
    const label = this.add.text(0, 2, tile.kind, {
      fontFamily: 'Arial', fontSize: tile.kind.length > 1 ? '18px' : '25px', color: '#185e52', fontStyle: 'bold'
    }).setOrigin(0.5);
    const corner = this.add.text(0, TILE_H / 2 - 8, tile.z === 2 ? '◆' : '', { fontSize: '7px', color: '#c4a86f' }).setOrigin(0.5);
    c.add([shadow, body, accent, label, corner]);
    c.setSize(TILE_W, TILE_H);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => this.selectTile(tile));
    c.setDepth(tile.z * 100 + tile.id);
    return c;
  }

  private selectTile(tile: Tile) {
    if (tile.removed || !isFree(tile, this.tiles)) {
      this.bump(tile);
      return;
    }
    if (!this.selected) {
      this.selected = tile;
      this.history.push(tile.id);
      this.setSelected(tile, true);
      this.statusText.setText('Choose the matching tile');
      return;
    }
    if (this.selected.id === tile.id) return;
    this.moves++;
    if (this.selected.kind === tile.kind) {
      const first = this.selected;
      this.removePair(first, tile);
      this.selected = null;
      this.statusText.setText('Perfect match');
    } else {
      this.mistakes++;
      this.setSelected(this.selected, false);
      this.selected = null;
      this.statusText.setText('Not a match — try another pair');
      this.bump(tile);
    }
    this.updateHud();
    if (this.tiles.every(t => t.removed)) this.win();
  }

  private setSelected(tile: Tile, value: boolean) {
    tile.selected = value;
    if (tile.sprite) {
      tile.sprite.setScale(value ? 1.08 : 1);
      tile.sprite.setAlpha(value ? 0.92 : 1);
    }
  }

  private removePair(a: Tile, b: Tile) {
    a.removed = true; b.removed = true;
    for (const t of [a, b]) {
      if (t.sprite) {
        this.tweens.add({ targets: t.sprite, scale: 0.15, alpha: 0, duration: 180, ease: 'Back.easeIn', onComplete: () => t.sprite?.destroy() });
      }
    }
    this.time.delayedCall(190, () => this.updateHud());
  }

  private bump(tile: Tile) {
    if (!tile.sprite) return;
    this.tweens.add({ targets: tile.sprite, x: tile.x + 5, duration: 45, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
  }

  private hint() {
    const free = this.tiles.filter(t => isFree(t, this.tiles));
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (free[i].kind === free[j].kind) {
          this.tweens.add({ targets: [free[i].sprite, free[j].sprite], alpha: 0.45, duration: 160, yoyo: true, repeat: 2 });
          this.statusText.setText('Hint: these two tiles match');
          return;
        }
      }
    }
    this.statusText.setText('No open pair — reshuffle is needed');
  }

  private restart() {
    this.scene.restart();
  }

  private drawControls() {
    this.statusText = this.add.text(W / 2, 610, 'Find two matching open tiles', { fontFamily: 'Arial', fontSize: '13px', color: '#e5f4df', fontStyle: 'bold' }).setOrigin(0.5);
    const buttons = [
      { x: 82, label: '↻', sub: 'RESTART', fn: () => this.restart() },
      { x: 195, label: '✦', sub: 'HINT', fn: () => this.hint() },
      { x: 308, label: '↶', sub: 'UNDO', fn: () => this.undo() },
    ];
    for (const b of buttons) {
      const g = this.add.graphics();
      g.fillStyle(0x7c421d, 1);
      g.lineStyle(2, 0xb8752f, 1);
      g.fillCircle(b.x, 686, 32);
      g.strokeCircle(b.x, 686, 32);
      const icon = this.add.text(b.x, 680, b.label, { fontFamily: 'Arial', fontSize: '26px', color: '#ffe5b1', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(b.x, 718, b.sub, { fontFamily: 'Arial', fontSize: '8px', color: '#d3ecd9', fontStyle: 'bold' }).setOrigin(0.5);
      const zone = this.add.zone(b.x, 686, 64, 64).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', b.fn);
      icon.setDepth(2);
    }
  }

  private undo() {
    if (this.selected) {
      this.setSelected(this.selected, false);
      this.selected = null;
      this.statusText.setText('Selection cancelled');
      return;
    }
    this.statusText.setText('Undo is reserved for a completed pair in the next build');
  }

  private updateHud() {
    const left = this.tiles.filter(t => !t.removed).length;
    this.focusText?.setText(String(left));
  }

  private win() {
    this.statusText.setText('LEVEL COMPLETE');
    const overlay = this.add.container(W / 2, 340);
    const panel = this.add.graphics();
    panel.fillStyle(0x103f37, 0.97);
    panel.lineStyle(2, 0xd6ad58, 1);
    panel.fillRoundedRect(-145, -85, 290, 170, 18);
    panel.strokeRoundedRect(-145, -85, 290, 170, 18);
    overlay.add(panel);
    overlay.add(this.add.text(0, -40, 'LEVEL COMPLETE', { fontFamily: 'Arial', fontSize: '23px', color: '#ffe7ad', fontStyle: 'bold' }).setOrigin(0.5));
    overlay.add(this.add.text(0, 0, `Moves: ${this.moves}   Mistakes: ${this.mistakes}`, { fontFamily: 'Arial', fontSize: '13px', color: '#d5efe3' }).setOrigin(0.5));
    const next = this.add.text(0, 45, 'PLAY AGAIN', { fontFamily: 'Arial', fontSize: '13px', color: '#fff', fontStyle: 'bold', backgroundColor: '#b4652c', padding: { left: 18, right: 18, top: 9, bottom: 9 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    next.on('pointerdown', () => this.restart());
    overlay.add(next);
    overlay.setDepth(9999);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game',
  backgroundColor: '#0d6656',
  render: { antialias: true, roundPixels: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  input: { activePointers: 2 },
  scene: MahjongScene,
});
