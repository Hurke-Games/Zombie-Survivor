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
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  onEquipItem: (item: Item, slot: 'weapon1' | 'weapon2' | 'tool' | ArmorSlot) => void;
  onUnequipItem: (slot: 'weapon1' | 'weapon2' | 'tool' | ArmorSlot) => void;
  onSelectActiveSlot: (slot: ActiveHandSlot) => void;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  isOpen,
  onClose,
  survivor,
  onEquipItem,
  onUnequipItem,
  onSelectActiveSlot,
}) => {
  const [selectedSlotForEquip, setSelectedSlotForEquip] = useState<'weapon1' | 'weapon2' | 'tool' | ArmorSlot>('weapon1');

  if (!isOpen) return null;

  // Calculate total defense
  const armorItems = Object.values(survivor.equippedArmor).filter(Boolean) as Item[];
  const totalDefense = armorItems.reduce((acc, a) => acc + (a.armorDefense || 0), 0);
  const maxBiteDeflect = armorItems.reduce((acc, a) => Math.max(acc, a.biteResistance || 0), 0);

  // Filter backpack items that match the currently selected slot
  const matchingBackpackItems = survivor.inventory.filter((item) => {
    if (selectedSlotForEquip === 'weapon1' || selectedSlotForEquip === 'weapon2') {
      return item.category === 'weapon';
    }
    if (selectedSlotForEquip === 'tool') {
      return item.category === 'tool' || item.category === 'weapon';
    }
    // Armor slots
    return item.category === 'armor' && item.armorSlot === selectedSlotForEquip;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none font-mono">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-amber-950/80 border border-amber-700 flex items-center justify-center text-amber-300">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider text-neutral-100 uppercase">
                Combat Arsenal & Tactical Armor Rig
              </h3>
              <p className="text-[10px] text-neutral-400">
                Manage Weapon 1, Backup Weapon 2, Selected Tool, and protective armor pieces.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs bg-neutral-900 px-3 py-1 rounded border border-neutral-800">
              <span className="text-emerald-400 font-semibold">
                Defense: +{totalDefense}%
              </span>
              <span className="text-neutral-600">|</span>
              <span className="text-amber-400 font-semibold">
                Bite Deflect: {maxBiteDeflect}%
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Left is Rig Slots, Right is Inventory Selector */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Equipment Slots */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 border-b lg:border-b-0 lg:border-r border-neutral-800">
            {/* 1. Weapons & Tools Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-300 uppercase tracking-wider border-b border-neutral-800 pb-1">
                <span>Hand Equipment (Scroll Wheel to Switch)</span>
                <span className="text-[10px] text-neutral-500 font-normal">Active in Hand</span>
              </div>

              {/* Weapon 1 (Primary) */}
              <div
                onClick={() => setSelectedSlotForEquip('weapon1')}
                className={`p-2.5 rounded border transition-all cursor-pointer flex items-center justify-between ${
                  selectedSlotForEquip === 'weapon1'
                    ? 'border-amber-500 bg-amber-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-neutral-900 border border-neutral-700 flex items-center justify-center text-amber-400">
                    <Sword className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                        Weapon 1 (Primary)
                      </span>
                      {survivor.activeSlot === 'weapon1' && (
                        <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1 rounded border border-emerald-800 font-bold">
                          ACTIVE IN HAND
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-neutral-100">
                      {survivor.equippedWeapon?.name || 'Unarmed (Bare Fists)'}
                    </div>
                    {survivor.equippedWeapon && (
                      <div className="text-[10px] text-neutral-400">
                        Type: {survivor.equippedWeapon.weaponType?.toUpperCase() || 'MELEE'} · Dmg: {survivor.equippedWeapon.damage} · Cond: {survivor.equippedWeapon.durability}%
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectActiveSlot('weapon1');
                    }}
                    className={`px-2 py-1 text-[10px] font-bold rounded border uppercase ${
                      survivor.activeSlot === 'weapon1'
                        ? 'bg-emerald-900/60 text-emerald-200 border-emerald-700'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    Hold
                  </button>
                  {survivor.equippedWeapon && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipItem('weapon1');
                      }}
                      title="Unequip to backpack"
                      className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Weapon 2 (Backup) */}
              <div
                onClick={() => setSelectedSlotForEquip('weapon2')}
                className={`p-2.5 rounded border transition-all cursor-pointer flex items-center justify-between ${
                  selectedSlotForEquip === 'weapon2'
                    ? 'border-amber-500 bg-amber-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-neutral-900 border border-neutral-700 flex items-center justify-center text-rose-400">
                    <Crosshair className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                        Weapon 2 (Backup)
                      </span>
                      {survivor.activeSlot === 'weapon2' && (
                        <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1 rounded border border-emerald-800 font-bold">
                          ACTIVE IN HAND
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-neutral-100">
                      {survivor.equippedWeapon2?.name || 'Empty Holster / Slung'}
                    </div>
                    {survivor.equippedWeapon2 && (
                      <div className="text-[10px] text-neutral-400">
                        Type: {survivor.equippedWeapon2.weaponType?.toUpperCase() || 'MELEE'} · Dmg: {survivor.equippedWeapon2.damage} · Cond: {survivor.equippedWeapon2.durability}%
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectActiveSlot('weapon2');
                    }}
                    className={`px-2 py-1 text-[10px] font-bold rounded border uppercase ${
                      survivor.activeSlot === 'weapon2'
                        ? 'bg-emerald-900/60 text-emerald-200 border-emerald-700'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    Hold
                  </button>
                  {survivor.equippedWeapon2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipItem('weapon2');
                      }}
                      title="Unequip to backpack"
                      className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tool 1 */}
              <div
                onClick={() => setSelectedSlotForEquip('tool')}
                className={`p-2.5 rounded border transition-all cursor-pointer flex items-center justify-between ${
                  selectedSlotForEquip === 'tool'
                    ? 'border-amber-500 bg-amber-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-neutral-900 border border-neutral-700 flex items-center justify-center text-cyan-400">
                    <Hammer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                        Tool 1 (Utility)
                      </span>
                      {survivor.activeSlot === 'tool' && (
                        <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1 rounded border border-emerald-800 font-bold">
                          ACTIVE IN HAND
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-neutral-100">
                      {survivor.equippedTool?.name || 'No Tool Selected'}
                    </div>
                    {survivor.equippedTool && (
                      <div className="text-[10px] text-neutral-400">
                        Cond: {survivor.equippedTool.durability}%
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectActiveSlot('tool');
                    }}
                    className={`px-2 py-1 text-[10px] font-bold rounded border uppercase ${
                      survivor.activeSlot === 'tool'
                        ? 'bg-emerald-900/60 text-emerald-200 border-emerald-700'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    Hold
                  </button>
                  {survivor.equippedTool && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipItem('tool');
                      }}
                      title="Unequip to backpack"
                      className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Armor & Protection Section */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider border-b border-neutral-800 pb-1">
                Body Armor Slots (Damage & Bite Mitigation)
              </div>

              {/* Head Gear */}
              <div
                onClick={() => setSelectedSlotForEquip('head')}
                className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between ${
                  selectedSlotForEquip === 'head'
                    ? 'border-cyan-500 bg-cyan-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold">Head Gear</span>
                    <div className="text-xs font-medium text-neutral-200">
                      {survivor.equippedArmor.head?.name || 'None'}
                    </div>
                  </div>
                </div>
                {survivor.equippedArmor.head && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-mono">
                      +{survivor.equippedArmor.head.armorDefense}% Def
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipItem('head');
                      }}
                      className="p-1 text-neutral-500 hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Chest Armor */}
              <div
                onClick={() => setSelectedSlotForEquip('chest')}
                className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between ${
                  selectedSlotForEquip === 'chest'
                    ? 'border-cyan-500 bg-cyan-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold">Chest Armor</span>
                    <div className="text-xs font-medium text-neutral-200">
                      {survivor.equippedArmor.chest?.name || 'None'}
                    </div>
                  </div>
                </div>
                {survivor.equippedArmor.chest && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-mono">
                      +{survivor.equippedArmor.chest.armorDefense}% Def
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipItem('chest');
                      }}
                      className="p-1 text-neutral-500 hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Leg Armor */}
              <div
                onClick={() => setSelectedSlotForEquip('legs')}
                className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between ${
                  selectedSlotForEquip === 'legs'
                    ? 'border-cyan-500 bg-cyan-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-400">👖</span>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold">Leg Armor</span>
                    <div className="text-xs font-medium text-neutral-200">
                      {survivor.equippedArmor.legs?.name || 'None'}
                    </div>
                  </div>
                </div>
                {survivor.equippedArmor.legs && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-mono">
                      +{survivor.equippedArmor.legs.armorDefense}% Def
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipItem('legs');
                      }}
                      className="p-1 text-neutral-500 hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Gloves / Gauntlets */}
              <div
                onClick={() => setSelectedSlotForEquip('gloves')}
                className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between ${
                  selectedSlotForEquip === 'gloves'
                    ? 'border-cyan-500 bg-cyan-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-400">🧤</span>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold">Gloves / Gauntlets</span>
                    <div className="text-xs font-medium text-neutral-200">
                      {survivor.equippedArmor.gloves?.name || 'None'}
                    </div>
                  </div>
                </div>
                {survivor.equippedArmor.gloves && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-mono">
                      +{survivor.equippedArmor.gloves.armorDefense}% Def
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipItem('gloves');
                      }}
                      className="p-1 text-neutral-500 hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Footwear */}
              <div
                onClick={() => setSelectedSlotForEquip('footwear')}
                className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between ${
                  selectedSlotForEquip === 'footwear'
                    ? 'border-cyan-500 bg-cyan-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold">Footwear</span>
                    <div className="text-xs font-medium text-neutral-200">
                      {survivor.equippedArmor.footwear?.name || 'None'}
                    </div>
                  </div>
                </div>
                {survivor.equippedArmor.footwear && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-mono">
                      +{survivor.equippedArmor.footwear.armorDefense}% Def
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipItem('footwear');
                      }}
                      className="p-1 text-neutral-500 hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Inventory Selector for selected slot */}
          <div className="w-full lg:w-80 p-4 bg-neutral-950/80 flex flex-col">
            <div className="border-b border-neutral-800 pb-2 mb-3">
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                Select Gear for: <span className="text-amber-400">{selectedSlotForEquip.toUpperCase()}</span>
              </span>
              <p className="text-[10px] text-neutral-500">
                Click an item from your backpack to equip into this slot.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {matchingBackpackItems.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 italic text-xs">
                  No matching {selectedSlotForEquip} items in backpack. Craft or scavenge more gear.
                </div>
              ) : (
                matchingBackpackItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-neutral-900 border border-neutral-800 rounded flex items-center justify-between hover:border-neutral-700 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-neutral-200">{item.name}</div>
                      <div className="text-[10px] text-neutral-400">
                        {item.damage ? `Dmg: ${item.damage}` : ''}{' '}
                        {item.armorDefense ? `Def: +${item.armorDefense}%` : ''}{' '}
                        {item.blockDefense ? `Block: ${Math.round(item.blockDefense * 100)}%` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => onEquipItem(item, selectedSlotForEquip)}
                      className="px-2.5 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-neutral-950 rounded transition-colors uppercase"
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
    </div>
  );
};
