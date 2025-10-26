import { useEffect, useMemo, useState } from 'react';
import { Wallet, LogOut, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useTonConnect } from '../hooks/useTonConnect';
import { Button } from './ui/button';

export function TonConnectButton() {
  const {
    wallet,
    isConnecting,
    connect,
    disconnect,
    isConnected,
    isVerifying,
    proofError,
    hasWalletConnection,
    friendlyAddress,
    rawAddress,
  } = useTonConnect();
  const [copied, setCopied] = useState(false);

  const resolvedAddress = useMemo(() => {
    return wallet?.address || friendlyAddress || rawAddress || '';
  }, [wallet?.address, friendlyAddress, rawAddress]);

  useEffect(() => {
    setCopied(false);
  }, [resolvedAddress]);

  useEffect(() => {
    if (proofError) {
      toast.error(proofError);
    }
  }, [proofError]);

  const formatAddress = (address: string) => {
    if (!address) {
      return '—';
    }

    if (address.length <= 12) {
      return address;
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to open TON Connect modal.';
      toast.error(message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to disconnect wallet.';
      toast.error(message);
    }
  };

  const handleCopyAddress = async () => {
    if (!resolvedAddress) {
      toast.error('Connect your TON wallet to copy the address.');
      return;
    }

    try {
      await navigator.clipboard.writeText(resolvedAddress);
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy wallet address:', error);
      toast.error('Unable to copy address. Please try again.');
    }
  };

  const isBusy = isConnecting || isVerifying;

  if (isConnected && wallet) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/5 rounded-lg px-3 py-2.5 border border-white/10">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
              Verified Wallet
            </p>
            <p className="text-white text-sm font-mono">{formatAddress(wallet.address)}</p>
          </div>
          <Button
            onClick={handleCopyAddress}
            variant="ghost"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white h-[54px] px-3"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </Button>
          <Button
            onClick={handleDisconnect}
            variant="ghost"
            size="sm"
            className="bg-[#FF0033]/20 hover:bg-[#FF0033]/30 text-[#FF0033] h-[54px] px-3"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    );
  }

  if (hasWalletConnection) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/5 rounded-lg px-3 py-2.5 border border-white/10">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
              {isVerifying ? 'Verifying proof' : 'Awaiting proof'}
            </p>
            <p className="text-white text-sm font-mono">{formatAddress(resolvedAddress)}</p>
          </div>
          <Button
            onClick={handleDisconnect}
            variant="ghost"
            size="sm"
            className="bg-[#FF0033]/20 hover:bg-[#FF0033]/30 text-[#FF0033] h-[54px] px-3"
          >
            <LogOut size={16} />
          </Button>
        </div>
        <p
          className={`text-xs ${proofError ? 'text-[#FF0033]' : 'text-white/60'}`}
        >
          {proofError
            ? 'Proof verification failed. Disconnect and try again.'
            : 'Approve the proof request in your wallet to complete sign-in.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleConnect}
        disabled={isBusy}
        className="w-full bg-[#0098EA] hover:bg-[#0098EA]/80 text-white uppercase tracking-wider min-h-[48px] touch-manipulation"
      >
        {isBusy ? (
          <Loader2 size={16} className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wallet size={16} className="mr-2" />
        )}
        {isVerifying ? 'Verifying proof...' : isConnecting ? 'Connecting...' : 'Connect TON Wallet'}
      </Button>
      {proofError && (
        <p className="text-xs text-[#FF0033] text-center">
          {proofError}
        </p>
      )}
    </div>
  );
}
