import React, { useState } from 'react';
import { Survivor, Item } from '../types/game';
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
  Box,
  Wrench,
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
  asSidePanel?: boolean;
}

type InvTabType = 'all' | 'food' | 'drinks' | 'equipment' | 'building' | 'medical';

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  survivor,
  onUseItem,
  onEquipWeapon,
  onEquipTool,
  onStartPlacing,
  onOpenEquipment,
  asSidePanel = false,
}) => {
  const [activeTab, setActiveTab] = useState<InvTabType>('all');

  if (!isOpen) return null;

  const totalWeight = survivor.inventory.reduce((sum, i) => sum + (i.weight * (i.count ?? 1)), 0);

  // Categorize items
  const foodItems = survivor.inventory.filter((i) => i.category === 'food');
  const drinkItems = survivor.inventory.filter((i) => i.category === 'drink');
  const equipmentItems = survivor.inventory.filter(
    (i) => i.category === 'weapon' || i.category === 'tool' || i.category === 'armor'
  );
  const buildingItems = survivor.inventory.filter(
    (i) => i.category === 'structure_kit' || i.isPlaceable || i.category === 'resource'
  );
  const medicalItems = survivor.inventory.filter(
    (i) => i.category === 'medical' || i.category === 'book'
  );

  let filteredItems = survivor.inventory;
  if (activeTab === 'food') filteredItems = foodItems;
  else if (activeTab === 'drinks') filteredItems = drinkItems;
  else if (activeTab === 'equipment') filteredItems = equipmentItems;
  else if (activeTab === 'building') filteredItems = buildingItems;
  else if (activeTab === 'medical') filteredItems = medicalItems;

  const tabs: { id: InvTabType; label: string; count: number; icon: React.ReactNode; color: string }[] = [
    { id: 'all', label: 'All Items', count: survivor.inventory.length, icon: <Backpack className="w-3.5 h-3.5" />, color: 'text-neutral-300' },
    { id: 'food', label: 'Food', count: foodItems.length, icon: <Utensils className="w-3.5 h-3.5 text-amber-400" />, color: 'text-amber-400' },
    { id: 'drinks', label: 'Drinks', count: drinkItems.length, icon: <Droplets className="w-3.5 h-3.5 text-cyan-400" />, color: 'text-cyan-400' },
    { id: 'equipment', label: 'Equipment', count: equipmentItems.length, icon: <Sword className="w-3.5 h-3.5 text-emerald-400" />, color: 'text-emerald-400' },
    { id: 'building', label: 'Building & Kits', count: buildingItems.length, icon: <Layers className="w-3.5 h-3.5 text-amber-300" />, color: 'text-amber-300' },
    { id: 'medical', label: 'Medical', count: medicalItems.length, icon: <HeartPulse className="w-3.5 h-3.5 text-rose-400" />, color: 'text-rose-400' },
  ];

  const innerContent = (
    <div
      className={`bg-neutral-900 border-neutral-800 flex flex-col shadow-2xl overflow-hidden font-mono select-none ${
        asSidePanel ? 'w-full h-full border-0 rounded-none bg-neutral-950' : 'border rounded-lg max-w-3xl w-full max-h-[85vh]'
      }`}
    >
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
            type="button"
            onClick={() => {
              onClose();
              onOpenEquipment();
            }}
            className="px-2.5 py-1 text-xs bg-amber-950/80 hover:bg-amber-900 text-amber-300 rounded border border-amber-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Rig</span>
          </button>
          <span className="text-xs text-neutral-400 font-mono">
            Weight: <strong className={totalWeight > survivor.maxCarryWeight ? 'text-red-400' : 'text-neutral-200'}>{totalWeight.toFixed(1)}</strong> / {survivor.maxCarryWeight} kg
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Tabs: Fully separating food, drinks, equipment, and building objects */}
      <div className="flex items-center gap-1 px-3 py-2 bg-neutral-950/70 border-b border-neutral-800 overflow-x-auto shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-neutral-800 text-neutral-100 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                isActive ? 'bg-neutral-900 text-neutral-200' : 'bg-neutral-900/80 text-neutral-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Item Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 italic text-xs">
            {activeTab === 'all'
              ? 'Backpack is empty. Scavenge nearby cupboards or chop trees.'
              : `No items found in ${activeTab.toUpperCase()}.`}
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isWeapon = item.category === 'weapon';
            const isTool = item.category === 'tool';
            const isArmor = item.category === 'armor';
            const isPlaceable = item.isPlaceable;
            const isUsable =
              item.category === 'food' ||
              item.category === 'drink' ||
              item.category === 'medical' ||
              item.category === 'book';

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
                      {item.nutrition && (
                        <span className="text-[10px] text-amber-400 font-semibold">
                          +{item.nutrition}% Food
                        </span>
                      )}
                      {item.hydration && (
                        <span className="text-[10px] text-cyan-400 font-semibold">
                          +{item.hydration}% Water
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate max-w-md">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isPlaceable && (
                    <button
                      type="button"
                      onClick={() => onStartPlacing(item)}
                      className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 text-xs rounded border border-cyan-700 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 text-cyan-400" />
                      <span>Place</span>
                    </button>
                  )}

                  {isUsable && (
                    <button
                      type="button"
                      onClick={() => onUseItem(item)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded border border-neutral-700 transition-colors cursor-pointer"
                    >
                      {item.category === 'food'
                        ? 'Eat'
                        : item.category === 'drink'
                        ? 'Drink'
                        : item.category === 'book'
                        ? 'Read'
                        : 'Use'}
                    </button>
                  )}

                  {isWeapon && (
                    <button
                      type="button"
                      onClick={() => onEquipWeapon(item)}
                      className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-200 text-xs rounded border border-amber-800 transition-colors cursor-pointer"
                    >
                      Equip
                    </button>
                  )}

                  {isTool && (
                    <button
                      type="button"
                      onClick={() => onEquipTool(item)}
                      className="px-2.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-200 text-xs rounded border border-sky-800 transition-colors cursor-pointer"
                    >
                      Equip Tool
                    </button>
                  )}

                  {isArmor && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenEquipment();
                      }}
                      className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 text-xs rounded border border-emerald-800 transition-colors cursor-pointer"
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
  );

  if (asSidePanel) {
    return innerContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-mono">
      {innerContent}
    </div>
  );
};
