import { EconomyService, PAYOUT_METHODS } from '../services/EconomyService';
import { CurrencyService, CURRENCIES, CurrencyCode } from '../services/CurrencyService';
import { AdService } from '../services/AdService';
import { SoundManager } from '../audio/SoundManager';
import { ReferralModal } from './ReferralModal';

export class VaultModal {
  private static overlay: HTMLElement | null = null;

  public static show(onUpdated?: () => void) {
    if (this.overlay) return;

    const economy = EconomyService.getInstance();
    const currency = CurrencyService.getInstance();
    const soundMgr = SoundManager.getInstance();
    const adService = AdService.getInstance();

    const overlay = document.createElement('div');
    overlay.id = 'vault-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99998';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    overlay.style.color = '#fff';

    const renderContent = () => {
      const balanceRub = economy.getBalanceRub();
      const progress = economy.getProgressPercentage();
      const formattedBalance = currency.formatRub(balanceRub);
      const thresholdFormatted = currency.getThresholdFormatted();
      const curConfig = currency.getCurrency();

      overlay.innerHTML = `
        <div style="
          background: linear-gradient(155deg, #164639, #08231c);
          border: 2px solid #facc15;
          border-radius: 24px;
          padding: 22px;
          width: 90%;
          max-width: 380px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.7);
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        ">
          <!-- Close button -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #fde047; font-weight: 800; letter-spacing: 1.5px;">
              🐷 ЗОЛОТАЯ КОПИЛКА
            </div>
            <button id="vault-close-x" style="background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer;">✕</button>
          </div>

          <!-- Currency Selector -->
          <div style="background: rgba(0,0,0,0.25); border-radius: 12px; padding: 6px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #cbd5e1; margin-left: 6px;">Валюта отображения:</span>
            <div style="display: flex; gap: 4px;">
              ${(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => `
                <button class="currency-pill" data-code="${code}" style="
                  background: ${code === curConfig.code ? '#eab308' : 'rgba(255,255,255,0.08)'};
                  color: ${code === curConfig.code ? '#1e293b' : '#94a3b8'};
                  border: none;
                  padding: 4px 8px;
                  border-radius: 8px;
                  font-size: 11px;
                  font-weight: bold;
                  cursor: pointer;
                ">${CURRENCIES[code].flag} ${CURRENCIES[code].symbol}</button>
              `).join('')}
            </div>
          </div>

          <!-- Main Balance Display Card -->
          <div style="
            background: linear-gradient(135deg, rgba(234, 179, 8, 0.22), rgba(202, 138, 4, 0.1));
            border: 1px solid rgba(234, 179, 8, 0.5);
            border-radius: 18px;
            padding: 16px;
            text-align: center;
            margin-bottom: 16px;
          ">
            <div style="font-size: 11px; color: #fef9c3; text-transform: uppercase; letter-spacing: 1px;">Текущий баланс к выводу</div>
            <div style="font-size: 32px; font-weight: 900; color: #fef08a; margin: 4px 0 8px;">${formattedBalance}</div>
            
            <!-- Progress Bar -->
            <div style="background: rgba(0,0,0,0.3); height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 6px;">
              <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #10b981, #facc15); transition: width 0.4s ease;"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8;">
              <span>Прогресс: ${progress}%</span>
              <span>Цель: <b style="color: #fef08a;">${thresholdFormatted}</b></span>
            </div>
          </div>

          <!-- Quick Action: Double Piggy Bank for Video -->
          <button id="vault-double-ad-btn" style="
            width: 100%;
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: #ffffff;
            border: none;
            padding: 10px;
            border-radius: 14px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3);
          ">
            <span>🎬 Удвоить копилку за видео</span>
            <span style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 6px; font-size: 10px;">x2 БОНУС</span>
          </button>

          <!-- Referral Banner -->
          <div id="vault-ref-banner" style="
            background: rgba(234, 179, 8, 0.12);
            border: 1px dashed rgba(234, 179, 8, 0.4);
            border-radius: 14px;
            padding: 12px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
          ">
            <div>
              <div style="font-size: 12px; font-weight: bold; color: #fde047;">👥 Позови 3 друзей в турнир</div>
              <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">Получи +100 ₽ и Золотую Кость! (Приглашено: ${economy.getInvitedCount()}/3)</div>
            </div>
            <span style="font-size: 18px;">➡️</span>
          </div>

          <!-- Payout Methods List -->
          <div style="font-size: 12px; font-weight: bold; color: #cbd5e1; margin-bottom: 8px;">Доступные способы получения:</div>
          <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px;">
            ${PAYOUT_METHODS.map(m => `
              <div style="background: rgba(0,0,0,0.25); border-radius: 10px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 18px;">${m.icon}</span>
                  <div>
                    <div style="font-weight: bold; color: #f8fafc;">${m.name}</div>
                    <div style="color: #94a3b8; font-size: 9px;">${m.description}</div>
                  </div>
                </div>
                <span style="color: #4ade80; font-weight: bold;">Мгновенно</span>
              </div>
            `).join('')}
          </div>

          <!-- Cash Out Button -->
          <button id="vault-cashout-btn" ${economy.canCashOut() ? '' : 'disabled'} style="
            width: 100%;
            background: ${economy.canCashOut() ? 'linear-gradient(135deg, #10b981, #059669)' : '#334155'};
            color: ${economy.canCashOut() ? '#ffffff' : '#94a3b8'};
            border: none;
            padding: 13px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 800;
            cursor: ${economy.canCashOut() ? 'pointer' : 'not-allowed'};
            box-shadow: ${economy.canCashOut() ? '0 4px 20px rgba(16, 185, 129, 0.4)' : 'none'};
          ">
            ${economy.canCashOut() ? 'ВЫВЕСТИ СРЕДСТВА 💸' : `ДО ВЫВОДА ОСТАЛОСЬ: ${currency.formatRub(Math.max(0, 500 - balanceRub))}`}
          </button>
        </div>
      `;

      // Event listeners
      overlay.querySelector('#vault-close-x')?.addEventListener('click', () => {
        overlay.remove();
        VaultModal.overlay = null;
        if (onUpdated) onUpdated();
      });

      // Currency pills
      overlay.querySelectorAll('.currency-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const code = (e.currentTarget as HTMLElement).getAttribute('data-code') as CurrencyCode;
          currency.setCurrency(code);
          soundMgr.playTileClick();
          renderContent();
        });
      });

      // Double ad button
      overlay.querySelector('#vault-double-ad-btn')?.addEventListener('click', () => {
        soundMgr.playTileClick();
        adService.showRewardedAd('double_score').then(watched => {
          if (watched) {
            economy.doubleCurrentBalance();
            soundMgr.playCoin();
            soundMgr.playJackpot();
            renderContent();
          }
        });
      });

      // Referral banner click
      overlay.querySelector('#vault-ref-banner')?.addEventListener('click', () => {
        soundMgr.playTileClick();
        ReferralModal.show(() => {
          renderContent();
        });
      });

      // Cashout button
      overlay.querySelector('#vault-cashout-btn')?.addEventListener('click', () => {
        if (economy.canCashOut()) {
          soundMgr.playWin();
          alert(`Заявка на вывод ${formattedBalance} успешно создана! Сертификат будет отправлен в течение 10 минут.`);
        }
      });
    };

    renderContent();
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }
}
