import { CurrencyService } from './CurrencyService';

export interface PayoutMethod {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const PAYOUT_METHODS: PayoutMethod[] = [
  { id: 'ozon', name: 'Ozon Сертификат', icon: '🛍️', description: 'Электронный промокод Ozon на баланс' },
  { id: 'wb', name: 'Wildberries', icon: '📦', description: 'Подарочный сертификат WB' },
  { id: 'phone', name: 'Баланс Телефона', icon: '📱', description: 'МТС, Билайн, МегаФон, Т-Мобайл' },
  { id: 'ton', name: 'Telegram TON / Stars', icon: '💎', description: 'Прямой перевод на кошелек TON' },
  { id: 'card', name: 'Банковская Карта', icon: '💳', description: 'МИР, Visa, Mastercard' },
];

export class EconomyService {
  private static instance: EconomyService;
  private static PREFIX = 'leaf_mahjong_econ_';

  private balanceRub: number = 150; // Welcome starting bonus of 150 RUB!
  private invitedFriends: number = 0;
  private hasReferralBonus: boolean = false;
  private goldenTilesUnlocked: boolean = false;

  private constructor() {
    this.load();
  }

  public static getInstance(): EconomyService {
    if (!EconomyService.instance) {
      EconomyService.instance = new EconomyService();
    }
    return EconomyService.instance;
  }

  private load() {
    const savedBal = localStorage.getItem(EconomyService.PREFIX + 'balance_rub');
    if (savedBal !== null) {
      this.balanceRub = parseFloat(savedBal);
    } else {
      this.balanceRub = 150; // Friendly starting gift
      this.save();
    }

    const savedInvites = localStorage.getItem(EconomyService.PREFIX + 'invited');
    this.invitedFriends = savedInvites ? parseInt(savedInvites, 10) : 0;

    this.hasReferralBonus = localStorage.getItem(EconomyService.PREFIX + 'ref_bonus') === 'true';
    this.goldenTilesUnlocked = this.hasReferralBonus || this.invitedFriends >= 3;
  }

  private save() {
    localStorage.setItem(EconomyService.PREFIX + 'balance_rub', this.balanceRub.toFixed(2));
    localStorage.setItem(EconomyService.PREFIX + 'invited', String(this.invitedFriends));
    localStorage.setItem(EconomyService.PREFIX + 'ref_bonus', String(this.hasReferralBonus));
  }

  public getBalanceRub(): number {
    return this.balanceRub;
  }

  public getFormattedBalance(): string {
    return CurrencyService.getInstance().formatRub(this.balanceRub);
  }

  public addRub(amount: number): number {
    this.balanceRub = Math.max(0, this.balanceRub + amount);
    this.save();
    return this.balanceRub;
  }

  public doubleCurrentBalance(): number {
    this.balanceRub *= 2;
    this.save();
    return this.balanceRub;
  }

  public getThresholdRub(): number {
    return 500;
  }

  public getProgressPercentage(): number {
    return Math.min(100, Math.round((this.balanceRub / this.getThresholdRub()) * 100));
  }

  public canCashOut(): boolean {
    return this.balanceRub >= this.getThresholdRub();
  }

  // Referral System
  public getInvitedCount(): number {
    return this.invitedFriends;
  }

  public simulateFriendInvite(): { success: boolean; bonusGranted: boolean; message: string } {
    if (this.invitedFriends >= 3 && this.hasReferralBonus) {
      return { success: true, bonusGranted: false, message: 'Все 3 друга уже приглашены! Бонус активен.' };
    }

    this.invitedFriends++;
    let bonusGranted = false;

    if (this.invitedFriends >= 3 && !this.hasReferralBonus) {
      this.hasReferralBonus = true;
      this.goldenTilesUnlocked = true;
      this.balanceRub += 100; // +100 RUB referral reward!
      bonusGranted = true;
    }

    this.save();

    const currencyService = CurrencyService.getInstance();
    const bonusText = currencyService.formatRub(100);

    return {
      success: true,
      bonusGranted,
      message: bonusGranted
        ? `🎉 Ура! Вы пригласили 3 друзей! Получено +${bonusText} в копилку и Золотые Кости разблокированы!`
        : `Друг успешно присоединился! Приглашено: ${this.invitedFriends}/3.`,
    };
  }

  public areGoldenTilesActive(): boolean {
    // Active if either unlocked via referral or default enabled for demo
    return true;
  }

  public getReferralShareLink(): string {
    return `${window.location.origin}${window.location.pathname}?ref=player_${Math.floor(1000 + Math.random() * 9000)}`;
  }
}
