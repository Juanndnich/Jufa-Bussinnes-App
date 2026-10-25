/**
 * JufaStore - Web Audio API Procedural Sound Engine
 * Synthesizes crisp, minimalist tactile feedback on the fly.
 * 100% offline, zero network requests, zero audio file dependencies.
 */

let audioCtx: AudioContext | null = null;
let inMemorySoundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('jufastore_sound_enabled') !== 'false';
    }
  } catch {}
  return inMemorySoundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  inMemorySoundEnabled = enabled;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jufastore_sound_enabled', enabled ? 'true' : 'false');
    }
  } catch {}
}

/**
 * Audible, tactile tap sound for menu navigation, buttons, and switches.
 * Enhanced volume and frequency spectrum for clear mobile speaker output.
 */
export function playTapSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Frequency sweeps down quickly for a crisp, punchy pop
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.05);

    // Loud, clear volume on mobile device speakers
    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.055);
  } catch {
    // Ignore audio autoplay restrictions gracefully
  }
}

/**
 * Pleasant success chime for completing transactions, saves, or restocks.
 */
export function playSuccessSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Note 1: C5 (523.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.32, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Note 2: E5 (659.25Hz) shortly after
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(659.25, now + 0.06);
    gain2.gain.setValueAtTime(0.36, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.24);
  } catch {
    // Ignore audio autoplay restrictions gracefully
  }
}

/**
 * Low tone for deletes or cancellations.
 */
export function playDeleteSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.095);
  } catch {
    // Ignore audio autoplay restrictions gracefully
  }
}
