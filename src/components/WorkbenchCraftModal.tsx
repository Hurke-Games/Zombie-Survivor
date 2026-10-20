import React, { useState } from 'react';
import { CraftingRecipe, Survivor } from '../types/game';
import { WORKBENCH_RECIPES } from '../utils/craftingRecipes';
import {
  X,
  Crosshair,
  Sword,
  Wrench,
  Shield,
  Moon,
  Coffee,
  HeartPulse,
  Clock,
  AlertTriangle,
  Lock,
  CheckCircle2,
} from 'lucide-react';

interface WorkbenchCraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  isNearWorkbench: boolean;
  onCraft: (recipe: CraftingRecipe) => void;
}

export const WorkbenchCraftModal: React.FC<WorkbenchCraftModalProps> = ({
  isOpen,
  onClose,
  survivor,
  isNearWorkbench,
  onCraft,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('Guns');

  if (!isOpen) return null;

  const categories = [
    { id: 'Guns', label: 'Firearms & Ammo', icon: <Crosshair className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'Weapons', label: 'Advanced Weapons', icon: <Sword className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'Tools', label: 'Forged Tools', icon: <Wrench className="w-3.5 h-3.5 text-sky-400" /> },
    { id: 'Shelter', label: 'Wall Upgrades & Doors', icon: <Shield className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'Furniture', label: 'Better Beds', icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> },
    { id: 'Cooking', label: 'Kitchen & Cooking', icon: <Coffee className="w-3.5 h-3.5 text-orange-400" /> },
    { id: 'Medical', label: 'Medical Station', icon: <HeartPulse className="w-3.5 h-3.5 text-red-400" /> },
  ];

  const filteredRecipes = WORKBENCH_RECIPES.filter(
    (r) => activeCategory === 'All' || r.category === activeCategory
  );

  const getItemCount = (itemId: string, name: string): number => {
    const item = survivor.inventory.find(
      (i) => i.id === itemId || i.name.toLowerCase().includes(name.toLowerCase())
    );
    return item?.count ?? (item ? 1 : 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none font-mono">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300">
              ⚙️
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider text-neutral-100 uppercase">
                Carpentry Workbench // Advanced Precision Station
              </h3>
              <p className="text-[10px] text-neutral-400">
                Forge firearms, spiked bludgeons, fortified wall plating, cot beds, and surgical medical gear.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Range Badge */}
            {isNearWorkbench ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Bench In Range
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800 font-semibold">
                <Lock className="w-3.5 h-3.5" /> Out of Range (&gt;3m)
              </span>
            )}

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Proximity Alert Warning if not near a workbench */}
        {!isNearWorkbench && (
          <div className="bg-rose-950/40 border-b border-rose-800/80 px-4 py-2 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>WORKBENCH REQUIRED:</strong> The survivor is too far from a Carpentry Workbench. Stand within arm's reach of a workbench to forge these items.
            </span>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-2 bg-neutral-950/60 border-b border-neutral-800 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Recipe Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredRecipes.map((recipe) => {
            const canAfford = recipe.ingredients.every(
              (ing) => getItemCount(ing.itemId, ing.name) >= ing.count
            );
            const hasEndurance = survivor.endurance >= recipe.enduranceCost;
            const canCraft = isNearWorkbench && canAfford && hasEndurance;

            const isGun = recipe.category === 'Guns';

            return (
              <div
                key={recipe.id}
                className={`border rounded p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                  isGun
                    ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-600'
                    : 'bg-neutral-950/70 border-neutral-800/90 hover:border-neutral-700'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs font-bold ${isGun ? 'text-rose-300' : 'text-neutral-100'}`}>
                      {recipe.name}
                    </h4>
                    {isGun && (
                      <span className="text-[9px] bg-rose-900/60 text-rose-200 px-1.5 py-0.5 rounded border border-rose-700 font-bold uppercase">
                        Firearm Blueprint
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-neutral-400 leading-normal">
                    {recipe.description}
                  </p>

                  {/* Materials list */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="text-neutral-500">Materials:</span>
                    {recipe.ingredients.map((ing, iIdx) => {
                      const count = getItemCount(ing.itemId, ing.name);
                      const isMet = count >= ing.count;
                      return (
                        <span
                          key={iIdx}
                          className={`px-1.5 py-0.5 rounded border ${
                            isMet
                              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                              : 'bg-red-950/40 border-red-800/60 text-red-300'
                          }`}
                        >
                          {ing.name} {count}/{ing.count}
                        </span>
                      );
                    })}
                  </div>

                  {/* Costs */}
                  <div className="flex items-center gap-3 pt-0.5 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1 text-amber-500/90">
                      <Clock className="w-3 h-3" /> +{recipe.timeMinutes}m
                    </span>
                    <span className="flex items-center gap-1 text-emerald-500/90">
                      Endurance: -{recipe.enduranceCost}%
                    </span>
                    <span className="flex items-center gap-1 text-rose-500/90">
                      <AlertTriangle className="w-3 h-3" /> Noise: {recipe.noiseDb}dB
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center md:flex-col justify-end">
                  <button
                    onClick={() => {
                      if (canCraft) {
                        onCraft(recipe);
                      }
                    }}
                    disabled={!canCraft}
                    className={`px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap border ${
                      canCraft
                        ? isGun
                          ? 'bg-rose-700 hover:bg-rose-600 text-white font-bold border-rose-600 shadow'
                          : 'bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-600 shadow'
                        : 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                    }`}
                  >
                    {!isNearWorkbench
                      ? 'Requires Workbench'
                      : canCraft
                      ? 'Craft at Workbench'
                      : !canAfford
                      ? 'Missing Materials'
                      : 'Low Stamina'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
