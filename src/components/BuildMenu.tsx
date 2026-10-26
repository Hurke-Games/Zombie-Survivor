import React, { useState } from 'react';
import { CraftingRecipe, Survivor } from '../types/game';
import { BUILD_RECIPES } from '../utils/craftingRecipes';
import { X, Hammer, Shield, Moon, Wrench, Clock, AlertTriangle } from 'lucide-react';

interface BuildMenuProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  onCraft: (recipe: CraftingRecipe) => void;
  asSidePanel?: boolean;
}

export const BuildMenu: React.FC<BuildMenuProps> = ({
  isOpen,
  onClose,
  survivor,
  onCraft,
  asSidePanel = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = [
    { id: 'All', label: 'All Structures', icon: <Hammer className="w-3.5 h-3.5" /> },
    { id: 'Shelter_T1', label: 'Tier 1 Wood', icon: <Shield className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'Shelter_T2', label: 'Tier 2 Stone', icon: <Shield className="w-3.5 h-3.5 text-slate-300" /> },
    { id: 'Shelter_T3', label: 'Tier 3 Steel & Concrete', icon: <Shield className="w-3.5 h-3.5 text-blue-400" /> },
    { id: 'Traps', label: 'Traps & Defenses', icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> },
    { id: 'Furniture', label: 'Mat & Station', icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> },
    { id: 'Workbench', label: 'Workbench', icon: <Wrench className="w-3.5 h-3.5 text-cyan-400" /> },
  ];

  const getItemCount = (itemId: string, name: string): number => {
    const qName = name.toLowerCase();
    return survivor.inventory.reduce((sum, item) => {
      const iName = item.name.toLowerCase();
      const iId = item.id.toLowerCase();

      // Treated Planks
      if (qName.includes('treated plank') || itemId.includes('treated_plank')) {
        if (iName.includes('treated plank') || iId.includes('treated_plank')) return sum + (item.count ?? 1);
      }
      // Concrete Mix
      else if (qName.includes('concrete') || itemId.includes('concrete')) {
        if (iName.includes('concrete') || iId.includes('concrete')) return sum + (item.count ?? 1);
      }
      // Steel Plates
      else if (qName.includes('steel plate') || itemId.includes('steel_plate')) {
        if (iName.includes('steel plate') || iId.includes('steel_plate')) return sum + (item.count ?? 1);
      }
      // Gravel
      else if (qName.includes('gravel') || itemId.includes('gravel')) {
        if (iName.includes('gravel') || iId.includes('gravel')) return sum + (item.count ?? 1);
      }
      // Simple Planks
      else if ((qName.includes('plank') || itemId.includes('plank')) && !qName.includes('treated')) {
        if ((iName.includes('plank') || iId.includes('plank')) && !iName.includes('treated') && !iId.includes('treated')) return sum + (item.count ?? 1);
      } else if (qName.includes('nail') || itemId.includes('nail')) {
        if (iName.includes('nail') || iId.includes('nail')) return sum + (item.count ?? 1);
      } else if (qName.includes('stone') || itemId.includes('stone')) {
        if (iName.includes('stone') || iId.includes('stone')) return sum + (item.count ?? 1);
      } else if (qName.includes('clay') || itemId.includes('clay')) {
        if (iName.includes('clay') || iId.includes('clay')) return sum + (item.count ?? 1);
      } else if (qName.includes('hardwood') || itemId.includes('hardwood')) {
        if (iName.includes('hardwood') || iId.includes('hardwood')) return sum + (item.count ?? 1);
      } else if (qName.includes('pipe') || itemId.includes('pipe')) {
        if (iName.includes('pipe') || iId.includes('pipe')) return sum + (item.count ?? 1);
      } else if (qName.includes('scrap metal') || itemId.includes('scrap_metal') || qName.includes('scrap steel')) {
        if ((iName.includes('scrap metal') || iName.includes('scrap steel') || iId.includes('scrap_metal') || iId.includes('scrap_steel') || iId === 'inv_scrap') && !iName.includes('plate') && !iId.includes('plate')) return sum + (item.count ?? 1);
      } else if (qName.includes('scrap wood') || itemId.includes('scrap_wood')) {
        if (iName.includes('scrap wood') || iId.includes('scrap_wood') || iName.includes('twigs')) return sum + (item.count ?? 1);
      } else if (item.id === itemId || iName.includes(qName) || qName.includes(iName)) {
        return sum + (item.count ?? 1);
      }
      return sum;
    }, 0);
  };

  const filteredRecipes = BUILD_RECIPES.filter((r) => {
    if (activeCategory === 'All') return true;
    if (activeCategory === 'Shelter_T1') {
      return (r.id.includes('wall') || r.id.includes('door') || r.id.includes('fence') || r.id.includes('barricade')) && !r.id.includes('stone') && !r.id.includes('steel') && !r.id.includes('concrete');
    }
    if (activeCategory === 'Shelter_T2') {
      return r.id.includes('stone');
    }
    if (activeCategory === 'Shelter_T3') {
      return r.id.includes('steel') || r.id.includes('concrete');
    }
    if (activeCategory === 'Traps') {
      return r.id.includes('trap') || r.id.includes('clay_pit') || r.id.includes('barbed_wire') || r.id.includes('trench') || r.id.includes('acid') || r.id.includes('shredder');
    }
    if (activeCategory === 'Furniture') return r.category === 'Furniture' && r.id !== 'build_workbench_station';
    if (activeCategory === 'Workbench') return r.id === 'build_workbench_station';
    return true;
  }).sort((a, b) => {
    const canAffordA = a.ingredients.every((ing) => getItemCount(ing.itemId, ing.name) >= ing.count);
    const hasEnduranceA = survivor.endurance >= a.enduranceCost;
    const canCraftA = canAffordA && hasEnduranceA;

    const canAffordB = b.ingredients.every((ing) => getItemCount(ing.itemId, ing.name) >= ing.count);
    const hasEnduranceB = survivor.endurance >= b.enduranceCost;
    const canCraftB = canAffordB && hasEnduranceB;

    if (canCraftA && !canCraftB) return -1;
    if (!canCraftA && canCraftB) return 1;
    if (canAffordA && !canAffordB) return -1;
    if (!canAffordA && canCraftB) return 1;
    return 0;
  });

  const simplePlanksCount = survivor.inventory
    .filter((i) => (i.id.includes('plank') || i.name.toLowerCase().includes('plank')) && !i.name.toLowerCase().includes('treated'))
    .reduce((sum, i) => sum + (i.count ?? 1), 0);

  const nailsCount = survivor.inventory
    .filter((i) => i.id.includes('nail') || i.name.toLowerCase().includes('nail'))
    .reduce((sum, i) => sum + (i.count ?? 1), 0);

  const stoneBlocksCount = survivor.inventory
    .filter((i) => i.id.includes('stone') || i.name.toLowerCase().includes('stone'))
    .reduce((sum, i) => sum + (i.count ?? 1), 0);

  const steelPlatesCount = survivor.inventory
    .filter((i) => i.id.includes('steel_plates') || i.name.toLowerCase().includes('steel plate'))
    .reduce((sum, i) => sum + (i.count ?? 1), 0);

  const concreteMixCount = survivor.inventory
    .filter((i) => i.id.includes('concrete') || i.name.toLowerCase().includes('concrete'))
    .reduce((sum, i) => sum + (i.count ?? 1), 0);

  const treatedPlanksCount = survivor.inventory
    .filter((i) => i.id.includes('treated_planks') || i.name.toLowerCase().includes('treated plank'))
    .reduce((sum, i) => sum + (i.count ?? 1), 0);

  const gravelCount = survivor.inventory
    .filter((i) => i.id.includes('gravel') || i.name.toLowerCase().includes('gravel'))
    .reduce((sum, i) => sum + (i.count ?? 1), 0);

  const innerContent = (
    <div
      className={`bg-neutral-900 border-neutral-800 flex flex-col font-mono select-none overflow-hidden ${
        asSidePanel ? 'w-full h-full border-0' : 'border rounded-2xl max-w-3xl w-full max-h-[85vh] shadow-2xl'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Hammer className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold tracking-wider text-neutral-100 uppercase">
              Field Construction Menu
            </h3>
            <p className="text-[10.5px] text-neutral-400">
              Assemble Tier 1 pine structures, Tier 2 stone, Tier 3 steel/concrete fortifications, acid & shredder traps, and workbenches.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          title="Close Build Menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Materials Bar */}
      <div className="px-5 py-2.5 bg-neutral-950/95 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
          Crafting Materials:
        </span>
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-sky-400 font-bold" title="Steel Plates">
            <span>🛡️ Steel Plates:</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                steelPlatesCount > 0 ? 'bg-sky-950/80 border-sky-800 text-sky-200' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
              }`}
            >
              {steelPlatesCount}
            </span>
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-bold" title="Concrete Mix">
            <span>🏗️ Concrete:</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                concreteMixCount > 0 ? 'bg-slate-900/80 border-slate-700 text-slate-200' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
              }`}
            >
              {concreteMixCount}
            </span>
          </span>
          <span className="flex items-center gap-1 text-purple-300 font-bold" title="Treated Planks">
            <span>🪵 Treated Planks:</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                treatedPlanksCount > 0 ? 'bg-purple-950/80 border-purple-800 text-purple-200' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
              }`}
            >
              {treatedPlanksCount}
            </span>
          </span>
          <span className="flex items-center gap-1 text-neutral-300 font-bold" title="Gravel">
            <span>🪨 Gravel:</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                gravelCount > 0 ? 'bg-neutral-800 border-neutral-600 text-neutral-200' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
              }`}
            >
              {gravelCount}
            </span>
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-bold" title="Stone Blocks">
            <span>🧱 Stone:</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                stoneBlocksCount > 0 ? 'bg-slate-900/80 border-slate-700 text-slate-200' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
              }`}
            >
              {stoneBlocksCount}
            </span>
          </span>
          <span className="flex items-center gap-1 text-amber-300 font-bold" title="Simple Wood Planks">
            <span>🪵 Planks:</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                simplePlanksCount > 0 ? 'bg-amber-950/80 border-amber-800 text-amber-200' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
              }`}
            >
              {simplePlanksCount}
            </span>
          </span>
          <span className="flex items-center gap-1 text-indigo-300 font-bold" title="Nails">
            <span>📌 Nails:</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                nailsCount > 0 ? 'bg-indigo-950/80 border-indigo-800 text-indigo-200' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
              }`}
            >
              {nailsCount}
            </span>
          </span>
        </div>
      </div>

      {/* Category Tabs: only walls/fencing, mat/fire, and workbench */}
      <div className="flex items-center gap-2 p-2 bg-neutral-950/60 border-b border-neutral-800 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
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
          const isWorkbenchBlueprint = recipe.id === 'build_workbench_station';

          return (
            <div
              key={recipe.id}
              className={`border rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
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
                    <span className="text-[9px] bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded border border-amber-700 font-bold uppercase">
                      Unlocks Tool Smithing
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal">
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
                        className={`px-2 py-0.5 rounded border font-mono ${
                          isMet
                            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                            : 'bg-red-950/40 border-red-800/60 text-red-400 font-bold'
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
                  type="button"
                  onClick={() => {
                    if (canCraft) {
                      onCraft(recipe);
                      if (recipe.resultItem?.isPlaceable) {
                        onClose();
                      }
                    }
                  }}
                  disabled={!canCraft}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap border cursor-pointer ${
                    canCraft
                      ? isWorkbenchBlueprint
                        ? 'bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold border-amber-500 shadow'
                        : recipe.resultItem?.isPlaceable
                        ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold border-amber-400 shadow'
                        : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-600 shadow'
                      : 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                  }`}
                >
                  {canCraft
                    ? isWorkbenchBlueprint
                      ? 'Construct Workbench'
                      : recipe.resultItem?.isPlaceable
                      ? 'Place on Map'
                      : 'Build / Craft'
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
