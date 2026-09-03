export interface SocialEvent {
  id: string;
  avatar: string;
  text: string;
  timeAgo: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  city: string;
  countryFlag: string;
  level: number;
  score: number;
  prize: string;
  isUser?: boolean;
}

const RUSSIAN_NAMES = [
  { name: 'Алексей М.', city: 'Москва', flag: '🇷🇺' },
  { name: 'Елена В.', city: 'Санкт-Петербург', flag: '🇷🇺' },
  { name: 'Дмитрий К.', city: 'Новосибирск', flag: '🇷🇺' },
  { name: 'Анна С.', city: 'Екатеринбург', flag: '🇷🇺' },
  { name: 'Михаил Т.', city: 'Казань', flag: '🇷🇺' },
  { name: 'Ольга П.', city: 'Нижний Новгород', flag: '🇷🇺' },
  { name: 'Артем З.', city: 'Самара', flag: '🇷🇺' },
  { name: 'София Л.', city: 'Краснодар', flag: '🇷🇺' },
  { name: 'Иван Д.', city: 'Ростов-на-Дону', flag: '🇷🇺' },
  { name: 'Виктория Р.', city: 'Уфа', flag: '🇷🇺' },
  { name: 'Данияр Б.', city: 'Алматы', flag: '🇰🇿' },
  { name: 'Асель Н.', city: 'Астана', flag: '🇰🇿' },
  { name: 'Максим Г.', city: 'Минск', flag: '🇧🇾' },
];

export class SocialService {
  private static instance: SocialService;
  private userNickname = 'Вы (Игрок)';
  private userCountry = '🇷🇺';
  private eventIndex = 0;

  private constructor() {
    const saved = localStorage.getItem('leaf_mahjong_nickname');
    if (saved) this.userNickname = saved;

    // Detect country flag from browser
    const lang = navigator.language.toLowerCase();
    if (lang.includes('kz')) this.userCountry = '🇰🇿';
    else if (lang.includes('by')) this.userCountry = '🇧🇾';
    else if (lang.includes('uz')) this.userCountry = '🇺🇿';
    else this.userCountry = '🇷🇺';
  }

  public static getInstance(): SocialService {
    if (!SocialService.instance) {
      SocialService.instance = new SocialService();
    }
    return SocialService.instance;
  }

  public getUserCountry(): string {
    return this.userCountry;
  }

  public getUserNickname(): string {
    return this.userNickname;
  }

  public setUserNickname(name: string) {
    this.userNickname = name;
    localStorage.setItem('leaf_mahjong_nickname', name);
  }

  public getRandomLiveEvent(userLevel: number): SocialEvent {
    const person = RUSSIAN_NAMES[this.eventIndex % RUSSIAN_NAMES.length];
    this.eventIndex++;

    const eventTypes = [
      `прошел уровень ${userLevel + Math.floor(Math.random() * 8) + 1} (+25 ₽)`,
      `сорвал Джекпот 100 ₽ в Колесе Фортуны 🎰`,
      `поднялся на 3 позиции в рейтинге региона 🏆`,
      `пригласил 3 друзей и активировал Золотые Кости ✨`,
      `вывел 500 ₽ сертификатом на Ozon 🛍️`,
    ];

    const chosenAction = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    return {
      id: String(Date.now()),
      avatar: person.flag,
      text: `<b>${person.name}</b> (${person.city}) ${chosenAction}`,
      timeAgo: 'только что',
    };
  }

  /**
   * Generates a realistic Country Leaderboard centered on the user
   */
  public getCountryLeaderboard(userLevel: number, userScore: number): LeaderboardEntry[] {
    // Fixed Top 3 Champions
    const topLeaders: LeaderboardEntry[] = [
      { rank: 1, name: 'DragonSlayer_99', city: 'Москва', countryFlag: '🇷🇺', level: 1420, score: 384500, prize: '25 000 ₽' },
      { rank: 2, name: 'ZenMaster_SPb', city: 'Санкт-Петербург', countryFlag: '🇷🇺', level: 1180, score: 312000, prize: '15 000 ₽' },
      { rank: 3, name: 'GoldenLotus', city: 'Казань', countryFlag: '🇷🇺', level: 950, score: 268400, prize: '10 000 ₽' },
    ];

    // User relative position (e.g. rank 50 minus userLevel bonus)
    const userRank = Math.max(4, 85 - userLevel * 2);

    const nearbyList: LeaderboardEntry[] = [];

    // 2 players above user
    const p1 = RUSSIAN_NAMES[userLevel % RUSSIAN_NAMES.length];
    nearbyList.push({
      rank: userRank - 2,
      name: p1.name,
      city: p1.city,
      countryFlag: p1.flag,
      level: userLevel + 2,
      score: userScore + 480,
      prize: 'Сертификат',
    });

    const p2 = RUSSIAN_NAMES[(userLevel + 1) % RUSSIAN_NAMES.length];
    nearbyList.push({
      rank: userRank - 1,
      name: p2.name,
      city: p2.city,
      countryFlag: p2.flag,
      level: userLevel + 1,
      score: userScore + 190,
      prize: 'Сертификат',
    });

    // The user
    nearbyList.push({
      rank: userRank,
      name: `${this.userNickname}`,
      city: 'Ваш регион',
      countryFlag: this.userCountry,
      level: userLevel,
      score: userScore,
      prize: 'Участие в финале',
      isUser: true,
    });

    // 2 players below user
    const p3 = RUSSIAN_NAMES[(userLevel + 2) % RUSSIAN_NAMES.length];
    nearbyList.push({
      rank: userRank + 1,
      name: p3.name,
      city: p3.city,
      countryFlag: p3.flag,
      level: Math.max(1, userLevel - 1),
      score: Math.max(0, userScore - 220),
      prize: 'Купон',
    });

    const p4 = RUSSIAN_NAMES[(userLevel + 3) % RUSSIAN_NAMES.length];
    nearbyList.push({
      rank: userRank + 2,
      name: p4.name,
      city: p4.city,
      countryFlag: p4.flag,
      level: Math.max(1, userLevel - 2),
      score: Math.max(0, userScore - 410),
      prize: 'Купон',
    });

    return [...topLeaders, ...nearbyList];
  }
}
