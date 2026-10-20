import React from 'react';
import { Survivor, Item } from '../types/game';
import {
  Utensils,
  Clock,
  Flame,
  AlertTriangle,
  X,
  Sparkles,
  Heart,
  CheckCircle2,
} from 'lucide-react';

interface HungerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  onEatFood: (item: Item) => void;
  isNearStove: boolean;
}

export const HungerMenu: React.FC<HungerMenuProps> = ({
  isOpen,
  onClose,
  survivor,
  onEatFood,
  isNearStove,
}) => {
  if (!isOpen) return null;

  // Filter food items in backpack
  const foodItems = survivor.inventory.filter(
    (item) => item.category === 'food' || (item.nutrition && item.nutrition > 0)
  );

  // Time remaining calculation: Full 100% empties in 30 minutes (1800s)
  // Each 1% = 18 seconds
  const secondsLeft = Math.round(survivor.hunger * 18);
  const minutesLeft = Math.floor(secondsLeft / 60);
  const remSeconds = secondsLeft % 60;

  // Hunger Moodle classification
  let hungerMoodle = 'Well Fed';
  let moodleColor = 'text-emerald-400';
  let moodleBg = 'bg-emerald-950/50 border-emerald-700/60';
  let moodleDesc = 'Caloric intake optimal. Peak physical endurance.';

  if (survivor.hunger <= 0) {
    hungerMoodle = 'Starved to Death';
    moodleColor = 'text-red-500 font-bold animate-pulse';
    moodleBg = 'bg-red-950/80 border-red-600';
    moodleDesc = 'Lethal starvation! Vital organ collapse.';
  } else if (survivor.hunger < 20) {
    hungerMoodle = 'Ravenous / Starving';
    moodleColor = 'text-red-400 font-bold';
    moodleBg = 'bg-red-950/50 border-red-700/60';
    moodleDesc = 'Critical caloric exhaustion. Starvation death imminent if not fed!';
  } else if (survivor.hunger < 50) {
    hungerMoodle = 'Peckish / Hungry';
    moodleColor = 'text-amber-400';
    moodleBg = 'bg-amber-950/50 border-amber-700/60';
    moodleDesc = 'Stomach rumbling. Consume rations to maintain stamina.';
  } else if (survivor.hunger < 80) {
    hungerMoodle = 'Satiated';
    moodleColor = 'text-cyan-400';
    moodleBg = 'bg-cyan-950/50 border-cyan-700/60';
    moodleDesc = 'Normal digestion. Stable baseline.';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none font-mono">
      <div className="relative w-full max-w-2xl bg-neutral-950 border border-amber-600/70 rounded shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 border-b border-neutral-800">
          <div className="flex items-center gap-2.5 text-amber-400">
            <Utensils className="w-5 h-5" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
                HUNGER & CALORIC RESERVES // NUTRITION MONITOR
              </h2>
              <p className="text-[10px] text-neutral-400">
                Subject Satiety Tracking · Full capacity empties in ~30 Minutes
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
          {/* Satiety Gauge & Starvation Countdown */}
          <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-16 h-16 rounded-full border-2 border-neutral-800 flex items-center justify-center bg-neutral-950 shrink-0">
                <span className={`text-base font-bold tabular-nums ${moodleColor}`}>
                  {Math.round(survivor.hunger)}%
                </span>
                <span className="absolute -bottom-1 text-[8px] uppercase tracking-widest text-neutral-500">
                  FOOD
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${moodleBg} ${moodleColor}`}>
                    {hungerMoodle}
                  </span>
                  {survivor.hunger <= 15 && (
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
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Time Until Starvation</span>
              </div>
              <div className="text-base font-bold text-amber-300 tabular-nums">
                {minutesLeft}m {remSeconds.toString().padStart(2, '0')}s
              </div>
              <div className="text-[9px] text-neutral-500">
                Drains at 3.33% / min (1800s full)
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Caloric Reserve Meter:</span>
              <span className="tabular-nums font-semibold text-neutral-200">
                {Math.round(survivor.hunger)} / 100 Satiety
              </span>
            </div>
            <div className="w-full bg-neutral-900 h-3 rounded-full overflow-hidden border border-neutral-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  survivor.hunger < 20
                    ? 'bg-red-600 animate-pulse'
                    : survivor.hunger < 50
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(0, survivor.hunger)}%` }}
              />
            </div>
          </div>

          {/* Cooking Source Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900/60 border border-neutral-800 rounded text-[11px]">
            <Flame className={`w-4 h-4 ${isNearStove ? 'text-orange-400 animate-pulse' : 'text-neutral-500'}`} />
            <span>
              {isNearStove ? (
                <strong className="text-orange-300">Kitchen Stove Nearby:</strong>
              ) : (
                <span className="text-neutral-400">Kitchen Station Inactive:</span>
              )}{' '}
              {isNearStove
                ? 'Campfire or Stove in range. Cook stews and heated meals at Workbench [C].'
                : 'Eating cold preserved rations directly from backpack.'}
            </span>
          </div>

          {/* Edible Food in Inventory */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1 text-xs">
              <span className="font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                Available Backpack Rations ({foodItems.length})
              </span>
              <span className="text-[10px] text-neutral-500">Click ration to consume</span>
            </div>

            {foodItems.length === 0 ? (
              <div className="p-6 bg-neutral-900/40 border border-neutral-800/80 rounded text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-amber-500/70 mx-auto" />
                <div className="text-neutral-300 font-semibold text-xs">NO FOOD RATIONS IN BACKPACK</div>
                <p className="text-[10px] text-neutral-500 max-w-md mx-auto">
                  Search suburban pantry cupboards, loot containers, or craft vegetable stews on a kitchen stove before hunger hits 0%.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {foodItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-600/70 rounded transition-all flex flex-col justify-between gap-2"
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
                        <span className="text-amber-400 font-bold">
                          +{item.nutrition || 20}% Satiety
                        </span>
                        {item.hydration && (
                          <span className="text-cyan-400">
                            +{item.hydration}% Water
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onEatFood(item)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded text-[10px] uppercase tracking-wider transition-colors shadow-sm"
                      >
                        Eat Ration
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
          <span>Press <strong>[U]</strong> or <strong>[ESC]</strong> to close</span>
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
