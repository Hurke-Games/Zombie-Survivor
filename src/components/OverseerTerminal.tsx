import React, { useState } from 'react';
import { Radio, Eye, Send, Loader2, Thermometer, Volume2, Shield } from 'lucide-react';

interface OverseerTerminalProps {
  activeLog: string;
  availableActions: { text: string; actionId: string; risk: 'low' | 'moderate' | 'high' | 'extreme' }[];
  isNarrating: boolean;
  onExecuteAction: (directiveText: string, actionId?: string) => void;
  onRefreshNarration: () => void;
  isThermalMode: boolean;
  onToggleThermal: () => void;
  noiseDb: number;
}

export const OverseerTerminal: React.FC<OverseerTerminalProps> = ({
  activeLog,
  availableActions,
  isNarrating,
  onExecuteAction,
  onRefreshNarration,
  isThermalMode,
  onToggleThermal,
  noiseDb,
}) => {
  const [customInput, setCustomInput] = useState('');

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onExecuteAction(customInput.trim());
    setCustomInput('');
  };

  // Convert markdown to scannable formatted sections
  const formatMarkdown = (md: string) => {
    if (!md) return <div className="text-neutral-500 italic">Synchronizing tactical telemetry downlink...</div>;

    const sections = md.split(/(?=####\s)/g);

    return (
      <div className="space-y-4">
        {sections.map((section, sIdx) => {
          const lines = section.trim().split('\n');
          const headerLine = lines[0];
          const contentLines = lines.slice(1);

          let headerColor = 'text-cyan-400';
          if (headerLine.includes('WORLD STATUS')) headerColor = 'text-sky-400 border-sky-900/50';
          if (headerLine.includes('OBSERVATION LOG')) headerColor = 'text-amber-400 border-amber-900/50';
          if (headerLine.includes('VITAL METRICS')) headerColor = 'text-emerald-400 border-emerald-900/50';
          if (headerLine.includes('AVAILABLE ACTIONS')) headerColor = 'text-rose-400 border-rose-900/50';

          return (
            <div key={sIdx} className="bg-neutral-900/70 border border-neutral-800/80 rounded p-3">
              <h4 className={`text-xs font-mono font-bold tracking-wider uppercase border-b pb-1.5 mb-2.5 flex items-center justify-between ${headerColor}`}>
                <span>{headerLine.replace(/####\s*/, '')}</span>
                <span className="text-[10px] text-neutral-600 tracking-normal">OVERSEER // REC-83</span>
              </h4>

              <div className="space-y-1.5 text-xs text-neutral-300 font-mono leading-relaxed">
                {contentLines.map((line, lIdx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;

                  // Render bullet point items
                  if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
                    const cleanText = trimmed.replace(/^[\*\-]\s*/, '');
                    // Bold title extraction
                    const parts = cleanText.split(/(\*\*.*?\*\*)/g);
                    return (
                      <div key={lIdx} className="flex items-start gap-2">
                        <span className="text-neutral-500 select-none">▸</span>
                        <div className="text-neutral-300">
                          {parts.map((part, pIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return (
                                <strong key={pIdx} className="text-neutral-100 font-semibold">
                                  {part.slice(2, -2)}
                                </strong>
                              );
                            }
                            return <span key={pIdx}>{part}</span>;
                          })}
                        </div>
                      </div>
                    );
                  }

                  // Numbered list item
                  if (/^\d+\./.test(trimmed)) {
                    return (
                      <div key={lIdx} className="p-2 bg-neutral-950/60 border border-neutral-800/60 rounded my-1 text-neutral-200">
                        {trimmed}
                      </div>
                    );
                  }

                  // Standard narrative paragraph
                  return (
                    <p key={lIdx} className="text-neutral-300/90 leading-normal text-[12.5px] pb-1">
                      {trimmed}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="w-full h-full flex flex-col bg-neutral-950/95 border-l border-neutral-800 text-neutral-200 relative overflow-hidden">
      {/* Top Header: Satellite Terminal Telemetry */}
      <header className="px-3.5 py-2.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider font-mono text-neutral-100 uppercase">
              Overseer AI // God-View
            </h2>
            <span className="text-[10px] text-neutral-500 font-mono">
              Knox County Satellite Telemetry (Sector 4B)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio decibel detector */}
          <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="tabular-nums">{noiseDb} dB</span>
          </div>

          {/* Thermal Sensor toggle */}
          <button
            onClick={onToggleThermal}
            title="Toggle Drone Thermal FLIR / Satellite Sensor Mode"
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded border transition-colors ${
              isThermalMode
                ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Thermometer className="w-3 h-3" />
            <span>{isThermalMode ? 'FLIR ON' : 'OPTICAL'}</span>
          </button>

          {/* Analyze / Refresh uplink */}
          <button
            onClick={onRefreshNarration}
            disabled={isNarrating}
            title="Request Instant Omniscient Overseer Satellite Scan"
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 rounded border border-neutral-700 transition-colors"
          >
            {isNarrating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Narrative Observation Log Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 font-mono select-text">
        {formatMarkdown(activeLog)}
      </div>

      {/* Interactive High-Stakes Tactical Actions Selection */}
      <div className="p-3 bg-neutral-900/90 border-t border-neutral-800 shrink-0 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-rose-400" /> Tactical Directive Choices:
          </span>
          <span className="text-[10px] text-neutral-500">Click to execute action</span>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {availableActions.map((action, idx) => {
            const riskColors = {
              low: 'border-emerald-800/80 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-200',
              moderate: 'border-amber-800/80 bg-amber-950/20 hover:bg-amber-900/40 text-amber-200',
              high: 'border-rose-800/80 bg-rose-950/20 hover:bg-rose-900/40 text-rose-200',
              extreme: 'border-purple-800/80 bg-purple-950/20 hover:bg-purple-900/40 text-purple-200',
            }[action.risk];

            return (
              <button
                key={idx}
                onClick={() => onExecuteAction(action.text, action.actionId)}
                className={`text-left px-2.5 py-1.5 rounded border text-[11.5px] font-mono transition-all flex items-center justify-between group ${riskColors}`}
              >
                <span className="truncate pr-2">
                  <span className="text-neutral-500 mr-1.5 font-bold">{idx + 1}.</span>
                  {action.text}
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-neutral-900/80 border border-neutral-800 shrink-0">
                  {action.risk}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Tactical Command Input Form */}
        <form onSubmit={handleSubmitCustom} className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Input custom tactical directive..."
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!customInput.trim() || isNarrating}
            className="px-3 py-1.5 bg-cyan-900/80 hover:bg-cyan-800 disabled:opacity-40 text-cyan-200 text-xs font-mono rounded border border-cyan-700 flex items-center gap-1 transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>Transmit</span>
          </button>
        </form>
      </div>
    </aside>
  );
};
