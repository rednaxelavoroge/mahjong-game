import Phaser from 'phaser';
import { LEVELS, LevelConfig } from '../game/layouts';
import { Tile, isFree, generateGuaranteedLevel, findOpenPair, smartShuffleRemaining } from '../game/solver';
import { SoundManager } from '../audio/SoundManager';
import { StorageService } from '../services/StorageService';
import { AdService } from '../services/AdService';
import { EconomyService } from '../services/EconomyService';
import { CurrencyService } from '../services/CurrencyService';
import { TournamentModal } from '../ui/TournamentModal';
import { WheelModal } from '../ui/WheelModal';
import { VaultModal } from '../ui/VaultModal';
import { ReferralModal } from '../ui/ReferralModal';

const W = 390;
const H = 760;
const TILE_W = 44;
const TILE_H = 58;
const TRAY_CAPACITY = 4;
const TRAY_Y = 128;

interface UndoStep {
  tile: Tile;
  fromTrayIndex: number;
}

export class MahjongScene extends Phaser.Scene {
  private levelIndex = 0;
  private levelConfig!: LevelConfig;
  private tiles: Tile[] = [];
  private undoStack: UndoStep[] = [];

  // Tray management (Vita Mahjong style)
  private tray: (Tile | null)[] = [null, null, null, null];
  private traySlotsContainer!: Phaser.GameObjects.Container;
  private isProcessingFlight = false;

  // Game stats
  private score = 0;
  private displayedScore = 0;
  private moves = 0;
  private mistakes = 0;
  private hintsLeft = 3;
  private shufflesLeft = 2;
  private combo = 1;
  private lastMatchTime = 0;
  private timeElapsed = 0;
  private timerEvent?: Phaser.Time.TimerEvent;

  // Services
  private soundMgr = SoundManager.getInstance();
  private storage = StorageService.getInstance();
  private adService = AdService.getInstance();
  private economy = EconomyService.getInstance();
  private currency = CurrencyService.getInstance();

  // HUD and UI elements
  private boardContainer!: Phaser.GameObjects.Container;
  private hudContainer!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private vaultButtonText!: Phaser.GameObjects.Text;
  private comboBadge!: Phaser.GameObjects.Container;
  private comboText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private hintSubText!: Phaser.GameObjects.Text;
  private shuffleSubText!: Phaser.GameObjects.Text;
  private soundBtnText!: Phaser.GameObjects.Text;
  private trayWarningGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('MahjongScene');
  }

  init(data?: { levelIndex?: number }) {
    if (data && typeof data.levelIndex === 'number') {
      this.levelIndex = data.levelIndex;
    } else {
      this.levelIndex = 0;
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#082b24');
    this.levelConfig = LEVELS[this.levelIndex] || LEVELS[0];

    // Reset runtime stats
    this.score = 0;
    this.displayedScore = 0;
    this.moves = 0;
    this.mistakes = 0;
    this.hintsLeft = 3;
    this.shufflesLeft = 2;
    this.combo = 1;
    this.undoStack = [];
    this.tray = [null, null, null, null];
    this.timeElapsed = 0;
    this.isProcessingFlight = false;

    this.drawBackground();
    this.createHeader();
    this.createTray();
    this.drawControls();

    // Board container
    this.boardContainer = this.add.container(W / 2, 385);

    // Generate guaranteed solvable board with Golden Tiles
    this.tiles = generateGuaranteedLevel(this.levelConfig);
    this.renderTiles();

    // Start level timer
    if (this.timerEvent) this.timerEvent.destroy();
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.timeElapsed++;
        this.updateTimerDisplay();
      },
      loop: true,
    });

    this.updateHud();
  }

  private drawBackground() {
    const bg = this.add.graphics();
    // Luxurious dark emerald table felt
    bg.fillGradientStyle(0x0a3930, 0x0a3930, 0x041c17, 0x041c17, 1);
    bg.fillRect(0, 0, W, H);

    // Subtle table watermark pattern
    for (let i = 0; i < 24; i++) {
      bg.fillStyle(0x15803d, 0.07);
      const cx = (i * 73) % W;
      const cy = 40 + (i * 107) % 680;
      bg.fillCircle(cx, cy, 35 + (i % 3) * 15);
    }
  }

  private createHeader() {
    this.hudContainer = this.add.container(0, 0);

    // Top Header Bar Background
    const topBar = this.add.graphics();
    topBar.fillStyle(0x021612, 0.85);
    topBar.fillRect(0, 0, W, 86);
    this.hudContainer.add(topBar);

    // 1. Level selector button
    const levelPill = this.add.graphics();
    levelPill.fillStyle(0x0e4e40, 0.9);
    levelPill.lineStyle(1, 0x22c55e, 0.4);
    levelPill.fillRoundedRect(10, 10, 100, 30, 15);
    levelPill.strokeRoundedRect(10, 10, 100, 30, 15);
    this.hudContainer.add(levelPill);

    const levelTitle = this.add.text(60, 25, `УР. ${this.levelConfig.id} ▾`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#86efac',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudContainer.add(levelTitle);

    const levelZone = this.add.zone(60, 25, 100, 30).setInteractive({ useHandCursor: true });
    levelZone.on('pointerdown', () => this.showLevelSelectModal());
    this.hudContainer.add(levelZone);

    // 2. Piggy Bank / Vault button (🐷 150 ₽)
    const vaultPill = this.add.graphics();
    vaultPill.fillStyle(0x854d0e, 0.95);
    vaultPill.lineStyle(1.5, 0xfacc15, 0.9);
    vaultPill.fillRoundedRect(118, 10, 110, 30, 15);
    vaultPill.strokeRoundedRect(118, 10, 110, 30, 15);
    this.hudContainer.add(vaultPill);

    this.vaultButtonText = this.add.text(173, 25, `🐷 ${this.economy.getFormattedBalance()}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudContainer.add(this.vaultButtonText);

    const vaultZone = this.add.zone(173, 25, 110, 30).setInteractive({ useHandCursor: true });
    vaultZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      VaultModal.show(() => this.updateHud());
    });
    this.hudContainer.add(vaultZone);

    // 3. Referral Friends Button (👥 ДРУЗЬЯ)
    const refPill = this.add.graphics();
    refPill.fillStyle(0x0369a1, 0.95);
    refPill.lineStyle(1, 0x38bdf8, 0.8);
    refPill.fillRoundedRect(236, 10, 95, 30, 15);
    refPill.strokeRoundedRect(236, 10, 95, 30, 15);
    this.hudContainer.add(refPill);

    const refText = this.add.text(283, 25, '👥 ДРУЗЬЯ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      color: '#e0f2fe',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudContainer.add(refText);

    const refZone = this.add.zone(283, 25, 95, 30).setInteractive({ useHandCursor: true });
    refZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      ReferralModal.show(() => this.updateHud());
    });
    this.hudContainer.add(refZone);

    // 4. Sound Mute Toggle
    const soundPill = this.add.graphics();
    soundPill.fillStyle(0x0e4e40, 0.9);
    soundPill.fillCircle(W - 24, 25, 15);
    this.hudContainer.add(soundPill);

    this.soundBtnText = this.add.text(W - 24, 25, this.soundMgr.isMuted() ? '🔇' : '🔊', {
      fontSize: '13px',
    }).setOrigin(0.5);
    this.hudContainer.add(this.soundBtnText);

    const soundZone = this.add.zone(W - 24, 25, 32, 32).setInteractive({ useHandCursor: true });
    soundZone.on('pointerdown', () => {
      const muted = this.soundMgr.toggleMute();
      this.soundBtnText.setText(muted ? '🔇' : '🔊');
    });
    this.hudContainer.add(soundZone);

    // Sub-header row: Timer, Score, Tournament link
    this.timerText = this.add.text(18, 62, '⏱ 00:00', {
      fontFamily: 'system-ui, monospace',
      fontSize: '12px',
      color: '#94a3b8',
      fontStyle: 'bold',
    });
    this.hudContainer.add(this.timerText);

    this.scoreText = this.add.text(W / 2, 62, 'СЧЕТ: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.hudContainer.add(this.scoreText);

    const tourneySmall = this.add.text(W - 18, 62, '🏆 50 000 ₽', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    tourneySmall.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      TournamentModal.show();
    });
    this.hudContainer.add(tourneySmall);
  }

  /**
   * Creates the 4-slot Tray bar at the top (Vita Mahjong signature mechanic)
   */
  private createTray() {
    this.traySlotsContainer = this.add.container(0, TRAY_Y);
    this.traySlotsContainer.setDepth(9000);

    // Tray shelf backing
    const shelf = this.add.graphics();
    shelf.fillStyle(0x031814, 0.95);
    shelf.lineStyle(2, 0x0f766e, 0.9);
    shelf.fillRoundedRect(W / 2 - 115, -34, 230, 68, 16);
    shelf.strokeRoundedRect(W / 2 - 115, -34, 230, 68, 16);
    this.traySlotsContainer.add(shelf);

    // Shelf warning border (pulses red when 4/4)
    this.trayWarningGfx = this.add.graphics();
    this.traySlotsContainer.add(this.trayWarningGfx);

    // 4 glass slot frames
    for (let i = 0; i < TRAY_CAPACITY; i++) {
      const slotX = this.getTraySlotX(i);
      const slotGfx = this.add.graphics();
      slotGfx.fillStyle(0x062821, 0.7);
      slotGfx.lineStyle(1.5, 0x14b8a6, 0.35);
      slotGfx.fillRoundedRect(slotX - TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 6);
      slotGfx.strokeRoundedRect(slotX - TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 6);
      this.traySlotsContainer.add(slotGfx);
    }

    // Combo streak badge right below tray
    this.comboBadge = this.add.container(W / 2, TRAY_Y + 44);
    const comboGfx = this.add.graphics();
    comboGfx.fillStyle(0xf59e0b, 0.95);
    comboGfx.fillRoundedRect(-55, -10, 110, 20, 10);
    this.comboText = this.add.text(0, 0, '🔥 COMBO x2!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#1e293b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.comboBadge.add([comboGfx, this.comboText]);
    this.comboBadge.setAlpha(0);
    this.hudContainer.add(this.comboBadge);
  }

  private getTraySlotX(index: number): number {
    return W / 2 - (1.5 - index) * 52;
  }

  private updateTimerDisplay() {
    const mins = Math.floor(this.timeElapsed / 60);
    const secs = this.timeElapsed % 60;
    this.timerText.setText(`⏱ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
  }

  private renderTiles() {
    this.boardContainer.removeAll(true);
    const sorted = [...this.tiles].sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);

    for (const tile of sorted) {
      if (tile.removed) continue;
      const c = this.createTileVisual(tile);
      tile.sprite = c;
      this.boardContainer.add(c);
    }
  }

  private createTileVisual(tile: Tile): Phaser.GameObjects.Container {
    const container = this.add.container(tile.x, tile.y - tile.z * 5);

    // Drop shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x021410, 0.5);
    shadow.fillRoundedRect(-TILE_W / 2 + 4, -TILE_H / 2 + 6, TILE_W, TILE_H, 6);

    // 3D side edge
    const baseEdge = this.add.graphics();
    baseEdge.fillStyle(tile.isGold ? 0xca8a04 : 0xd8cbb5, 1);
    baseEdge.fillRoundedRect(-TILE_W / 2, -TILE_H / 2 + 3, TILE_W, TILE_H, 6);

    // Tile face (ivory or gold gradient)
    const face = this.add.graphics();
    if (tile.isGold) {
      face.fillGradientStyle(0xfef08a, 0xfef08a, 0xeab308, 0xeab308, 1);
      face.lineStyle(2, 0xfffbeb, 1);
    } else {
      face.fillStyle(0xfdfbf7, 1);
      face.lineStyle(1.5, 0xeee4d0, 1);
    }
    face.fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H - 3, 6);
    face.strokeRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H - 3, 6);

    // Glossy highlight
    const highlight = this.add.graphics();
    highlight.fillStyle(0xffffff, tile.isGold ? 0.65 : 0.4);
    highlight.fillRoundedRect(-TILE_W / 2 + 3, -TILE_H / 2 + 2, TILE_W - 6, 8, 4);

    // Symbol text
    const symbolText = this.add.text(0, -2, tile.kind, {
      fontFamily: 'system-ui, "Segoe UI Emoji", AppleColorEmoji, sans-serif',
      fontSize: tile.isGold ? '24px' : tile.kind.length > 1 ? '18px' : '26px',
      color: tile.isGold ? '#78350f' : tile.color,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Golden tile extra aura shimmer
    if (tile.isGold) {
      this.tweens.add({
        targets: highlight,
        alpha: 0.85,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }

    container.add([shadow, baseEdge, face, highlight, symbolText]);
    container.setSize(TILE_W, TILE_H);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => this.handleTileClick(tile));
    container.setDepth(tile.z * 100 + (tile.y + 400));

    return container;
  }

  /**
   * Handles user tapping an open tile on the board
   * (Vita Mahjong mechanic: tile flies into the top tray!)
   */
  private handleTileClick(tile: Tile) {
    if (tile.removed || this.isProcessingFlight) return;

    // Rule check: is tile free?
    const free = isFree(tile, this.tiles, this.levelConfig.stepX, this.levelConfig.stepY);
    if (!free) {
      this.soundMgr.playBump();
      this.bumpTile(tile);
      this.statusText.setText('Кость заблокирована другими костями!');
      return;
    }

    // Check if tray has a free slot
    const freeSlotIndex = this.tray.findIndex(t => t === null);
    if (freeSlotIndex === -1) {
      // TRAY IS COMPLETELY FULL (4/4) -> Danger!
      this.soundMgr.playBump();
      this.shakeTray();
      this.statusText.setText('⚠️ Лоток переполнен! Нет свободных слотов');
      this.checkTrayOverflow();
      return;
    }

    this.isProcessingFlight = true;
    this.soundMgr.playTrayFly();

    // Mark tile as in tray
    this.tray[freeSlotIndex] = tile;
    tile.removed = true; // no longer blocks board tiles
    this.moves++;

    // Save undo step
    this.undoStack.push({ tile, fromTrayIndex: freeSlotIndex });

    // Target position in world coordinates
    const targetX = this.getTraySlotX(freeSlotIndex);
    const targetY = TRAY_Y;

    // Reparent sprite to root scene so it can fly freely over everything
    const sp = tile.sprite!;
    const worldX = this.boardContainer.x + sp.x;
    const worldY = this.boardContainer.y + sp.y;

    this.boardContainer.remove(sp);
    this.add.existing(sp);
    sp.setPosition(worldX, worldY);
    sp.setDepth(9999);

    // Parabolic arc flight tween into tray
    this.tweens.add({
      targets: sp,
      x: targetX,
      y: targetY,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        sp.setScale(1);
        this.isProcessingFlight = false;
        this.checkTrayMatches();
      },
    });

    this.updateHud();
  }

  /**
   * Checks if tray contains a matching pair
   */
  private checkTrayMatches() {
    // Find matching pair in tray
    let matchA = -1;
    let matchB = -1;

    for (let i = 0; i < TRAY_CAPACITY; i++) {
      for (let j = i + 1; j < TRAY_CAPACITY; j++) {
        if (this.tray[i] && this.tray[j] && this.tray[i]!.kind === this.tray[j]!.kind) {
          matchA = i;
          matchB = j;
          break;
        }
      }
      if (matchA !== -1) break;
    }

    if (matchA !== -1 && matchB !== -1) {
      // PAIR FOUND IN TRAY!
      this.handleTrayPairMatch(matchA, matchB);
    } else {
      // Check if tray is full (4/4) without matches -> Game Over warning!
      const filledCount = this.tray.filter(t => t !== null).length;
      if (filledCount >= TRAY_CAPACITY) {
        this.checkTrayOverflow();
      } else {
        this.statusText.setText(`Кость в лотке (${filledCount}/4)`);
      }
    }
  }

  private handleTrayPairMatch(indexA: number, indexB: number) {
    const tileA = this.tray[indexA]!;
    const tileB = this.tray[indexB]!;
    const isGold = tileA.isGold || tileB.isGold;

    // Remove from tray slots
    this.tray[indexA] = null;
    this.tray[indexB] = null;

    // Combo calculation
    const now = this.time.now;
    if (this.lastMatchTime > 0 && now - this.lastMatchTime < 3500) {
      this.combo = Math.min(this.combo + 1, 5);
      this.showComboBadge();
    } else {
      this.combo = 1;
      this.hideComboBadge();
    }
    this.lastMatchTime = now;

    // Score and real cash addition
    const pointsGained = 150 * this.combo;
    this.score += pointsGained;

    // Cash into piggy bank: +15 ₽ for Gold, +2 ₽ for normal
    const cashRub = isGold ? 15 : 2;
    this.economy.addRub(cashRub);
    this.soundMgr.playCoin();

    // Play chime sound
    this.soundMgr.playMatch(this.combo);

    // Animate tiles merging in tray
    const midX = (this.getTraySlotX(indexA) + this.getTraySlotX(indexB)) / 2;
    for (const t of [tileA, tileB]) {
      if (t.sprite) {
        this.tweens.add({
          targets: t.sprite,
          x: midX,
          scaleX: 0.1,
          scaleY: 0.1,
          alpha: 0,
          duration: 180,
          ease: 'Back.easeIn',
          onComplete: () => {
            t.sprite?.destroy();
            t.sprite = undefined;
          },
        });
      }
    }

    // Spawn floating cash popup
    const popupText = isGold ? `🎉 ЗОЛОТО! +${this.currency.formatRub(cashRub)}` : `+${pointsGained} (${this.currency.formatRub(cashRub)})`;
    this.spawnScorePopup(midX, TRAY_Y - 20, popupText, isGold ? '#fef08a' : '#86efac');

    // Slide remaining tray tiles to left
    this.time.delayedCall(200, () => {
      this.compactTray();
      this.updateHud();

      // If Golden Pair was collected -> LAUNCH LUCKY WHEEL!
      if (isGold) {
        this.time.delayedCall(250, () => {
          WheelModal.show((reward) => {
            if (reward.type === 'hints') this.hintsLeft += reward.value;
            if (reward.type === 'shuffle') this.shufflesLeft += reward.value;
            this.updateHud();
          });
        });
      }

      // Check level win
      if (this.tiles.every(t => t.removed) && this.tray.every(t => t === null)) {
        this.handleLevelWin();
      }
    });
  }

  /**
   * Slides remaining tiles in the tray to the left to close gaps
   */
  private compactTray() {
    const compact: Tile[] = [];
    for (let i = 0; i < TRAY_CAPACITY; i++) {
      if (this.tray[i]) compact.push(this.tray[i]!);
      this.tray[i] = null;
    }

    compact.forEach((tile, newIndex) => {
      this.tray[newIndex] = tile;
      if (tile.sprite) {
        this.tweens.add({
          targets: tile.sprite,
          x: this.getTraySlotX(newIndex),
          duration: 120,
          ease: 'Sine.easeOut',
        });
      }
    });
  }

  private checkTrayOverflow() {
    this.soundMgr.playBump();
    this.shakeTray();

    // Pulse red danger warning border on tray
    this.trayWarningGfx.clear();
    this.trayWarningGfx.lineStyle(3, 0xef4444, 1);
    this.trayWarningGfx.strokeRoundedRect(W / 2 - 115, -34, 230, 68, 16);

    this.tweens.add({
      targets: this.trayWarningGfx,
      alpha: 0.2,
      duration: 250,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.trayWarningGfx.clear();
      },
    });

    // Show overflow rescue modal
    const modal = this.add.container(W / 2, H / 2);
    modal.setDepth(99999);

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.85);
    backdrop.fillRect(-W / 2, -H / 2, W, H);
    modal.add(backdrop);

    const panel = this.add.graphics();
    panel.fillStyle(0x092e25, 0.98);
    panel.lineStyle(2, 0xef4444, 1);
    panel.fillRoundedRect(-145, -130, 290, 260, 20);
    panel.strokeRoundedRect(-145, -130, 290, 260, 20);
    modal.add(panel);

    const icon = this.add.text(0, -95, '⚠️', { fontSize: '32px' }).setOrigin(0.5);
    const title = this.add.text(0, -60, 'ЛОТОК ПОЛОН!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#f87171',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const desc = this.add.text(0, -20, 'Все 4 слота заняты разными костями.\nОсвободите 2 слота, чтобы продолжить!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#e2e8f0',
      align: 'center',
    }).setOrigin(0.5);
    modal.add([icon, title, desc]);

    // Button 1: Watch ad to clear 2 slots
    const adBtnBg = this.add.graphics();
    adBtnBg.fillStyle(0x15803d, 1);
    adBtnBg.fillRoundedRect(-120, 20, 240, 42, 21);
    modal.add(adBtnBg);

    const adBtnText = this.add.text(0, 41, '🎬 ОЧИСТИТЬ 2 СЛОТА', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(adBtnText);

    const adZone = this.add.zone(0, 41, 240, 42).setInteractive({ useHandCursor: true });
    adZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      this.adService.showRewardedAd('shuffle').then(watched => {
        if (watched) {
          modal.destroy();
          // Remove 2 rightmost tiles from tray back to unremoved board
          this.removeTilesFromTray(2);
        }
      });
    });
    modal.add(adZone);

    // Button 2: Undo last move
    const undoBtn = this.add.text(0, 95, '↶ Отменить последний ход', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#94a3b8',
      fontStyle: 'underline',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    undoBtn.on('pointerdown', () => {
      modal.destroy();
      this.undo();
    });
    modal.add(undoBtn);
  }

  private removeTilesFromTray(count: number) {
    let removed = 0;
    for (let i = TRAY_CAPACITY - 1; i >= 0; i--) {
      if (this.tray[i] && removed < count) {
        const t = this.tray[i]!;
        this.tray[i] = null;
        t.removed = false;
        t.sprite?.destroy();
        t.sprite = undefined;
        removed++;
      }
    }
    this.compactTray();
    this.renderTiles();
    this.soundMgr.playUndo();
    this.statusText.setText(`Освобождено слотов: ${removed}! Продолжайте игру`);
    this.updateHud();
  }

  private shakeTray() {
    this.tweens.add({
      targets: this.traySlotsContainer,
      x: 6,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.traySlotsContainer.setX(0);
      },
    });
  }

  private bumpTile(tile: Tile) {
    if (!tile.sprite) return;
    this.tweens.add({
      targets: tile.sprite,
      x: tile.x + 5,
      duration: 45,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        tile.sprite?.setX(tile.x);
      },
    });
  }

  private spawnScorePopup(x: number, y: number, text: string, color = '#fef08a') {
    const popup = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: color,
      fontStyle: 'bold',
      stroke: '#021814',
      strokeThickness: 3,
    }).setOrigin(0.5);
    popup.setDepth(10000);

    this.tweens.add({
      targets: popup,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Sine.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  private showComboBadge() {
    this.comboText.setText(`🔥 COMBO x${this.combo}!`);
    this.comboBadge.setAlpha(1);
    this.comboBadge.setScale(1.2);
    this.tweens.add({
      targets: this.comboBadge,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });
  }

  private hideComboBadge() {
    this.tweens.add({
      targets: this.comboBadge,
      alpha: 0,
      duration: 200,
    });
  }

  private undo() {
    if (this.undoStack.length === 0) {
      this.statusText.setText('Нет ходов для отмены');
      return;
    }

    const last = this.undoStack.pop()!;
    // Find where tile is
    const idx = this.tray.findIndex(t => t && t.id === last.tile.id);
    if (idx !== -1) {
      this.tray[idx] = null;
      last.tile.removed = false;
      if (last.tile.sprite) {
        last.tile.sprite.destroy();
        last.tile.sprite = undefined;
      }
      this.compactTray();
      this.renderTiles();
      this.soundMgr.playUndo();
      this.statusText.setText('Кость возвращена на стол');
      this.updateHud();
    } else {
      this.statusText.setText('Ход уже сыгран');
    }
  }

  private hint() {
    if (this.hintsLeft <= 0) {
      this.adService.showRewardedAd('hints').then(watched => {
        if (watched) {
          this.hintsLeft += 3;
          this.updateHud();
          this.hint();
        }
      });
      return;
    }

    // Check if there is already 1 tile in tray that we can match
    const trayTile = this.tray.find(t => t !== null);
    if (trayTile) {
      const matchOnBoard = this.tiles.find(t => !t.removed && t.kind === trayTile.kind && isFree(t, this.tiles, this.levelConfig.stepX, this.levelConfig.stepY));
      if (matchOnBoard && matchOnBoard.sprite) {
        this.hintsLeft--;
        this.soundMgr.playHint();
        this.updateHud();
        this.pulseTile(matchOnBoard);
        this.statusText.setText(`Подсказка: заберите пару «${matchOnBoard.kind}» в лоток!`);
        return;
      }
    }

    const pair = findOpenPair(this.tiles, this.levelConfig.stepX, this.levelConfig.stepY);
    if (!pair) {
      this.statusText.setText('Нет пар — нажмите «Перемешать»!');
      return;
    }

    this.hintsLeft--;
    this.soundMgr.playHint();
    this.updateHud();

    for (const t of pair) {
      this.pulseTile(t);
    }
    this.statusText.setText(`Подсказка: пара «${pair[0].kind}» открыта!`);
  }

  private pulseTile(tile: Tile) {
    if (!tile.sprite) return;
    this.tweens.add({
      targets: tile.sprite,
      scaleX: 1.15,
      scaleY: 1.15,
      y: tile.sprite.y - 6,
      duration: 180,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    });
  }

  private shuffle() {
    if (this.shufflesLeft <= 0) {
      this.adService.showRewardedAd('shuffle').then(watched => {
        if (watched) {
          this.shufflesLeft += 1;
          this.updateHud();
          this.shuffle();
        }
      });
      return;
    }

    this.shufflesLeft--;
    this.soundMgr.playShuffle();

    smartShuffleRemaining(this.tiles, this.levelConfig.stepX, this.levelConfig.stepY);

    for (const t of this.tiles) {
      if (!t.removed && t.sprite) {
        this.tweens.add({
          targets: t.sprite,
          angle: 360,
          scaleX: 0.2,
          scaleY: 0.2,
          duration: 180,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });
      }
    }

    this.time.delayedCall(190, () => {
      this.renderTiles();
      this.statusText.setText('Кости перемешаны! Открылись новые ходы');
      this.updateHud();
    });
  }

  private drawControls() {
    this.statusText = this.add.text(W / 2, 608, 'Забирайте кости в лоток парами!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#d1fae5',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const buttons = [
      {
        id: 'restart',
        x: 55,
        icon: '↻',
        title: 'ЗАНОВО',
        sub: 'Сброс',
        action: () => this.scene.restart({ levelIndex: this.levelIndex }),
      },
      {
        id: 'hint',
        x: 145,
        icon: '✦',
        title: 'ПОДСКАЗКА',
        sub: `${this.hintsLeft} шт.`,
        action: () => this.hint(),
      },
      {
        id: 'shuffle',
        x: 245,
        icon: '🔀',
        title: 'ПЕРЕМЕШАТЬ',
        sub: `${this.shufflesLeft} шт.`,
        action: () => this.shuffle(),
      },
      {
        id: 'undo',
        x: 335,
        icon: '↶',
        title: 'ОТМЕНА',
        sub: 'Назад',
        action: () => this.undo(),
      },
    ];

    for (const b of buttons) {
      const bg = this.add.graphics();
      bg.fillStyle(0x0a3f34, 0.95);
      bg.lineStyle(1.5, 0x16a34a, 0.8);
      bg.fillCircle(b.x, 672, 28);
      bg.strokeCircle(b.x, 672, 28);

      const icon = this.add.text(b.x, 666, b.icon, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#fef08a',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(b.x, 706, b.title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '8px',
        color: '#86efac',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const subText = this.add.text(b.x, 717, b.sub, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '8px',
        color: '#94a3b8',
      }).setOrigin(0.5);

      if (b.id === 'hint') this.hintSubText = subText;
      if (b.id === 'shuffle') this.shuffleSubText = subText;

      const zone = this.add.zone(b.x, 675, 60, 64).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.soundMgr.playTileClick();
        b.action();
      });
    }
  }

  private updateHud() {
    this.vaultButtonText?.setText(`🐷 ${this.economy.getFormattedBalance()}`);

    // Smooth score number tween
    this.tweens.addCounter({
      from: this.displayedScore,
      to: this.score,
      duration: 250,
      onUpdate: (tween) => {
        const val = Math.floor(tween.getValue() ?? 0);
        this.displayedScore = val;
        this.scoreText.setText(`СЧЕТ: ${val.toLocaleString()}`);
      },
    });

    if (this.hintSubText) {
      this.hintSubText.setText(this.hintsLeft > 0 ? `${this.hintsLeft} шт.` : '+3 🎬');
      this.hintSubText.setColor(this.hintsLeft > 0 ? '#94a3b8' : '#fde047');
    }

    if (this.shuffleSubText) {
      this.shuffleSubText.setText(this.shufflesLeft > 0 ? `${this.shufflesLeft} шт.` : '+1 🎬');
      this.shuffleSubText.setColor(this.shufflesLeft > 0 ? '#94a3b8' : '#fde047');
    }
  }

  private handleLevelWin() {
    this.soundMgr.playWin();
    if (this.timerEvent) this.timerEvent.destroy();

    // Reward for completing level: +25 ₽ to Piggy Bank
    this.economy.addRub(25);
    this.soundMgr.playCoin();

    let stars = 1;
    if (this.mistakes <= 5) stars = 2;
    if (this.timeElapsed <= this.levelConfig.timeLimit && this.mistakes <= 2) stars = 3;

    const timeBonus = Math.max(0, (this.levelConfig.timeLimit - this.timeElapsed) * 5);
    this.score += timeBonus;

    this.storage.saveLevelRecord(this.levelConfig.id, this.score, this.timeElapsed, stars);

    // Win Modal
    const modal = this.add.container(W / 2, H / 2);
    modal.setDepth(99999);

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.85);
    backdrop.fillRect(-W / 2, -H / 2, W, H);
    modal.add(backdrop);

    const panel = this.add.graphics();
    panel.fillStyle(0x083329, 0.98);
    panel.lineStyle(2, 0xfacc15, 1);
    panel.fillRoundedRect(-155, -190, 310, 380, 22);
    panel.strokeRoundedRect(-155, -190, 310, 380, 22);
    modal.add(panel);

    const title = this.add.text(0, -155, 'ПОБЕДА!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '26px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(title);

    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    modal.add(this.add.text(0, -115, starStr, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '34px',
      color: '#facc15',
    }).setOrigin(0.5));

    // Piggy Bank reward badge
    const cashBadge = this.add.text(0, -65, `🎁 В КОПИЛКУ: +${this.currency.formatRub(25)}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#4ade80',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(cashBadge);

    const stats = this.add.text(0, -20, `Счет: ${this.score.toLocaleString()} • Время: ${Math.floor(this.timeElapsed / 60)}:${(this.timeElapsed % 60).toString().padStart(2, '0')}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#cbd5e1',
    }).setOrigin(0.5);
    modal.add(stats);

    // Double piggy bank button
    const doubleBg = this.add.graphics();
    doubleBg.fillStyle(0x854d0e, 1);
    doubleBg.lineStyle(1.5, 0xfacc15, 1);
    doubleBg.fillRoundedRect(-125, 20, 250, 42, 21);
    modal.add(doubleBg);

    const doubleText = this.add.text(0, 41, '🎬 УДВОИТЬ ПРИЗ (x2)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(doubleText);

    const doubleZone = this.add.zone(0, 41, 250, 42).setInteractive({ useHandCursor: true });
    doubleZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      this.adService.showRewardedAd('double_score').then(watched => {
        if (watched) {
          this.economy.addRub(25);
          this.soundMgr.playCoin();
          this.soundMgr.playJackpot();
          cashBadge.setText(`🎉 УДВОЕНО: +${this.currency.formatRub(50)}!`);
          doubleText.setText('БОНУС ПОЛУЧЕН! ✓');
          doubleZone.disableInteractive();
          this.updateHud();
        }
      });
    });
    modal.add(doubleZone);

    // Next Level Button
    const nextIdx = this.levelIndex + 1 < LEVELS.length ? this.levelIndex + 1 : 0;
    const nextBg = this.add.graphics();
    nextBg.fillStyle(0x15803d, 1);
    nextBg.fillRoundedRect(-125, 75, 250, 42, 21);
    modal.add(nextBg);

    const nextText = this.add.text(0, 96, this.levelIndex + 1 < LEVELS.length ? 'СЛЕДУЮЩИЙ УРОВЕНЬ ▶' : 'СЫГРАТЬ СНАЧАЛА ↻', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(nextText);

    const nextZone = this.add.zone(0, 96, 250, 42).setInteractive({ useHandCursor: true });
    nextZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      modal.destroy();
      this.scene.restart({ levelIndex: nextIdx });
    });
    modal.add(nextZone);

    // Vault link
    const vaultLink = this.add.text(0, 145, 'Открыть копилку и вывод средств 🐷', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#7dd3fc',
      fontStyle: 'underline',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    vaultLink.on('pointerdown', () => VaultModal.show(() => this.updateHud()));
    modal.add(vaultLink);
  }

  private showLevelSelectModal() {
    this.soundMgr.playTileClick();
    const modal = this.add.container(W / 2, H / 2);
    modal.setDepth(99999);

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.85);
    backdrop.fillRect(-W / 2, -H / 2, W, H);
    modal.add(backdrop);

    const panel = this.add.graphics();
    panel.fillStyle(0x062e25, 0.98);
    panel.lineStyle(1.5, 0x16a34a, 1);
    panel.fillRoundedRect(-155, -200, 310, 400, 20);
    panel.strokeRoundedRect(-155, -200, 310, 400, 20);
    modal.add(panel);

    const title = this.add.text(0, -170, 'ВЫБОР УРОВНЯ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(title);

    const unlocked = this.storage.getUnlockedLevel();

    LEVELS.forEach((lvl, idx) => {
      const isUnlocked = lvl.id <= unlocked;
      const rec = this.storage.getLevelRecord(lvl.id);
      const y = -120 + idx * 58;

      const itemBg = this.add.graphics();
      itemBg.fillStyle(isUnlocked ? 0x0f5546 : 0x1e293b, 0.85);
      if (idx === this.levelIndex) {
        itemBg.lineStyle(1.5, 0xfacc15, 1);
      }
      itemBg.fillRoundedRect(-135, y, 270, 48, 12);
      if (idx === this.levelIndex) itemBg.strokeRoundedRect(-135, y, 270, 48, 12);
      modal.add(itemBg);

      const lvlText = this.add.text(-120, y + 15, `${lvl.id}. ${lvl.name}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: isUnlocked ? '#ffffff' : '#64748b',
        fontStyle: 'bold',
      });
      modal.add(lvlText);

      const starsText = this.add.text(-120, y + 31, isUnlocked ? `${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)} • Рекорд: ${rec.highScore}` : '🔒 Заблокировано', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: isUnlocked ? '#facc15' : '#64748b',
      });
      modal.add(starsText);

      if (isUnlocked) {
        const playZone = this.add.zone(0, y + 24, 270, 48).setInteractive({ useHandCursor: true });
        playZone.on('pointerdown', () => {
          this.soundMgr.playTileClick();
          modal.destroy();
          this.scene.restart({ levelIndex: idx });
        });
        modal.add(playZone);
      }
    });

    const closeBtn = this.add.text(0, 175, 'ЗАКРЫТЬ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#94a3b8',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => modal.destroy());
    modal.add(closeBtn);
  }
}
