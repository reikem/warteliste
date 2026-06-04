/**
 * QueueMaster Pro — useMonitorSound
 * Hook de notificaciones sonoras para monitor.tsx
 * Modos: beep | chime | voice | silent
 *
 * Uso:
 *   const { soundType, setSoundType, playCallSound } = useMonitorSound();
 *   // En el listener de TICKET_CALLED:
 *   playCallSound(payload.ticketNumber, payload.desk);
 *
 * Ubicación: hooks/useMonitorSound.ts
 */

import { useState, useCallback, useRef } from 'react';

export type SoundType = 'beep' | 'chime' | 'voice' | 'silent';

export interface MonitorSoundHook {
  soundType: SoundType;
  setSoundType: (type: SoundType) => void;
  playCallSound: (ticketNumber: string, desk: string) => void;
  isPlaying: boolean;
}

export function useMonitorSound(initial: SoundType = 'beep'): MonitorSoundHook {
  const [soundType, setSoundTypeState] = useState<SoundType>(initial);
  const [isPlaying, setIsPlaying]      = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Obtener / crear AudioContext ──────────────────────────────────────────
  const getCtx = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          (window as any).AudioContext || (window as any).webkitAudioContext
        )();
      }
      // Desbloquear contexto si está suspendido (política autoplay)
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  // ── Beep simple ───────────────────────────────────────────────────────────
  const playBeep = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }, [getCtx]);

  // ── Campanilla (3 tonos ascendentes) ─────────────────────────────────────
  const playChime = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const freqs = [523, 659, 784]; // Do-Mi-Sol
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }, [getCtx]);

  // ── Voz sintética (Web Speech API) ───────────────────────────────────────
  const playVoice = useCallback((ticketNumber: string, desk: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      playBeep();
      return;
    }
    // Cancelar cualquier anuncio previo
    window.speechSynthesis.cancel();

    const text = `Turno ${ticketNumber.split('').join(' ')}. Pase a ${desk}.`;
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang  = 'es-MX';
    utt.rate  = 0.88;
    utt.pitch = 1.05;
    utt.volume = 1;

    utt.onstart = () => setIsPlaying(true);
    utt.onend   = () => setIsPlaying(false);
    utt.onerror = () => { setIsPlaying(false); playBeep(); };

    window.speechSynthesis.speak(utt);
  }, [playBeep]);

  // ── Función principal ─────────────────────────────────────────────────────
  const playCallSound = useCallback((ticketNumber: string, desk: string) => {
    if (soundType === 'silent') return;

    setIsPlaying(true);

    if (soundType === 'voice') {
      playVoice(ticketNumber, desk);
      // isPlaying se apaga en el callback onend
      return;
    }

    if (soundType === 'chime') {
      playChime();
    } else {
      playBeep();
    }

    setTimeout(() => setIsPlaying(false), 600);
  }, [soundType, playBeep, playChime, playVoice]);

  const setSoundType = useCallback((type: SoundType) => {
    setSoundTypeState(type);
  }, []);

  return { soundType, setSoundType, playCallSound, isPlaying };
}