import { SoundManager } from '../audio/SoundManager';
import { EconomyService } from '../services/EconomyService';
import { CurrencyService } from '../services/CurrencyService';

export interface WheelSector {
  id: string;
  label: string;
  sub: string;
  color: string;
  textColor: string;
  type: 'cash_rub' | 'hints' | 'shuffle' | 'ticket';
  value: number;
}

export const SECTORS: WheelSector[] = [
  { id: '1', label: '+50 ₽', sub: 'В копилку', color: '#eab308', textColor: '#422006', type: 'cash_rub', value: 50 },
  { id: '2', label: '+3 ✦', sub: 'Подсказки', color: '#0284c7', textColor: '#ffffff', type: 'hints', value: 3 },
  { id: '3', label: '+25 ₽', sub: 'В копилку', color: '#16a34a', textColor: '#ffffff', type: 'cash_rub', value: 25 },
  { id: '4', label: 'ДЖЕКПОТ', sub: '+100 ₽', color: '#dc2626', textColor: '#ffffff', type: 'cash_rub', value: 100 },
  { id: '5', label: '+2 🔀', sub: 'Перемешать', color: '#9333ea', textColor: '#ffffff', type: 'shuffle', value: 2 },
  { id: '6', label: '+15 ₽', sub: 'В копилку', color: '#f59e0b', textColor: '#451a03', type: 'cash_rub', value: 15 },
  { id: '7', label: 'OZON 🎁', sub: '+75 ₽', color: '#2563eb', textColor: '#ffffff', type: 'cash_rub', value: 75 },
  { id: '8', label: '+30 ₽', sub: 'В копилку', color: '#10b981', textColor: '#ffffff', type: 'cash_rub', value: 30 },
];

export class WheelModal {
  private static overlay: HTMLElement | null = null;

  public static show(onRewardClaimed: (reward: WheelSector) => void) {
    if (this.overlay) return;

    const soundMgr = SoundManager.getInstance();
    const economy = EconomyService.getInstance();
    const currency = CurrencyService.getInstance();

    soundMgr.playJackpot();

    const overlay = document.createElement('div');
    overlay.id = 'lucky-wheel-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    overlay.style.color = '#fff';

    overlay.innerHTML = `
      <div style="
        background: radial-gradient(circle at center, #1b4d3e, #06231c);
        border: 2px solid #facc15;
        border-radius: 26px;
        padding: 24px;
        width: 90%;
        max-width: 360px;
        text-align: center;
        box-shadow: 0 0 50px rgba(234, 179, 8, 0.35);
        position: relative;
        overflow: hidden;
      ">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #fde047; font-weight: 800; margin-bottom: 4px;">
          ✨ ЗОЛОТАЯ КОСТЬ СОБРАНА! ✨
        </div>
        <div style="font-size: 24px; font-weight: 900; color: #ffffff; margin-bottom: 14px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">
          КОЛЕСО ФОРТУНЫ
        </div>

        <!-- Wheel Canvas Area -->
        <div style="position: relative; width: 260px; height: 260px; margin: 0 auto 18px;">
          <!-- Top Arrow Pointer -->
          <div style="
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 14px solid transparent;
            border-right: 14px solid transparent;
            border-top: 24px solid #ef4444;
            z-index: 10;
            filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));
          "></div>

          <canvas id="wheel-canvas" width="260" height="260" style="border-radius: 50%; box-shadow: 0 8px 25px rgba(0,0,0,0.6);"></canvas>
          
          <!-- Center Golden Peg -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 48px;
            height: 48px;
            background: radial-gradient(circle, #fef08a, #ca8a04);
            border-radius: 50%;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            cursor: pointer;
            z-index: 5;
          ">🪙</div>
        </div>

        <div id="wheel-status-text" style="font-size: 13px; color: #cbd5e1; margin-bottom: 14px; min-height: 20px;">
          Нажмите кнопку ниже, чтобы испытать удачу!
        </div>

        <button id="wheel-spin-btn" style="
          width: 100%;
          background: linear-gradient(135deg, #eab308, #ca8a04);
          color: #1e293b;
          border: none;
          padding: 13px;
          border-radius: 16px;
          font-weight: 900;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(234, 179, 8, 0.4);
          letter-spacing: 0.5px;
        ">КРУТИТЬ РУЛЕТКУ 🎰</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;

    const canvas = overlay.querySelector('#wheel-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const spinBtn = overlay.querySelector('#wheel-spin-btn') as HTMLButtonElement;
    const statusText = overlay.querySelector('#wheel-status-text') as HTMLElement;

    let currentAngle = 0;
    const numSectors = SECTORS.length;
    const arc = (2 * Math.PI) / numSectors;

    const drawWheel = (rotation: number) => {
      ctx.clearRect(0, 0, 260, 260);
      const cx = 130;
      const cy = 130;
      const radius = 125;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);

      SECTORS.forEach((sec, i) => {
        const angle = i * arc;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, angle, angle + arc);
        ctx.closePath();
        ctx.fillStyle = sec.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fef08a';
        ctx.stroke();

        // Sector text
        ctx.save();
        ctx.rotate(angle + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = sec.textColor;
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText(sec.label, radius - 15, 4);

        ctx.font = '9px system-ui, sans-serif';
        ctx.fillText(sec.sub, radius - 15, 16);
        ctx.restore();
      });

      ctx.restore();
    };

    drawWheel(0);

    let isSpinning = false;

    spinBtn.onclick = () => {
      if (isSpinning) return;
      isSpinning = true;
      spinBtn.disabled = true;
      spinBtn.style.opacity = '0.5';
      spinBtn.style.cursor = 'not-allowed';
      statusText.innerText = 'Колесо вращается... Удачи!';

      // Target random winning sector
      const winningIndex = Math.floor(Math.random() * numSectors);
      const winningSector = SECTORS[winningIndex];

      // Calculate final target angle
      // Note: pointer is at TOP (-PI/2)
      // Sector i is at angle: i * arc to (i+1)*arc
      const targetSectorMiddle = (winningIndex + 0.5) * arc;
      const extraSpins = (5 + Math.floor(Math.random() * 3)) * (2 * Math.PI);
      const totalRotation = extraSpins + (1.5 * Math.PI - targetSectorMiddle);

      const duration = 4000;
      const startTime = performance.now();
      let lastTickAngle = 0;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Quartic ease out
        const easeOut = 1 - Math.pow(1 - progress, 4);
        currentAngle = totalRotation * easeOut;

        // Play tick sound on sector crossing
        if (Math.abs(currentAngle - lastTickAngle) >= arc * 0.7) {
          soundMgr.playWheelTick();
          lastTickAngle = currentAngle;
        }

        drawWheel(currentAngle);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Finished spin!
          soundMgr.playCoin();
          soundMgr.playWin();

          if (winningSector.type === 'cash_rub') {
            economy.addRub(winningSector.value);
            const valFormatted = currency.formatRub(winningSector.value);
            statusText.innerHTML = `🎉 ВЫИГРЫШ: <b style="color: #4ade80;">+${valFormatted}</b> в Копилку!`;
          } else {
            statusText.innerHTML = `🎉 ВЫИГРЫШ: <b style="color: #fde047;">${winningSector.label} ${winningSector.sub}</b>!`;
          }

          spinBtn.disabled = false;
          spinBtn.style.opacity = '1';
          spinBtn.style.cursor = 'pointer';
          spinBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          spinBtn.style.color = '#fff';
          spinBtn.innerText = 'ЗАБРАТЬ ПРИЗ 🎁';

          spinBtn.onclick = () => {
            overlay.remove();
            WheelModal.overlay = null;
            onRewardClaimed(winningSector);
          };
        }
      };

      requestAnimationFrame(animate);
    };
  }
}
