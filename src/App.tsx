import React, { useEffect, useState, useCallback } from 'react';
import { NavItem, Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SalesView } from './components/SalesView';
import { CalculatorView } from './components/CalculatorView';
import { StockView } from './components/StockView';
import { RestockView } from './components/RestockView';
import { FinanceView } from './components/FinanceView';
import { AnalysisView } from './components/AnalysisView';
import { PriceSimulatorView } from './components/PriceSimulatorView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { AppSettings, Cashflow, StockBatch, StockMovement, Transaction } from './types';
import {
  getAllBatches,
  getAllCashflows,
  getAllStockMovements,
  getAllTransactions,
  getSettings,
} from './services/repository';
import { clearIndexedDB, getDatabase } from './services/db';
import { Coins, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Global Business State
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  // Refresh all state from SQLite
  const refreshAllData = useCallback(async () => {
    try {
      const [s, b, t, c, m] = await Promise.all([
        getSettings(),
        getAllBatches(),
        getAllTransactions(),
        getAllCashflows(),
        getAllStockMovements(),
      ]);
      setSettings(s);
      setBatches(b);
      setTransactions(t);
      setCashflows(c);
      setStockMovements(m);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c15] text-white flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-pulse">
          <Coins size={32} />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold">JUFA STORE Business Manager</h2>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin text-cyan-400" />
            <span>Memuat Database SQLite Persisten & Menghubungkan IndexedDB...</span>
          </p>
        </div>
      </div>
    );
  }

  if (dbError || !settings) {
    return (
      <div className="min-h-screen bg-[#080c15] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
          <h2 className="text-base font-bold text-rose-400">Gagal Membuka Database</h2>
          <p className="text-xs text-slate-300">{dbError}</p>
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
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

  return (
    <div className="flex h-screen bg-[#080c15] text-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        totalRobuxStock={totalRobuxStock}
        stockAssetValue={stockAssetValue}
        minStockAlert={settings.min_stock_alert ?? settings.minStockAlert ?? 500}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          storeName={settings.store_name}
          onQuickSale={() => setCurrentTab('sales')}
          onQuickRestock={() => setCurrentTab('restock')}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto pb-10">
            {currentTab === 'dashboard' && (
              <DashboardView
                transactions={transactions}
                batches={batches}
                cashflows={cashflows}
                settings={settings}
                onNavigate={setCurrentTab}
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

            {currentTab === 'analysis' && (
              <AnalysisView transactions={transactions} settings={settings} />
            )}

            {currentTab === 'simulator' && <PriceSimulatorView batches={batches} />}

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
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
