import React from 'react';
import { NpcSurvivor, NpcTask, WorldStructure, Survivor, HomeBase } from '../types/game';
import {
  Users,
  Footprints,
  Crosshair,
  Hammer,
  Moon,
  Shield,
  Heart,
  Wrench,
  AlertTriangle,
  X,
  Package,
  Home,
} from 'lucide-react';

interface ColonyOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  npcs: NpcSurvivor[];
  structures: WorldStructure[];
  survivor: Survivor;
  onSetTask: (npcId: string, task: NpcTask) => void;
  onOpenTrade: (npc: NpcSurvivor) => void;
  onRepairStructure: (structureId: string) => void;
  homeBase?: HomeBase;
  onSetAsBase?: () => void;
  currentShelter?: { name: string; isInside: boolean; sectorX: number; sectorY: number } | null;
  asSidePanel?: boolean;
}

export const ColonyOverviewModal: React.FC<ColonyOverviewModalProps> = ({
  isOpen,
  onClose,
  npcs,
  structures,
  survivor,
  onSetTask,
  onOpenTrade,
  onRepairStructure,
  homeBase,
  onSetAsBase,
  currentShelter,
  asSidePanel = false,
}) => {
  if (!isOpen) return null;

  const recruitedNpcs = npcs.filter((n) => n.state === 'recruited');

  // Filter damaged base structures
  const damagedStructures = structures.filter((s) => s.hp < s.maxHp);

  // Planks and nails in player inventory
  const playerPlanks =
    survivor.inventory.find((i) => i.id === 'inv_planks' || i.name.toLowerCase().includes('plank'))
      ?.count ?? 0;
  const playerNails =
    survivor.inventory.find((i) => i.id === 'inv_nails' || i.name.toLowerCase().includes('nail'))
      ?.count ?? 0;

  // Beds in current home base sector
  const baseBedsCount = structures.filter(
    (s) =>
      (s.type === 'bed' || s.type === 'sleeping_mat') &&
      homeBase &&
      Math.floor(s.x / 800) === homeBase.sectorX &&
      Math.floor(s.y / 800) === homeBase.sectorY
  ).length;

  const innerContent = (
    <div className={`bg-neutral-950 border-neutral-800 flex flex-col font-mono select-none overflow-hidden ${
      asSidePanel ? 'w-full h-full border-0' : 'relative w-full max-w-4xl border rounded-lg shadow-2xl max-h-[88vh]'
    }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
                SURVIVOR COLONY & BASE FORTIFICATIONS
              </h2>
              <p className="text-[10px] text-neutral-400">
                Manage colony task directives, survivor loadouts, and compound structural repairs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-neutral-300">
          {/* Home Base & Repair Jurisdiction Banner */}
          {homeBase && (
            <div className="p-3 bg-neutral-900/90 border border-emerald-800/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-emerald-950 border border-emerald-600 text-emerald-400 shrink-0">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-100 uppercase tracking-wide">
                      Home Base: {homeBase.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-bold">
                      Sector [{homeBase.sectorX}, {homeBase.sectorY}]
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-[10px] text-neutral-400">
                      Patrol, sleeping, and maintenance are strictly restricted to Sector [{homeBase.sectorX}, {homeBase.sectorY}].
                    </p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      baseBedsCount > 0
                        ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                        : 'bg-amber-950/90 border-amber-600 text-amber-300'
                    }`}>
                      {baseBedsCount > 0
                        ? `🛏️ ${baseBedsCount} Base Bed${baseBedsCount > 1 ? 's' : ''} (Sleep Active)`
                        : '⚠️ No Bed in Base (Survivors cannot sleep)'}
                    </span>
                  </div>
                </div>
              </div>

              {currentShelter && onSetAsBase && (
                <button
                  onClick={onSetAsBase}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded border border-emerald-500 shadow transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Set Current House as Base</span>
                </button>
              )}
            </div>
          )}

          {/* Section 1: Recruited Survivors */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1">
              <span className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Active Recruits ({recruitedNpcs.length})
              </span>
              <span className="text-[10px] text-neutral-500">
                Explore procedural sectors to rescue and recruit more survivors
              </span>
            </div>

            {recruitedNpcs.length === 0 ? (
              <div className="p-6 bg-neutral-900/40 border border-neutral-800 rounded text-center space-y-2">
                <Users className="w-6 h-6 text-neutral-600 mx-auto" />
                <div className="text-neutral-300 font-semibold">NO RECRUITS IN COLONY YET</div>
                <p className="text-[10px] text-neutral-500 max-w-md mx-auto">
                  Explore hardware stores, suburban houses, clinics, and blackwood forests. When you find stranded survivors, interact [E] to offer them sanctuary!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recruitedNpcs.map((npc) => (
                  <div
                    key={npc.id}
                    className="p-3 bg-neutral-900 border border-neutral-800 rounded flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full border border-neutral-700 flex items-center justify-center font-bold text-xs"
                          style={{ backgroundColor: `${npc.avatarColor}25`, color: npc.avatarColor }}
                        >
                          {npc.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-neutral-100 text-xs block">{npc.name}</span>
                          <span
                            className="text-[9px] font-semibold"
                            style={{ color: npc.avatarColor }}
                          >
                            {npc.profession} · {Math.round(npc.hp)} HP
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onOpenTrade(npc)}
                        className="p-1 px-2 bg-neutral-800 hover:bg-neutral-700 rounded text-[10px] text-amber-300 flex items-center gap-1 border border-neutral-700"
                        title="Trade Weapons & Gear"
                      >
                        <Package className="w-3 h-3 text-amber-400" />
                        <span>Gear</span>
                      </button>
                    </div>

                    <div className="text-[10px] text-neutral-400 bg-neutral-950 p-1.5 rounded flex items-center justify-between">
                      <span>Weapon: <strong className="text-neutral-200">{npc.equippedWeapon?.name || 'Unarmed'}</strong></span>
                      <span>Task: <strong className="text-cyan-300 uppercase">{npc.assignedTask}</strong></span>
                    </div>

                    {/* Task Directives Selector */}
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      <button
                        onClick={() => onSetTask(npc.id, 'follow')}
                        className={`p-1 text-[9px] rounded font-semibold flex items-center justify-center gap-1 transition-colors ${
                          npc.assignedTask === 'follow'
                            ? 'bg-emerald-600 text-neutral-950 font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Follow Player"
                      >
                        <Footprints className="w-2.5 h-2.5" />
                        <span>Follow</span>
                      </button>

                      <button
                        onClick={() => onSetTask(npc.id, 'patrol')}
                        className={`p-1 text-[9px] rounded font-semibold flex items-center justify-center gap-1 transition-colors ${
                          npc.assignedTask === 'patrol'
                            ? 'bg-rose-600 text-white font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Base Perimeter Patrol"
                      >
                        <Crosshair className="w-2.5 h-2.5" />
                        <span>Patrol</span>
                      </button>

                      <button
                        onClick={() => onSetTask(npc.id, 'maintain')}
                        className={`p-1 text-[9px] rounded font-semibold flex items-center justify-center gap-1 transition-colors ${
                          npc.assignedTask === 'maintain'
                            ? 'bg-amber-600 text-neutral-950 font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Base Maintenance & Wall Repairs"
                      >
                        <Hammer className="w-2.5 h-2.5" />
                        <span>Repair</span>
                      </button>

                      <button
                        onClick={() => onSetTask(npc.id, 'rest')}
                        className={`p-1 text-[9px] rounded font-semibold flex items-center justify-center gap-1 transition-colors ${
                          npc.assignedTask === 'rest'
                            ? 'bg-cyan-600 text-neutral-950 font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Rest in Safehouse"
                      >
                        <Moon className="w-2.5 h-2.5" />
                        <span>Rest</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Compound Fortifications & Repair System */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1">
              <span className="font-bold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Hammer className="w-4 h-4" />
                Structural Integrity & Repair Queue ({damagedStructures.length} Damaged)
              </span>
              <span className="text-[10px] text-neutral-400">
                Backpack Materials: <strong className="text-amber-300">{playerPlanks} Planks</strong>, <strong className="text-amber-300">{playerNails} Nails</strong>
              </span>
            </div>

            {damagedStructures.length === 0 ? (
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/50 rounded flex items-center gap-3 text-emerald-300 text-xs">
                <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-emerald-200">All Base Fortifications at 100% Integrity</strong>
                  <span>Walls, barricades, and fences are completely intact. Shambler breaching risk minimal.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {damagedStructures.map((struct) => {
                  const damageRatio = (struct.maxHp - struct.hp) / struct.maxHp;
                  const reqPlanks = Math.max(1, Math.ceil((struct.repairPlanks || 2) * damageRatio));
                  const reqNails = Math.max(1, Math.ceil((struct.repairNails || 3) * damageRatio));
                  const canAfford = playerPlanks >= reqPlanks && playerNails >= reqNails;

                  return (
                    <div
                      key={struct.id}
                      className="p-2.5 bg-neutral-900 border border-neutral-800 hover:border-amber-700/60 rounded flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-neutral-200">{struct.name}</span>
                          <span className="text-[10px] text-amber-400 font-bold tabular-nums">
                            {Math.round(struct.hp)} / {struct.maxHp} HP ({Math.round((struct.hp / struct.maxHp) * 100)}%)
                          </span>
                        </div>
                        <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-800">
                          <div
                            className={`h-full ${
                              struct.hp < struct.maxHp * 0.3 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                            }`}
                            style={{ width: `${(struct.hp / struct.maxHp) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          Requires: <strong className={playerPlanks >= reqPlanks ? 'text-neutral-200' : 'text-red-400'}>{reqPlanks} Planks</strong>, <strong className={playerNails >= reqNails ? 'text-neutral-200' : 'text-red-400'}>{reqNails} Nails</strong>
                        </span>

                        <button
                          onClick={() => onRepairStructure(struct.id)}
                          disabled={!canAfford}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase tracking-wider transition-colors shrink-0 shadow-sm ${
                            canAfford
                              ? 'bg-amber-600 hover:bg-amber-500 text-neutral-950 cursor-pointer'
                              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                          }`}
                        >
                          Repair [E]
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-neutral-500 italic">
              Tip: Assign any recruited survivor to <strong>"Base Maintenance & Repair"</strong> and they will automatically walk to damaged structures and patch them up over time!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-neutral-900 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
          >
            Close Overview
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
