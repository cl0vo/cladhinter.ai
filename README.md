# 🆑 Cladhunter

> **Cloud Mining Simulator & Watch-to-Earn Platform**
> 
> A mobile-first web app where users earn crypto energy by watching ads and can boost their earnings with TON blockchain payments.

![Version](https://img.shields.io/badge/version-1.0.0-red)
![React](https://img.shields.io/badge/React-18+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)
![Neon](https://img.shields.io/badge/Neon-PostgreSQL-green)
![TON](https://img.shields.io/badge/TON-Blockchain-blue)

---

## ✨ Features

- 🎯 **Ad-Based Mining**: Watch ads to earn energy (🆑)
- 🎁 **Partner Rewards**: Earn coins for subscribing to Telegram/X channels
- 📱 **Telegram Web App**: Native integration with haptic feedback
- 🎬 **Partner Ads**: Fullscreen video/image ads with 9:16 format
- ⚡ **Boost System**: Purchase multipliers with TON cryptocurrency
- 📊 **Statistics Dashboard**: Track your earnings and performance
- 💰 **Wallet Integration**: Manage balance and transactions
- 📲 **Mobile-Optimized**: Safe area insets, touch targets, responsive design
- 🎨 **Dark Futuristic Theme**: Glassmorphic UI with red accents
- 🔐 **Secure Backend**: Supabase Edge Functions with authentication
- 🚀 **Production Ready**: Full API, data persistence, and error handling
- 🔧 **Easy Config**: Simple files for adding partners and ads

---

## 🚀 Quick Start

### ⚡ Быстрый старт за 5 минут

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/cl0vo/cladhunter.ai.git
cd cladhunter.ai

# 2. Автоматическая установка всего проекта
npm run setup

# 3. Настройте Neon Database
# - Зайдите на neon.tech и создайте проект
# - Скопируйте Connection String
# - Добавьте в server/.env: DATABASE_URL=...

# 4. Запустите миграции
npm run server:migrate

# 5. Запустите всё одной командой!
npm run start:all
```

Откройте [http://localhost:5173](http://localhost:5173) 🎉

**📖 Детальное руководство**: 
- ⚡ [QUICK_START.md](./QUICK_START.md) - Старт за 5 минут
- 🔧 [NEON_SETUP.md](./NEON_SETUP.md) - Настройка Neon PostgreSQL
- 🔄 [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Миграция с Supabase

### Альтернатива: Только Frontend

Можно запустить фронтенд без бэкенда для просмотра UI:

```bash
npm install
npm run dev
```

_(API запросы будут падать, но UI можно посмотреть)_

---

## 📱 Demo

### Mining Screen
- Click the big red button to start mining
- Watch 5-second ad simulation
- Earn energy with boost multipliers

### Statistics Screen
- View total mined energy
- See 7-day earnings chart
- Track mining sessions history

### Wallet Screen
- Check current balance
- Purchase premium boosts
- View transaction history
- Share referral links

---

## 🏗 Architecture

```
Frontend (React + TypeScript + Tailwind)
    ↓
API Layer (Custom Hooks + Fetch)
    ↓
Backend (Node.js + Express)
    ↓
Database (Neon PostgreSQL Serverless)
    ↓
Blockchain (TON Connect)
```

**📐 Репозиторий**: [github.com/cl0vo/cladhunter.ai](https://github.com/cl0vo/cladhunter.ai)

---

## 🛠 Tech Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Motion** - Animations
- **Recharts** - Data visualization
- **Shadcn/ui** - Component library

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Neon** - Serverless PostgreSQL
- **@neondatabase/serverless** - Database driver

### Blockchain
- **TON** - Payment infrastructure
- **TON Connect** - Wallet connection ✅

---

## 📊 Economy

| Item | Value |
|------|-------|
| 1 TON | 100,000 🆑 |
| Base Ad Reward | 10-50 🆑 |
| Daily Limit | 200 ads |
| Cooldown | 30 seconds |

### Boost Levels

| Level | Name | Multiplier | Price | Duration |
|-------|------|------------|-------|----------|
| 0 | Base | 1x | Free | - |
| 1 | Bronze | 1.25x | 0.3 TON | 7 days |
| 2 | Silver | 1.5x | 0.7 TON | 14 days |
| 3 | Gold | 2x | 1.5 TON | 30 days |
| 4 | Diamond | 3x | 3.5 TON | 60 days |

---

## 🔐 Security

- ✅ **Authentication**: Anonymous user IDs (anon_*)
- ✅ **Anti-Spam**: 30-second cooldown between ads
- ✅ **Rate Limiting**: 200 ads per user per day
- ✅ **Database Transactions**: Prevent race conditions
- ✅ **Environment Variables**: Sensitive keys protected
- ✅ **CORS**: Properly configured for production
- ✅ **PostgreSQL Indexes**: Optimized queries

---

## 📁 Project Structure

```
/
├── components/           # React components
│   ├── MiningScreen.tsx      # Main mining interface
│   ├── RewardsSection.tsx    # Partner rewards
│   ├── StatsScreen.tsx       # Statistics & charts
│   ├── WalletScreen.tsx      # Wallet & boosts
│   └── ui/                   # Reusable UI components
├── hooks/                # Custom React hooks
│   ├── useAuth.tsx           # Authentication
│   ├── useUserData.tsx       # User state
│   └── useApi.tsx            # API requests
├── config/               # App configuration
│   ├── economy.ts            # Economy settings
│   ├── partners.ts           # Partner rewards config
│   └── ads.ts                # Ad creatives config
├── server/               # Backend API ⭐ NEW
│   ├── index.js              # Express server
│   ├── migrate.js            # Database migrations
│   ├── package.json          # Server dependencies
│   └── database/
│       └── schema.sql        # PostgreSQL schema
├── utils/                # Utility functions
│   ├── helpers.ts            # Helper functions
│   ├── telegram.ts           # Telegram Web App utils
│   └── supabase/
│       └── client.tsx        # API client (Neon adapted)
├── types/                # TypeScript types
├── App.tsx               # Main app component
└── styles/               # Global styles
```

---

## 🧪 Testing

### Manual Testing
```bash
# Open browser console and run:
await window.testApi.runAllTests()
```

### API Testing
```bash
# Test individual endpoints:
await window.testApi.testHealth()
await window.testApi.testUserInit()
await window.testApi.testCompleteAd('ad_1')
```

### Simulation
```bash
# Simulate 5 mining sessions with cooldown:
await window.testApi.simulateMining(5)
```

---

## 🚀 Deployment

### Frontend
Deploy to any static hosting:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop build folder
- **GitHub Pages**: Push to gh-pages branch
- **Cloudflare Pages**: Connect GitHub repo

### Backend
Deploy Express server to:
- **Railway**: `railway up` (рекомендуется)
- **Render**: Connect GitHub repo
- **Vercel**: Serverless functions
- **Fly.io**: `fly launch`

**Детальное руководство**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#-деплой)

---

## 📝 Configuration

### Economy Settings
Edit `/config/economy.ts`:

```typescript
export const TON_TO_ENERGY_RATE = 100000;
export const DAILY_VIEW_LIMIT = 200;
export const AD_COOLDOWN_SECONDS = 30;
```

### Partner Rewards ⭐ NEW
Edit `/config/partners.ts` to add partner channels:

```typescript
{
  id: 'telegram_your_channel',
  platform: 'telegram',        // telegram | x | youtube | instagram | discord
  name: 'Your Channel',
  url: 'https://t.me/channel',
  reward: 750,                 // Coins (500-1000 recommended)
  active: true,
}
```

**Full Guide**: [REWARDS_GUIDE.md](./REWARDS_GUIDE.md)

### Partner Ads
Edit `/config/ads.ts` to add video/image ads:

```typescript
{
  id: 'your_ad',
  type: 'video',              // or 'image'
  url: 'https://cdn.com/ad.mp4',
  partnerUrl: 'https://partner.com',
  partnerName: 'Partner',
}
```

### Boost Levels
```typescript
export const BOOSTS = [
  { level: 1, name: "Bronze", multiplier: 1.25, costTon: 0.3, durationDays: 7 },
  // Add more...
];
```

### Theme Colors
Edit `/styles/globals.css` to change brand colors.

---

## 📚 Documentation

### 🚀 Getting Started
- **Neon Setup**: [NEON_SETUP.md](./NEON_SETUP.md) - Настройка Neon PostgreSQL
- **Migration Guide**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Миграция с Supabase
- **Agent Guide**: [agent.md](./agent.md) - Полный контекст для разработки

### 🔧 Configuration
- **Economy**: [config/economy.ts](./config/economy.ts) - Настройки экономики
- **Partners**: [config/partners.ts](./config/partners.ts) - Партнерские награды
- **Ads**: [config/ads.ts](./config/ads.ts) - Рекламные креативы

### 📡 API Reference
- **Server Code**: [server/index.js](./server/index.js) - Express endpoints
- **Database Schema**: [server/database/schema.sql](./server/database/schema.sql) - PostgreSQL tables

---

## 🗺 Roadmap

### Phase 1: MVP ✅
- [x] Core mining mechanics
- [x] User authentication
- [x] Energy system
- [x] Basic UI/UX
- [x] Supabase integration

### Phase 2: Boosts 🚧
- [x] Boost purchase system
- [x] Demo payment flow
- [ ] Real TON payment integration
- [ ] Webhook verification

### Phase 3: Features 📋
- [ ] Real ad network integration (AdMob/Unity Ads)
- [ ] Referral tracking
- [ ] Daily bonuses
- [ ] Achievements system
- [ ] Leaderboards

### Phase 4: Scale 🔮
- [x] Migrate to PostgreSQL (Neon) ✅
- [ ] Add caching layer (Redis)
- [ ] Analytics dashboard
- [ ] Admin panel
- [ ] Social features

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Guidelines**:
- Follow existing code style
- Add TypeScript types
- Test on mobile viewport
- Update documentation

---

## ⚠️ Known Limitations

### Current Demo Mode
- **Simulated Ads**: Uses 5-second timer instead of real ads
- **Manual Payment Confirmation**: TON payments not auto-verified
- **Anonymous Users**: No email/social login yet
- **No Withdrawals**: Withdrawal feature is UI-only

### Production Todos
- Integrate real ad network (AdMob, Unity Ads, etc.)
- Implement TON payment webhook verification
- Add email/social authentication
- Build withdrawal system with Lightning or TON
- Set up admin dashboard for ad management
- Add rate limiting via Supabase

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 💬 Support

- **GitHub**: [github.com/cl0vo/cladhunter.ai](https://github.com/cl0vo/cladhunter.ai)
- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Server Logs**: Check console output of `npm run dev`
- **Database**: Neon Console → SQL Editor
- **Frontend**: Browser DevTools (F12)

---

## 🌟 Acknowledgments

- Database powered by [Neon](https://neon.tech)
- UI components from [Shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide React](https://lucide.dev)
- Charts by [Recharts](https://recharts.org)
- Animations by [Motion](https://motion.dev)
- TON integration via [TON Connect](https://docs.ton.org/develop/dapps/ton-connect)

---

## 🎯 Project Goals

Cladhunter aims to:
- Democratize crypto mining through ad-based earning
- Provide a fun, gamified experience
- Integrate TON blockchain for real value
- Create a sustainable watch-to-earn economy
- Offer a blueprint for similar projects

---

**Made with ❤️ for the TON ecosystem**

*Star ⭐ this repo if you find it useful!*

---

## 📸 Screenshots

*Add your screenshots here after deployment*

---

**Version**: 2.0.0  
**Last Updated**: November 1, 2025  
**Status**: Production Ready (Neon PostgreSQL)  
**Repository**: https://github.com/cl0vo/cladhunter.ai
