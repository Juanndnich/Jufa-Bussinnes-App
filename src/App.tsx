import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { NavItem, Sidebar, MobileBottomNav } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './features/dashboard/DashboardView';
import { CalculatorView } from './features/calculator/CalculatorView';
import { StockView } from './features/stock/StockView';
import { SalesView } from './features/sales/SalesView';
import { FinanceView } from './features/finance/FinanceView';
import { AnalysisView } from './features/analysis/AnalysisView';
import { InvestorView } from './features/investor/InvestorView';
import { SettingsView } from './features/settings/SettingsView';
import { PricelistView } from './features/pricelist/PricelistView';
import { AppInfoView } from './features/info/AppInfoView';
import { SplashScreen } from './components/SplashScreen';
import { QuickSaleModal } from './features/sales/QuickSaleModal';
import { repository } from './db/repository';
import { AppSettings } from './db/schema';
import { applyTheme } from './utils/theme';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { playTapSound } from './utils/sound';
import { checkForUpdates, cleanupOldUpdateApks, checkPendingInstall } from './services/updateChecker';

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showGlobalQuickSale, setShowGlobalQuickSale] = useState(false);

  // Network online/offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load state umum (stok & pengaturan)
  const refreshGlobalState = useCallback(async () => {
    try {
      const [s, sum] = await Promise.all([
        repository.getSettings(),
        repository.getTotalStockSummary(),
      ]);
      setSettings(s);
      setCurrentStock(sum.totalRemainingRobux);
      applyTheme(s.theme);
    } catch (err) {
      console.error('Failed to load global state:', err);
    }
  }, []);

  useEffect(() => {
    refreshGlobalState();

    // Pembersihan berkas APK update lama & Cek pembaruan berkala (maks 1x per 6 jam)
    cleanupOldUpdateApks().catch(() => {});
    checkPendingInstall().catch(() => {});

    let appResumeListener: any = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          checkPendingInstall().catch(() => {});
        }
      }).then((handle) => {
        appResumeListener = handle;
      });
    }

    const timer = setTimeout(() => {
      checkForUpdates({
        manual: false,
        onNavigateToBackup: () => handleSelectTab('settings'),
      }).catch(() => {});
    }, 2500);

    return () => {
      clearTimeout(timer);
      if (appResumeListener) {
        appResumeListener.remove();
      }
    };
  }, [refreshGlobalState]);

  // Handler pergantian tab dengan suara tekan
  const handleSelectTab = (tab: NavItem) => {
    if (tab !== currentTab) {
      playTapSound();
      setCurrentTab(tab);
      refreshGlobalState();
    }
  };

  // Toggle Tema Cepat
  const handleToggleTheme = async () => {
    playTapSound();
    const nextTheme = settings?.theme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    await repository.updateSettings({ theme: nextTheme });
    await refreshGlobalState();
  };

  return (
    <>
      {/* Loading Splash Screen Modern saat Buka Aplikasi */}
      <AnimatePresence>
        {showSplash && (
          <SplashScreen
            onComplete={() => setShowSplash(false)}
            logoUrl={settings?.customLogoUrl}
            storeName={settings?.storeName}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen theme-bg-main flex select-none theme-text-primary transition-colors duration-200">
        {/* Desktop Sidebar Terkategori */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          currentStock={currentStock}
          customLogoUrl={settings?.customLogoUrl}
          storeName={settings?.storeName}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            currentStock={currentStock}
            currentTheme={settings?.theme || 'dark'}
            isOnline={isOnline}
            onToggleTheme={handleToggleTheme}
            onNavigateTab={handleSelectTab}
            onOpenQuickSale={() => setShowGlobalQuickSale(true)}
            storeName={settings?.storeName}
            customLogoUrl={settings?.customLogoUrl}
          />

          {/* Dynamic View Container dengan Animasi Smooth */}
          <main className="flex-1 p-3 sm:p-6 overflow-y-auto pb-24 lg:pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                transition={{ duration: 0.16, ease: [0.25, 1, 0.5, 1] }}
                className="w-full"
              >
                {currentTab === 'dashboard' && (
                  <DashboardView onNavigateTab={handleSelectTab} />
                )}

                {currentTab === 'calculator' && (
                  <CalculatorView
                    onSaleSaved={refreshGlobalState}
                    onNavigateToStock={() => handleSelectTab('stock')}
                  />
                )}

                {currentTab === 'pricelist' && <PricelistView />}

                {currentTab === 'stock' && <StockView />}

                {currentTab === 'sales' && <SalesView />}

                {currentTab === 'finance' && <FinanceView />}

                {currentTab === 'analysis' && <AnalysisView />}

                {currentTab === 'investor' && <InvestorView />}

                {currentTab === 'settings' && (
                  <SettingsView onSettingsChanged={refreshGlobalState} />
                )}

                {currentTab === 'info' && <AppInfoView onNavigateTab={handleSelectTab} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar Terkategori */}
        <MobileBottomNav
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
        />
      </div>

      {/* Global Quick Sale Modal */}
      <QuickSaleModal
        isOpen={showGlobalQuickSale}
        onClose={() => setShowGlobalQuickSale(false)}
        onSaleSaved={refreshGlobalState}
      />
    </>
  );
};

export default App;
