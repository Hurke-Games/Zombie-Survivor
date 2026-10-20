import React from 'react';
import { Survivor, Item } from '../types/game';
import {
  Droplets,
  Clock,
  AlertTriangle,
  X,
  Waves,
  Shield,
  CheckCircle2,
} from 'lucide-react';

interface ThirstMenuProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  onDrinkWater: (item: Item) => void;
  waterGridActive: boolean;
  day: number;
}

export const ThirstMenu: React.FC<ThirstMenuProps> = ({
  isOpen,
  onClose,
  survivor,
  onDrinkWater,
  waterGridActive,
  day,
}) => {
  if (!isOpen) return null;

  // Filter drink items in backpack
  const drinkItems = survivor.inventory.filter(
    (item) => item.category === 'drink' || (item.hydration && item.hydration > 0)
  );

  // Time remaining calculation: Full 100% empties in 10 minutes (600s)
  // Each 1% = 6 seconds
  const secondsLeft = Math.round(survivor.thirst * 6);
  const minutesLeft = Math.floor(secondsLeft / 60);
  const remSeconds = secondsLeft % 60;

  // Thirst Moodle classification
  let thirstMoodle = 'Hydrated';
  let moodleColor = 'text-cyan-400';
  let moodleBg = 'bg-cyan-950/50 border-cyan-700/60';
  let moodleDesc = 'Fluid levels optimal. Blood volume and stamina stable.';

  if (survivor.thirst <= 0) {
    thirstMoodle = 'Fatal Dehydration';
    moodleColor = 'text-red-500 font-bold animate-pulse';
    moodleBg = 'bg-red-950/80 border-red-600';
    moodleDesc = 'Lethal dehydration! Cellular fluid collapse.';
  } else if (survivor.thirst < 20) {
    thirstMoodle = 'Severely Parched / Critical';
    moodleColor = 'text-red-400 font-bold';
    moodleBg = 'bg-red-950/50 border-red-700/60';
    moodleDesc = 'Critical fluid depletion. Severe headache and organ stress!';
  } else if (survivor.thirst < 50) {
    thirstMoodle = 'Thirsty';
    moodleColor = 'text-amber-400';
    moodleBg = 'bg-amber-950/50 border-amber-700/60';
    moodleDesc = 'Dry throat. Hydrate with potable water to maintain endurance.';
  } else if (survivor.thirst < 80) {
    thirstMoodle = 'Quenched';
    moodleColor = 'text-sky-400';
    moodleBg = 'bg-sky-950/50 border-sky-700/60';
    moodleDesc = 'Sufficient fluid reserves.';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none font-mono">
      <div className="relative w-full max-w-2xl bg-neutral-950 border border-cyan-600/70 rounded shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 border-b border-neutral-800">
          <div className="flex items-center gap-2.5 text-cyan-400">
            <Droplets className="w-5 h-5" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
                THIRST & FLUID RESERVES // HYDRATION MONITOR
              </h2>
              <p className="text-[10px] text-neutral-400">
                Subject Hydration Tracking · Full capacity empties in ~10 Minutes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-neutral-300">
          {/* Hydration Gauge & Dehydration Countdown */}
          <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-16 h-16 rounded-full border-2 border-neutral-800 flex items-center justify-center bg-neutral-950 shrink-0">
                <span className={`text-base font-bold tabular-nums ${moodleColor}`}>
                  {Math.round(survivor.thirst)}%
                </span>
                <span className="absolute -bottom-1 text-[8px] uppercase tracking-widest text-neutral-500">
                  WATER
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${moodleBg} ${moodleColor}`}>
                    {thirstMoodle}
                  </span>
                  {survivor.thirst <= 15 && (
                    <span className="flex items-center gap-1 text-[10px] text-red-400 animate-pulse font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> FATAL RISK
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 leading-tight">
                  {moodleDesc}
                </p>
              </div>
            </div>

            {/* Countdown Clock */}
            <div className="flex flex-col items-end shrink-0 bg-neutral-950 px-3.5 py-2 rounded border border-neutral-800/80 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Time Until Dehydration</span>
              </div>
              <div className="text-base font-bold text-cyan-300 tabular-nums">
                {minutesLeft}m {remSeconds.toString().padStart(2, '0')}s
              </div>
              <div className="text-[9px] text-neutral-500">
                Drains at 10.0% / min (600s full)
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Fluid Volume Meter:</span>
              <span className="tabular-nums font-semibold text-neutral-200">
                {Math.round(survivor.thirst)} / 100 Hydration
              </span>
            </div>
            <div className="w-full bg-neutral-900 h-3 rounded-full overflow-hidden border border-neutral-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  survivor.thirst < 20
                    ? 'bg-red-600 animate-pulse'
                    : survivor.thirst < 50
                    ? 'bg-amber-500'
                    : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.max(0, survivor.thirst)}%` }}
              />
            </div>
          </div>

          {/* Municipal Water Grid Telemetry */}
          <div className="flex items-center gap-2.5 px-3 py-2 bg-neutral-900/60 border border-neutral-800 rounded text-[11px]">
            <Waves className={`w-4 h-4 ${waterGridActive ? 'text-cyan-400' : 'text-neutral-500'}`} />
            <div>
              <span className="font-semibold text-neutral-200">
                Municipal Water Pressure Grid:{' '}
                <span className={waterGridActive ? 'text-emerald-400' : 'text-red-400 font-bold'}>
                  {waterGridActive ? 'Operational (Pressurized)' : 'TERMINATED (Pipes Dry)'}
                </span>
              </span>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                {waterGridActive
                  ? `Municipal water continues pumping until Day 18 (Current: Day ${day}). Tap collection remains viable.`
                  : 'Municipal pumps have permanently seized. Rainwater collectors or boiled river water required.'}
              </p>
            </div>
          </div>

          {/* Potable Drinks in Inventory */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1 text-xs">
              <span className="font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                Available Backpack Beverages ({drinkItems.length})
              </span>
              <span className="text-[10px] text-neutral-500">Click beverage to drink</span>
            </div>

            {drinkItems.length === 0 ? (
              <div className="p-6 bg-neutral-900/40 border border-neutral-800/80 rounded text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-cyan-500/70 mx-auto" />
                <div className="text-neutral-300 font-semibold text-xs">NO POTABLE WATER IN BACKPACK</div>
                <p className="text-[10px] text-neutral-500 max-w-md mx-auto">
                  Scavenge water bottles from residential kitchens, search rain barrels, or boil tap water on a kitchen stove before dehydration drops to 0%.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {drinkItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-cyan-600/70 rounded transition-all flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-neutral-100 text-xs">{item.name}</span>
                        {item.count && item.count > 1 && (
                          <span className="px-1.5 py-0.2 bg-neutral-800 text-[10px] rounded text-neutral-300">
                            x{item.count}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-cyan-400 font-bold">
                          +{item.hydration || 40}% Hydration
                        </span>
                        {item.nutrition && (
                          <span className="text-amber-400">
                            +{item.nutrition}% Food
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onDrinkWater(item)}
                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-bold rounded text-[10px] uppercase tracking-wider transition-colors shadow-sm"
                      >
                        Drink Water
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Press <strong>[Y]</strong> or <strong>[ESC]</strong> to close</span>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
