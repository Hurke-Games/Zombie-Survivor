import React from 'react';
import { Survivor, Item, ArmorSlot } from '../types/game';
import {
  X,
  Backpack,
  Utensils,
  Droplets,
  HeartPulse,
  BookOpen,
  Sword,
  Hammer,
  Shield,
  Layers,
  MapPin,
} from 'lucide-react';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  onUseItem: (item: Item) => void;
  onEquipWeapon: (item: Item) => void;
  onEquipTool: (item: Item) => void;
  onStartPlacing: (item: Item) => void;
  onOpenEquipment: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  survivor,
  onUseItem,
  onEquipWeapon,
  onEquipTool,
  onStartPlacing,
  onOpenEquipment,
}) => {
  if (!isOpen) return null;

  const totalWeight = survivor.inventory.reduce((sum, i) => sum + (i.weight * (i.count ?? 1)), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-mono">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-100">
            <Backpack className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold tracking-wider uppercase">
              Backpack Inventory & Storage
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                onOpenEquipment();
              }}
              className="px-2.5 py-1 text-xs bg-amber-950/80 hover:bg-amber-900 text-amber-300 rounded border border-amber-700 flex items-center gap-1.5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Equipment & Armor Rig</span>
            </button>
            <span className="text-xs text-neutral-400 font-mono">
              Weight: <strong className={totalWeight > survivor.maxCarryWeight ? 'text-red-400' : 'text-neutral-200'}>{totalWeight.toFixed(1)}</strong> / {survivor.maxCarryWeight} kg
            </span>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Item Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {survivor.inventory.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 italic text-xs">
              Backpack is empty. Scavenge nearby cupboards or chop trees.
            </div>
          ) : (
            survivor.inventory.map((item, idx) => {
              const isWeapon = item.category === 'weapon';
              const isTool = item.category === 'tool';
              const isArmor = item.category === 'armor';
              const isPlaceable = item.isPlaceable;
              const isUsable = item.category === 'food' || item.category === 'drink' || item.category === 'medical' || item.category === 'book';

              return (
                <div
                  key={idx}
                  className="bg-neutral-950/70 border border-neutral-800/90 rounded p-2.5 flex items-center justify-between gap-3 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 text-neutral-300">
                      {item.category === 'food' && <Utensils className="w-4 h-4 text-amber-400" />}
                      {item.category === 'drink' && <Droplets className="w-4 h-4 text-cyan-400" />}
                      {item.category === 'medical' && <HeartPulse className="w-4 h-4 text-rose-400" />}
                      {item.category === 'book' && <BookOpen className="w-4 h-4 text-indigo-400" />}
                      {item.category === 'weapon' && <Sword className="w-4 h-4 text-amber-300" />}
                      {item.category === 'tool' && <Hammer className="w-4 h-4 text-sky-400" />}
                      {item.category === 'armor' && <Shield className="w-4 h-4 text-emerald-400" />}
                      {item.category === 'structure_kit' && <Layers className="w-4 h-4 text-amber-400" />}
                      {item.category === 'resource' && <span className="text-xs">📦</span>}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-200 truncate">
                          {item.name}
                        </span>
                        {(item.count ?? 1) > 1 && (
                          <span className="text-[10px] text-neutral-400 bg-neutral-900 px-1.5 rounded border border-neutral-800">
                            x{item.count}
                          </span>
                        )}
                        {item.durability !== undefined && (
                          <span className="text-[10px] text-neutral-500">
                            Cond: {item.durability}%
                          </span>
                        )}
                        {item.damage && (
                          <span className="text-[10px] text-amber-400">
                            Dmg: {item.damage}
                          </span>
                        )}
                        {item.armorDefense && (
                          <span className="text-[10px] text-emerald-400">
                            Def: +{item.armorDefense}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate max-w-md">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Place Structure Button */}
                    {isPlaceable && (
                      <button
                        onClick={() => {
                          onClose();
                          onStartPlacing(item);
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs rounded border border-amber-500 transition-colors flex items-center gap-1 uppercase"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Place</span>
                      </button>
                    )}

                    {isUsable && (
                      <button
                        onClick={() => onUseItem(item)}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded border border-neutral-700 transition-colors"
                      >
                        {item.category === 'food' ? 'Eat' : item.category === 'drink' ? 'Drink' : item.category === 'medical' ? 'Apply' : 'Read'}
                      </button>
                    )}

                    {isWeapon && (
                      <button
                        onClick={() => onEquipWeapon(item)}
                        className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-200 text-xs rounded border border-amber-800 transition-colors"
                      >
                        Equip
                      </button>
                    )}

                    {isTool && (
                      <button
                        onClick={() => onEquipTool(item)}
                        className="px-2.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-200 text-xs rounded border border-sky-800 transition-colors"
                      >
                        Equip Tool
                      </button>
                    )}

                    {isArmor && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenEquipment();
                        }}
                        className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 text-xs rounded border border-emerald-800 transition-colors"
                      >
                        Equip Armor
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
