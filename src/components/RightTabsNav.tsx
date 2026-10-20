import React from 'react';
import { Survivor } from '../types/game';
import { KeyBindings } from '../utils/keybindings';
import {
  Utensils,
  Droplets,
  Backpack,
  Hammer,
  Wrench,
  Shield,
  Users,
  ChevronRight,
  X,
} from 'lucide-react';

export type RightTabType = 'food' | 'water' | 'pack' | 'rig' | 'build' | 'bench' | 'colony';

interface RightTabsNavProps {
  activeTab: RightTabType | null;
  onToggleTab: (tab: RightTabType) => void;
  onClose: () => void;
  survivor: Survivor;
  isNearWorkbench: boolean;
  recruitedCount: number;
  totalDefense: number;
  keyBindings: KeyBindings;
  children?: React.ReactNode;
}

export const RightTabsNav: React.FC<RightTabsNavProps> = ({
  activeTab,
  onToggleTab,
  onClose,
  survivor,
  isNearWorkbench,
  recruitedCount,
  totalDefense,
  keyBindings,
  children,
}) => {
  const tabs: {
    id: RightTabType;
    label: string;
    key: string;
    icon: React.ReactNode;
    metric: string;
    activeBorder: string;
    activeText: string;
    isAlert?: boolean;
    hasIndicator?: boolean;
  }[] = [
    {
      id: 'food',
      label: 'Food',
      key: keyBindings.hunger.toUpperCase(),
      icon: (
        <Utensils
          className={`w-3.5 h-3.5 ${
            survivor.hunger < 20 ? 'text-red-400 animate-pulse' : 'text-amber-400'
          }`}
        />
      ),
      metric: `${Math.round(survivor.hunger)}%`,
      activeBorder: 'border-l-amber-500 ring-amber-500/30 text-amber-300',
      activeText: 'text-amber-300',
      isAlert: survivor.hunger < 20,
    },
    {
      id: 'water',
      label: 'Water',
      key: keyBindings.thirst.toUpperCase(),
      icon: (
        <Droplets
          className={`w-3.5 h-3.5 ${
            survivor.thirst < 20 ? 'text-red-400 animate-pulse' : 'text-cyan-400'
          }`}
        />
      ),
      metric: `${Math.round(survivor.thirst)}%`,
      activeBorder: 'border-l-cyan-500 ring-cyan-500/30 text-cyan-300',
      activeText: 'text-cyan-300',
      isAlert: survivor.thirst < 20,
    },
    {
      id: 'pack',
      label: 'Pack',
      key: keyBindings.inventory.toUpperCase(),
      icon: <Backpack className="w-3.5 h-3.5 text-cyan-400" />,
      metric: `${survivor.inventory.length} Item`,
      activeBorder: 'border-l-cyan-400 ring-cyan-400/30 text-cyan-200',
      activeText: 'text-cyan-300',
    },
    {
      id: 'rig',
      label: 'Rig',
      key: keyBindings.equipment.toUpperCase(),
      icon: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
      metric: `+${totalDefense}%`,
      activeBorder: 'border-l-emerald-500 ring-emerald-500/30 text-emerald-300',
      activeText: 'text-emerald-300',
    },
    {
      id: 'build',
      label: 'Build',
      key: keyBindings.build.toUpperCase(),
      icon: <Hammer className="w-3.5 h-3.5 text-amber-300" />,
      metric: 'Field',
      activeBorder: 'border-l-amber-400 ring-amber-400/30 text-amber-200',
      activeText: 'text-amber-300',
    },
    {
      id: 'bench',
      label: 'Bench',
      key: keyBindings.workbench.toUpperCase(),
      icon: <Wrench className="w-3.5 h-3.5 text-cyan-400" />,
      metric: isNearWorkbench ? 'Ready' : 'Craft',
      activeBorder: 'border-l-cyan-400 ring-cyan-400/30 text-cyan-200',
      activeText: 'text-cyan-300',
      hasIndicator: isNearWorkbench,
    },
    {
      id: 'colony',
      label: 'Colony',
      key: keyBindings.colony.toUpperCase(),
      icon: <Users className="w-3.5 h-3.5 text-emerald-400" />,
      metric: `${recruitedCount} Npc`,
      activeBorder: 'border-l-emerald-400 ring-emerald-400/30 text-emerald-200',
      activeText: 'text-emerald-300',
    },
  ];

  return (
    <>
      {/* Popped-out side panel (Appears to the left of the tabs when a tab is selected) */}
      {activeTab && (
        <>
          {/* Subtle backdrop overlay for closing when clicking back onto the canvas */}
          <div
            onClick={onClose}
            className="absolute inset-0 z-25 bg-black/40 backdrop-blur-[2px] transition-opacity"
            title="Click to pop back into game view"
          />

          <aside className="absolute top-0 bottom-0 right-[76px] sm:right-[84px] z-30 w-[360px] sm:w-[450px] md:w-[490px] lg:w-[530px] max-w-[calc(100%-90px)] bg-neutral-950/98 border-l border-y border-neutral-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-150">
            {children}
          </aside>
        </>
      )}

      {/* Little Tabs strip on the right side of the screen (positioned below the radar so it remains fully visible) */}
      <nav
        aria-label="Tactical Survival Quick Tabs"
        className="absolute top-[248px] right-0 z-40 flex flex-col gap-1.5 select-none font-mono pointer-events-auto max-h-[calc(100%-255px)] overflow-y-auto"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onToggleTab(tab.id)}
              className={`group relative flex items-center gap-2 pl-2.5 pr-2 py-2 rounded-l-lg border-l-2 border-y border-r-0 shadow-xl backdrop-blur-md transition-all duration-150 text-xs ${
                isActive
                  ? `bg-neutral-900 ${tab.activeBorder} -translate-x-1 shadow-cyan-500/10 ring-1`
                  : 'bg-neutral-950/90 hover:bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-100 hover:-translate-x-0.5'
              }`}
              title={`${tab.label} Menu [${tab.key}] - Click to pop ${
                isActive ? 'back in' : 'out'
              }`}
            >
              <div className="relative flex items-center justify-center shrink-0">
                {tab.icon}
                {tab.hasIndicator && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
                {tab.isAlert && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                )}
              </div>

              <div className="flex flex-col items-start leading-none text-left">
                <div className="flex items-center gap-1">
                  <span
                    className={`font-bold text-[11px] ${
                      isActive ? tab.activeText : 'text-neutral-200 group-hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-900 text-neutral-400 font-bold border border-neutral-800 group-hover:border-neutral-700">
                    {tab.key}
                  </span>
                </div>
                <span
                  className={`text-[9.5px] font-mono mt-0.5 ${
                    tab.isAlert
                      ? 'text-red-400 font-bold'
                      : isActive
                      ? 'text-neutral-300'
                      : 'text-neutral-500'
                  }`}
                >
                  {tab.metric}
                </span>
              </div>

              {isActive && (
                <div className="ml-0.5 text-neutral-500 group-hover:text-neutral-300">
                  <X className="w-3 h-3" />
                </div>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
