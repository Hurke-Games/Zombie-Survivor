import React, { useState } from 'react';
import { Item, Survivor, WorldStructure } from '../types/game';
import { Package, Utensils, Droplets, ArrowRight, ArrowLeft, X, Shield, Plus, Minus } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface StorageChestModalProps {
  isOpen: boolean;
  onClose: () => void;
  chest: WorldStructure | null;
  survivor: Survivor;
  onStoreItem: (item: Item, count?: number) => void;
  onTakeItem: (item: Item, count?: number) => void;
}

export const StorageChestModal: React.FC<StorageChestModalProps> = ({
  isOpen,
  onClose,
  chest,
  survivor,
  onStoreItem,
  onTakeItem,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  if (!isOpen || !chest) return null;

  const chestItems = chest.containedLoot || [];
  const playerItems = survivor.inventory;

  const filteredPlayerItems = playerItems.filter((i) => {
    if (filterType === 'food') return i.category === 'food' || i.category === 'drink';
    if (filterType === 'resource') return i.category === 'resource';
    return true;
  });

  const totalFoodInChest = chestItems.filter((i) => i.category === 'food').reduce((sum, i) => sum + (i.count ?? 1), 0);
  const totalWaterInChest = chestItems.filter((i) => i.category === 'drink').reduce((sum, i) => sum + (i.count ?? 1), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none font-mono">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-amber-950/60 border border-amber-600/60 text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wider text-neutral-100 uppercase">
                  {chest.name || 'Colony Storage Chest'}
                </h3>
                <span className="px-1.5 py-0.2 bg-emerald-950 border border-emerald-600/70 text-emerald-300 text-[10px] rounded">
                  Autonomous Survivor Supply
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Deposit food and drinks here. Recruited survivors at base will autonomously eat & drink from this chest when hungry or thirsty.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Colony Rations Summary Banner */}
        <div className="px-5 py-2 bg-neutral-950/60 border-b border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-neutral-300">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              <span>Food Rations in Chest: <strong>{totalFoodInChest}</strong></span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-300">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Water Bottles in Chest: <strong>{totalWaterInChest}</strong></span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-neutral-500">Filter Backpack:</span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded text-[10px] ${filterType === 'all' ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('food')}
              className={`px-2 py-0.5 rounded text-[10px] ${filterType === 'food' ? 'bg-amber-950 border border-amber-600/60 text-amber-200' : 'text-neutral-400 hover:bg-neutral-800'}`}
            >
              Food & Water
            </button>
            <button
              onClick={() => setFilterType('resource')}
              className={`px-2 py-0.5 rounded text-[10px] ${filterType === 'resource' ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800'}`}
            >
              Materials
            </button>
          </div>
        </div>

        {/* Dual Inventory Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-800 overflow-hidden">
          {/* Left: Chest Inventory */}
          <div className="flex flex-col h-full overflow-hidden bg-neutral-900/60">
            <div className="px-4 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between text-xs font-semibold text-amber-300">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Inside Chest ({chestItems.length} items)
              </span>
              <span className="text-[10px] text-neutral-500 font-normal">Click Take to withdraw</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chestItems.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-neutral-500 text-xs text-center p-4">
                  <Package className="w-8 h-8 opacity-40 mb-2" />
                  <span>Chest is empty. Deposit canned rations, fruit, and water from your backpack.</span>
                </div>
              ) : (
                chestItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded bg-neutral-950/70 border border-neutral-800/90 hover:border-amber-700/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-neutral-200 truncate">{item.name}</span>
                        {(item.count ?? 1) > 1 && (
                          <span className="px-1.5 py-0.2 bg-amber-950 text-amber-300 text-[10px] font-bold rounded">
                            x{item.count}
                          </span>
                        )}
                        {item.category === 'food' && (
                          <span className="text-[9px] text-amber-400 font-semibold">(+{item.nutrition}% cal)</span>
                        )}
                        {item.category === 'drink' && (
                          <span className="text-[9px] text-cyan-400 font-semibold">(+{item.hydration}% h2o)</span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-500 truncate">{item.description}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          soundManager.playTerminalBlip();
                          onTakeItem(item, 1);
                        }}
                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded border border-neutral-700 transition-colors"
                        title="Take 1 into Backpack"
                      >
                        Take 1
                      </button>
                      {(item.count ?? 1) > 1 && (
                        <button
                          onClick={() => {
                            soundManager.playTerminalBlip();
                            onTakeItem(item, item.count ?? 1);
                          }}
                          className="px-2 py-1 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xs rounded border border-amber-700/60 transition-colors"
                          title="Take All into Backpack"
                        >
                          All
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Player Backpack */}
          <div className="flex flex-col h-full overflow-hidden bg-neutral-900/60">
            <div className="px-4 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between text-xs font-semibold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <span>🎒 Your Backpack ({playerItems.length} items)</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-normal">Click Store to deposit</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredPlayerItems.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-neutral-500 text-xs text-center p-4">
                  <span>No matching items in your backpack.</span>
                </div>
              ) : (
                filteredPlayerItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded bg-neutral-950/70 border border-neutral-800/90 hover:border-cyan-700/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-neutral-200 truncate">{item.name}</span>
                        {(item.count ?? 1) > 1 && (
                          <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-300 text-[10px] font-bold rounded">
                            x{item.count}
                          </span>
                        )}
                        {item.category === 'food' && (
                          <span className="text-[9px] text-amber-400 font-semibold">(+{item.nutrition}% cal)</span>
                        )}
                        {item.category === 'drink' && (
                          <span className="text-[9px] text-cyan-400 font-semibold">(+{item.hydration}% h2o)</span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-500 truncate">{item.description}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          soundManager.playTerminalBlip();
                          onStoreItem(item, 1);
                        }}
                        className="px-2 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/70 text-cyan-200 text-xs rounded transition-colors flex items-center gap-1"
                        title="Store 1 into Chest"
                      >
                        <ArrowLeft className="w-3 h-3 hidden md:inline" />
                        <span>Store 1</span>
                      </button>
                      {(item.count ?? 1) > 1 && (
                        <button
                          onClick={() => {
                            soundManager.playTerminalBlip();
                            onStoreItem(item, item.count ?? 1);
                          }}
                          className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded border border-neutral-700 transition-colors"
                          title="Store All into Chest"
                        >
                          All
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs">
          <span className="text-[11px] text-neutral-500">
            Tip: Keep the chest supplied with canned meat, stews, blackberries, and water for your colonists.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded border border-neutral-700 transition-colors"
          >
            Close Chest
          </button>
        </div>
      </div>
    </div>
  );
};
