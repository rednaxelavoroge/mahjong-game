import Phaser from 'phaser';
import './style.css';
import { MahjongScene } from './scenes/MahjongScene';

const W = 390;
const H = 760;

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game',
  backgroundColor: '#09382f',
  render: {
    antialias: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  input: {
    activePointers: 2,
  },
  scene: [MahjongScene],
});
