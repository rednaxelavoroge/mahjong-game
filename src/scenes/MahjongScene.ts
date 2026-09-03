import Phaser from 'phaser';
import { LevelConfig } from '../game/layouts';
import { InfiniteLevelGenerator } from '../game/InfiniteLevelGenerator';
import { Tile, isFree, generateGuaranteedLevel, findOpenPair, smartShuffleRemaining } from '../game/solver';
import { TileRenderer } from '../game/TileRenderer';
import { SoundManager } from '../audio/SoundManager';
import { StorageService } from '../services/StorageService';
import { AdService } from '../services/AdService';
import { EconomyService } from '../services/EconomyService';
import { CurrencyService } from '../services/CurrencyService';
import { SocialService } from '../services/SocialService';
import { TournamentModal } from '../ui/TournamentModal';
import { WheelModal } from '../ui/WheelModal';
import { VaultModal } from '../ui/VaultModal';
import { ReferralModal } from '../ui/ReferralModal';

const W = 420;
const H = 860;
// Large, chunky, tactile tiles
const TILE_W = 58;
const TILE_H = 78;
const TRAY_CAPACITY = 4;
const TRAY_Y = 146;
const TRAY_SLOT_GAP = 70;

interface UndoStep {
  tile: Tile;
  fromTrayIndex: number;
}

export class MahjongScene extends Phaser.Scene {
  private levelNumber = 1;
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
  private social = SocialService.getInstance();

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

  // Social live ticker
  private socialTickerContainer!: Phaser.GameObjects.Container;
  private socialTickerText!: Phaser.GameObjects.Text;
  private socialTimerEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super('MahjongScene');
  }

  init(data?: { levelNumber?: number }) {
    if (data && typeof data.levelNumber === 'number') {
      this.levelNumber = Math.max(1, data.levelNumber);
    } else {
      this.levelNumber = this.storage.getUnlockedLevel();
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#06241c');
    this.levelConfig = InfiniteLevelGenerator.getLevelConfig(this.levelNumber);

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
    this.createSocialTicker();
    this.drawControls();

    // Board container placed comfortably in the center
    this.boardContainer = this.add.container(W / 2, 455);

    // Generate guaranteed solvable board with Golden Tiles
    this.tiles = generateGuaranteedLevel(this.levelConfig);
    this.renderTiles();

    // Level timer
    if (this.timerEvent) this.timerEvent.destroy();
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.timeElapsed++;
        this.updateTimerDisplay();
      },
      loop: true,
    });

    // Social feed ticker (every 16 seconds)
    if (this.socialTimerEvent) this.socialTimerEvent.destroy();
    this.socialTimerEvent = this.time.addEvent({
      delay: 16000,
      callback: () => this.triggerSocialNotification(),
      loop: true,
    });

    this.updateHud();
  }

  private drawBackground() {
    const bg = this.add.graphics();
    // High-contrast luxury dark emerald casino felt table
    bg.fillGradientStyle(0x0a3930, 0x0a3930, 0x031c16, 0x031c16, 1);
    bg.fillRect(0, 0, W, H);

    for (let i = 0; i < 28; i++) {
      bg.fillStyle(0x166534, 0.08);
      const cx = (i * 79) % W;
      const cy = 40 + (i * 119) % (H - 80);
      bg.fillCircle(cx, cy, 40 + (i % 3) * 18);
    }
  }

  private createHeader() {
    this.hudContainer = this.add.container(0, 0);

    // Top Header Bar
    const topBar = this.add.graphics();
    topBar.fillStyle(0x01130e, 0.9);
    topBar.fillRect(0, 0, W, 96);
    this.hudContainer.add(topBar);

    // 1. Level selector button
    const levelPill = this.add.graphics();
    levelPill.fillStyle(0x0d473a, 0.95);
    levelPill.lineStyle(1.5, 0x22c55e, 0.5);
    levelPill.fillRoundedRect(12, 12, 110, 34, 17);
    levelPill.strokeRoundedRect(12, 12, 110, 34, 17);
    this.hudContainer.add(levelPill);

    const levelTitle = this.add.text(67, 29, `УР. ${this.levelNumber} ▾`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#86efac',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudContainer.add(levelTitle);

    const levelZone = this.add.zone(67, 29, 110, 34).setInteractive({ useHandCursor: true });
    levelZone.on('pointerdown', () => this.showLevelSelectModal());
    this.hudContainer.add(levelZone);

    // 2. Piggy Bank / Vault button (🐷 150 ₽)
    const vaultPill = this.add.graphics();
    vaultPill.fillStyle(0x854d0e, 0.95);
    vaultPill.lineStyle(1.5, 0xfacc15, 0.9);
    vaultPill.fillRoundedRect(130, 12, 120, 34, 17);
    vaultPill.strokeRoundedRect(130, 12, 120, 34, 17);
    this.hudContainer.add(vaultPill);

    this.vaultButtonText = this.add.text(190, 29, `🐷 ${this.economy.getFormattedBalance()}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudContainer.add(this.vaultButtonText);

    const vaultZone = this.add.zone(190, 29, 120, 34).setInteractive({ useHandCursor: true });
    vaultZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      VaultModal.show(() => this.updateHud());
    });
    this.hudContainer.add(vaultZone);

    // 3. Referral Friends Button (👥 ДРУЗЬЯ)
    const refPill = this.add.graphics();
    refPill.fillStyle(0x0369a1, 0.95);
    refPill.lineStyle(1.5, 0x38bdf8, 0.8);
    refPill.fillRoundedRect(258, 12, 105, 34, 17);
    refPill.strokeRoundedRect(258, 12, 105, 34, 17);
    this.hudContainer.add(refPill);

    const refText = this.add.text(310, 29, '👥 ДРУЗЬЯ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#e0f2fe',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudContainer.add(refText);

    const refZone = this.add.zone(310, 29, 105, 34).setInteractive({ useHandCursor: true });
    refZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      ReferralModal.show(() => this.updateHud());
    });
    this.hudContainer.add(refZone);

    // 4. Sound Mute Toggle
    const soundPill = this.add.graphics();
    soundPill.fillStyle(0x0d473a, 0.95);
    soundPill.fillCircle(W - 25, 29, 17);
    this.hudContainer.add(soundPill);

    this.soundBtnText = this.add.text(W - 25, 29, this.soundMgr.isMuted() ? '🔇' : '🔊', {
      fontSize: '14px',
    }).setOrigin(0.5);
    this.hudContainer.add(this.soundBtnText);

    const soundZone = this.add.zone(W - 25, 29, 36, 36).setInteractive({ useHandCursor: true });
    soundZone.on('pointerdown', () => {
      const muted = this.soundMgr.toggleMute();
      this.soundBtnText.setText(muted ? '🔇' : '🔊');
    });
    this.hudContainer.add(soundZone);

    // Sub-header row: Timer, Score, Country Tournament link
    this.timerText = this.add.text(18, 70, '⏱ 00:00', {
      fontFamily: 'system-ui, monospace',
      fontSize: '13px',
      color: '#94a3b8',
      fontStyle: 'bold',
    });
    this.hudContainer.add(this.timerText);

    this.scoreText = this.add.text(W / 2, 70, 'СЧЕТ: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.hudContainer.add(this.scoreText);

    const tourneySmall = this.add.text(W - 18, 70, `🏆 ${this.social.getUserCountry()} Рейтинг`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    tourneySmall.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      TournamentModal.show(this.levelNumber);
    });
    this.hudContainer.add(tourneySmall);
  }

  /**
   * Creates the 4-slot Tray bar at the top (Large Vita Mahjong style)
   */
  private createTray() {
    this.traySlotsContainer = this.add.container(0, TRAY_Y);
    this.traySlotsContainer.setDepth(9000);

    const shelfW = 295;
    const shelfH = 92;

    const shelf = this.add.graphics();
    shelf.fillStyle(0x021611, 0.95);
    shelf.lineStyle(2, 0x0f766e, 0.9);
    shelf.fillRoundedRect(W / 2 - shelfW / 2, -shelfH / 2, shelfW, shelfH, 20);
    shelf.strokeRoundedRect(W / 2 - shelfW / 2, -shelfH / 2, shelfW, shelfH, 20);
    this.traySlotsContainer.add(shelf);

    this.trayWarningGfx = this.add.graphics();
    this.traySlotsContainer.add(this.trayWarningGfx);

    // 4 Large glass slot frames
    for (let i = 0; i < TRAY_CAPACITY; i++) {
      const slotX = this.getTraySlotX(i);
      const slotGfx = this.add.graphics();
      slotGfx.fillStyle(0x04201a, 0.85);
      slotGfx.lineStyle(1.5, 0x14b8a6, 0.45);
      slotGfx.fillRoundedRect(slotX - TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 10);
      slotGfx.strokeRoundedRect(slotX - TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 10);
      this.traySlotsContainer.add(slotGfx);
    }

    // Combo streak badge right below tray
    this.comboBadge = this.add.container(W / 2, TRAY_Y + 58);
    const comboGfx = this.add.graphics();
    comboGfx.fillStyle(0xf59e0b, 0.95);
    comboGfx.fillRoundedRect(-60, -11, 120, 22, 11);
    this.comboText = this.add.text(0, 0, '🔥 COMBO x2!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#1e293b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.comboBadge.add([comboGfx, this.comboText]);
    this.comboBadge.setAlpha(0);
    this.hudContainer.add(this.comboBadge);
  }

  private createSocialTicker() {
    this.socialTickerContainer = this.add.container(W / 2, 680);
    this.socialTickerContainer.setDepth(9990);
    this.socialTickerContainer.setAlpha(0);

    const tickerBg = this.add.graphics();
    tickerBg.fillStyle(0x011611, 0.92);
    tickerBg.lineStyle(1, 0x10b981, 0.4);
    tickerBg.fillRoundedRect(-155, -15, 310, 30, 15);
    tickerBg.strokeRoundedRect(-155, -15, 310, 30, 15);
    this.socialTickerContainer.add(tickerBg);

    this.socialTickerText = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#86efac',
    }).setOrigin(0.5);
    this.socialTickerContainer.add(this.socialTickerText);

    this.time.delayedCall(3500, () => this.triggerSocialNotification());
  }

  private triggerSocialNotification() {
    const ev = this.social.getRandomLiveEvent(this.levelNumber);
    const cleanText = `${ev.avatar} ${ev.text.replace(/<[^>]*>?/gm, '')}`;
    this.socialTickerText.setText(cleanText);

    this.tweens.add({
      targets: this.socialTickerContainer,
      alpha: 1,
      y: 672,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(5000, () => {
          this.tweens.add({
            targets: this.socialTickerContainer,
            alpha: 0,
            y: 685,
            duration: 300,
            ease: 'Sine.easeIn',
          });
        });
      },
    });
  }

  private getTraySlotX(index: number): number {
    return W / 2 - (1.5 - index) * TRAY_SLOT_GAP;
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
      // High-Definition Tile Rendering via TileRenderer
      const c = TileRenderer.createTileContainer(this, tile, TILE_W, TILE_H);
      tile.sprite = c;

      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => this.handleTileClick(tile));
      c.setDepth(tile.z * 100 + (tile.y + 400));

      this.boardContainer.add(c);
    }
  }

  private handleTileClick(tile: Tile) {
    if (tile.removed || this.isProcessingFlight) return;

    const free = isFree(tile, this.tiles, this.levelConfig.stepX, this.levelConfig.stepY);
    if (!free) {
      this.soundMgr.playBump();
      this.bumpTile(tile);
      this.statusText.setText('Кость заблокирована другими костями!');
      return;
    }

    const freeSlotIndex = this.tray.findIndex(t => t === null);
    if (freeSlotIndex === -1) {
      this.soundMgr.playBump();
      this.shakeTray();
      this.statusText.setText('⚠️ Лоток переполнен! Нет свободных слотов');
      this.checkTrayOverflow();
      return;
    }

    this.isProcessingFlight = true;
    this.soundMgr.playTrayFly();

    this.tray[freeSlotIndex] = tile;
    tile.removed = true;
    this.moves++;

    this.undoStack.push({ tile, fromTrayIndex: freeSlotIndex });

    const targetX = this.getTraySlotX(freeSlotIndex);
    const targetY = TRAY_Y;

    const sp = tile.sprite!;
    const worldX = this.boardContainer.x + sp.x;
    const worldY = this.boardContainer.y + sp.y;

    this.boardContainer.remove(sp);
    this.add.existing(sp);
    sp.setPosition(worldX, worldY);
    sp.setDepth(9999);

    this.tweens.add({
      targets: sp,
      x: targetX,
      y: targetY,
      scaleX: 1.06,
      scaleY: 1.06,
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

  private checkTrayMatches() {
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
      this.handleTrayPairMatch(matchA, matchB);
    } else {
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

    this.tray[indexA] = null;
    this.tray[indexB] = null;

    const now = this.time.now;
    if (this.lastMatchTime > 0 && now - this.lastMatchTime < 3500) {
      this.combo = Math.min(this.combo + 1, 5);
      this.showComboBadge();
    } else {
      this.combo = 1;
      this.hideComboBadge();
    }
    this.lastMatchTime = now;

    const pointsGained = 150 * this.combo;
    this.score += pointsGained;

    const cashRub = isGold ? 15 : 2;
    this.economy.addRub(cashRub);
    this.soundMgr.playCoin();
    this.soundMgr.playMatch(this.combo);

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

    const popupText = isGold ? `🎉 ЗОЛОТО! +${this.currency.formatRub(cashRub)}` : `+${pointsGained} (${this.currency.formatRub(cashRub)})`;
    this.spawnScorePopup(midX, TRAY_Y - 20, popupText, isGold ? '#fef08a' : '#86efac');

    this.time.delayedCall(200, () => {
      this.compactTray();
      this.updateHud();

      if (isGold) {
        this.time.delayedCall(250, () => {
          WheelModal.show((reward) => {
            if (reward.type === 'hints') this.hintsLeft += reward.value;
            if (reward.type === 'shuffle') this.shufflesLeft += reward.value;
            this.updateHud();
          });
        });
      }

      if (this.tiles.every(t => t.removed) && this.tray.every(t => t === null)) {
        this.handleLevelWin();
      }
    });
  }

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

    this.trayWarningGfx.clear();
    this.trayWarningGfx.lineStyle(3, 0xef4444, 1);
    this.trayWarningGfx.strokeRoundedRect(W / 2 - 295 / 2, -92 / 2, 295, 92, 20);

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

    const modal = this.add.container(W / 2, H / 2);
    modal.setDepth(99999);

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.85);
    backdrop.fillRect(-W / 2, -H / 2, W, H);
    modal.add(backdrop);

    const panel = this.add.graphics();
    panel.fillStyle(0x092e25, 0.98);
    panel.lineStyle(2, 0xef4444, 1);
    panel.fillRoundedRect(-155, -140, 310, 280, 22);
    panel.strokeRoundedRect(-155, -140, 310, 280, 22);
    modal.add(panel);

    const icon = this.add.text(0, -100, '⚠️', { fontSize: '36px' }).setOrigin(0.5);
    const title = this.add.text(0, -62, 'ЛОТОК ПОЛОН!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#f87171',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const desc = this.add.text(0, -20, 'Все 4 слота заняты разными костями.\nОсвободите 2 слота, чтобы продолжить!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#e2e8f0',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
    modal.add([icon, title, desc]);

    const adBtnBg = this.add.graphics();
    adBtnBg.fillStyle(0x15803d, 1);
    adBtnBg.fillRoundedRect(-125, 22, 250, 44, 22);
    modal.add(adBtnBg);

    const adBtnText = this.add.text(0, 44, '🎬 ОЧИСТИТЬ 2 СЛОТА', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(adBtnText);

    const adZone = this.add.zone(0, 44, 250, 44).setInteractive({ useHandCursor: true });
    adZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      this.adService.showRewardedAd('shuffle').then(watched => {
        if (watched) {
          modal.destroy();
          this.removeTilesFromTray(2);
        }
      });
    });
    modal.add(adZone);

    const undoBtn = this.add.text(0, 100, '↶ Отменить последний ход', {
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
      x: 7,
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
      x: tile.x + 6,
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
      fontSize: '16px',
      color: color,
      fontStyle: 'bold',
      stroke: '#01140e',
      strokeThickness: 3,
    }).setOrigin(0.5);
    popup.setDepth(10000);

    this.tweens.add({
      targets: popup,
      y: y - 45,
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
      y: tile.sprite.y - 8,
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
    this.statusText = this.add.text(W / 2, 725, 'Забирайте кости в лоток парами!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#d1fae5',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const buttons = [
      {
        id: 'restart',
        x: 60,
        icon: '↻',
        title: 'ЗАНОВО',
        sub: 'Сброс',
        action: () => this.scene.restart({ levelNumber: this.levelNumber }),
      },
      {
        id: 'hint',
        x: 156,
        icon: '✦',
        title: 'ПОДСКАЗКА',
        sub: `${this.hintsLeft} шт.`,
        action: () => this.hint(),
      },
      {
        id: 'shuffle',
        x: 264,
        icon: '🔀',
        title: 'ПЕРЕМЕШАТЬ',
        sub: `${this.shufflesLeft} шт.`,
        action: () => this.shuffle(),
      },
      {
        id: 'undo',
        x: 360,
        icon: '↶',
        title: 'ОТМЕНА',
        sub: 'Назад',
        action: () => this.undo(),
      },
    ];

    for (const b of buttons) {
      const bg = this.add.graphics();
      bg.fillStyle(0x0a3f34, 0.95);
      bg.lineStyle(1.5, 0x16a34a, 0.85);
      bg.fillCircle(b.x, 786, 30);
      bg.strokeCircle(b.x, 786, 30);

      const icon = this.add.text(b.x, 779, b.icon, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#fef08a',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(b.x, 822, b.title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        color: '#86efac',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const subText = this.add.text(b.x, 834, b.sub, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        color: '#94a3b8',
      }).setOrigin(0.5);

      if (b.id === 'hint') this.hintSubText = subText;
      if (b.id === 'shuffle') this.shuffleSubText = subText;

      const zone = this.add.zone(b.x, 790, 64, 68).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.soundMgr.playTileClick();
        b.action();
      });
    }
  }

  private updateHud() {
    this.vaultButtonText?.setText(`🐷 ${this.economy.getFormattedBalance()}`);

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
    if (this.socialTimerEvent) this.socialTimerEvent.destroy();

    this.economy.addRub(25);
    this.soundMgr.playCoin();

    let stars = 1;
    if (this.mistakes <= 5) stars = 2;
    if (this.timeElapsed <= this.levelConfig.timeLimit && this.mistakes <= 2) stars = 3;

    const timeBonus = Math.max(0, (this.levelConfig.timeLimit - this.timeElapsed) * 5);
    this.score += timeBonus;

    this.storage.saveLevelRecord(this.levelNumber, this.score, this.timeElapsed, stars);

    const modal = this.add.container(W / 2, H / 2);
    modal.setDepth(99999);

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.85);
    backdrop.fillRect(-W / 2, -H / 2, W, H);
    modal.add(backdrop);

    const panel = this.add.graphics();
    panel.fillStyle(0x083329, 0.98);
    panel.lineStyle(2, 0xfacc15, 1);
    panel.fillRoundedRect(-165, -200, 330, 400, 24);
    panel.strokeRoundedRect(-165, -200, 330, 400, 24);
    modal.add(panel);

    const title = this.add.text(0, -165, 'ПОБЕДА!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(title);

    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    modal.add(this.add.text(0, -120, starStr, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '36px',
      color: '#facc15',
    }).setOrigin(0.5));

    const cashBadge = this.add.text(0, -68, `🎁 В КОПИЛКУ: +${this.currency.formatRub(25)}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#4ade80',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(cashBadge);

    const stats = this.add.text(0, -20, `Счет: ${this.score.toLocaleString()} • Уровень ${this.levelNumber} пройден!`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#cbd5e1',
    }).setOrigin(0.5);
    modal.add(stats);

    // Double button
    const doubleBg = this.add.graphics();
    doubleBg.fillStyle(0x854d0e, 1);
    doubleBg.lineStyle(1.5, 0xfacc15, 1);
    doubleBg.fillRoundedRect(-135, 20, 270, 44, 22);
    modal.add(doubleBg);

    const doubleText = this.add.text(0, 42, '🎬 УДВОИТЬ ПРИЗ (x2)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(doubleText);

    const doubleZone = this.add.zone(0, 42, 270, 44).setInteractive({ useHandCursor: true });
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
    const nextLevelNum = this.levelNumber + 1;
    const nextBg = this.add.graphics();
    nextBg.fillStyle(0x15803d, 1);
    nextBg.fillRoundedRect(-135, 78, 270, 44, 22);
    modal.add(nextBg);

    const nextText = this.add.text(0, 100, `УРОВЕНЬ ${nextLevelNum} ▶`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(nextText);

    const nextZone = this.add.zone(0, 100, 270, 44).setInteractive({ useHandCursor: true });
    nextZone.on('pointerdown', () => {
      this.soundMgr.playTileClick();
      modal.destroy();
      this.scene.restart({ levelNumber: nextLevelNum });
    });
    modal.add(nextZone);

    // Vault link
    const vaultLink = this.add.text(0, 152, 'Открыть копилку и вывод средств 🐷', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
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
    panel.fillRoundedRect(-165, -210, 330, 420, 22);
    panel.strokeRoundedRect(-165, -210, 330, 420, 22);
    modal.add(panel);

    const title = this.add.text(0, -180, 'ВЫБОР УРОВНЯ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(title);

    const maxUnlocked = this.storage.getUnlockedLevel();
    let pageStart = Math.max(1, Math.floor((this.levelNumber - 1) / 6) * 6 + 1);

    const contentContainer = this.add.container(0, 0);
    modal.add(contentContainer);

    const renderPage = (start: number) => {
      contentContainer.removeAll(true);

      for (let i = 0; i < 6; i++) {
        const lvl = start + i;
        const isUnlocked = lvl <= maxUnlocked;
        const rec = this.storage.getLevelRecord(lvl);
        const y = -130 + i * 46;

        const itemBg = this.add.graphics();
        itemBg.fillStyle(isUnlocked ? 0x0f5546 : 0x1e293b, 0.85);
        if (lvl === this.levelNumber) {
          itemBg.lineStyle(1.5, 0xfacc15, 1);
        }
        itemBg.fillRoundedRect(-145, y, 290, 40, 10);
        if (lvl === this.levelNumber) itemBg.strokeRoundedRect(-145, y, 290, 40, 10);
        contentContainer.add(itemBg);

        const lvlCfg = InfiniteLevelGenerator.getLevelConfig(lvl);
        const lvlText = this.add.text(-130, y + 12, `${lvl}. ${lvlCfg.name}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: isUnlocked ? '#ffffff' : '#64748b',
          fontStyle: 'bold',
        });
        contentContainer.add(lvlText);

        const starsText = this.add.text(130, y + 12, isUnlocked ? (rec.completed ? '★'.repeat(rec.stars) : 'НОВЫЙ') : '🔒', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: isUnlocked ? '#facc15' : '#64748b',
        }).setOrigin(1, 0);
        contentContainer.add(starsText);

        if (isUnlocked) {
          const playZone = this.add.zone(0, y + 20, 290, 40).setInteractive({ useHandCursor: true });
          playZone.on('pointerdown', () => {
            this.soundMgr.playTileClick();
            modal.destroy();
            this.scene.restart({ levelNumber: lvl });
          });
          contentContainer.add(playZone);
        }
      }

      const prevBtn = this.add.text(-85, 160, '◀ Назад', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: start > 1 ? '#38bdf8' : '#64748b',
      }).setOrigin(0.5).setInteractive({ useHandCursor: start > 1 });
      prevBtn.on('pointerdown', () => {
        if (start > 1) renderPage(start - 6);
      });
      contentContainer.add(prevBtn);

      const nextBtn = this.add.text(85, 160, 'Вперед ▶', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#38bdf8',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => {
        renderPage(start + 6);
      });
      contentContainer.add(nextBtn);
    };

    renderPage(pageStart);

    const closeBtn = this.add.text(0, 192, 'ЗАКРЫТЬ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#94a3b8',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => modal.destroy());
    modal.add(closeBtn);
  }
}
