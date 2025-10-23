# 🆑 Cladhunter

> **Cloud Mining Simulator & Watch-to-Earn Platform**
> 
> A mobile-first web app where users earn crypto energy by watching ads and can boost their earnings with TON blockchain payments.

![Version](https://img.shields.io/badge/version-1.0.0-red)
![React](https://img.shields.io/badge/React-18+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)
![Supabase](https://img.shields.io/badge/Supabase-Edge%20Functions-green)
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

### Option 1: Use in Figma Make
The app is ready to use immediately in Figma Make with Supabase integration!

### Option 2: Local Development

```bash
# Clone or download the project
cd cladhunter

# Install dependencies (if needed)
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

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
API Layer (Custom Hooks + Fetch)
    ↓
Backend (Supabase Edge Functions - Hono)
    ↓
Database (Supabase KV Store)
    ↓
Blockchain (TON - Future Integration)
```

**📐 Detailed Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)

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
- **Supabase** - Backend-as-a-Service
- **Hono** - Web framework for Edge Functions
- **Deno** - Runtime environment
- **KV Store** - Data persistence

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
| 1 | Bronze | 1.25x | 0.3 TON | 7 days |
| 2 | Silver | 1.5x | 0.7 TON | 14 days |
| 3 | Gold | 2x | 1.5 TON | 30 days |
| 4 | Diamond | 3x | 3.5 TON | 60 days |

---

## 🔐 Security

- ✅ **Authentication**: Supabase Auth with JWT tokens
- ✅ **Anti-Spam**: 30-second cooldown between ads
- ✅ **Rate Limiting**: 200 ads per user per day
- ✅ **Atomic Operations**: Prevent race conditions
- ✅ **Environment Variables**: Sensitive keys protected
- ✅ **CORS**: Properly configured for production

---

## 📡 Tracking API

The `/api/track` serverless endpoint records signed partner events and issues credit ledger entries. It is deployed alongside the app (e.g., as a Vercel function) and is protected with an HMAC signature and Supabase-backed rate limiting.

### Required environment

Set these variables wherever the function runs (local or hosted):

| Variable | Purpose |
| --- | --- |
| `TRACK_HMAC_SECRET` | Shared secret used to validate the `X-Track-Signature` header. |
| `SUPABASE_URL` (or `VITE_SUPABASE_URL`) | Project URL used by the server-side Supabase client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key used for privileged inserts into `events` and `credit_ledger`. |

### Request shape

```json
{
  "idempotencyKey": "evt_123",
  "userId": "user_abc",
  "eventType": "ad.completed",
  "amount": 25,
  "metadata": {
    "partner": "example-network"
  },
  "occurredAt": "2024-10-23T12:00:00.000Z"
}
```

- `idempotencyKey` ensures duplicate notifications return the prior result.
- `metadata` is optional JSON that will be stored verbatim.

Include the raw JSON string in the HMAC signature using SHA-256 and pass it in `X-Track-Signature` (hex or base64).

### Response contract

```json
{
  "deduped": false,
  "eventId": "ed6be7d2-2a47-4c3c-8f4f-cc5de30dd9ce",
  "creditLedgerId": "dc82f4c9-4995-4f7b-877c-93c3d8db8661"
}
```

- `deduped: true` indicates the `idempotencyKey` already existed (no extra credit is issued).
- `creditLedgerId` is `null` when `amount` is `0` or no ledger row is created.
- `429 Too Many Requests` is returned when the user (30/min) or IP (60/min) thresholds are exceeded.

### Local testing

Run the function locally with the Vercel CLI (recommended because Vite alone does not serve `/api/*`):

```bash
export TRACK_HMAC_SECRET="dev-secret"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="service-role-key"

npx vercel dev --listen 3000
```

Then send a signed request (ensure `printf` does **not** add a newline when computing the signature):

```bash
BODY='{"idempotencyKey":"evt_local_1","userId":"user_123","eventType":"ad.completed","amount":25}'
SIGNATURE=$(printf "%s" "$BODY" | openssl dgst -sha256 -hmac "$TRACK_HMAC_SECRET" -binary | xxd -p -c 256)

curl -X POST http://localhost:3000/api/track \
  -H "Content-Type: application/json" \
  -H "X-Track-Signature: $SIGNATURE" \
  -d "$BODY"
```

You should receive the JSON response outlined above. Supabase rows are inserted with the service-role key, and duplicate requests reuse the original `eventId`.

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
├── supabase/             # Backend code
│   └── functions/server/
│       └── index.tsx         # API endpoints (includes rewards API)
├── utils/                # Utility functions
│   ├── helpers.ts            # Helper functions
│   ├── telegram.ts           # Telegram Web App utils
│   └── test-api.ts           # API testing tools
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

### Backend
Already deployed on Supabase Edge Functions!
No additional setup needed.

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
- See inline comments in `/supabase/functions/server/index.tsx`

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
- [ ] Migrate to PostgreSQL
- [ ] Add caching layer
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

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Logs**: Check Supabase Dashboard → Logs → Edge Functions
- **Console**: Browser DevTools (F12) for frontend errors

---

## 🌟 Acknowledgments

- Built with [Supabase](https://supabase.com)
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

**Version**: 1.0.0  
**Last Updated**: October 19, 2025  
**Status**: Production Ready (Demo Mode)
