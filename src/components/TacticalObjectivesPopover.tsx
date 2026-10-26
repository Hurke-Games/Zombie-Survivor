import React, { useState, useRef, useEffect } from 'react';
import { Target, X, Send, RotateCcw, Shield, Check, Loader2 } from 'lucide-react';

interface TacticalObjectivesPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  availableActions: { text: string; actionId: string; risk: 'low' | 'moderate' | 'high' | 'extreme' }[];
  onExecuteAction: (directiveText: string, actionId?: string) => void;
  onRefreshDirectives: () => void;
  isNarrating: boolean;
}

export const TacticalObjectivesPopover: React.FC<TacticalObjectivesPopoverProps> = ({
  isOpen,
  onClose,
  availableActions,
  onExecuteAction,
  onRefreshDirectives,
  isNarrating,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Delay adding click listener slightly to prevent immediate closure on toggle click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onExecuteAction(customInput.trim());
    setLastExecuted(customInput.trim());
    setCustomInput('');
  };

  const handleActionClick = (actionText: string, actionId?: string) => {
    setLastExecuted(actionText);
    onExecuteAction(actionText, actionId);
  };

  const riskBadgeStyles = {
    low: 'border-emerald-600/70 bg-emerald-950/50 text-emerald-300',
    moderate: 'border-amber-600/70 bg-amber-950/50 text-amber-300',
    high: 'border-rose-600/70 bg-rose-950/50 text-rose-300',
    extreme: 'border-purple-600/70 bg-purple-950/50 text-purple-300',
  };

  return (
    <div
      ref={popoverRef}
      className="absolute top-14 right-3 sm:right-5 z-50 w-[330px] sm:w-[420px] max-h-[calc(100vh-140px)] flex flex-col bg-neutral-950/95 border-2 border-cyan-500/70 rounded-xl shadow-2xl backdrop-blur-md font-mono text-neutral-200 overflow-hidden ring-1 ring-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Popover Header */}
      <div className="px-3.5 py-2.5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-100 flex items-center gap-1.5">
              <span>Tactical Objectives</span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800">
                {availableActions.length} ACTIVE
              </span>
            </h3>
            <p className="text-[10px] text-neutral-400">Click directive to execute priority order</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh / Re-evaluate Directives Button */}
          <button
            onClick={onRefreshDirectives}
            disabled={isNarrating}
            title="Scan & Refresh Tactical Directive Choices"
            className="p-1.5 text-neutral-400 hover:text-cyan-300 bg-neutral-800/80 hover:bg-neutral-800 rounded border border-neutral-700/80 transition-colors disabled:opacity-40"
          >
            {isNarrating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close Popover */}
          <button
            onClick={onClose}
            title="Close Objectives Popover"
            className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded border border-neutral-700/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Directives List */}
      <div className="p-3 space-y-2 overflow-y-auto max-h-[340px]">
        {availableActions.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-400 bg-neutral-900/40 rounded border border-neutral-800/80 space-y-2">
            <p>No active tactical directives synchronized.</p>
            <button
              onClick={onRefreshDirectives}
              className="px-3 py-1 bg-cyan-900/60 hover:bg-cyan-900 text-cyan-300 rounded border border-cyan-700 text-xs font-semibold"
            >
              Scan Sector & Generate Objectives
            </button>
          </div>
        ) : (
          availableActions.map((action, idx) => {
            const isJustExecuted = lastExecuted === action.text;
            const badgeClass = riskBadgeStyles[action.risk] || riskBadgeStyles.low;

            return (
              <button
                key={idx}
                onClick={() => handleActionClick(action.text, action.actionId)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs font-mono transition-all flex items-start justify-between gap-2 group ${
                  isJustExecuted
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 ring-1 ring-emerald-500/50'
                    : 'border-neutral-800/90 bg-neutral-900/70 hover:bg-neutral-850 hover:border-cyan-500/60 text-neutral-200'
                }`}
              >
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-[11px] font-bold text-cyan-400 px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800 shrink-0">
                    {idx + 1}
                  </span>
                  <div className="space-y-0.5">
                    <span className="font-medium text-neutral-100 group-hover:text-cyan-200 transition-colors leading-snug">
                      {action.text}
                    </span>
                    {isJustExecuted && (
                      <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Transmitted & Executing...
                      </div>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${badgeClass}`}
                >
                  {action.risk}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Custom Tactical Command Input Form */}
      <div className="p-3 bg-neutral-900/90 border-t border-neutral-800 shrink-0 space-y-2">
        <form onSubmit={handleSubmitCustom} className="flex items-center gap-1.5">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type custom tactical order..."
            className="flex-1 bg-neutral-950 border border-neutral-700/80 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!customInput.trim() || isNarrating}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-neutral-950 text-xs font-bold rounded flex items-center gap-1 transition-colors shrink-0"
          >
            <Send className="w-3 h-3" />
            <span>Send</span>
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-neutral-500">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-cyan-400" /> Sector 4B Command
          </span>
          <span>Click Objectives to close</span>
        </div>
      </div>
    </div>
  );
};
