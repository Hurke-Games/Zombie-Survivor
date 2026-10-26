import React from 'react';
import { NpcSurvivor, Survivor, Item } from '../types/game';
import {
  Package,
  ArrowRight,
  ArrowLeft,
  Shield,
  Sword,
  X,
  Check,
} from 'lucide-react';

interface NpcTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  npc: NpcSurvivor | null;
  survivor: Survivor;
  onTransferToNpc: (npcId: string, item: Item) => void;
  onTransferToPlayer: (npcId: string, item: Item) => void;
  onEquipNpcWeapon: (npcId: string, item: Item) => void;
}

export const NpcTradeModal: React.FC<NpcTradeModalProps> = ({
  isOpen,
  onClose,
  npc,
  survivor,
  onTransferToNpc,
  onTransferToPlayer,
  onEquipNpcWeapon,
}) => {
  if (!isOpen || !npc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none font-mono">
      <div className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
                SURVIVOR SUPPLY TRANSFER // {npc.name.toUpperCase()}
              </h2>
              <p className="text-[10px] text-neutral-400">
                Arm survivor with firearms, melee weapons, ammunition, and survival rations
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

        {/* Content Body: Split Screen */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-800 overflow-y-auto">
          {/* Left Column: Player Backpack */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-cyan-400">
                Your Backpack ({survivor.inventory.length} items)
              </span>
              <span className="text-[10px] text-neutral-500">Click arrow to give</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[48vh] pr-1">
              {survivor.inventory.length === 0 ? (
                <div className="p-6 text-center text-neutral-500 text-xs italic">
                  Backpack is empty.
                </div>
              ) : (
                survivor.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 rounded flex items-center justify-between gap-2 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-neutral-200 text-xs truncate">
                          {item.name}
                        </span>
                        {item.count && item.count > 1 && (
                          <span className="px-1.5 py-0.2 bg-neutral-800 text-[10px] rounded text-neutral-300">
                            x{item.count}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {item.category.toUpperCase()} · {item.weight}kg
                        {item.damage ? ` · Dmg: ${item.damage}` : ''}
                      </p>
                    </div>

                    <button
                      onClick={() => onTransferToNpc(npc.id, item)}
                      title={`Give ${item.name} to ${npc.name}`}
                      className="px-2.5 py-1 bg-amber-600/90 hover:bg-amber-500 text-neutral-950 font-bold rounded text-[10px] uppercase flex items-center gap-1 transition-colors shrink-0 shadow-sm"
                    >
                      <span>Give</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: NPC Survivor Loadout & Inventory */}
          <div className="p-4 flex flex-col gap-3 bg-neutral-950/50">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-amber-400">
                {npc.name}'s Gear ({npc.profession})
              </span>
              <span className="text-[10px] text-neutral-500">Equipped Weapon & Supplies</span>
            </div>

            {/* Currently Equipped Weapon */}
            <div className="p-3 bg-neutral-900 border border-amber-800/60 rounded flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase font-bold text-amber-500 tracking-wider block">
                  Active Weapon
                </span>
                <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5 mt-0.5">
                  <Sword className="w-3.5 h-3.5 text-amber-400" />
                  {npc.equippedWeapon?.name || 'Unarmed / Fists'}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {npc.equippedWeapon?.damage ? `Base Damage: ${npc.equippedWeapon.damage}` : 'Melee combat'}
                </span>
              </div>
            </div>

            {/* NPC Inventory Items */}
            <div className="space-y-2 overflow-y-auto max-h-[38vh] pr-1">
              {npc.inventory.length === 0 ? (
                <div className="p-6 text-center text-neutral-500 text-xs italic">
                  {npc.name} has no carried supplies. Give weapons or rations from your backpack!
                </div>
              ) : (
                npc.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 rounded flex items-center justify-between gap-2 transition-all"
                  >
                    <button
                      onClick={() => onTransferToPlayer(npc.id, item)}
                      title={`Take ${item.name} into your backpack`}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded text-[10px] uppercase flex items-center gap-1 transition-colors shrink-0 border border-neutral-700"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Take</span>
                    </button>

                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-semibold text-neutral-200 text-xs truncate">
                          {item.name}
                        </span>
                        {item.count && item.count > 1 && (
                          <span className="px-1.5 py-0.2 bg-neutral-800 text-[10px] rounded text-neutral-300">
                            x{item.count}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {item.category.toUpperCase()} · {item.weight}kg
                      </p>
                    </div>

                    {item.category === 'weapon' && item.id !== npc.equippedWeapon?.id && (
                      <button
                        onClick={() => onEquipNpcWeapon(npc.id, item)}
                        title={`Equip ${item.name} on ${npc.name}`}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold rounded text-[10px] uppercase transition-colors shrink-0"
                      >
                        Equip
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-neutral-900 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors"
          >
            Done Trading
          </button>
        </div>
      </div>
    </div>
  );
};
