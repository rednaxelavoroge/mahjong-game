import { StorageService } from '../services/StorageService';
import { SocialService } from '../services/SocialService';
import { SoundManager } from '../audio/SoundManager';

export class TournamentModal {
  private static overlay: HTMLElement | null = null;

  public static show(userLevel: number = 1, onClose?: () => void) {
    if (this.overlay) return;

    const storage = StorageService.getInstance();
    const social = SocialService.getInstance();
    const soundMgr = SoundManager.getInstance();
    const userScore = storage.getTournamentScore();

    const leaders = social.getCountryLeaderboard(userLevel, userScore);
    const country = social.getUserCountry();

    const overlay = document.createElement('div');
    overlay.id = 'tournament-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99998';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    overlay.style.color = '#fff';

    overlay.innerHTML = `
      <div style="background: linear-gradient(160deg, #124338, #0a251f); border: 2px solid #eab308; border-radius: 24px; padding: 22px; width: 90%; max-width: 380px; box-shadow: 0 25px 60px rgba(0,0,0,0.7); max-height: 88vh; overflow-y: auto;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #fde047; font-weight: bold; letter-spacing: 1px;">
              ${country} Региональный Турнир
            </div>
            <div style="font-size: 22px; font-weight: 900; color: #fff;">🏆 Таблица Лидеров</div>
          </div>
          <button id="tourney-close-x" style="background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer;">✕</button>
        </div>

        <!-- Prize Pool Card -->
        <div style="background: linear-gradient(135deg, rgba(234,179,8,0.22), rgba(202,138,4,0.1)); border: 1px solid rgba(234,179,8,0.45); border-radius: 16px; padding: 12px; text-align: center; margin-bottom: 14px;">
          <div style="font-size: 26px; font-weight: 900; color: #fef08a;">50 000 ₽</div>
          <div style="font-size: 11px; color: #fef9c3;">Призовой фонд недели (Ozon / WB / Сертификаты)</div>
          <div style="font-size: 10px; color: #86efac; margin-top: 4px;">⏱ До подведения итогов: 2 дня 14 ч</div>
        </div>

        <!-- Leaderboard List -->
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; color: #cbd5e1; margin-bottom: 8px;">
          <span>${country} Игроки рядом с вами</span>
          <span style="font-size: 11px; color: #94a3b8; font-weight: normal;">Уровень / Очки</span>
        </div>

        <div style="background: rgba(0,0,0,0.3); border-radius: 14px; padding: 6px; margin-bottom: 16px;">
          ${leaders.map(item => `
            <div style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 8px 10px;
              border-bottom: 1px solid rgba(255,255,255,0.06);
              font-size: 11px;
              ${item.isUser ? 'background: rgba(16,185,129,0.25); border-radius: 10px; border: 1px solid #10b981;' : ''}
            ">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 22px; text-align: center; font-weight: 800; color: ${item.rank <= 3 ? '#facc15' : '#94a3b8'};">
                  ${item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '#' + item.rank}
                </span>
                <div>
                  <div style="font-weight: bold; color: ${item.isUser ? '#4ade80' : '#ffffff'};">
                    ${item.countryFlag} ${item.name}
                  </div>
                  <div style="font-size: 9px; color: #94a3b8;">${item.city} • Ур. ${item.level}</div>
                </div>
              </div>

              <div style="text-align: right;">
                <div style="font-weight: bold; color: #38bdf8;">${item.score.toLocaleString()}</div>
                <div style="font-size: 9px; color: #facc15;">${item.prize}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Legal Disclaimer -->
        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 10px; font-size: 10px; color: #94a3b8; line-height: 1.4; margin-bottom: 14px;">
          • Участие бесплатное. Рейтинг обновляется в реальном времени.<br/>
          • Призовой фонд формируется от просмотров рекламы спонсоров (ст. 1057 ГК РФ).
        </div>

        <button id="tourney-play-btn" style="
          width: 100%;
          background: linear-gradient(135deg, #eab308, #ca8a04);
          color: #1e293b;
          border: none;
          padding: 12px;
          border-radius: 14px;
          font-weight: 900;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(234,179,8,0.3);
        ">ПРОДОЛЖИТЬ ИГРУ 🎮</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;

    const close = () => {
      overlay.remove();
      this.overlay = null;
      if (onClose) onClose();
    };

    overlay.querySelector('#tourney-close-x')?.addEventListener('click', close);
    overlay.querySelector('#tourney-play-btn')?.addEventListener('click', close);
  }
}
