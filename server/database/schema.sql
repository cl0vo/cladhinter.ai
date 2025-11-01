-- Cladhunter Database Schema for Neon PostgreSQL
-- Created: November 1, 2025

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  energy INTEGER NOT NULL DEFAULT 0,
  boost_level INTEGER NOT NULL DEFAULT 0,
  last_watch_at TIMESTAMP,
  boost_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sessions table (for tracking app logins)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Ad watches table (for tracking ad views)
CREATE TABLE IF NOT EXISTS ad_watches (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  reward INTEGER NOT NULL,
  base_reward INTEGER NOT NULL,
  multiplier DECIMAL(4,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Daily watch counts (for rate limiting)
CREATE TABLE IF NOT EXISTS daily_watch_counts (
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Orders table (for TON boost purchases)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  boost_level INTEGER NOT NULL,
  ton_amount DECIMAL(10,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  payload TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reward claims table (for partner rewards)
CREATE TABLE IF NOT EXISTS reward_claims (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  reward INTEGER NOT NULL,
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, partner_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_boost_expires ON users(boost_expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_watches_user_id ON ad_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_watches_created_at ON ad_watches(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_watch_counts_date ON daily_watch_counts(date);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reward_claims_user_id ON reward_claims(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup old sessions (optional, can be run periodically)
-- DELETE FROM sessions WHERE timestamp < NOW() - INTERVAL '90 days';

-- Cleanup old ad watches (optional, keep last 6 months)
-- DELETE FROM ad_watches WHERE created_at < NOW() - INTERVAL '180 days';
