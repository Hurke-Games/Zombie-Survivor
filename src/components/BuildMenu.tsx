import React, { useState } from 'react';
import { CraftingRecipe, Survivor } from '../types/game';
import { BUILD_RECIPES } from '../utils/craftingRecipes';
import { X, Hammer, Shield, Moon, Flame, Wrench, Clock, AlertTriangle } from 'lucide-react';

interface BuildMenuProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  onCraft: (recipe: CraftingRecipe) => void;
}

export const BuildMenu: React.FC<BuildMenuProps> = ({
  isOpen,
  onClose,
  survivor,
  onCraft,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = [
    { id: 'All', label: 'All Field Items', icon: <Hammer className="w-3.5 h-3.5" /> },
    { id: 'Tools', label: 'Simple Tools', icon: <Wrench className="w-3.5 h-3.5" /> },
    { id: 'Weapons', label: 'Simple Weapons', icon: <Hammer className="w-3.5 h-3.5" /> },
    { id: 'Shelter', label: 'Walls & Fencing', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'Furniture', label: 'Mat, Fire & Workbench', icon: <Moon className="w-3.5 h-3.5" /> },
  ];

  const filteredRecipes = BUILD_RECIPES.filter(
    (r) => activeCategory === 'All' || r.category === activeCategory
  );

  const getItemCount = (itemId: string, name: string): number => {
    const item = survivor.inventory.find(
      (i) => i.id === itemId || i.name.toLowerCase().includes(name.toLowerCase())
    );
    return item?.count ?? (item ? 1 : 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-mono">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hammer className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold tracking-wider text-neutral-100 uppercase">
                Field Survival Build Menu
              </h3>
              <p className="text-[10px] text-neutral-500">
                Craft basic hand tools, crude weapons, walls, wood picket and wire fencing, sleeping mats, campfires, and workbenches anywhere in the field.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-2 bg-neutral-950/60 border-b border-neutral-800 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-neutral-800 text-amber-400 border border-neutral-700 shadow-sm'
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
            const canCraft = canAfford && hasEndurance;
            const isWorkbenchBlueprint = recipe.buildsStructure === 'workbench';

            return (
              <div
                key={recipe.id}
                className={`border rounded p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                  isWorkbenchBlueprint
                    ? 'bg-amber-950/20 border-amber-800/60 hover:border-amber-600'
                    : 'bg-neutral-950/70 border-neutral-800/90 hover:border-neutral-700'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs font-bold ${isWorkbenchBlueprint ? 'text-amber-300' : 'text-neutral-100'}`}>
                      {recipe.name}
                    </h4>
                    {isWorkbenchBlueprint && (
                      <span className="text-[9px] bg-amber-900/60 text-amber-200 px-1.5 py-0.5 rounded border border-amber-700 font-bold uppercase">
                        Unlocks Advanced Crafting
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
                        ? isWorkbenchBlueprint
                          ? 'bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold border-amber-500 shadow'
                          : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-600 shadow'
                        : 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                    }`}
                  >
                    {canCraft ? (isWorkbenchBlueprint ? 'Construct Workbench' : 'Build / Craft') : !canAfford ? 'Missing Materials' : 'Low Stamina'}
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
