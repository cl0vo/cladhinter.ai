# Cladhunter Product Analysis & Roadmap (October 2025)

This document condenses the latest repository audit of the watch-to-earn Telegram mini-app. Use it as the source of truth for product decisions, launch planning, and stakeholder updates.

---

## 1. Core Experience Snapshot

- **Launch flow**: Users open the Telegram mini-app, the frontend initialises the Telegram WebApp API for full-screen mode, fetches a TonConnect ton-proof challenge (`GET /api/auth/ton-connect/challenge`), and exchanges the signed proof via `POST /api/auth/ton-connect` to receive `{ userId, accessToken, walletAddress }`. The client caches these credentials through `useAuth` for subsequent requests.
- **Mining loop**: The default screen serves ads defined in `shared/config/ads.ts`. Each creative carries a reward tier (`ENERGY_PER_AD`), delivering CL energy when the user finishes the view. Completion triggers `POST /api/ads/complete`, which enforces cooldown and daily limits before crediting the account and responding with the updated balance.
- **Stats feedback**: `GET /api/stats` powers the Stats tab, aggregating lifetime energy, total ad views, active multiplier, session count, daily usage, and the last watch logs (reward, multiplier, timestamp). This loop is key to habit formation - ensure it is fast and localised.
- **Wallet & boosts**: TonConnect is required when a user buys a boost. `POST /api/orders/create` returns the merchant address, amount, and an encoded comment payload. After the wallet broadcasts the TON transfer, the TonAPI webhook (or a manual `/api/orders/{id}/confirm` call with the transaction hash) verifies the payment before the boost activates.
- **Partner rewards**: Campaigns are defined in `shared/config/partners.ts`. `POST /api/rewards/claim` credits a one-off bonus when eligibility passes, logging the event to `reward_claims`. `GET /api/rewards/status` lists claimed IDs and available rewards for UI badges.
- **Referrals & withdrawal**: UI offers referral links (`/ref/<userId>`) and a disabled Withdrawal CTA. There is no backend logic yet - plan an implementation (or hide these features) before communicating launch promises.

---

## 2. Gaps & Risks

### Architecture & Security
- **Identity binding**: Sessions are currently wallet-only. Bind Telegram `initData` (and other device signals if needed) to merge accounts and discourage multi-account farming.
- **Payment confirmation**: Boost activation now depends on TonAPI verification with a transaction hash. Wire the TonAPI webhook in production, add monitoring, and document fallbacks so manual confirmation is rarely needed.
- **Infra headroom**: Render API / Neon DB have no defined scaling policy. Run load tests for >=1k concurrent requests, increase connection pools, and configure autoscaling where possible.
- **Schema discipline**: Migrations execute inline within `db.ts`. Adopt versioned migrations to prevent accidental divergence between environments.

### Product & UX
- Missing onboarding or glossary; first-run users see Mining without guidance. Add a tutorial modal or progressive coach marks plus RU localisation.
- Error copy is raw ("Daily limit reached"); adapt to user-friendly phrasing and translate.
- Withdraw button is non-functional; either hide it or clearly mark as "coming soon" with tooltip.

### Feature Coverage
- Referral programme has no backend: implement ref tracking on session creation, reward logic (+10% up to 50 CL/month) and anti-fraud checks.
- Payout mechanics are undefined; decide on manual TON disbursement, partner rewards, or automated exchange before advertising withdraw capability.
- No admin tooling; creatives, economy values, and partner campaigns require redeploys. Plan a minimal admin console or config CMS.

### Anti-abuse
- No captcha / behavioural checks. Monitor for abnormal `ads/complete` cadence and be ready to throttle or challenge suspicious actors.
- Payment webhook is present but not wired (no TonAPI subscription or payload mapping). Finalise before launch.

### Analytics & Marketing
- No analytics SDK. Instrument key events (session start, watch complete, boost purchase, referral share) with GA, Amplitude, or an open-source alternative.
- Ad click tracking missing; add a click endpoint/log to back partner performance claims.
- Marketing assets (landing page, Telegram announcements, partner brief) are not tracked - establish ownership and deadlines.

---

## 3. Phased Roadmap

| Phase | Goal | Must-have Deliverables |
|-------|------|------------------------|
| **MVP Launch (0-1k users)** | Ship a trustworthy core loop | Telegram `initData` auth, strict TON payment confirmation, RU/EN localisation + onboarding, analytics baseline, beta feedback loop |
| **Growth (1k-10k users)** | Scale monetisation & partners | Render/Neon scaling playbook, ad/admin tooling, referral backend with safeguards, daily streaks/events, partner campaign operations |
| **Retention (10k+ users)** | Deepen engagement & trust | Leaderboards/achievements, proactive anti-fraud (behavioural heuristics, captcha), withdrawal UX, richer analytics dashboards, community programmes |

---

## 4. Analytics Checklist

- Choose analytics stack (GA4, Amplitude, PostHog). Document events: session_start, ad_view_complete, ad_cooldown_blocked, boost_order_created, boost_paid, reward_claimed, referral_share, referral_conversion.
- Implement client-side tracking hooks aligned with existing React flows (`useAuth`, mining actions, wallet).
- Add error monitoring (Sentry/Logtail) on both frontend and backend.
- Define success metrics: DAU/WAU, avg ads per user, boost conversion rate, retention D1/D7, partner reward uptake.

---

## 5. Marketing Activation Plan

- **Launch kit**: landing page (cladhunter.app), Telegram channel/FAQ, demo video of the mining loop, press blurb for TON ecosystem channels.
- **Partner campaigns**: prepare outreach template, reward configuration sheets, and reporting expectations. Highlight that partners benefit from tracked engagements, while users earn CL bonuses.
- **Retention**: schedule bot notifications or channel posts (e.g., "Daily limit reset", "Weekend boost sale"), plan limited-time boosts or competitions.
- **Community**: stand up user support channel, set tone of voice, identify potential moderators/ambassadors.

---

## 6. Immediate Action Items

1. Spec Telegram identity binding (data contract, migration, frontend handshake).
2. Configure TonAPI webhook delivery (register secret, set retries/alerts) so boosts settle automatically.
3. Draft onboarding copy and RU localisation plan; annotate UI strings for translation.
4. Select analytics tooling, prototype instrumentation on mining + wallet flows.
5. Align marketing checklist with founders: landing, TG channel, partner brief, referral relaunch.

Document progress in pull requests and keep this file updated as decisions land.
