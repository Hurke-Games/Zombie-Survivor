import React from 'react';
import { Survivor, Item } from '../types/game';
import { Utensils, Flame, AlertTriangle, X } from 'lucide-react';

interface HungerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  onEatFood: (item: Item) => void;
  isNearStove: boolean;
  asSidePanel?: boolean;
}

export const HungerMenu: React.FC<HungerMenuProps> = ({
  isOpen,
  onClose,
  survivor,
  onEatFood,
  isNearStove,
  asSidePanel = false,
}) => {
  if (!isOpen) return null;

  // Filter food items in backpack
  const foodItems = survivor.inventory.filter(
    (item) => item.category === 'food' || (item.nutrition && item.nutrition > 0)
  );

  const innerContent = (
    <div
      className={`bg-neutral-950 overflow-hidden flex flex-col font-mono select-none ${
        asSidePanel
          ? 'w-full h-full border-0'
          : 'relative w-full max-w-2xl border border-amber-600/70 rounded-lg shadow-2xl max-h-[85vh]'
      }`}
    >
      {/* Header: Food reserves up top (still say the 30 minutes) */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2.5 text-amber-400">
          <Utensils className="w-5 h-5" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
              FOOD RESERVES
            </h2>
            <p className="text-[10px] text-neutral-400">
              Subject Satiety Tracking · Full capacity empties in ~30 Minutes
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Close Food Menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body: Kitchen Status followed by single-column items */}
      <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-neutral-300 flex-1">
        {/* Bit about the kitchen */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-xs">
          <Flame
            className={`w-4 h-4 shrink-0 ${
              isNearStove ? 'text-orange-400 animate-pulse' : 'text-neutral-500'
            }`}
          />
          <div>
            <span className="font-semibold text-neutral-200">
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
        </div>

        {/* One column for all items */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1 text-xs">
            <span className="font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              Available Backpack Rations ({foodItems.length})
            </span>
            <span className="text-[10px] text-neutral-500">Click ration to consume</span>
          </div>

          {foodItems.length === 0 ? (
            <div className="p-6 bg-neutral-900/40 border border-neutral-800/80 rounded-lg text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-amber-500/70 mx-auto" />
              <div className="text-neutral-300 font-semibold text-xs">NO FOOD RATIONS IN BACKPACK</div>
              <p className="text-[10px] text-neutral-500 max-w-md mx-auto">
                Search suburban pantry cupboards, loot containers, or craft vegetable stews on a kitchen stove.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {foodItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-600/70 rounded-lg transition-all flex items-center justify-between gap-3 shadow-xs"
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
                      <span className="text-amber-400 font-bold">
                        +{item.nutrition || 20}% Satiety
                      </span>
                      {item.hydration ? (
                        <span className="text-cyan-400 font-medium">
                          +{item.hydration}% Water
                        </span>
                      ) : null}
                      <span className="text-neutral-500">{item.weight} kg</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEatFood(item)}
                    className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded text-[11px] uppercase tracking-wider transition-colors shadow-sm cursor-pointer active:scale-95"
                  >
                    Eat Ration
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 shrink-0">
        <span>Press <strong>[U]</strong> or <strong>[ESC]</strong> to close</span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );

  if (asSidePanel) {
    return innerContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none font-mono">
      {innerContent}
    </div>
  );
};
