import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../utils/audio';
import { Radio, Volume2, VolumeX, FastForward, Play } from 'lucide-react';

interface IntroTvCutsceneProps {
  onComplete: () => void;
}

export const IntroTvCutscene: React.FC<IntroTvCutsceneProps> = ({ onComplete }) => {
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const hasFinishedRef = useRef<boolean>(false);
  const breachSoundPlayedRef = useRef<boolean>(false);
  const moan1PlayedRef = useRef<boolean>(false);
  const moan2PlayedRef = useRef<boolean>(false);
  const staticSoundPlayedRef = useRef<boolean>(false);

  // Complete and enter game safely
  const finishCutscene = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    soundManager.stopAceAttorneyZombieTheme();
    soundManager.playTvClick();
    onComplete();
  };

  // Start Ace Attorney style dramatic pursuit theme on mount, clean up on unmount
  useEffect(() => {
    soundManager.playTvClick();
    soundManager.playTvStatic(0.3);
    soundManager.playAceAttorneyZombieTheme();

    return () => {
      soundManager.stopAceAttorneyZombieTheme();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Keyboard shortcut: Space, Enter, or Escape to skip immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        finishCutscene();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Elapsed time state tracker
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 0.1);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Timed dramatic sound events
  useEffect(() => {
    if (elapsedSec >= 3.6 && !breachSoundPlayedRef.current) {
      breachSoundPlayedRef.current = true;
      soundManager.playMeleeHit(true);
      soundManager.playHammerSound();
      soundManager.playZombieMoan(1.2);
    }
    if (elapsedSec >= 7.0 && !moan1PlayedRef.current) {
      moan1PlayedRef.current = true;
      soundManager.playZombieMoan(1.4);
    }
    if (elapsedSec >= 11.5 && !moan2PlayedRef.current) {
      moan2PlayedRef.current = true;
      soundManager.playZombieMoan(1.6);
      soundManager.playMeleeHit(true);
    }
    if (elapsedSec >= 15.0 && !staticSoundPlayedRef.current) {
      staticSoundPlayedRef.current = true;
      soundManager.playTvStatic(1.2);
    }
  }, [elapsedSec]);

  // Canvas Store Simulation Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startTime = performance.now();

    // Store survivors data (3 survivors holding out)
    const survivors = [
      { id: 'james', x: 200, y: 220, targetX: 200, hp: 100, color: '#334155', weapon: 'shotgun' },
      { id: 'sarah', x: 170, y: 150, targetX: 170, hp: 100, color: '#b91c1c', weapon: 'bat' },
      { id: 'marcus', x: 140, y: 280, targetX: 140, hp: 100, color: '#15803d', weapon: 'crowbar' },
    ];

    // Zombies in the store
    const storeZombies: {
      x: number;
      y: number;
      targetX: number;
      targetY: number;
      speed: number;
      clothesColor: string;
      hp: number;
      enterTimeSec: number;
    }[] = [
      // Wave 1: pounding outside glass doors
      { x: 580, y: 200, targetX: 210, targetY: 220, speed: 0.9, clothesColor: '#3f3f46', hp: 100, enterTimeSec: 3.5 },
      { x: 590, y: 240, targetX: 200, targetY: 230, speed: 1.3, clothesColor: '#52525b', hp: 100, enterTimeSec: 3.6 },
      { x: 585, y: 170, targetX: 170, targetY: 160, speed: 1.1, clothesColor: '#27272a', hp: 100, enterTimeSec: 3.8 },
      { x: 595, y: 270, targetX: 150, targetY: 270, speed: 0.8, clothesColor: '#365314', hp: 100, enterTimeSec: 4.0 },
      // Wave 2: sprinting in through shattered glass
      { x: 620, y: 210, targetX: 200, targetY: 220, speed: 1.6, clothesColor: '#1e293b', hp: 100, enterTimeSec: 4.8 },
      { x: 630, y: 150, targetX: 170, targetY: 155, speed: 1.4, clothesColor: '#78350f', hp: 100, enterTimeSec: 5.2 },
      { x: 640, y: 290, targetX: 140, targetY: 280, speed: 1.2, clothesColor: '#451a03', hp: 100, enterTimeSec: 5.5 },
      // Wave 3: flanking from back store aisle & side shelves
      { x: 400, y: 40, targetX: 180, targetY: 150, speed: 1.1, clothesColor: '#581c87', hp: 100, enterTimeSec: 6.5 },
      { x: 450, y: 390, targetX: 150, targetY: 270, speed: 1.3, clothesColor: '#1c1917', hp: 100, enterTimeSec: 7.0 },
      { x: 650, y: 230, targetX: 190, targetY: 220, speed: 1.8, clothesColor: '#172554', hp: 100, enterTimeSec: 7.5 },
      { x: 660, y: 180, targetX: 160, targetY: 160, speed: 1.4, clothesColor: '#064e3b', hp: 100, enterTimeSec: 8.2 },
      { x: 480, y: 60, targetX: 160, targetY: 150, speed: 1.2, clothesColor: '#7f1d1d', hp: 100, enterTimeSec: 8.8 },
      { x: 670, y: 260, targetX: 135, targetY: 280, speed: 1.5, clothesColor: '#374151', hp: 100, enterTimeSec: 9.2 },
      { x: 680, y: 220, targetX: 190, targetY: 220, speed: 1.7, clothesColor: '#312e81', hp: 100, enterTimeSec: 9.8 },
    ];

    // Splatter effects on floor
    const bloodSplatters: { x: number; y: number; r: number; color: string }[] = [
      { x: 380, y: 220, r: 8, color: '#7f1d1d' },
      { x: 260, y: 170, r: 12, color: '#991b1b' },
      { x: 480, y: 250, r: 10, color: '#7f1d1d' },
    ];

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const width = canvas.width;
      const height = canvas.height;

      // Clear Screen with gritty supermarket floor base
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // 1. Supermarket Tile Grid (16x16 tiles)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      const tileSize = 24;
      for (let x = 0; x < width; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Pre-existing & dynamic Blood Splatters
      bloodSplatters.forEach((b) => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r, b.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Store Grocery Shelves (Metal gondolas with products)
      const shelves = [
        { x: 260, y: 70, w: 180, h: 26 },
        { x: 260, y: 180, w: 180, h: 26 },
        { x: 260, y: 290, w: 180, h: 26 },
        { x: 70, y: 60, w: 28, h: 140 },
      ];

      shelves.forEach((s) => {
        // Shelf shadow
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(s.x + 3, s.y + 4, s.w, s.h);

        // Shelf base
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(s.x, s.y, s.w, s.h);

        // Colorful product boxes / cans
        for (let bx = s.x + 4; bx < s.x + s.w - 8; bx += 8) {
          ctx.fillStyle = ['#f59e0b', '#06b6d4', '#10b981', '#ef4444', '#8b5cf6'][
            (bx * 7) % 5
          ];
          ctx.fillRect(bx, s.y + 3, 6, s.h - 6);
        }
      });

      // 4. Checkout Counter (Cash register barricade)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(50, 180, 45, 140);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(50, 180, 45, 140);

      // Cash register
      ctx.fillStyle = '#334155';
      ctx.fillRect(60, 210, 22, 16);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(64, 212, 14, 4);

      // Overturned shopping cart
      ctx.save();
      ctx.translate(210, 340);
      ctx.rotate(0.5);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(-15, -10, 30, 20);
      ctx.restore();

      // 5. Store Entrance Glass Doors (Right side x=540)
      const isBreached = elapsed >= 3.5;
      if (!isBreached) {
        // Intact doors with banging vibrations
        const bangOffset = Math.sin(now * 0.05) * 2;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 3;
        ctx.strokeRect(540 + bangOffset, 120, 8, 200);

        // Glass reflection lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(542, 140);
        ctx.lineTo(546, 190);
        ctx.moveTo(542, 230);
        ctx.lineTo(546, 280);
        ctx.stroke();

        // Cracks appearing as time reaches 3.0s
        if (elapsed > 2.0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(544, 200);
          ctx.lineTo(540, 190);
          ctx.lineTo(548, 180);
          ctx.stroke();
        }
      } else {
        // Shattered glass shards scattered on floor
        ctx.fillStyle = 'rgba(186, 230, 253, 0.6)';
        for (let i = 0; i < 30; i++) {
          const gx = 480 + (i * 19) % 80;
          const gy = 130 + (i * 23) % 180;
          ctx.fillRect(gx, gy, 3, 3);
        }
      }

      // 6. Update & Render Survivor Sprites
      const survivorsAreOverwhelmed = elapsed >= 10.0;
      survivors.forEach((surv, sIdx) => {
        // Survivors slowly get backed up as zombies advance
        if (elapsed > 4.0 && !survivorsAreOverwhelmed) {
          surv.x = Math.max(90, surv.targetX - (elapsed - 4.0) * 8);
        }

        const isShooting = elapsed > 3.6 && elapsed < 9.5 && Math.sin(now * 0.02 + sIdx) > 0.4;
        const angle = isShooting ? 0.05 * Math.sin(now * 0.03) : -0.1 + sIdx * 0.1;

        ctx.save();
        ctx.translate(surv.x, surv.y);

        // Flashlight beam illuminating the store
        if (!survivorsAreOverwhelmed) {
          ctx.save();
          ctx.rotate(angle);
          const flashGrad = ctx.createRadialGradient(0, 0, 10, 180, 0, 220);
          flashGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
          flashGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
          ctx.fillStyle = flashGrad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 240, -0.28, 0.28);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        ctx.rotate(angle);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Torso
        ctx.fillStyle = surv.color;
        ctx.fillRect(-7, -8, 14, 16);

        // Head
        ctx.fillStyle = '#f5d0a9';
        ctx.beginPath();
        ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Arms holding weapon
        ctx.fillStyle = '#f5d0a9';
        ctx.fillRect(4, -6, 9, 3);
        ctx.fillRect(4, 3, 9, 3);

        // Equipped Weapon
        if (surv.weapon === 'shotgun') {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(8, 2, 18, 3.5);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(5, 2, 5, 3.5);

          // Muzzle flash when firing
          if (isShooting) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(28, 3, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(28, 3, 3, 0, Math.PI * 2);
            ctx.fill();

            // Bullet tracer rays
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(30, 3);
            ctx.lineTo(260 + Math.random() * 80, (Math.random() - 0.5) * 40);
            ctx.stroke();
          }
        } else {
          // Melee crowbar / bat
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(8, 1, 14, 3);
        }

        ctx.restore();

        // Overwhelmed blood / damage indicator
        if (elapsed > 8.0 + sIdx * 1.5) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('CRITICAL', surv.x - 16, surv.y - 14);
        }
      });

      // 7. Update & Render Zombie Horde
      storeZombies.forEach((z) => {
        if (elapsed < z.enterTimeSec) return;

        // Move towards nearest survivor
        const target = survivors[0];
        const dx = target.x - z.x;
        const dy = target.y - z.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          z.x += (dx / dist) * z.speed * (isBreached ? 1 : 0.2);
          z.y += (dy / dist) * z.speed * (isBreached ? 1 : 0.2);
        }

        ctx.save();
        ctx.translate(z.x, z.y);

        const zAngle = Math.atan2(dy, dx);
        const wobble = Math.sin(now * 0.008 + z.x) * 0.12;
        ctx.rotate(zAngle + wobble);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Decayed clothes
        ctx.fillStyle = z.clothesColor;
        ctx.fillRect(-6, -7, 12, 14);

        // Decayed zombie skin (greenish-gray)
        ctx.fillStyle = '#718071';
        ctx.beginPath();
        ctx.arc(4, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Outstretched clawing arms
        ctx.fillStyle = '#718071';
        ctx.fillRect(4, -6, 11, 3);
        ctx.fillRect(4, 3, 11, 3);

        // Blood stains on chest
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(-1, -2, 4, 5);

        ctx.restore();
      });

      // 8. Late stage swarm: Survivors completely swarmed!
      if (survivorsAreOverwhelmed) {
        // Red flashing alert vignette
        const redPulse = Math.abs(Math.sin(now * 0.005)) * 0.4;
        ctx.fillStyle = `rgba(185, 28, 28, ${redPulse})`;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('⚠️ SURVIVOR PERIMETER COMPROMISED // STORE OVERRUN', 20, 40);
      }

      // 9. CCTV Overlay (Camera timestamp, location, recording dot)
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('CAM-04 · FRESHMART CONVENIENCE #12 // AISLE 2', 14, 20);

      const timeStamp = new Date().toLocaleTimeString();
      ctx.fillText(`18:42:19 EST · ${timeStamp}`, width - 180, 20);

      // Red blinking "LIVE REC"
      const recBlink = Math.sin(now * 0.006) > 0;
      if (recBlink) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(width - 200, 16, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('REC', width - 225, 20);
      }

      // 10. VHS Noise / Static Distortion as signal fails
      if (elapsed > 14.0) {
        const noiseCount = Math.floor((elapsed - 14.0) * 150);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (let i = 0; i < noiseCount; i++) {
          ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 40, 1.5);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleSkip = () => {
    finishCutscene();
  };

  // Full scrolling breaking news text
  const TICKER_TEXT =
    '🔴 BREAKING NEWS // CDC AND STATE POLICE DECLARE LEVEL-5 BIOLOGICAL OUTBREAK IN CHARVAL COUNTY // VIOLENT RESURRECTED AFFLICTED OVERRUNNING COMMERCIAL OUTLETS AND RETAIL SUPERSTORES // NATIONAL GUARD EVACUATION CORRIDORS COMPROMISED // RESIDENTS URGED: RETREAT TO RESIDENCES AND BARRICADE ALL ACCESS POINTS // NO FURTHER RESCUE MISSIONS SCHEDULED // GOD HELP US ALL // SURVIVOR PROTOCOL INITIATED // SWITCHING TO LOCAL RADIO TRANSMISSION...';

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-between p-3 sm:p-5 overflow-hidden select-none font-mono">
      {/* Background ambient red glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(220, 38, 38, 0.45), transparent 70%)',
        }}
      />

      {/* Top Bar: Emergency timestamp and Skip Button */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 text-xs text-neutral-400 border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-red-950/80 border border-red-700/80 rounded-md text-red-300 animate-pulse font-bold">
            <Radio className="w-3.5 h-3.5" />
            <span>EMERGENCY BROADCAST · LIVE SURVEILLANCE FEED</span>
          </div>
          <span className="hidden sm:inline text-neutral-500">SECTOR 4 CCTV</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMute}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 rounded text-neutral-300 transition-colors text-xs"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>
          <button
            onClick={handleSkip}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-500 text-cyan-200 rounded text-xs font-bold transition-all shadow-lg shadow-cyan-950/40"
          >
            <span>Skip [SPACE]</span>
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Centerpiece: Retro 1990s CRT Television Monitor displaying the Store Siege */}
      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center my-auto">
        <div className="relative w-full bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 border-4 border-neutral-700/90 rounded-3xl p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.95)]">
          {/* Top vents */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="w-4 h-1 bg-neutral-950/80 rounded-full" />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* The CRT Glass Screen */}
            <div className="md:col-span-10 relative overflow-hidden rounded-2xl bg-black border-4 border-neutral-950 shadow-inner flex flex-col justify-between">
              {/* Scanline CRT overlay filter */}
              <div
                className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay opacity-50"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)',
                }}
              />

              {/* CRT Glass curvature & corner vignetting */}
              <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] border border-neutral-800/40 rounded-2xl" />

              {/* Live Canvas Feed of the Supermarket Siege */}
              <canvas
                ref={canvasRef}
                width={640}
                height={420}
                className="w-full h-auto aspect-4/3 object-cover block bg-black"
              />

              {/* Breaking News Banner at the bottom of the CRT screen with scrolling text */}
              <div className="relative z-20 bg-neutral-950/98 border-t-2 border-red-600 flex items-center overflow-hidden h-9">
                {/* Red "BREAKING NEWS" badge on the left */}
                <div className="shrink-0 z-10 px-2.5 sm:px-3 h-full bg-red-600 text-white font-black text-[10.5px] uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>BREAKING NEWS</span>
                </div>

                {/* Smooth scrolling ticker that transitions to the game when finished */}
                <div className="flex-1 overflow-hidden relative h-full flex items-center bg-black/90">
                  <div
                    onAnimationEnd={finishCutscene}
                    className="whitespace-nowrap inline-block text-amber-300 font-bold text-xs pl-[100%] will-change-transform"
                    style={{
                      animation: 'newsTickerScroll 22s linear forwards',
                    }}
                  >
                    {TICKER_TEXT}
                  </div>
                </div>
              </div>
            </div>

            {/* CRT TV Controls on the right panel */}
            <div className="md:col-span-2 flex md:flex-col justify-around items-center gap-4 py-2 border-t md:border-t-0 md:border-l border-neutral-700/80 px-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">CCTV TUNER</span>
                <div className="w-11 h-11 rounded-full bg-neutral-900 border-2 border-neutral-600 shadow-lg flex items-center justify-center relative cursor-pointer hover:border-cyan-500">
                  <div className="w-1 h-3.5 bg-cyan-400 rounded-full -translate-y-1.5" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">VOLUME</span>
                <div className="w-9 h-9 rounded-full bg-neutral-900 border-2 border-neutral-600 shadow-lg flex items-center justify-center relative cursor-pointer hover:border-cyan-500">
                  <div className="w-1 h-2.5 bg-neutral-300 rounded-full -translate-y-1" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5 mt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                  <span className="text-[8.5px] text-neutral-300 font-bold">ALERT</span>
                </div>
                <div className="w-9 h-3.5 bg-neutral-950 border border-neutral-700 rounded-sm flex items-center px-1">
                  <div className="w-3 h-2 bg-red-600 rounded-xs ml-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Narrative subtext */}
        <div className="mt-3 flex flex-col items-center text-center space-y-0.5 text-neutral-400">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>Freshmart Supermarket CCTV feed · Dewey Street</span>
          </div>
          <span className="text-[10.5px] text-neutral-500">
            Civilian survivors overwhelmed by horde. Transitioning to safehouse after broadcast.
          </span>
        </div>
      </div>

      {/* Bottom CTA to start game immediately */}
      <div className="w-full max-w-4xl flex items-center justify-center z-10 pt-2">
        <button
          onClick={handleSkip}
          className="flex items-center gap-2 px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer transform hover:scale-105 active:scale-98"
        >
          <Play className="w-4 h-4 fill-black" />
          <span>Enter Safehouse & Begin Survival</span>
        </button>
      </div>

      {/* Inline styles for the smooth news ticker keyframe */}
      <style>{`
        @keyframes newsTickerScroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
};
