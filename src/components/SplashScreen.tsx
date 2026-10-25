import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, ShieldCheck, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  logoUrl?: string | null;
  storeName?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  logoUrl,
  storeName = 'JufaStore',
}) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Menghubungkan database lokal...');

  useEffect(() => {
    const startTime = Date.now();
    const duration = 1800; // 1.8 detik: waktu yang pas untuk menikmati animasi tanpa bikin jenuh

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(currentProgress);

      if (currentProgress < 30) {
        setStatusText('Menghubungkan database lokal...');
      } else if (currentProgress < 65) {
        setStatusText('Memverifikasi persediaan stok FIFO...');
      } else if (currentProgress < 90) {
        setStatusText('Menyiapkan dashboard pembukuan...');
      } else {
        setStatusText('JufaStore Siap!');
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        setTimeout(() => {
          onComplete();
        }, 200);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      key="splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(8px)' }}
      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b] text-white select-none px-6"
    >
      {/* Background Subtle Ambient Glow */}
      <div className="absolute w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none -top-10 -right-10" />
      <div className="absolute w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none -bottom-10 -left-10" />

      {/* Main Logo Card with Breathing Animation */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
        className="relative mb-6"
      >
        <div className="relative w-24 h-24 rounded-3xl p-1 bg-gradient-to-b from-white/20 to-white/5 border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
          <img
            src={logoUrl || '/app-icon.png'}
            alt={storeName}
            className="w-full h-full object-cover rounded-2xl bg-black"
          />
        </div>

        {/* Outer glowing pulsing ring */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -inset-2 rounded-3xl border border-emerald-500/30 pointer-events-none"
        />
      </motion.div>

      {/* App Branding */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-center space-y-1 mb-8"
      >
        <h1 className="text-2xl font-bold tracking-tight text-white font-heading">
          {storeName}
        </h1>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
          <ShieldCheck size={11} className="text-emerald-400" />
          <span>Internal Robux Bookkeeper</span>
        </div>
      </motion.div>

      {/* Animated Loading Bar & Status */}
      <motion.div
        initial={{ opacity: 0, width: '120px' }}
        animate={{ opacity: 1, width: '180px' }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="space-y-2 text-center"
      >
        <div className="w-full h-1.5 bg-zinc-800/90 rounded-full overflow-hidden border border-white/5 shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut' }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-0.5">
          <span className="truncate pr-2">{statusText}</span>
          <span className="font-bold text-emerald-400">{progress}%</span>
        </div>
      </motion.div>
    </motion.div>
  );
};
