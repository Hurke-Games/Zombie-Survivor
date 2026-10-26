import React from 'react';
import { NpcSurvivor, NpcTask } from '../types/game';
import {
  UserCheck,
  Shield,
  Hammer,
  Footprints,
  Heart,
  Moon,
  Crosshair,
  Package,
  X,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

interface NpcInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  npc: NpcSurvivor | null;
  onRecruit: (npcId: string) => void;
  onSetTask: (npcId: string, task: NpcTask) => void;
  onOpenTrade: (npc: NpcSurvivor) => void;
}

export const NpcInteractionModal: React.FC<NpcInteractionModalProps> = ({
  isOpen,
  onClose,
  npc,
  onRecruit,
  onSetTask,
  onOpenTrade,
}) => {
  if (!isOpen || !npc) return null;

  const isRecruited = npc.state === 'recruited';

  const tasks: { id: NpcTask; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'follow',
      label: 'Follow Player (Bodyguard)',
      desc: 'Follows behind you and engages any attacking zombies with their weapon.',
      icon: <Footprints className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'patrol',
      label: 'Base Perimeter Patrol',
      desc: 'Guards the safehouse compound, hunting any shamblers approaching the fence line.',
      icon: <Crosshair className="w-4 h-4 text-rose-400" />,
    },
    {
      id: 'maintain',
      label: 'Base Maintenance & Repair',
      desc: 'Inspects base walls, doors, and fences; hammers and repairs any damaged structures back to 100%!',
      icon: <Hammer className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'rest',
      label: 'Rest in Safehouse',
      desc: 'Remains in the base shelter to recover health, stamina, and relieve fatigue.',
      icon: <Moon className="w-4 h-4 text-cyan-400" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none font-mono">
      <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center font-bold text-xs shadow-inner"
              style={{ backgroundColor: `${npc.avatarColor}25`, color: npc.avatarColor }}
            >
              {npc.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
                  {npc.name}
                </h3>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-semibold border"
                  style={{
                    backgroundColor: `${npc.avatarColor}20`,
                    borderColor: `${npc.avatarColor}50`,
                    color: npc.avatarColor,
                  }}
                >
                  {npc.profession}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                {isRecruited ? 'Colony Member · Under Your Command' : 'Stranded Survivor · Needs Assistance'}
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
        <div className="p-5 space-y-4 text-xs text-neutral-300">
          {/* Health & Equipment status */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-900/70 border border-neutral-800 rounded">
            <div>
              <span className="text-[10px] text-neutral-500 uppercase block mb-1">Vital Health</span>
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500/20" />
                <span className="font-bold text-neutral-100 tabular-nums">
                  {Math.round(npc.hp)} / {npc.maxHp} HP
                </span>
              </div>
              <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden mt-1 border border-neutral-800">
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${Math.max(0, (npc.hp / npc.maxHp) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <span className="text-[10px] text-neutral-500 uppercase block mb-1">Equipped Weapon</span>
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold truncate">
                <Shield className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span className="truncate">{npc.equippedWeapon?.name || 'Unarmed'}</span>
              </div>
              <span className="text-[9px] text-neutral-500">
                Inventory: {npc.inventory.length} items
              </span>
            </div>
          </div>

          {/* Dialogue quote */}
          <div className="p-3 bg-neutral-900/40 border border-neutral-800/80 rounded flex items-start gap-2.5">
            <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-neutral-300 italic leading-relaxed">
              "{npc.dialogue}"
            </p>
          </div>

          {!isRecruited ? (
            /* Stranded Recruitment Screen */
            <div className="space-y-3 pt-1">
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/60 rounded text-[11px] text-cyan-200">
                <strong className="text-cyan-300 block mb-0.5">Recruit to Your Safehouse:</strong>
                Offer this survivor sanctuary in your base. Once recruited, you can exchange equipment, arm them with firearms or shields, and order them to patrol or maintain buildings.
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    onRecruit(npc.id);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold rounded uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Offer To Join Colony</span>
                </button>

                <button
                  onClick={() => onOpenTrade(npc)}
                  className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded text-xs flex items-center gap-1.5 border border-neutral-700 transition-colors"
                >
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>Trade Gear</span>
                </button>
              </div>
            </div>
          ) : (
            /* Recruited Task Assignment */
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Assign Base Directive:
                </span>
                <button
                  onClick={() => onOpenTrade(npc)}
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                >
                  <Package className="w-3 h-3" />
                  <span>Give / Take Gear ({npc.inventory.length})</span>
                </button>
              </div>

              <div className="space-y-2">
                {tasks.map((t) => {
                  const isSelected = npc.assignedTask === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSetTask(npc.id, t.id)}
                      className={`p-2.5 rounded border cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-neutral-900 border-cyan-500 text-neutral-100 ring-1 ring-cyan-500/50 shadow-sm'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900/60'
                      }`}
                    >
                      <div className="p-1 rounded bg-neutral-900 border border-neutral-800 shrink-0 mt-0.5">
                        {t.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-neutral-200">{t.label}</span>
                          {isSelected && (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded font-semibold">
                              Active Task
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{t.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-neutral-900 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
          >
            Confirm & Close
          </button>
        </div>
      </div>
    </div>
  );
};
