import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Survivor,
  Zombie,
  WorldStructure,
  BloodSplat,
  FireEmitter,
  SoundEvent,
  EnvironmentState,
  InteractablePrompt,
  PlacementGhost,
  VisualAnimationEffect,
  NpcSurvivor,
  getDayNightInfo,
} from '../types/game';
import {
  Volume2,
  Thermometer,
  Flashlight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sun,
  Moon,
  Home,
} from 'lucide-react';

interface SimulationCanvasProps {
  survivor: Survivor;
  zombies: Zombie[];
  structures: WorldStructure[];
  bloodSplats: BloodSplat[];
  fires?: FireEmitter[];
  soundEvents: SoundEvent[];
  noiseHeatmap: number[][];
  placementGhost: PlacementGhost | null;
  environment: EnvironmentState;
  activePrompt: InteractablePrompt | null;
  animationEffects: VisualAnimationEffect[];
  npcs?: NpcSurvivor[];
  buildings?: import('../types/game').BuildingBounds[];
  speechBubble?: import('../types/game').SpeechBubble | null;
  onPrimaryAction: (x: number, y: number) => void;
  onSecondaryAction?: (x: number, y: number) => void;
  onCancelPlacement: () => void;
  onRotatePlacement?: () => void;
  onCycleActiveSlot: (delta: number) => void;
  isThermalMode: boolean;
  onToggleThermal: () => void;
  isHeatmapMode: boolean;
  onToggleHeatmap: () => void;
  onToggleFlashlight: () => void;
  currentShelter?: { name: string; isInside: boolean; sectorX: number; sectorY: number } | null;
  onSetAsBase?: () => void;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  survivor,
  zombies,
  structures,
  bloodSplats,
  soundEvents,
  noiseHeatmap,
  placementGhost,
  environment,
  activePrompt,
  animationEffects,
  npcs = [],
  buildings = [],
  speechBubble = null,
  onPrimaryAction,
  onSecondaryAction,
  onCancelPlacement,
  onRotatePlacement,
  onCycleActiveSlot,
  isThermalMode,
  onToggleThermal,
  isHeatmapMode,
  onToggleHeatmap,
  onToggleFlashlight,
  currentShelter,
  onSetAsBase,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 480, y: 360 });
  const [zoom, setZoom] = useState<number>(1.0); // Zoom level from 0.5x to 2.5x

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const survivorRef = useRef(survivor);
  survivorRef.current = survivor;

  // Zoom helpers
  const handleZoomIn = () => {
    setZoom((z) => Math.min(2.25, Math.round((z + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.6, Math.round((z - 0.25) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoom(1.0);
  };

  // Keyboard shortcut listener for Zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === '=' || e.key === '+' || e.key === ']') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_' || e.key === '[') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute camera center in world coordinates based on zoom
  const getCameraOffset = useCallback((currentZoom: number, surv: Survivor) => {
    const isFarFromOrigin = Math.abs(surv.x - 480) > 380 || Math.abs(surv.y - 300) > 280;
    if (currentZoom <= 1.0 && !isFarFromOrigin) {
      // At zoom <= 1.0 near safehouse base, blend towards (480, 300)
      const t = Math.max(0, Math.min(1, (1.0 - currentZoom) / 0.4));
      return {
        camX: surv.x * (1 - t) + 480 * t,
        camY: surv.y * (1 - t) + 300 * t,
      };
    }
    // When exploring or zoomed in, smoothly follow survivor everywhere
    return {
      camX: surv.x,
      camY: surv.y,
    };
  }, []);

  // Screen mouse coordinates to world coordinates translation
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 480, y: 360 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const screenX = (clientX - rect.left) * scaleX;
      const screenY = (clientY - rect.top) * scaleY;

      const currentZoom = zoomRef.current;
      const { camX, camY } = getCameraOffset(currentZoom, survivorRef.current);

      const worldX = (screenX - canvas.width / 2) / currentZoom + camX;
      const worldY = (screenY - canvas.height / 2) / currentZoom + camY;
      return { x: worldX, y: worldY };
    },
    [getCameraOffset]
  );

  // Handle canvas mouse clicks
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    onPrimaryAction(x, y);
  };

  // Right-click: cancels placement if placing, otherwise triggers secondary action (looting, workbench, kitchen, doors, dismantling)
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (placementGhost) {
      onCancelPlacement();
      return;
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    onSecondaryAction?.(x, y);
  };

  // Scroll wheel: Ctrl+Wheel zooms in/out, placementGhost active rotates 90 degrees, normal Wheel cycles Hand slots (W1, W2, Tool)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    } else if (placementGhost) {
      e.preventDefault();
      onRotatePlacement?.();
    } else {
      onCycleActiveSlot(e.deltaY > 0 ? 1 : -1);
    }
  };

  const [isHoveringInteractable, setIsHoveringInteractable] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    setMousePos({ x, y });

    // Check if directly hovering over interactable NPC or structure
    const overNpc = npcs.some((n) => Math.hypot(n.x - x, n.y - y) <= 22);
    const overStructure = structures.some((s) => {
      const isInteractable =
        s.type === 'door_wood' ||
        s.type === 'door_stone' ||
        s.type === 'door_steel' ||
        s.type === 'abandoned_car' ||
        s.type === 'riverbed_clay' ||
        s.type === 'wall_brick' ||
        s.type === 'utility_pole' ||
        s.type === 'home_foundation' ||
        s.type === 'bank_vault' ||
        s.type === 'boulder_rock' ||
        s.type === 'ground_scrap_wood' ||
        s.type === 'loot_container' ||
        s.type === 'workbench' ||
        s.type === 'kitchen_stove' ||
        s.type === 'campfire' ||
        s.type === 'bed' ||
        s.type === 'sleeping_mat' ||
        s.type === 'rain_collector' ||
        (s.type === 'fruit_bush' && (s.fruitCount ?? 0) > 0);
      if (!isInteractable) return false;
      return (
        x >= s.x - 5 &&
        x <= s.x + s.width + 5 &&
        y >= s.y - 5 &&
        y <= s.y + s.height + 5
      );
    });

    setIsHoveringInteractable(overNpc || overStructure);
  };

  // Main canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const now = Date.now();

      // Clear letterbox background
      ctx.fillStyle = '#0a0d0f';
      ctx.fillRect(0, 0, width, height);

      // Camera transformation
      const { camX, camY } = getCameraOffset(zoom, survivor);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

      // Day/Night Cycle calculation for environment visual state
      const dayNight = getDayNightInfo(environment.cycleSeconds ?? 360);
      const isDaytime = dayNight.isDay;

      // 1. Terrain Background: Draw visible procedural sectors with clear daylight grass and road
      const halfW = (width / 2) / zoom;
      const halfH = (height / 2) / zoom;
      const minChunkX = Math.floor((camX - halfW) / 800) - 1;
      const maxChunkX = Math.floor((camX + halfW) / 800) + 1;
      const minChunkY = Math.floor((camY - halfH) / 800) - 1;
      const maxChunkY = Math.floor((camY + halfH) / 800) + 1;

      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        for (let cy = minChunkY; cy <= maxChunkY; cy++) {
          const bx = cx * 800;
          const by = cy * 800;
          const isBase = cx === 0 && cy === 0;

          // Clear, vibrant daylight grass vs nocturnal dark grass
          if (isThermalMode) {
            ctx.fillStyle = '#070b0e';
          } else if (isDaytime) {
            ctx.fillStyle = isBase ? '#4d7c38' : '#467433'; // Vibrant, bright sunlit Kentucky daylight green
          } else {
            ctx.fillStyle = isBase ? '#121b12' : '#0b140c'; // Nocturnal pitch dark green
          }
          ctx.fillRect(bx, by, 800, 800);

          // Daylight grassy texture tufts
          if (isDaytime && !isThermalMode) {
            ctx.fillStyle = '#598b3e';
            ctx.fillRect(bx + 120, by + 180, 24, 6);
            ctx.fillRect(bx + 420, by + 130, 28, 6);
            ctx.fillRect(bx + 640, by + 480, 22, 6);
            ctx.fillRect(bx + 260, by + 680, 30, 6);
          }

          // Sector grid line
          ctx.strokeStyle = isThermalMode ? '#15222b' : isDaytime ? '#5c8f42' : '#1a2618';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, 800, 800);

          // Sector Coordinates Kicker
          ctx.fillStyle = isThermalMode ? '#1e303d' : isDaytime ? '#6fa850' : '#22331d';
          ctx.font = '9px "Share Tech Mono", monospace';
          ctx.fillText(`SECTOR [${cx}, ${cy}]`, bx + 14, by + 18);
        }
      }

      // Base Sector 4B Road (around origin 0..960): Clear daylight asphalt vs night road
      ctx.fillStyle = isThermalMode ? '#10171d' : isDaytime ? '#47515d' : '#192026';
      ctx.fillRect(0, 0, 960, 120);
      ctx.fillRect(0, 600 - 90, 960, 90);

      // Road dash lines
      ctx.strokeStyle = isThermalMode ? '#2a3a48' : isDaytime ? '#facc15' : '#474c3e';
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 16]);
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.lineTo(960, 60);
      ctx.moveTo(0, 600 - 45);
      ctx.lineTo(960, 600 - 45);
      ctx.stroke();
      ctx.setLineDash([]);

      // 1b. Procedural Buildings & Interiors: Render floors for all buildings in world
      buildings.forEach((b) => {
        // Concrete foundation & sidewalk apron around building
        ctx.fillStyle = isThermalMode ? '#141e26' : isDaytime ? '#64748b' : '#27313d';
        ctx.fillRect(b.x - 8, b.y - 8, b.width + 16, b.height + 16);

        const nameLower = b.name.toLowerCase();
        const isClinic = nameLower.includes('clinic') || nameLower.includes('medical');
        const isGrocery = nameLower.includes('grocery') || nameLower.includes('market');
        const isIndustrial = nameLower.includes('hardware') || nameLower.includes('armory') || nameLower.includes('police');

        if (isClinic) {
          // Sterile medical turquoise floor with tile grid
          ctx.fillStyle = isThermalMode ? '#0c242e' : isDaytime ? '#0891b2' : '#0e4250';
          ctx.fillRect(b.x, b.y, b.width, b.height);
          ctx.strokeStyle = isDaytime ? '#06b6d4' : '#155e75';
          ctx.lineWidth = 1;
          for (let ty = b.y + 24; ty < b.y + b.height; ty += 24) {
            ctx.beginPath();
            ctx.moveTo(b.x, ty);
            ctx.lineTo(b.x + b.width, ty);
            ctx.stroke();
          }
        } else if (isGrocery) {
          // Supermarket tiled floor
          ctx.fillStyle = isThermalMode ? '#1e293b' : isDaytime ? '#cbd5e1' : '#334155';
          ctx.fillRect(b.x, b.y, b.width, b.height);
          ctx.strokeStyle = isDaytime ? '#94a3b8' : '#1e293b';
          ctx.lineWidth = 1;
          for (let tx = b.x + 30; tx < b.x + b.width; tx += 30) {
            ctx.beginPath();
            ctx.moveTo(tx, b.y);
            ctx.lineTo(tx, b.y + b.height);
            ctx.stroke();
          }
        } else if (isIndustrial) {
          // Polished concrete slab with safety yellow accents
          ctx.fillStyle = isThermalMode ? '#192530' : isDaytime ? '#334155' : '#1e293b';
          ctx.fillRect(b.x, b.y, b.width, b.height);
          ctx.strokeStyle = isDaytime ? '#475569' : '#0f172a';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(b.x + 6, b.y + 6, b.width - 12, b.height - 12);
        } else {
          // Warm timber floorboards for houses, safehouses & residential cabins
          ctx.fillStyle = isThermalMode ? '#1c2d38' : isDaytime ? '#785638' : '#3d2c1d';
          ctx.fillRect(b.x, b.y, b.width, b.height);
          ctx.strokeStyle = isThermalMode ? '#243b48' : isDaytime ? '#5c3f26' : '#271c12';
          ctx.lineWidth = 1;
          for (let py = b.y + 14; py < b.y + b.height; py += 14) {
            ctx.beginPath();
            ctx.moveTo(b.x, py);
            ctx.lineTo(b.x + b.width, py);
            ctx.stroke();
          }
        }

        // Welcome mat at doorway
        ctx.fillStyle = isThermalMode ? '#15222b' : isDaytime ? '#b45309' : '#451a03';
        ctx.fillRect(b.x + b.width / 2 - 25, b.y + b.height - 14, 50, 10);

        // Building Label Plaque
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = isThermalMode ? '#00f0ff' : isDaytime ? '#f8fafc' : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(`[ ${b.name.toUpperCase()} ]`, b.x + b.width / 2, b.y + 16);
      });

      // Directional Sun Cast Shadows in daytime for all solid structures
      if (isDaytime && !isThermalMode) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'; // Soft ambient sunlight shadow
        structures.forEach((s) => {
          if (s.type === 'tree') {
            ctx.beginPath();
            ctx.ellipse(s.x + 18 + 8, s.y + 18 + 12, 22, 14, 0.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (s.type.includes('wall') || s.type.includes('fence') || s.type === 'loot_container') {
            ctx.fillRect(s.x + 6, s.y + s.height, s.width, 8);
          }
        });
        ctx.restore();
      }

      // 2. Blood Splatters on Ground
      bloodSplats.forEach((splat) => {
        ctx.fillStyle = isThermalMode ? '#5c1010' : '#4a0808';
        ctx.beginPath();
        ctx.arc(splat.x, splat.y, splat.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isThermalMode ? '#8a1a1a' : '#6b1111';
        ctx.beginPath();
        ctx.arc(splat.x + splat.radius * 0.4, splat.y - splat.radius * 0.3, splat.radius * 0.3, 0, Math.PI * 2);
        ctx.arc(splat.x - splat.radius * 0.5, splat.y + splat.radius * 0.4, splat.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Structures (Walls, barricades, doors, beds, workbenches, stoves, trees, containers)
      structures.forEach((s) => {
        if (s.type === 'wall_wood' || s.type === 'wall_wood_reinforced' || s.type === 'wall_wood_crude') {
          const isReinforced = s.type === 'wall_wood_reinforced';
          const isCrude = s.type === 'wall_wood_crude';
          ctx.fillStyle = isThermalMode ? '#283b48' : isReinforced ? '#475569' : isCrude ? '#5c4832' : '#4a3d2b';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#3c586c' : isReinforced ? '#64748b' : isCrude ? '#3d2f1f' : '#2d2317';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          if (isReinforced) {
            // Steel riveted plate bands
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(s.x, s.y + s.height / 2 - 2, s.width, 4);
            for (let px = s.x + 6; px < s.x + s.width; px += 18) {
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(px, s.y + s.height / 2 - 1, 2, 2);
            }
          } else if (isCrude) {
            // Crude tree logs
            ctx.fillStyle = '#3a2b1c';
            for (let px = s.x + 4; px < s.x + s.width - 2; px += 14) {
              ctx.fillRect(px, s.y + 2, 3, s.height - 4);
            }
          } else {
            ctx.fillStyle = isThermalMode ? '#1d2b35' : '#33291d';
            for (let px = s.x + 8; px < s.x + s.width - 4; px += 24) {
              ctx.fillRect(px, s.y + 2, 2, s.height - 4);
            }
          }

          // Hammer dismantling demolition progress indicator (takes 5 clicks to tear down)
          if (s.dismantleHits && s.dismantleHits > 0) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            // Demolition crack marks
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(s.x + 3, s.y + 2);
            ctx.lineTo(s.x + s.width * 0.45, s.y + s.height * 0.65);
            ctx.lineTo(s.x + s.width - 3, s.y + s.height - 2);
            ctx.stroke();
            // Pips for clicks landed
            for (let i = 0; i < s.dismantleHits; i++) {
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(s.x + 3 + i * 5, s.y - 4, 3, 3);
            }
          }
        } else if (s.type === 'barricade_window') {
          ctx.fillStyle = isThermalMode ? '#1c2c36' : '#2a3b4c';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.fillStyle = isThermalMode ? '#49677e' : '#735c3d';
          ctx.fillRect(s.x - 2, s.y + 4, s.width + 4, 8);
          ctx.fillRect(s.x - 2, s.y + 20, s.width + 4, 8);
          ctx.fillRect(s.x - 2, s.y + 36, s.width + 4, 8);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(s.x + 1, s.y + 6, 2, 2);
          ctx.fillRect(s.x + s.width - 3, s.y + 22, 2, 2);
        } else if (s.type === 'door_wood') {
          const isHorizontal = s.width >= s.height;
          if (s.isOpen) {
            // Open door threshold frame
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            if (isHorizontal) {
              // Horizontal door: swung open upwards from left hinge
              const panelLen = Math.max(20, s.width - 4);
              const panelThick = Math.min(s.height, 12);
              ctx.fillStyle = isThermalMode ? '#283b48' : '#55422f';
              ctx.fillRect(s.x, s.y - panelLen, panelThick, panelLen);
              ctx.strokeStyle = isThermalMode ? '#3c586c' : '#2d2317';
              ctx.strokeRect(s.x, s.y - panelLen, panelThick, panelLen);

              // Brass door knob / handle
              ctx.fillStyle = '#f59e0b';
              ctx.fillRect(s.x + panelThick - 3, s.y - panelLen * 0.5, 3, 4);
            } else {
              // Vertical door (sideways): swung open to the right from top hinge
              const panelLen = Math.max(20, s.height - 4);
              const panelThick = Math.min(s.width, 12);
              ctx.fillStyle = isThermalMode ? '#283b48' : '#55422f';
              ctx.fillRect(s.x + s.width, s.y, panelLen, panelThick);
              ctx.strokeStyle = isThermalMode ? '#3c586c' : '#2d2317';
              ctx.strokeRect(s.x + s.width, s.y, panelLen, panelThick);

              // Brass door knob / handle
              ctx.fillStyle = '#f59e0b';
              ctx.fillRect(s.x + s.width + panelLen * 0.5, s.y + panelThick - 3, 4, 3);
            }
          } else {
            // Closed door
            ctx.fillStyle = isThermalMode ? '#3f596d' : '#685038';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            ctx.strokeStyle = isThermalMode ? '#1e293b' : '#2c1e13';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            if (isHorizontal) {
              // Horizontal slide bolt
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(s.x + s.width / 2 - 10, s.y + s.height / 2 - 2, 20, 4);
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(s.x + s.width / 2 - 2, s.y + s.height / 2 - 4, 4, 8);
            } else {
              // Vertical slide bolt (for sideways placed door)
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(s.x + s.width / 2 - 2, s.y + s.height / 2 - 10, 4, 20);
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(s.x + s.width / 2 - 4, s.y + s.height / 2 - 2, 8, 4);
            }
          }
        } else if (s.type === 'sleeping_mat') {
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#475569';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = '#334155';
          ctx.strokeRect(s.x, s.y, s.width, s.height);
          ctx.fillStyle = isThermalMode ? '#334155' : '#64748b';
          ctx.fillRect(s.x + 4, s.y + 4, s.width - 8, 8);
        } else if (s.type === 'bed') {
          ctx.fillStyle = isThermalMode ? '#22323e' : '#423325';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.fillStyle = isThermalMode ? '#3b5467' : '#57626d';
          ctx.fillRect(s.x + 4, s.y + 4, s.width - 8, s.height - 8);
          ctx.fillStyle = isThermalMode ? '#587b95' : '#88929b';
          ctx.fillRect(s.x + 8, s.y + 6, s.width - 16, 14);
        } else if (s.type === 'workbench') {
          ctx.fillStyle = isThermalMode ? '#314757' : '#54422e';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#4b6579' : '#302417';
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(s.x + 4, s.y + 4, 8, 8); // Vise
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(s.x + 18, s.y + 12, 16, 12); // Blueprint
          ctx.fillStyle = '#64748b';
          ctx.fillRect(s.x + 38, s.y + 6, 4, 14);
        } else if (s.type === 'kitchen_stove') {
          ctx.fillStyle = isThermalMode ? '#1a2730' : '#27272a';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(s.x + s.width / 2, s.y + s.height / 2, 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.type === 'table_chair') {
          ctx.fillStyle = isThermalMode ? '#2e4352' : '#52402e';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.fillStyle = isThermalMode ? '#22323e' : '#3a2d20';
          ctx.fillRect(s.x + s.width / 2 - 8, s.y + s.height + 4, 16, 12);
        } else if (s.type === 'campfire') {
          ctx.fillStyle = '#451a03';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(s.x + s.width / 2, s.y + s.height / 2, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(s.x + s.width / 2, s.y + s.height / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.type === 'tree') {
          ctx.fillStyle = isThermalMode ? '#1b2a33' : '#3a2717';
          ctx.fillRect(s.x + 14, s.y + 14, 8, 8);
          ctx.fillStyle = isThermalMode ? '#243b48' : '#1e3321';
          ctx.beginPath();
          ctx.arc(s.x + 18, s.y + 18, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = isThermalMode ? '#2f4c5e' : '#29432c';
          ctx.beginPath();
          ctx.arc(s.x + 18, s.y + 18, 11, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.type === 'fence_wood') {
          // Weathered wood picket fence
          ctx.fillStyle = isThermalMode ? '#283b48' : '#5c4a35';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#3c586c' : '#3d3020';
          ctx.lineWidth = 1;
          ctx.strokeRect(s.x, s.y, s.width, s.height);
          // Pickets
          ctx.fillStyle = isThermalMode ? '#3a4e5d' : '#856d4f';
          const step = Math.max(8, Math.min(14, s.width / 4));
          for (let px = s.x + 3; px < s.x + s.width - 2; px += step) {
            ctx.fillRect(px, s.y - 2, 3, s.height + 4);
          }
        } else if (s.type === 'fence_wire') {
          // Chainlink & steel wire fence
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#334155';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(s.x, s.y, s.width, s.height);
          // Posts
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(s.x, s.y - 3, 4, s.height + 6);
          ctx.fillRect(s.x + s.width - 4, s.y - 3, 4, s.height + 6);
        } else if (s.type === 'fruit_bush') {
          // Harvestable Fruit & Berry Bush
          ctx.fillStyle = isThermalMode ? '#143026' : '#274e22';
          ctx.beginPath();
          ctx.arc(s.x + s.width / 2, s.y + s.height / 2, s.width / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isThermalMode ? '#1f483a' : '#1c3a18';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Ripe fruit berries
          if ((s.fruitCount ?? 0) > 0) {
            ctx.fillStyle = s.fruitType?.toLowerCase().includes('apple') ? '#ef4444' : '#a855f7';
            const fOffsets = [
              { dx: -5, dy: -4 },
              { dx: 4, dy: -5 },
              { dx: 0, dy: 5 },
            ];
            for (let fi = 0; fi < Math.min(3, s.fruitCount || 0); fi++) {
              ctx.beginPath();
              ctx.arc(s.x + s.width / 2 + fOffsets[fi].dx, s.y + s.height / 2 + fOffsets[fi].dy, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (s.type === 'rain_collector') {
          // Circular oak rain barrel with iron bands and water level
          const bx = s.x + s.width / 2;
          const by = s.y + s.height / 2;
          const br = s.width / 2;

          // Outer barrel staves
          ctx.fillStyle = isThermalMode ? '#283b48' : '#6b4f32';
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();

          // Iron rim & bands
          ctx.strokeStyle = isThermalMode ? '#475569' : '#334155';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Water pool inside barrel
          const waterRatio = Math.min(1.0, (s.waterStored || 0) / (s.maxWater || 50));
          const waterRadius = Math.max(2, (br - 4) * Math.sqrt(Math.max(0.08, waterRatio)));

          if ((s.waterStored || 0) > 0) {
            ctx.fillStyle = isThermalMode ? '#0ea5e9' : 'rgba(14, 165, 233, 0.85)';
            ctx.beginPath();
            ctx.arc(bx, by, waterRadius, 0, Math.PI * 2);
            ctx.fill();

            // Water ripple reflection
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(bx, by, Math.max(1, waterRadius - 3), -0.6, 0.6);
            ctx.stroke();
          }

          // Water level badge
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(`${s.waterStored || 0}/50`, bx, by + br + 8);
        } else if (s.type === 'loot_container') {
          const isToolBox = s.name.toLowerCase().includes('tool box') || s.name.toLowerCase().includes('toolbox');
          const isChest = s.name.toLowerCase().includes('chest');
          if (isToolBox) {
            // Heavy Red Steel Mechanic's Tool Box
            ctx.fillStyle = isThermalMode ? '#3f5060' : '#b91c1c';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            // Lid bevel & top latch line
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(s.x + 2, s.y + 2, s.width - 4, 4);

            // Metal top handle
            ctx.fillStyle = '#64748b';
            ctx.fillRect(s.x + s.width / 2 - 6, s.y - 2, 12, 3);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(s.x + s.width / 2 - 4, s.y - 3, 8, 2);

            // Dual chrome clasps
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(s.x + 4, s.y + 4, 3, 5);
            ctx.fillRect(s.x + s.width - 7, s.y + 4, 3, 5);

            // "TOOLS" stencil label
            ctx.font = 'bold 7px monospace';
            ctx.fillStyle = '#fde047';
            ctx.textAlign = 'center';
            ctx.fillText('TOOL BOX', s.x + s.width / 2, s.y + s.height - 3);
          } else if (isChest) {
            // Wood storage chest with brass corner brackets
            ctx.fillStyle = isThermalMode ? '#3c5364' : '#78350f';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            // Brass latch & iron straps
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(s.x + s.width / 2 - 3, s.y + s.height / 2 - 2, 6, 4);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(s.x + 4, s.y, 3, s.height);
            ctx.fillRect(s.x + s.width - 7, s.y, 3, s.height);

            // "CHEST" label
            ctx.font = 'bold 7px monospace';
            ctx.fillStyle = '#fbbf24';
            ctx.textAlign = 'center';
            ctx.fillText('CHEST', s.x + s.width / 2, s.y - 3);
          } else {
            ctx.fillStyle = isThermalMode ? '#3c5364' : '#454c54';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            ctx.strokeStyle = '#27272a';
            ctx.lineWidth = 1;
            ctx.strokeRect(s.x, s.y, s.width, s.height);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(s.x + s.width / 2 - 2, s.y + s.height / 2 - 1, 4, 3);
          }
        } else if (s.type === 'ground_scrap_wood') {
          // Weathered scrap wood timber boards lying on the ground (harvestable resource)
          ctx.save();
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;
          ctx.translate(cx, cy);

          // Subtle glowing ground ring indicator for pickup visibility
          const pulse = (Math.sin(now * 0.005) + 1) * 0.5;
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.35 + pulse * 0.4})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.stroke();

          // Plank 1 (angled)
          ctx.save();
          ctx.rotate(-0.25);
          ctx.fillStyle = isThermalMode ? '#334155' : '#854d0e';
          ctx.fillRect(-12, -4, 24, 7);
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 1;
          ctx.strokeRect(-12, -4, 24, 7);
          // Grain & nail mark
          ctx.fillStyle = '#a16207';
          ctx.fillRect(-8, -2, 16, 1.5);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-10, -1, 1.5, 1.5);
          ctx.fillRect(8, -1, 1.5, 1.5);
          ctx.restore();

          // Plank 2 (overlapping cross)
          ctx.save();
          ctx.rotate(0.35);
          ctx.fillStyle = isThermalMode ? '#475569' : '#a16207';
          ctx.fillRect(-10, -3, 20, 6);
          ctx.strokeStyle = '#5c3a1e';
          ctx.lineWidth = 1;
          ctx.strokeRect(-10, -3, 20, 6);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-7, 0, 1.5, 1.5);
          ctx.fillRect(6, 0, 1.5, 1.5);
          ctx.restore();

          ctx.restore();

          // Pickup tag label above
          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#f59e0b';
          ctx.textAlign = 'center';
          ctx.fillText('SCRAP WOOD', s.x + s.width / 2, s.y - 4);
        } else if (s.type === 'tv_set') {
          // Retro 90s CRT Television Console
          // Casing
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#262626';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = '#171717';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Rabbit ear antenna on top
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x + s.width / 2 - 2, s.y);
          ctx.lineTo(s.x + s.width / 2 - 12, s.y - 10);
          ctx.moveTo(s.x + s.width / 2 + 2, s.y);
          ctx.lineTo(s.x + s.width / 2 + 12, s.y - 10);
          ctx.stroke();

          // Curved CRT screen
          const screenW = s.width - 12;
          const screenH = s.height - 8;
          ctx.fillStyle = '#090d16';
          ctx.beginPath();
          ctx.roundRect(s.x + 4, s.y + 4, screenW, screenH, 3);
          ctx.fill();

          // Glowing CRT display with emergency broadcast flicker
          const flicker = 0.5 + Math.sin(now * 0.02) * 0.25;
          ctx.fillStyle = `rgba(6, 182, 212, ${flicker * 0.45})`;
          ctx.beginPath();
          ctx.roundRect(s.x + 5, s.y + 5, screenW - 2, screenH - 2, 2);
          ctx.fill();

          // Horizontal CRT scanline
          const scanY = s.y + 5 + ((now * 0.04) % (screenH - 4));
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(s.x + 5, scanY);
          ctx.lineTo(s.x + 3 + screenW, scanY);
          ctx.stroke();

          // Tuning dials & red LED
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(s.x + s.width - 5, s.y + 7, 1.5, 0, Math.PI * 2);
          ctx.fill();

          // "TV" label
          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText('NEWS TV', s.x + s.width / 2, s.y + s.height + 8);
        } else if (s.type === 'medical_station') {
          // Emergency Medical Triage Station & Supply Cabinet
          ctx.fillStyle = isThermalMode ? '#1e3442' : '#f8fafc';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#38bdf8' : '#cbd5e1';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Red Cross insignia
          const mcx = s.x + s.width / 2;
          const mcy = s.y + s.height / 2;
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(mcx - 2, mcy - 7, 4, 14);
          ctx.fillRect(mcx - 7, mcy - 2, 14, 4);

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.fillText('MEDIC', mcx, s.y + s.height - 2);
        } else if (s.type === 'dirt_trench') {
          // Excavated earthen dirt trench that slows zombies by 25%
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#332011';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#334155' : '#4d3019';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Inner dugout depth
          ctx.fillStyle = isThermalMode ? '#0f172a' : '#1c1109';
          ctx.fillRect(s.x + 3, s.y + 3, Math.max(2, s.width - 6), Math.max(2, s.height - 6));

          // Earthen trench tracks
          ctx.strokeStyle = '#5c3a1e';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x + 4, s.y + s.height / 2);
          ctx.lineTo(s.x + s.width - 4, s.y + s.height / 2);
          ctx.stroke();

          // Soil clods
          ctx.fillStyle = '#6b4323';
          ctx.fillRect(s.x + 5, s.y + 5, 3, 3);
          ctx.fillRect(s.x + s.width - 8, s.y + s.height - 8, 3, 3);

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#a16207';
          ctx.textAlign = 'center';
          ctx.fillText('TRENCH (-25%)', s.x + s.width / 2, s.y - 2);
        } else if (s.type === 'wall_brick') {
          // Solid Red Brick Masonry Wall (Breakable with Claw Hammer / Sledgehammer)
          ctx.fillStyle = isThermalMode ? '#2a1a1a' : '#882b20';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#3f2525' : '#4d1610';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Horizontal mortar lines
          ctx.strokeStyle = isThermalMode ? '#4b3535' : '#bca594';
          ctx.lineWidth = 1;
          const rows = Math.max(2, Math.floor(s.height / 8));
          const rowH = s.height / rows;
          for (let r = 1; r < rows; r++) {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y + r * rowH);
            ctx.lineTo(s.x + s.width, s.y + r * rowH);
            ctx.stroke();
          }

          // Staggered vertical brick joints
          for (let r = 0; r < rows; r++) {
            const offset = (r % 2) * 10;
            for (let bx = s.x + offset + 8; bx < s.x + s.width - 2; bx += 20) {
              ctx.beginPath();
              ctx.moveTo(bx, s.y + r * rowH);
              ctx.lineTo(bx, s.y + (r + 1) * rowH);
              ctx.stroke();
            }
          }

          // Demolition / dismantling crack indicators
          if (s.dismantleHits && s.dismantleHits > 0) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(s.x + 4, s.y + 4);
            ctx.lineTo(s.x + s.width * 0.5, s.y + s.height * 0.7);
            ctx.lineTo(s.x + s.width - 4, s.y + s.height - 4);
            ctx.stroke();
            for (let i = 0; i < s.dismantleHits; i++) {
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(s.x + 3 + i * 7, s.y - 5, 5, 3);
            }
          }
        } else if (s.type === 'wall_stone') {
          // Tier 2 Fortified Cut Stone Masonry Wall (500 HP)
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#475569';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#334155' : '#1e293b';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Hewn granite stone block texture with chiseled bevels
          ctx.strokeStyle = isThermalMode ? '#475569' : '#334155';
          ctx.lineWidth = 1.5;
          const rows = Math.max(2, Math.floor(s.height / 10));
          const rowH = s.height / rows;
          for (let r = 1; r < rows; r++) {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y + r * rowH);
            ctx.lineTo(s.x + s.width, s.y + r * rowH);
            ctx.stroke();
          }
          for (let r = 0; r < rows; r++) {
            const offset = (r % 2) * 14;
            for (let bx = s.x + offset + 12; bx < s.x + s.width - 2; bx += 26) {
              ctx.beginPath();
              ctx.moveTo(bx, s.y + r * rowH);
              ctx.lineTo(bx, s.y + (r + 1) * rowH);
              ctx.stroke();
            }
          }

          // Iron anchor tie pins
          ctx.fillStyle = '#94a3b8';
          for (let px = s.x + 8; px < s.x + s.width - 4; px += 24) {
            ctx.fillRect(px, s.y + s.height / 2 - 1.5, 3, 3);
          }
        } else if (s.type === 'door_stone') {
          // Reinforced Heavy Stone Door with Iron Cross Bands
          const isHorizontal = s.width >= s.height;
          if (s.isOpen) {
            // Open heavy stone door threshold
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            if (isHorizontal) {
              const panelLen = Math.max(22, s.width - 4);
              const panelThick = Math.min(s.height, 14);
              ctx.fillStyle = isThermalMode ? '#1e293b' : '#334155';
              ctx.fillRect(s.x, s.y - panelLen, panelThick, panelLen);
              ctx.strokeStyle = '#64748b';
              ctx.strokeRect(s.x, s.y - panelLen, panelThick, panelLen);
              // Iron hinges
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(s.x - 1, s.y - panelLen + 4, 3, 5);
              ctx.fillRect(s.x - 1, s.y - 8, 3, 5);
            } else {
              const panelLen = Math.max(22, s.height - 4);
              const panelThick = Math.min(s.width, 14);
              ctx.fillStyle = isThermalMode ? '#1e293b' : '#334155';
              ctx.fillRect(s.x + s.width, s.y, panelLen, panelThick);
              ctx.strokeStyle = '#64748b';
              ctx.strokeRect(s.x + s.width, s.y, panelLen, panelThick);
              // Iron hinges
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(s.x + s.width + 4, s.y - 1, 5, 3);
              ctx.fillRect(s.x + s.width + panelLen - 8, s.y - 1, 5, 3);
            }
          } else {
            // Closed stone door
            ctx.fillStyle = isThermalMode ? '#1e293b' : '#374151';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            ctx.strokeStyle = isThermalMode ? '#0f172a' : '#111827';
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            // Heavy forged iron reinforcing bands
            ctx.fillStyle = '#64748b';
            if (isHorizontal) {
              ctx.fillRect(s.x + 6, s.y, 4, s.height);
              ctx.fillRect(s.x + s.width - 10, s.y, 4, s.height);
              // Heavy sliding vault deadbolt
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(s.x + s.width / 2 - 12, s.y + s.height / 2 - 3, 24, 6);
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(s.x + s.width / 2 - 3, s.y + s.height / 2 - 5, 6, 10);
            } else {
              ctx.fillRect(s.x, s.y + 6, s.width, 4);
              ctx.fillRect(s.x, s.y + s.height - 10, s.width, 4);
              // Heavy sliding vault deadbolt
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(s.x + s.width / 2 - 3, s.y + s.height / 2 - 12, 6, 24);
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(s.x + s.width / 2 - 5, s.y + s.height / 2 - 3, 10, 6);
            }
          }
        } else if (s.type === 'trap_clay_pit') {
          // Dense Clay Pit Trap (Mires zombies by 65%)
          ctx.fillStyle = isThermalMode ? '#1f1610' : '#451a03';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#331e0f' : '#78350f';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Deep mire clay sludge
          ctx.fillStyle = isThermalMode ? '#291809' : '#572506';
          ctx.fillRect(s.x + 3, s.y + 3, Math.max(2, s.width - 6), Math.max(2, s.height - 6));

          // Sticky sludge ripples
          ctx.strokeStyle = '#9a3412';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(s.x + s.width * 0.35, s.y + s.height * 0.5, Math.min(s.width, s.height) * 0.25, 0, Math.PI);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(s.x + s.width * 0.65, s.y + s.height * 0.5, Math.min(s.width, s.height) * 0.2, Math.PI, Math.PI * 2);
          ctx.stroke();

          // Sticky mud bubbling clods
          ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.arc(s.x + 6, s.y + 6, 2.5, 0, Math.PI * 2);
          ctx.arc(s.x + s.width - 8, s.y + s.height - 7, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#ea580c';
          ctx.textAlign = 'center';
          ctx.fillText('CLAY MIRE (-65%)', s.x + s.width / 2, s.y - 3);
        } else if (s.type === 'trap_barbed_wire') {
          // Razor Barbed Wire Entanglement (-50% speed + 8 contact damage)
          ctx.fillStyle = isThermalMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.45)';
          ctx.fillRect(s.x, s.y, s.width, s.height);

          // Iron T-posts at edges and center
          ctx.fillStyle = '#64748b';
          ctx.fillRect(s.x + 1, s.y - 2, 4, s.height + 4);
          ctx.fillRect(s.x + s.width / 2 - 2, s.y - 2, 4, s.height + 4);
          ctx.fillRect(s.x + s.width - 5, s.y - 2, 4, s.height + 4);

          // Concertina coiled razor wire zigzag
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const coils = Math.max(4, Math.floor(s.width / 12));
          const stepX = s.width / coils;
          for (let i = 0; i <= coils; i++) {
            const wx = s.x + i * stepX;
            const wy = i % 2 === 0 ? s.y + 3 : s.y + s.height - 3;
            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();

          // Secondary criss-cross wire
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i <= coils; i++) {
            const wx = s.x + i * stepX;
            const wy = i % 2 === 0 ? s.y + s.height - 3 : s.y + 3;
            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();

          // Sharp razor barbs along wire
          ctx.fillStyle = '#f1f5f9';
          for (let i = 0; i < coils; i++) {
            const bx = s.x + (i + 0.5) * stepX;
            const by = s.y + s.height / 2;
            ctx.fillRect(bx - 1.5, by - 3, 3, 6);
            ctx.fillRect(bx - 3, by - 1.5, 6, 3);
          }

          // Blood spatters on wire from zombies
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(s.x + 7, s.y + 5, 2, 2);
          ctx.fillRect(s.x + s.width * 0.6, s.y + s.height - 6, 2.5, 2);

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#f87171';
          ctx.textAlign = 'center';
          ctx.fillText('RAZOR WIRE (-50% + DMG)', s.x + s.width / 2, s.y - 3);
        } else if (s.type === 'abandoned_car') {
          // Abandoned Wrecked Sedan / Station Wagon (Pryable with Tempered Crowbar -> Iron Pipes)
          const isWide = s.width >= s.height;
          // Tires
          ctx.fillStyle = '#0f172a';
          if (isWide) {
            ctx.fillRect(s.x + 8, s.y - 3, 14, 5);
            ctx.fillRect(s.x + s.width - 22, s.y - 3, 14, 5);
            ctx.fillRect(s.x + 8, s.y + s.height - 2, 14, 5);
            ctx.fillRect(s.x + s.width - 22, s.y + s.height - 2, 14, 5);
          } else {
            ctx.fillRect(s.x - 3, s.y + 8, 5, 14);
            ctx.fillRect(s.x - 3, s.y + s.height - 22, 5, 14);
            ctx.fillRect(s.x + s.width - 2, s.y + 8, 5, 14);
            ctx.fillRect(s.x + s.width - 2, s.y + s.height - 22, 5, 14);
          }

          // Car body chassis
          ctx.fillStyle = isThermalMode ? '#283545' : '#3b4252';
          ctx.beginPath();
          ctx.roundRect(s.x, s.y, s.width, s.height, 6);
          ctx.fill();
          ctx.strokeStyle = isThermalMode ? '#3f536b' : '#1e2430';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Rusted oxidized patches
          ctx.fillStyle = '#7c2d12';
          ctx.fillRect(s.x + 6, s.y + 4, 12, 8);
          ctx.fillRect(s.x + s.width - 20, s.y + s.height - 12, 14, 8);

          // Roof and windshields
          if (isWide) {
            // Windshield (front)
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(s.x + s.width * 0.22, s.y + 4, s.width * 0.16, s.height - 8);
            // Rear glass
            ctx.fillRect(s.x + s.width * 0.65, s.y + 4, s.width * 0.14, s.height - 8);
            // Roof center
            ctx.fillStyle = isThermalMode ? '#1e293b' : '#2e3440';
            ctx.fillRect(s.x + s.width * 0.38, s.y + 3, s.width * 0.27, s.height - 6);
            // Glass crack
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s.x + s.width * 0.25, s.y + 5);
            ctx.lineTo(s.x + s.width * 0.32, s.y + s.height - 5);
            ctx.stroke();
            // Headlights & Taillights
            ctx.fillStyle = '#fde047';
            ctx.fillRect(s.x + 1, s.y + 3, 3, 5);
            ctx.fillRect(s.x + 1, s.y + s.height - 8, 3, 5);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(s.x + s.width - 4, s.y + 3, 3, 5);
            ctx.fillRect(s.x + s.width - 4, s.y + s.height - 8, 3, 5);
          } else {
            // Vertical orientation
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(s.x + 4, s.y + s.height * 0.22, s.width - 8, s.height * 0.16);
            ctx.fillRect(s.x + 4, s.y + s.height * 0.65, s.width - 8, s.height * 0.14);
            ctx.fillStyle = isThermalMode ? '#1e293b' : '#2e3440';
            ctx.fillRect(s.x + 3, s.y + s.height * 0.38, s.width - 6, s.height * 0.27);
            // Headlights & Taillights
            ctx.fillStyle = '#fde047';
            ctx.fillRect(s.x + 3, s.y + 1, 5, 3);
            ctx.fillRect(s.x + s.width - 8, s.y + 1, 5, 3);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(s.x + 3, s.y + s.height - 4, 5, 3);
            ctx.fillRect(s.x + s.width - 8, s.y + s.height - 4, 5, 3);
          }

          // Crowbar prying hits indicator
          if (s.dismantleHits && s.dismantleHits > 0) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            for (let i = 0; i < s.dismantleHits; i++) {
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(s.x + 4 + i * 8, s.y - 5, 6, 3);
            }
          }

          // Label
          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.fillText('WRECKED CAR [PRY]', s.x + s.width / 2, s.y + s.height / 2 + 3);
        } else if (s.type === 'riverbed_clay') {
          // Alluvial Riverbed Dense Clay Deposit (Dig with Steel Spade -> Dense Clay)
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#78350f';
          ctx.beginPath();
          ctx.roundRect(s.x, s.y, s.width, s.height, 8);
          ctx.fill();
          ctx.strokeStyle = '#9a3412';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Wet clay silt contours
          ctx.fillStyle = '#92400e';
          ctx.beginPath();
          ctx.roundRect(s.x + 4, s.y + 4, s.width - 8, s.height - 8, 6);
          ctx.fill();

          // Clay sheen & smooth river pebbles
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.arc(s.x + s.width * 0.3, s.y + s.height * 0.4, 5, 0, Math.PI * 2);
          ctx.arc(s.x + s.width * 0.7, s.y + s.height * 0.6, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(s.x + s.width * 0.45, s.y + s.height * 0.65, 3, 0, Math.PI * 2);
          ctx.arc(s.x + s.width * 0.75, s.y + s.height * 0.3, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Excavation hits indicator
          if (s.dismantleHits && s.dismantleHits > 0) {
            ctx.fillStyle = 'rgba(234, 88, 12, 0.4)';
            ctx.beginPath();
            ctx.roundRect(s.x, s.y, s.width, s.height, 8);
            ctx.fill();
            for (let i = 0; i < s.dismantleHits; i++) {
              ctx.fillStyle = '#ea580c';
              ctx.fillRect(s.x + 4 + i * 8, s.y - 5, 6, 3);
            }
          }

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#fde68a';
          ctx.textAlign = 'center';
          ctx.fillText('DENSE CLAY BED', s.x + s.width / 2, s.y + s.height / 2 + 3);
        } else if (s.type === 'utility_pole') {
          // Industrial Creosote Timber Utility Pole (Fell with Motorized Saw -> Treated Planks)
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;

          // Main vertical creosote timber mast
          ctx.fillStyle = isThermalMode ? '#283b48' : '#3d2514';
          ctx.fillRect(cx - 3, s.y, 6, s.height);
          ctx.strokeStyle = '#23150b';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 3, s.y, 6, s.height);

          // Horizontal crossarm timber beams
          ctx.fillStyle = isThermalMode ? '#3c586c' : '#57331b';
          ctx.fillRect(s.x + 2, s.y + 4, Math.max(12, s.width - 4), 3.5);
          ctx.fillRect(s.x + 4, s.y + 12, Math.max(8, s.width - 8), 3);

          // Ceramic insulator bells
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(s.x + 4, s.y + 3, 2, 0, Math.PI * 2);
          ctx.arc(s.x + s.width - 4, s.y + 3, 2, 0, Math.PI * 2);
          ctx.arc(cx, s.y + 11, 2, 0, Math.PI * 2);
          ctx.fill();

          // Drooping transformer wires
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(s.x + 2, s.y + 4);
          ctx.quadraticCurveTo(cx, s.y + 10, s.x + s.width - 2, s.y + 4);
          ctx.stroke();

          // Dismantle hits indicator
          if (s.dismantleHits && s.dismantleHits > 0) {
            ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            for (let i = 0; i < s.dismantleHits; i++) {
              ctx.fillStyle = '#a855f7';
              ctx.fillRect(s.x + 2 + i * 8, s.y - 5, 6, 3);
            }
          }

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#c084fc';
          ctx.textAlign = 'center';
          ctx.fillText('UTILITY POLE [SAW]', cx, s.y + s.height + 8);
        } else if (s.type === 'home_foundation') {
          // Crushed Concrete House Footing Foundation (Sledgehammer -> Concrete Mix)
          ctx.fillStyle = isThermalMode ? '#283b48' : '#475569';
          ctx.beginPath();
          ctx.roundRect(s.x, s.y, s.width, s.height, 4);
          ctx.fill();
          ctx.strokeStyle = isThermalMode ? '#3c586c' : '#334155';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Concrete aggregate specks
          ctx.fillStyle = '#64748b';
          ctx.fillRect(s.x + 4, s.y + 4, s.width - 8, s.height - 8);

          // Exposed rusted rebar ties
          ctx.strokeStyle = '#ea580c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x + 3, s.y + 3);
          ctx.lineTo(s.x + 9, s.y + 9);
          ctx.moveTo(s.x + s.width - 3, s.y + s.height - 3);
          ctx.lineTo(s.x + s.width - 9, s.y + s.height - 9);
          ctx.stroke();

          // Formwork concrete pour lines
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          for (let py = s.y + 7; py < s.y + s.height - 4; py += 7) {
            ctx.beginPath();
            ctx.moveTo(s.x + 4, py);
            ctx.lineTo(s.x + s.width - 4, py);
            ctx.stroke();
          }

          // Dismantle hits indicator
          if (s.dismantleHits && s.dismantleHits > 0) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            for (let i = 0; i < s.dismantleHits; i++) {
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(s.x + 2 + i * 7, s.y - 5, 5, 3);
            }
          }

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.fillText('FOUNDATION [SLEDGE]', s.x + s.width / 2, s.y + s.height / 2 + 3);
        } else if (s.type === 'bank_vault') {
          // Reinforced Steel Bank Vault Safe (Heavy Breaker -> Steel Plates)
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#0f172a';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Ballistic steel plate inset
          ctx.fillStyle = isThermalMode ? '#283b48' : '#1e293b';
          ctx.fillRect(s.x + 4, s.y + 4, s.width - 8, s.height - 8);

          // Giant circular safe lock wheel
          const vx = s.x + s.width / 2;
          const vy = s.y + s.height / 2;
          const vr = Math.min(s.width, s.height) * 0.28;

          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(vx, vy, vr, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 4-spoke lock wheel handle
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(vx - vr, vy);
          ctx.lineTo(vx + vr, vy);
          ctx.moveTo(vx, vy - vr);
          ctx.lineTo(vx, vy + vr);
          ctx.stroke();

          // Center brass hub
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(vx, vy, 3, 0, Math.PI * 2);
          ctx.fill();

          // Heavy corner locking bolts
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(s.x + 3, s.y + 3, 3, 3);
          ctx.fillRect(s.x + s.width - 6, s.y + 3, 3, 3);
          ctx.fillRect(s.x + 3, s.y + s.height - 6, 3, 3);
          ctx.fillRect(s.x + s.width - 6, s.y + s.height - 6, 3, 3);

          // Dismantle hits indicator
          if (s.dismantleHits && s.dismantleHits > 0) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            for (let i = 0; i < s.dismantleHits; i++) {
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(s.x + 2 + i * 7, s.y - 5, 5, 3);
            }
          }

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText('BANK VAULT [BREAKER]', vx, s.y + s.height + 8);
        } else if (s.type === 'boulder_rock') {
          // Craggy Granite Bedrock Boulder (Power Trencher -> Gravel)
          const rx = s.x + s.width / 2;
          const ry = s.y + s.height / 2;
          const rad = Math.min(s.width, s.height) / 2;

          ctx.fillStyle = isThermalMode ? '#283b48' : '#475569';
          ctx.beginPath();
          ctx.arc(rx, ry, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Rock facets and fissures
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(rx - rad * 0.3, ry - rad * 0.2, rad * 0.5, 0, Math.PI * 2);
          ctx.fill();

          // Mineral vein
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(s.x + 4, ry - 3);
          ctx.lineTo(rx + 2, ry + 2);
          ctx.lineTo(s.x + s.width - 4, ry + 5);
          ctx.stroke();

          // Dismantle hits indicator
          if (s.dismantleHits && s.dismantleHits > 0) {
            ctx.fillStyle = 'rgba(226, 232, 240, 0.4)';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            for (let i = 0; i < s.dismantleHits; i++) {
              ctx.fillStyle = '#e2e8f0';
              ctx.fillRect(s.x + 2 + i * 8, s.y - 5, 6, 3);
            }
          }

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.fillText('ROCK [TRENCHER]', rx, ry + 3);
        } else if (s.type === 'wall_steel') {
          // Tier 3 Ballistic Armored Steel Wall (1000 HP)
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#0f172a';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Heavy industrial riveted steel panels
          ctx.fillStyle = isThermalMode ? '#283b48' : '#1e293b';
          ctx.fillRect(s.x + 2, s.y + 2, s.width - 4, s.height - 4);

          // Diagonal structural reinforcing beams
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x + 3, s.y + 3);
          ctx.lineTo(s.x + s.width - 3, s.y + s.height - 3);
          ctx.moveTo(s.x + s.width - 3, s.y + 3);
          ctx.lineTo(s.x + 3, s.y + s.height - 3);
          ctx.stroke();

          // Steel rivets along frame
          ctx.fillStyle = '#94a3b8';
          for (let rx = s.x + 5; rx < s.x + s.width - 2; rx += 14) {
            ctx.fillRect(rx, s.y + 1, 2.5, 2.5);
            ctx.fillRect(rx, s.y + s.height - 3.5, 2.5, 2.5);
          }
        } else if (s.type === 'wall_concrete') {
          // Tier 3 Poured Reinforced Concrete Wall (850 HP)
          ctx.fillStyle = isThermalMode ? '#283b48' : '#64748b';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#3c586c' : '#334155';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Aggregate gravel & rebar tie points
          ctx.fillStyle = '#475569';
          ctx.fillRect(s.x + 2, s.y + 2, s.width - 4, s.height - 4);

          // Formwork tie holes
          ctx.fillStyle = '#0f172a';
          for (let tx = s.x + 8; tx < s.x + s.width - 4; tx += 20) {
            ctx.beginPath();
            ctx.arc(tx, s.y + s.height * 0.35, 2, 0, Math.PI * 2);
            ctx.arc(tx, s.y + s.height * 0.65, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (s.type === 'door_steel') {
          // Tier 3 Heavy Steel Security Door (800 HP)
          const isHorizontal = s.width >= s.height;
          if (s.isOpen) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            if (isHorizontal) {
              const panelLen = Math.max(22, s.width - 4);
              const panelThick = Math.min(s.height, 14);
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(s.x, s.y - panelLen, panelThick, panelLen);
              ctx.strokeStyle = '#38bdf8';
              ctx.strokeRect(s.x, s.y - panelLen, panelThick, panelLen);
            } else {
              const panelLen = Math.max(22, s.height - 4);
              const panelThick = Math.min(s.width, 14);
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(s.x + s.width, s.y, panelLen, panelThick);
              ctx.strokeStyle = '#38bdf8';
              ctx.strokeRect(s.x + s.width, s.y, panelLen, panelThick);
            }
          } else {
            ctx.fillStyle = isThermalMode ? '#1e293b' : '#0f172a';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            // Armored door center panel
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(s.x + 3, s.y + 3, s.width - 6, s.height - 6);

            // Electronic biometric latch
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(s.x + s.width / 2 - 4, s.y + s.height / 2 - 2, 8, 4);
          }
        } else if (s.type === 'trap_acid_pit') {
          // Tier 3 Industrial Corrosive Acid Pit (-60% speed, 25 DPS)
          ctx.fillStyle = isThermalMode ? '#052e16' : '#14532d';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Bubbling green corrosive acid pool
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(s.x + 3, s.y + 3, Math.max(2, s.width - 6), Math.max(2, s.height - 6));

          // Chemical bubbling effect
          const bubble = Math.sin(now * 0.008) * 2;
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(s.x + s.width * 0.35, s.y + s.height * 0.5 + bubble, 3.5, 0, Math.PI * 2);
          ctx.arc(s.x + s.width * 0.7, s.y + s.height * 0.45 - bubble, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#86efac';
          ctx.textAlign = 'center';
          ctx.fillText('ACID PIT (-60% + 25 DPS)', s.x + s.width / 2, s.y - 3);
        } else if (s.type === 'trap_shredder') {
          // Tier 3 Motorized Rotary Blade Shredder (-70% speed, 35 contact damage)
          ctx.fillStyle = isThermalMode ? '#1e293b' : '#0f172a';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          // Motorized spinning blades
          const rotAngle = (now * 0.015) % (Math.PI * 2);
          const scx = s.x + s.width / 2;
          const scy = s.y + s.height / 2;

          ctx.save();
          ctx.translate(scx, scy);
          ctx.rotate(rotAngle);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-s.width * 0.4, 0);
          ctx.lineTo(s.width * 0.4, 0);
          ctx.moveTo(0, -s.height * 0.4);
          ctx.lineTo(0, s.height * 0.4);
          ctx.stroke();

          // Serrated teeth on blades
          ctx.fillStyle = '#f87171';
          ctx.fillRect(-s.width * 0.35, -2, 4, 4);
          ctx.fillRect(s.width * 0.35 - 4, -2, 4, 4);
          ctx.restore();

          // Splatter
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(s.x + 4, s.y + 4, 3, 3);
          ctx.fillRect(s.x + s.width - 7, s.y + s.height - 7, 3, 3);

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#f87171';
          ctx.textAlign = 'center';
          ctx.fillText('SHREDDER (-70% + 35 DMG)', scx, s.y - 3);
        } else {
          // Fallback rendering for any custom or procedural structure (never invisible!)
          ctx.fillStyle = isThermalMode ? '#283b48' : '#334155';
          ctx.fillRect(s.x, s.y, s.width, s.height);
          ctx.strokeStyle = isThermalMode ? '#3c586c' : '#475569';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(s.x, s.y, s.width, s.height);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(s.name, s.x + s.width / 2, s.y + s.height / 2 + 3);
        }

        // Structural Integrity Indicator if damaged
        if (s.hp < s.maxHp && (s.type.includes('wall') || s.type.includes('fence') || s.type.includes('door') || s.type === 'barricade_window' || s.type === 'abandoned_car' || s.type === 'riverbed_clay' || s.type === 'utility_pole' || s.type === 'home_foundation' || s.type === 'bank_vault' || s.type === 'boulder_rock')) {
          const barW = Math.max(16, Math.min(32, s.width));
          const barX = s.x + (s.width - barW) / 2;
          const barY = s.y - 5;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(barX, barY, barW, 2.5);
          ctx.fillStyle = s.hp < s.maxHp * 0.35 ? '#ef4444' : '#f59e0b';
          ctx.fillRect(barX, barY, (s.hp / s.maxHp) * barW, 2.5);
        }
      });

      // 4. Shambling Zombies (Romero style: half speed of player with shambling bobbing gait)
      zombies.forEach((z) => {
        ctx.save();
        ctx.translate(z.x, z.y);

        // Shambling gait wobble based on movement
        const wobble = Math.sin(now * 0.007 + parseFloat(z.id.slice(-2) || '0')) * 0.08;
        ctx.rotate(z.angle + wobble);

        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        const skinColor = isThermalMode ? '#e65100' : '#718071';
        const clothesColor = isThermalMode ? '#bf360c' : z.clothingColor;

        ctx.fillStyle = clothesColor;
        ctx.fillRect(-6, -7, 12, 14);

        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(4, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = skinColor;
        ctx.fillRect(4, -6, 10, 3);
        ctx.fillRect(4, 3, 9, 3);

        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(-2, -3, 4, 5);

        ctx.restore();

        if (z.state === 'tracking') {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('!', z.x - 2, z.y - 14);
        }
      });

      // 4b. NPC Survivors (Stranded and Recruited Colony Members)
      npcs.forEach((npc) => {
        ctx.save();
        ctx.translate(npc.x, npc.y);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Direction facing (facing target or default)
        let angle = 0;
        if (npc.targetX !== undefined && npc.targetY !== undefined) {
          angle = Math.atan2(npc.targetY - npc.y, npc.targetX - npc.x);
        }
        ctx.rotate(angle);

        // Torso in profession avatarColor
        ctx.fillStyle = isThermalMode ? '#00e5ff' : npc.avatarColor;
        ctx.fillRect(-6, -7, 12, 14);

        // Head
        ctx.fillStyle = isThermalMode ? '#80d8ff' : '#f5d0a9';
        ctx.beginPath();
        ctx.arc(4, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Arms holding equipped weapon
        ctx.fillStyle = isThermalMode ? '#80d8ff' : '#f5d0a9';
        ctx.fillRect(4, -6, 8, 3);
        ctx.fillRect(4, 3, 8, 3);

        // Weapon
        if (npc.equippedWeapon) {
          if (npc.equippedWeapon.weaponType === 'gun') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(8, 2, 18, 3);
          } else {
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(8, 2, 10, 3);
          }
        }

        ctx.restore();

        // Over-head labels and badges
        const isRecruited = npc.state === 'recruited';
        ctx.save();
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';

        // 1. Task or Stranded Badge
        const badgeY = npc.y - 16;
        if (!isRecruited) {
          // Pulsing stranded badge
          const pulse = Math.sin(now * 0.006) > 0;
          ctx.fillStyle = pulse ? 'rgba(245, 158, 11, 0.95)' : 'rgba(217, 119, 6, 0.75)';
          const text = '⚠️ STRANDED [E]';
          const tw = ctx.measureText(text).width;
          ctx.fillRect(npc.x - tw / 2 - 3, badgeY - 8, tw + 6, 11);
          ctx.fillStyle = '#000000';
          ctx.fillText(text, npc.x, badgeY);
        } else {
          // Recruited task badge
          const taskColor =
            npc.assignedTask === 'patrol'
              ? '#ef4444'
              : npc.assignedTask === 'maintain'
              ? '#f59e0b'
              : npc.assignedTask === 'rest'
              ? '#06b6d4'
              : '#10b981';
          const taskText = `[${npc.assignedTask.toUpperCase()}]`;
          const tw = ctx.measureText(taskText).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(npc.x - tw / 2 - 3, badgeY - 8, tw + 6, 11);
          ctx.fillStyle = taskColor;
          ctx.fillText(taskText, npc.x, badgeY);
        }

        // 2. Name & Profession
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(npc.name, npc.x, npc.y - 28);

        // 3. Health bar if damaged
        if (npc.hp < npc.maxHp) {
          const hpW = 28;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(npc.x - hpW / 2, npc.y - 37, hpW, 3);
          ctx.fillStyle = npc.hp < 30 ? '#ef4444' : '#10b981';
          ctx.fillRect(npc.x - hpW / 2, npc.y - 37, (npc.hp / npc.maxHp) * hpW, 3);
        }

        ctx.restore();
      });

      // 5. The Survivor (Player Character): Normal, Sleeping, or Performing Actions (Recoil, Swing, Chop)
      ctx.save();
      ctx.translate(survivor.x, survivor.y);

      if (survivor.isSleeping) {
        // SLEEPING STATE: Lying down horizontally in bed!
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-8, -12, 16, 24);
        ctx.fillStyle = '#e2b388';
        ctx.beginPath();
        ctx.arc(0, -10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // "Zzz..." particles floating above
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px monospace';
        const floatY = (now * 0.04) % 20;
        ctx.fillText('Z', survivor.x + 8, survivor.y - 12 - floatY);
        ctx.font = '10px monospace';
        ctx.fillText('z', survivor.x + 14, survivor.y - 18 - floatY);
      } else {
        // AWAKE & STANDING
        const baseFacing = Math.atan2(mousePos.y - survivor.y, mousePos.x - survivor.x);
        let facingAngle = baseFacing;

        // Action recoil / swing animation on player sprite
        let recoilOffset = 0;
        let weaponSwingAngle = 0;

        if (survivor.activeAction) {
          const actionProgress = Math.min(1.0, (now - survivor.activeAction.timestamp) / survivor.activeAction.durationMs);

          if (survivor.activeAction.type === 'shoot') {
            // Gunshot recoil: kicks back for 50% duration then restores
            recoilOffset = actionProgress < 0.5 ? -4 * (1 - actionProgress * 2) : 0;
          } else if (survivor.activeAction.type === 'swing') {
            // Melee weapon swing: sweeps from -40 deg to +50 deg
            weaponSwingAngle = (actionProgress - 0.5) * 1.5;
          } else if (survivor.activeAction.type === 'tool_chop') {
            // Overhead downward chop stroke
            weaponSwingAngle = Math.sin(actionProgress * Math.PI) * 0.9;
          }
        }

        ctx.rotate(facingAngle);
        if (recoilOffset !== 0) {
          ctx.translate(recoilOffset, 0);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Torso
        ctx.fillStyle = isThermalMode ? '#ff9100' : '#334155';
        ctx.fillRect(-7, -8, 14, 16);

        // Backpack
        ctx.fillStyle = isThermalMode ? '#ff6d00' : '#1e293b';
        ctx.fillRect(-11, -6, 5, 12);

        // Head
        ctx.fillStyle = isThermalMode ? '#ffab40' : '#e2b388';
        ctx.beginPath();
        ctx.arc(4, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isThermalMode ? '#ff8f00' : '#1f2937';
        ctx.beginPath();
        ctx.arc(2, 0, 6, -Math.PI / 2, Math.PI / 2);
        ctx.fill();

        // Arms (holding weapon/tool with swing animation rotation)
        ctx.save();
        if (weaponSwingAngle !== 0) {
          ctx.translate(6, 0);
          ctx.rotate(weaponSwingAngle);
          ctx.translate(-6, 0);
        }

        ctx.fillStyle = isThermalMode ? '#ffab40' : '#e2b388';
        ctx.fillRect(4, -7, 9, 3);
        ctx.fillRect(4, 4, 9, 3);

        // Active weapon/tool in hand
        const activeItem =
          survivor.activeSlot === 'weapon1'
            ? survivor.equippedWeapon
            : survivor.activeSlot === 'weapon2'
            ? survivor.equippedWeapon2
            : survivor.equippedTool;

        if (activeItem) {
          if (activeItem.weaponType === 'shield') {
            ctx.fillStyle = '#b45309';
            ctx.fillRect(10, -8, 4, 16);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(12, -6, 2, 12);
          } else if (activeItem.weaponType === 'gun') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(10, 3, 24, 4);
            ctx.fillStyle = '#b45309';
            ctx.fillRect(5, 3, 8, 4);
          } else if (activeItem.name.includes('Crowbar')) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(11, 4);
            ctx.lineTo(26, 7);
            ctx.stroke();
          } else if (activeItem.name.includes('Bat')) {
            ctx.fillStyle = '#b45309';
            ctx.fillRect(10, 4, 18, 4);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(22, 2, 2, 8);
          } else if (activeItem.name.includes('Axe')) {
            ctx.fillStyle = '#78350f';
            ctx.fillRect(10, 4, 18, 4);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(24, 1, 6, 10);
          } else {
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(11, 4, 12, 3);
          }
        }

        ctx.restore(); // restore weapon swing transform

        // Blocking shield stance visual arc
        if (survivor.isBlocking) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(14, 0, 22, -0.65, 0.65);
          ctx.stroke();

          // Hexagonal energy pulses
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(14, 0, 26, -0.5, 0.5);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 6. VISUAL HEATMAP OVERLAY (Cumulative noise tiles)
      if (isHeatmapMode) {
        for (let r = 0; r < 30; r++) {
          for (let c = 0; c < 48; c++) {
            const heat = noiseHeatmap[r]?.[c] || 0;
            if (heat > 0.04) {
              const x = c * 20;
              const y = r * 20;
              const clamped = Math.min(1.0, heat);

              if (clamped < 0.3) {
                ctx.fillStyle = `rgba(6, 182, 212, ${clamped * 0.45})`;
              } else if (clamped < 0.7) {
                ctx.fillStyle = `rgba(245, 158, 11, ${clamped * 0.55})`;
              } else {
                ctx.fillStyle = `rgba(239, 68, 68, ${clamped * 0.75})`;
              }
              ctx.fillRect(x, y, 20, 20);

              ctx.strokeStyle = `rgba(255, 255, 255, ${clamped * 0.2})`;
              ctx.lineWidth = 0.5;
              ctx.strokeRect(x, y, 20, 20);
            }
          }
        }
      }

      // 7. Day / Night Cycle Ambient Lighting & Flashlight Beam
      let darkness = dayNight.darkness;
      if (environment.weather.includes('Rain') || environment.weather.includes('Fog')) {
        darkness = Math.max(darkness, 0.28);
      }
      if (environment.weather === 'Thunderstorm' && !dayNight.isDay) {
        darkness = 0.94;
      }

      // Full camera viewport bounds for atmospheric lighting
      const viewLeft = camX - halfW - 200;
      const viewTop = camY - halfH - 200;
      const viewWidth = halfW * 2 + 400;
      const viewHeight = halfH * 2 + 400;

      if (dayNight.isDay && !isThermalMode) {
        ctx.save();
        // Dynamic daylight color temperature based on in-game sun position
        // 06:00 to 09:00: Sunrise gold; 09:00 to 18:00: Crisp radiant sunlight; 18:00 to 22:00: Warm amber dusk
        const mins = dayNight.inGameMinutesOfDay;
        if (mins < 540) {
          // Morning sunrise amber
          ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
        } else if (mins > 1140) {
          // Sunset golden hour
          ctx.fillStyle = 'rgba(249, 115, 22, 0.14)';
        } else {
          // Midday bright clear sun wash
          ctx.fillStyle = 'rgba(254, 249, 195, 0.15)';
        }
        ctx.fillRect(viewLeft, viewTop, viewWidth, viewHeight);

        // Soft sun glare sweep across top-left corner
        const sunGlow = ctx.createRadialGradient(camX - 280, camY - 260, 20, camX - 280, camY - 260, 480);
        sunGlow.addColorStop(0, 'rgba(255, 255, 220, 0.16)');
        sunGlow.addColorStop(1, 'rgba(255, 255, 220, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(viewLeft, viewTop, viewWidth, viewHeight);
        ctx.restore();
      } else if (darkness > 0.15 && !isThermalMode && !survivor.isSleeping) {
        ctx.save();
        ctx.fillStyle = `rgba(5, 8, 18, ${darkness})`;
        ctx.fillRect(viewLeft, viewTop, viewWidth, viewHeight);

        if (survivor.flashlightOn) {
          ctx.globalCompositeOperation = 'destination-out';
          const beamAngle = Math.atan2(mousePos.y - survivor.y, mousePos.x - survivor.x);
          const beamDist = 280;
          const beamWidth = 0.55;

          const grad = ctx.createRadialGradient(
            survivor.x,
            survivor.y,
            10,
            survivor.x + Math.cos(beamAngle) * beamDist,
            survivor.y + Math.sin(beamAngle) * beamDist,
            beamDist
          );
          grad.addColorStop(0, 'rgba(255, 255, 220, 0.95)');
          grad.addColorStop(1, 'rgba(255, 255, 220, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(survivor.x, survivor.y);
          ctx.arc(survivor.x, survivor.y, beamDist, beamAngle - beamWidth, beamAngle + beamWidth);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.arc(survivor.x, survivor.y, 45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(survivor.x, survivor.y, 35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 7b. DYNAMIC RAIN VISUAL EFFECTS (Falling Rain Streaks, Ground Ripples, Storm Mist, Lightning)
      const isRainingWeather =
        environment.weather.includes('Rain') ||
        environment.weather === 'Thunderstorm' ||
        environment.weather === 'Heavy Rain' ||
        environment.weather === 'Freezing Rain';

      if (isRainingWeather && !isThermalMode) {
        ctx.save();
        const isThunder = environment.weather === 'Thunderstorm';
        const isHeavy = environment.weather === 'Heavy Rain' || isThunder;

        // A. Lightning flash for Thunderstorm
        if (isThunder) {
          const thunderCycle = now % 10500;
          const isLightning = thunderCycle < 75 || (thunderCycle > 140 && thunderCycle < 220);
          if (isLightning) {
            ctx.fillStyle = 'rgba(240, 249, 255, 0.42)';
            ctx.fillRect(viewLeft, viewTop, viewWidth, viewHeight);
          }
        }

        // B. Ground Splash Ripples (Raindrops impacting the terrain)
        const rippleCount = isHeavy ? 32 : 18;
        for (let r = 0; r < rippleCount; r++) {
          const rSeed = r * 197.3;
          const rPeriod = 900;
          const rTime = (now + rSeed * 7) % rPeriod;
          const rProg = rTime / rPeriod;
          const rx = viewLeft + ((rSeed * 43.17) % viewWidth);
          const ry = viewTop + ((rSeed * 89.23) % viewHeight);
          const rRadius = 2 + rProg * (isHeavy ? 10 : 7);
          const rAlpha = (1 - rProg) * (isHeavy ? 0.45 : 0.30);

          ctx.strokeStyle = `rgba(186, 230, 253, ${rAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(rx, ry, rRadius, rRadius * 0.45, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Tiny splash droplet particles jumping up on impact
          if (rProg < 0.35) {
            const jumpProg = rProg / 0.35;
            const dropAlpha = (1 - jumpProg) * 0.5;
            ctx.fillStyle = `rgba(224, 242, 254, ${dropAlpha})`;
            ctx.fillRect(rx - 1.5, ry - jumpProg * 6, 1.5, 1.5);
            ctx.fillRect(rx + 1.5, ry - jumpProg * 5, 1.5, 1.5);
          }
        }

        // C. Animated Falling Slanted Rain Streaks
        const dropCount = isHeavy ? 260 : 160;
        const streakAngle = 1.25; // ~72 degrees slanted with wind
        const streakLen = isHeavy ? 26 : 18;
        const dx = Math.cos(streakAngle) * streakLen;
        const dy = Math.sin(streakAngle) * streakLen;
        const fallSpeed = isHeavy ? 1.8 : 1.35;

        ctx.strokeStyle = isThunder ? 'rgba(215, 235, 255, 0.55)' : 'rgba(186, 230, 253, 0.42)';
        ctx.lineWidth = isHeavy ? 1.4 : 1.0;

        ctx.beginPath();
        for (let i = 0; i < dropCount; i++) {
          const iSeed = i * 79.19;
          const xOffset = (iSeed * 37.7) % viewWidth;
          const yOffset = (iSeed * 91.1) % viewHeight;

          const dropX = viewLeft + ((xOffset + now * (fallSpeed * 0.35)) % viewWidth);
          const dropY = viewTop + ((yOffset + now * fallSpeed) % viewHeight);

          ctx.moveTo(dropX, dropY);
          ctx.lineTo(dropX + dx, dropY + dy);
        }
        ctx.stroke();

        // D. Atmospheric Stormy Mist Overlay
        const stormMist = ctx.createLinearGradient(viewLeft, viewTop, viewLeft, viewTop + viewHeight);
        stormMist.addColorStop(0, isThunder ? 'rgba(15, 23, 42, 0.20)' : 'rgba(30, 41, 59, 0.12)');
        stormMist.addColorStop(1, isThunder ? 'rgba(15, 23, 42, 0.28)' : 'rgba(30, 41, 59, 0.16)');
        ctx.fillStyle = stormMist;
        ctx.fillRect(viewLeft, viewTop, viewWidth, viewHeight);

        ctx.restore();
      }

      // 8. Acoustic Sound Wave Rings
      soundEvents.forEach((snd) => {
        const age = now - snd.timestamp;
        if (age < 1200) {
          const progress = age / 1200;
          const currentRadius = snd.radius * progress;
          const alpha = 1 - progress;

          ctx.strokeStyle = isHeatmapMode
            ? `rgba(245, 158, 11, ${alpha * 0.9})`
            : isThermalMode
            ? `rgba(0, 255, 200, ${alpha * 0.7})`
            : `rgba(255, 255, 255, ${alpha * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(snd.x, snd.y, currentRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // 9. ANIMATION EFFECTS (Shooting Muzzle Flashes, Bullet Tracers, Melee Slash Swoosh, Tool Chopping Chips, Sparks, Floating Combat Text)
      animationEffects.forEach((eff) => {
        const age = now - eff.createdAt;
        if (age > eff.durationMs) return;
        const progress = age / eff.durationMs;
        const alpha = Math.max(0, 1 - progress);

        if (eff.type === 'gunshot') {
          // A. Gunshot Muzzle Flash
          const flashDist = 26;
          const flashX = eff.x + Math.cos(eff.angle) * flashDist;
          const flashY = eff.y + Math.sin(eff.angle) * flashDist;

          // Radial bright illumination burst
          const radGrad = ctx.createRadialGradient(flashX, flashY, 2, flashX, flashY, 35);
          radGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          radGrad.addColorStop(0.3, `rgba(254, 240, 138, ${alpha * 0.9})`);
          radGrad.addColorStop(0.7, `rgba(249, 115, 22, ${alpha * 0.6})`);
          radGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(flashX, flashY, 35, 0, Math.PI * 2);
          ctx.fill();

          // Starburst spikes
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const spkAngle = eff.angle + (i * Math.PI) / 3;
            const r = i % 2 === 0 ? 16 : 8;
            ctx.lineTo(flashX + Math.cos(spkAngle) * r, flashY + Math.sin(spkAngle) * r);
          }
          ctx.closePath();
          ctx.fill();

          // Bullet Tracers (Shotgun pellet spread)
          const targetDist = eff.range || 160;
          for (let p = -2; p <= 2; p++) {
            const spreadAngle = eff.angle + p * 0.08;
            ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.85})`;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(flashX, flashY);
            ctx.lineTo(flashX + Math.cos(spreadAngle) * targetDist, flashY + Math.sin(spreadAngle) * targetDist);
            ctx.stroke();
          }

          // Ejected Brass Shell Casing flying sideways
          const casingAngle = eff.angle + Math.PI / 2;
          const casingDist = 8 + progress * 16;
          const casingX = eff.x + Math.cos(casingAngle) * casingDist;
          const casingY = eff.y + Math.sin(casingAngle) * casingDist + progress * progress * 8; // gravity drop
          ctx.fillStyle = `rgba(234, 179, 8, ${alpha})`;
          ctx.fillRect(casingX - 1.5, casingY - 1, 3, 2);
        } else if (eff.type === 'melee_swing') {
          // B. Melee Weapon Curved Swoosh Arc
          const swingRadius = eff.range || 46;
          ctx.save();
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, swingRadius, eff.angle - 0.9, eff.angle + 0.9);
          ctx.strokeStyle = eff.color || `rgba(56, 189, 248, ${alpha * 0.9})`;
          ctx.lineWidth = 3.5;
          ctx.stroke();

          // Inner blade highlight
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, swingRadius - 6, eff.angle - 0.7, eff.angle + 0.7);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        } else if (eff.type === 'tool_chop') {
          // C. Tool Chop Flying Wood Chips & Sawdust
          for (let c = 0; c < 7; c++) {
            const seed = c * 1.3;
            const chipAngle = eff.angle + Math.sin(seed) * 1.6;
            const dist = progress * 24;
            const chipX = eff.x + Math.cos(chipAngle) * dist;
            const chipY = eff.y + Math.sin(chipAngle) * dist + progress * progress * 12; // gravity drop
            ctx.fillStyle = c % 2 === 0 ? `rgba(217, 119, 6, ${alpha})` : `rgba(254, 215, 170, ${alpha})`;
            ctx.fillRect(chipX - 1.5, chipY - 1.5, 3, 3);
          }
        } else if (eff.type === 'tool_hammer') {
          // D. Construction Sparks & Dust Puff
          for (let s = 0; s < 8; s++) {
            const spkAngle = (s * Math.PI) / 4;
            const dist = progress * 20;
            const sx = eff.x + Math.cos(spkAngle) * dist;
            const sy = eff.y + Math.sin(spkAngle) * dist;
            ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
            ctx.fillRect(sx - 1, sy - 1, 2, 2);
          }
        } else if (eff.type === 'shield_block') {
          // E. Shield Kinetic Energy Deflection Pulse
          const barrierRadius = 24 + progress * 12;
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.95})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, barrierRadius, eff.angle - 0.8, eff.angle + 0.8);
          ctx.stroke();

          // Hexagonal sparks bouncing off
          for (let b = 0; b < 5; b++) {
            const spkAngle = eff.angle + (b - 2) * 0.35;
            const bx = eff.x + Math.cos(spkAngle) * (barrierRadius + progress * 15);
            const by = eff.y + Math.sin(spkAngle) * (barrierRadius + progress * 15);
            ctx.fillStyle = `rgba(186, 230, 253, ${alpha})`;
            ctx.fillRect(bx - 1, by - 1, 2.5, 2.5);
          }
        } else if (eff.type === 'spark') {
          // F. Sparks on impact
          for (let i = 0; i < 4; i++) {
            const spkAngle = eff.angle + (i - 1.5) * 0.8;
            const sx = eff.x + Math.cos(spkAngle) * (progress * 15);
            const sy = eff.y + Math.sin(spkAngle) * (progress * 15);
            ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`;
            ctx.fillRect(sx - 1, sy - 1, 2, 2);
          }
        } else if (eff.type === 'floating_text' && eff.text) {
          // G. Floating Combat / Action Text
          ctx.save();
          const floatOffset = progress * 22;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';

          // Black border outline for crisp readability
          ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.95})`;
          ctx.lineWidth = 3;
          ctx.strokeText(eff.text, eff.x, eff.y - floatOffset);

          ctx.fillStyle = eff.color || `rgba(255, 255, 255, ${alpha})`;
          ctx.fillText(eff.text, eff.x, eff.y - floatOffset);
          ctx.restore();
        }
      });

      // 10. Ghost Placement Preview (Green box when placing a structure)
      if (placementGhost) {
        const gx = mousePos.x - placementGhost.width / 2;
        const gy = mousePos.y - placementGhost.height / 2;

        ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.fillRect(gx, gy, placementGhost.width, placementGhost.height);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx, gy, placementGhost.width, placementGhost.height);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`Place: ${placementGhost.item.name} [Scroll: Rotate 90° · Left-Click: Place · Right-Click: Finish]`, gx, gy - 6);
      }

      // 11. Floating Contextual Interaction Prompt
      if (activePrompt && !placementGhost) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        const promptText = activePrompt.actionLabel;
        ctx.font = 'bold 11px monospace';
        const textWidth = ctx.measureText(promptText).width;
        const px = Math.min(960 - textWidth - 25, Math.max(15, activePrompt.x - textWidth / 2 - 8));
        const py = Math.max(25, activePrompt.y - 25);

        ctx.beginPath();
        ctx.roundRect(px, py, textWidth + 16, 20, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.fillText(promptText, px + 8, py + 14);
        ctx.restore();
      }

      // Direct hover highlight when mouse is positioned directly over an interactable object
      const mx = mousePos.x;
      const my = mousePos.y;
      const hoveredDirectStructure = structures.find((s) => {
        const isInteractable =
          s.type === 'door_wood' ||
          s.type === 'door_stone' ||
          s.type === 'wall_brick' ||
          s.type === 'abandoned_car' ||
          s.type === 'riverbed_clay' ||
          s.type === 'tree' ||
          s.type === 'loot_container' ||
          s.type === 'ground_scrap_wood' ||
          s.type === 'tv_set' ||
          s.type === 'workbench' ||
          s.type === 'kitchen_stove' ||
          s.type === 'campfire' ||
          s.type === 'bed' ||
          s.type === 'sleeping_mat' ||
          s.type === 'rain_collector' ||
          (s.type === 'fruit_bush' && (s.fruitCount ?? 0) > 0);
        if (!isInteractable) return false;
        return (
          mx >= s.x - 5 &&
          mx <= s.x + s.width + 5 &&
          my >= s.y - 5 &&
          my <= s.y + s.height + 5
        );
      });

      const hoveredDirectNpc = npcs.find((n) => Math.hypot(n.x - mx, n.y - my) <= 22);

      if (hoveredDirectStructure && !placementGhost) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(
          hoveredDirectStructure.x - 2,
          hoveredDirectStructure.y - 2,
          hoveredDirectStructure.width + 4,
          hoveredDirectStructure.height + 4
        );
        ctx.setLineDash([]);

        const isToolBox =
          hoveredDirectStructure.name.toLowerCase().includes('tool box') ||
          hoveredDirectStructure.name.toLowerCase().includes('toolbox');

        const actionName =
          hoveredDirectStructure.type === 'ground_scrap_wood'
            ? 'Pick Up Scrap Wood'
            : hoveredDirectStructure.type === 'tv_set'
            ? 'Emergency TV'
            : hoveredDirectStructure.type === 'door_wood'
            ? (hoveredDirectStructure.isOpen ? 'Close Door' : 'Open Door')
            : isToolBox
            ? 'Loot Tool Box'
            : hoveredDirectStructure.type === 'loot_container'
            ? 'Loot Chest'
            : hoveredDirectStructure.type === 'workbench'
            ? 'Workbench'
            : hoveredDirectStructure.type === 'kitchen_stove' || hoveredDirectStructure.type === 'campfire'
            ? 'Kitchen'
            : hoveredDirectStructure.type === 'bed' || hoveredDirectStructure.type === 'sleeping_mat'
            ? 'Sleep'
            : hoveredDirectStructure.type === 'rain_collector'
            ? 'Water'
            : 'Harvest';

        const tagText = `[Right-Click: ${actionName}]`;
        ctx.font = 'bold 10px monospace';
        const tagW = ctx.measureText(tagText).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mx + 12, my - 22, tagW + 10, 18, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.fillText(tagText, mx + 17, my - 9);
        ctx.restore();
      } else if (hoveredDirectNpc && !placementGhost) {
        ctx.save();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(hoveredDirectNpc.x, hoveredDirectNpc.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const tagText = `[Right-Click: Speak]`;
        ctx.font = 'bold 10px monospace';
        const tagW = ctx.measureText(tagText).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mx + 12, my - 22, tagW + 10, 18, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#c084fc';
        ctx.fillText(tagText, mx + 17, my - 9);
        ctx.restore();
      }

      // 12. Crosshair / Aim Cursor with Panic Inaccuracy & Tremor
      const panicRatio = survivor.panic / 100;
      const tremorX = panicRatio > 0 ? (Math.sin(now * 0.045) + Math.cos(now * 0.071)) * panicRatio * 8 : 0;
      const tremorY = panicRatio > 0 ? (Math.cos(now * 0.039) + Math.sin(now * 0.063)) * panicRatio * 8 : 0;
      const cx = mousePos.x + tremorX;
      const cy = mousePos.y + tremorY;
      const crossRadius = 8 + panicRatio * 18;

      ctx.save();
      // If panicked, draw outer dispersion spread ring
      if (panicRatio > 0.15) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + panicRatio * 0.55})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, crossRadius * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = isThermalMode ? '#00f0ff' : panicRatio > 0.3 ? '#ef4444' : '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, crossRadius, 0, Math.PI * 2);
      ctx.moveTo(cx - crossRadius - 4, cy);
      ctx.lineTo(cx + crossRadius + 4, cy);
      ctx.moveTo(cx, cy - crossRadius - 4);
      ctx.lineTo(cx, cy + crossRadius + 4);
      ctx.stroke();

      if (panicRatio > 0.2) {
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#f87171';
        ctx.fillText(`AIM: -${Math.round(survivor.panic)}% [PANIC]`, cx + 12, cy + 14);
      }
      ctx.restore();

      // 13. In-world Comic / Tactical Speech Bubble above Survivor's Head
      if (speechBubble && speechBubble.expiresAt > Date.now()) {
        ctx.save();
        const bubbleX = survivor.x;
        const bubbleY = survivor.y - 28;

        ctx.font = 'bold 10px monospace';
        const maxTextWidth = 220;
        const words = speechBubble.text.split(' ');
        const lines: string[] = [];
        let curLine = '';

        for (const w of words) {
          const test = curLine ? `${curLine} ${w}` : w;
          if (ctx.measureText(test).width > maxTextWidth && curLine) {
            lines.push(curLine);
            curLine = w;
          } else {
            curLine = test;
          }
        }
        if (curLine) lines.push(curLine);

        let longestLineW = 0;
        for (const line of lines) {
          const lw = ctx.measureText(line).width;
          if (lw > longestLineW) longestLineW = lw;
        }

        const padX = 10;
        const padY = 7;
        const lineHeight = 13;
        const bubbleW = Math.max(100, longestLineW + padX * 2);
        const bubbleH = lines.length * lineHeight + padY * 2 + 10;
        const boxLeft = bubbleX - bubbleW / 2;
        const boxTop = bubbleY - bubbleH;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(boxLeft + 2, boxTop + 2, bubbleW, bubbleH, 6);
        ctx.fill();

        // Bubble Box
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(boxLeft, boxTop, bubbleW, bubbleH, 6);
        ctx.fill();
        ctx.stroke();

        // Speech Pointer Tail towards survivor
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.beginPath();
        ctx.moveTo(bubbleX - 6, boxTop + bubbleH - 0.5);
        ctx.lineTo(bubbleX + 6, boxTop + bubbleH - 0.5);
        ctx.lineTo(bubbleX, boxTop + bubbleH + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bubbleX - 6, boxTop + bubbleH - 0.5);
        ctx.lineTo(bubbleX, boxTop + bubbleH + 8);
        ctx.lineTo(bubbleX + 6, boxTop + bubbleH - 0.5);
        ctx.stroke();

        // Speaker label
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'left';
        ctx.fillText(`💬 ${(speechBubble.speaker || 'James').toUpperCase()}`, boxLeft + padX, boxTop + padY + 6);

        // Text lines
        ctx.font = 'bold 9.5px monospace';
        ctx.fillStyle = '#f8fafc';
        let ty = boxTop + padY + 19;
        for (const l of lines) {
          ctx.fillText(l, boxLeft + padX, ty);
          ty += lineHeight;
        }

        ctx.restore();
      }

      ctx.restore(); // Restore camera transform

      // Screen-space lens water droplets during rain
      if (isRainingWeather && !isThermalMode) {
        ctx.save();
        for (let d = 0; d < 14; d++) {
          const dSeed = d * 133.7;
          const cycle = (now * 0.05 + dSeed * 10) % 700;
          const lx = (dSeed * 61) % width;
          const ly = ((dSeed * 97) % (height * 0.85)) + cycle * 0.25;
          const dropAlpha = Math.max(0, 0.32 - (cycle / 700) * 0.32);
          ctx.fillStyle = `rgba(186, 230, 253, ${dropAlpha})`;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 2.5, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [
    survivor,
    zombies,
    npcs,
    structures,
    bloodSplats,
    soundEvents,
    noiseHeatmap,
    placementGhost,
    environment,
    activePrompt,
    animationEffects,
    mousePos,
    isThermalMode,
    isHeatmapMode,
    zoom,
    buildings,
    speechBubble,
    getCameraOffset,
  ]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-neutral-950 overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        width={960}
        height={600}
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        className={`w-full h-full object-contain border border-neutral-800 ${
          isHoveringInteractable ? 'cursor-pointer' : 'cursor-crosshair'
        }`}
      />

      {/* Canvas Top Bar Controls & Mode Toggles */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
        {/* Set Current House/Structure As Home Base Button */}
        {currentShelter && onSetAsBase && (
          <button
            onClick={onSetAsBase}
            title={`Set "${currentShelter.name}" as your colony's Home Base. Minimap will point here and survivors will focus maintenance in Sector [${currentShelter.sectorX}, ${currentShelter.sectorY}].`}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold rounded border bg-emerald-950/95 border-emerald-500 text-emerald-200 hover:bg-emerald-900 transition-colors shadow-md"
          >
            <Home className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">SET AS BASE</span>
            <span className="sm:hidden">BASE</span>
          </button>
        )}

        {/* Day / Night Cycle Phase Indicator */}
        {(() => {
          const dn = getDayNightInfo(environment.cycleSeconds ?? 360);
          return (
            <div
              title={`Cycle: 40m Day / 20m Night. ${dn.phaseText}. Zombies seek buildings/trees during day.`}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded border transition-colors shadow-sm ${
                dn.isDay
                  ? 'bg-amber-950/85 border-amber-600/75 text-amber-200'
                  : 'bg-indigo-950/90 border-indigo-600/75 text-indigo-200'
              }`}
            >
              {dn.isDay ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span className="font-bold">{dn.isDay ? 'DAY' : 'NIGHT'}</span>
              <span className="text-[10px] opacity-80">({dn.remainingMinutes}m left)</span>
            </div>
          );
        })()}

        {/* Tactical Zoom Controls Overlay */}
        <div className="flex items-center bg-neutral-900/90 border border-neutral-700 rounded px-1 py-0.5 text-[11px] font-mono shadow-sm">
          <button
            onClick={handleZoomOut}
            title="Zoom Out ([-] or [[])"
            disabled={zoom <= 0.6}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-300 disabled:opacity-40 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetZoom}
            title="Reset Zoom to 100% ([0])"
            className="px-2 py-0.5 text-neutral-200 hover:text-cyan-400 font-semibold transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            title="Zoom In ([+] or []])"
            disabled={zoom >= 2.25}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-300 disabled:opacity-40 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Heatmap Overlay Toggle */}
        <button
          onClick={onToggleHeatmap}
          title="Toggle Visual Noise Heatmap Overlay (H)"
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded border transition-colors ${
            isHeatmapMode
              ? 'bg-amber-950 border-amber-500 text-amber-300 shadow-sm'
              : 'bg-neutral-900/90 border-neutral-700 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">{isHeatmapMode ? 'HEATMAP ON' : 'HEATMAP'}</span>
        </button>

        {/* Thermal FLIR Toggle */}
        <button
          onClick={onToggleThermal}
          title="Toggle Thermal FLIR Sensor (T)"
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded border transition-colors ${
            isThermalMode
              ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-sm'
              : 'bg-neutral-900/90 border-neutral-700 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">{isThermalMode ? 'FLIR ON' : 'OPTICAL'}</span>
        </button>

        {/* Flashlight */}
        <button
          onClick={onToggleFlashlight}
          title="Toggle Tactical Flashlight Beam (F)"
          className={`p-1.5 rounded border transition-colors ${
            survivor.flashlightOn
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-neutral-900/90 border-neutral-700 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Flashlight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sleeping Indicator Overlay */}
      {survivor.isSleeping && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-neutral-950/90 border border-sky-500/80 px-4 py-2 rounded text-sky-200 text-xs font-mono shadow-xl flex items-center gap-3 backdrop-blur-md z-30 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <span>Asleep in Bed: Rapidly recovering stamina & fatigue. Press <strong>[E]</strong> to Wake Up.</span>
        </div>
      )}

      {/* Placement Mode Active Banner */}
      {placementGhost && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-emerald-950/95 border border-emerald-600 px-4 py-2 rounded text-emerald-200 text-xs font-mono shadow-xl flex items-center gap-3 backdrop-blur-md z-30">
          <span>Placing: <strong>{placementGhost.item.name}</strong></span>
          <span className="text-neutral-400">|</span>
          <span className="text-neutral-300">Scroll Wheel = Rotate 90° · Left-Click = Place · Right-Click = Finish</span>
        </div>
      )}
    </div>
  );
};
