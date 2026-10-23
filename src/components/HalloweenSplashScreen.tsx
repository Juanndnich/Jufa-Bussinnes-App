import React, { useEffect, useState } from 'react';
import { Sparkles, Ghost, Flame } from 'lucide-react';

interface HalloweenSplashScreenProps {
  onFinish: () => void;
  durationSeconds?: number;
}

export const HalloweenSplashScreen: React.FC<HalloweenSplashScreenProps> = ({
  onFinish,
  durationSeconds = 3.5,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const currentElapsed = (now - startTime) / 1000;
      if (currentElapsed >= durationSeconds) {
        setElapsed(durationSeconds);
        clearInterval(interval);
        setTimeout(onFinish, 250);
      } else {
        setElapsed(currentElapsed);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [durationSeconds, onFinish]);

  const progressPercent = Math.min(100, Math.round((elapsed / durationSeconds) * 100));

  // Dynamic spooky update messages (similar to an authentic game/app updater)
  let statusMessage = 'Memuat Pembaruan JufaStore Halloween...';
  let subMessage = 'Menyiapkan aset dan konfigurasi tema';

  if (progressPercent >= 25 && progressPercent < 60) {
    statusMessage = 'Menyiapkan Data Robux & Brankas Keuangan...';
    subMessage = 'Memverifikasi stok batch dan transaksi';
  } else if (progressPercent >= 60 && progressPercent < 88) {
    statusMessage = 'Sinkronisasi Database SQLite Lokal...';
    subMessage = 'Memuat laporan laba rugi dan modal';
  } else if (progressPercent >= 88) {
    statusMessage = 'Pembaruan Selesai! Membuka Aplikasi...';
    subMessage = 'Selamat datang di JufaStore';
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#09040e] flex flex-col items-center justify-between p-6 select-none overflow-hidden text-neutral-100 font-sans">
      {/* Background Ambient Glowing Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Bats in the Background */}
      <div className="absolute top-12 left-10 opacity-70 animate-float-bat pointer-events-none">
        <svg width="40" height="24" viewBox="0 0 100 60" fill="#c084fc">
          <path d="M0,30 Q25,0 45,25 Q50,0 55,25 Q75,0 100,30 Q80,45 50,38 Q20,45 0,30 Z" />
        </svg>
      </div>
      <div
        className="absolute top-20 right-10 opacity-60 animate-float-bat pointer-events-none"
        style={{ animationDelay: '1.2s' }}
      >
        <svg width="32" height="20" viewBox="0 0 100 60" fill="#f97316">
          <path d="M0,30 Q25,0 45,25 Q50,0 55,25 Q75,0 100,30 Q80,45 50,38 Q20,45 0,30 Z" />
        </svg>
      </div>
      <div
        className="absolute bottom-28 left-8 opacity-40 animate-float-bat pointer-events-none"
        style={{ animationDelay: '2s' }}
      >
        <svg width="28" height="18" viewBox="0 0 100 60" fill="#c084fc">
          <path d="M0,30 Q25,0 45,25 Q50,0 55,25 Q75,0 100,30 Q80,45 50,38 Q20,45 0,30 Z" />
        </svg>
      </div>

      {/* Top Header Badge */}
      <header className="w-full max-w-md flex items-center justify-center z-10 pt-4">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-950/40 border border-orange-500/30 text-orange-300 text-xs font-semibold backdrop-blur-sm shadow-md">
          <Flame size={14} className="text-orange-400 animate-pulse" />
          <span>Edisi Spesial Halloween</span>
        </div>
      </header>

      {/* Center Cinematic Stage */}
      <main className="flex flex-col items-center justify-center my-auto text-center z-10 space-y-5 max-w-sm">
        {/* Pumpkin + Robux Hero Avatar */}
        <div className="relative">
          {/* Pulsing Aura Rings */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-orange-500/20 via-purple-600/30 to-amber-500/20 blur-xl animate-pulse" />

          <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-3xl bg-[#140a20] border-2 border-orange-500/40 p-2.5 shadow-2xl flex items-center justify-center overflow-hidden animate-pumpkin-glow">
            <img
              src="/app-icon-halloween.jpg"
              alt="JufaStore Halloween"
              className="w-full h-full object-cover rounded-2xl"
              onError={e => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Floating Spooky Ghost Badge */}
          <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-orange-500 text-black flex items-center justify-center shadow-lg animate-bounce">
            <Ghost size={18} />
          </div>
        </div>

        {/* Title & Brand */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-950/60 border border-purple-500/30 text-[10px] font-mono font-bold tracking-wider text-purple-300">
            <Sparkles size={11} className="text-amber-400" />
            <span>ROBUX STORE MANAGER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-200 to-purple-300 tracking-tight">
            JufaStore
          </h1>
          <p className="text-xs text-orange-200/90 font-medium px-4 min-h-[24px] flex items-center justify-center">
            {statusMessage}
          </p>
          <p className="text-[11px] text-neutral-400">
            {subMessage}
          </p>
        </div>
      </main>

      {/* Bottom Fast Progress Bar (Clean App Updater style, no skip button) */}
      <footer className="w-full max-w-md z-10 pb-4">
        <div className="p-4 rounded-2xl bg-[#140b22]/90 border border-orange-500/30 backdrop-blur-md shadow-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-ping" />
              <span>Memperbarui Aplikasi...</span>
            </span>
            <span className="font-bold text-orange-400">{progressPercent}%</span>
          </div>

          {/* Glowing Animated Progress Track */}
          <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-purple-500 shadow-lg shadow-orange-500/50 transition-all duration-150 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
};
