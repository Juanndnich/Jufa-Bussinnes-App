import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, ShoppingBag, Clock } from 'lucide-react';

interface HeaderProps {
  onQuickSale: () => void;
  onQuickRestock: () => void;
  storeName: string;
}

export const Header: React.FC<HeaderProps> = ({ onQuickSale, onQuickRestock, storeName }) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      setCurrentTime(formatted + ' WIB');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 px-6 bg-[#09090b] border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-base font-heading font-bold text-white tracking-tight flex items-center gap-2">
            {storeName}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15 font-mono">
              FINANCIAL SUITE
            </span>
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400 bg-[#111114] px-3 py-1.5 rounded-xl border border-white/10">
          <Clock size={13} className="text-zinc-400" />
          <span className="font-mono text-[11px]">{currentTime || 'Memuat...'}</span>
        </div>

        {/* Database Status */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-zinc-200 text-xs font-semibold">
          <ShieldCheck size={14} className="text-white" />
          <span>SQLite Lokal</span>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onQuickRestock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111114] hover:bg-[#18181b] text-zinc-200 text-xs font-medium border border-white/15 transition"
          >
            <Plus size={13} />
            <span>Restock</span>
          </button>
          <button
            onClick={onQuickSale}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition shadow-sm"
          >
            <ShoppingBag size={13} />
            <span>+ Catat Penjualan</span>
          </button>
        </div>
      </div>
    </header>
  );
};
