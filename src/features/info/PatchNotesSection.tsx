import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  History,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  ArrowRight,
  ExternalLink,
  Smartphone,
  Monitor,
  Globe,
} from 'lucide-react';
import {
  CURRENT_PATCH_NOTE,
  UPCOMING_ROADMAP,
  HISTORICAL_PATCH_NOTES,
  PatchNoteItem,
} from '../../domain/patchNotes';
import { getCurrentPlatform, getPlatformLabel } from '../../utils/platform';
import { playTapSound } from '../../utils/sound';

type ActiveTab = 'current' | 'upcoming' | 'history';

interface PatchNotesSectionProps {
  onCheckUpdate?: () => void;
  isCheckingUpdate?: boolean;
}

export const PatchNotesSection: React.FC<PatchNotesSectionProps> = ({
  onCheckUpdate,
  isCheckingUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('current');
  const [expandedHistoryIndex, setExpandedHistoryIndex] = useState<number | null>(null);

  const platform = getCurrentPlatform();
  const platformLabel = getPlatformLabel();

  const handleTabChange = (tab: ActiveTab) => {
    playTapSound();
    setActiveTab(tab);
  };

  const toggleHistoryItem = (index: number) => {
    playTapSound();
    setExpandedHistoryIndex(expandedHistoryIndex === index ? null : index);
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
      {/* Header Bagian */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold theme-text-primary tracking-tight">
              Catatan Pembaruan & Fitur Baru (Play Store Style)
            </h2>
            <p className="text-[11px] theme-text-secondary">
              Informasi detail rilis aplikasi, peta jalan fitur mendatang, dan riwayat pembaruan
            </p>
          </div>
        </div>

        {/* Platform Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl theme-bg-surface border theme-border self-start sm:self-auto text-[11px] font-mono text-zinc-400">
          {platform === 'android' ? (
            <Smartphone size={13} className="text-emerald-400" />
          ) : platform === 'desktop' ? (
            <Monitor size={13} className="text-cyan-400" />
          ) : (
            <Globe size={13} className="text-amber-400" />
          )}
          <span>{platformLabel}</span>
        </div>
      </div>

      {/* Navigasi Tab */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl theme-bg-surface border theme-border">
        <button
          type="button"
          onClick={() => handleTabChange('current')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'current'
              ? 'bg-emerald-500 text-zinc-950 shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Sparkles size={13} />
          <span>Versi Ini (v{CURRENT_PATCH_NOTE.version})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('upcoming')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'upcoming'
              ? 'bg-emerald-500 text-zinc-950 shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Clock size={13} />
          <span>Mendatang ({UPCOMING_ROADMAP.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('history')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-emerald-500 text-zinc-950 shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <History size={13} />
          <span>Riwayat Rilis</span>
        </button>
      </div>

      {/* Konten Tab 1: Versi Ini (Play Store Style) */}
      {activeTab === 'current' && (
        <div className="space-y-4 pt-1">
          {/* Hero Banner Versi */}
          <div className="p-4 rounded-xl theme-bg-surface border border-emerald-500/20 bg-emerald-500/5 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {CURRENT_PATCH_NOTE.badge}
                </span>
                <span className="text-[11px] theme-text-muted">
                  Dirilis: {CURRENT_PATCH_NOTE.releaseDate}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                v{CURRENT_PATCH_NOTE.version}
              </span>
            </div>

            <h3 className="text-sm font-bold theme-text-primary">
              {CURRENT_PATCH_NOTE.title}
            </h3>

            <p className="text-xs theme-text-secondary leading-relaxed">
              {CURRENT_PATCH_NOTE.summary}
            </p>
          </div>

          {/* Sorotan Utama (Play Store Highlights) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold theme-text-primary uppercase tracking-wider">
              <Sparkles size={14} className="text-emerald-500" />
              <span>Sorotan Utama Pembaruan:</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {CURRENT_PATCH_NOTE.highlights.map((highlight, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5"
                >
                  <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                    <CheckCircle2 size={13} />
                  </div>
                  <span className="text-xs theme-text-secondary leading-relaxed font-sans">
                    {highlight}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rincian Berdasarkan Kategori */}
          <div className="space-y-3 pt-1">
            {CURRENT_PATCH_NOTE.categories.map((cat, cIdx) => (
              <div
                key={cIdx}
                className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-2"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  {cIdx === 0 ? (
                    <Layers size={14} />
                  ) : cIdx === 1 ? (
                    <Monitor size={14} />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                  <span>{cat.categoryName}</span>
                </div>
                <ul className="space-y-1.5 pl-4 list-disc text-xs theme-text-secondary leading-relaxed font-sans">
                  {cat.items.map((item, iIdx) => (
                    <li key={iIdx}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Konten Tab 2: Pembaruan Mendatang (Upcoming Features / Roadmap) */}
      {activeTab === 'upcoming' && (
        <div className="space-y-3 pt-1">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs theme-text-primary space-y-1">
            <span className="font-bold text-cyan-400 block">Peta Jalan Pengembangan:</span>
            <p className="text-[11px] theme-text-secondary leading-relaxed">
              Berikut adalah daftar fitur yang direncanakan dan sedang dipersiapkan untuk rilis berikutnya demi kemudahan pencatatan bisnis Robux Anda.
            </p>
          </div>

          <div className="space-y-3">
            {UPCOMING_ROADMAP.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl theme-bg-surface border theme-border space-y-2.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        item.status === 'Dalam Pengerjaan'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Target: {item.targetVersion}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold theme-text-primary mb-1">
                    {item.title}
                  </h4>
                  <p className="text-xs theme-text-secondary leading-relaxed font-sans">
                    {item.description}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg theme-bg-card border theme-border space-y-1">
                  <span className="text-[10px] font-semibold text-emerald-400 block">
                    Manfaat Operasional:
                  </span>
                  <ul className="space-y-0.5 pl-3 list-disc text-[11px] theme-text-muted">
                    {item.benefits.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Konten Tab 3: Riwayat Rilis Sebelumnya */}
      {activeTab === 'history' && (
        <div className="space-y-2.5 pt-1">
          <p className="text-[11px] theme-text-secondary pb-1">
            Arsip rilis versi terdahulu yang mencatat evolusi stabilitas dan arsitektur JufaStore:
          </p>

          <div className="space-y-2">
            {HISTORICAL_PATCH_NOTES.map((historyItem, index) => {
              const isExpanded = expandedHistoryIndex === index;
              return (
                <div
                  key={historyItem.version}
                  className="rounded-xl theme-bg-surface border theme-border overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => toggleHistoryItem(index)}
                    className="w-full p-3 flex items-center justify-between text-left hover:theme-bg-card transition"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          v{historyItem.version}
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full theme-bg-card border theme-border text-zinc-400">
                          {historyItem.badge}
                        </span>
                        <span className="text-[10px] theme-text-muted font-sans">
                          {historyItem.releaseDate}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold theme-text-primary">
                        {historyItem.title}
                      </h4>
                    </div>

                    <div className="p-1 text-zinc-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-3.5 pt-1 border-t theme-border space-y-2.5 text-xs theme-text-secondary bg-zinc-500/5">
                      <p className="text-[11px] leading-relaxed">{historyItem.summary}</p>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                          Poin Perubahan:
                        </span>
                        <ul className="space-y-1 pl-4 list-disc text-[11px] font-sans">
                          {historyItem.highlights.map((h, hIdx) => (
                            <li key={hIdx}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
