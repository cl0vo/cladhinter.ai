# Ad System Flow Diagram

## User Journey Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER OPENS APP                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MINING SCREEN LOADS                           │
│  • Shows balance                                                 │
│  • Shows active boosts                                           │
│  • Shows "START MINING" button                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              USER CLICKS "START MINING"                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              getRandomAd() FROM CONFIG                           │
│  • Selects random ad from adCreatives[]                          │
│  • Returns video or image creative                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               AD MODAL OPENS (FULLSCREEN)                        │
│  ┌────────────────────────────────────────────────────┐         │
│  │                                                     │         │
│  │        Video/Image Creative (9:16)                 │         │
│  │                                                     │         │
│  │        [Partner Name Badge]                        │         │
│  │                                                     │         │
│  │        [Progress bar for video]                    │         │
│  │                                                     │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │         [CLAIM REWARD] - appears after 6s          │         │
│  └────────────────────────────────────────────────────┘         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────┐
                  │ User     │
                  │ clicks   │
                  │ "CLAIM"  │
                  └────┬─────┘
                       │
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Check minViewDuration (3s)  │
        │  ✓ Valid view                │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  onAdCompleted() TRIGGERED   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    AD MODAL CLOSES            │
        │    Mining progress starts     │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   MINING ANIMATION (5s)      │
        │   Progress ring: 0% → 100%   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  SERVER: POST /ads/complete  │
        │  • Check cooldown (30s)      │
        │  • Check daily limit (200)   │
        │  • Calculate reward w/ boost │
        │  • Log view to KV store      │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    REWARD CREDITED            │
        │  Base: 10 🆑                  │
        │  With boost: up to 30 🆑      │
        │  Toast: "+10 🆑 mined!"       │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    COOLDOWN STARTS (30s)     │
        │    Button disabled            │
        │    Shows countdown            │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   USER CAN MINE AGAIN         │
        └──────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MiningScreen.tsx                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  State Management:                                      │    │
│  │  • isAdModalOpen                                        │    │
│  │  • currentAdCreative                                    │    │
│  │  • isMining                                             │    │
│  │  • miningProgress                                       │    │
│  │  • cooldownRemaining                                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Functions:                                             │    │
│  │  • handleStartMining() → Opens AdModal                  │    │
│  │  • handleAdCompleted() → Starts mining                  │    │
│  │  • completeAdWatch() → Server request                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                 Renders:                                │    │
│  │  • Mining button with progress ring                     │    │
│  │  • AdModal (conditionally)                              │    │
│  │  • Boost cards                                          │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ Imports
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      config/ads.ts                               │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  adCreatives: AdCreative[]                              │    │
│  │  • id, type, url, partnerUrl, partnerName, duration     │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  getRandomAd(): AdCreative                              │    │
│  │  • Returns random ad from pool                          │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  adConfig                                               │    │
│  │  • skipDelay, minViewDuration, etc.                     │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ Used by
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      components/AdModal.tsx                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Props:                                                 │    │
│  │  • isOpen, ad, onClose, onAdCompleted                   │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Features:                                              │    │
│  │  • Fullscreen modal                                     │    │
│  │  • Video/Image rendering                                │    │
│  │  • Claim button at bottom (appears after 6s)            │    │
│  │  • Countdown indicator                                  │    │
│  │  • Opens partner site on claim                          │    │
│  │  • Min view duration validation                         │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │
       │ 1. User clicks "START MINING"
       │
       ▼
┌────────────────────┐
│  getRandomAd()     │ ← config/ads.ts
└──────┬─────────────┘
       │
       │ 2. Show AdModal with creative
       │
       ▼
┌────────────────────┐
│  AdModal displays  │
│  User watches      │
└──────┬─────────────┘
       │
       │ 3. User completes/skips (>3s)
       │
       ▼
┌────────────────────┐
│  onAdCompleted()   │
│  Mining starts     │
└──────┬─────────────┘
       │
       │ 4. POST /ads/complete
       │    body: { ad_id: "partner_1" }
       │
       ▼
┌──────────────┐
│   Backend    │
└──────┬───────┘
       │
       │ 5. Validate cooldown & daily limit
       │
       ▼
┌────────────────��───┐
│  Calculate reward  │
│  base × multiplier │
└──────┬─────────────┘
       │
       │ 6. Update user.energy
       │    Log to KV store
       │
       ▼
┌────────────────────┐
│  Return response   │
│  { reward, balance,│
│    multiplier }    │
└──────┬─────────────┘
       │
       │ 7. Response
       │
       ▼
┌──────────────┐
│   Frontend   │
│  Show toast  │
│  Update UI   │
└──────────────┘
```

## Server-Side Security Checks

```
POST /ads/complete
       │
       ▼
┌──────────────────────────────┐
│  1. Auth Check               │
│  ✓ Valid Bearer token        │
│  ✓ User exists               │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  2. Cooldown Check           │
│  • last_watch_at < 30s ago?  │
│  ❌ Return 429 if too soon   │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  3. Daily Limit Check        │
│  • watch_count:{user}:{date} │
│  ❌ Return 429 if >= 200     │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  4. Calculate Reward         │
│  • BASE_AD_REWARD = 10       │
│  • multiplier = boost level  │
│  • reward = 10 × multiplier  │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  5. Update User              │
│  • user.energy += reward     │
│  • user.last_watch_at = now  │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  6. Log View                 │
│  • watch:{user}:{timestamp}  │
│  • Store ad_id, reward, etc. │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  7. Increment Counter        │
│  • watch_count +1            │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  8. Return Success           │
│  ✅ 200 OK                   │
└──────────────────────────────┘
```

## File Structure

```
/
├── config/
│   └── ads.ts                    ← Ad creatives config
├── components/
│   ├── AdModal.tsx               ← Ad display component
│   └── MiningScreen.tsx          ← Main screen
├── supabase/functions/server/
│   └── index.tsx                 ← Backend API
└── docs/
    └── ad-flow.md                ← This file
```

## Key Features

✅ **Client-side ad selection** - Fast, no server roundtrip  
✅ **Fullscreen immersive ads** - Better engagement  
✅ **Claim button** - Fixed at bottom, appears after 6s delay  
✅ **Guaranteed partner visit** - Opens site when claiming reward  
✅ **Minimum view duration** - Must watch 3+ seconds  
✅ **Server-side validation** - Security against abuse  
✅ **Boost multipliers** - Incentivize premium purchases  
✅ **Cooldown system** - Prevent spam (30s)  
✅ **Daily limits** - Fair usage (200/day)  
✅ **Analytics logging** - Track all views in KV store  

## Adding New Ads

1. Upload creative to CDN
2. Add to `config/ads.ts`:
   ```typescript
   {
     id: 'new_partner',
     type: 'video',
     url: 'https://cdn.com/ad.mp4',
     partnerUrl: 'https://partner.com',
   }
   ```
3. Done! Ad will appear randomly

No server changes needed! 🎉
