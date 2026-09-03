import Phaser from 'phaser';
import { Tile } from './solver';

/**
 * High-Definition 3D Mahjong Tile Renderer
 * Produces authentic luxury two-tone Mahjong tiles:
 * - Top layer: Polished ivory-white face with glossy bevel and crisp calligraphy
 * - Bottom layer: Thick emerald jade / acrylic backing for authentic 3D depth
 * - Golden jackpot tiles: Metallic 24K gold foil with shimmering aura
 */
export class TileRenderer {
  /**
   * Generates a crisp, high-resolution container for a Mahjong tile
   * @param scene Phaser scene
   * @param tile Tile data
   * @param w Tile width in pixels
   * @param h Tile height in pixels
   */
  public static createTileContainer(
    scene: Phaser.Scene,
    tile: Tile,
    w: number,
    h: number
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(tile.x, tile.y - tile.z * 10);
    const radius = Math.round(w * 0.16); // smooth rounded corners
    const depth3D = 7; // thickness of the green back layer

    // 1. Soft Realistic Drop Shadow
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x01140e, 0.55);
    shadow.fillRoundedRect(-w / 2 + 5, -h / 2 + 8, w, h, radius);

    // 2. Thick 3D Emerald Jade Backing (Authentic Chinese Mahjong two-tone look)
    const jadeBack = scene.add.graphics();
    if (tile.isGold) {
      // Golden metallic side edge
      jadeBack.fillStyle(0x92400e, 1);
      jadeBack.lineStyle(2, 0x78350f, 1);
    } else {
      // Deep imperial jade green
      jadeBack.fillStyle(0x064e3b, 1);
      jadeBack.lineStyle(1.5, 0x022c22, 1);
    }
    jadeBack.fillRoundedRect(-w / 2, -h / 2 + depth3D, w, h - 2, radius);
    jadeBack.strokeRoundedRect(-w / 2, -h / 2 + depth3D, w, h - 2, radius);

    // 3. Ivory-White Face Layer
    const face = scene.add.graphics();
    if (tile.isGold) {
      // Radiant Gold Gradient
      face.fillGradientStyle(0xfffbeb, 0xfffbeb, 0xfacc15, 0xd97706, 1);
      face.lineStyle(2.5, 0xfef08a, 1);
    } else {
      // Polished Ivory Porcelain
      face.fillGradientStyle(0xffffff, 0xffffff, 0xf6f0e2, 0xede4d0, 1);
      face.lineStyle(1.5, 0xe2d7bf, 1);
    }
    face.fillRoundedRect(-w / 2, -h / 2, w, h - depth3D, radius);
    face.strokeRoundedRect(-w / 2, -h / 2, w, h - depth3D, radius);

    // 4. Subtle Inner Bevel / Border (makes it look like real carved stone)
    const innerBorder = scene.add.graphics();
    innerBorder.lineStyle(1, tile.isGold ? 0xca8a04 : 0xffffff, tile.isGold ? 0.6 : 0.8);
    innerBorder.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - depth3D - 6, radius - 2);

    // 5. Top Glossy Reflection
    const gloss = scene.add.graphics();
    gloss.fillStyle(0xffffff, tile.isGold ? 0.6 : 0.45);
    gloss.fillRoundedRect(-w / 2 + 5, -h / 2 + 4, w - 10, Math.round(h * 0.18), radius - 3);

    container.add([shadow, jadeBack, face, innerBorder, gloss]);

    // 6. Large, Crisp Calligraphy & Symbols
    const symbolColor = tile.isGold ? '#78350f' : tile.color;
    const isDoubleChar = tile.kind.length > 1;
    const fontSize = tile.isGold
      ? Math.round(h * 0.48)
      : isDoubleChar
      ? Math.round(h * 0.36)
      : Math.round(h * 0.52);

    const mainSymbol = scene.add.text(0, -Math.round(depth3D / 2), tile.kind, {
      fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Apple Color Emoji", system-ui, sans-serif',
      fontSize: `${fontSize}px`,
      color: symbolColor,
      fontStyle: 'bold',
      stroke: tile.isGold ? '#fef08a' : '#ffffff',
      strokeThickness: tile.isGold ? 1 : 2,
    }).setOrigin(0.5);

    container.add(mainSymbol);

    // 7. Mini Corner Index (Vita Mahjong style: easy readability for seniors & pros)
    const cornerChar = this.getCornerHelper(tile.kind);
    if (cornerChar && !tile.isGold) {
      const corner = scene.add.text(-w / 2 + 7, -h / 2 + 5, cornerChar, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: `${Math.round(h * 0.16)}px`,
        color: '#64748b',
        fontStyle: 'bold',
      }).setOrigin(0, 0);
      container.add(corner);
    }

    // 8. Layer Badge for elevated 3D tiles (dots in bottom corner)
    if (tile.z > 0) {
      const layerIndicator = scene.add.text(w / 2 - 8, h / 2 - depth3D - 8, tile.z >= 2 ? '◆' : '•', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: tile.z >= 2 ? '10px' : '14px',
        color: tile.isGold ? '#92400e' : '#065f46',
        fontStyle: 'bold',
      }).setOrigin(1, 1);
      container.add(layerIndicator);
    }

    // Shimmer effect for Golden Jackpot Tiles
    if (tile.isGold) {
      scene.tweens.add({
        targets: gloss,
        alpha: 0.95,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    container.setSize(w, h);
    return container;
  }

  /**
   * Provides quick western corner indices for traditional Chinese characters (like in Vita Mahjong)
   */
  private static getCornerHelper(kind: string): string {
    const map: Record<string, string> = {
      '🀄': '中',
      '🀅': '發',
      '●●': '2',
      '◆◆': '4',
      '♠': 'A',
      '♥': 'K',
      '♣': 'Q',
      '♦': 'J',
      '一萬': '1',
      '二萬': '2',
      '三萬': '3',
      '五萬': '5',
      '八萬': '8',
      '九萬': '9',
    };
    return map[kind] || '';
  }
}
