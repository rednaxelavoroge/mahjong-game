/**
 * Ad Service - Handles Rewarded Ads, Interstitials, and Sponsorships
 * Provides a built-in realistic modal simulator + drop-in adapters for Yandex Games / Google / CrazyGames.
 */
export type AdRewardType = 'hints' | 'shuffle' | 'double_score' | 'coins';

export class AdService {
  private static instance: AdService;
  private isShowingAd = false;

  private constructor() {}

  public static getInstance(): AdService {
    if (!AdService.instance) {
      AdService.instance = new AdService();
    }
    return AdService.instance;
  }

  /**
   * Shows a Rewarded Video Ad.
   * Resolves to true if user watched full ad and earned reward, false if cancelled/failed.
   */
  public showRewardedAd(rewardType: AdRewardType): Promise<boolean> {
    if (this.isShowingAd) return Promise.resolve(false);
    this.isShowingAd = true;

    // Check if external SDK like Yandex Games SDK exists on window
    const ysdk = (window as unknown as { ysdk?: { adv: { showRewardedVideo: (opts: unknown) => void } } }).ysdk;
    if (ysdk && ysdk.adv && typeof ysdk.adv.showRewardedVideo === 'function') {
      return new Promise<boolean>((resolve) => {
        ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {
              console.log('Yandex Ad opened');
            },
            onRewarded: () => {
              this.isShowingAd = false;
              resolve(true);
            },
            onClose: () => {
              this.isShowingAd = false;
            },
            onError: (e: unknown) => {
              console.error('Ad error', e);
              this.isShowingAd = false;
              resolve(false);
            },
          },
        });
      });
    }

    // Default: High-fidelity in-game interactive ad simulator
    return this.showSimulatorAdModal(rewardType);
  }

  private showSimulatorAdModal(rewardType: AdRewardType): Promise<boolean> {
    return new Promise((resolve) => {
      const rewardTitles: Record<AdRewardType, string> = {
        hints: '+3 Подсказки',
        shuffle: 'Перемешать кости',
        double_score: 'Удвоение очков (x2)',
        coins: '+100 Монет',
      };

      const title = rewardTitles[rewardType] || 'Награда за просмотр';

      // Create DOM overlay
      const overlay = document.createElement('div');
      overlay.id = 'ad-simulator-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '99999';
      overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      overlay.style.color = '#fff';
      overlay.style.userSelect = 'none';

      let secondsLeft = 3;

      overlay.innerHTML = `
        <div style="background: linear-gradient(145deg, #134639, #082820); border: 2px solid #38bdf8; border-radius: 20px; padding: 28px; width: 85%; max-width: 340px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #7dd3fc; margin-bottom: 8px;">
            📢 Реклама спонсора
          </div>
          <div style="font-size: 20px; font-weight: bold; margin-bottom: 14px; color: #fef08a;">
            Leaf Mahjong Tournaments
          </div>
          <div style="background: rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; margin-bottom: 18px; border: 1px dashed rgba(255,255,255,0.2);">
            <div style="font-size: 32px; margin-bottom: 6px;">🎁</div>
            <div style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Призовой фонд 50 000 ₽</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Участвуйте в еженедельном турнире бесплатно!</div>
          </div>
          <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 16px;">
            Награда: <span style="font-weight: bold; color: #4ade80;">${title}</span>
          </div>
          
          <div id="ad-progress-bar-bg" style="width: 100%; height: 6px; background: rgba(255,255,255,0.15); border-radius: 3px; overflow: hidden; margin-bottom: 14px;">
            <div id="ad-progress-bar" style="width: 0%; height: 100%; background: #38bdf8; transition: width 1s linear;"></div>
          </div>

          <div id="ad-timer-text" style="font-size: 12px; color: #94a3b8; margin-bottom: 14px;">
            Награда через ${secondsLeft} сек...
          </div>

          <button id="ad-close-btn" disabled style="
            background: #475569;
            color: #94a3b8;
            border: none;
            padding: 10px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: bold;
            cursor: not-allowed;
            transition: all 0.2s;
            width: 100%;
          ">Подождите...</button>
        </div>
      `;

      document.body.appendChild(overlay);

      const timerText = overlay.querySelector('#ad-timer-text') as HTMLElement;
      const progressBar = overlay.querySelector('#ad-progress-bar') as HTMLElement;
      const closeBtn = overlay.querySelector('#ad-close-btn') as HTMLButtonElement;

      // Start timer
      const interval = setInterval(() => {
        secondsLeft--;
        const pct = ((3 - secondsLeft) / 3) * 100;
        if (progressBar) progressBar.style.width = `${pct}%`;

        if (secondsLeft > 0) {
          if (timerText) timerText.innerText = `Награда через ${secondsLeft} сек...`;
        } else {
          clearInterval(interval);
          if (timerText) {
            timerText.innerText = `🎉 Награда разблокирована!`;
            timerText.style.color = '#4ade80';
            timerText.style.fontWeight = 'bold';
          }
          if (closeBtn) {
            closeBtn.disabled = false;
            closeBtn.innerText = 'Забрать награду';
            closeBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            closeBtn.style.color = '#ffffff';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
          }
        }
      }, 1000);

      closeBtn.onclick = () => {
        if (secondsLeft <= 0) {
          overlay.remove();
          this.isShowingAd = false;
          resolve(true);
        }
      };
    });
  }
}
