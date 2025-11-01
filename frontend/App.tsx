import { useState, useEffect } from 'react';
import { MiningScreen } from './components/MiningScreen';
import { StatsScreen } from './components/StatsScreen';
import { WalletScreen } from './components/WalletScreen';
import { BottomNav } from './components/BottomNav';
import { Toaster } from './components/Toaster';
import { LoadingAnimation } from './components/LoadingAnimation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import { UserDataProvider } from './hooks/useUserData';
import { initAnalytics } from './utils/analytics';
import { initTelegramWebApp } from './utils/telegram';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<'mining' | 'stats' | 'wallet'>('mining');
  const [isLoading, setIsLoading] = useState(false);
  const { loading: authLoading } = useAuth();

  // Initialize Telegram Web App on mount
  useEffect(() => {
    initTelegramWebApp();
    initAnalytics();
  }, []);

  const handleNavigate = (screen: 'mining' | 'stats' | 'wallet') => {
    setIsLoading(true);
    setTimeout(() => {
      setActiveScreen(screen);
      setIsLoading(false);
    }, 300);
  };

  if (authLoading) {
    return (
      <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden flex items-center justify-center">
        <LoadingAnimation />
      </div>
    );
  }

  return (
    <UserDataProvider>
      <ErrorBoundary>
        <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
          {/* Noise Texture Overlay */}
          <div
            className="fixed inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Main Content Container - Mobile Frame */}
          <div className="relative w-full min-h-screen mx-auto safe-area-inset">
            {isLoading ? (
              <div className="flex items-center justify-center h-screen">
                <LoadingAnimation />
              </div>
            ) : (
              <>
                {activeScreen === 'mining' && <MiningScreen />}
                {activeScreen === 'stats' && (
                  <StatsScreen onStartMining={() => handleNavigate('mining')} />
                )}
                {activeScreen === 'wallet' && <WalletScreen />}
              </>
            )}

            {/* Bottom Navigation */}
            <BottomNav activeScreen={activeScreen} onNavigate={handleNavigate} />
          </div>

          {/* Toast Notifications */}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 0, 51, 0.3)',
                color: '#FF0033',
                textTransform: 'uppercase',
                fontSize: '12px',
                letterSpacing: '0.05em',
              },
            }}
          />
        </div>
      </ErrorBoundary>
    </UserDataProvider>
  );
}
