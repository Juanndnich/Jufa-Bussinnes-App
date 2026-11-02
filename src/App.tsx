import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Swal from 'sweetalert2';
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
import { playTapSound, resumeAudioContext } from './utils/sound';
import { checkForUpdates, cleanupOldUpdateApks } from './services/updateChecker';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { initSyncService } from './services/syncService';

export const App: React.FC = () => {
  useNetworkStatus();
  const [showSplash, setShowSplash] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [showGlobalQuickSale, setShowGlobalQuickSale] = useState(false);

  // Refs untuk listener tombol back Android agar selalu mendapatkan nilai state terbaru
  const currentTabRef = useRef<NavItem>(currentTab);
  currentTabRef.current = currentTab;
  const showQuickSaleRef = useRef<boolean>(showGlobalQuickSale);
  showQuickSaleRef.current = showGlobalQuickSale;

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

  // Handler pergantian tab dengan suara tekan
  const handleSelectTab = useCallback((tab: NavItem) => {
    if (tab !== currentTabRef.current) {
      playTapSound();
      setCurrentTab(tab);
      refreshGlobalState();
    }
  }, [refreshGlobalState]);

  useEffect(() => {
    refreshGlobalState();

    // Pembersihan sekali berkas sisa APK update lama pada startup (try/catch aman)
    cleanupOldUpdateApks().catch(() => {});
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }

    // Inisialisasi service antrean sinkronisasi Google Sheets
    const cleanupSyncService = initSyncService();

    // Pastikan AudioContext di-resume pada interaksi pengguna pertama
    const handleFirstInteraction = () => {
      resumeAudioContext();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstInteraction, { passive: true });

    // Pengecekan otomatis pembaruan GitHub (interval 6 jam)
    const timer = setTimeout(() => {
      checkForUpdates({
        manual: false,
        onNavigateToBackup: () => handleSelectTab('settings'),
      }).catch(() => {});
    }, 2500);

    // Penanganan Tombol Back Fisik/Gesture Android (@capacitor/app)
    let backButtonListener: any = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', () => {
        // 1. Tutup SweetAlert2 jika sedang aktif
        if (Swal.isVisible()) {
          Swal.close();
          return;
        }

        // 2. Tutup QuickSale Modal jika terbuka
        if (showQuickSaleRef.current) {
          setShowGlobalQuickSale(false);
          return;
        }

        // 3. Tutup modal/drawer lain yang memiliki tombol close bertanda data-modal-close
        const openModalCloseBtn = document.querySelector('[data-modal-close="true"]') as HTMLElement | null;
        if (openModalCloseBtn) {
          openModalCloseBtn.click();
          return;
        }

        // 4. Jika berada di tab selain Dashboard, kembali ke Dashboard lebih dulu
        if (currentTabRef.current !== 'dashboard') {
          handleSelectTab('dashboard');
          return;
        }

        // 5. Jika sudah di Dashboard dan tidak ada modal, keluar dari aplikasi
        CapApp.exitApp();
      }).then((handle) => {
        backButtonListener = handle;
      });
    }

    return () => {
      clearTimeout(timer);
      cleanupSyncService();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [refreshGlobalState, handleSelectTab]);

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
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <Header
            currentStock={currentStock}
            currentTheme={settings?.theme || 'dark'}
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
