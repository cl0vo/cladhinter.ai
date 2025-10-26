/**
 * MongoDB API Testing Utility
 * Use this in browser console to invoke the local Mongo-backed API directly.
 */

import {
  claimReward,
  completeAdWatch,
  createOrder,
  getRewardStatus,
  getUserBalance,
  getUserStats,
  initUser,
  confirmOrder,
} from './api/sqlClient';

export class ApiTester {
  private userId: string;
  constructor(userId?: string) {
    this.userId = userId || `anon_test_${Date.now()}`;
  }

  async testUserInit() {
    console.log('👤 Testing initUser...');
    const response = await initUser({
      userId: this.userId,
    });
    console.log('✅ init response:', response);
    return response;
  }

  async testGetBalance() {
    console.log('💰 Testing getUserBalance...');
    const response = await getUserBalance({ userId: this.userId });
    console.log('✅ balance:', response);
    return response;
  }

  async testCompleteAd(adId = 'test_ad') {
    console.log(`📺 Testing completeAdWatch (${adId})...`);
    const response = await completeAdWatch({
      userId: this.userId,
      adId,
    });
    console.log('✅ ad complete:', response);
    return response;
  }

  async testCreateOrder(boostLevel = 1) {
    console.log(`🛒 Testing createOrder (level ${boostLevel})...`);
    const response = await createOrder({
      userId: this.userId,
      boostLevel,
    });
    console.log('✅ order created:', response);
    return response;
  }

  async testConfirmOrder(orderId: string, txHash?: string) {
    console.log(`✅ Testing confirmOrder (${orderId})...`);
    const response = await confirmOrder({
      userId: this.userId,
      orderId,
      txHash,
    });
    console.log('✅ order confirmed:', response);
    return response;
  }

  async testGetStats() {
    console.log('📊 Testing getUserStats...');
    const response = await getUserStats({ userId: this.userId });
    console.log('✅ stats:', response);
    return response;
  }

  async testRewardStatus() {
    console.log('🎁 Testing getRewardStatus...');
    const response = await getRewardStatus({ userId: this.userId });
    console.log('✅ reward status:', response);
    return response;
  }

  async testClaimReward(partnerId: string) {
    console.log(`🏆 Testing claimReward (${partnerId})...`);
    const response = await claimReward({ userId: this.userId, partnerId });
    console.log('✅ reward claimed:', response);
    return response;
  }

  async simulateMining(count = 5) {
    console.log(`⛏️ Simulating ${count} mining sessions...`);
    for (let i = 0; i < count; i += 1) {
      await this.testCompleteAd(`ad_${i + 1}`);
    }
  }
}

declare global {
  interface Window {
    testApi?: ApiTester;
  }
}

if (typeof window !== 'undefined' && !window.testApi) {
  window.testApi = new ApiTester();
}
