import React, { useState } from 'react';
import { Survivor, Item, ArmorSlot, ActiveHandSlot } from '../types/game';
import {
  X,
  Shield,
  Crosshair,
  Sword,
  Hammer,
  HardHat,
  Shirt,
  Footprints,
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
} from 'lucide-react';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  onEquipItem: (item: Item, slot: 'weapon1' | 'weapon2' | 'tool' | ArmorSlot) => void;
  onUnequipItem: (slot: 'weapon1' | 'weapon2' | 'tool' | ArmorSlot) => void;
  onSelectActiveSlot: (slot: ActiveHandSlot) => void;
  asSidePanel?: boolean;
}

type EquipSlot = 'weapon1' | 'weapon2' | 'tool' | ArmorSlot;

/**
 * Visual graphic of weapon or tool rendered about the same as it appears on the player sprite
 */
const RenderPlayerHandItem: React.FC<{
  item: Item | null;
  slotLabel: string;
  isActiveInHand: boolean;
}> = ({ item, slotLabel, isActiveInHand }) => {
  return (
    <div className="relative w-16 h-16 sm:w-18 sm:h-18 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
      <svg className="w-full h-full p-1" viewBox="-24 -24 48 48">
        {/* Shadow under hands/weapon */}
        <ellipse cx="0" cy="2" rx="14" ry="8" fill="rgba(0,0,0,0.6)" />

        {/* Sleeves / Arms of player holding the weapon */}
        <rect x="-10" y="-8" width="6" height="5" rx="1.5" fill="#334155" />
        <rect x="-10" y="3" width="6" height="5" rx="1.5" fill="#334155" />

        {/* Player Hands (Skin) */}
        <rect x="-5" y="-7" width="7" height="3.5" rx="1" fill="#e2b388" />
        <rect x="-5" y="3.5" width="7" height="3.5" rx="1" fill="#e2b388" />

        {/* Weapon / Tool Object as rendered on player in SimulationCanvas */}
        {!item ? (
          /* Bare Fists / Empty */
          <g>
            <circle cx="4" cy="-5" r="2.5" fill="#e2b388" />
            <circle cx="4" cy="5" r="2.5" fill="#e2b388" />
          </g>
        ) : item.weaponType === 'shield' ? (
          /* Shield: Curved / rectangular timber shield with steel boss */
          <g>
            <rect x="2" y="-14" width="6" height="28" rx="2" fill="#b45309" stroke="#78350f" strokeWidth="0.8" />
            <rect x="4" y="-11" width="2" height="22" fill="#e2e8f0" />
            <circle cx="5" cy="0" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
          </g>
        ) : item.weaponType === 'gun' ? (
          /* Firearm / Shotgun: Long dark steel barrel with wood stock */
          <g>
            <rect x="-6" y="2" width="10" height="4.5" rx="1" fill="#b45309" />
            <rect x="0" y="2.5" width="22" height="3.5" fill="#1e293b" />
            <rect x="18" y="1.5" width="4" height="1.5" fill="#475569" />
            <circle cx="1" cy="4.5" r="1.5" fill="#94a3b8" />
          </g>
        ) : item.name.toLowerCase().includes('crowbar') ? (
          /* Crowbar: Angled steel bar with curved pry hook */
          <g>
            <path
              d="M -2,4 L 16,7 L 21,3"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line x1="20" y1="2" x2="23" y2="4" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : item.name.toLowerCase().includes('axe') ? (
          /* Axe: Wood shaft with steel wedge blade */
          <g>
            <rect x="-2" y="3.5" width="20" height="3" rx="0.5" fill="#78350f" />
            <polygon points="14,-2 22,-4 22,12 14,10" fill="#94a3b8" stroke="#475569" strokeWidth="0.5" />
            <line x1="21" y1="-3" x2="21" y2="11" stroke="#f1f5f9" strokeWidth="1.2" />
          </g>
        ) : item.name.toLowerCase().includes('bat') || item.name.toLowerCase().includes('plank') ? (
          /* Baseball Bat / Nailed 2x4 Plank */
          <g>
            <rect x="-3" y="3" width="22" height="4.5" rx="1.5" fill="#b45309" stroke="#78350f" strokeWidth="0.5" />
            {/* Metal nails / wire */}
            <circle cx="11" cy="1" r="1.2" fill="#e2e8f0" />
            <circle cx="15" cy="9" r="1.2" fill="#e2e8f0" />
            <circle cx="17" cy="1" r="1.2" fill="#e2e8f0" />
            <line x1="12" y1="2" x2="18" y2="8" stroke="#cbd5e1" strokeWidth="0.8" />
          </g>
        ) : item.name.toLowerCase().includes('hammer') ? (
          /* Hammer: Sturdy wood shaft with flat iron head */
          <g>
            <rect x="-2" y="3.5" width="18" height="3" rx="0.5" fill="#78350f" />
            <rect x="13" y="-1" width="7" height="12" rx="1" fill="#64748b" stroke="#334155" strokeWidth="0.6" />
          </g>
        ) : item.name.toLowerCase().includes('spear') ? (
          /* Spear: Long pointed pike */
          <g>
            <line x1="-8" y1="4.5" x2="20" y2="4.5" stroke="#78350f" strokeWidth="2" />
            <polygon points="19,1 25,4.5 19,8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
          </g>
        ) : (
          /* Knife / Generic blade */
          <g>
            <rect x="-2" y="3.5" width="7" height="3" rx="0.5" fill="#475569" />
            <polygon points="5,2.5 18,4 5,6.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" />
          </g>
        )}
      </svg>

      {/* Active in Hand Indicator */}
      {isActiveInHand && (
        <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-950 animate-pulse" />
      )}
    </div>
  );
};

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  isOpen,
  onClose,
  survivor,
  onEquipItem,
  onUnequipItem,
  onSelectActiveSlot,
  asSidePanel = false,
}) => {
  const [selectedSlotForEquip, setSelectedSlotForEquip] = useState<EquipSlot>('head');
  const [hoveredCompareItem, setHoveredCompareItem] = useState<Item | null>(null);

  if (!isOpen) return null;

  // Calculate total defense
  const armorItems = Object.values(survivor.equippedArmor).filter(Boolean) as Item[];
  const totalDefense = armorItems.reduce((acc, a) => acc + (a.armorDefense || 0), 0);
  const maxBiteDeflect = armorItems.reduce((acc, a) => Math.max(acc, a.biteResistance || 0), 0);

  // Filter backpack items matching the currently selected slot
  const matchingBackpackItems = survivor.inventory.filter((item) => {
    if (selectedSlotForEquip === 'weapon1' || selectedSlotForEquip === 'weapon2') {
      return item.category === 'weapon';
    }
    if (selectedSlotForEquip === 'tool') {
      return item.category === 'tool' || item.category === 'weapon';
    }
    return item.category === 'armor' && item.armorSlot === selectedSlotForEquip;
  });

  // Get current item in the active slot
  const currentlyEquipped: Item | null =
    selectedSlotForEquip === 'weapon1'
      ? survivor.equippedWeapon
      : selectedSlotForEquip === 'weapon2'
      ? survivor.equippedWeapon2
      : selectedSlotForEquip === 'tool'
      ? survivor.equippedTool
      : survivor.equippedArmor[selectedSlotForEquip as ArmorSlot] ?? null;

  // Render compare statistics
  const renderCompareStats = () => {
    if (!hoveredCompareItem) return null;

    const isArmor =
      selectedSlotForEquip === 'head' ||
      selectedSlotForEquip === 'chest' ||
      selectedSlotForEquip === 'legs' ||
      selectedSlotForEquip === 'footwear' ||
      selectedSlotForEquip === 'gloves';

    const curDef = currentlyEquipped?.armorDefense ?? 0;
    const newDef = hoveredCompareItem.armorDefense ?? 0;
    const defDelta = newDef - curDef;

    const curBite = currentlyEquipped?.biteResistance ?? 0;
    const newBite = hoveredCompareItem.biteResistance ?? 0;
    const biteDelta = newBite - curBite;

    const curDmg = currentlyEquipped?.damage ?? (selectedSlotForEquip.startsWith('weapon') ? 10 : 0);
    const newDmg = hoveredCompareItem.damage ?? 0;
    const dmgDelta = newDmg - curDmg;

    return (
      <div className="absolute top-2 left-2 right-2 bg-neutral-900/98 border border-cyan-500 rounded-lg p-2.5 shadow-2xl z-30 font-mono text-xs animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-1 mb-1.5">
          <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Equipment Comparison</span>
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-800 uppercase">
            {selectedSlotForEquip}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-200">
          <span className="truncate max-w-[100px] text-neutral-400">
            {currentlyEquipped ? currentlyEquipped.name : 'Empty Slot'}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mx-1" />
          <span className="truncate max-w-[120px] text-cyan-300 font-bold">
            {hoveredCompareItem.name}
          </span>
        </div>

        {/* Stat Comparison deltas */}
        <div className="mt-2 space-y-1 text-[10px]">
          {isArmor ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Armor Defense:</span>
                <span className="font-bold flex items-center gap-1">
                  <span>{curDef}% ➔ {newDef}%</span>
                  <span
                    className={`px-1 rounded text-[9.5px] ${
                      defDelta > 0
                        ? 'text-emerald-400 bg-emerald-950 border border-emerald-800'
                        : defDelta < 0
                        ? 'text-rose-400 bg-rose-950 border border-rose-800'
                        : 'text-neutral-400'
                    }`}
                  >
                    {defDelta > 0 ? `+${defDelta}%` : defDelta < 0 ? `${defDelta}%` : '0%'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Bite Deflect:</span>
                <span className="font-bold flex items-center gap-1">
                  <span>{curBite}% ➔ {newBite}%</span>
                  <span
                    className={`px-1 rounded text-[9.5px] ${
                      biteDelta > 0
                        ? 'text-emerald-400 bg-emerald-950 border border-emerald-800'
                        : biteDelta < 0
                        ? 'text-rose-400 bg-rose-950 border border-rose-800'
                        : 'text-neutral-400'
                    }`}
                  >
                    {biteDelta > 0 ? `+${biteDelta}%` : biteDelta < 0 ? `${biteDelta}%` : '0%'}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Damage Strike:</span>
              <span className="font-bold flex items-center gap-1">
                <span>{curDmg} ➔ {newDmg}</span>
                <span
                  className={`px-1 rounded text-[9.5px] ${
                    dmgDelta > 0
                      ? 'text-emerald-400 bg-emerald-950 border border-emerald-800'
                      : dmgDelta < 0
                      ? 'text-rose-400 bg-rose-950 border border-rose-800'
                      : 'text-neutral-400'
                    }`}
                >
                  {dmgDelta > 0 ? `+${dmgDelta} DMG` : dmgDelta < 0 ? `${dmgDelta} DMG` : '0'}
                </span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-0.5 border-t border-neutral-800/80 text-neutral-400">
            <span>Weight:</span>
            <span>
              {currentlyEquipped?.weight ?? 0}kg ➔ {hoveredCompareItem.weight}kg
            </span>
          </div>
        </div>
      </div>
    );
  };

  const innerContent = (
    <div
      className={`bg-neutral-950 overflow-hidden flex flex-col font-mono select-none ${
        asSidePanel
          ? 'w-full h-full border-0'
          : 'relative w-full max-w-4xl border border-neutral-800 rounded-lg shadow-2xl max-h-[88vh]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-amber-950/80 border border-amber-700 flex items-center justify-center text-amber-300">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider text-neutral-100 uppercase">
              Combat Rig & Arsenal
            </h3>
            <p className="text-[10px] text-neutral-400">
              Interactive loadout · Click body or gear squares to manage equipment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-neutral-950 px-2.5 py-1 rounded border border-neutral-800">
            <span className="text-emerald-400 font-semibold" title="Total Damage Reduction from Armor">
              Def: +{totalDefense}%
            </span>
            <span className="text-neutral-600">|</span>
            <span className="text-amber-400 font-semibold" title="Bite Deflect Transmission Resistance">
              Bite: {maxBiteDeflect}%
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Close Gear Rig"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content: Left is Character Rig (Body + Tool square + Weapon squares), Right is Item Selector */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT COLUMN: Body Paper Doll + Left Tool Square + Right Weapon Squares */}
        <div className="w-full md:w-60 lg:w-64 p-3 bg-neutral-900/50 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col items-center justify-between gap-3 relative shrink-0 overflow-y-auto">
          {/* Compare pop-up when hovering over any equip button on the right */}
          {renderCompareStats()}

          <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider text-center">
            SURVIVOR CHASSIS & RIG
          </div>

          {/* Central Rig Assembly: Left Tool Square | Center Body Paper Doll | Right 2 Weapon Squares */}
          <div className="flex items-center justify-center gap-3 my-auto w-full">
            {/* Left Side: Square Tool Slot */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedSlotForEquip('tool')}
                className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                  selectedSlotForEquip === 'tool'
                    ? 'border-sky-400 bg-sky-950/40 ring-1 ring-sky-400/50 shadow-md'
                    : 'border-neutral-800 bg-neutral-950/80 hover:border-neutral-700'
                }`}
                title="Field Tool [T1] - Click to select & view tools"
              >
                <RenderPlayerHandItem
                  item={survivor.equippedTool}
                  slotLabel="T1"
                  isActiveInHand={survivor.activeSlot === 'tool'}
                />
                <span className="text-[9.5px] font-bold text-sky-400 uppercase mt-1">Tool [T1]</span>
                <span className="text-[8.5px] text-neutral-300 truncate max-w-[65px] leading-tight">
                  {survivor.equippedTool?.name || 'None'}
                </span>
              </button>
            </div>

            {/* Center: Interactive Body Paper Doll */}
            <div className="flex flex-col items-center py-2 px-1 rounded-xl bg-neutral-950 border border-neutral-850 shadow-inner">
              {/* Head Slot */}
              <button
                type="button"
                onClick={() => setSelectedSlotForEquip('head')}
                className={`relative w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                  selectedSlotForEquip === 'head'
                    ? 'border-cyan-400 bg-cyan-950/70 shadow-lg ring-1 ring-cyan-400'
                    : survivor.equippedArmor.head
                    ? 'border-cyan-600 bg-cyan-950/30'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
                } ${hoveredCompareItem?.armorSlot === 'head' ? 'animate-pulse ring-2 ring-emerald-400' : ''}`}
                title={`Head Slot: ${survivor.equippedArmor.head?.name || 'Empty'} (Click to view helmets)`}
              >
                <HardHat className="w-5 h-5 text-cyan-300" />
                {survivor.equippedArmor.head && (
                  <span className="absolute -bottom-1 text-[7px] bg-cyan-900 text-cyan-200 px-1 rounded border border-cyan-700 font-bold">
                    +{survivor.equippedArmor.head.armorDefense}%
                  </span>
                )}
              </button>

              {/* Neck spacer */}
              <div className="w-2 h-1 bg-neutral-800 my-0.5" />

              {/* Chest / Torso Slot */}
              <button
                type="button"
                onClick={() => setSelectedSlotForEquip('chest')}
                className={`relative w-14 h-16 rounded-md border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                  selectedSlotForEquip === 'chest'
                    ? 'border-cyan-400 bg-cyan-950/70 shadow-lg ring-1 ring-cyan-400'
                    : survivor.equippedArmor.chest
                    ? 'border-cyan-600 bg-cyan-950/30'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
                } ${hoveredCompareItem?.armorSlot === 'chest' ? 'animate-pulse ring-2 ring-emerald-400' : ''}`}
                title={`Chest Slot: ${survivor.equippedArmor.chest?.name || 'Empty'} (Click to view armor)`}
              >
                <Shirt className="w-6 h-6 text-cyan-300" />
                <span className="text-[7.5px] uppercase font-bold text-neutral-400 mt-0.5">Chest</span>
                {survivor.equippedArmor.chest && (
                  <span className="absolute -bottom-1 text-[7px] bg-cyan-900 text-cyan-200 px-1 rounded border border-cyan-700 font-bold">
                    +{survivor.equippedArmor.chest.armorDefense}%
                  </span>
                )}
              </button>

              {/* Waist spacer */}
              <div className="w-8 h-1 bg-neutral-800 my-0.5" />

              {/* Legs Slot */}
              <button
                type="button"
                onClick={() => setSelectedSlotForEquip('legs')}
                className={`relative w-12 h-14 rounded-md border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                  selectedSlotForEquip === 'legs'
                    ? 'border-cyan-400 bg-cyan-950/70 shadow-lg ring-1 ring-cyan-400'
                    : survivor.equippedArmor.legs
                    ? 'border-cyan-600 bg-cyan-950/30'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
                } ${hoveredCompareItem?.armorSlot === 'legs' ? 'animate-pulse ring-2 ring-emerald-400' : ''}`}
                title={`Legs Slot: ${survivor.equippedArmor.legs?.name || 'Empty'} (Click to view leg armor)`}
              >
                <span className="text-base leading-none">👖</span>
                <span className="text-[7.5px] uppercase font-bold text-neutral-400 mt-0.5">Legs</span>
                {survivor.equippedArmor.legs && (
                  <span className="absolute -bottom-1 text-[7px] bg-cyan-900 text-cyan-200 px-1 rounded border border-cyan-700 font-bold">
                    +{survivor.equippedArmor.legs.armorDefense}%
                  </span>
                )}
              </button>

              {/* Footwear (Boots) Slot */}
              <button
                type="button"
                onClick={() => setSelectedSlotForEquip('footwear')}
                className={`relative w-11 h-7 rounded-sm border-2 mt-1 transition-all flex items-center justify-center cursor-pointer ${
                  selectedSlotForEquip === 'footwear'
                    ? 'border-cyan-400 bg-cyan-950/70 shadow-lg ring-1 ring-cyan-400'
                    : survivor.equippedArmor.footwear
                    ? 'border-cyan-600 bg-cyan-950/30'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
                } ${hoveredCompareItem?.armorSlot === 'footwear' ? 'animate-pulse ring-2 ring-emerald-400' : ''}`}
                title={`Footwear Slot: ${survivor.equippedArmor.footwear?.name || 'Empty'} (Click to view boots)`}
              >
                <Footprints className="w-3.5 h-3.5 text-cyan-300" />
                {survivor.equippedArmor.footwear && (
                  <span className="text-[7px] font-bold text-cyan-300 ml-1">
                    +{survivor.equippedArmor.footwear.armorDefense}%
                  </span>
                )}
              </button>
            </div>

            {/* Right Side: Two Weapon Squares (Weapon 1 & Weapon 2) */}
            <div className="flex flex-col items-center gap-2">
              {/* Weapon 1 (Primary) */}
              <button
                type="button"
                onClick={() => setSelectedSlotForEquip('weapon1')}
                className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                  selectedSlotForEquip === 'weapon1'
                    ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400/50 shadow-md'
                    : 'border-neutral-800 bg-neutral-950/80 hover:border-neutral-700'
                }`}
                title="Primary Weapon 1 [W1] - Click to select & view weapons"
              >
                <RenderPlayerHandItem
                  item={survivor.equippedWeapon}
                  slotLabel="W1"
                  isActiveInHand={survivor.activeSlot === 'weapon1'}
                />
                <span className="text-[9.5px] font-bold text-amber-400 uppercase mt-1">Prim [W1]</span>
                <span className="text-[8.5px] text-neutral-300 truncate max-w-[65px] leading-tight">
                  {survivor.equippedWeapon?.name || 'Fists'}
                </span>
              </button>

              {/* Weapon 2 (Backup) */}
              <button
                type="button"
                onClick={() => setSelectedSlotForEquip('weapon2')}
                className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                  selectedSlotForEquip === 'weapon2'
                    ? 'border-rose-400 bg-rose-950/40 ring-1 ring-rose-400/50 shadow-md'
                    : 'border-neutral-800 bg-neutral-950/80 hover:border-neutral-700'
                }`}
                title="Backup Weapon 2 [W2] - Click to select & view weapons"
              >
                <RenderPlayerHandItem
                  item={survivor.equippedWeapon2}
                  slotLabel="W2"
                  isActiveInHand={survivor.activeSlot === 'weapon2'}
                />
                <span className="text-[9.5px] font-bold text-rose-400 uppercase mt-1">Back [W2]</span>
                <span className="text-[8.5px] text-neutral-300 truncate max-w-[65px] leading-tight">
                  {survivor.equippedWeapon2?.name || 'Empty'}
                </span>
              </button>
            </div>
          </div>

          <div className="text-[9.5px] text-neutral-500 text-center">
            Click part or weapon square to swap gear
          </div>
        </div>

        {/* RIGHT COLUMN: Gear Selector for Selected Slot */}
        <div className="flex-1 p-4 bg-neutral-950 flex flex-col overflow-hidden">
          {/* Header of selected slot & Current Item */}
          <div className="border-b border-neutral-800 pb-3 mb-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>SLOT:</span>
                <span className="text-cyan-400 font-black">
                  {selectedSlotForEquip === 'weapon1'
                    ? 'PRIMARY WEAPON [W1]'
                    : selectedSlotForEquip === 'weapon2'
                    ? 'BACKUP WEAPON [W2]'
                    : selectedSlotForEquip === 'tool'
                    ? 'FIELD UTILITY TOOL [T1]'
                    : `${selectedSlotForEquip.toUpperCase()} ARMOR`}
                </span>
              </span>

              {/* Hold in Hand Action if it's a weapon/tool slot */}
              {(selectedSlotForEquip === 'weapon1' ||
                selectedSlotForEquip === 'weapon2' ||
                selectedSlotForEquip === 'tool') && (
                <button
                  type="button"
                  onClick={() => onSelectActiveSlot(selectedSlotForEquip as ActiveHandSlot)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase cursor-pointer transition-colors ${
                    survivor.activeSlot === selectedSlotForEquip
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700 ring-1 ring-emerald-500'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  {survivor.activeSlot === selectedSlotForEquip ? 'Active in Hand' : 'Hold in Hand'}
                </button>
              )}
            </div>

            {/* Currently Equipped Item Summary */}
            <div className="mt-2 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Equipped Now:</span>
                <div className="text-xs font-bold text-neutral-100">
                  {currentlyEquipped ? currentlyEquipped.name : 'None / Bare'}
                </div>
                {currentlyEquipped && (
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    {currentlyEquipped.damage ? `Dmg: ${currentlyEquipped.damage} · ` : ''}
                    {currentlyEquipped.armorDefense ? `Def: +${currentlyEquipped.armorDefense}% · ` : ''}
                    {currentlyEquipped.biteResistance ? `Bite Resist: ${currentlyEquipped.biteResistance}% · ` : ''}
                    Cond: {currentlyEquipped.durability || 100}% · Weight: {currentlyEquipped.weight}kg
                  </div>
                )}
              </div>

              {currentlyEquipped && (
                <button
                  type="button"
                  onClick={() => onUnequipItem(selectedSlotForEquip)}
                  className="px-2.5 py-1 text-xs font-medium text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 rounded transition-colors cursor-pointer"
                >
                  Unequip
                </button>
              )}
            </div>
          </div>

          {/* List of matching backpack gear items */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">
              Available in Backpack ({matchingBackpackItems.length}):
            </div>

            {matchingBackpackItems.length === 0 ? (
              <div className="p-8 bg-neutral-900/40 border border-neutral-800/80 rounded-lg text-center space-y-1.5">
                <Shield className="w-6 h-6 text-neutral-600 mx-auto" />
                <div className="text-neutral-400 font-semibold text-xs">NO MATCHING ITEMS IN BACKPACK</div>
                <p className="text-[10px] text-neutral-500 max-w-xs mx-auto">
                  Craft items at the Build Menu [B] or Workbench [C], or scavenge residential closets and armories.
                </p>
              </div>
            ) : (
              matchingBackpackItems.map((item, idx) => (
                <div
                  key={`${item.id}_${idx}`}
                  className="p-3 bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-cyan-600/70 rounded-lg transition-all flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-100 text-xs truncate">
                        {item.name}
                      </span>
                      {item.count && item.count > 1 && (
                        <span className="px-1.5 py-0.2 bg-neutral-800 text-[10px] rounded text-neutral-300 font-mono">
                          x{item.count}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      {item.damage ? (
                        <span className="text-amber-400 font-bold">
                          {item.damage} DMG
                        </span>
                      ) : null}
                      {item.armorDefense ? (
                        <span className="text-emerald-400 font-bold">
                          +{item.armorDefense}% Def
                        </span>
                      ) : null}
                      {item.biteResistance ? (
                        <span className="text-amber-300 font-medium">
                          {item.biteResistance}% Bite Deflect
                        </span>
                      ) : null}
                      {item.blockDefense ? (
                        <span className="text-sky-400 font-medium">
                          Block: {Math.round(item.blockDefense * 100)}%
                        </span>
                      ) : null}
                      <span className="text-neutral-500">{item.weight} kg</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onMouseEnter={() => setHoveredCompareItem(item)}
                    onMouseLeave={() => setHoveredCompareItem(null)}
                    onClick={() => {
                      onEquipItem(item, selectedSlotForEquip);
                      setHoveredCompareItem(null);
                    }}
                    className="shrink-0 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-bold rounded text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer active:scale-95"
                  >
                    Equip
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (asSidePanel) {
    return innerContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none font-mono">
      {innerContent}
    </div>
  );
};
