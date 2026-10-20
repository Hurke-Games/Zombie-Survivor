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
  onPrimaryAction: (x: number, y: number) => void;
  onCancelPlacement: () => void;
  onCycleActiveSlot: (delta: number) => void;
  isThermalMode: boolean;
  onToggleThermal: () => void;
  isHeatmapMode: boolean;
  onToggleHeatmap: () => void;
  onToggleFlashlight: () => void;
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
  onPrimaryAction,
  onCancelPlacement,
  onCycleActiveSlot,
  isThermalMode,
  onToggleThermal,
  isHeatmapMode,
  onToggleHeatmap,
  onToggleFlashlight,
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

  // Right-click cancels placement
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (placementGhost) {
      onCancelPlacement();
    }
  };

  // Scroll wheel: Ctrl+Wheel zooms in/out, normal Wheel cycles Hand slots (W1, W2, Tool)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    } else {
      onCycleActiveSlot(e.deltaY > 0 ? 1 : -1);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    setMousePos({ x, y });
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
          if (s.isOpen) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            // Door swung open
            ctx.fillStyle = isThermalMode ? '#283b48' : '#55422f';
            ctx.fillRect(s.x - 4, s.y - 45, 12, 45);
            ctx.strokeStyle = isThermalMode ? '#3c586c' : '#2d2317';
            ctx.strokeRect(s.x - 4, s.y - 45, 12, 45);

            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(s.x + 4, s.y - 25, 4, 3);
          } else {
            ctx.fillStyle = isThermalMode ? '#3f596d' : '#685038';
            ctx.fillRect(s.x, s.y, s.width, s.height);
            ctx.strokeStyle = isThermalMode ? '#1e293b' : '#2c1e13';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(s.x, s.y, s.width, s.height);

            // Slide bolt
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(s.x + s.width / 2 - 10, s.y + s.height / 2 - 2, 20, 5);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(s.x + s.width / 2 - 2, s.y + s.height / 2 - 4, 4, 9);
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
          const isChest = s.name.toLowerCase().includes('chest');
          if (isChest) {
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
        if (s.hp < s.maxHp && (s.type.includes('wall') || s.type.includes('fence') || s.type === 'door_wood' || s.type === 'barricade_window')) {
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
        ctx.fillText(`Place: ${placementGhost.item.name} [Left Click]`, gx, gy - 6);
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

      ctx.restore(); // Restore camera transform

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
        className="w-full h-full object-contain cursor-crosshair border border-neutral-800"
      />

      {/* Canvas Top Bar Controls & Mode Toggles */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
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
          <span className="text-neutral-300">Left-Click = Place · Right-Click = Cancel</span>
        </div>
      )}
    </div>
  );
};
