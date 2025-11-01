import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL);

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Economy configuration
const BOOSTS = [
  { level: 0, name: "Base", multiplier: 1, costTon: 0 },
  { level: 1, name: "Bronze", multiplier: 1.25, costTon: 0.3, durationDays: 7 },
  { level: 2, name: "Silver", multiplier: 1.5, costTon: 0.7, durationDays: 14 },
  { level: 3, name: "Gold", multiplier: 2, costTon: 1.5, durationDays: 30 },
  { level: 4, name: "Diamond", multiplier: 3, costTon: 3.5, durationDays: 60 },
];

const AD_COOLDOWN_SECONDS = 30;
const DAILY_VIEW_LIMIT = 200;
const BASE_AD_REWARD = 10;

// Helper: Get user ID from request header
function getUserId(req) {
  return req.headers['x-user-id'];
}

// Helper: Get or create user
async function getOrCreateUser(userId) {
  try {
    // Check if user exists
    const existing = await sql`
      SELECT * FROM users WHERE id = ${userId}
    `;

    if (existing.length > 0) {
      const user = existing[0];
      
      // Check if boost has expired
      if (user.boost_expires_at && new Date(user.boost_expires_at) < new Date()) {
        await sql`
          UPDATE users 
          SET boost_level = 0, boost_expires_at = NULL, updated_at = NOW()
          WHERE id = ${userId}
        `;
        user.boost_level = 0;
        user.boost_expires_at = null;
      }
      
      return user;
    }

    // Create new user
    const newUser = await sql`
      INSERT INTO users (id, energy, boost_level, created_at, updated_at)
      VALUES (${userId}, 0, 0, NOW(), NOW())
      RETURNING *
    `;

    return newUser[0];
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw error;
  }
}

// Helper: Get boost multiplier
function boostMultiplier(level) {
  return BOOSTS.find(b => b.level === level)?.multiplier || 1;
}

// ===== ROUTES =====

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize user (called on app load)
app.post('/user/init', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId || !userId.startsWith('anon_')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await getOrCreateUser(userId);

    // Track session
    await sql`
      INSERT INTO sessions (user_id, timestamp)
      VALUES (${userId}, NOW())
    `;

    res.json({
      user: {
        id: user.id,
        energy: user.energy,
        boost_level: user.boost_level,
        boost_expires_at: user.boost_expires_at,
      }
    });
  } catch (error) {
    console.error('Error initializing user:', error);
    res.status(500).json({ error: 'Failed to initialize user' });
  }
});

// Get user balance
app.get('/user/balance', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await getOrCreateUser(userId);

    res.json({
      energy: user.energy,
      boost_level: user.boost_level,
      multiplier: boostMultiplier(user.boost_level),
      boost_expires_at: user.boost_expires_at,
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Complete ad watch
app.post('/ads/complete', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { ad_id } = req.body;
    
    if (!ad_id) {
      return res.status(400).json({ error: 'Missing ad_id' });
    }

    const user = await getOrCreateUser(userId);

    // Check cooldown
    if (user.last_watch_at) {
      const lastWatch = new Date(user.last_watch_at);
      const now = new Date();
      const secondsSinceLastWatch = (now - lastWatch) / 1000;
      
      if (secondsSinceLastWatch < AD_COOLDOWN_SECONDS) {
        const remainingCooldown = Math.ceil(AD_COOLDOWN_SECONDS - secondsSinceLastWatch);
        return res.status(429).json({ 
          error: 'Cooldown active', 
          cooldown_remaining: remainingCooldown 
        });
      }
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const dailyCount = await sql`
      SELECT count FROM daily_watch_counts 
      WHERE user_id = ${userId} AND date = ${today}
    `;

    const currentCount = dailyCount.length > 0 ? dailyCount[0].count : 0;

    if (currentCount >= DAILY_VIEW_LIMIT) {
      return res.status(429).json({ error: 'Daily limit reached' });
    }

    // Calculate reward
    const multiplier = boostMultiplier(user.boost_level);
    const energyReward = Math.floor(BASE_AD_REWARD * multiplier);

    // Update user
    await sql`
      UPDATE users 
      SET energy = energy + ${energyReward}, 
          last_watch_at = NOW(),
          updated_at = NOW()
      WHERE id = ${userId}
    `;

    // Update daily count
    await sql`
      INSERT INTO daily_watch_counts (user_id, date, count)
      VALUES (${userId}, ${today}, 1)
      ON CONFLICT (user_id, date) 
      DO UPDATE SET count = daily_watch_counts.count + 1
    `;

    // Log watch
    await sql`
      INSERT INTO ad_watches (user_id, ad_id, reward, base_reward, multiplier, created_at)
      VALUES (${userId}, ${ad_id}, ${energyReward}, ${BASE_AD_REWARD}, ${multiplier}, NOW())
    `;

    res.json({
      success: true,
      reward: energyReward,
      new_balance: user.energy + energyReward,
      multiplier: multiplier,
      daily_watches_remaining: DAILY_VIEW_LIMIT - currentCount - 1,
    });
  } catch (error) {
    console.error('Error completing ad watch:', error);
    res.status(500).json({ error: 'Failed to complete ad watch' });
  }
});

// Create boost order
app.post('/orders/create', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { boost_level } = req.body;
    
    if (typeof boost_level !== 'number' || boost_level < 1 || boost_level > 4) {
      return res.status(400).json({ error: 'Invalid boost_level' });
    }

    const boost = BOOSTS.find(b => b.level === boost_level);
    if (!boost) {
      return res.status(404).json({ error: 'Boost not found' });
    }

    // Generate unique order ID and payload
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const payload = `boost_${boost_level}_${userId}_${Date.now()}`;

    // Create order
    await sql`
      INSERT INTO orders (id, user_id, boost_level, ton_amount, status, payload, created_at, updated_at)
      VALUES (${orderId}, ${userId}, ${boost_level}, ${boost.costTon}, 'pending', ${payload}, NOW(), NOW())
    `;

    const merchantAddress = process.env.TON_MERCHANT_ADDRESS || 'UQD_merchant_address_placeholder';

    res.json({
      order_id: orderId,
      address: merchantAddress,
      amount: boost.costTon,
      payload: payload,
      boost_name: boost.name,
      duration_days: boost.durationDays,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Check order status
app.get('/orders/:orderId', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { orderId } = req.params;
    const order = await sql`
      SELECT * FROM orders WHERE id = ${orderId}
    `;

    if (order.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      order_id: order[0].id,
      status: order[0].status,
      boost_level: order[0].boost_level,
      ton_amount: parseFloat(order[0].ton_amount),
      tx_hash: order[0].tx_hash,
      created_at: order[0].created_at,
    });
  } catch (error) {
    console.error('Error checking order status:', error);
    res.status(500).json({ error: 'Failed to check order status' });
  }
});

// Confirm order payment
app.post('/orders/:orderId/confirm', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { orderId } = req.params;
    const { tx_hash } = req.body;

    const order = await sql`
      SELECT * FROM orders WHERE id = ${orderId}
    `;

    if (order.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (order[0].status !== 'pending') {
      return res.status(400).json({ error: 'Order already processed' });
    }

    const txHash = tx_hash || `demo_tx_${Date.now()}`;

    // Update order status
    await sql`
      UPDATE orders 
      SET status = 'paid', tx_hash = ${txHash}, updated_at = NOW()
      WHERE id = ${orderId}
    `;

    // Update user boost
    const boost = BOOSTS.find(b => b.level === order[0].boost_level);
    let expiresAt = null;
    
    if (boost && boost.durationDays) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + boost.durationDays);
      expiresAt = expDate.toISOString();
    }

    await sql`
      UPDATE users 
      SET boost_level = ${order[0].boost_level}, 
          boost_expires_at = ${expiresAt},
          updated_at = NOW()
      WHERE id = ${userId}
    `;

    res.json({
      success: true,
      boost_level: order[0].boost_level,
      boost_expires_at: expiresAt,
      multiplier: boostMultiplier(order[0].boost_level),
    });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ error: 'Failed to confirm order' });
  }
});

// Get user stats
app.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await getOrCreateUser(userId);

    // Get watch history
    const watchHistory = await sql`
      SELECT * FROM ad_watches 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // Get total stats
    const totalStats = await sql`
      SELECT 
        COUNT(*) as total_watches,
        COALESCE(SUM(reward), 0) as total_earned
      FROM ad_watches 
      WHERE user_id = ${userId}
    `;

    // Get session count
    const sessionCount = await sql`
      SELECT COUNT(*) as total_sessions
      FROM sessions
      WHERE user_id = ${userId}
    `;

    // Get today's watch count
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await sql`
      SELECT COALESCE(count, 0) as count
      FROM daily_watch_counts
      WHERE user_id = ${userId} AND date = ${today}
    `;

    res.json({
      total_energy: user.energy,
      total_watches: parseInt(totalStats[0].total_watches),
      total_earned: parseInt(totalStats[0].total_earned),
      total_sessions: parseInt(sessionCount[0].total_sessions),
      today_watches: todayStats.length > 0 ? todayStats[0].count : 0,
      daily_limit: DAILY_VIEW_LIMIT,
      boost_level: user.boost_level,
      multiplier: boostMultiplier(user.boost_level),
      boost_expires_at: user.boost_expires_at,
      watch_history: watchHistory,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get reward claim status
app.get('/rewards/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const claimedRewards = await sql`
      SELECT partner_id FROM reward_claims
      WHERE user_id = ${userId}
    `;

    const claimedPartners = claimedRewards.map(r => r.partner_id);

    res.json({
      claimed_partners: claimedPartners,
      available_rewards: 0,
    });
  } catch (error) {
    console.error('Error fetching reward status:', error);
    res.status(500).json({ error: 'Failed to fetch reward status' });
  }
});

// Claim partner reward
app.post('/rewards/claim', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { partner_id, partner_name, reward_amount } = req.body;

    if (!partner_id || typeof partner_id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid partner_id' });
    }

    if (!reward_amount || typeof reward_amount !== 'number') {
      return res.status(400).json({ error: 'Invalid reward amount' });
    }

    // Check if already claimed
    const existingClaim = await sql`
      SELECT * FROM reward_claims
      WHERE user_id = ${userId} AND partner_id = ${partner_id}
    `;

    if (existingClaim.length > 0) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }

    // Add reward to user balance
    await sql`
      UPDATE users 
      SET energy = energy + ${reward_amount}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    // Record claim
    await sql`
      INSERT INTO reward_claims (user_id, partner_id, reward, claimed_at)
      VALUES (${userId}, ${partner_id}, ${reward_amount}, NOW())
    `;

    // Get updated balance
    const user = await getOrCreateUser(userId);

    res.json({
      success: true,
      reward: reward_amount,
      new_balance: user.energy,
      partner_name: partner_name || 'Partner',
    });
  } catch (error) {
    console.error('Error claiming reward:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cladhunter API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

export default app;
