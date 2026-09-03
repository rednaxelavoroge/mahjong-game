import Phaser from 'phaser';
import './style.css';
import { MahjongScene } from './scenes/MahjongScene';

// High-DPI modern smartphone portrait canvas (iPhone 14/15/16 Pro, Samsung S-series)
export const GAME_WIDTH = 420;
export const GAME_HEIGHT = 860;

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#07241e',
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
    pixelArt: false,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    activePointers: 2,
  },
  scene: [MahjongScene],
});
