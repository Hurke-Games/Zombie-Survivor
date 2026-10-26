import React from 'react';
import { Survivor, Item, ActiveHandSlot } from '../types/game';
import {
  Flashlight,
  Sword,
  Crosshair,
  Hammer,
  Utensils,
  Droplets,
} from 'lucide-react';
import { KeyBindings, DEFAULT_KEYBINDINGS } from '../utils/keybindings';

interface SurvivorHUDProps {
  survivor: Survivor;
  keyBindings?: KeyBindings;
  onSelectActiveSlot: (slot: ActiveHandSlot) => void;
  onToggleFlashlight: () => void;
  lowestFood: Item | null;
  lowestDrink: Item | null;
  onQuickEat: () => void;
  onQuickDrink: () => void;
  onHoverQuickType: (type: 'food' | 'water' | null) => void;
}

export const SurvivorHUD: React.FC<SurvivorHUDProps> = ({
  survivor,
  keyBindings = DEFAULT_KEYBINDINGS,
  onSelectActiveSlot,
  onToggleFlashlight,
  lowestFood,
  lowestDrink,
  onQuickEat,
  onQuickDrink,
  onHoverQuickType,
}) => {
  return (
    <footer className="w-full bg-neutral-950/95 border-t border-neutral-800 text-neutral-300 px-3 py-2 z-20 backdrop-blur-md font-mono select-none shrink-0">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Weapon 1 / Weapon 2 / Tool Hand Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider hidden sm:inline mr-1">
            Hands:
          </span>

          {/* Weapon 1 (Primary) */}
          <button
            type="button"
            onClick={() => onSelectActiveSlot('weapon1')}
            title="Weapon 1: Primary (Click or Scroll Wheel to hold)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border cursor-pointer transition-all ${
              survivor.activeSlot === 'weapon1'
                ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-sm ring-1 ring-amber-500/50'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            <Sword className="w-3.5 h-3.5 text-amber-400" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-amber-400/90 leading-tight">W1: Primary</span>
              <span className="text-xs font-medium text-neutral-200 truncate max-w-[85px]">
                {survivor.equippedWeapon?.name || 'Fists'}
              </span>
            </div>
          </button>

          {/* Weapon 2 (Backup) */}
          <button
            type="button"
            onClick={() => onSelectActiveSlot('weapon2')}
            title="Weapon 2: Backup (Click or Scroll Wheel to hold)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border cursor-pointer transition-all ${
              survivor.activeSlot === 'weapon2'
                ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-sm ring-1 ring-rose-500/50'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-rose-400/90 leading-tight">W2: Backup</span>
              <span className="text-xs font-medium text-neutral-200 truncate max-w-[85px]">
                {survivor.equippedWeapon2?.name || 'Empty'}
              </span>
            </div>
          </button>

          {/* Tools Auto-Ready Status (Crafted tools work automatically upon interaction) */}
          <div
            title="All crafted tools work immediately when interacting with world nodes without manual slot selection"
            className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 select-none"
          >
            <Hammer className="w-3 h-3 text-sky-400/80" />
            <span className="font-semibold text-neutral-400">Tools: Auto-Ready</span>
          </div>
        </div>

        {/* Center: Quick Eat & Quick Drink (Auto consumes lowest restoring item; hover previews on bars) */}
        <div className="flex items-center gap-2.5">
          {/* Quick Eat Button */}
          <button
            type="button"
            onClick={onQuickEat}
            onMouseEnter={() => onHoverQuickType('food')}
            onMouseLeave={() => onHoverQuickType(null)}
            disabled={!lowestFood}
            title={
              lowestFood
                ? `Quick Eat lowest restoring ration: ${lowestFood.name} (+${lowestFood.nutrition}% Food). Hover to preview on hunger bar!`
                : 'No food items available in backpack.'
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              lowestFood
                ? 'bg-amber-950/80 hover:bg-amber-900 border-amber-600/80 hover:border-amber-500 text-amber-200 cursor-pointer shadow hover:scale-102 active:scale-98'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
            }`}
          >
            <Utensils className={`w-3.5 h-3.5 ${lowestFood ? 'text-amber-400' : 'text-neutral-500'}`} />
            <div className="flex flex-col items-start leading-tight text-left">
              <div className="flex items-center gap-1.5">
                <span className="uppercase text-[10.5px]">Quick Eat</span>
                {lowestFood && (
                  <span className="text-[9.5px] px-1 py-0.2 rounded bg-amber-900/80 text-amber-300 font-bold border border-amber-700">
                    +{lowestFood.nutrition}%
                  </span>
                )}
              </div>
              <span className="text-[9px] font-normal text-neutral-400 truncate max-w-[110px]">
                {lowestFood ? lowestFood.name : 'No Food'}
              </span>
            </div>
          </button>

          {/* Quick Drink Button */}
          <button
            type="button"
            onClick={onQuickDrink}
            onMouseEnter={() => onHoverQuickType('water')}
            onMouseLeave={() => onHoverQuickType(null)}
            disabled={!lowestDrink}
            title={
              lowestDrink
                ? `Quick Drink lowest restoring hydration: ${lowestDrink.name} (+${lowestDrink.hydration}% Water). Hover to preview on thirst bar!`
                : 'No drink items available in backpack.'
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              lowestDrink
                ? 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-600/80 hover:border-cyan-500 text-cyan-200 cursor-pointer shadow hover:scale-102 active:scale-98'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
            }`}
          >
            <Droplets className={`w-3.5 h-3.5 ${lowestDrink ? 'text-cyan-400' : 'text-neutral-500'}`} />
            <div className="flex flex-col items-start leading-tight text-left">
              <div className="flex items-center gap-1.5">
                <span className="uppercase text-[10.5px]">Quick Drink</span>
                {lowestDrink && (
                  <span className="text-[9.5px] px-1 py-0.2 rounded bg-cyan-900/80 text-cyan-300 font-bold border border-cyan-700">
                    +{lowestDrink.hydration}%
                  </span>
                )}
              </div>
              <span className="text-[9px] font-normal text-neutral-400 truncate max-w-[110px]">
                {lowestDrink ? lowestDrink.name : 'No Drink'}
              </span>
            </div>
          </button>
        </div>

        {/* Right: Tactical Flashlight Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFlashlight}
            title={`Toggle Tactical Flashlight [${keyBindings.flashlight.toUpperCase()}]`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              survivor.flashlightOn
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Flashlight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Light [{keyBindings.flashlight.toUpperCase()}]</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
