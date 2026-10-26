import React from 'react';
import { Survivor, Item } from '../types/game';
import { KeyBindings } from '../utils/keybindings';
import {
  Heart,
  Zap,
  Moon,
  Utensils,
  Droplets,
  Skull,
  ShieldAlert,
  Activity,
  AlertTriangle,
  Hand,
  Compass,
} from 'lucide-react';

interface SurvivorVitalsPanelProps {
  survivor: Survivor;
  keyBindings: KeyBindings;
  onOpenEquipment: () => void;
  onOpenHunger: () => void;
  onOpenThirst: () => void;
  onInteract: () => void;
  hoveredQuickType?: 'food' | 'water' | null;
  lowestFoodNutrition?: number;
  lowestDrinkHydration?: number;
}

export const SurvivorVitalsPanel: React.FC<SurvivorVitalsPanelProps> = ({
  survivor,
  keyBindings,
  onOpenEquipment,
  onOpenHunger,
  onOpenThirst,
  onInteract,
  hoveredQuickType = null,
  lowestFoodNutrition = 0,
  lowestDrinkHydration = 0,
}) => {
  const armorItems = Object.values(survivor.equippedArmor).filter(Boolean) as Item[];
  const totalDefense = armorItems.reduce((acc, a) => acc + (a.armorDefense || 0), 0);

  // Semitransparent preview calculation for Hunger / Food
  const currentHunger = Math.max(0, Math.min(100, survivor.hunger));
  const projectedHunger = Math.min(100, currentHunger + lowestFoodNutrition);
  const previewHungerDelta = Math.max(0, projectedHunger - currentHunger);

  // Semitransparent preview calculation for Thirst / Water
  const currentThirst = Math.max(0, Math.min(100, survivor.thirst));
  const projectedThirst = Math.min(100, currentThirst + lowestDrinkHydration);
  const previewThirstDelta = Math.max(0, projectedThirst - currentThirst);

  return (
    <aside
      aria-label="Survivor Vitals, Telemetry, and Controls"
      className="w-52 sm:w-56 md:w-60 shrink-0 bg-neutral-950/98 border-r border-neutral-800 flex flex-col p-2.5 sm:p-3 gap-2.5 font-mono select-none overflow-y-auto z-20 shadow-xl"
    >
      {/* Diagnostics Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800/80 text-[10px] text-neutral-400">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-neutral-300">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>Vitals</span>
        </span>
        <span
          className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-800 text-emerald-400 font-semibold"
          title={`Armor Defense Rating: +${totalDefense}%`}
        >
          DEF +{totalDefense}%
        </span>
      </div>

      {/* TOP SECTION: Health, Stamina, and Body Paper Doll */}
      <div className="flex flex-col gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/90 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Mini Paper Doll (Body) */}
          <button
            type="button"
            onClick={onOpenEquipment}
            title={`Equipment & Armor Rig [${keyBindings.equipment.toUpperCase()}] - Click to open`}
            className="group relative w-12 h-16 bg-neutral-950 border border-neutral-800 hover:border-cyan-500 rounded p-1 flex flex-col items-center justify-center text-[8px] text-neutral-400 cursor-pointer transition-all shadow-inner shrink-0"
          >
            <span className="text-[7.5px] text-neutral-500 uppercase tracking-tighter group-hover:text-cyan-400 font-bold">
              Rig [{keyBindings.equipment.toUpperCase()}]
            </span>
            {/* Head */}
            <div
              className={`w-3.5 h-3.5 rounded-full border ${
                survivor.equippedArmor.head
                  ? 'border-cyan-400 bg-cyan-950/80'
                  : 'border-neutral-700 bg-neutral-800'
              } mt-0.5`}
              title="Head Protection"
            />
            {/* Torso */}
            <div
              className={`w-5 h-5 border mt-0.5 rounded-xs ${
                survivor.injuries.some((i) => i.part === 'Torso')
                  ? 'border-red-500 bg-red-950/70 text-red-300 animate-pulse'
                  : survivor.equippedArmor.chest
                  ? 'border-cyan-400 bg-cyan-950/80'
                  : 'border-neutral-700 bg-neutral-800'
              }`}
              title="Torso Protection"
            />
            {/* Legs */}
            <div className="flex gap-0.5 mt-0.5">
              <div
                className={`w-2 h-3.5 border rounded-xs ${
                  survivor.injuries.some((i) => i.part === 'Left Leg')
                    ? 'border-amber-500 bg-amber-950/70'
                    : survivor.equippedArmor.legs
                    ? 'border-cyan-400 bg-cyan-950/80'
                    : 'border-neutral-700 bg-neutral-800'
                }`}
                title="Left Leg"
              />
              <div
                className={`w-2 h-3.5 border rounded-xs ${
                  survivor.injuries.some((i) => i.part === 'Right Leg')
                    ? 'border-amber-500 bg-amber-950/70'
                    : survivor.equippedArmor.legs
                    ? 'border-cyan-400 bg-cyan-950/80'
                    : 'border-neutral-700 bg-neutral-800'
                }`}
                title="Right Leg"
              />
            </div>
            {survivor.isBitten && (
              <span className="absolute -top-1 -right-1 px-1 bg-red-600 text-white text-[7px] font-black uppercase rounded shadow animate-pulse">
                Bite
              </span>
            )}
          </button>

          {/* Health & Stamina Bars */}
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            {/* Health */}
            <div>
              <div className="flex items-center justify-between text-[11px] leading-tight mb-0.5">
                <span className="flex items-center gap-1 text-red-400 font-bold">
                  <Heart className="w-3 h-3 fill-red-500/20" /> HP
                </span>
                <span
                  className={`tabular-nums font-bold ${
                    survivor.hp < 30 ? 'text-red-400 animate-pulse' : 'text-neutral-200'
                  }`}
                >
                  {Math.round(survivor.hp)}%
                </span>
              </div>
              <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    survivor.hp < 30
                      ? 'bg-red-600 animate-pulse'
                      : survivor.hp < 60
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, survivor.hp))}%` }}
                />
              </div>
            </div>

            {/* Stamina */}
            <div>
              <div className="flex items-center justify-between text-[11px] leading-tight mb-0.5">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Zap className="w-3 h-3 fill-emerald-500/20" /> Stamina
                </span>
                <span className="tabular-nums font-semibold text-neutral-200">
                  {Math.round(survivor.endurance)}%
                </span>
              </div>
              <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, survivor.endurance))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VERTICAL STATUS STACK: Fatigue, Hunger, Thirst, and Panic */}
      <div className="flex flex-col gap-2 shrink-0">
        {/* 1. Fatigue */}
        <div
          className={`p-2 rounded-lg border transition-all ${
            survivor.fatigue > 75
              ? 'bg-red-950/30 border-red-800/80'
              : survivor.fatigue > 45
              ? 'bg-neutral-900/60 border-amber-900/50'
              : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
          title={`Fatigue: ${Math.round(survivor.fatigue)}% (Rest in bed to recover)`}
        >
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1.5 text-neutral-300 font-semibold">
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Fatigue</span>
            </span>
            <span
              className={`text-[10px] font-bold ${
                survivor.fatigue > 75
                  ? 'text-red-400'
                  : survivor.fatigue > 45
                  ? 'text-amber-400'
                  : 'text-neutral-400'
              }`}
            >
              {survivor.isSleeping
                ? 'Sleeping...'
                : survivor.fatigue > 75
                ? 'Exhausted'
                : survivor.fatigue > 45
                ? 'Tired'
                : 'Rested'}
            </span>
          </div>

          <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${
                survivor.fatigue > 75 ? 'bg-indigo-500 animate-pulse' : 'bg-indigo-400'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, survivor.fatigue))}%` }}
            />
          </div>

          {survivor.isConsciousnessSlipping && (
            <div className="mt-1 text-[9px] text-red-400 font-bold flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
              <span>
                PASSING OUT ({Math.floor((survivor.consciousnessSlippingTimer ?? 300) / 60)}:
                {(survivor.consciousnessSlippingTimer ?? 300) % 60 < 10 ? '0' : ''}
                {(survivor.consciousnessSlippingTimer ?? 300) % 60})
              </span>
            </div>
          )}
        </div>

        {/* 2. Hunger (with Semitransparent Preview Bar for Quick Eat) */}
        <button
          type="button"
          onClick={onOpenHunger}
          className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer hover:bg-neutral-900 group ${
            survivor.hunger <= 15
              ? 'bg-red-950/40 border-red-800 ring-1 ring-red-500/40 animate-pulse'
              : survivor.hunger < 40
              ? 'bg-amber-950/30 border-amber-800/80'
              : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
          title={`Hunger: ${Math.round(
            survivor.hunger
          )}% (Drains over ~30 mins. 0% is fatal). Click for Rations Menu.`}
        >
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1.5 text-neutral-300 font-semibold group-hover:text-amber-300">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              <span>Hunger [{keyBindings.hunger.toUpperCase()}]</span>
            </span>

            {/* If hovering Quick Eat, show projected amount */}
            {hoveredQuickType === 'food' && previewHungerDelta > 0 ? (
              <span className="text-[10px] font-bold tabular-nums text-amber-300 animate-pulse">
                {Math.round(survivor.hunger)}% ➔ <span className="text-emerald-400 font-black">+{lowestFoodNutrition}%</span> ({Math.round(projectedHunger)}%)
              </span>
            ) : (
              <span
                className={`text-[10px] font-bold tabular-nums ${
                  survivor.hunger <= 15
                    ? 'text-red-400 font-black'
                    : survivor.hunger < 40
                    ? 'text-red-400'
                    : survivor.hunger < 70
                    ? 'text-amber-400'
                    : 'text-neutral-400'
                }`}
              >
                {survivor.hunger <= 15
                  ? 'Starving!'
                  : survivor.hunger < 40
                  ? 'Hungry'
                  : survivor.hunger < 70
                  ? 'Peckish'
                  : 'Fed'}{' '}
                ({Math.round(survivor.hunger)}%)
              </span>
            )}
          </div>

          {/* Hunger Bar Track with Solid Bar + Semitransparent Ghost Preview */}
          <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-800 flex">
            {/* Solid current hunger bar */}
            <div
              className={`h-full transition-all duration-300 ${
                survivor.hunger <= 15
                  ? 'bg-red-600 animate-pulse'
                  : survivor.hunger < 40
                  ? 'bg-amber-500'
                  : 'bg-amber-400'
              }`}
              style={{ width: `${currentHunger}%` }}
            />
            {/* Semitransparent ghost preview bar */}
            {hoveredQuickType === 'food' && previewHungerDelta > 0 && (
              <div
                className="h-full bg-amber-300/60 border-r-2 border-amber-200 animate-pulse transition-all duration-150"
                style={{ width: `${previewHungerDelta}%` }}
                title={`Quick Eat Preview: +${lowestFoodNutrition}% Satiety`}
              />
            )}
          </div>
        </button>

        {/* 3. Thirst (with Semitransparent Preview Bar for Quick Drink) */}
        <button
          type="button"
          onClick={onOpenThirst}
          className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer hover:bg-neutral-900 group ${
            survivor.thirst <= 15
              ? 'bg-red-950/40 border-red-800 ring-1 ring-red-500/40 animate-pulse'
              : survivor.thirst < 40
              ? 'bg-cyan-950/30 border-cyan-800/80'
              : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
          title={`Thirst: ${Math.round(
            survivor.thirst
          )}% (Drains over ~10 mins. 0% is fatal). Click for Hydration Menu.`}
        >
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1.5 text-neutral-300 font-semibold group-hover:text-cyan-300">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Thirst [{keyBindings.thirst.toUpperCase()}]</span>
            </span>

            {/* If hovering Quick Drink, show projected amount */}
            {hoveredQuickType === 'water' && previewThirstDelta > 0 ? (
              <span className="text-[10px] font-bold tabular-nums text-cyan-300 animate-pulse">
                {Math.round(survivor.thirst)}% ➔ <span className="text-emerald-400 font-black">+{lowestDrinkHydration}%</span> ({Math.round(projectedThirst)}%)
              </span>
            ) : (
              <span
                className={`text-[10px] font-bold tabular-nums ${
                  survivor.thirst <= 15
                    ? 'text-red-400 font-black'
                    : survivor.thirst < 40
                    ? 'text-red-400'
                    : survivor.thirst < 70
                    ? 'text-amber-400'
                    : 'text-neutral-400'
                }`}
              >
                {survivor.thirst <= 15
                  ? 'Parched!'
                  : survivor.thirst < 40
                  ? 'Thirsty'
                  : survivor.thirst < 70
                  ? 'Mild'
                  : 'Hydrated'}{' '}
                ({Math.round(survivor.thirst)}%)
              </span>
            )}
          </div>

          {/* Thirst Bar Track with Solid Bar + Semitransparent Ghost Preview */}
          <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-800 flex">
            {/* Solid current thirst bar */}
            <div
              className={`h-full transition-all duration-300 ${
                survivor.thirst <= 15
                  ? 'bg-red-600 animate-pulse'
                  : survivor.thirst < 40
                  ? 'bg-cyan-500'
                  : 'bg-cyan-400'
              }`}
              style={{ width: `${currentThirst}%` }}
            />
            {/* Semitransparent ghost preview bar */}
            {hoveredQuickType === 'water' && previewThirstDelta > 0 && (
              <div
                className="h-full bg-cyan-200/60 border-r-2 border-cyan-100 animate-pulse transition-all duration-150"
                style={{ width: `${previewThirstDelta}%` }}
                title={`Quick Drink Preview: +${lowestDrinkHydration}% Hydration`}
              />
            )}
          </div>
        </button>

        {/* 4. Panic */}
        <div
          className={`p-2 rounded-lg border transition-all ${
            survivor.panic > 70
              ? 'bg-rose-950/40 border-rose-800/80 ring-1 ring-rose-500/40'
              : survivor.panic > 35
              ? 'bg-neutral-900/60 border-amber-900/60'
              : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
          title={`Panic: ${Math.round(
            survivor.panic
          )}% (Affects aim stability and melee weapon precision)`}
        >
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1.5 text-neutral-300 font-semibold">
              <Skull className="w-3.5 h-3.5 text-rose-400" />
              <span>Panic</span>
            </span>
            <span
              className={`text-[10px] font-bold tabular-nums ${
                survivor.panic > 70
                  ? 'text-rose-400 animate-pulse font-black'
                  : survivor.panic > 35
                  ? 'text-amber-400'
                  : 'text-neutral-400'
              }`}
            >
              {survivor.panic > 70
                ? `Terrified (-${Math.round(survivor.panic)}%)`
                : survivor.panic > 35
                ? `Anxious (-${Math.round(survivor.panic)}%)`
                : 'Calm (100% Aim)'}
            </span>
          </div>
          <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${
                survivor.panic > 70 ? 'bg-rose-500 animate-pulse' : 'bg-rose-400'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, survivor.panic))}%` }}
            />
          </div>
        </div>

        {/* 5. Charval Virus (Only rendered if bitten / infected) */}
        {survivor.isBitten && (
          <div
            className="p-2 rounded-lg bg-red-950/70 border border-red-600 text-red-200 shadow-lg animate-pulse"
            title="100% Fatal Charval Infection transmitted by zombie bite"
          >
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1.5 text-red-400 font-black uppercase">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500 animate-spin" />
                <span>Charval Virus</span>
              </span>
              <span className="text-[10px] font-black text-red-300 tabular-nums">
                {Math.round(survivor.virusProgress)}% Fatal
              </span>
            </div>
            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-red-900">
              <div
                className="h-full bg-red-600"
                style={{ width: `${Math.max(0, Math.min(100, survivor.virusProgress))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* LOWER SECTION: Interact Action Button & Movement Information (Moved from bottom to left under meters) */}
      <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-2 mt-auto shrink-0">
        {/* World Action / Interact Button */}
        <button
          type="button"
          onClick={onInteract}
          title={`World Action: Open/close doors, jump fences, loot chests, chop trees, sleep in bed [${keyBindings.interact.toUpperCase()}]`}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/80 hover:border-amber-500 text-amber-200 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer group active:scale-98"
        >
          <Hand className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>ACTION [{keyBindings.interact.toUpperCase()}]</span>
        </button>

        {/* Movement & Tactical Controls Guide */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-2 text-[9.5px] text-neutral-300 space-y-1 font-mono">
          <div className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1 border-b border-neutral-800 pb-1 mb-1">
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>Controls & Movement</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Move:</span>
            <span className="font-bold text-neutral-100 bg-neutral-950 px-1 rounded border border-neutral-800">
              WASD
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Interact / Doors:</span>
            <span className="font-bold text-amber-400 bg-neutral-950 px-1 rounded border border-neutral-800">
              [{keyBindings.interact.toUpperCase()}] / Click
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Repair Structure:</span>
            <span className="font-bold text-emerald-400 bg-neutral-950 px-1 rounded border border-neutral-800">
              [{keyBindings.repair.toUpperCase()}]
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Cycle Holster Hand:</span>
            <span className="font-bold text-cyan-400 bg-neutral-950 px-1 rounded border border-neutral-800">
              Scroll
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Talk to Survivor:</span>
            <span className="font-bold text-cyan-300 bg-neutral-950 px-1 rounded border border-neutral-800">
              [{keyBindings.survivor.toUpperCase()}]
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Zoom Tactical:</span>
            <span className="font-bold text-neutral-300 bg-neutral-950 px-1 rounded border border-neutral-800">
              [-] / [+]
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
