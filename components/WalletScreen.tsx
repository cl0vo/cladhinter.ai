import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from './GlassCard';
import { Button } from './ui/button';
import { TonConnectButton } from './TonConnectButton';
import { Copy, Share2, Zap, TrendingUp, Shield, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useUserData } from '../hooks/useUserData';
import { useApi } from '../hooks/useApi';
import { useTonConnect } from '../hooks/useTonConnect';
import { BOOSTS, energyToTon } from '../config/economy';
import type { LedgerHistoryEntry } from '../utils/api/sqlClient';

interface OrderResponse {
  order_id: string;
  address: string;
  amount: number;
  payload: string;
  boost_name: string;
  duration_days: number;
}

interface ConfirmResponse {
  success: boolean;
  boost_level: number;
  boost_expires_at: string;
  multiplier: number;
}

const BASE64_PAYLOAD_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const isValidTonPayload = (value: string | undefined | null): value is string => {
  return typeof value === 'string' && value.length > 0 && BASE64_PAYLOAD_REGEX.test(value);
};

function resolveLedgerLabel(entry: LedgerHistoryEntry): string {
  const metadata = entry.metadata;

  if (metadata && typeof metadata === 'object') {
    const record = metadata as Record<string, unknown>;
    const possibleKeys = ['label', 'title', 'reason', 'source', 'type'];

    for (const key of possibleKeys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim().toUpperCase();
      }
    }
  }

  return entry.type === 'debit' ? 'DEBIT' : 'CREDIT';
}

function resolveLedgerDetail(entry: LedgerHistoryEntry): string | null {
  const metadata = entry.metadata;

  if (metadata && typeof metadata === 'object') {
    const record = metadata as Record<string, unknown>;
    const possibleKeys = ['description', 'note', 'details'];

    for (const key of possibleKeys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
}

export function WalletScreen() {
  const { user } = useAuth();
  const { userData, refreshBalance } = useUserData();
  const {
    createOrder: createOrderRpc,
    confirmOrder: confirmOrderRpc,
    getLedgerHistory: getLedgerHistoryRpc,
  } = useApi();
  const { sendTransaction, isConnected, wallet, connect } = useTonConnect();

  const [pendingOrder, setPendingOrder] = useState<OrderResponse | null>(null);
  const [processingBoost, setProcessingBoost] = useState<number | null>(null);
  const [isSendingTx, setIsSendingTx] = useState(false);
  const [transactions, setTransactions] = useState<LedgerHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const balance = userData?.energy || 0;
  const balanceInTon = energyToTon(balance);
  const currentBoostLevel = userData?.boost_level || 0;

  const loadLedgerHistory = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setHistoryError(null);
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await getLedgerHistoryRpc({
        userId: user.id,
        page: 1,
        limit: 25,
      });

      if (response) {
        setTransactions(response.entries);
      } else {
        setHistoryError('Failed to load transactions');
      }
    } catch (error) {
      console.error('Failed to fetch ledger history:', error);
      setHistoryError('Failed to load transactions');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [user, getLedgerHistoryRpc]);

  useEffect(() => {
    void loadLedgerHistory();
  }, [loadLedgerHistory]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleRefresh = () => {
      void loadLedgerHistory();
    };

    window.addEventListener('ledger-history:refresh', handleRefresh);

    return () => {
      window.removeEventListener('ledger-history:refresh', handleRefresh);
    };
  }, [loadLedgerHistory]);

  const handleCopyAddress = async () => {
    if (!wallet) {
      toast.error('Connect your TON wallet to copy the address.');
      return;
    }

    try {
      await navigator.clipboard.writeText(wallet.address);
      toast.success('Address copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy wallet address:', error);
      toast.error('Unable to copy address. Please try again.');
    }
  };

  const handleShareLink = () => {
    if (!user) {
      toast.error('Connect your TON wallet to get your referral link.');
      return;
    }

    const referralTarget = user.address || user.id;
    const referralLink = `https://cladhunter.app/ref/${referralTarget}`;
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const handleBuyBoost = async (boostLevel: number) => {
    if (processingBoost !== null) return;

    // Check if wallet is connected for TON payment
    if (!isConnected) {
      toast.error('Please connect your TON wallet first!');
      try {
        await connect();
      } catch (connectError) {
        console.error('Failed to open TON connect modal:', connectError);
      }
      return;
    }

    if (!user) {
      toast.error('We could not read your wallet data. Please reconnect.');
      return;
    }

    setProcessingBoost(boostLevel);

    try {
      // Create order on server
      const orderData = await createOrderRpc({
        userId: user.id,
        boostLevel,
      });

      if (!orderData) {
        toast.error('Unable to create boost order. Please configure the merchant wallet and try again.');
        return;
      }

      // Send transaction via TON Connect
      setIsSendingTx(true);
      try {
        const amountInNanoTon = Math.floor(orderData.amount * 1_000_000_000).toString();
        const payloadForWallet = isValidTonPayload(orderData.payload)
          ? orderData.payload
          : undefined;

        const txResult = await sendTransaction({
          to: orderData.address,
          amount: amountInNanoTon,
          ...(payloadForWallet ? { payload: payloadForWallet } : {}),
        });

        if (txResult) {
          toast.success('Transaction sent! Confirming boost...');

          // Confirm payment on server
          const result = await confirmOrderRpc({
            userId: user.id,
            orderId: orderData.order_id,
            txHash: txResult.boc,
          });

          if (result) {
            toast.success(`${orderData.boost_name} boost activated! x${result.multiplier} multiplier`);
            await refreshBalance();
            await loadLedgerHistory();
          }
        }
      } catch (txError) {
        console.error('Transaction error:', txError);
        toast.error('Transaction failed. Please try again.');
        setPendingOrder(orderData); // Set as pending for manual confirmation
      } finally {
        setIsSendingTx(false);
      }
    } catch (error) {
      console.error('Error buying boost:', error);
      toast.error('Unable to start boost purchase. Please configure the merchant wallet and try again.');
    } finally {
      setProcessingBoost(null);
    }
  };

  const handleConfirmPayment = async () => {
    if (!user || !pendingOrder) return;

    const result = await confirmOrderRpc({
      userId: user.id,
      orderId: pendingOrder.order_id,
    });

    if (result) {
      toast.success(`${pendingOrder.boost_name} boost activated! x${result.multiplier} multiplier`);
      setPendingOrder(null);
      await refreshBalance();
      await loadLedgerHistory();
    }
  };

  const premiumBoosts = BOOSTS.slice(1).map(boost => ({
    level: boost.level,
    icon: boost.level === 1 ? TrendingUp : boost.level === 2 ? Zap : boost.level === 3 ? Shield : Zap,
    label: boost.name.toUpperCase(),
    duration: `${boost.durationDays} DAYS`,
    price: `${boost.costTon} TON`,
    multiplier: `x${boost.multiplier}`,
    isActive: currentBoostLevel === boost.level,
  }));

  return (
    <div className="px-4 pt-6 pb-24 min-h-screen">
      {/* Header */}
      <h1 className="text-xl tracking-wider mb-5 text-[#FF0033] uppercase text-center">
        WALLET
      </h1>

      {/* TON Wallet Connection */}
      <div className="mb-5">
        <p className="text-white/60 text-xs uppercase tracking-wider mb-3">TON WALLET</p>
        <GlassCard className="p-4">
          <TonConnectButton />
        </GlassCard>
      </div>

      {/* Balance Card */}
      <GlassCard className="p-5 mb-5 text-center" glowEffect>
        <p className="text-white/60 text-xs uppercase tracking-wider mb-2">TOTAL BALANCE</p>
        <p className="text-4xl sm:text-5xl text-[#FF0033] mb-1">{balance.toFixed(1)} 🆑</p>
        <p className="text-white/40 text-xs mb-5">≈ {balanceInTon.toFixed(6)} TON</p>
        <div className="flex gap-2">
          <Button className="flex-1 bg-[#FF0033] hover:bg-[#FF0033]/80 text-white uppercase tracking-wider min-h-[48px] touch-manipulation text-xs">
            <ArrowUpFromLine size={14} className="mr-1" />
            WITHDRAW
          </Button>
          <Button
            onClick={handleCopyAddress}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white uppercase tracking-wider min-h-[48px] touch-manipulation text-xs"
          >
            <Copy size={14} className="mr-1" />
            COPY
          </Button>
        </div>
      </GlassCard>

      {/* Pending Order */}
      {pendingOrder && (
        <GlassCard className="p-4 mb-5 border-2 border-[#FF0033]">
          <p className="text-[#FF0033] uppercase tracking-wider mb-3">PENDING PAYMENT</p>
          <p className="text-white/80 text-sm mb-2">
            Send {pendingOrder.amount} TON to:
          </p>
          <p className="text-white/60 text-xs mb-3 break-all">
            {pendingOrder.address}
          </p>
          <p className="text-white/50 text-xs mb-3">
            Payload: {pendingOrder.payload}
          </p>
          <Button
            onClick={handleConfirmPayment}
            className="w-full bg-[#FF0033] hover:bg-[#FF0033]/80 text-white uppercase tracking-wider min-h-[48px]"
          >
            I HAVE SENT THE PAYMENT
          </Button>
        </GlassCard>
      )}

      {/* Referrals Section */}
      <div className="mb-5">
        <p className="text-white/60 text-xs uppercase tracking-wider mb-3">REFERRALS</p>
        <GlassCard className="p-4">
          <p className="text-white/80 mb-2">
            INVITE FRIENDS — EARN 10%
          </p>
          <p className="text-white/50 text-xs mb-3">
            (CAP 50 🆑/MONTH PER FRIEND)
          </p>
          <Button
            onClick={handleShareLink}
            className="w-full bg-white/10 hover:bg-white/20 text-[#FF0033] uppercase tracking-wider min-h-[48px] touch-manipulation"
          >
            <Share2 size={14} className="mr-2" />
            SHARE LINK
          </Button>
        </GlassCard>
      </div>

      {/* Premium Boosts Section */}
      <div className="mb-5">
        <p className="text-white/60 text-xs uppercase tracking-wider mb-3">PREMIUM BOOSTS</p>
        
        {/* Info message when wallet not connected */}
        {!isConnected && (
          <GlassCard className="p-3 mb-3 border border-[#0098EA]/30">
            <p className="text-[#0098EA] text-xs text-center">
              💎 Connect your TON wallet above to purchase premium boosts
            </p>
          </GlassCard>
        )}
        
        <div className="space-y-2">
          {premiumBoosts.map((boost) => {
            const Icon = boost.icon;
            return (
              <GlassCard 
                key={boost.level} 
                className={`p-3 ${boost.isActive ? 'border-2 border-[#FF0033]' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon size={18} className="text-[#FF0033] flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="uppercase text-white tracking-wide text-sm">{boost.label}</p>
                        {boost.isActive && (
                          <CheckCircle2 size={14} className="text-[#FF0033]" />
                        )}
                      </div>
                      <p className="text-[10px] text-white/50">
                        {boost.duration} • {boost.multiplier}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleBuyBoost(boost.level)}
                    disabled={processingBoost !== null || boost.isActive || isSendingTx}
                    className={`${
                      boost.isActive 
                        ? 'bg-white/10 text-white/40' 
                        : 'bg-[#FF0033] hover:bg-[#FF0033]/80 text-white'
                    } text-xs px-3 py-2 h-auto flex-shrink-0 touch-manipulation`}
                  >
                    {boost.isActive 
                      ? 'ACTIVE' 
                      : processingBoost === boost.level 
                        ? 'PROCESSING...' 
                        : boost.price
                    }
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Transactions Section */}
      <div className="mb-4">
        <p className="text-white/60 text-xs uppercase tracking-wider mb-3">TRANSACTIONS</p>
        <div className="space-y-2 max-h-[180px] overflow-y-auto">
          {isHistoryLoading ? (
            <GlassCard className="p-3">
              <p className="text-center text-white/50 text-xs uppercase tracking-wide">Loading transactions...</p>
            </GlassCard>
          ) : historyError ? (
            <GlassCard className="p-3">
              <p className="text-center text-[#FF0033] text-xs uppercase tracking-wide">{historyError}</p>
            </GlassCard>
          ) : transactions.length === 0 ? (
            <GlassCard className="p-3">
              <p className="text-center text-white/40 text-xs uppercase tracking-wide">
                {user ? 'No transactions yet' : 'Connect wallet to view transactions'}
              </p>
            </GlassCard>
          ) : (
            transactions.map((tx) => {
              const amountPrefix = tx.type === 'debit' ? '-' : '+';
              const absoluteAmount = Math.abs(tx.amount);
              const formattedAmount = `${amountPrefix}${absoluteAmount.toLocaleString(undefined, {
                minimumFractionDigits: Number.isInteger(absoluteAmount) ? 0 : 2,
                maximumFractionDigits: 4,
              })}`;
              const label = resolveLedgerLabel(tx);
              const detail = resolveLedgerDetail(tx);
              const timestamp = new Date(tx.created_at);
              const currencyLabel = tx.currency ? tx.currency.toUpperCase() : '';
              const timeLabel = Number.isNaN(timestamp.getTime())
                ? ''
                : timestamp.toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

              return (
                <GlassCard key={tx.id} className="p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {tx.type === 'debit' ? (
                        <ArrowDownToLine size={14} className="text-white/40 flex-shrink-0" />
                      ) : (
                        <ArrowUpFromLine size={14} className="text-[#FF0033] flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`${tx.type === 'debit' ? 'text-white/60' : 'text-[#FF0033]'}`}>
                          {formattedAmount} {currencyLabel}
                        </p>
                        <p className="text-[10px] text-white/50 uppercase truncate">{label}</p>
                        {detail && (
                          <p className="text-[9px] text-white/40 truncate">{detail}</p>
                        )}
                      </div>
                    </div>
                    {timeLabel && (
                      <p className="text-[10px] text-white/40 flex-shrink-0 text-right leading-tight">
                        {timeLabel}
                      </p>
                    )}
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      </div>

      {/* Next Payout */}
      <p className="text-center text-white/40 text-[10px] uppercase tracking-wide">
        NEXT PAYOUT WINDOW: 23H 12M
      </p>
    </div>
  );
}
