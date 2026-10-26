import React, { useState } from 'react';
import { CraftingRecipe, Survivor } from '../types/game';
import { WORKBENCH_RECIPES } from '../utils/craftingRecipes';
import {
  X,
  Hammer,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Sparkles,
  Info,
  Shield,
  Crosshair,
  Wrench,
} from 'lucide-react';

interface WorkbenchCraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  survivor: Survivor;
  isNearWorkbench: boolean;
  onCraft: (recipe: CraftingRecipe) => void;
  asSidePanel?: boolean;
}

// ============================================================================
// CRISP SVG ICONS FOR ALL TOOLS AND WEAPONS
// ============================================================================

// TIER 1 ICONS
const ScrapSawIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <path
      d="M10 38 L38 38 L34 26 L14 26 Z"
      stroke="#ca8a04"
      strokeWidth="2.5"
      strokeLinejoin="round"
      fill="#ca8a04"
      fillOpacity="0.25"
    />
    <path d="M12 38 L8 42 L14 42 Z" fill="#ca8a04" />
    <path
      d="M14 26 L16 22 L18 26 L20 22 L22 26 L24 22 L26 26 L28 22 L30 26 L32 22 L34 26"
      stroke="#e2e8f0"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="14" y1="34" x2="34" y2="34" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
  </svg>
);

const ScrapHammerIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <path d="M14 38 L30 16" stroke="#ca8a04" strokeWidth="4" strokeLinecap="round" />
    <rect
      x="24"
      y="8"
      width="18"
      height="12"
      rx="2"
      transform="rotate(-45 33 14)"
      stroke="#94a3b8"
      strokeWidth="2.5"
      fill="#64748b"
      fillOpacity="0.4"
    />
    <circle cx="28" cy="18" r="1.5" fill="#f59e0b" />
  </svg>
);

const BentCrowbarIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <path
      d="M10 40 L30 18 C33 15, 38 12, 40 14 C42 16, 40 20, 36 22 L34 23"
      stroke="#38bdf8"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M38 13 L42 10" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M8 42 L12 38" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const MakeshiftShovelIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <line x1="14" y1="40" x2="32" y2="18" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" />
    <path d="M10 44 L16 38" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" />
    <path
      d="M28 22 L38 12 C42 16, 40 22, 34 28 Z"
      stroke="#cbd5e1"
      strokeWidth="2.5"
      fill="#475569"
      fillOpacity="0.45"
      strokeLinejoin="round"
    />
  </svg>
);

// TIER 2 ICONS (STONE / IRON ERA)
const IronSawIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <path d="M8 38 L40 38 L36 22 L12 22 Z" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" fill="#0369a1" fillOpacity="0.3" />
    <path d="M10 38 L6 42 L12 42 Z" fill="#64748b" />
    <path d="M12 22 L14 17 L16 22 L18 17 L20 22 L22 17 L24 22 L26 17 L28 22 L30 17 L32 22 L34 17 L36 22" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="36" cy="22" r="2" fill="#38bdf8" />
  </svg>
);

const ClawHammerIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <path d="M14 38 L30 16" stroke="#ca8a04" strokeWidth="4" strokeLinecap="round" />
    <path d="M22 14 L34 6 C37 10, 39 12, 42 10 L38 18 L26 22 Z" fill="#94a3b8" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
    <path d="M35 7 C38 4, 43 5, 44 8" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="18" y="32" width="6" height="4" fill="#0f172a" rx="1" />
  </svg>
);

const TemperedCrowbarIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <path d="M10 40 L30 16 C33 13, 38 10, 41 12 C44 14, 42 19, 37 22 L35 23" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M39 11 L43 8" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
    <path d="M8 42 L13 37" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const SteelSpadeIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <line x1="14" y1="40" x2="32" y2="18" stroke="#ca8a04" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M10 44 L16 38" stroke="#ca8a04" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M27 23 L37 11 C42 15, 41 23, 33 29 Z" stroke="#38bdf8" strokeWidth="2.5" fill="#334155" fillOpacity="0.7" strokeLinejoin="round" />
    <line x1="30" y1="20" x2="36" y2="14" stroke="#94a3b8" strokeWidth="2" />
  </svg>
);

const SpikedClubIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <line x1="12" y1="38" x2="34" y2="14" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
    <line x1="28" y1="20" x2="36" y2="12" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
    <line x1="30" y1="12" x2="26" y2="8" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="38" y1="18" x2="43" y2="15" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="35" y1="11" x2="41" y2="7" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const PipeMacheteIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <path d="M12 38 L20 30" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M19 31 L38 12 C41 10, 44 14, 40 19 L25 33 Z" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const PipeShotgunIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <path d="M8 34 C12 30, 16 28, 20 26 L22 28 L14 36 Z" fill="#78350f" stroke="#451a03" strokeWidth="1.5" />
    <line x1="20" y1="26" x2="42" y2="14" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
    <line x1="28" y1="23" x2="30" y2="27" stroke="#cbd5e1" strokeWidth="2" />
  </svg>
);

// TIER 3 ICONS (INDUSTRIAL / STEEL / CONCRETE ERA)
const MotorizedSawIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    {/* Motor Engine housing */}
    <rect x="8" y="16" width="16" height="18" rx="3" fill="#ea580c" stroke="#c2410c" strokeWidth="2" />
    <path d="M12 16 L12 11 L18 11 L18 16" stroke="#475569" strokeWidth="2" fill="none" />
    <circle cx="16" cy="25" r="4" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
    {/* Guide bar */}
    <path d="M24 21 L42 21 C44 21, 45 23, 45 25 C45 27, 44 29, 42 29 L24 29 Z" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="2" />
    {/* Rotating chain teeth */}
    <path d="M26 19 L28 21 L30 19 L32 21 L34 19 L36 21 L38 19 L40 21" stroke="#f8fafc" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M26 31 L28 29 L30 31 L32 29 L34 31 L36 29 L38 31 L40 29" stroke="#f8fafc" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SledgehammerIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <line x1="10" y1="42" x2="32" y2="16" stroke="#ca8a04" strokeWidth="4.5" strokeLinecap="round" />
    {/* Heavy octagonal steel sledge head */}
    <path
      d="M26 10 L34 4 L44 14 L38 20 Z"
      fill="#475569"
      stroke="#94a3b8"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <line x1="28" y1="18" x2="34" y2="12" stroke="#e2e8f0" strokeWidth="2" />
    <rect x="18" y="30" width="6" height="4" fill="#0f172a" rx="1" />
  </svg>
);

const HeavyBreakerIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    {/* Hydraulic breaker cylinder */}
    <rect x="12" y="14" width="22" height="12" rx="2" transform="rotate(-45 23 20)" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
    {/* Hardened chisel head */}
    <path d="M30 10 L38 2 L42 6 L34 14 Z" fill="#e2e8f0" stroke="#f8fafc" strokeWidth="2" />
    {/* Dual hand grips */}
    <line x1="8" y1="36" x2="16" y2="44" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="18" y1="26" x2="12" y2="32" stroke="#64748b" strokeWidth="4" />
  </svg>
);

const PowerTrencherIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    {/* Trenching motor chassis */}
    <rect x="8" y="12" width="18" height="14" rx="2" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
    {/* Rotary cutting disc with carbide teeth */}
    <circle cx="34" cy="30" r="11" fill="#334155" stroke="#cbd5e1" strokeWidth="2" />
    <circle cx="34" cy="30" r="4" fill="#0f172a" stroke="#eab308" strokeWidth="1.5" />
    {/* Teeth */}
    <line x1="34" y1="16" x2="34" y2="19" stroke="#f8fafc" strokeWidth="2" />
    <line x1="34" y1="41" x2="34" y2="44" stroke="#f8fafc" strokeWidth="2" />
    <line x1="20" y1="30" x2="23" y2="30" stroke="#f8fafc" strokeWidth="2" />
    <line x1="45" y1="30" x2="48" y2="30" stroke="#f8fafc" strokeWidth="2" />
  </svg>
);

const WorkbenchUpgradeMaxIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    {/* Heavy Machinist Station */}
    <rect x="6" y="24" width="36" height="18" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
    {/* Overhead hydraulic press ram */}
    <rect x="18" y="6" width="12" height="14" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
    <line x1="24" y1="20" x2="24" y2="24" stroke="#38bdf8" strokeWidth="3" />
    {/* Precision dial indicator */}
    <circle cx="12" cy="32" r="3" fill="#38bdf8" />
    <line x1="12" y1="32" x2="14" y2="30" stroke="#0f172a" strokeWidth="1" />
    {/* Lathe leadscrew */}
    <line x1="18" y1="35" x2="38" y2="35" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="3 2" />
  </svg>
);

const ChainsawWeaponIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <rect x="6" y="18" width="16" height="16" rx="3" fill="#b91c1c" stroke="#dc2626" strokeWidth="2" />
    <path d="M10 18 L10 12 L16 12 L16 18" stroke="#94a3b8" strokeWidth="2" />
    <path d="M22 22 L42 22 C44 22, 45 24, 45 26 C45 28, 44 30, 42 30 L22 30 Z" fill="#475569" stroke="#cbd5e1" strokeWidth="2" />
    <line x1="24" y1="20" x2="40" y2="20" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" />
    <line x1="24" y1="32" x2="40" y2="32" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" />
  </svg>
);

const DemolitionSledgeWeaponIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    <line x1="10" y1="42" x2="34" y2="14" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
    <rect x="26" y="6" width="18" height="16" rx="2" transform="rotate(-45 35 14)" stroke="#ef4444" strokeWidth="2.5" fill="#1e293b" />
    <circle cx="35" cy="14" r="3" fill="#ef4444" />
  </svg>
);

const TacticalRifleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    {/* Tactical assault rifle profile */}
    <path d="M6 28 L14 28 L18 24 L44 24 L44 27 L26 27 L24 33 L18 33 L16 28 Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round" />
    {/* Barrel */}
    <line x1="38" y1="25.5" x2="46" y2="25.5" stroke="#94a3b8" strokeWidth="3" />
    {/* Extended Mag */}
    <path d="M24 27 L22 37 L26 37 L27 27" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
    {/* Optical sight */}
    <rect x="22" y="19" width="10" height="4" rx="1" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
  </svg>
);

const SteelCrossbowIcon = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor">
    {/* Crossbow stock */}
    <line x1="24" y1="12" x2="24" y2="42" stroke="#451a03" strokeWidth="4" strokeLinecap="round" />
    {/* Curved high-tensile steel limbs */}
    <path d="M8 20 Q24 10 40 20" stroke="#38bdf8" strokeWidth="3" fill="none" strokeLinecap="round" />
    {/* High-tension cables */}
    <line x1="8" y1="20" x2="24" y2="32" stroke="#e2e8f0" strokeWidth="1.5" />
    <line x1="40" y1="20" x2="24" y2="32" stroke="#e2e8f0" strokeWidth="1.5" />
    {/* Steel bolt */}
    <line x1="24" y1="12" x2="24" y2="28" stroke="#ef4444" strokeWidth="2" />
  </svg>
);

export const WorkbenchCraftModal: React.FC<WorkbenchCraftModalProps> = ({
  isOpen,
  onClose,
  survivor,
  isNearWorkbench,
  onCraft,
  asSidePanel = false,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 't1' | 't2' | 't3'>('all');
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Flexible item count finder
  const getItemCount = (itemId: string, name: string): number => {
    const qName = name.toLowerCase();
    return survivor.inventory.reduce((sum, item) => {
      const iName = item.name.toLowerCase();
      const iId = item.id.toLowerCase();

      // Treated Planks
      if (qName.includes('treated plank') || itemId.includes('treated_plank')) {
        if (iName.includes('treated plank') || iId.includes('treated_plank')) return sum + (item.count ?? 1);
      }
      // Concrete Mix
      else if (qName.includes('concrete') || itemId.includes('concrete')) {
        if (iName.includes('concrete') || iId.includes('concrete')) return sum + (item.count ?? 1);
      }
      // Steel Plates
      else if (qName.includes('steel plate') || itemId.includes('steel_plate')) {
        if (iName.includes('steel plate') || iId.includes('steel_plate')) return sum + (item.count ?? 1);
      }
      // Gravel
      else if (qName.includes('gravel') || itemId.includes('gravel')) {
        if (iName.includes('gravel') || iId.includes('gravel')) return sum + (item.count ?? 1);
      }
      // Scrap Wood matching
      else if (qName.includes('scrap wood') || itemId.includes('scrap_wood')) {
        if (iName.includes('scrap wood') || iId.includes('scrap_wood') || iName.includes('wood branch') || iId.includes('twigs')) {
          return sum + (item.count ?? 1);
        }
      }
      // Scrap Metal / Scrap Steel matching
      else if (qName.includes('scrap metal') || itemId.includes('scrap_metal') || qName.includes('scrap steel') || itemId.includes('scrap_steel')) {
        if ((iName.includes('scrap metal') || iName.includes('scrap steel') || iId.includes('scrap_metal') || iId.includes('scrap_steel') || iId === 'inv_scrap') && !iName.includes('plate') && !iId.includes('plate')) {
          return sum + (item.count ?? 1);
        }
      }
      // Nails matching
      else if (qName.includes('nail') || itemId.includes('nail')) {
        if (iName.includes('nail') || iId.includes('nail')) {
          return sum + (item.count ?? 1);
        }
      }
      // Simple Wood Planks matching
      else if ((qName.includes('plank') || itemId.includes('plank')) && !qName.includes('treated')) {
        if ((iName.includes('plank') || iId.includes('plank')) && !iName.includes('treated') && !iId.includes('treated')) {
          return sum + (item.count ?? 1);
        }
      }
      // Hardwood Logs matching
      else if (qName.includes('hardwood') || itemId.includes('hardwood')) {
        if (iName.includes('hardwood') || iId.includes('hardwood')) {
          return sum + (item.count ?? 1);
        }
      }
      // Iron Pipe matching
      else if (qName.includes('iron pipe') || itemId.includes('iron_pipe')) {
        if (iName.includes('pipe') || iId.includes('pipe')) {
          return sum + (item.count ?? 1);
        }
      }
      // Dense Clay matching
      else if (qName.includes('dense clay') || itemId.includes('dense_clay')) {
        if (iName.includes('clay') || iId.includes('clay')) {
          return sum + (item.count ?? 1);
        }
      }
      // Stone Blocks matching
      else if (qName.includes('stone') || itemId.includes('stone')) {
        if (iName.includes('stone') || iId.includes('stone')) {
          return sum + (item.count ?? 1);
        }
      }
      // Generic check
      else if (item.id === itemId || iName.includes(qName) || qName.includes(iName)) {
        return sum + (item.count ?? 1);
      }

      return sum;
    }, 0);
  };


  // ROW 1: TIER 1 FOUNDATIONAL SCRAP TOOLS
  const tier1Tools = [
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_scrap_saw') || WORKBENCH_RECIPES[0],
      icon: <ScrapSawIcon />,
      subtitle: 'Tier 1 Felling & Timber Tool',
      note: 'Cuts down trees for simple wood planks.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_scrap_hammer') || WORKBENCH_RECIPES[1],
      icon: <ScrapHammerIcon />,
      subtitle: 'Tier 1 Demolition Tool',
      note: 'Knocks down fences for half the wood/nails of walls. Cannot break building walls.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_bent_crowbar') || WORKBENCH_RECIPES[2],
      icon: <BentCrowbarIcon />,
      subtitle: 'Tier 1 Prying & Blunt Club',
      note: 'Breaks down grey loot boxes into metal strips. Strong melee bludgeon.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_makeshift_shovel') || WORKBENCH_RECIPES[3],
      icon: <MakeshiftShovelIcon />,
      subtitle: 'Tier 1 Trench Spade',
      note: 'Digs dirt trenches outside, collects topsoil, slows zombies 25%.',
    },
  ];

  // ROW 2: TIER 2 TOOLS & WEAPONS (STONE / IRON ERA)
  const tier2Tools = [
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_iron_saw'),
      icon: <IronSawIcon />,
      subtitle: 'Tier 2 Crosscut Logging Saw',
      note: 'Cuts down trees to harvest tough Hardwood Logs.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_claw_hammer'),
      icon: <ClawHammerIcon />,
      subtitle: 'Tier 2 Masonry Breaker',
      note: 'Demolishes building brick walls to salvage Stone Blocks.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_tempered_crowbar'),
      icon: <TemperedCrowbarIcon />,
      subtitle: 'Tier 2 Heavy Pry Bar',
      note: 'Pries open abandoned cars & heavy salvage to yield Iron Pipes.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_steel_spade'),
      icon: <SteelSpadeIcon />,
      subtitle: 'Tier 2 Alluvial Clay Spade',
      note: 'Excavates riverbeds & clay deposits to yield Dense Clay.',
    },
  ].filter((t): t is typeof t & { recipe: CraftingRecipe } => !!t.recipe);

  const tier2Weapons = [
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_spiked_club'),
      icon: <SpikedClubIcon />,
      subtitle: 'Tier 2 Heavy Melee Weapon',
      note: 'Hardwood club with iron sleeve & spikes. High impact damage.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_pipe_machete'),
      icon: <PipeMacheteIcon />,
      subtitle: 'Tier 2 Slashing Weapon',
      note: 'Honed iron pipe cleaver. Fast, lethal slashing damage.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_pipe_shotgun'),
      icon: <PipeShotgunIcon />,
      subtitle: 'Tier 2 Improvised Firearm',
      note: 'Single-barrel pipe shotgun chambered for 12g buckshot shells.',
    },
  ].filter((w): w is typeof w & { recipe: CraftingRecipe } => !!w.recipe);

  // ROW 3: TIER 3 GATHERING TOOLS (STEEL / CONCRETE INDUSTRIAL ERA)
  const tier3Tools = [
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_motorized_saw'),
      icon: <MotorizedSawIcon />,
      subtitle: 'Tier 3 Industrial Saw',
      note: 'Fells Utility Poles to harvest chemically treated planks.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_sledgehammer'),
      icon: <SledgehammerIcon />,
      subtitle: 'Tier 3 Demolition Hammer',
      note: 'Pulverizes home foundations into raw Concrete Mix.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_heavy_breaker'),
      icon: <HeavyBreakerIcon />,
      subtitle: 'Tier 3 Hydraulic Pry Breaker',
      note: 'Breaches Bank Vaults & heavy objects to yield Steel Plates.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_power_trencher'),
      icon: <PowerTrencherIcon />,
      subtitle: 'Tier 3 Rotary Rock Trencher',
      note: 'Pulverizes bedrock boulders and rocks to yield Gravel.',
    },
  ].filter((t): t is typeof t & { recipe: CraftingRecipe } => !!t.recipe);

  // TIER 3 WEAPONS (CRAFTED WITH TIER 3 MATERIALS)
  const tier3Weapons = [
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_chainsaw_weapon'),
      icon: <ChainsawWeaponIcon />,
      subtitle: 'Tier 3 Devastating Chainsaw (95 DMG)',
      note: 'Gas-powered twin-handled industrial chainsaw. Continuous laceration damage.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_heavy_demolition_sledge'),
      icon: <DemolitionSledgeWeaponIcon />,
      subtitle: 'Tier 3 Forged Sledge (105 DMG)',
      note: 'Forged high-carbon steel demolition hammer with lead core.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_tactical_combat_rifle'),
      icon: <TacticalRifleIcon />,
      subtitle: 'Tier 3 Assault Rifle (140 DMG)',
      note: 'Precision automatic assault rifle with steel receiver and treated stock.',
    },
    {
      recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_steel_crossbow'),
      icon: <SteelCrossbowIcon />,
      subtitle: 'Tier 3 Steel Crossbow (115 DMG)',
      note: 'Compound high-tensile steel limbs firing quad-fletched bolts.',
    },
  ].filter((w): w is typeof w & { recipe: CraftingRecipe } => !!w.recipe);

  // WORKBENCH MAX UPGRADE
  const workbenchUpgrade = WORKBENCH_RECIPES.find((r) => r.id === 'bench_upgrade_max')
    ? {
        recipe: WORKBENCH_RECIPES.find((r) => r.id === 'bench_upgrade_max')!,
        icon: <WorkbenchUpgradeMaxIcon />,
        subtitle: 'Max Tier 3 Machinist Station',
        note: 'Upgrades the workbench to a Max Tier 3 Industrial Workshop with hydraulic press and precision lathe.',
      }
    : null;

  const renderRecipeCard = (item: { recipe: CraftingRecipe; icon: React.ReactNode; subtitle: string; note: string }) => {
    const { recipe, icon, subtitle, note } = item;
    const isHovered = hoveredCardId === recipe.id;

    // Ingredient checks: white if enough items on hand, red if missing!
    const ingredientStatuses = recipe.ingredients.map((ing) => {
      const onHand = getItemCount(ing.itemId, ing.name);
      const hasEnough = onHand >= ing.count;
      return {
        name: ing.name,
        count: ing.count,
        onHand,
        hasEnough,
      };
    });

    const canAfford = ingredientStatuses.every((s) => s.hasEnough);
    const hasEndurance = survivor.endurance >= recipe.enduranceCost;
    const canCraft = canAfford && hasEndurance && isNearWorkbench;

    return (
      <div
        key={recipe.id}
        onMouseEnter={() => setHoveredCardId(recipe.id)}
        onMouseLeave={() => setHoveredCardId((prev) => (prev === recipe.id ? null : prev))}
        onClick={() => {
          if (canCraft) {
            onCraft(recipe);
          }
        }}
        className={`relative rounded-2xl border transition-all duration-200 cursor-pointer min-h-[140px] flex flex-col justify-between overflow-hidden select-none ${
          canCraft
            ? isHovered
              ? 'bg-neutral-850 border-amber-400 shadow-lg shadow-amber-500/10'
              : 'bg-neutral-950/80 border-neutral-700/80 hover:border-amber-500/70'
            : isHovered
            ? 'bg-neutral-900 border-neutral-600'
            : 'bg-neutral-950/60 border-neutral-800'
        }`}
      >
        {/* Base Card Content: Compact Icon + Title + Readiness Badge */}
        <div className="flex flex-col items-center text-center p-3 my-auto">
          <div className="p-2 rounded-xl bg-neutral-900/90 border border-neutral-800 mb-2">
            {icon}
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-neutral-100 tracking-tight">{recipe.name}</h4>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${
                canCraft
                  ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400'
              }`}
            >
              {canCraft ? '✓ Ready' : 'Need Items'}
            </span>
          </div>
          <span className="text-[8.5px] text-neutral-500 mt-1 opacity-70">
            Hover for info
          </span>
        </div>

        {/* Hover Pop-Up: Description, Materials List, and Forge Action */}
        {isHovered && (
          <div
            className="absolute inset-0 z-40 bg-neutral-950/98 border-2 border-amber-500/90 rounded-2xl p-3 shadow-2xl flex flex-col justify-between backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => {
              if (canCraft) {
                e.stopPropagation();
                onCraft(recipe);
              }
            }}
          >
            <div className="overflow-y-auto pr-0.5">
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-neutral-800">
                <span className="text-xs font-bold text-amber-300 truncate">{recipe.name}</span>
                <span className="text-[9px] font-bold text-neutral-400 uppercase">Recipe</span>
              </div>

              {/* Note / Description */}
              <p className="text-[10px] text-neutral-300 leading-snug mb-2 font-sans">
                {note}
              </p>

              {/* Required Materials List */}
              <div className="space-y-1">
                <div className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider flex items-center justify-between">
                  <span>Materials:</span>
                  <span className={canAfford ? 'text-emerald-400 text-[8.5px]' : 'text-rose-400 text-[8.5px]'}>
                    {canAfford ? '✓ Ready' : 'Missing'}
                  </span>
                </div>
                {ingredientStatuses.map((ing) => (
                  <div
                    key={ing.name}
                    className={`text-[10px] font-mono flex items-center justify-between px-1.5 py-0.5 rounded ${
                      ing.hasEnough
                        ? 'text-white bg-white/5 font-semibold'
                        : 'text-red-400 bg-red-950/30 font-bold border border-red-900/50'
                    }`}
                  >
                    <span className="truncate mr-1.5">{ing.name}</span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {ing.onHand}/{ing.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Forge Button */}
            <button
              type="button"
              disabled={!canCraft}
              onClick={(e) => {
                e.stopPropagation();
                if (canCraft) onCraft(recipe);
              }}
              className={`w-full mt-2 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                canCraft
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md cursor-pointer active:scale-98'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{canCraft ? 'Forge Item' : !isNearWorkbench ? 'Approach Bench' : 'Missing Materials'}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const innerContent = (
    <div
      className={`bg-neutral-900 border-neutral-750 flex flex-col font-mono select-none overflow-hidden ${
        asSidePanel
          ? 'w-full h-full border-0'
          : 'border rounded-2xl max-w-5xl w-full max-h-[92vh] shadow-2xl'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-950/80 border border-amber-600/80 flex items-center justify-center text-amber-300">
            <Hammer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider text-neutral-100 uppercase flex items-center gap-2">
              <span>Workbench Assembly Station</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Range Badge */}
          {isNearWorkbench ? (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Bench In Range
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-800 font-bold">
              <Lock className="w-3.5 h-3.5" /> Out of Range (&gt;3m)
            </span>
          )}

          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
            title="Close Workbench"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tier Filter Tabs */}
      <div className="px-5 py-2 bg-neutral-950/70 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'all'
              ? 'bg-neutral-800 text-amber-400 border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Hammer className="w-3.5 h-3.5" />
          <span>All Eras (Full Grid)</span>
        </button>
        <button
          onClick={() => setActiveTab('t1')}
          className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 't1'
              ? 'bg-amber-950/70 text-amber-300 border border-amber-800'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Tier 1: Scrap Era (4 Tools)</span>
        </button>
        <button
          onClick={() => setActiveTab('t2')}
          className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 't2'
              ? 'bg-sky-950/70 text-sky-300 border border-sky-800'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Tier 2: Stone/Iron Era (Tools & Weapons)</span>
        </button>
        <button
          onClick={() => setActiveTab('t3')}
          className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 't3'
              ? 'bg-purple-950/70 text-purple-300 border border-purple-800'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Tier 3: Steel/Concrete Era (Upgrade, Tools & Weapons)</span>
        </button>
      </div>

      {/* Workbench Warning if out of range */}
      {!isNearWorkbench && (
        <div className="bg-rose-950/40 border-b border-rose-800/80 px-5 py-2 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            <strong>WORKBENCH REQUIRED:</strong> Stand within arm&apos;s reach of a Carpentry Workbench to forge tools.
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* ROW 1: TIER 1 FOUNDATIONAL SCRAP TOOLS */}
        {(activeTab === 'all' || activeTab === 't1') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-amber-400">Row 1:</span>
                <span>Tier 1 Foundational Scrap Tools</span>
                <span className="text-[10px] text-neutral-500">(Scrap wood & simple materials)</span>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {tier1Tools.map(renderRecipeCard)}
            </div>
          </div>
        )}

        {/* ROW 2: TIER 2 STONE/IRON ERA TOOLS & WEAPONS */}
        {(activeTab === 'all' || activeTab === 't2') && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-sky-400">Row 2A:</span>
                  <span>Tier 2 Gathering Tools (Hardwood, Stone, Pipes, Clay)</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {tier2Tools.map(renderRecipeCard)}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-sky-400">Row 2B:</span>
                  <span>Tier 2 Weapons (Reinforced Spiked Club, Pipe Machete, Pipe Shotgun)</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {tier2Weapons.map(renderRecipeCard)}
              </div>
            </div>
          </div>
        )}

        {/* ROW 3: TIER 3 STEEL/CONCRETE INDUSTRIAL ERA */}
        {(activeTab === 'all' || activeTab === 't3') && (
          <div className="space-y-4">
            {/* WORKBENCH MAX UPGRADE */}
            {workbenchUpgrade && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-purple-400">Workbench Upgrade:</span>
                    <span>Max Industrial Machinist Workshop</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {renderRecipeCard(workbenchUpgrade)}
                </div>
              </div>
            )}

            {/* TIER 3 GATHERING TOOLS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-purple-400">Row 3A:</span>
                  <span>Tier 3 Gathering Tools (Motorized Saw, Sledgehammer, Heavy Breaker, Power Trencher)</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {tier3Tools.map(renderRecipeCard)}
              </div>
            </div>

            {/* TIER 3 WEAPONS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-purple-400">Row 3B:</span>
                  <span>Tier 3 Industrial Weapons (Chainsaw, Demolition Sledge, Tactical Rifle, Steel Crossbow)</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {tier3Weapons.map(renderRecipeCard)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Equip crafted tools to hand/tool slots to chop hardwood trees, break brick walls, pry cars, and dig dense clay.</span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-lg transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );

  if (asSidePanel) {
    return innerContent;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      {innerContent}
    </div>
  );
};
