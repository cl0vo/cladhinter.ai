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
- 🔧 **Easy Config**: Simple files for adding partners and ads

---

## 📦 Installation
```bash
# Clone repository
git clone https://github.com/<org>/cladhunter.ai.git
cd cladhunter.ai

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your own values
```

Start the development server:
```bash
npm run dev
```

The app runs on [http://localhost:5173](http://localhost:5173) by default.

---

## 🌍 Environment Variables
| Variable | Description |
| --- | --- |
| `MONGODB_URI` | Connection string for MongoDB Atlas (used by Mongoose). |
| `TON_API_KEY` | Optional key for TON payment gateway integrations. |
| `NEXT_PUBLIC_TON_APP_NAME` | Public identifier shown in TON Connect. |
| `VERCEL_ENV` | Optional deployment stage flag for logging. |

Set these variables locally in `.env.local`, and replicate them in the Vercel project settings under **Environment Variables**.

---

## 🚀 Deployment (Vercel)
1. Push your branch to GitHub.
2. Ensure the Vercel project is connected to the GitHub repository.
3. In Vercel dashboard, add the required environment variables (`MONGODB_URI`, `TON_API_KEY`, `NEXT_PUBLIC_TON_APP_NAME`, `VERCEL_ENV`).
4. Trigger a deployment (Vercel automatically deploys each push).
5. Verify the preview build, then promote to production when ready.

---

## 🔁 Workflow
```
Codex → GitHub → Vercel
```
- Use Codex instructions (agent.md) to scope work.
- Commit and push changes to GitHub with descriptive messages.
- Rely on Vercel previews for QA before production promotion.

---

## 🤝 Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit changes (`git commit -m "feat: add amazing feature"`).
4. Push the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request with summary + testing notes.

Guidelines:
- Follow existing code style and linting.
- Keep MongoDB access through shared Mongoose helpers.
- Update documentation when architecture changes.

---

## 📄 License
This project is licensed under the MIT License - see [LICENSE](./LICENSE).

---

**Version**: 1.1.0  
**Last Updated**: October 22, 2025  
**Status**: Production Ready (Demo Mode)
