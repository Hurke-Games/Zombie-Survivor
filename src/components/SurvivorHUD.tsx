import React from 'react';
import { Survivor, Item, ActiveHandSlot } from '../types/game';
import {
  Heart,
  Zap,
  Moon,
  Utensils,
  Droplets,
  Skull,
  Hammer,
  Backpack,
  Flashlight,
  Hand,
  ShieldAlert,
  Wrench,
  Shield,
  Crosshair,
  Sword,
  Users,
} from 'lucide-react';

import { KeyBindings, DEFAULT_KEYBINDINGS } from '../utils/keybindings';

interface SurvivorHUDProps {
  survivor: Survivor;
  isNearWorkbench: boolean;
  keyBindings?: KeyBindings;
  onOpenBuild: () => void;
  onOpenWorkbenchCraft: () => void;
  onOpenInventory: () => void;
  onOpenEquipment: () => void;
  onOpenHunger: () => void;
  onOpenThirst: () => void;
  onOpenColony?: () => void;
  recruitedCount?: number;
  onSelectActiveSlot: (slot: ActiveHandSlot) => void;
  onToggleFlashlight: () => void;
  onInteract: () => void;
}

export const SurvivorHUD: React.FC<SurvivorHUDProps> = ({
  survivor,
  isNearWorkbench,
  keyBindings = DEFAULT_KEYBINDINGS,
  onOpenBuild,
  onOpenWorkbenchCraft,
  onOpenInventory,
  onOpenEquipment,
  onOpenHunger,
  onOpenThirst,
  onOpenColony,
  recruitedCount = 0,
  onSelectActiveSlot,
  onToggleFlashlight,
  onInteract,
}) => {
  const armorItems = Object.values(survivor.equippedArmor).filter(Boolean) as Item[];
  const totalDefense = armorItems.reduce((acc, a) => acc + (a.armorDefense || 0), 0);

  return (
    <footer className="w-full bg-neutral-950/95 border-t border-neutral-800 text-neutral-300 p-2.5 z-20 backdrop-blur-md font-mono select-none">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Paper Doll & Vitals */}
        <div className="flex items-center gap-3">
          {/* Mini Paper Doll */}
          <div
            onClick={onOpenEquipment}
            title="Click to open Equipment & Armor Rig"
            className="relative w-14 h-18 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded p-1 flex flex-col items-center justify-center text-[9px] text-neutral-400 cursor-pointer transition-colors"
          >
            <span className="text-[8px] text-neutral-500 uppercase tracking-tighter">Rig [E]</span>
            <div className={`w-4 h-4 rounded-full border ${survivor.equippedArmor.head ? 'border-cyan-500 bg-cyan-950/60' : 'border-neutral-700 bg-neutral-800'} mt-0.5`} title="Head" />
            <div
              className={`w-6 h-6 border mt-0.5 rounded-sm ${
                survivor.injuries.some((i) => i.part === 'Torso')
                  ? 'border-red-500 bg-red-950/60 text-red-300'
                  : survivor.equippedArmor.chest
                  ? 'border-cyan-500 bg-cyan-950/60'
                  : 'border-neutral-700 bg-neutral-800'
              }`}
              title="Torso"
            />
            <div className="flex gap-1 mt-0.5">
              <div
                className={`w-2 h-4 border rounded-xs ${
                  survivor.injuries.some((i) => i.part === 'Left Leg')
                    ? 'border-amber-500 bg-amber-950/60'
                    : survivor.equippedArmor.legs
                    ? 'border-cyan-500 bg-cyan-950/60'
                    : 'border-neutral-700 bg-neutral-800'
                }`}
              />
              <div
                className={`w-2 h-4 border rounded-xs ${
                  survivor.injuries.some((i) => i.part === 'Right Leg')
                    ? 'border-amber-500 bg-amber-950/60'
                    : survivor.equippedArmor.legs
                    ? 'border-cyan-500 bg-cyan-950/60'
                    : 'border-neutral-700 bg-neutral-800'
                }`}
              />
            </div>
            {survivor.isBitten && (
              <span className="absolute -top-1 -right-1 px-1 bg-red-600 text-white text-[7px] font-bold uppercase rounded">
                Bite
              </span>
            )}
          </div>

          {/* Health & Endurance Progress Bars */}
          <div className="flex flex-col gap-1 w-36">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-red-400">
                <Heart className="w-3.5 h-3.5 fill-red-500/20" /> HP
              </span>
              <span className="tabular-nums font-semibold">{Math.round(survivor.hp)}%</span>
            </div>
            <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden border border-neutral-800">
              <div
                className={`h-full transition-all duration-300 ${
                  survivor.hp < 30 ? 'bg-red-600 animate-pulse' : survivor.hp < 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(0, survivor.hp)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400">
                <Zap className="w-3.5 h-3.5 fill-emerald-500/20" /> Stamina
              </span>
              <span className="tabular-nums">{Math.round(survivor.endurance)}%</span>
            </div>
            <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${Math.max(0, survivor.endurance)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Moodles & Needs Telemetry */}
        <div className="flex items-center gap-4 border-l border-r border-neutral-800/80 px-3">
          <div className="flex flex-col items-center" title={`Fatigue: ${Math.round(survivor.fatigue)}%`}>
            <div className="flex items-center gap-1 text-[11px] text-neutral-400">
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Fatigue</span>
            </div>
            <span
              className={`text-xs font-medium ${
                survivor.fatigue > 75 ? 'text-red-400' : survivor.fatigue > 45 ? 'text-amber-400' : 'text-neutral-400'
              }`}
            >
              {survivor.isSleeping ? 'Sleeping...' : survivor.fatigue > 75 ? 'Exhausted' : survivor.fatigue > 45 ? 'Tired' : 'Rested'}
            </span>
          </div>

          <div
            onClick={onOpenHunger}
            className="flex flex-col items-center cursor-pointer hover:bg-neutral-900/80 px-2 py-1 rounded transition-colors"
            title={`Hunger: ${Math.round(survivor.hunger)}% (Drains in ~30 mins. 0% is fatal. Click or press [U] for Rations Menu)`}
          >
            <div className="flex items-center gap-1 text-[11px] text-neutral-400">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              <span>Hunger</span>
            </div>
            <span
              className={`text-xs font-medium tabular-nums ${
                survivor.hunger <= 15
                  ? 'text-red-400 font-bold animate-pulse'
                  : survivor.hunger < 40
                  ? 'text-red-400'
                  : survivor.hunger < 70
                  ? 'text-amber-400'
                  : 'text-neutral-400'
              }`}
            >
              {survivor.hunger <= 15 ? 'Starving!' : survivor.hunger < 40 ? 'Hungry' : survivor.hunger < 70 ? 'Peckish' : 'Fed'} ({Math.round(survivor.hunger)}%)
            </span>
          </div>

          <div
            onClick={onOpenThirst}
            className="flex flex-col items-center cursor-pointer hover:bg-neutral-900/80 px-2 py-1 rounded transition-colors"
            title={`Thirst: ${Math.round(survivor.thirst)}% (Drains in ~10 mins. 0% is fatal. Click or press [Y] for Hydration Menu)`}
          >
            <div className="flex items-center gap-1 text-[11px] text-neutral-400">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Thirst</span>
            </div>
            <span
              className={`text-xs font-medium tabular-nums ${
                survivor.thirst <= 15
                  ? 'text-red-400 font-bold animate-pulse'
                  : survivor.thirst < 40
                  ? 'text-red-400'
                  : survivor.thirst < 70
                  ? 'text-amber-400'
                  : 'text-neutral-400'
              }`}
            >
              {survivor.thirst <= 15 ? 'Parched!' : survivor.thirst < 40 ? 'Thirsty' : survivor.thirst < 70 ? 'Mild' : 'Hydrated'} ({Math.round(survivor.thirst)}%)
            </span>
          </div>

          <div
            className="flex flex-col items-center"
            title={`Panic: ${Math.round(survivor.panic)}% (Shakes weapon aim crosshair and causes bullet spread / missed swings. Non-lethal).`}
          >
            <div className="flex items-center gap-1 text-[11px] text-neutral-400">
              <Skull className="w-3.5 h-3.5 text-rose-400" />
              <span>Panic</span>
            </div>
            <span
              className={`text-xs font-medium tabular-nums ${
                survivor.panic > 70 ? 'text-rose-400 animate-pulse font-bold' : survivor.panic > 35 ? 'text-amber-400' : 'text-neutral-400'
              }`}
            >
              {survivor.panic > 70
                ? `Terrified (-${Math.round(survivor.panic)}% Aim)`
                : survivor.panic > 35
                ? `Anxious (-${Math.round(survivor.panic)}% Aim)`
                : 'Calm (100% Aim)'}
            </span>
          </div>

          {survivor.isBitten && (
            <div className="flex flex-col items-center pl-2 border-l border-red-900/60" title="100% Fatal Knox Infection">
              <div className="flex items-center gap-1 text-[11px] text-red-500 font-bold">
                <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
                <span>Knox Virus</span>
              </div>
              <span className="text-xs text-red-400 font-bold tabular-nums">
                {Math.round(survivor.virusProgress)}% Fatal
              </span>
            </div>
          )}
        </div>

        {/* Right: Weapon 1 / Weapon 2 / Tool Hand Selector & Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Hand Selector: Weapon 1 (Primary) */}
          <div
            onClick={() => onSelectActiveSlot('weapon1')}
            title="Weapon 1 (Click or Scroll Wheel to hold)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-all ${
              survivor.activeSlot === 'weapon1'
                ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-sm ring-1 ring-amber-500/50'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <Sword className="w-3.5 h-3.5 text-amber-400" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-amber-400/90 leading-tight">W1: Primary</span>
              <span className="text-xs font-medium text-neutral-200 truncate max-w-[70px]">
                {survivor.equippedWeapon?.name || 'Fists'}
              </span>
            </div>
          </div>

          {/* Hand Selector: Weapon 2 (Backup) */}
          <div
            onClick={() => onSelectActiveSlot('weapon2')}
            title="Weapon 2 Backup (Click or Scroll Wheel to hold)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-all ${
              survivor.activeSlot === 'weapon2'
                ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-sm ring-1 ring-rose-500/50'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-rose-400/90 leading-tight">W2: Backup</span>
              <span className="text-xs font-medium text-neutral-200 truncate max-w-[70px]">
                {survivor.equippedWeapon2?.name || 'Empty'}
              </span>
            </div>
          </div>

          {/* Hand Selector: Tool 1 */}
          <div
            onClick={() => onSelectActiveSlot('tool')}
            title="Tool 1 (Click or Scroll Wheel to hold)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-all ${
              survivor.activeSlot === 'tool'
                ? 'bg-sky-950/60 border-sky-500 text-sky-200 shadow-sm ring-1 ring-sky-500/50'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <Hammer className="w-3.5 h-3.5 text-sky-400" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-sky-400/90 leading-tight">T1: Tool</span>
              <span className="text-xs font-medium text-neutral-200 truncate max-w-[70px]">
                {survivor.equippedTool?.name || 'None'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-2">
            {/* World Action Button */}
            <button
              onClick={onInteract}
              title={`World Action: Open/close doors, jump fences, loot chests, chop trees, sleep in bed, harvest fruit [${keyBindings.interact.toUpperCase()}]`}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded border border-neutral-700 transition-colors whitespace-nowrap"
            >
              <Hand className="w-3.5 h-3.5 text-amber-400" />
              <span>[{keyBindings.interact.toUpperCase()}]</span>
            </button>

            {/* Dedicated Equipment Rig Modal */}
            <button
              onClick={onOpenEquipment}
              title={`Dedicated Equipment & Armor Rig Screen [${keyBindings.equipment.toUpperCase()}]`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium rounded border border-neutral-700 transition-colors whitespace-nowrap"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Rig [{keyBindings.equipment.toUpperCase()}] (+{totalDefense}%)</span>
            </button>

            {/* Field Build Menu */}
            <button
              onClick={onOpenBuild}
              title={`Field Build: Simple hand tools, crude weapons, walls, sleeping mat, small fire, and workbenches [${keyBindings.build.toUpperCase()}]`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 text-xs font-medium rounded border border-amber-800 transition-colors whitespace-nowrap"
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Build [{keyBindings.build.toUpperCase()}]</span>
            </button>

            {/* Workbench Exclusive Crafting */}
            <button
              onClick={onOpenWorkbenchCraft}
              title={
                isNearWorkbench
                  ? `Workbench Active: Craft at bench [${keyBindings.workbench.toUpperCase()}]`
                  : `Workbench Crafting: Open Bench Crafting [${keyBindings.workbench.toUpperCase()}]`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                isNearWorkbench
                  ? 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border-cyan-700 shadow-sm'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bench [{keyBindings.workbench.toUpperCase()}]</span>
              {isNearWorkbench && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
              )}
            </button>

            {/* Backpack Inventory */}
            <button
              onClick={onOpenInventory}
              title={`Open Backpack Inventory [${keyBindings.inventory.toUpperCase()}]`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded border border-neutral-700 transition-colors whitespace-nowrap"
            >
              <Backpack className="w-3.5 h-3.5" />
              <span>Pack [{keyBindings.inventory.toUpperCase()}] ({survivor.inventory.length})</span>
            </button>

            {/* Colony & Recruited Survivors */}
            <button
              onClick={onOpenColony}
              title={`Colony Survivors & Base Maintenance [${keyBindings.colony.toUpperCase()}]`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 text-xs font-medium rounded border border-emerald-800 transition-colors whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Colony [{keyBindings.colony.toUpperCase()}] ({recruitedCount})</span>
            </button>

            {/* Food Rations Menu */}
            <button
              onClick={onOpenHunger}
              title={`Open Hunger & Food Rations Menu [${keyBindings.hunger.toUpperCase()}] (Full to empty in ~30 mins)`}
              className="flex items-center gap-1 px-2 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 text-xs font-medium rounded border border-amber-800/80 transition-colors whitespace-nowrap"
            >
              <Utensils className="w-3 h-3 text-amber-400" />
              <span>Food [{keyBindings.hunger.toUpperCase()}]</span>
            </button>

            {/* Water Hydration Menu */}
            <button
              onClick={onOpenThirst}
              title={`Open Thirst & Water Hydration Menu [${keyBindings.thirst.toUpperCase()}] (Full to empty in ~10 mins)`}
              className="flex items-center gap-1 px-2 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 text-xs font-medium rounded border border-cyan-800/80 transition-colors whitespace-nowrap"
            >
              <Droplets className="w-3 h-3 text-cyan-400" />
              <span>Water [{keyBindings.thirst.toUpperCase()}]</span>
            </button>

            {/* Flashlight */}
            <button
              onClick={onToggleFlashlight}
              title={`Toggle Tactical Flashlight Beam [${keyBindings.flashlight.toUpperCase()}]`}
              className={`p-1.5 rounded border transition-colors ${
                survivor.flashlightOn
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Flashlight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
