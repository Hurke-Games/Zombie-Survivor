import React, { useState, useEffect } from 'react';
import {
  Skull,
  Play,
  RotateCcw,
  Heart,
  Utensils,
  Droplets,
  AlertTriangle,
  Shield,
  Crosshair,
  Volume2,
  Keyboard,
  Settings,
  BookOpen,
  RotateCw,
} from 'lucide-react';
import { KeyBindings, DEFAULT_KEYBINDINGS, KEYBINDING_LABELS } from '../utils/keybindings';

interface NewGameMenuProps {
  isOpen: boolean;
  isGameOver: boolean;
  deathCause: string | null;
  day: number;
  timeFormatted: string;
  highScoreDays?: number;
  keyBindings?: KeyBindings;
  onUpdateKeyBindings?: (bindings: KeyBindings) => void;
  onStartNewGame: () => void;
  onCancel?: () => void;
  canCancel?: boolean;
}

export const NewGameMenu: React.FC<NewGameMenuProps> = ({
  isOpen,
  isGameOver,
  deathCause,
  day,
  timeFormatted,
  highScoreDays = 1,
  keyBindings = DEFAULT_KEYBINDINGS,
  onUpdateKeyBindings,
  onStartNewGame,
  onCancel,
  canCancel = false,
}) => {
  const [activeTab, setActiveTab] = useState<'briefing' | 'keybinds'>('briefing');
  const [editingKey, setEditingKey] = useState<keyof KeyBindings | null>(null);

  // Keyboard capture when remapping a key
  useEffect(() => {
    if (!editingKey) return;

    const handleRemapKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const pressed = e.key.toLowerCase();
      // Avoid binding Escape or Tab to avoid breaking menu navigation
      if (pressed === 'escape') {
        setEditingKey(null);
        return;
      }

      if (onUpdateKeyBindings) {
        onUpdateKeyBindings({
          ...keyBindings,
          [editingKey]: pressed,
        });
      }
      setEditingKey(null);
    };

    window.addEventListener('keydown', handleRemapKeyDown, true);
    return () => window.removeEventListener('keydown', handleRemapKeyDown, true);
  }, [editingKey, keyBindings, onUpdateKeyBindings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 select-none font-mono">
      {/* Scanline background */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-40" />

      <div className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl overflow-hidden flex flex-col z-10 max-h-[90vh]">
        {/* Top bar header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isGameOver
              ? 'bg-red-950/60 border-red-700/80 text-red-400'
              : 'bg-neutral-900 border-neutral-800 text-cyan-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isGameOver ? <Skull className="w-5 h-5 animate-pulse" /> : <Shield className="w-5 h-5" />}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">
                {isGameOver
                  ? 'BIO-TELEMETRY CRITICAL // SUBJECT DECEASED'
                  : 'ZOMBIE SURVIVOR // TACTICAL SIMULATOR'}
              </h2>
              <p className="text-[10px] text-neutral-400">
                {isGameOver
                  ? 'Vital signs flatlined. Infection containment failed.'
                  : 'Tactical Top-Down Zombie Survival Simulation'}
              </p>
            </div>
          </div>
          {canCancel && onCancel && !isGameOver && (
            <button
              onClick={onCancel}
              className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
            >
              Resume
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-neutral-800 bg-neutral-950 px-5 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('briefing')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === 'briefing'
                ? isGameOver
                  ? 'border-red-400 text-red-400'
                  : 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isGameOver ? 'Casualty Report' : 'Survival Directives'}</span>
          </button>
          <button
            onClick={() => setActiveTab('keybinds')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === 'keybinds'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Key Bindings & Controls</span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-4 text-neutral-300 text-xs overflow-y-auto">
          {isGameOver && activeTab !== 'keybinds' ? (
            /* GAME OVER SCREEN */
            <div className="space-y-4 text-center">
              <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-md space-y-2">
                <span className="text-2xl font-black uppercase text-red-500 tracking-widest block animate-pulse">
                  YOU DIED
                </span>
                <div className="text-xs font-semibold text-neutral-200">
                  Cause of Death:
                </div>
                <div className="text-sm font-bold text-red-400 font-mono">
                  {deathCause || 'Lethal Trauma & Systemic Shock'}
                </div>
              </div>

              {/* Survival Statistics */}
              <div className="grid grid-cols-3 gap-2 text-left">
                <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-[10px] text-neutral-500 uppercase block">Time Survived</span>
                  <span className="text-sm font-bold text-neutral-200">
                    Day {day}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">{timeFormatted}</span>
                </div>
                <div className="p-2.5 bg-amber-950/40 border border-amber-600/70 rounded">
                  <span className="text-[10px] text-amber-400 uppercase font-bold block">
                    🏆 High Score
                  </span>
                  <span className="text-sm font-extrabold text-amber-300">
                    {Math.max(highScoreDays, day)} Days
                  </span>
                  <span className="text-[10px] text-amber-500/80 block">Longest Record</span>
                </div>
                <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-[10px] text-neutral-500 uppercase block">Status</span>
                  <span className="text-sm font-bold text-red-400">
                    Dead
                  </span>
                  <span className="text-[10px] text-neutral-400 block">Critical</span>
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed max-w-md mx-auto">
                In Knox County, death is permanent and unforgiving. Longest days survived is your ultimate record. Start a new game to deploy a fresh survivor into the sector.
              </p>
            </div>
          ) : activeTab === 'keybinds' ? (
            /* KEY BINDINGS SETTINGS SCREEN */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                <div>
                  <h3 className="text-sm font-bold text-neutral-100 uppercase">Custom Key Bindings</h3>
                  <p className="text-[11px] text-neutral-400">
                    Click any key badge below and press your preferred key to rebind. Saved automatically.
                  </p>
                </div>
                {onUpdateKeyBindings && (
                  <button
                    onClick={() => onUpdateKeyBindings(DEFAULT_KEYBINDINGS)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 rounded transition-colors"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                )}
              </div>

              {editingKey && (
                <div className="p-3 bg-cyan-950/80 border border-cyan-500 rounded text-center animate-pulse">
                  <span className="text-cyan-300 font-bold text-xs uppercase">
                    Press any key now to rebind [{KEYBINDING_LABELS[editingKey]?.title}]... (ESC to cancel)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {(Object.keys(DEFAULT_KEYBINDINGS) as (keyof KeyBindings)[]).map((actionKey) => {
                  const meta = KEYBINDING_LABELS[actionKey];
                  const currentBind = (keyBindings[actionKey] || DEFAULT_KEYBINDINGS[actionKey]).toUpperCase();
                  const isBeingEdited = editingKey === actionKey;

                  return (
                    <div
                      key={actionKey}
                      className="p-2.5 bg-neutral-900/80 border border-neutral-800 rounded flex items-center justify-between hover:border-neutral-700 transition-colors"
                    >
                      <div className="pr-2">
                        <div className="font-bold text-neutral-200 text-xs">{meta?.title || actionKey}</div>
                        <div className="text-[10px] text-neutral-400 leading-tight">{meta?.description}</div>
                      </div>

                      <button
                        onClick={() => setEditingKey(actionKey)}
                        className={`min-w-[44px] px-2.5 py-1.5 rounded font-mono font-bold text-xs transition-all shadow-inner shrink-0 ${
                          isBeingEdited
                            ? 'bg-cyan-500 text-neutral-950 border border-cyan-300 animate-pulse'
                            : 'bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-cyan-300 hover:text-white'
                        }`}
                        title={`Click to rebind ${meta?.title}`}
                      >
                        {isBeingEdited ? '...' : currentBind}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="p-2.5 bg-neutral-900/40 border border-neutral-800 rounded text-[11px] text-neutral-400 leading-relaxed">
                <strong className="text-neutral-200">Default Configuration:</strong>
                <br />• <strong>[F]:</strong> Open Doors, Vault Fences, Loot Chests, Cut Trees, Sleep in Bed.
                <br />• <strong>[E]:</strong> Open Equipment & Armor Rig Screen.
                <br />• <strong>[R]:</strong> Repair damaged structures (walls, doors, fences) with Planks & Nails.
                <br />• <strong>[C]:</strong> Talk to & Recruit Survivors.
                <br />• <strong>[H]:</strong> Open Workbench Crafting Table.
              </div>
            </div>
          ) : (
            /* NEW GAME BRIEFING SCREEN */
            <div className="space-y-4">
              {/* High Score Goal Banner */}
              <div className="flex items-center justify-between p-3 bg-amber-950/50 border border-amber-600/70 rounded text-amber-300 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-base">🏆</span>
                  <div>
                    <div className="uppercase tracking-wide text-neutral-100">Primary Goal: Longest Survived Days</div>
                    <div className="text-[10px] text-amber-400 font-normal">Number of days survived is your high score. Endure as long as possible!</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-neutral-400 block font-semibold">High Score</span>
                  <span className="font-mono font-extrabold text-base text-amber-400">{highScoreDays} Days</span>
                </div>
              </div>

              <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-md space-y-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                  Tactical Survival Directives:
                </span>
                <div className="space-y-2 text-[11px] text-neutral-300">
                  <div className="flex items-start gap-2">
                    <Utensils className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-100">30-Minute Hunger Meter:</strong> From full capacity, caloric reserves take ~30 minutes to drain. Scavenge canned rations or cook on a stove. Reaching 0% is fatal.
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Droplets className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-100">10-Minute Thirst Meter:</strong> Hydration takes ~10 minutes to drain from full. Potable water bottles, rainwater collectors, and boiled tap water are vital. Reaching 0% is fatal.
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-100">Health Points:</strong> HP only drops from sustained damage (zombie strikes, bites, bleeding lacerations, or fire). Reaching 0% is fatal.
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Crosshair className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-100">The Romero Horde:</strong> Undead shamblers move at half your normal walking speed. They react to sound, light, and blood smell.
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls Cheatsheet */}
              <div className="p-3 bg-neutral-900/50 border border-neutral-800/80 rounded text-[10px] text-neutral-400 grid grid-cols-2 gap-2">
                <div><strong>WASD:</strong> Movement (Shift = Run)</div>
                <div><strong>Scroll / Wheel:</strong> Cycle Hand Items</div>
                <div><strong>Left Click:</strong> Attack / Shoot / Block</div>
                <div><strong>[-] / [+]:</strong> Zoom View (0.6x - 2.25x)</div>
                <div><strong>[{keyBindings.interact.toUpperCase()}]:</strong> Action / Doors / Vault / Bed</div>
                <div><strong>[{keyBindings.equipment.toUpperCase()}]:</strong> Armor Rig & Equipment</div>
                <div><strong>[{keyBindings.repair.toUpperCase()}]:</strong> Repair Structure</div>
                <div><strong>[{keyBindings.survivor.toUpperCase()}]:</strong> Talk to Survivors</div>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="pt-2">
            <button
              onClick={onStartNewGame}
              className={`w-full py-3 px-4 font-bold rounded uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                isGameOver
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 shadow-cyan-950/50'
              }`}
            >
              {isGameOver ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isGameOver ? 'START NEW GAME' : 'DEPLOY SURVIVOR // START SIMULATION'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

