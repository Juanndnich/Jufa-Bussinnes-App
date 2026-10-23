import React, { useEffect, useState, useCallback } from 'react';
import { NavItem, Sidebar } from './components/Sidebar';
import { cleanupSwalLocks } from './utils/alert';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SalesView } from './components/SalesView';
import { CalculatorView } from './components/CalculatorView';
import { StockView } from './components/StockView';
import { RestockView } from './components/RestockView';
import { FinanceView } from './components/FinanceView';
import { InvestorView } from './components/InvestorView';
import { AnalysisView } from './components/AnalysisView';
import { PriceSimulatorView } from './components/PriceSimulatorView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { AboutView } from './components/AboutView';
import { HalloweenSplashScreen } from './components/HalloweenSplashScreen';
import { AppSettings, Cashflow, Investor, StockBatch, StockMovement, Transaction } from './types';
import {
  getAllBatches,
  getAllCashflows,
  getAllInvestors,
  getAllStockMovements,
  getAllTransactions,
  getSettings,
  saveSettings,
} from './services/repository';
import { clearIndexedDB, getDatabase } from './services/db';
import { applyTheme } from './utils/theme';
import {
  Coins,
  Loader2,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wallet,
  Menu,
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  // Global Business State
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);

  // Refresh all state from SQLite
  const refreshAllData = useCallback(async () => {
    try {
      const [s, b, t, c, m, inv] = await Promise.all([
        getSettings(),
        getAllBatches(),
        getAllTransactions(),
        getAllCashflows(),
        getAllStockMovements(),
        getAllInvestors(),
      ]);
      setSettings(s);
      setBatches(b);
      setTransactions(t);
      setCashflows(c);
      setStockMovements(m);
      setInvestors(inv);

      // Apply User's Active Theme
      applyTheme(s.theme_mode);
    } catch (err: any) {
      console.error('Error loading data from SQLite:', err);
      setDbError(err.message || 'Gagal memuat database');
    }
  }, []);

  // Initialize DB on App Start
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await getDatabase(); // Ensure WASM & tables ready
        if (mounted) {
          await refreshAllData();
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setDbError(err.message || 'Gagal inisialisasi SQLite database.');
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshAllData]);

  // Compute live stock totals
  const totalRobuxStock = batches.reduce((sum, b) => sum + (b.remaining_quantity || 0), 0);
  const stockAssetValue = batches.reduce(
    (sum, b) => sum + (b.remaining_quantity || 0) * (b.cost_per_unit || 0),
    0
  );

  if (showSplash) {
    return (
      <HalloweenSplashScreen
        durationSeconds={50}
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen theme-bg-main theme-text-primary flex flex-col items-center justify-center gap-4 p-4">
        <div className="w-14 h-14 rounded-2xl theme-bg-card border theme-border flex items-center justify-center theme-text-primary animate-pulse">
          <Coins size={32} />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-heading font-bold">JufaStore</h2>
          <p className="text-xs theme-text-secondary flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span>Memuat Database SQLite Persisten...</span>
          </p>
        </div>
      </div>
    );
  }

  if (dbError || !settings) {
    return (
      <div className="min-h-screen theme-bg-main theme-text-primary flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
          <h2 className="text-base font-bold text-rose-400">Gagal Membuka Database</h2>
          <p className="text-xs text-neutral-300">{dbError}</p>
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs"
            >
              Muat Ulang Aplikasi
            </button>
            <button
              onClick={async () => {
                try {
                  await clearIndexedDB();
                  window.location.reload();
                } catch {
                  window.location.reload();
                }
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
            >
              Reset Database & Muat Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectTab = (tab: NavItem) => {
    cleanupSwalLocks();
    setCurrentTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen theme-bg-main theme-text-primary overflow-hidden relative">
      {/* Sidebar Navigation (Desktop persistent, Mobile drawer slide-in) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        totalRobuxStock={totalRobuxStock}
        stockAssetValue={stockAssetValue}
        minStockAlert={settings.min_stock_alert ?? settings.minStockAlert ?? 500}
        storeName={settings.store_name}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          storeName={settings.store_name}
          transactions={transactions}
          cashflows={cashflows}
          onQuickSale={() => handleSelectTab('sales')}
          onQuickRestock={() => handleSelectTab('restock')}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 pb-24 lg:pb-10">
          <div key={currentTab} className="max-w-7xl mx-auto animate-tab-content">
            {currentTab === 'dashboard' && (
              <DashboardView
                transactions={transactions}
                batches={batches}
                cashflows={cashflows}
                settings={settings}
                onNavigate={handleSelectTab}
              />
            )}

            {currentTab === 'sales' && (
              <SalesView
                transactions={transactions}
                batches={batches}
                settings={settings}
                onRefreshData={refreshAllData}
              />
            )}

            {currentTab === 'calculator' && <CalculatorView />}

            {currentTab === 'stock' && (
              <StockView
                batches={batches}
                stockMovements={stockMovements}
                onRefreshData={refreshAllData}
                onNavigateToRestock={() => setCurrentTab('restock')}
              />
            )}

            {currentTab === 'restock' && (
              <RestockView
                batches={batches}
                settings={settings}
                onRefreshData={refreshAllData}
              />
            )}

            {currentTab === 'finance' && (
              <FinanceView
                cashflows={cashflows}
                transactions={transactions}
                batches={batches}
                settings={settings}
                onRefreshData={refreshAllData}
              />
            )}

            {currentTab === 'investors' && (
              <InvestorView
                investors={investors}
                transactions={transactions}
                onRefreshData={refreshAllData}
              />
            )}

            {currentTab === 'analysis' && (
              <AnalysisView transactions={transactions} settings={settings} />
            )}

            {currentTab === 'simulator' && (
              <PriceSimulatorView
                batches={batches}
                settings={settings}
                onUpdateSettings={async (newSet) => {
                  await saveSettings(newSet);
                  await refreshAllData();
                }}
              />
            )}

            {currentTab === 'reports' && (
              <ReportsView
                transactions={transactions}
                batches={batches}
                cashflows={cashflows}
                settings={settings}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsView
                settings={settings}
                transactions={transactions}
                batches={batches}
                cashflows={cashflows}
                onRefreshData={refreshAllData}
              />
            )}

            {currentTab === 'about' && (
              <AboutView />
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (Android/iOS standard) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 theme-bg-surface/95 backdrop-blur-md border-t theme-border px-2 py-1.5 flex items-center justify-around">
          <button
            onClick={() => handleSelectTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              currentTab === 'dashboard' ? 'theme-text-primary font-bold' : 'theme-text-muted hover:theme-text-secondary'
            }`}
          >
            <LayoutDashboard size={18} />
            <span className="text-[10px] mt-0.5">Dasbor</span>
          </button>

          <button
            onClick={() => handleSelectTab('sales')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              currentTab === 'sales' ? 'theme-text-primary font-bold' : 'theme-text-muted hover:theme-text-secondary'
            }`}
          >
            <ShoppingCart size={18} />
            <span className="text-[10px] mt-0.5">Penjualan</span>
          </button>

          <button
            onClick={() => handleSelectTab('stock')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              currentTab === 'stock' ? 'theme-text-primary font-bold' : 'theme-text-muted hover:theme-text-secondary'
            }`}
          >
            <Package size={18} />
            <span className="text-[10px] mt-0.5">Stok</span>
          </button>

          <button
            onClick={() => handleSelectTab('finance')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
              currentTab === 'finance' ? 'theme-text-primary font-bold' : 'theme-text-muted hover:theme-text-secondary'
            }`}
          >
            <Wallet size={18} />
            <span className="text-[10px] mt-0.5">Keuangan</span>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl theme-text-muted hover:theme-text-primary transition"
          >
            <Menu size={18} />
            <span className="text-[10px] mt-0.5">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;
