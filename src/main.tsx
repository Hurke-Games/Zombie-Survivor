import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Tactical Simulation Exception caught by RootErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center p-6 font-mono selection:bg-amber-500 selection:text-black">
          <div className="max-w-xl w-full bg-neutral-900 border border-amber-600/80 rounded-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold tracking-wider uppercase text-sm border-b border-neutral-800 pb-3">
              <span className="text-xl">⚠️</span>
              <span>Tactical System Anomaly Detected</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              The tactical God-view simulation encountered an unhandled exception during initialization.
            </p>
            {this.state.error && (
              <div className="bg-black/80 border border-neutral-800 rounded p-3 text-[11px] text-red-400 font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded border border-neutral-700 transition-colors"
              >
                Reload Simulation
              </button>
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold rounded transition-colors"
              >
                Clear Local Data & Reboot
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
}
