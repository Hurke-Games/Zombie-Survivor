import React, { useState } from 'react';
import { SaveSlotData } from '../types/game';
import { Save, FolderOpen, Trash2, X, Clock, ShieldAlert, Heart, Apple, Droplets, Bed, MapPin } from 'lucide-react';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  saveSlots: (SaveSlotData | null)[];
  onSaveSlot: (slotId: number) => boolean;
  onLoadSlot: (slotId: number) => boolean;
  onDeleteSlot: (slotId: number) => void;
  currentDay: number;
  currentTimeFormatted: string;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  onClose,
  saveSlots,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
  currentDay,
  currentTimeFormatted,
}) => {
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<number | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (slotId: number) => {
    const success = onSaveSlot(slotId);
    if (success) {
      setActionNotice(`Successfully saved state to Slot ${slotId}!`);
      setTimeout(() => setActionNotice(null), 2500);
    }
  };

  const handleLoad = (slotId: number) => {
    const success = onLoadSlot(slotId);
    if (success) {
      setActionNotice(`Loaded progression from Slot ${slotId}!`);
      setTimeout(() => {
        setActionNotice(null);
        onClose();
      }, 700);
    }
  };

  const handleDelete = (slotId: number) => {
    onDeleteSlot(slotId);
    setConfirmDeleteSlot(null);
    setActionNotice(`Deleted Slot ${slotId}.`);
    setTimeout(() => setActionNotice(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100 tracking-wide font-mono uppercase">
                Charval County Archives · Save & Load
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                Store up to 3 separate game files directly in your web browser
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action feedback notice */}
        {actionNotice && (
          <div className="px-6 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-xs font-mono text-center animate-pulse">
            {actionNotice}
          </div>
        )}

        {/* Current Game Quick Indicator */}
        <div className="px-6 py-3 bg-neutral-950/40 border-b border-neutral-800/80 flex items-center justify-between text-xs font-mono text-neutral-400">
          <span>Active Game Status:</span>
          <span className="text-amber-400 font-semibold">
            Day {currentDay} · {currentTimeFormatted}
          </span>
        </div>

        {/* 3 Slots List */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {[1, 2, 3].map((slotId) => {
            const slot = saveSlots[slotId - 1];
            const isConfirmingDelete = confirmDeleteSlot === slotId;

            return (
              <div
                key={slotId}
                className={`p-4 rounded-xl border transition-all ${
                  slot
                    ? 'bg-neutral-950/60 border-neutral-700/80 hover:border-amber-500/50'
                    : 'bg-neutral-950/30 border-dashed border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Slot Title & Timestamp */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-800 text-amber-400 border border-neutral-700">
                        SLOT {slotId}
                      </span>
                      {slot ? (
                        <>
                          <span className="text-sm font-semibold text-neutral-200">
                            Day {slot.day} · {slot.timeFormatted}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(slot.savedAt).toLocaleDateString()} {new Date(slot.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-mono text-neutral-500 italic">Empty Slot</span>
                      )}
                    </div>

                    {/* Slot Details (if populated) */}
                    {slot ? (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-neutral-300">
                          <span className="flex items-center gap-1 text-red-400">
                            <Heart className="w-3.5 h-3.5" />
                            {slot.survivorHp}% HP
                          </span>
                          <span className="flex items-center gap-1 text-amber-400">
                            <Apple className="w-3.5 h-3.5" />
                            {slot.survivorHunger}%
                          </span>
                          <span className="flex items-center gap-1 text-cyan-400">
                            <Droplets className="w-3.5 h-3.5" />
                            {slot.survivorThirst}%
                          </span>
                          <span className="flex items-center gap-1 text-purple-400">
                            <Bed className="w-3.5 h-3.5" />
                            {slot.survivorFatigue}%
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800/80 text-[10px] text-neutral-400 border border-neutral-700">
                            {slot.weather}
                          </span>
                        </div>
                        {slot.homeBaseName && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
                            <MapPin className="w-3 h-3 text-amber-500" />
                            <span>Base: {slot.homeBaseName}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500 mt-1 font-mono">
                        Ready to save current playthrough state.
                      </p>
                    )}
                  </div>

                  {/* Slot Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {slot ? (
                      <>
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1.5 bg-red-950/90 border border-red-700 p-1 rounded-lg">
                            <span className="text-[11px] text-red-200 font-mono px-1">Delete?</span>
                            <button
                              onClick={() => handleDelete(slotId)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-mono font-bold"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteSlot(null)}
                              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[11px] font-mono"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleLoad(slotId)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold rounded-lg shadow-sm transition-all active:scale-95"
                              title="Load this saved game"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              Load
                            </button>
                            <button
                              onClick={() => handleSave(slotId)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-mono rounded-lg border border-neutral-700 transition-colors"
                              title="Overwrite this slot with your current game"
                            >
                              <Save className="w-3.5 h-3.5 text-amber-400" />
                              Overwrite
                            </button>
                            <button
                              onClick={() => setConfirmDeleteSlot(slotId)}
                              className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete save file"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleSave(slotId)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-semibold rounded-lg shadow-sm transition-all active:scale-95"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Here
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-500">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-neutral-400" />
            <span>Saves persist in browser storage. Clearing browser cache will wipe saved files.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors text-xs font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
