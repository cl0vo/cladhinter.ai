# 🆑 Cladhunter

> **Cloud Mining Simulator & Watch-to-Earn Platform**
>
> Mobile-first web app where users earn 🆑 energy by watching ads, manage boosts through TON payments, and track progress in real time.

![Version](https://img.shields.io/badge/version-1.1.0-red)
![React](https://img.shields.io/badge/React-18+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen)
![TON](https://img.shields.io/badge/TON-Blockchain-blue)

---

## ✨ Features
- 🎯 **Ad-Based Mining**: Watch ads to earn energy (🆑)
- 🎁 **Partner Rewards**: Complete social quests for bonus energy
- 📱 **Telegram Web App**: Native integration with haptic feedback
- ⚡ **Boost System**: Purchase multipliers with TON cryptocurrency
- 📊 **Statistics Dashboard**: Monitor earnings and performance
- 💰 **Wallet Integration**: Manage balances and history
- 📲 **Mobile-Optimized**: Safe area insets, touch targets, responsive design
- 🎨 **Dark Futuristic Theme**: Glassmorphic UI with red accents
- 🔐 **Secure Backend**: Node middleware + MongoDB (Mongoose models)
- 🚀 **Production Ready**: Full API, data persistence, and error handling
- 🔧 **Easy Config**: Simple files for adding partners and ads

---

## 🚀 Quick Start

### Local Development

```bash
# Clone repository
git clone https://github.com/<org>/cladhunter.ai.git
cd cladhunter.ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB credentials

# Start development
npm run dev
```

**📖 Full Setup Guide**: See [QUICKSTART.md](./QUICKSTART.md)

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
API Layer (Custom Hooks + REST fetch helpers)
    ↓
Backend (Vite middleware + Mongoose services)
    ↓
Database (MongoDB collections)
    ↓
Blockchain (TON - Future Integration)
```

**📐 Detailed Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📈 Analytics

- `watch_logs` — aggregated per-user/per-day watch metrics (count, reward, multiplier) stored in MongoDB.
- REST responses reuse the same MongoDB data used by analytics widgets, keeping dashboards and clients in sync.

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
- **Node (Vite middleware)** - Lightweight API layer
- **Mongoose** - ODM for MongoDB
- **MongoDB** - Persistent storage for users, orders, rewards, and analytics

### Blockchain
- **TON** - Payment infrastructure (to be integrated)
- **TonConnect** - Wallet connection (planned)

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
| 1 | Bronze | 1.25x | 0.5 TON | 7 days |
| 2 | Silver | 1.5x | 1.2 TON | 14 days |
| 3 | Gold | 2x | 2.8 TON | 30 days |
| 4 | Diamond | 3x | 6 TON | 60 days |

---

## 🔐 Security

- ✅ **Authentication**: TON Connect session bootstrap + MongoDB persistence
- ✅ **Anti-Spam**: 30-second cooldown between ads
- ✅ **Rate Limiting**: 200 ads per user per day
- ✅ **Atomic Operations**: Prevent race conditions
- ✅ **Environment Variables**: Sensitive keys protected
- ✅ **CORS**: Properly configured for production

---

## 📁 Project Structure

```
/
├── components/           # React components
│   ├── MiningScreen.tsx      # Main mining interface
│   ├── RewardsSection.tsx    # Partner rewards ⭐ NEW
│   ├── StatsScreen.tsx       # Statistics & charts
│   ├── WalletScreen.tsx      # Wallet & boosts
│   └── ui/                   # Reusable UI components
├── hooks/                # Custom React hooks
│   ├── useAuth.tsx           # Authentication
│   ├── useUserData.tsx       # User state
│   └── useApi.tsx            # API requests
├── config/               # App configuration
│   ├── economy.ts            # Economy settings
│   ├── partners.ts           # Partner rewards config ⭐ NEW
│   └── ads.ts                # Ad creatives config
├── server/               # MongoDB data models and API middleware
│   ├── mongo.ts             # Shared MongoDB client + Mongoose connector ⭐ NEW
│   ├── models/               # Mongoose schemas
│   └── services/             # Business logic (orders, rewards, stats)
├── scripts/              # Node maintenance utilities ⭐ NEW
│   └── create-indexes.ts     # Ensures database indexes for core collections
├── utils/                # Utility functions
│   ├── helpers.ts           # Helper functions
│   ├── telegram.ts          # Telegram Web App utils
│   └── test-api.ts          # API testing tools
├── types/                # TypeScript types
├── App.tsx               # Main app component
└── styles/               # Global styles
```

---

## 🧪 Testing

### Manual Testing
```bash
# In the browser console run individual helpers:
await window.testApi.testUserInit()
await window.testApi.testGetBalance()
await window.testApi.testCompleteAd('ad_demo')
```

The app runs on [http://localhost:5173](http://localhost:5173) by default.

---

## 🛠️ Local Development

1. **Copy environment file**: `cp .env.example .env` and update the placeholders with your Atlas connection string, database name, and TON configuration.
2. **Install dependencies**: `npm install`.
3. **Provision database indexes**: `npm run db:indexes` creates the required indexes for the `users`, `ledger`, and `sessions` collections (see below).
4. **Start the dev server**: `npm run dev`.

The dev middleware automatically connects to MongoDB through `server/mongo.ts`, which shares the cached `MongoClient` between the index script and the Vite API routes.

---

## 🌍 Environment Variables
| Variable | Description |
| --- | --- |
| `MONGODB_URI` | Connection string for MongoDB Atlas (used by MongoDB client/Mongoose). |
| `MONGODB_DB` | Database name used for the Cladhunter collections. |
| `TON_API_KEY` | Optional key for TON payment gateway integrations. |
| `NEXT_PUBLIC_TON_APP_NAME` | Public identifier shown in TON Connect. |
| `VERCEL_ENV` | Optional deployment stage flag for logging. |
| `VITE_TON_MANIFEST` | Optional override for the TonConnect manifest URL. |

### Frontend
Deploy to any static hosting:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop build folder
- **GitHub Pages**: Push to gh-pages branch

### Backend
MongoDB is accessed directly via the built-in Vite middleware. Ensure both `MONGODB_URI` and `MONGODB_DB` are configured before running the dev server.

### Database Index Script

- `npm run db:indexes` runs `scripts/create-indexes.ts`, which connects with the shared `MongoClient` and ensures the following indexes exist:
  - `users`: unique index on `{ wallet: 1 }` for wallet identity lookups.
  - `ledger`: unique index on `{ idemKey: 1 }` and compound index on `{ wallet: 1, createdAt: -1 }` for idempotent reward/payment writes.
  - `sessions`: TTL index on `{ ttl: 1 }` so ephemeral sessions expire automatically.

Re-run the script after deploying new environments or when restoring from a backup to guarantee the indexes are present.

---

## 🚀 Deployment (Vercel)
1. Push your branch to GitHub.
2. Ensure the Vercel project is connected to the GitHub repository.
3. In the Vercel dashboard, configure the environment variables from `.env.example` (`MONGODB_URI`, `MONGODB_DB`, `TON_API_KEY`, `NEXT_PUBLIC_TON_APP_NAME`, `VERCEL_ENV`, `VITE_TON_MANIFEST`).
4. Deploy the project (Vercel automatically builds each push).
5. After the first deployment, run `npm run db:indexes` locally or from a CI job against the production database to provision the MongoDB indexes.
6. Verify the preview build, then promote to production when ready.

---

## 🔁 Workflow
```
Codex → GitHub → Vercel
```

### Theme Colors
Edit `/styles/globals.css` to change brand colors.

---

## 📚 Documentation

### Getting Started
- **Quick Start**: [QUICKSTART.md](./QUICKSTART.md) - Get started in 5 minutes
- **Setup Guide**: [SETUP.md](./SETUP.md) - Detailed setup instructions
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md) - System design & data flow

### Partner & Ads Setup ⭐ NEW
- **Rewards Guide**: [REWARDS_GUIDE.md](./REWARDS_GUIDE.md) - Add partners & ads easily

### Ad System
- **Ad System Guide**: [AD_SYSTEM.md](./AD_SYSTEM.md) - Complete ad integration guide
- **Ad Quick Start**: [AD_QUICKSTART.md](./AD_QUICKSTART.md) - Partner ad setup
- **Ad Flow**: [docs/ad-flow.md](./docs/ad-flow.md) - Visual flow diagrams

### Mobile & Telegram
- **Mobile Optimization**: [MOBILE_OPTIMIZATION.md](./MOBILE_OPTIMIZATION.md) - Full mobile guide
- **Mobile Quick Start**: [MOBILE_QUICKSTART.md](./MOBILE_QUICKSTART.md) - TG Web App setup
- **Testing Checklist**: [docs/mobile-testing-checklist.md](./docs/mobile-testing-checklist.md) - QA guide

### API Reference
- See inline comments in `/server/services/userService.ts`

---

## 🗺 Roadmap

### Phase 1: MVP ✅
- [x] Core mining mechanics
- [x] User authentication
- [x] Energy system
- [x] Basic UI/UX
- [x] MongoDB integration

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
- [ ] Harden MongoDB indexes & sharding strategy
- [ ] Add caching layer
- [ ] Analytics dashboard
- [ ] Admin panel
- [ ] Social features

---

## 🤝 Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit changes (`git commit -m "feat: add amazing feature"`).
4. Push the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request with summary + testing notes.

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
- Add rate limiting at the API middleware level

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 💬 Support

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Logs**: Inspect Vite dev server output / cloud logs for middleware
- **Console**: Browser DevTools (F12) for frontend errors

---

## 🌟 Acknowledgments

- Backed by [MongoDB](https://www.mongodb.com)
- UI components from [Shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide React](https://lucide.dev)
- Charts by [Recharts](https://recharts.org)
- Animations by [Motion](https://motion.dev)

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

**Version**: 1.1.0  
**Last Updated**: October 22, 2025  
**Status**: Production Ready (Demo Mode)
