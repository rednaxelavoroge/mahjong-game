import { StorageService } from '../services/StorageService';

/**
 * Tournament Modal displaying weekly leaderboard, prize pool, and legal contest rules
 */
export class TournamentModal {
  private static overlay: HTMLElement | null = null;

  public static show(onClose?: () => void) {
    if (this.overlay) return;

    const storage = StorageService.getInstance();
    const userScore = storage.getTournamentScore();

    const mockLeaders = [
      { rank: 1, name: 'DragonMaster', score: 14200, prize: '15 000 ₽ (Ozon)' },
      { rank: 2, name: 'Alice_Wonder', score: 12850, prize: '10 000 ₽ (Ozon)' },
      { rank: 3, name: 'ZenGamer', score: 11400, prize: '7 000 ₽ (WB)' },
      { rank: 4, name: 'MahjongPro', score: 9650, prize: '5 000 ₽' },
      { rank: 5, name: 'GreenPanda', score: 8900, prize: '3 000 ₽' },
      { rank: 6, name: 'Вы (Игрок)', score: Math.max(userScore, 2400), prize: 'Сертификат' },
    ];

    const overlay = document.createElement('div');
    overlay.id = 'tournament-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99998';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    overlay.style.color = '#fff';

    overlay.innerHTML = `
      <div style="background: linear-gradient(160deg, #124338, #0a251f); border: 2px solid #eab308; border-radius: 22px; padding: 24px; width: 90%; max-width: 380px; box-shadow: 0 25px 50px rgba(0,0,0,0.7); max-height: 88vh; overflow-y: auto;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #fde047; font-weight: bold; letter-spacing: 1px;">Еженедельный турнир</div>
            <div style="font-size: 22px; font-weight: 800; color: #fff;">🏆 Призовой фонд</div>
          </div>
          <button id="tourney-close-x" style="background: none; border: none; font-size: 26px; color: #94a3b8; cursor: pointer;">✕</button>
        </div>

        <div style="background: linear-gradient(135deg, rgba(234,179,8,0.2), rgba(202,138,4,0.1)); border: 1px solid rgba(234,179,8,0.4); border-radius: 14px; padding: 14px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 28px; font-weight: 900; color: #fef08a;">50 000 ₽</div>
          <div style="font-size: 12px; color: #fef9c3; margin-top: 2px;">Сертификаты Ozon / Wildberries / Призы</div>
          <div style="font-size: 11px; color: #86efac; margin-top: 6px;">⏱ До подведения итогов: 2 дня 14 ч</div>
        </div>

        <div style="font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 10px; display: flex; justify-content: space-between;">
          <span>Таблица лидеров</span>
          <span style="color: #94a3b8; font-weight: normal; font-size: 11px;">Топ недели</span>
        </div>

        <div style="background: rgba(0,0,0,0.25); border-radius: 12px; padding: 6px; margin-bottom: 18px;">
          ${mockLeaders.map(item => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 12px; ${item.name.includes('Вы') ? 'background: rgba(16,185,129,0.18); border-radius: 8px; font-weight: bold;' : ''}">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 20px; text-align: center; font-weight: 800; color: ${item.rank <= 3 ? '#facc15' : '#94a3b8'};">${item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank}</span>
                <span>${item.name}</span>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: bold; color: #38bdf8;">${item.score.toLocaleString()} очков</div>
                <div style="font-size: 10px; color: #4ade80;">${item.prize}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 12px; font-size: 11px; color: #cbd5e1; line-height: 1.4; margin-bottom: 18px;">
          <div style="font-weight: bold; color: #f8fafc; margin-bottom: 4px;">⚖️ Правила и легальность:</div>
          • Вход 100% бесплатный, без реальных ставок.<br/>
          • Призовой фонд формируется от просмотров рекламы спонсоров.<br/>
          • Победители определяются состязательным путем по набранным очкам (ст. 1057 ГК РФ «Публичный конкурс»).
        </div>

        <button id="tourney-continue-btn" style="
          width: 100%;
          background: linear-gradient(135deg, #eab308, #ca8a04);
          color: #1e293b;
          border: none;
          padding: 12px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(234,179,8,0.3);
        ">ИГРАТЬ И НАБИРАТЬ ОЧКИ</button>

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
    overlay.querySelector('#tourney-continue-btn')?.addEventListener('click', close);
  }
}
