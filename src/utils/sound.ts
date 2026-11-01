/**
 * JufaStore - Web Audio API Procedural Sound Engine
 * Synthesizes crisp, minimalist tactile feedback on the fly.
 * 100% offline, zero network requests, zero audio file dependencies.
 * Features master volume, compressor normalization, and native Android speaker boost.
 */

import { Capacitor } from '@capacitor/core';

const KEY_BUTTON_SOUND = 'jufastore_button_sound_enabled';
const KEY_TX_SOUND = 'jufastore_tx_sound_enabled';
const KEY_VOLUME = 'jufastore_sound_volume';

let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;

let inMemoryButtonSound = true;
let inMemoryTxSound = true;
let inMemoryVolume = 80; // 0 - 100%

export function isButtonSoundEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(KEY_BUTTON_SOUND);
      if (val !== null) return val === 'true';
    }
  } catch {}
  return inMemoryButtonSound;
}

export function setButtonSoundEnabled(enabled: boolean): void {
  inMemoryButtonSound = enabled;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY_BUTTON_SOUND, enabled ? 'true' : 'false');
    }
  } catch {}
}

export function isTxSoundEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(KEY_TX_SOUND);
      if (val !== null) return val === 'true';
    }
  } catch {}
  return inMemoryTxSound;
}

export function setTxSoundEnabled(enabled: boolean): void {
  inMemoryTxSound = enabled;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY_TX_SOUND, enabled ? 'true' : 'false');
    }
  } catch {}
}

export function getMasterVolume(): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(KEY_VOLUME);
      if (val !== null) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
      }
    }
  } catch {}
  return inMemoryVolume;
}

export function setMasterVolume(vol: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(vol)));
  inMemoryVolume = clamped;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY_VOLUME, clamped.toString());
    }
  } catch {}
  updateMasterGain();
}

/**
 * Backward compatibility functions
 */
export function isSoundEnabled(): boolean {
  return isButtonSoundEnabled() || isTxSoundEnabled();
}

export function setSoundEnabled(enabled: boolean): void {
  setButtonSoundEnabled(enabled);
  setTxSoundEnabled(enabled);
}

function updateMasterGain(): void {
  if (!masterGainNode || !audioCtx) return;
  const isNative = Capacitor.isNativePlatform();
  // Native Android phone speakers receive 1.45 baseline gain boost
  const baseline = isNative ? 1.45 : 1.0;
  const volFraction = getMasterVolume() / 100;
  const finalGain = baseline * volFraction;
  masterGainNode.gain.setValueAtTime(finalGain, audioCtx.currentTime);
}

function getAudioPipeline(): { ctx: AudioContext; destination: AudioNode } | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();

    // Create dynamics compressor to prevent clipping when boosted
    compressorNode = audioCtx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-18, audioCtx.currentTime);
    compressorNode.knee.setValueAtTime(12, audioCtx.currentTime);
    compressorNode.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressorNode.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressorNode.release.setValueAtTime(0.25, audioCtx.currentTime);

    // Create master gain node
    masterGainNode = audioCtx.createGain();
    updateMasterGain();

    // Connect: source -> compressor -> masterGain -> hardware destination
    compressorNode.connect(masterGainNode);
    masterGainNode.connect(audioCtx.destination);
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  updateMasterGain();

  return { ctx: audioCtx, destination: compressorNode || audioCtx.destination };
}

export function resumeAudioContext(): void {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

/**
 * Audible, tactile tap sound for menu navigation, buttons, and switches.
 */
export function playTapSound(): void {
  if (!isButtonSoundEnabled() || getMasterVolume() <= 0) return;
  try {
    const pipe = getAudioPipeline();
    if (!pipe) return;
    const { ctx, destination } = pipe;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.05);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.055);
  } catch {}
}

/**
 * Pleasant success chime for completing transactions, saves, or restocks.
 */
export function playSuccessSound(): void {
  if (!isTxSoundEnabled() || getMasterVolume() <= 0) return;
  try {
    const pipe = getAudioPipeline();
    if (!pipe) return;
    const { ctx, destination } = pipe;

    const now = ctx.currentTime;

    // Note 1: C5 (523.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.32, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(destination);
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
    gain2.connect(destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.24);
  } catch {}
}

/**
 * Low tone for deletes or cancellations.
 */
export function playDeleteSound(): void {
  if (!isTxSoundEnabled() || getMasterVolume() <= 0) return;
  try {
    const pipe = getAudioPipeline();
    if (!pipe) return;
    const { ctx, destination } = pipe;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.095);
  } catch {}
}

/**
 * Test sound that plays a short pleasant chime to preview current sound settings.
 */
export function testSound(): void {
  try {
    const pipe = getAudioPipeline();
    if (!pipe) return;
    const { ctx, destination } = pipe;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.19);
  } catch {}
}
