import React, { useRef, useEffect, useState } from 'react';
import { Survivor, WorldStructure, Zombie, NpcSurvivor, BuildingBounds } from '../types/game';
import { Compass, Home, MapPin, Maximize2, Minimize2, Navigation } from 'lucide-react';

interface MiniMapProps {
  survivor: Survivor;
  structures: WorldStructure[];
  zombies: Zombie[];
  npcs: NpcSurvivor[];
  buildings: BuildingBounds[];
  homeX?: number; // Base safehouse coordinates
  homeY?: number;
  className?: string;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  survivor,
  structures,
  zombies,
  npcs,
  buildings,
  homeX = 480,
  homeY = 360,
  className = 'absolute top-14 right-3 z-30 select-none font-mono',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Calculate distance and compass direction to Home
  const dx = homeX - survivor.x;
  const dy = homeY - survivor.y;
  const distPixels = Math.hypot(dx, dy);
  const distMeters = Math.round(distPixels / 10);
  const angleToHome = Math.atan2(dy, dx);

  // Compass cardinal text
  const deg = (angleToHome * (180 / Math.PI) + 360) % 360;
  let cardinal = 'E';
  if (deg >= 22.5 && deg < 67.5) cardinal = 'SE';
  else if (deg >= 67.5 && deg < 112.5) cardinal = 'S';
  else if (deg >= 112.5 && deg < 157.5) cardinal = 'SW';
  else if (deg >= 157.5 && deg < 202.5) cardinal = 'W';
  else if (deg >= 202.5 && deg < 247.5) cardinal = 'NW';
  else if (deg >= 247.5 && deg < 292.5) cardinal = 'N';
  else if (deg >= 292.5 && deg < 337.5) cardinal = 'NE';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    // Scale: world pixels to radar pixels
    // Radar covers ~1200 world pixels in normal mode, ~2400 in expanded
    const radarRange = isExpanded ? 2400 : 1300;
    const scale = (width / 2) / (radarRange / 2);

    // Clear background
    ctx.fillStyle = 'rgba(10, 15, 20, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Grid rings
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, width * 0.22, 0, Math.PI * 2);
    ctx.arc(cx, cy, width * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx, height - 4);
    ctx.moveTo(4, cy);
    ctx.lineTo(width - 4, cy);
    ctx.stroke();

    // 1. Draw Buildings / Structures
    buildings.forEach((b) => {
      const rx = cx + (b.x + b.width / 2 - survivor.x) * scale;
      const ry = cy + (b.y + b.height / 2 - survivor.y) * scale;
      const rw = Math.max(3, b.width * scale);
      const rh = Math.max(3, b.height * scale);

      ctx.fillStyle = b.id === 'safehouse_bldg' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(100, 116, 139, 0.35)';
      ctx.strokeStyle = b.id === 'safehouse_bldg' ? '#10b981' : '#64748b';
      ctx.lineWidth = 1;
      ctx.fillRect(rx - rw / 2, ry - rh / 2, rw, rh);
      ctx.strokeRect(rx - rw / 2, ry - rh / 2, rw, rh);
    });

    // 2. Draw Key Structures (Rain Barrels & Storage Chests)
    structures.forEach((st) => {
      const sx = cx + (st.x + st.width / 2 - survivor.x) * scale;
      const sy = cy + (st.y + st.height / 2 - survivor.y) * scale;
      if (Math.hypot(sx - cx, sy - cy) > width / 2 - 4) return;

      if (st.type === 'rain_collector') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (st.type === 'loot_container') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
    });

    // 3. Draw Zombies (red blips)
    zombies.forEach((z) => {
      const zx = cx + (z.x - survivor.x) * scale;
      const zy = cy + (z.y - survivor.y) * scale;
      if (Math.hypot(zx - cx, zy - cy) > width / 2 - 4) return;

      ctx.fillStyle = z.state === 'tracking' ? '#ef4444' : 'rgba(239, 68, 68, 0.65)';
      ctx.beginPath();
      ctx.arc(zx, zy, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Draw NPCs / Survivors (cyan/emerald blips)
    npcs.forEach((n) => {
      const nx = cx + (n.x - survivor.x) * scale;
      const ny = cy + (n.y - survivor.y) * scale;
      if (Math.hypot(nx - cx, ny - cy) > width / 2 - 4) return;

      ctx.fillStyle = n.state === 'recruited' ? '#10b981' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(nx, ny, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. Home Safehouse Icon on Radar
    const homeRadarX = cx + (homeX - survivor.x) * scale;
    const homeRadarY = cy + (homeY - survivor.y) * scale;
    const distHomeOnRadar = Math.hypot(homeRadarX - cx, homeRadarY - cy);

    // If Home is within radar bounds: draw green home icon
    if (distHomeOnRadar <= width / 2 - 12) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(homeRadarX, homeRadarY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HOME', homeRadarX, homeRadarY - 6);
    }

    // 6. OUT-OF-BOUNDS POINTER TO HOME: Glowing compass arrow on the rim pointing to Home!
    const rimRadius = width / 2 - 9;
    const arrowX = cx + Math.cos(angleToHome) * rimRadius;
    const arrowY = cy + Math.sin(angleToHome) * rimRadius;

    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angleToHome + Math.PI / 2);

    // Glowing chevron pointing outwards to Home
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 7. Center: The Player (Cyan dot with direction needle)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(survivor.angle);

    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.restore();

    // Radar border
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, width / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [survivor, structures, zombies, npcs, buildings, homeX, homeY, isExpanded, angleToHome]);

  return (
    <div className={className}>
      <div className="bg-neutral-950/90 border border-emerald-600/70 rounded-lg p-2 shadow-2xl backdrop-blur-md flex flex-col items-center gap-1.5">
        {/* Top Header & Home Pointer Telemetry */}
        <div className="w-full flex items-center justify-between text-[10px] text-emerald-400 border-b border-neutral-800/80 pb-1 px-0.5">
          <div className="flex items-center gap-1">
            <Home className="w-3 h-3 text-emerald-400" />
            <span className="font-bold text-neutral-100">HOME:</span>
            <span className="text-emerald-300 font-semibold">{distMeters}m</span>
            <span className="text-neutral-400">({cardinal})</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Shrink Mini-Map' : 'Expand Mini-Map'}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>

        {/* Circular Radar Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={isExpanded ? 190 : 130}
            height={isExpanded ? 190 : 130}
            className="rounded-full shadow-inner"
          />

          {/* Compass Rose Labels */}
          <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-emerald-500/80">N</span>
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-emerald-500/80">S</span>
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-emerald-500/80">W</span>
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-emerald-500/80">E</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[8px] text-neutral-400">
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Base</span>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" /> You</span>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Supply</span>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Infected</span>
        </div>
      </div>
    </div>
  );
};
