export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'TON';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  rateFromRub: number; // multiplier to convert base RUB value
  decimals: number;
  cashoutThresholdRub: number; // 500 RUB base
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  RUB: {
    code: 'RUB',
    symbol: '₽',
    name: 'Рубли',
    flag: '🇷🇺',
    rateFromRub: 1.0,
    decimals: 0,
    cashoutThresholdRub: 500,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'Доллары',
    flag: '🇺🇸',
    rateFromRub: 0.011,
    decimals: 2,
    cashoutThresholdRub: 500,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Евро',
    flag: '🇪🇺',
    rateFromRub: 0.01,
    decimals: 2,
    cashoutThresholdRub: 500,
  },
  KZT: {
    code: 'KZT',
    symbol: '₸',
    name: 'Тенге',
    flag: '🇰🇿',
    rateFromRub: 5.3,
    decimals: 0,
    cashoutThresholdRub: 500,
  },
  TON: {
    code: 'TON',
    symbol: '💎',
    name: 'Telegram TON',
    flag: '⭐',
    rateFromRub: 0.002,
    decimals: 2,
    cashoutThresholdRub: 500,
  },
};

export class CurrencyService {
  private static instance: CurrencyService;
  private currentCurrency: CurrencyCode = 'RUB';

  private constructor() {
    const saved = localStorage.getItem('leaf_mahjong_currency') as CurrencyCode;
    if (saved && CURRENCIES[saved]) {
      this.currentCurrency = saved;
    }
  }

  public static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  public getCurrency(): CurrencyConfig {
    return CURRENCIES[this.currentCurrency];
  }

  public getCurrencyCode(): CurrencyCode {
    return this.currentCurrency;
  }

  public setCurrency(code: CurrencyCode) {
    if (CURRENCIES[code]) {
      this.currentCurrency = code;
      localStorage.setItem('leaf_mahjong_currency', code);
    }
  }

  public formatRub(amountRub: number, overrideCode?: CurrencyCode): string {
    const cfg = overrideCode ? CURRENCIES[overrideCode] : this.getCurrency();
    const converted = amountRub * cfg.rateFromRub;
    const formattedNum = cfg.decimals === 0 
      ? Math.round(converted).toLocaleString('ru-RU')
      : converted.toFixed(cfg.decimals);

    if (cfg.code === 'USD' || cfg.code === 'EUR') {
      return `${cfg.symbol}${formattedNum}`;
    }
    if (cfg.code === 'TON') {
      return `${formattedNum} ${cfg.symbol} TON`;
    }
    return `${formattedNum} ${cfg.symbol}`;
  }

  public getThresholdFormatted(): string {
    const cfg = this.getCurrency();
    return this.formatRub(cfg.cashoutThresholdRub);
  }
}
