import { EconomyService } from '../services/EconomyService';
import { CurrencyService } from '../services/CurrencyService';
import { SoundManager } from '../audio/SoundManager';

export class ReferralModal {
  private static overlay: HTMLElement | null = null;

  public static show(onUpdated?: () => void) {
    if (this.overlay) return;

    const economy = EconomyService.getInstance();
    const currency = CurrencyService.getInstance();
    const soundMgr = SoundManager.getInstance();

    const overlay = document.createElement('div');
    overlay.id = 'referral-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    overlay.style.color = '#fff';

    const render = () => {
      const count = economy.getInvitedCount();
      const shareLink = economy.getReferralShareLink();
      const bonus100 = currency.formatRub(100);

      overlay.innerHTML = `
        <div style="
          background: linear-gradient(155deg, #18473b, #09261f);
          border: 2px solid #38bdf8;
          border-radius: 24px;
          padding: 24px;
          width: 90%;
          max-width: 360px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.7);
          text-align: center;
          position: relative;
        ">
          <!-- Close button -->
          <button id="ref-close-btn" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 22px; color: #94a3b8; cursor: pointer;">✕</button>

          <div style="font-size: 38px; margin-bottom: 6px;">👥</div>
          <div style="font-size: 20px; font-weight: 900; color: #fef08a; margin-bottom: 6px;">
            ПОЗОВИ 3 ДРУЗЕЙ
          </div>
          <div style="font-size: 12px; color: #cbd5e1; line-height: 1.4; margin-bottom: 16px;">
            Приглашайте друзей в турнир! За каждых 3 друзей вы получите <b style="color: #4ade80;">+${bonus100} в копилку</b> и разблокируете <b style="color: #facc15;">«Золотые Кости»</b> с Колесом Фортуны!
          </div>

          <!-- Progress Stepper 0 / 3 -->
          <div style="background: rgba(0,0,0,0.3); border-radius: 16px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 10px;">
              Прогресс приглашений: <b style="color: #fef08a;">${count} / 3</b>
            </div>
            <div style="display: flex; justify-content: center; gap: 14px;">
              ${[1, 2, 3].map(i => `
                <div style="
                  width: 52px;
                  height: 52px;
                  border-radius: 50%;
                  background: ${i <= count ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)'};
                  border: 2px solid ${i <= count ? '#34d399' : 'rgba(255,255,255,0.2)'};
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  font-size: 18px;
                  color: #fff;
                  box-shadow: ${i <= count ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none'};
                ">
                  <span>${i <= count ? '✅' : '👤'}</span>
                  <span style="font-size: 9px; font-weight: bold; margin-top: 2px;">#${i}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Share Link Box -->
          <div style="background: rgba(255,255,255,0.06); border: 1px dashed rgba(255,255,255,0.2); border-radius: 12px; padding: 10px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
            <span style="color: #7dd3fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px;">${shareLink}</span>
            <button id="ref-copy-btn" style="background: #0284c7; color: #fff; border: none; padding: 6px 12px; border-radius: 8px; font-weight: bold; font-size: 11px; cursor: pointer;">Скопировать</button>
          </div>

          <!-- Test Simulation Button -->
          <button id="ref-simulate-btn" style="
            width: 100%;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #1e293b;
            border: none;
            padding: 11px;
            border-radius: 14px;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
            margin-bottom: 8px;
          ">🧪 СИМУЛИРОВАТЬ ПРИХОД ДРУГА (+1)</button>

          <div style="font-size: 10px; color: #94a3b8;">
            *Для тестирования: нажмите кнопку выше, чтобы проверить начисление бонуса!
          </div>
        </div>
      `;

      overlay.querySelector('#ref-close-btn')?.addEventListener('click', () => {
        overlay.remove();
        ReferralModal.overlay = null;
        if (onUpdated) onUpdated();
      });

      overlay.querySelector('#ref-copy-btn')?.addEventListener('click', (e) => {
        navigator.clipboard.writeText(shareLink);
        const btn = e.currentTarget as HTMLButtonElement;
        btn.innerText = 'Скопировано! ✓';
        btn.style.background = '#10b981';
      });

      overlay.querySelector('#ref-simulate-btn')?.addEventListener('click', () => {
        const res = economy.simulateFriendInvite();
        soundMgr.playCoin();
        if (res.bonusGranted) {
          soundMgr.playJackpot();
        }
        alert(res.message);
        render();
        if (onUpdated) onUpdated();
      });
    };

    render();
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }
}
