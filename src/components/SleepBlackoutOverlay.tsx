import React from 'react';
import { SleepBlackoutState } from '../types/game';
import { Moon, Sun, AlertTriangle, Skull, Bed } from 'lucide-react';

interface SleepBlackoutOverlayProps {
  sleepBlackout: SleepBlackoutState | null;
  isConsciousnessSlipping?: boolean;
  consciousnessCountdown?: number | null;
}

export const SleepBlackoutOverlay: React.FC<SleepBlackoutOverlayProps> = ({
  sleepBlackout,
  isConsciousnessSlipping,
  consciousnessCountdown,
}) => {
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* 1. Drowsy Vignette & Consciousness Slipping Alert (When fatigue >= 95 and timer is ticking down) */}
      {isConsciousnessSlipping && !sleepBlackout?.active && (
        <div className="fixed inset-0 pointer-events-none z-40">
          {/* Pulsing drowsy vignette simulating heavy eyelids and tunnel vision */}
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(10,5,5,0.7) 75%, rgba(0,0,0,0.95) 100%)',
            }}
          />

          {/* Drowsy scanlines & subtle blur */}
          <div className="absolute inset-0 scanlines opacity-30" />

          {/* Critical Consciousness Warning Banner */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-950/90 border-2 border-red-500 rounded-lg shadow-2xl backdrop-blur-md animate-bounce text-red-200 font-mono">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-spin" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider text-red-100 uppercase">
                    CONSCIOUSNESS SLIPPING
                  </span>
                  <span className="px-2 py-0.5 bg-red-900 border border-red-500 rounded text-xs font-extrabold text-amber-300">
                    {consciousnessCountdown !== undefined && consciousnessCountdown !== null
                      ? formatTimer(Math.max(0, consciousnessCountdown))
                      : '05:00'}
                  </span>
                </div>
                <div className="text-[10px] text-red-300 flex items-center gap-1.5 mt-0.5">
                  <Bed className="w-3.5 h-3.5 text-cyan-300 inline" />
                  <span>Go to bed [F] immediately or you will collapse on the spot!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Fullscreen Sleep / Collapse Blackout Screen */}
      {sleepBlackout?.active && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black font-mono select-none transition-opacity duration-1000 ${
            sleepBlackout.phase === 'fading_out'
              ? 'opacity-100'
              : sleepBlackout.phase === 'blackout'
              ? 'opacity-100'
              : 'opacity-0'
          }`}
        >
          {/* Scanline overlay */}
          <div className="absolute inset-0 scanlines opacity-30 pointer-events-none" />

          <div className="relative z-10 max-w-lg px-8 py-10 text-center space-y-6">
            {sleepBlackout.isPassedOut ? (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-950/70 border-2 border-red-600 flex items-center justify-center animate-pulse">
                  <Skull className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-widest text-red-500">
                  {sleepBlackout.message || 'CONSCIOUSNESS SLIPPED AWAY'}
                </h2>
                <p className="text-xs text-neutral-300 leading-relaxed max-w-md mx-auto">
                  {sleepBlackout.subMessage ||
                    'Exhaustion overwhelmed your senses. You collapsed onto the ground in the dark.'}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2 text-xs text-amber-400 font-semibold">
                  <Sun className="w-4 h-4 animate-spin" />
                  <span>Awakening at next daybreak (Day {sleepBlackout.targetDay})...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-900 border-2 border-cyan-500/80 flex items-center justify-center shadow-lg shadow-cyan-950/50">
                  <Moon className="w-8 h-8 text-cyan-300 animate-pulse" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-widest text-cyan-200">
                  {sleepBlackout.message || 'RESTING IN SHELTER'}
                </h2>
                <p className="text-xs text-neutral-300 leading-relaxed max-w-md mx-auto">
                  {sleepBlackout.subMessage ||
                    'You fall into a deep, uninterrupted slumber behind safe walls. The night passes by...'}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2 text-xs text-cyan-400 font-semibold">
                  <Sun className="w-4 h-4 animate-spin" />
                  <span>Awakening at sunrise (Day {sleepBlackout.targetDay}, 07:00 AM)...</span>
                </div>
              </div>
            )}

            {/* Atmospheric breathing pulse indicator */}
            <div className="pt-4 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-600 animate-ping" />
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                {sleepBlackout.isPassedOut ? 'Regaining consciousness...' : 'Restoring stamina & clearing fatigue...'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
