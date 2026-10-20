import React, { useState, useEffect, useRef } from 'react';
import { useSurvivalGame } from './hooks/useSurvivalGame';
import { SimulationCanvas } from './components/SimulationCanvas';
import { SurvivorHUD } from './components/SurvivorHUD';
import { OverseerTerminal } from './components/OverseerTerminal';
import { BuildMenu } from './components/BuildMenu';
import { WorkbenchCraftModal } from './components/WorkbenchCraftModal';
import { InventoryModal } from './components/InventoryModal';
import { EquipmentModal } from './components/EquipmentModal';
import { HungerMenu } from './components/HungerMenu';
import { ThirstMenu } from './components/ThirstMenu';
import { NewGameMenu } from './components/NewGameMenu';
import { ColonyOverviewModal } from './components/ColonyOverviewModal';
import { NpcInteractionModal } from './components/NpcInteractionModal';
import { NpcTradeModal } from './components/NpcTradeModal';
import { MiniMap } from './components/MiniMap';
import { StorageChestModal } from './components/StorageChestModal';
import { SleepBlackoutOverlay } from './components/SleepBlackoutOverlay';
import { KeyBindings, loadKeyBindings, saveKeyBindings } from './utils/keybindings';
import { soundManager } from './utils/audio';
import {
  Volume2,
  VolumeX,
  Radio,
  HelpCircle,
  X,
  Zap,
  Shield,
  Layers,
  Utensils,
  Droplets,
  RotateCcw,
  Users,
  Maximize,
  Minimize,
  Flame,
  Skull,
  Moon,
  Sun,
  Activity,
  Compass,
  BookOpen,
  Terminal,
  ArrowDown,
  Play,
  Wrench,
  Key,
  CheckCircle2,
  Bed,
  AlertTriangle,
} from 'lucide-react';
import { Item, ActiveHandSlot, ArmorSlot, NpcSurvivor, NpcTask } from './types/game';

export default function App() {
  const {
    survivor,
    setSurvivor,
    zombies,
    structures,
    bloodSplats,
    fires,
    soundEvents,
    noiseHeatmap,
    placementGhost,
    animationEffects,
    isNearWorkbench,
    isNearStove,
    activePrompt,
    environment,
    activeLog,
    availableActions,
    isNarrating,
    systemMessage,
    isGameOver,
    deathCause,
    resetNewGame,
    moveSurvivor,
    handlePrimaryAction,
    cycleActiveSlot,
    equipItem,
    unequipItem,
    startPlacingItem,
    cancelPlacement,
    interactNearby,
    craftRecipe,
    useItem,
    executeTacticalAction,
    toggleFlashlight,
    startSleeping,
    wakeUp,
    sleepBlackout,
    requestOverseerNarration,
    chunks,
    npcs,
    buildings,
    recruitNpc,
    setNpcTask,
    transferToNpc,
    transferToPlayer,
    equipNpcWeapon,
    repairStructure,
    repairNearby,
    interactSurvivor,
    highScoreDays,
    activeChest,
    openChest,
    closeChest,
    storeItemInChest,
    takeItemFromChest,
  } = useSurvivalGame();

  const [keyBindings, setKeyBindings] = useState<KeyBindings>(() => loadKeyBindings());

  const handleUpdateKeyBindings = (newBindings: KeyBindings) => {
    setKeyBindings(newBindings);
    saveKeyBindings(newBindings);
  };

  const [isThermalMode, setIsThermalMode] = useState<boolean>(false);
  const [isHeatmapMode, setIsHeatmapMode] = useState<boolean>(true);
  const [isBuildMenuOpen, setIsBuildMenuOpen] = useState<boolean>(false);
  const [isWorkbenchCraftOpen, setIsWorkbenchCraftOpen] = useState<boolean>(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);
  const [isEquipmentOpen, setIsEquipmentOpen] = useState<boolean>(false);
  const [isHungerMenuOpen, setIsHungerMenuOpen] = useState<boolean>(false);
  const [isThirstMenuOpen, setIsThirstMenuOpen] = useState<boolean>(false);
  const [isColonyOpen, setIsColonyOpen] = useState<boolean>(false);
  const [selectedNpc, setSelectedNpc] = useState<NpcSurvivor | null>(null);
  const [isNpcModalOpen, setIsNpcModalOpen] = useState<boolean>(false);
  const [tradeNpc, setTradeNpc] = useState<NpcSurvivor | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState<boolean>(false);
  const [isNewGameMenuOpen, setIsNewGameMenuOpen] = useState<boolean>(true); // Initial game start menu
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());

  // Embedded Game Viewport Fullscreen Handler (Controlled exclusively via UI button click; no quick key)
  const gameFrameRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (gameFrameRef.current?.requestFullscreen) {
        gameFrameRef.current.requestFullscreen().catch((err) => {
          console.error('Fullscreen request rejected:', err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error('Exit fullscreen error:', err);
        });
      }
    }
  };

  // Direct trigger for workbench interaction
  const handleOpenWorkbench = () => {
    setIsWorkbenchCraftOpen(true);
  };

  const handleOpenNpc = (npc: NpcSurvivor) => {
    setSelectedNpc(npc);
    setIsNpcModalOpen(true);
  };

  const handleOpenTrade = (npc: NpcSurvivor) => {
    setTradeNpc(npc);
    setIsTradeModalOpen(true);
    setIsNpcModalOpen(false);
  };

  const handleStartNewGame = () => {
    resetNewGame();
    setIsNewGameMenuOpen(false);
    setIsHungerMenuOpen(false);
    setIsThirstMenuOpen(false);
    setIsBuildMenuOpen(false);
    setIsWorkbenchCraftOpen(false);
    setIsEquipmentOpen(false);
    setIsInventoryOpen(false);
    setIsColonyOpen(false);
    setIsNpcModalOpen(false);
    setIsTradeModalOpen(false);
    setIsHelpOpen(false);
  };

  // Keyboard controls
  useEffect(() => {
    const keysDown = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (isGameOver) return;

      const key = e.key.toLowerCase();
      keysDown.add(key);

      if (key === keyBindings.interact) {
        // [F] default: Doors, Fences, Looting, Trees, Fruit, Rain Barrels, Bed
        interactNearby(handleOpenWorkbench, openChest);
      } else if (key === keyBindings.equipment) {
        // [E] default: Equipment & Armor Rig Screen
        setIsEquipmentOpen((prev) => !prev);
      } else if (key === keyBindings.repair) {
        // [R] default: Dedicated Repair Action
        repairNearby();
      } else if (key === keyBindings.survivor) {
        // [C] default: Survivor Dialogue, Recruiting & Management
        interactSurvivor(handleOpenNpc);
      } else if (key === keyBindings.build) {
        // [B] default: Field Build Menu
        setIsBuildMenuOpen((prev) => !prev);
      } else if (key === keyBindings.colony) {
        // [K] default: Colony Overview
        setIsColonyOpen((prev) => !prev);
      } else if (key === keyBindings.flashlight) {
        // [G] default: Flashlight
        toggleFlashlight();
      } else if (key === keyBindings.inventory) {
        // [I] default: Backpack Inventory
        setIsInventoryOpen((prev) => !prev);
      } else if (key === keyBindings.hunger) {
        // [U] default: Food Rations Menu
        setIsHungerMenuOpen((prev) => !prev);
      } else if (key === keyBindings.thirst) {
        // [Y] default: Water Hydration Menu
        setIsThirstMenuOpen((prev) => !prev);
      } else if (key === keyBindings.workbench) {
        // [H] default: Workbench Crafting Table
        setIsWorkbenchCraftOpen((prev) => !prev);
      } else if (key === 'tab') {
        e.preventDefault();
        if (isNearWorkbench) {
          setIsWorkbenchCraftOpen((prev) => !prev);
        } else {
          setIsBuildMenuOpen((prev) => !prev);
        }
      } else if (key === 'm') {
        setIsHeatmapMode((prev) => !prev);
      } else if (key === 't') {
        setIsThermalMode((prev) => !prev);
      } else if (key === 'escape') {
        cancelPlacement();
        closeChest();
        setIsHungerMenuOpen(false);
        setIsThirstMenuOpen(false);
        setIsBuildMenuOpen(false);
        setIsWorkbenchCraftOpen(false);
        setIsEquipmentOpen(false);
        setIsInventoryOpen(false);
        setIsColonyOpen(false);
        setIsNpcModalOpen(false);
        setIsTradeModalOpen(false);
        setIsHelpOpen(false);
        if (isNewGameMenuOpen && !isGameOver) {
          setIsNewGameMenuOpen(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Continuous movement loop
    const moveInterval = setInterval(() => {
      if (isNewGameMenuOpen || isGameOver) return;

      let dx = 0;
      let dy = 0;
      if (keysDown.has('w') || keysDown.has('arrowup')) dy -= 1;
      if (keysDown.has('s') || keysDown.has('arrowdown')) dy += 1;
      if (keysDown.has('a') || keysDown.has('arrowleft')) dx -= 1;
      if (keysDown.has('d') || keysDown.has('arrowright')) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const isRunning = keysDown.has('shift');
        const isSneaking = keysDown.has('control');
        moveSurvivor(dx, dy, isRunning, isSneaking);
      }
    }, 30);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveInterval);
    };
  }, [
    cancelPlacement,
    closeChest,
    handleOpenNpc,
    interactNearby,
    interactSurvivor,
    isGameOver,
    isNearWorkbench,
    isNewGameMenuOpen,
    keyBindings,
    moveSurvivor,
    openChest,
    repairNearby,
    toggleFlashlight,
  ]);

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleSelectActiveSlot = (slot: ActiveHandSlot) => {
    soundManager.playTerminalBlip();
    setSurvivor((s) => ({ ...s, activeSlot: slot }));
  };

  const hours = Math.floor(environment.timeMinutes / 60);
  const minutes = environment.timeMinutes % 60;
  const timeFormatted = `${(hours % 12 || 12).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 font-mono flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Website Top Header Bar (Shown when not in fullscreen or for website navigation) */}
      {!isFullscreen && (
        <header className="sticky top-0 z-40 w-full bg-neutral-950/95 border-b border-neutral-800 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center justify-between">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-red-950/80 border border-red-600/80 flex items-center justify-center shadow-lg shadow-red-950/50 shrink-0">
              <Skull className="w-4 h-4 text-red-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black tracking-wider text-neutral-100 uppercase">
                  ZOMBIE SURVIVOR
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/70 text-red-400 border border-red-800 font-bold uppercase hidden sm:inline">
                  v1.4 Web Edition
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 hidden md:block">
                Tactical God-View Survival Simulator · Knox County Outbreak
              </p>
            </div>
          </div>

          {/* Website Navigation Anchors */}
          <nav className="hidden lg:flex items-center gap-5 text-xs text-neutral-400 font-medium">
            <a
              href="#game-viewport"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('game-viewport')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-cyan-400 transition-colors flex items-center gap-1 font-semibold text-neutral-200"
            >
              <Play className="w-3 h-3 text-cyan-400" />
              <span>Simulator</span>
            </a>
            <a
              href="#controls-guide"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('controls-guide')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-cyan-400 transition-colors"
            >
              Controls [H, F, E, R]
            </a>
            <a
              href="#survival-directives"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('survival-directives')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-amber-400 transition-colors"
            >
              Directives
            </a>
            <a
              href="#evolving-horde"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('evolving-horde')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-rose-400 transition-colors"
            >
              Evolving Horde
            </a>
            <a
              href="#colony-base"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('colony-base')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-emerald-400 transition-colors"
            >
              Base Colony
            </a>
          </nav>

          {/* Website Quick Actions & Fullscreen Button */}
          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/40 border border-amber-600/60 rounded text-xs text-amber-300 font-semibold"
              title="High Score: Longest Days Survived Record"
            >
              <span>🏆</span>
              <span>Record: {highScoreDays}d</span>
            </div>

            <button
              onClick={handleToggleMute}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setIsHelpOpen(true)}
              className="px-2.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-colors"
            >
              Manual
            </button>

            {/* Header Fullscreen Button (Button click only; no quick key) */}
            <button
              onClick={handleToggleFullscreen}
              title="Enter Full Screen Mode (Click button to toggle; no quick key)"
              className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow transition-all hover:scale-105 active:scale-95"
            >
              <Maximize className="w-3.5 h-3.5" />
              <span>Full Screen</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Website Body containing the Embedded Game Viewport & Informational Sections */}
      <main className="flex-1 flex flex-col">
        {/* 1. Embedded Game Section */}
        <section id="game-viewport" className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pt-3 pb-6">
          {!isFullscreen && (
            <div className="mb-2 flex flex-wrap items-center justify-between text-[11px] text-neutral-400 px-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-neutral-200 uppercase tracking-wider">
                  EMBEDDED SIMULATION // SECTOR 4
                </span>
                <span className="text-neutral-600">|</span>
                <span className="hidden sm:inline">Use Mouse to Aim/Attack · Scroll Wheel for Holster Slots</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden md:inline text-neutral-500 text-[10px]">
                  Click button to play in full screen
                </span>
                <button
                  onClick={handleToggleFullscreen}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold transition-colors text-xs"
                >
                  <Maximize className="w-3.5 h-3.5" />
                  <span>Full Screen</span>
                </button>
              </div>
            </div>
          )}

          {/* Embedded Game Screen Container Frame */}
          <div
            ref={gameFrameRef}
            className={
              isFullscreen
                ? 'fixed inset-0 w-screen h-screen z-50 flex flex-col bg-neutral-950 text-neutral-200 select-none relative font-mono overflow-hidden'
                : 'w-full h-[760px] xl:h-[820px] flex flex-col bg-neutral-950 text-neutral-200 select-none relative font-mono overflow-hidden rounded-xl border-2 border-neutral-800 shadow-2xl ring-1 ring-cyan-500/20'
            }
          >
            {/* CRT Scanline & Vignette Effect */}
            <div className="absolute inset-0 scanlines pointer-events-none z-30" />
            <div className="absolute inset-0 crt-vignette pointer-events-none z-30" />

            {/* Game Top Bar (Single-row, 3-zone inside the simulator) */}
            <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-neutral-950/95 border-b border-neutral-800 shrink-0 z-40">
              {/* Zone 1: Wordmark & Time */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold tracking-tight text-neutral-100 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ZOMBIE SURVIVOR</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono">
                  <span>Day {environment.day} · {timeFormatted}</span>
                  <span className="text-neutral-500">|</span>
                  <span className="text-amber-400 font-semibold flex items-center gap-1" title="High Score: Longest Days Survived Record">
                    <span>🏆</span>
                    <span>Record: {highScoreDays}d</span>
                  </span>
                  <span className="text-neutral-500">|</span>
                  <span className={environment.isDay ? 'text-amber-400 font-semibold' : 'text-indigo-400 font-semibold'}>
                    {environment.isDay ? '☀️ DAY' : '🌙 NIGHT'} ({environment.cycleRemainingMinutes ?? 35}m)
                  </span>
                </span>
              </div>

              {/* Zone 2: Navigation Links */}
              <nav className="hidden md:flex items-center gap-3 text-xs font-medium text-neutral-400">
                {/* Hunger Rations Menu */}
                <button
                  onClick={() => setIsHungerMenuOpen(true)}
                  className={`transition-colors hover:text-neutral-100 flex items-center gap-1 ${
                    survivor.hunger < 20 ? 'text-red-400 font-bold animate-pulse' : 'text-amber-400'
                  }`}
                  title="Open Hunger & Food Rations Menu [U] (Full to empty in ~30 mins)"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Food [U] ({Math.round(survivor.hunger)}%)</span>
                </button>

                {/* Thirst Hydration Menu */}
                <button
                  onClick={() => setIsThirstMenuOpen(true)}
                  className={`transition-colors hover:text-neutral-100 flex items-center gap-1 ${
                    survivor.thirst < 20 ? 'text-red-400 font-bold animate-pulse' : 'text-cyan-400'
                  }`}
                  title="Open Thirst & Water Hydration Menu [Y] (Full to empty in ~10 mins)"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>Water [Y] ({Math.round(survivor.thirst)}%)</span>
                </button>

                <button
                  onClick={() => setIsBuildMenuOpen(true)}
                  className="transition-colors hover:text-neutral-100 flex items-center gap-1 text-amber-300"
                >
                  <span>Build [B]</span>
                </button>
                <button
                  onClick={() => setIsWorkbenchCraftOpen(true)}
                  className={`transition-colors hover:text-neutral-100 flex items-center gap-1 ${
                    isNearWorkbench ? 'text-cyan-400 font-semibold' : 'text-neutral-400'
                  }`}
                >
                  <span>Bench [{keyBindings.workbench.toUpperCase()}]</span>
                  {isNearWorkbench && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                </button>
                <button
                  onClick={() => setIsEquipmentOpen(true)}
                  className="transition-colors hover:text-neutral-100 flex items-center gap-1 text-emerald-400"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Rig [E]</span>
                </button>
                <button
                  onClick={() => setIsInventoryOpen(true)}
                  className="transition-colors hover:text-neutral-100"
                >
                  Pack [I]
                </button>
                <button
                  onClick={() => setIsColonyOpen(true)}
                  className="transition-colors hover:text-neutral-100 flex items-center gap-1 text-emerald-400 font-semibold"
                  title="Colony Survivors & Base Maintenance [K]"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Colony ({npcs.filter((n) => n.state === 'recruited').length}) [K]</span>
                </button>
                <button
                  onClick={() => setIsNewGameMenuOpen(true)}
                  className="transition-colors hover:text-red-300 text-red-400/90 font-semibold flex items-center gap-1"
                  title="Start or Restart New Game"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="transition-colors hover:text-neutral-100"
                >
                  Manual
                </button>
              </nav>

              {/* Zone 3: Primary Actions & Game Bar Full Screen Button */}
              <div className="flex items-center gap-2">
                {/* Audio Mute */}
                <button
                  onClick={handleToggleMute}
                  title={isMuted ? 'Unmute Audio Ambience & SFX' : 'Mute Audio'}
                  className="p-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                {/* Satellite Scan */}
                <button
                  onClick={() => requestOverseerNarration('Satellite emergency tactical sensor scan requested.')}
                  disabled={isNarrating}
                  className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded transition-colors whitespace-nowrap flex items-center gap-1 shadow"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Scan</span>
                </button>

                {/* Dedicated Full Screen Button on Game Frame (Button click only; no quick key) */}
                <button
                  onClick={handleToggleFullscreen}
                  title={
                    isFullscreen
                      ? 'Exit Full Screen Mode'
                      : 'Enter Full Screen Mode (Click button to toggle; no quick key)'
                  }
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500 rounded transition-all whitespace-nowrap flex items-center gap-1.5 shadow"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Exit Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Full Screen</span>
                    </>
                  )}
                </button>
              </div>
            </header>

      {/* Main Body: Simulation Canvas on Left, Overseer Terminal on Right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left: 64-bit Pixel Art Canvas Simulation with Zoom Controls */}
        <div className="h-full relative overflow-hidden bg-neutral-950 flex-1">
          <SimulationCanvas
            survivor={survivor}
            zombies={zombies}
            npcs={npcs}
            buildings={buildings}
            structures={structures}
            bloodSplats={bloodSplats}
            fires={fires}
            soundEvents={soundEvents}
            noiseHeatmap={noiseHeatmap}
            placementGhost={placementGhost}
            environment={environment}
            activePrompt={activePrompt}
            animationEffects={animationEffects}
            onPrimaryAction={handlePrimaryAction}
            onCancelPlacement={cancelPlacement}
            onCycleActiveSlot={cycleActiveSlot}
            isThermalMode={isThermalMode}
            onToggleThermal={() => setIsThermalMode((prev) => !prev)}
            isHeatmapMode={isHeatmapMode}
            onToggleHeatmap={() => setIsHeatmapMode((prev) => !prev)}
            onToggleFlashlight={toggleFlashlight}
          />

          {/* Mini-Map Radar (Points to Home, tracks zombies, survivors, and structures) */}
          <MiniMap
            survivor={survivor}
            structures={structures}
            zombies={zombies}
            npcs={npcs}
            buildings={buildings}
            homeX={480}
            homeY={360}
          />

          {/* Controls Quick Hint */}
          <div className="absolute top-3 left-3 bg-neutral-950/90 border border-neutral-800/90 rounded px-2.5 py-1.5 text-[10px] text-neutral-300 space-y-0.5 backdrop-blur-xs pointer-events-none z-10 shadow-lg font-mono">
            <div><strong className="text-neutral-100">WASD:</strong> Move · <strong className="text-neutral-100">Scroll:</strong> Hand Item · <strong className="text-cyan-400">[-] / [+]:</strong> Zoom View</div>
            <div><strong className="text-amber-400">[{keyBindings.interact.toUpperCase()}]:</strong> Door / Loot / Tree / Fence Vault / Bed · <strong className="text-cyan-400">[{keyBindings.equipment.toUpperCase()}]:</strong> Equipment Rig</div>
            <div><strong className="text-emerald-400">[{keyBindings.repair.toUpperCase()}]:</strong> Repair · <strong className="text-cyan-300">[{keyBindings.survivor.toUpperCase()}]:</strong> Survivor · <strong className="text-cyan-400">[{keyBindings.workbench.toUpperCase()}]:</strong> Workbench · <strong className="text-amber-300">[{keyBindings.build.toUpperCase()}]:</strong> Build</div>
            <div><strong className="text-amber-400">[{keyBindings.hunger.toUpperCase()}]:</strong> Food · <strong className="text-cyan-400">[{keyBindings.thirst.toUpperCase()}]:</strong> Water · <strong className="text-emerald-400">[{keyBindings.colony.toUpperCase()}]:</strong> Colony · <strong className="text-neutral-300">[{keyBindings.flashlight.toUpperCase()}]:</strong> Flashlight</div>
          </div>

          {/* System Notification Toast */}
          {systemMessage && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/95 border border-amber-600/70 text-amber-200 text-xs px-3.5 py-1.5 rounded shadow-lg animate-fade-in backdrop-blur-md flex items-center gap-2 z-30">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{systemMessage}</span>
            </div>
          )}
        </div>

        {/* Right: Overseer AI God-View Terminal */}
        <div className="w-full lg:w-[480px] xl:w-[520px] h-full flex flex-col shrink-0 z-10 border-t lg:border-t-0 border-neutral-800">
          <OverseerTerminal
            activeLog={activeLog}
            availableActions={availableActions}
            isNarrating={isNarrating}
            onExecuteAction={executeTacticalAction}
            onRefreshNarration={() => requestOverseerNarration()}
            isThermalMode={isThermalMode}
            onToggleThermal={() => setIsThermalMode((prev) => !prev)}
            noiseDb={Math.round(15 + (survivor.isRunning ? 30 : 0))}
          />
        </div>
      </div>

      {/* Bottom Survivor HUD */}
      <SurvivorHUD
        survivor={survivor}
        isNearWorkbench={isNearWorkbench}
        keyBindings={keyBindings}
        onOpenBuild={() => setIsBuildMenuOpen(true)}
        onOpenWorkbenchCraft={() => setIsWorkbenchCraftOpen(true)}
        onOpenInventory={() => setIsInventoryOpen(true)}
        onOpenEquipment={() => setIsEquipmentOpen(true)}
        onOpenHunger={() => setIsHungerMenuOpen(true)}
        onOpenThirst={() => setIsThirstMenuOpen(true)}
        onOpenColony={() => setIsColonyOpen(true)}
        recruitedCount={npcs.filter((n) => n.state === 'recruited').length}
        onSelectActiveSlot={handleSelectActiveSlot}
        onToggleFlashlight={toggleFlashlight}
        onInteract={() => interactNearby(handleOpenWorkbench, openChest)}
      />

      {/* 1. Field Build Menu (Tools, Weapons, Walls, Sleeping Mat, Fire, Workbench) */}
      <BuildMenu
        isOpen={isBuildMenuOpen}
        onClose={() => setIsBuildMenuOpen(false)}
        survivor={survivor}
        onCraft={craftRecipe}
      />

      {/* 2. Workbench Exclusive Crafting (Firearms, Spiked Bat, Wall Plating, Cot Beds, Stoves) */}
      <WorkbenchCraftModal
        isOpen={isWorkbenchCraftOpen}
        onClose={() => setIsWorkbenchCraftOpen(false)}
        survivor={survivor}
        isNearWorkbench={isNearWorkbench}
        onCraft={craftRecipe}
      />

      {/* 3. Dedicated Equipment & Armor Rig Screen */}
      <EquipmentModal
        isOpen={isEquipmentOpen}
        onClose={() => setIsEquipmentOpen(false)}
        survivor={survivor}
        onEquipItem={equipItem}
        onUnequipItem={unequipItem}
        onSelectActiveSlot={handleSelectActiveSlot}
      />

      {/* 4. Backpack Inventory Modal (with Place Structure integration) */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        survivor={survivor}
        onUseItem={useItem}
        onEquipWeapon={(item) => equipItem(item, 'weapon1')}
        onEquipTool={(item) => equipItem(item, 'tool')}
        onStartPlacing={startPlacingItem}
        onOpenEquipment={() => setIsEquipmentOpen(true)}
      />

      {/* 5. Separate Hunger & Caloric Reserves Menu */}
      <HungerMenu
        isOpen={isHungerMenuOpen}
        onClose={() => setIsHungerMenuOpen(false)}
        survivor={survivor}
        onEatFood={useItem}
        isNearStove={isNearStove}
      />

      {/* 6. Separate Thirst & Hydration Menu */}
      <ThirstMenu
        isOpen={isThirstMenuOpen}
        onClose={() => setIsThirstMenuOpen(false)}
        survivor={survivor}
        onDrinkWater={useItem}
        waterGridActive={environment.waterGrid}
        day={environment.day}
      />

      {/* 7. Survivor Colony & Base Fortifications Overview */}
      <ColonyOverviewModal
        isOpen={isColonyOpen}
        onClose={() => setIsColonyOpen(false)}
        npcs={npcs}
        structures={structures}
        survivor={survivor}
        onSetTask={setNpcTask}
        onOpenTrade={handleOpenTrade}
        onRepairStructure={repairStructure}
      />

      {/* 8. Stranded / Recruited NPC Interaction & Dialogue Modal */}
      <NpcInteractionModal
        isOpen={isNpcModalOpen}
        onClose={() => setIsNpcModalOpen(false)}
        npc={selectedNpc}
        onRecruit={recruitNpc}
        onSetTask={setNpcTask}
        onOpenTrade={handleOpenTrade}
      />

      {/* 9. NPC Supply Transfer & Weapon Arming Modal */}
      <NpcTradeModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        npc={tradeNpc}
        survivor={survivor}
        onTransferToNpc={transferToNpc}
        onTransferToPlayer={transferToPlayer}
        onEquipNpcWeapon={equipNpcWeapon}
      />

      {/* 10. Colony Storage Chest Modal (Deposit/Withdraw Food, Drinks, Supplies) */}
      <StorageChestModal
        isOpen={!!activeChest}
        onClose={closeChest}
        chest={activeChest}
        survivor={survivor}
        onStoreItem={storeItemInChest}
        onTakeItem={takeItemFromChest}
      />

      {/* 11. New Game / Start Game & Game Over Menu */}
      <NewGameMenu
        isOpen={isNewGameMenuOpen || isGameOver}
        isGameOver={isGameOver}
        deathCause={deathCause}
        day={environment.day}
        timeFormatted={timeFormatted}
        highScoreDays={highScoreDays}
        keyBindings={keyBindings}
        onUpdateKeyBindings={handleUpdateKeyBindings}
        onStartNewGame={handleStartNewGame}
        onCancel={() => setIsNewGameMenuOpen(false)}
        canCancel={!isGameOver}
      />

      {/* Field Guide Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-mono">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2 text-neutral-100">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Zombie Survivor // Field Survival Manual
                </h3>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
              <p>
                <strong className="text-cyan-400">1. Separate Hunger & Thirst Rations:</strong>
                <br />• <strong>Hunger [U]:</strong> Full capacity drains in ~30 minutes. Eat canned rations or cook stews. Reaching 0% causes fatal starvation.
                <br />• <strong>Thirst [Y]:</strong> Full capacity drains in ~10 minutes. Drink water bottles or soda. Reaching 0% causes fatal dehydration.
                <br />• <strong>Health (HP):</strong> HP only goes down from sustained physical damage (zombie strikes, bites, bleeding). Reaching 0% is fatal.
              </p>
              <p>
                <strong className="text-emerald-400">2. Sleeping & Stamina Recovery:</strong> Stamina naturally regenerates when standing still or walking. Interact <strong className="text-neutral-100">[F]</strong> with a cot bed or sleeping mat to sleep through the night, clearing fatigue, panic, and waking at daybreak! If you stay awake past exhaustion, consciousness slips with 5 minutes to find a bed before collapsing.
              </p>
              <p>
                <strong className="text-amber-400">3. Field Build vs Workbench Crafting:</strong>
                <br />• <strong>Field Build [B]:</strong> Build crude hand tools, weapons, simple walls, sleeping mats, campfires, and workbenches anywhere.
                <br />• <strong>Workbench [H]:</strong> Open workbench carpentry, metalworking, firearms, and ammunition reloading crafting table!
              </p>
              <p>
                <strong className="text-rose-400">4. Combat & Weapon Controls:</strong>
                <br />• <strong>Melee Weapon:</strong> Left-click swings and strikes.
                <br />• <strong>Gun (e.g. Pipe Shotgun):</strong> Left-click fires high-damage buckshot rounds (consumes shells, high noise!).
                <br />• <strong>Shield:</strong> Left-click raises defensive guard, mitigating damage and blocking bites!
                <br />• <strong>Mouse Scroll Wheel:</strong> Quickly cycles between Weapon 1, Backup Weapon 2, and Tool 1.
              </p>
              <p>
                <strong className="text-indigo-400">5. Tactical Camera Zoom:</strong> Click the <strong className="text-neutral-100">[-]</strong> and <strong className="text-neutral-100">[+]</strong> buttons on the canvas to zoom between wide tactical overview (0.6x) and close combat (2.25x).
              </p>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded border border-neutral-700 transition-colors"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen Blackout Overlay during Sleep & Collapse */}
      <SleepBlackoutOverlay
        sleepBlackout={sleepBlackout}
        isConsciousnessSlipping={survivor.isConsciousnessSlipping}
        consciousnessCountdown={survivor.consciousnessSlippingTimer}
      />
    </div>
        </section>

        {/* Website Content Sections (Visible when scrolling page below the embedded simulator) */}
        {!isFullscreen && (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 pb-16">
            {/* Section 1: Tactical Controls & Custom Keybindings Reference */}
            <section id="controls-guide" className="pt-4 border-t border-neutral-800/80">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-3">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <Key className="w-3.5 h-3.5" />
                    <span>Combat & World Keybindings Reference</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase text-neutral-100 tracking-tight">
                    Tactical Field Controls
                  </h2>
                </div>
                <p className="text-xs text-neutral-400 max-w-md">
                  All keys can also be fully rebound in the <strong className="text-cyan-300">New Game Menu / Key Bindings</strong> tab.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Workbench [H] */}
                <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg hover:border-cyan-500/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-200">Workbench Crafting</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500 text-cyan-300 font-mono font-extrabold text-xs">
                      [{keyBindings.workbench.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Open advanced carpentry, firearms smithing, ammo reloading, and heavy barricades crafting table.
                  </p>
                </div>

                {/* Interact [F] */}
                <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg hover:border-amber-500/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-200">World Interact</span>
                    <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500 text-amber-300 font-mono font-extrabold text-xs">
                      [{keyBindings.interact.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Open/close doors, jump fences, loot containers & trunks, cut trees, sleep in beds, and drink from rain barrels.
                  </p>
                </div>

                {/* Equipment Rig [E] */}
                <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg hover:border-emerald-500/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-200">Armor & Gear Rig</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-mono font-extrabold text-xs">
                      [{keyBindings.equipment.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Access tactical body armor slots (Head, Chest, Legs, Boots) and bite-defense scratch mitigation rig.
                  </p>
                </div>

                {/* Repair [R] */}
                <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg hover:border-rose-500/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-200">Repair Structure</span>
                    <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-500 text-rose-300 font-mono font-extrabold text-xs">
                      [{keyBindings.repair.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Dedicated repair action for zombie-damaged timber walls, doors, and wire barricades using wood planks & nails.
                  </p>
                </div>

                {/* Survivor [C] */}
                <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg hover:border-cyan-500/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-200">Survivor Dialogue</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-600 text-cyan-300 font-mono font-extrabold text-xs">
                      [{keyBindings.survivor.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Interact with stranded or allied survivors to recruit, trade supplies, arm them with weapons, and assign tasks.
                  </p>
                </div>

                {/* Field Build [B] */}
                <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg hover:border-amber-500/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-200">Field Build Menu</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-600 text-amber-300 font-mono font-extrabold text-xs">
                      [{keyBindings.build.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Craft deployable wooden walls, campfires, sleeping mats, and workbenches anywhere in Knox County.
                  </p>
                </div>

                {/* Food Rations [U] */}
                <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg hover:border-amber-500/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-200">Food Rations</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-600 text-amber-300 font-mono font-extrabold text-xs">
                      [{keyBindings.hunger.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Full caloric capacity drains across ~30 minutes. Eat canned food or cooked soup. Reaching 0% is fatal.
                  </p>
                </div>

                {/* Water Hydration [Y] */}
                <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg hover:border-cyan-500/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-200">Water Hydration</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-600 text-cyan-300 font-mono font-extrabold text-xs">
                      [{keyBindings.thirst.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Full hydration capacity drains across ~10 minutes. Drink bottled water or boil rainwater. Reaching 0% is fatal.
                  </p>
                </div>
              </div>

              {/* Movement & Combat Quick Row */}
              <div className="mt-4 p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-200">Omnidirectional Movement:</span>
                  <span className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono">WASD</span>
                  <span className="text-neutral-500">|</span>
                  <span className="text-neutral-400">Hold <strong className="text-neutral-200">Shift</strong> to Sprint · Hold <strong className="text-neutral-200">Ctrl</strong> to Sneak</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-200">Combat & Holsters:</span>
                  <span className="text-neutral-400"><strong className="text-neutral-200">Left Click:</strong> Attack/Shoot/Block · <strong className="text-neutral-200">Scroll Wheel:</strong> Cycle W1/W2/Tool</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-200">Tactical Zoom:</span>
                  <span className="text-neutral-400">Click <strong className="text-neutral-200">[-]</strong> / <strong className="text-neutral-200">[+]</strong> buttons on simulation canvas (0.6x - 2.25x)</span>
                </div>
              </div>
            </section>

            {/* Section 2: Survival Directives & Sleep Blackout Systems */}
            <section id="survival-directives" className="pt-4 border-t border-neutral-800/80">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Bed className="w-3.5 h-3.5" />
                <span>Rest, Exhaustion & Nightfall Protocols</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-neutral-100 tracking-tight mb-6">
                Sleep Blackouts & Consciousness Mechanics
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-lg space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 border border-cyan-500/60 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-cyan-300" />
                  </div>
                  <h3 className="font-bold text-base text-neutral-200 uppercase">
                    1. Shelter Sleep & Nightfall Blackout
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Whenever you interact <strong className="text-cyan-300">[F]</strong> with a bed or cot, your vision fades into total darkness. Night safely passes in shelter, restoring endurance and clearing fatigue, before you awaken at bright 07:00 AM dawn.
                  </p>
                </div>

                <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-lg space-y-3">
                  <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-500/60 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="font-bold text-base text-neutral-200 uppercase">
                    2. Consciousness Slipping (5-Min Grace)
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Staying awake past 95% fatigue causes tunnel vision and starts a critical 5-minute countdown. If you fail to reach a bed before the timer expires, you collapse unconscious on the spot until the next morning.
                  </p>
                </div>

                <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-lg space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-950/80 border border-amber-500/60 flex items-center justify-center">
                    <Skull className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="font-bold text-base text-neutral-200 uppercase">
                    3. Outdoor Collapse & 30% Infection Risk
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    If you collapse outside without four walls or fortified fencing around you, there is a dangerous <strong className="text-red-400">30% probability</strong> of waking up bitten and infected, leading to rapid death. Always return to a shelter before dark.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3: The Evolving Undead Mutation */}
            <section id="evolving-horde" className="pt-4 border-t border-neutral-800/80">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Skull className="w-3.5 h-3.5" />
                <span>Compounding Horde Adaptation</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-neutral-100 tracking-tight mb-4">
                The Undead Are Evolving
              </h2>
              <div className="p-6 bg-gradient-to-r from-red-950/40 via-neutral-900/60 to-neutral-950 border border-red-900/60 rounded-xl space-y-3">
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Every night that passes and every sunrise that breaks, the Knox County infected secretly mutate and adapt. Shamblers compound in speed and flesh density each dawn. If you pass out from exhaustion without sleeping safely in bed, the horde compounds even faster during that night.
                </p>
                <div className="pt-2 flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <span>🗣️</span>
                  <span>Recruited party members will periodically vocalize their dread every 5th day as they witness the horde adapting.</span>
                </div>
              </div>
            </section>

            {/* Section 4: Safehouse Fortification & Base Colony */}
            <section id="colony-base" className="pt-4 border-t border-neutral-800/80">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Base Fortification & Colony Command</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-neutral-100 tracking-tight mb-6">
                Colony Survival & Fortifications
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-lg space-y-2.5">
                  <h3 className="font-bold text-sm text-emerald-300 uppercase">
                    Safehouse Engineering & Carpentry
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Build timber walls, repair broken doors using planks and nails, and deploy rain collector barrels to catch clean water during storms. Deploy workbenches <strong className="text-neutral-200">[H]</strong> inside to craft firearms and reinforce perimeters.
                  </p>
                </div>

                <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-lg space-y-2.5">
                  <h3 className="font-bold text-sm text-emerald-300 uppercase">
                    Allied Survivor Management [K]
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Rescue wanderers across Knox County. Arm them with pipe shotguns and crowbars, assign them to forage food or stand guard at your gates, and deposit surplus supplies into shared Colony Storage Chests.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Website Footer */}
      {!isFullscreen && (
        <footer className="w-full bg-neutral-950 border-t border-neutral-800/80 py-6 px-4 sm:px-8 text-neutral-500 text-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <span className="font-bold text-neutral-300 uppercase tracking-wider">
                Zombie Survivor
              </span>
              <span className="mx-2 text-neutral-700">|</span>
              <span>Tactical God-View Survival Simulator Web Edition</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-amber-400/90 font-mono font-semibold">
                🏆 Longest Survived: {highScoreDays} Days
              </span>
              <span className="text-neutral-700">·</span>
              <button
                onClick={handleToggleFullscreen}
                className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
              >
                Full Screen Mode
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
