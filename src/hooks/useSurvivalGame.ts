import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Survivor,
  Zombie,
  ZombieState,
  WorldStructure,
  EnvironmentState,
  SoundEvent,
  BloodSplat,
  FireEmitter,
  Item,
  CraftingRecipe,
  InteractablePrompt,
  PlacementGhost,
  ActiveHandSlot,
  ArmorSlot,
  VisualAnimationEffect,
  NpcSurvivor,
  NpcTask,
  WorldChunk,
  BuildingBounds,
  getDayNightInfo,
  SleepBlackoutState,
  HomeBase,
  SaveSlotData,
  SpeechBubble,
} from '../types/game';
import { generateDeterministicObservationLog } from '../utils/deterministicNarrator';
import { soundManager } from '../utils/audio';
import { BUILD_RECIPES, WORKBENCH_RECIPES } from '../utils/craftingRecipes';
import {
  CHUNK_SIZE,
  getChunkKey,
  getChunkCoords,
  generateChunk,
  isPointInsideBuilding,
  isPointInsideFencedOrSafeZone,
  getValidZombieSpawnLocation,
} from '../utils/proceduralWorld';

const GRID_COLS = 48; // 960 / 20
const GRID_ROWS = 30; // 600 / 20

// Distance from point to axis-aligned bounding box
export const getDistToBox = (px: number, py: number, bx: number, by: number, bw: number, bh: number) => {
  const nearestX = Math.max(bx, Math.min(px, bx + bw));
  const nearestY = Math.max(by, Math.min(py, by + bh));
  return Math.hypot(px - nearestX, py - nearestY);
};

export interface ZombieEvolutionMultipliers {
  speedMult: number;
  healthMult: number;
  damageMult: number;
  spawnRateMult: number;
  sightMult: number;
  hearingMult: number;
  smellMult: number;
  populationMult: number;
}

// Odds of rain: 10% base + 1% per day/sleep, capped at 40% (0.40)
export const getRainChance = (day: number): number => {
  return Math.min(0.40, 0.10 + Math.max(0, day - 1) * 0.01);
};

// Persistent PC cookie storage for individual computer high score
export const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

export const setCookie = (name: string, value: string, days = 3650) => {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

// Respawn zombies outside the current Home Base sector with compounding population multiplier
export const respawnZombiesOutsideHomeSector = (
  prevZombies: Zombie[],
  homeSecX: number,
  homeSecY: number,
  allStructures: WorldStructure[],
  allBuildings: BuildingBounds[],
  playerX: number,
  playerY: number,
  multipliers: ZombieEvolutionMultipliers
): Zombie[] => {
  // 1. Keep alive any zombies that are strictly inside the Home Base sector (home sector stays cleared)
  const homeZombies = prevZombies
    .filter(
      (z) =>
        z.hp > 0 &&
        Math.floor(z.x / 800) === homeSecX &&
        Math.floor(z.y / 800) === homeSecY
    )
    .map((z) => ({
      ...z,
      speed: z.speed * 1.02,
      maxHp: Math.round(z.maxHp * 1.02),
      hp: Math.min(Math.round(z.maxHp * 1.02), z.hp + 5),
    }));

  // 2. Desired target zombies outside the home sector (26 base * populationMult)
  const baseCountOutside = 26;
  const targetOutsideCount = Math.min(80, Math.round(baseCountOutside * multipliers.populationMult));

  const newOutsideZombies: Zombie[] = [];
  const zTypes: Zombie['type'][] = ['walker', 'shambler', 'crawler', 'bloated'];

  for (let i = 0; i < targetOutsideCount; i++) {
    let spawnX = 0;
    let spawnY = 0;
    let foundValid = false;

    for (let attempts = 0; attempts < 20; attempts++) {
      // Pick random coordinates across surrounding sectors (offset -2 to +2 sectors)
      const secOffsetX = Math.floor(Math.random() * 5) - 2;
      const secOffsetY = Math.floor(Math.random() * 5) - 2;
      const targetSecX = homeSecX + secOffsetX;
      const targetSecY = homeSecY + secOffsetY;

      // STRICTLY EXCLUDE CURRENT HOME BASE SECTOR!
      if (targetSecX === homeSecX && targetSecY === homeSecY) continue;

      const candX = targetSecX * 800 + 40 + Math.random() * 720;
      const candY = targetSecY * 800 + 40 + Math.random() * 720;

      // Must be outside enclosed buildings and outside safe fenced compounds
      if (isPointInsideBuilding(candX, candY, allBuildings, 10)) continue;
      if (isPointInsideFencedOrSafeZone(candX, candY, allStructures, 15)) continue;

      // Ensure minimum distance from player (at least 220px away)
      if (Math.hypot(candX - playerX, candY - playerY) < 220) continue;

      spawnX = candX;
      spawnY = candY;
      foundValid = true;
      break;
    }

    if (foundValid) {
      const zType = zTypes[Math.floor(Math.random() * zTypes.length)];
      const scaledHp = Math.round(
        (zType === 'shambler' ? 60 : zType === 'bloated' ? 58 : 50) * multipliers.healthMult
      );
      const scaledSpeed = (0.38 + Math.random() * 0.12) * multipliers.speedMult;
      newOutsideZombies.push({
        id: `respawn_z_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        x: spawnX,
        y: spawnY,
        angle: Math.random() * Math.PI * 2,
        hp: scaledHp,
        maxHp: scaledHp,
        speed: scaledSpeed,
        state: 'wandering',
        type: zType,
        clothingColor: Math.random() < 0.5 ? '#475569' : '#334155',
        biteChance: zType === 'bloated' ? 0.28 : 0.20,
      });
    }
  }

  return [...homeZombies, ...newOutsideZombies];
};

const INITIAL_SURVIVOR: Survivor = {
  name: 'Subject #704 (James Miller)',
  x: 480,
  y: 360,
  angle: 0,
  hp: 100,
  endurance: 100,
  fatigue: 0,
  hunger: 100, // 100% full, drains in ~30 minutes (0.055%/sec)
  thirst: 100, // 100% full, drains in ~10 minutes (0.167%/sec)
  panic: 0,
  illness: 0,
  boredom: 0,
  pain: 0,
  isBitten: false,
  virusProgress: 0,
  injuries: [],

  // Dedicated Equipment: Start barehanded!
  equippedWeapon: null,
  equippedWeapon2: null,
  equippedTool: null,
  activeSlot: 'weapon1',

  // Equipped Armor: Head, Chest, Legs, Gloves, Footwear
  equippedArmor: {
    head: {
      id: 'hardhat_init',
      name: 'Safety Hardhat',
      category: 'armor',
      armorSlot: 'head',
      armorDefense: 15,
      biteResistance: 30,
      description: 'Protects head from zombie cranial bites and debris.',
      weight: 0.8,
      durability: 90,
      maxDurability: 90,
    },
    chest: {
      id: 'vest_init',
      name: 'Padded Canvas Vest',
      category: 'armor',
      armorSlot: 'chest',
      armorDefense: 20,
      biteResistance: 25,
      description: 'Heavy layered canvas vest. Mitigates torso damage.',
      weight: 1.8,
      durability: 85,
      maxDurability: 100,
    },
    legs: {
      id: 'pants_init',
      name: 'Reinforced Cargo Pants',
      category: 'armor',
      armorSlot: 'legs',
      armorDefense: 15,
      biteResistance: 20,
      description: 'Tough denim with utility pockets.',
      weight: 1.2,
      durability: 90,
      maxDurability: 100,
    },
    gloves: {
      id: 'gloves_init',
      name: 'Leather Work Gloves',
      category: 'armor',
      armorSlot: 'gloves',
      armorDefense: 12,
      biteResistance: 35,
      description: 'Prevents lacerations to hands during combat.',
      weight: 0.3,
      durability: 80,
      maxDurability: 80,
    },
    footwear: {
      id: 'boots_init',
      name: 'Combat Work Boots',
      category: 'armor',
      armorSlot: 'footwear',
      armorDefense: 15,
      biteResistance: 30,
      description: 'Heavy rubber lug soles.',
      weight: 1.6,
      durability: 95,
      maxDurability: 100,
    },
  },

  isSleeping: false,
  isBlocking: false,

  inventory: [],
  maxCarryWeight: 26,
  flashlightOn: false,
  isSneaking: false,
  isRunning: false,
};

const INITIAL_STRUCTURES: WorldStructure[] = [
  // Shelter walls
  { id: 'wall_1', x: 340, y: 220, width: 280, height: 16, type: 'wall_wood', name: 'Pine Framing Wall', hp: 300, maxHp: 300, repairPlanks: 3, repairNails: 4 },
  { id: 'wall_2', x: 340, y: 220, width: 16, height: 260, type: 'wall_wood', name: 'West Exterior Wall', hp: 280, maxHp: 300, repairPlanks: 3, repairNails: 4 },
  { id: 'wall_3', x: 604, y: 220, width: 16, height: 260, type: 'wall_wood', name: 'East Wall', hp: 300, maxHp: 300, repairPlanks: 3, repairNails: 4 },
  { id: 'wall_4', x: 340, y: 464, width: 110, height: 16, type: 'wall_wood', name: 'South Wall Left', hp: 250, maxHp: 300, repairPlanks: 2, repairNails: 3 },
  { id: 'wall_5', x: 510, y: 464, width: 110, height: 16, type: 'wall_wood', name: 'South Wall Right', hp: 300, maxHp: 300, repairPlanks: 2, repairNails: 3 },
  // Doorway
  { id: 'door_south', x: 450, y: 464, width: 60, height: 16, type: 'door_wood', name: 'Reinforced Front Door', hp: 200, maxHp: 200, isOpen: false, repairPlanks: 2, repairNails: 4 },
  // Windows
  { id: 'win_barricade_1', x: 340, y: 310, width: 16, height: 50, type: 'barricade_window', name: 'Barricaded West Window', hp: 160, maxHp: 180, repairPlanks: 2, repairNails: 2 },
  { id: 'win_barricade_2', x: 604, y: 310, width: 16, height: 50, type: 'barricade_window', name: 'Barricaded East Window', hp: 120, maxHp: 180, repairPlanks: 2, repairNails: 2 },
  // Safehouse Perimeter Fencing (Zombies cannot spawn inside this fenced zone!)
  { id: 'fence_yard_n', x: 280, y: 155, width: 400, height: 12, type: 'fence_wood', name: 'Safehouse Wood Fence', hp: 150, maxHp: 150, repairPlanks: 1, repairNails: 2 },
  { id: 'fence_yard_w', x: 280, y: 155, width: 12, height: 355, type: 'fence_wood', name: 'Safehouse Wood Fence', hp: 150, maxHp: 150, repairPlanks: 1, repairNails: 2 },
  { id: 'fence_yard_e', x: 668, y: 155, width: 12, height: 355, type: 'fence_wood', name: 'Safehouse Wood Fence', hp: 150, maxHp: 150, repairPlanks: 1, repairNails: 2 },
  // Garden Berry Bush
  { id: 'fruit_yard_init', x: 305, y: 180, width: 36, height: 36, type: 'fruit_bush', name: 'Garden Blackberry Bush', hp: 60, maxHp: 60, fruitCount: 3, maxFruit: 3, lastHarvestTime: Date.now(), fruitType: 'Garden Blackberries' },
  // Tier 2 World Harvest Nodes in Sector [0, 0]
  { id: 'car_base_road', x: 180, y: 55, width: 72, height: 36, type: 'abandoned_car', name: 'Abandoned Station Wagon', hp: 350, maxHp: 350 },
  { id: 'riverbed_clay_base', x: 130, y: 470, width: 44, height: 44, type: 'riverbed_clay', name: 'Riverbed Clay Deposit', hp: 120, maxHp: 120 },
  { id: 'wall_brick_base', x: 280, y: 420, width: 14, height: 90, type: 'wall_brick', name: 'Weathered Red Brick Wall', hp: 400, maxHp: 400 },
  // Tier 3 Industrial Harvest Nodes in Sector [0, 0]
  { id: 'utility_pole_base', x: 270, y: 55, width: 20, height: 20, type: 'utility_pole', name: 'Roadside Utility Pole', hp: 200, maxHp: 200 },
  { id: 'home_foundation_base', x: 620, y: 460, width: 80, height: 28, type: 'home_foundation', name: 'Concrete Home Foundation', hp: 350, maxHp: 350 },
  { id: 'bank_vault_base', x: 690, y: 310, width: 50, height: 45, type: 'bank_vault', name: 'Reinforced Heavy Bank Vault', hp: 500, maxHp: 500 },
  { id: 'boulder_rock_base', x: 170, y: 220, width: 44, height: 40, type: 'boulder_rock', name: 'Granite Quarry Boulder', hp: 300, maxHp: 300 },
  // Furniture
  { id: 'furn_bed', x: 370, y: 245, width: 55, height: 75, type: 'bed', name: 'Sturdy Wooden Cot Bed', hp: 100, maxHp: 100 },
  { id: 'furn_workbench', x: 535, y: 245, width: 55, height: 45, type: 'workbench', name: 'Carpentry Workbench', hp: 180, maxHp: 180 },
  { id: 'furn_table', x: 450, y: 330, width: 50, height: 40, type: 'table_chair', name: 'Dining Table & Chair', hp: 80, maxHp: 80 },
  { id: 'furn_tv', x: 450, y: 236, width: 36, height: 26, type: 'tv_set', name: 'Flickering CRT Television', hp: 100, maxHp: 100 },
  { id: 'furn_stove', x: 370, y: 400, width: 45, height: 45, type: 'kitchen_stove', name: 'Field Kitchen Firebox', hp: 120, maxHp: 120, isLit: false },
  // Ground Scrap Wood scattered in the yard
  { id: 'scrap_wood_yard_1', x: 260, y: 220, width: 22, height: 20, type: 'ground_scrap_wood', name: 'Scrap Wood', hp: 1, maxHp: 1 },
  { id: 'scrap_wood_yard_2', x: 720, y: 240, width: 22, height: 20, type: 'ground_scrap_wood', name: 'Scrap Wood', hp: 1, maxHp: 1 },
  { id: 'scrap_wood_yard_3', x: 390, y: 520, width: 22, height: 20, type: 'ground_scrap_wood', name: 'Scrap Wood', hp: 1, maxHp: 1 },
  // Colony Storage Chest (Drop food & drinks here for survivors)
  {
    id: 'chest_base_1',
    x: 470,
    y: 250,
    width: 44,
    height: 32,
    type: 'loot_container',
    name: 'Colony Storage Chest',
    hp: 200,
    maxHp: 200,
    containedLoot: [
      { id: 'chest_stew_1', name: 'Canned Beef Chili', category: 'food', nutrition: 35, hydration: 10, count: 3, weight: 0.5, description: 'Hearty preserved chili.' },
      { id: 'chest_water_1', name: 'Clean Water Bottle', category: 'drink', hydration: 50, count: 3, weight: 1.0, description: 'Potable water bottle.' },
      { id: 'chest_jerky_1', name: 'Dried Beef Jerky', category: 'food', nutrition: 25, count: 2, weight: 0.2, description: 'Smoked jerky.' },
    ],
  },
  // Rain Collector Barrel in safehouse yard (holds up to 50 bottle refills)
  {
    id: 'rain_barrel_yard',
    x: 620,
    y: 175,
    width: 38,
    height: 38,
    type: 'rain_collector',
    name: 'Yard Rain Collector Barrel',
    hp: 180,
    maxHp: 180,
    waterStored: 20,
    maxWater: 50,
  },
  // Trees
  { id: 'tree_1', x: 200, y: 160, width: 36, height: 36, type: 'tree', name: 'Mature Pine Tree', hp: 60, maxHp: 60 },
  { id: 'tree_2', x: 230, y: 260, width: 36, height: 36, type: 'tree', name: 'Loblolly Pine', hp: 60, maxHp: 60 },
  { id: 'tree_3', x: 740, y: 190, width: 36, height: 36, type: 'tree', name: 'Overgrown Cedar', hp: 60, maxHp: 60 },
  { id: 'tree_4', x: 710, y: 410, width: 36, height: 36, type: 'tree', name: 'Tall Pine Tree', hp: 60, maxHp: 60 },
  // Containers
  {
    id: 'loot_pantry',
    x: 550,
    y: 395,
    width: 40,
    height: 35,
    type: 'loot_container',
    name: 'Kitchen Pantry Cupboard',
    hp: 80,
    maxHp: 80,
    containedLoot: [
      { id: 'pantry_can', name: 'Canned Baked Beans', category: 'food', description: 'Protein heavy legumes.', weight: 0.4, nutrition: 30, count: 2 },
      { id: 'pantry_knife', name: 'Kitchen Knife', category: 'weapon', weaponType: 'melee', description: 'Short blade.', weight: 0.4, durability: 65, maxDurability: 100, damage: 22, noise: 5, reach: 35 },
    ],
  },
  {
    id: 'loot_trunk',
    x: 230,
    y: 490,
    width: 65,
    height: 38,
    type: 'loot_container',
    name: 'Abandoned Sedan Trunk',
    hp: 200,
    maxHp: 200,
    containedLoot: [
      { id: 'trunk_duct_tape', name: 'Heavy Duct Tape', category: 'resource', description: 'Repairs tools.', weight: 0.3, count: 1 },
      { id: 'trunk_shotgun_shells', name: '12g Shotgun Shells', category: 'resource', description: 'Shotgun shells.', weight: 0.6, count: 6 },
    ],
  },
];

const INITIAL_ZOMBIES: Zombie[] = [
  { id: 'z1', x: 210, y: 380, angle: 0.4, hp: 50, maxHp: 50, speed: 0.45, state: 'wandering', type: 'shambler', clothingColor: '#475569', biteChance: 0.2 },
  { id: 'z2', x: 670, y: 280, angle: 3.1, hp: 60, maxHp: 60, speed: 0.4, state: 'wandering', type: 'walker', clothingColor: '#64748b', biteChance: 0.25 },
  { id: 'z3', x: 500, y: 560, angle: -1.5, hp: 55, maxHp: 55, speed: 0.35, state: 'wandering', type: 'bloated', clothingColor: '#334155', biteChance: 0.3 },
  { id: 'z4', x: 740, y: 520, angle: -2.1, hp: 45, maxHp: 45, speed: 0.48, state: 'idle', type: 'shambler', clothingColor: '#475569', biteChance: 0.2 },
  { id: 'z5', x: 180, y: 120, angle: 1.2, hp: 50, maxHp: 50, speed: 0.42, state: 'wandering', type: 'walker', clothingColor: '#525252', biteChance: 0.2 },
  { id: 'z6', x: 810, y: 330, angle: 2.8, hp: 55, maxHp: 55, speed: 0.38, state: 'wandering', type: 'crawler', clothingColor: '#3f3f46', biteChance: 0.15 },
];

export function useSurvivalGame() {
  const [survivor, setSurvivor] = useState<Survivor>(INITIAL_SURVIVOR);
  const [structures, setStructures] = useState<WorldStructure[]>(INITIAL_STRUCTURES);
  const [zombies, setZombies] = useState<Zombie[]>(INITIAL_ZOMBIES);
  const [bloodSplats, setBloodSplats] = useState<BloodSplat[]>([
    { x: 260, y: 390, radius: 14, intensity: 0.8 },
    { x: 630, y: 300, radius: 20, intensity: 0.6 },
  ]);
  const [fires] = useState<FireEmitter[]>([]);
  const [soundEvents, setSoundEvents] = useState<SoundEvent[]>([]);

  // 48x30 Acoustic Noise Heatmap
  const [noiseHeatmap, setNoiseHeatmap] = useState<number[][]>(() =>
    Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0))
  );

  // Structure Placement Mode Ghost State
  const [placementGhost, setPlacementGhost] = useState<PlacementGhost | null>(null);

  const [environment, setEnvironment] = useState<EnvironmentState>(() => {
    const initSec = 360; // 6 mins into 40m daylight
    const info = getDayNightInfo(initSec);
    return {
      day: 1,
      timeMinutes: Math.round(info.inGameMinutesOfDay),
      cycleSeconds: initSec,
      isDay: info.isDay,
      cycleRemainingMinutes: info.remainingMinutes,
      weather: 'Clear Cold',
      temperatureC: 17,
      gridPower: true,
      waterGrid: true,
      windSpeedKmh: 9,
      fogDensity: 0.08,
    };
  });

  const [activeLog, setActiveLog] = useState<string>('');
  const [availableActions, setAvailableActions] = useState<{ text: string; actionId: string; risk: 'low' | 'moderate' | 'high' | 'extreme' }[]>([]);
  const [isNarrating, setIsNarrating] = useState<boolean>(false);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [animationEffects, setAnimationEffects] = useState<VisualAnimationEffect[]>([]);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [deathCause, setDeathCause] = useState<string | null>(null);

  // Procedural Chunks & NPC Survivors State
  const [chunks, setChunks] = useState<Record<string, WorldChunk>>(() => {
    const baseChunk: WorldChunk = {
      chunkX: 0,
      chunkY: 0,
      key: '0,0',
      type: 'safehouse_base',
      name: 'Safehouse Sector 4B',
      structures: INITIAL_STRUCTURES,
      zombies: INITIAL_ZOMBIES,
      npcs: [],
      buildings: [
        { id: 'safehouse_bldg', name: 'Safehouse Residence', x: 340, y: 220, width: 280, height: 260 },
      ],
      generatedAt: Date.now(),
    };
    return { '0,0': baseChunk };
  });
  const [npcs, setNpcs] = useState<NpcSurvivor[]>([]);
  const [buildings, setBuildings] = useState<BuildingBounds[]>([
    { id: 'safehouse_bldg', name: 'Safehouse Residence', x: 340, y: 220, width: 280, height: 260 },
  ]);

  // Colony Storage Chest Modal active target
  const [activeChest, setActiveChest] = useState<WorldStructure | null>(null);

  // Screen Blackout during voluntary sleep or passing out
  const [sleepBlackout, setSleepBlackout] = useState<SleepBlackoutState | null>(null);

  // Hidden compounding zombie evolution multiplier (2% per sleep day reset, 10% on passing out)
  // Tracks: speed, health, attack damage, spawn rate, sight range, hearing range, sense of smell, and outside horde population
  const zombieMultiplierRef = useRef<ZombieEvolutionMultipliers>({
    speedMult: 1.0,
    healthMult: 1.0,
    damageMult: 1.0,
    spawnRateMult: 1.0,
    sightMult: 1.0,
    hearingMult: 1.0,
    smellMult: 1.0,
    populationMult: 1.0,
  });

  // High score tracking: Longest Survived Days (the primary goal & score!)
  // Tied strictly to the individual computer playing via localStorage and browser cookie.
  // Anyone that plays starts with a zero day record unless their computer remembers loading this game.
  const HIGH_SCORE_STORAGE_KEY = 'charval_longest_survived_days';
  const COOKIE_SCORE_KEY = 'charval_zombie_record';
  const [highScoreDays, setHighScoreDays] = useState<number>(() => {
    try {
      const savedLocal = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      if (savedLocal !== null && savedLocal !== '') {
        const parsed = parseInt(savedLocal, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
      const savedCookie = getCookie(COOKIE_SCORE_KEY);
      if (savedCookie !== null && savedCookie !== '') {
        const parsed = parseInt(savedCookie, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
      return 0; // Starts with a zero day record for any new computer
    } catch {
      return 0;
    }
  });

  const recordHighScore = useCallback((days: number) => {
    const valid = Math.max(0, Math.floor(days));
    if (valid > highScoreDaysRef.current) {
      highScoreDaysRef.current = valid;
      setHighScoreDays(valid);
      try {
        localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(valid));
        setCookie(COOKIE_SCORE_KEY, String(valid));
      } catch {
        // ignore
      }
    }
  }, []);

  // Helper to check if the survivor owns any matching tool in inventory or equipped gear.
  // All tools work immediately once crafted without requiring manual slot selection.
  const playerOwnsTool = useCallback((predicate: (name: string, id: string) => boolean): boolean => {
    const s = survivorRef.current;
    const allItems = [
      s.equippedTool,
      s.equippedWeapon,
      s.equippedWeapon2,
      ...s.inventory,
    ].filter(Boolean) as Item[];
    return allItems.some((i) => predicate(i.name.toLowerCase(), i.id.toLowerCase()));
  }, []);

  // References
  const survivorRef = useRef(survivor);
  survivorRef.current = survivor;
  const zombiesRef = useRef(zombies);
  zombiesRef.current = zombies;
  const structuresRef = useRef(structures);
  structuresRef.current = structures;
  const environmentRef = useRef(environment);
  environmentRef.current = environment;
  const noiseHeatmapRef = useRef(noiseHeatmap);
  noiseHeatmapRef.current = noiseHeatmap;
  const placementGhostRef = useRef(placementGhost);
  placementGhostRef.current = placementGhost;
  const animationEffectsRef = useRef(animationEffects);
  animationEffectsRef.current = animationEffects;
  const isGameOverRef = useRef(isGameOver);
  isGameOverRef.current = isGameOver;
  const chunksRef = useRef(chunks);
  chunksRef.current = chunks;
  const npcsRef = useRef(npcs);
  npcsRef.current = npcs;
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;
  const activeChestRef = useRef(activeChest);
  activeChestRef.current = activeChest;
  const highScoreDaysRef = useRef(highScoreDays);
  highScoreDaysRef.current = highScoreDays;

  // Survivor Speech Bubble (story beats, spoken observations)
  const [speechBubble, setSpeechBubble] = useState<SpeechBubble | null>(null);
  const hasTriggeredToolboxSpeechRef = useRef<boolean>(false);

  const triggerSurvivorSpeech = useCallback((text: string, durationMs: number = 8000) => {
    setSpeechBubble({
      text,
      expiresAt: Date.now() + durationMs,
      speaker: 'James',
    });
  }, []);

  useEffect(() => {
    if (!speechBubble) return;
    const remaining = speechBubble.expiresAt - Date.now();
    if (remaining <= 0) {
      setSpeechBubble(null);
      return;
    }
    const timer = setTimeout(() => {
      setSpeechBubble(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [speechBubble]);

  const triggerAnimation = useCallback((effect: Omit<VisualAnimationEffect, 'id' | 'createdAt'>) => {
    const newEff: VisualAnimationEffect = {
      ...effect,
      id: Math.random().toString(),
      createdAt: Date.now(),
    };
    setAnimationEffects((prev) => [...prev.slice(-35), newEff]);
  }, []);

  // Home Base Sector & Location (Can be set while inside any house/structure)
  const HOME_BASE_STORAGE_KEY = 'charval_home_base';
  const [homeBase, setHomeBase] = useState<HomeBase>(() => {
    try {
      const saved = localStorage.getItem(HOME_BASE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      x: 480,
      y: 360,
      sectorX: 0,
      sectorY: 0,
      name: 'Safehouse Residence [Sector 0, 0]',
    };
  });
  const homeBaseRef = useRef(homeBase);
  homeBaseRef.current = homeBase;

  // Detection if survivor is currently inside a house / shelter structure
  const currentShelter = useMemo(() => {
    // 1. Inside a generated building
    const bldg = buildings.find(
      (b) =>
        survivor.x >= b.x - 5 &&
        survivor.x <= b.x + b.width + 5 &&
        survivor.y >= b.y - 5 &&
        survivor.y <= b.y + b.height + 5
    );
    if (bldg) {
      return {
        name: bldg.name,
        isInside: true,
        x: Math.round(bldg.x + bldg.width / 2),
        y: Math.round(bldg.y + bldg.height / 2),
        sectorX: Math.floor((bldg.x + bldg.width / 2) / 800),
        sectorY: Math.floor((bldg.y + bldg.height / 2) / 800),
      };
    }

    // 2. Near player-built fortification or compound
    const nearby = structures.find(
      (s) =>
        (s.type.includes('wall') || s.type === 'door_wood' || s.type === 'bed' || s.type === 'workbench') &&
        Math.hypot(s.x + s.width / 2 - survivor.x, s.y + s.height / 2 - survivor.y) < 75
    );
    if (nearby) {
      const secX = Math.floor(survivor.x / 800);
      const secY = Math.floor(survivor.y / 800);
      return {
        name: `Fortified Compound [${secX}, ${secY}]`,
        isInside: true,
        x: Math.round(survivor.x),
        y: Math.round(survivor.y),
        sectorX: secX,
        sectorY: secY,
      };
    }

    return null;
  }, [buildings, structures, survivor.x, survivor.y]);

  // Set current house/structure as Colony Home Base
  const setAsHomeBase = useCallback((targetOverride?: { x: number; y: number; name?: string }) => {
    const curr = survivorRef.current;
    const targetX = targetOverride ? targetOverride.x : Math.round(curr.x);
    const targetY = targetOverride ? targetOverride.y : Math.round(curr.y);
    const secX = Math.floor(targetX / 800);
    const secY = Math.floor(targetY / 800);

    const bldg = buildingsRef.current.find(
      (b) => targetX >= b.x - 5 && targetX <= b.x + b.width + 5 && targetY >= b.y - 5 && targetY <= b.y + b.height + 5
    );
    const baseName = targetOverride?.name || bldg?.name || `Safehouse Base [Sector ${secX}, ${secY}]`;

    const newBase: HomeBase = {
      x: targetX,
      y: targetY,
      sectorX: secX,
      sectorY: secY,
      name: baseName,
    };

    setHomeBase(newBase);
    homeBaseRef.current = newBase;
    try {
      localStorage.setItem(HOME_BASE_STORAGE_KEY, JSON.stringify(newBase));
    } catch {}

    // Rally all recruited colony survivors that aren't following the player to the new base
    setNpcs((prev) =>
      prev.map((n, idx) => {
        if (n.state === 'recruited' && n.assignedTask !== 'follow') {
          return {
            ...n,
            targetX: targetX + ((idx % 2 === 0 ? 1 : -1) * 35),
            targetY: targetY + ((idx > 1 ? 1 : -1) * 35),
          };
        }
        return n;
      })
    );

    soundManager.playTerminalBlip();
    triggerAnimation({
      type: 'floating_text',
      x: targetX,
      y: targetY - 20,
      angle: 0,
      text: `BASE ESTABLISHED: ${baseName}`,
      color: '#38bdf8',
      durationMs: 2500,
    });
    setSystemMessage(`Established Home Base at "${baseName}" in Sector [${secX}, ${secY}]! Minimap, repairs, and survivor tasks now bound to this sector.`);
  }, [triggerAnimation]);

  // Procedural chunk generation and world tracking around player
  const updateProceduralChunks = useCallback((playerX: number, playerY: number) => {
    const { chunkX, chunkY } = getChunkCoords(playerX, playerY);
    let newChunksAdded = false;
    const newStructures: WorldStructure[] = [];
    const newZombies: Zombie[] = [];
    const newNpcs: NpcSurvivor[] = [];
    const newBuildings: BuildingBounds[] = [];

    // 3x3 Chunk neighborhood around current player position
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = chunkX + dx;
        const cy = chunkY + dy;
        const key = getChunkKey(cx, cy);

        if (!chunksRef.current[key]) {
          const generated = generateChunk(cx, cy, 42);
          chunksRef.current[key] = generated;
          newChunksAdded = true;
          newStructures.push(...generated.structures);
          newZombies.push(...generated.zombies);
          newNpcs.push(...generated.npcs);
          newBuildings.push(...generated.buildings);
        }
      }
    }

    if (newChunksAdded) {
      setChunks({ ...chunksRef.current });
      setStructures((prev) => [...prev, ...newStructures]);
      setZombies((prev) => [...prev, ...newZombies]);
      setNpcs((prev) => [...prev, ...newNpcs]);
      setBuildings((prev) => [...prev, ...newBuildings]);
    }
  }, []);

  // Initialize surrounding chunks on load
  useEffect(() => {
    updateProceduralChunks(INITIAL_SURVIVOR.x, INITIAL_SURVIVOR.y);
  }, [updateProceduralChunks]);

  // Sound emitter that radiates noise heat (rain covers most noise!)
  const emitSound = useCallback((x: number, y: number, radius: number, decibels: number, label: string) => {
    const currWeather = environmentRef.current.weather;
    const isRaining = currWeather === 'Heavy Rain' || currWeather === 'Thunderstorm' || currWeather === 'Freezing Rain';

    // Rain covers most noise: reduces acoustic radius and decibels by over 70%!
    const effectiveRadius = isRaining ? Math.max(22, radius * 0.28) : radius;
    const effectiveDecibels = isRaining ? Math.max(8, decibels * 0.30) : decibels;

    const newSound: SoundEvent = {
      id: Math.random().toString(),
      x,
      y,
      radius: effectiveRadius,
      decibels: effectiveDecibels,
      label: isRaining ? `${label} (Muffled by Rain)` : label,
      timestamp: Date.now(),
    };
    setSoundEvents((prev) => [...prev.slice(-8), newSound]);

    setNoiseHeatmap((prev) => {
      const next = prev.map((row) => [...row]);
      const centerCol = Math.floor(x / 20);
      const centerRow = Math.floor(y / 20);
      const cellRadius = Math.ceil(effectiveRadius / 20);

      const minCol = Math.max(0, centerCol - cellRadius);
      const maxCol = Math.min(GRID_COLS - 1, centerCol + cellRadius);
      const minRow = Math.max(0, centerRow - cellRadius);
      const maxRow = Math.min(GRID_ROWS - 1, centerRow + cellRadius);

      const baseIntensity = Math.min(1.6, effectiveDecibels / 45);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const cellCenterX = c * 20 + 10;
          const cellCenterY = r * 20 + 10;
          const dist = Math.hypot(cellCenterX - x, cellCenterY - y);
          if (dist <= effectiveRadius) {
            const falloff = 1 - dist / effectiveRadius;
            next[r][c] = Math.min(2.5, next[r][c] + baseIntensity * falloff);
          }
        }
      }
      return next;
    });

    setZombies((prevZombies) =>
      prevZombies.map((z) => {
        const dist = Math.hypot(z.x - x, z.y - y);
        if (dist <= effectiveRadius) {
          return {
            ...z,
            state: 'tracking' as ZombieState,
            targetX: x + (Math.random() * 20 - 10),
            targetY: y + (Math.random() * 20 - 10),
          };
        }
        return z;
      })
    );
  }, []);

  const isNearWorkbench = useMemo(() => {
    return structures.some(
      (s) =>
        s.type === 'workbench' &&
        Math.hypot(s.x + s.width / 2 - survivor.x, s.y + s.height / 2 - survivor.y) < 100
    );
  }, [structures, survivor.x, survivor.y]);

  const isNearStove = useMemo(() => {
    return structures.some(
      (s) =>
        (s.type === 'kitchen_stove' || s.type === 'campfire') &&
        Math.hypot(s.x + s.width / 2 - survivor.x, s.y + s.height / 2 - survivor.y) < 100
    );
  }, [structures, survivor.x, survivor.y]);

  // Contextual interaction prompt
  const activePrompt = useMemo<InteractablePrompt | null>(() => {
    if (survivor.isSleeping) {
      return {
        structureId: survivor.sleepingStructureId || 'bed',
        name: 'Asleep in Bed',
        actionLabel: 'Wake Up [E/F]',
        x: survivor.x,
        y: survivor.y,
        type: 'bed',
      };
    }

    // 1. Check for DOORS with top priority (within 100px) -> Open/Close with [E/F] or Click!
    const nearestDoor = structures.reduce<{ struct: WorldStructure | null; dist: number }>(
      (acc, s) => {
        if (s.type !== 'door_wood') return acc;
        const nearestX = Math.max(s.x, Math.min(survivor.x, s.x + s.width));
        const nearestY = Math.max(s.y, Math.min(survivor.y, s.y + s.height));
        const d = Math.hypot(survivor.x - nearestX, survivor.y - nearestY);
        if (d < acc.dist) return { struct: s, dist: d };
        return acc;
      },
      { struct: null, dist: 100 }
    );

    if (nearestDoor.struct) {
      const s = nearestDoor.struct;
      const isDamaged = s.hp < s.maxHp;
      return {
        structureId: s.id,
        name: s.name,
        actionLabel: s.isOpen
          ? `Close Door [E/F]${isDamaged ? ' · [R] Repair' : ''}`
          : `Open Door [E/F]${isDamaged ? ' · [R] Repair' : ''}`,
        x: s.x + s.width / 2,
        y: s.y + s.height / 2,
        type: s.type,
      };
    }

    // 2. Check for nearby FENCES to vault / jump with [E/F] (within 55px)
    const nearestFence = structures.reduce<{ struct: WorldStructure | null; dist: number }>(
      (acc, s) => {
        if (s.type !== 'fence_wood' && s.type !== 'fence_wire') return acc;
        const nearestX = Math.max(s.x, Math.min(survivor.x, s.x + s.width));
        const nearestY = Math.max(s.y, Math.min(survivor.y, s.y + s.height));
        const d = Math.hypot(survivor.x - nearestX, survivor.y - nearestY);
        if (d < acc.dist) return { struct: s, dist: d };
        return acc;
      },
      { struct: null, dist: 55 }
    );

    if (nearestFence.struct) {
      const s = nearestFence.struct;
      return {
        structureId: s.id,
        name: s.name,
        actionLabel: `Jump / Vault Fence [E/F]`,
        x: s.x + s.width / 2,
        y: s.y + s.height / 2,
        type: s.type,
      };
    }

    // 3. Check for nearby NPC survivor (within 75px) -> Interact with [C]!
    const nearestNpc = npcs.reduce<{ npc: NpcSurvivor | null; dist: number }>(
      (acc, n) => {
        const d = Math.hypot(n.x - survivor.x, n.y - survivor.y);
        if (d < acc.dist) return { npc: n, dist: d };
        return acc;
      },
      { npc: null, dist: 75 }
    );

    if (nearestNpc.npc) {
      const n = nearestNpc.npc;
      const isRecruited = n.state === 'recruited';
      return {
        targetId: n.id,
        targetType: 'npc',
        name: n.name,
        actionLabel: isRecruited
          ? `Manage Survivor (${n.assignedTask.toUpperCase()}) [C]`
          : `Talk to Survivor (${n.profession}) [C]`,
        x: n.x,
        y: n.y,
        npc: n,
      };
    }

    // 4. Check for nearby damaged structures to repair -> Repair with [R]!
    const nearestDamaged = structures.reduce<{ struct: WorldStructure | null; dist: number }>(
      (acc, s) => {
        if (s.hp >= s.maxHp) return acc;
        if (!s.type.includes('wall') && !s.type.includes('fence') && s.type !== 'door_wood' && s.type !== 'barricade_window') return acc;
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        const d = Math.hypot(cx - survivor.x, cy - survivor.y);
        if (d < acc.dist) return { struct: s, dist: d };
        return acc;
      },
      { struct: null, dist: 70 }
    );

    if (nearestDamaged.struct) {
      const s = nearestDamaged.struct;
      const damageRatio = Math.max(0, 1 - s.hp / s.maxHp);
      const planksCost = Math.max(1, Math.round((s.repairPlanks || 2) * damageRatio));
      const nailsCost = Math.max(1, Math.round((s.repairNails || 3) * damageRatio));
      return {
        structureId: s.id,
        targetType: 'repair',
        name: s.name,
        actionLabel: `Repair ${s.name} (${Math.round(s.hp)}/${s.maxHp} HP) [R] [${planksCost} Planks, ${nailsCost} Nails]`,
        x: s.x + s.width / 2,
        y: s.y + s.height / 2,
        type: s.type,
        repairPlanksNeeded: planksCost,
        repairNailsNeeded: nailsCost,
      };
    }

    // 5. Check for nearby fruit bushes with ripe fruit
    const nearestFruit = structures.reduce<{ struct: WorldStructure | null; dist: number }>(
      (acc, s) => {
        if (s.type !== 'fruit_bush' || (s.fruitCount ?? 0) <= 0) return acc;
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        const d = Math.hypot(cx - survivor.x, cy - survivor.y);
        if (d < acc.dist) return { struct: s, dist: d };
        return acc;
      },
      { struct: null, dist: 70 }
    );

    if (nearestFruit.struct) {
      const s = nearestFruit.struct;
      return {
        structureId: s.id,
        targetType: 'harvest',
        name: s.name,
        actionLabel: `Harvest ${s.name} (${s.fruitCount} ${s.fruitType || 'Fruit'}) [F]`,
        x: s.x + s.width / 2,
        y: s.y + s.height / 2,
        type: s.type,
      };
    }

    const nearest = structures.reduce<{ struct: WorldStructure | null; dist: number }>(
      (acc, s) => {
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        const d = Math.hypot(cx - survivor.x, cy - survivor.y);
        if (d < acc.dist) return { struct: s, dist: d };
        return acc;
      },
      { struct: null, dist: 75 }
    );

    if (!nearest.struct) return null;
    const s = nearest.struct;

    let actionLabel = 'Interact [Right-Click / F]';
    if (s.type === 'door_wood' || s.type === 'door_stone') {
      actionLabel = s.isOpen ? `Close ${s.name} [Right-Click / F]` : `Open ${s.name} [Right-Click / F]`;
    } else if (s.type === 'wall_brick') {
      actionLabel = `Demolish Brick Wall (Claw Hammer) -> Stone Blocks [Right-Click / F]`;
    } else if (s.type === 'abandoned_car') {
      actionLabel = `Pry Vehicle (Tempered Crowbar) -> Iron Pipes [Right-Click / F]`;
    } else if (s.type === 'riverbed_clay') {
      actionLabel = `Excavate Clay (Steel Spade) -> Dense Clay [Right-Click / F]`;
    } else if (s.type === 'trap_clay_pit') {
      actionLabel = `Dense Clay Pit Trap (Mires & Slows Undead -65%)`;
    } else if (s.type === 'trap_barbed_wire') {
      actionLabel = `Barbed Wire Barrier (Contact Damage & -50% Slow)`;
    } else if (s.type === 'wall_stone') {
      actionLabel = `Reinforced Stone Wall (${s.hp}/${s.maxHp} HP)`;
    } else if (s.type === 'workbench') {
      actionLabel = 'Craft at Workbench [Right-Click / F]';
    } else if (s.type === 'bed') {
      actionLabel = survivor.fatigue < 50 ? 'Sleep on Cot Bed [F] (Not Tired: requires ≥50% Fatigue)' : 'Sleep on Cot Bed [Right-Click / F]';
    } else if (s.type === 'sleeping_mat') {
      actionLabel = survivor.fatigue < 50 ? 'Sleep on Mat [F] (Not Tired: requires ≥50% Fatigue)' : 'Sleep on Mat [Right-Click / F]';
    } else if (s.type === 'kitchen_stove') {
      actionLabel = 'Kitchen Stove [Right-Click / F]';
    } else if (s.type === 'table_chair') {
      actionLabel = 'Sit at Table & Read [Right-Click / F]';
    } else if (s.type === 'tree') {
      actionLabel = `Cut Tree (${s.hp}/${s.maxHp} HP) [Iron Saw: Hardwood Logs | Scrap Saw: Planks]`;
    } else if (s.type === 'loot_container') {
      const isChest = s.name.toLowerCase().includes('chest');
      actionLabel = isChest ? `Open ${s.name} [Right-Click / F]` : `Loot / Breakdown for Metal Strips (Bent Crowbar) [Right-Click]`;
    } else if (s.type === 'dirt_trench') {
      actionLabel = `Dirt Trench (Slows Undead -25%)`;
    } else if (s.type === 'fence_wood' || s.type === 'fence_wire') {
      actionLabel = `Knock Down Fence (Scrap Hammer) [Right-Click] · Vault [E/F]`;
    } else if (s.type === 'rain_collector') {
      actionLabel = `Rain Barrel (${s.waterStored || 0}/50 Refills) [Right-Click / F]`;
    } else if (s.type === 'campfire') {
      actionLabel = 'Campfire [Right-Click / F]';
    }

    return {
      structureId: s.id,
      name: s.name,
      actionLabel,
      x: s.x + s.width / 2,
      y: s.y + s.height / 2,
      type: s.type,
    };
  }, [structures, survivor.x, survivor.y, survivor.isSleeping, survivor.sleepingStructureId, survivor.fatigue, npcs]);

  // Cycle Active Weapon Slot with mouse scroll wheel: Weapon 1 (Primary) <-> Weapon 2 (Backup)
  // All tools work immediately when interacting without needing manual slot selection.
  const cycleActiveSlot = useCallback((delta: number) => {
    soundManager.playTerminalBlip();
    setSurvivor((prev) => {
      const slots: ActiveHandSlot[] = ['weapon1', 'weapon2'];
      const currentIndex = slots.indexOf(prev.activeSlot);
      let nextIndex = currentIndex === -1 ? 0 : (currentIndex + (delta > 0 ? 1 : -1) + slots.length) % slots.length;
      const nextSlot = slots[nextIndex];

      const itemInHand = nextSlot === 'weapon1' ? prev.equippedWeapon : prev.equippedWeapon2;
      setSystemMessage(`Equipped: ${nextSlot === 'weapon1' ? 'Primary' : 'Backup'} (${itemInHand?.name || 'Fists'})`);

      return {
        ...prev,
        activeSlot: nextSlot,
      };
    });
  }, []);

  // Equip item to dedicated slot
  const equipItem = useCallback(
    (item: Item, targetSlot: 'weapon1' | 'weapon2' | 'tool' | ArmorSlot) => {
      soundManager.playTerminalBlip();
      setSurvivor((prev) => {
        let newWeapon1 = prev.equippedWeapon;
        let newWeapon2 = prev.equippedWeapon2;
        let newTool = prev.equippedTool;
        const newArmor = { ...prev.equippedArmor };
        let newInv = [...prev.inventory];

        // Remove item from inventory
        newInv = newInv
          .map((i) => (i.id === item.id ? (i.count && i.count > 1 ? { ...i, count: i.count - 1 } : null) : i))
          .filter(Boolean) as Item[];

        if (targetSlot === 'weapon1') {
          if (newWeapon1) newInv.push(newWeapon1);
          newWeapon1 = item;
        } else if (targetSlot === 'weapon2') {
          if (newWeapon2) newInv.push(newWeapon2);
          newWeapon2 = item;
        } else if (targetSlot === 'tool') {
          if (newTool) newInv.push(newTool);
          newTool = item;
        } else {
          // Armor slot
          const existing = newArmor[targetSlot];
          if (existing) newInv.push(existing);
          newArmor[targetSlot] = item;
        }

        setSystemMessage(`Equipped ${item.name} to ${targetSlot.toUpperCase()}.`);

        return {
          ...prev,
          equippedWeapon: newWeapon1,
          equippedWeapon2: newWeapon2,
          equippedTool: newTool,
          equippedArmor: newArmor,
          inventory: newInv,
        };
      });
    },
    []
  );

  // Unequip item
  const unequipItem = useCallback((slot: 'weapon1' | 'weapon2' | 'tool' | ArmorSlot) => {
    soundManager.playTerminalBlip();
    setSurvivor((prev) => {
      let unequipped: Item | null = null;
      let newWeapon1 = prev.equippedWeapon;
      let newWeapon2 = prev.equippedWeapon2;
      let newTool = prev.equippedTool;
      const newArmor = { ...prev.equippedArmor };

      if (slot === 'weapon1') {
        unequipped = newWeapon1;
        newWeapon1 = null;
      } else if (slot === 'weapon2') {
        unequipped = newWeapon2;
        newWeapon2 = null;
      } else if (slot === 'tool') {
        unequipped = newTool;
        newTool = null;
      } else {
        unequipped = newArmor[slot];
        newArmor[slot] = null;
      }

      if (!unequipped) return prev;
      const newInv = [...prev.inventory, unequipped];
      setSystemMessage(`Unequipped ${unequipped.name}.`);

      return {
        ...prev,
        equippedWeapon: newWeapon1,
        equippedWeapon2: newWeapon2,
        equippedTool: newTool,
        equippedArmor: newArmor,
        inventory: newInv,
      };
    });
  }, []);

  // Start Structure Placement Mode
  const startPlacingItem = useCallback((item: Item, recipeId?: string) => {
    if (!item.isPlaceable || !item.placeStructureType) {
      setSystemMessage('This item cannot be placed on the ground.');
      return;
    }
    soundManager.playTerminalBlip();
    const w = item.placeWidth || 50;
    const h = item.placeHeight || 20;
    setPlacementGhost({
      item,
      structureType: item.placeStructureType,
      width: w,
      height: h,
      originalWidth: w,
      originalHeight: h,
      rotation: 0,
      recipeId,
    });
    setSystemMessage(`Placement Mode: Left-click map to place ${item.name}. (Scroll wheel rotates 90°, Right-click or ESC to finish)`);
  }, []);

  // Rotate placement ghost 90 degrees (Scroll wheel on canvas)
  const rotatePlacement = useCallback(() => {
    setPlacementGhost((prev) => {
      if (!prev) return null;
      soundManager.playTerminalBlip();
      const newWidth = prev.height;
      const newHeight = prev.width;
      const newRot = ((prev.rotation || 0) + 90) % 360;
      return {
        ...prev,
        width: newWidth,
        height: newHeight,
        rotation: newRot,
      };
    });
  }, []);

  // Cancel Placement Mode
  const cancelPlacement = useCallback(() => {
    setPlacementGhost(null);
    setSystemMessage('Placement mode finished.');
  }, []);

  // Confirm placing structure at mouse position
  const confirmPlacement = useCallback(
    (worldX: number, worldY: number) => {
      const ghost = placementGhostRef.current;
      if (!ghost) return;

      const curr = survivorRef.current;
      const allRecipes = [...BUILD_RECIPES, ...WORKBENCH_RECIPES];
      const activeRecipe = ghost.recipeId ? allRecipes.find((r) => r.id === ghost.recipeId) : null;

      // 1. Synchronously inspect inventory to deduct either prepared kit item or raw crafting materials
      let currentInv = [...curr.inventory];
      const itemIdx = currentInv.findIndex(
        (i) => i.id === ghost.item.id || (i.name === ghost.item.name && (i.count ?? 1) >= 1)
      );

      if (itemIdx !== -1) {
        const item = currentInv[itemIdx];
        if ((item.count ?? 1) > 1) {
          currentInv[itemIdx] = { ...item, count: (item.count ?? 1) - 1 };
        } else {
          currentInv.splice(itemIdx, 1);
        }
      } else if (activeRecipe) {
        // Check if player has the materials to craft and place this structure
        const canAfford = activeRecipe.ingredients.every((ing) => {
          const match = currentInv.find(
            (i) => i.id === ing.itemId || i.name.toLowerCase().includes(ing.name.toLowerCase())
          );
          return match && (match.count ?? 1) >= ing.count;
        });

        if (!canAfford) {
          soundManager.playAlarmBeep();
          setSystemMessage(`Out of materials to place ${ghost.item.name}.`);
          setPlacementGhost(null);
          return;
        }

        // Deduct materials for this placed structure
        activeRecipe.ingredients.forEach((ing) => {
          const idx = currentInv.findIndex(
            (i) => i.id === ing.itemId || i.name.toLowerCase().includes(ing.name.toLowerCase())
          );
          if (idx !== -1) {
            const ingItem = currentInv[idx];
            if ((ingItem.count ?? 1) > ing.count) {
              currentInv[idx] = { ...ingItem, count: (ingItem.count ?? 1) - ing.count };
            } else {
              currentInv.splice(idx, 1);
            }
          }
        });
      } else {
        soundManager.playAlarmBeep();
        setSystemMessage(`Out of ${ghost.item.name} to place.`);
        setPlacementGhost(null);
        return;
      }

      // 2. Spawn placed structure in the world
      const px = Math.round(worldX - ghost.width / 2);
      const py = Math.round(worldY - ghost.height / 2);

      const isRainCollector = ghost.structureType === 'rain_collector';
      const isLootContainer = ghost.structureType === 'loot_container';
      const isDoor = ghost.structureType === 'door_wood';

      const newStruct: WorldStructure = {
        id: Math.random().toString(),
        x: px,
        y: py,
        width: ghost.width,
        height: ghost.height,
        type: ghost.structureType,
        name: ghost.item.name.replace(' (Kit)', '').replace(' (Packaged)', ''),
        hp: ghost.structureType.includes('reinforced') ? 450 : 200,
        maxHp: ghost.structureType.includes('reinforced') ? 450 : 200,
        isOpen: false,
        containedLoot: isLootContainer ? [] : undefined,
        waterStored: isRainCollector ? 0 : undefined,
        maxWater: isRainCollector ? 50 : undefined,
      };

      setStructures((prev) => [...prev, newStruct]);
      soundManager.playHammerSound();
      emitSound(px, py, 60, 25, `Placed ${newStruct.name}`);

      triggerAnimation({
        type: 'tool_hammer',
        x: px + ghost.width / 2,
        y: py + ghost.height / 2,
        angle: 0,
        durationMs: 350,
      });
      triggerAnimation({
        type: 'floating_text',
        x: px + ghost.width / 2,
        y: py - 12,
        angle: 0,
        text: isDoor ? 'DOOR BUILT! [F]' : 'BUILT!',
        color: '#10b981',
        durationMs: 900,
      });

      // Update survivor inventory
      setSurvivor((prev) => ({
        ...prev,
        activeAction: {
          type: 'tool_hammer',
          timestamp: Date.now(),
          durationMs: 250,
          angle: Math.atan2(py - prev.y, px - prev.x),
        },
        inventory: currentInv,
      }));

      // 3. Synchronously check if player still has materials for ANOTHER structure!
      let canRepeat = false;
      const nextItemIdx = currentInv.findIndex(
        (i) => i.id === ghost.item.id || (i.name === ghost.item.name && (i.count ?? 1) >= 1)
      );

      if (nextItemIdx !== -1) {
        canRepeat = true;
      } else if (activeRecipe) {
        const canAffordNext = activeRecipe.ingredients.every((ing) => {
          const match = currentInv.find(
            (i) => i.id === ing.itemId || i.name.toLowerCase().includes(ing.name.toLowerCase())
          );
          return match && (match.count ?? 1) >= ing.count;
        });
        if (canAffordNext) {
          canRepeat = true;
        }
      }

      if (canRepeat) {
        // Keep ghost active so player can continuously place multiples!
        setSystemMessage(
          `Built ${newStruct.name}! Left-click to place another, Scroll to rotate 90°, Right-click to finish.`
        );
      } else {
        setPlacementGhost(null);
        setSystemMessage(`Built ${newStruct.name}! Out of materials to place another.`);
      }
    },
    [emitSound, triggerAnimation]
  );

  // Evolution complaints from party members on every 5th day
  const triggerEvolutionChatter = useCallback((dayNum: number) => {
    const recruitedNpcs = npcsRef.current.filter((n) => n.state === 'recruited' && n.hp > 0);
    const EVOLUTION_LINES = [
      "God... they're moving faster than before. Tell me you see it too.",
      "The walkers... their skulls feel harder. It's like the virus is mutating.",
      "Did you notice that? They don't stumble like they used to. They're adapting.",
      "Every night that passes, the undead seem more relentless. What is happening to them?",
      "I swear that shambler took five crowbar blows before dropping. They're evolving...",
      "They're not just rotting anymore... they're getting stronger. Watch your back.",
    ];
    const quote = EVOLUTION_LINES[Math.floor(Math.random() * EVOLUTION_LINES.length)];

    if (recruitedNpcs.length > 0) {
      const speaker = recruitedNpcs[Math.floor(Math.random() * recruitedNpcs.length)];
      triggerAnimation({
        type: 'floating_text',
        x: speaker.x,
        y: speaker.y - 25,
        angle: 0,
        text: `"${quote}"`,
        color: '#f59e0b',
        durationMs: 4500,
      });
      setSystemMessage(`🗣️ [${speaker.name}]: "${quote}"`);
    } else {
      setSystemMessage(`📻 [Emergency Radio]: "...walkers in Sector 4 are moving significantly faster... it's like they're mutating..."`);
    }
  }, [triggerAnimation]);

  // Voluntary Sleep in bed: Screen blacks out, wakes up at morning daylight, compounds 2%
  const startSleeping = useCallback((structure: WorldStructure) => {
    // Player cannot sleep unless fatigue is at least 50%
    if (survivorRef.current.fatigue < 50) {
      triggerSurvivorSpeech("I am not tired.", 5000);
      setSystemMessage("Cannot sleep: You are not tired enough (requires at least 50% fatigue).");
      soundManager.playTerminalBlip();
      return;
    }

    soundManager.playHeartbeat();
    const currEnv = environmentRef.current;
    const nextDay = currEnv.day + 1;

    setSleepBlackout({
      active: true,
      phase: 'fading_out',
      message: 'RESTING IN SHELTER',
      subMessage: `You fall into a deep, safe sleep in ${structure.name}. The long night passes safely...`,
      isPassedOut: false,
      targetDay: nextDay,
    });

    setSurvivor((s) => ({
      ...s,
      isSleeping: true,
      sleepingStructureId: structure.id,
      isConsciousnessSlipping: false,
      consciousnessSlippingTimer: null,
      x: structure.x + structure.width / 2,
      y: structure.y + structure.height / 2,
    }));

    // Blackout phase: advance time to next morning, compound zombies 2%, restore vitals
    setTimeout(() => {
      setSleepBlackout((prev) => (prev ? { ...prev, phase: 'blackout' } : null));

      // Advance environment to next day, 07:00 AM bright daylight
      const morningCycleSec = 180;
      const info = getDayNightInfo(morningCycleSec);

      // Odds of rain: 10% + 1% per day/sleep, max 40%
      const rainChance = getRainChance(nextDay);
      const isRaining = Math.random() < rainChance;
      const newWeather: EnvironmentState['weather'] = isRaining
        ? (Math.random() < 0.65 ? 'Heavy Rain' : 'Thunderstorm')
        : (['Fog', 'Overcast', 'Clear Cold'] as EnvironmentState['weather'][])[Math.floor(Math.random() * 3)];
      soundManager.setWeatherAmbience(newWeather);

      setEnvironment((prev) => ({
        ...prev,
        day: nextDay,
        cycleSeconds: morningCycleSec,
        timeMinutes: Math.round(info.inGameMinutesOfDay),
        isDay: true,
        cycleRemainingMinutes: info.remainingMinutes,
        weather: newWeather,
      }));

      // Update computer-bound high score record
      recordHighScore(nextDay);

      // Compounding 2% zombie evolution across all attributes per sleep
      const mult = zombieMultiplierRef.current;
      mult.speedMult *= 1.02;
      mult.healthMult *= 1.02;
      mult.damageMult *= 1.02;
      mult.spawnRateMult *= 1.02;
      mult.sightMult *= 1.02;
      mult.hearingMult *= 1.02;
      mult.smellMult *= 1.02;
      mult.populationMult *= 1.02;

      // Respawn zombies outside current Home Base sector with 2% more of them!
      const base = homeBaseRef.current;
      const p = survivorRef.current;
      setZombies((prevZombies) =>
        respawnZombiesOutsideHomeSector(
          prevZombies,
          base.sectorX,
          base.sectorY,
          structuresRef.current,
          buildingsRef.current,
          p.x,
          p.y,
          mult
        )
      );

      // Restore survivor
      setSurvivor((s) => ({
        ...s,
        fatigue: 0,
        endurance: 100,
        panic: 0,
        hp: Math.min(100, s.hp + 20),
        injuries: s.injuries.map((inj) => (inj.bleeding && inj.bandaged ? { ...inj, bleeding: false } : inj)),
      }));

      // Update colony survivors: stick to Home Base sector; sleep if bed exists, otherwise stay awake
      setNpcs((prevNpcs) => {
        const baseBeds = structuresRef.current.filter(
          (st) =>
            (st.type === 'bed' || st.type === 'sleeping_mat') &&
            Math.floor(st.x / 800) === base.sectorX &&
            Math.floor(st.y / 800) === base.sectorY
        );
        const hasBed = baseBeds.length > 0;

        return prevNpcs.map((n, idx) => {
          if (n.state !== 'recruited' || n.assignedTask === 'follow') return n;

          if (hasBed) {
            const bed = baseBeds[idx % baseBeds.length];
            return {
              ...n,
              x: bed.x + bed.width / 2,
              y: bed.y + bed.height / 2,
              targetX: bed.x + bed.width / 2,
              targetY: bed.y + bed.height / 2,
              fatigue: 0,
              hp: Math.min(n.maxHp, n.hp + 25),
            };
          } else {
            // No bed at base sector: "if there is no bed they don't get to sleep!"
            return {
              ...n,
              x: base.x + ((idx % 2 === 0 ? 1 : -1) * 35),
              y: base.y + ((idx > 1 ? 1 : -1) * 35),
              targetX: base.x + ((idx % 2 === 0 ? 1 : -1) * 35),
              targetY: base.y + ((idx > 1 ? 1 : -1) * 35),
              fatigue: Math.min(100, (n.fatigue ?? 0) + 10), // Did not get to sleep
            };
          }
        });
      });

      // Party member periodic discussion every 5th day
      if (nextDay % 5 === 0) {
        triggerEvolutionChatter(nextDay);
      }

      setSystemMessage(`Day ${nextDay} - Sunrise. You awaken well-rested in ${structure.name}. Fatigue cleared.`);
      soundManager.playTerminalBlip();
    }, 1100);

    // Fade back in
    setTimeout(() => {
      setSleepBlackout((prev) => (prev ? { ...prev, phase: 'fading_in' } : null));
      setSurvivor((s) => ({
        ...s,
        isSleeping: false,
        sleepingStructureId: undefined,
      }));
    }, 2200);

    // Complete sleep sequence
    setTimeout(() => {
      setSleepBlackout(null);
    }, 3200);
  }, [recordHighScore, triggerEvolutionChatter, triggerSurvivorSpeech]);

  // Collapse / Pass out from exhaustion after 5 minutes of consciousness slipping
  const passOutFromExhaustion = useCallback(() => {
    soundManager.playHeartbeat();
    soundManager.playMeleeHit(false);
    const curr = survivorRef.current;
    const currEnv = environmentRef.current;
    const nextDay = currEnv.day + 1;

    // Check if player is safely inside a building or fenced safe compound
    const isInside =
      isPointInsideBuilding(curr.x, curr.y, buildingsRef.current, 10) ||
      isPointInsideFencedOrSafeZone(curr.x, curr.y, structuresRef.current, 15);

    // 5% chance of waking up infected if NOT inside! (Reduced from 30% to 5%)
    const rolledInfection = !isInside && Math.random() < 0.05;

    setSleepBlackout({
      active: true,
      phase: 'fading_out',
      message: 'CONSCIOUSNESS SLIPPED AWAY',
      subMessage: isInside
        ? 'You collapsed onto the floor from overwhelming exhaustion. Fortunately, four walls kept you sheltered.'
        : 'You collapsed in the open from overwhelming exhaustion. Roaming infected lurk in the dark...',
      isPassedOut: true,
      targetDay: nextDay,
    });

    setSurvivor((s) => ({
      ...s,
      isSleeping: true,
      isConsciousnessSlipping: false,
      consciousnessSlippingTimer: null,
    }));

    setTimeout(() => {
      setSleepBlackout((prev) => (prev ? { ...prev, phase: 'blackout' } : null));

      // Advance environment to Day + 1, 07:00 AM bright daylight
      const morningCycleSec = 180;
      const info = getDayNightInfo(morningCycleSec);

      // Odds of rain: 10% + 1% per day/sleep, max 40%
      const rainChance = getRainChance(nextDay);
      const isRaining = Math.random() < rainChance;
      const newWeather: EnvironmentState['weather'] = isRaining
        ? (Math.random() < 0.65 ? 'Heavy Rain' : 'Thunderstorm')
        : (['Fog', 'Overcast', 'Clear Cold'] as EnvironmentState['weather'][])[Math.floor(Math.random() * 3)];
      soundManager.setWeatherAmbience(newWeather);

      setEnvironment((prev) => ({
        ...prev,
        day: nextDay,
        cycleSeconds: morningCycleSec,
        timeMinutes: Math.round(info.inGameMinutesOfDay),
        isDay: true,
        cycleRemainingMinutes: info.remainingMinutes,
        weather: newWeather,
      }));

      // Update computer-bound high score record
      recordHighScore(nextDay);

      // Compounding 10% on passing out across all attributes!
      const mult = zombieMultiplierRef.current;
      mult.speedMult *= 1.10;
      mult.healthMult *= 1.10;
      mult.damageMult *= 1.10;
      mult.spawnRateMult *= 1.10;
      mult.sightMult *= 1.10;
      mult.hearingMult *= 1.10;
      mult.smellMult *= 1.10;
      mult.populationMult *= 1.10;

      // Respawn zombies outside current Home Base sector (+10% more outside)
      const base = homeBaseRef.current;
      const p = survivorRef.current;
      setZombies((prevZombies) =>
        respawnZombiesOutsideHomeSector(
          prevZombies,
          base.sectorX,
          base.sectorY,
          structuresRef.current,
          buildingsRef.current,
          p.x,
          p.y,
          mult
        )
      );

      // Restore survivor fatigue & handle infection
      setSurvivor((s) => {
        let newInjuries = [...s.injuries];
        let wasBittenNow = s.isBitten;
        let newVirus = s.virusProgress;

        if (rolledInfection) {
          wasBittenNow = true;
          newVirus = Math.max(s.virusProgress, 60); // Starts high and accelerates so they die shortly after
          newInjuries.push({
            id: `inj_bite_${Date.now()}`,
            part: 'Right Arm',
            type: 'Bite',
            severity: 9,
            bleeding: true,
            bandaged: false,
            dirtyBandage: false,
            infected: true,
          });
        }

        return {
          ...s,
          fatigue: 0,
          endurance: 75,
          panic: rolledInfection ? 85 : 20,
          hp: rolledInfection ? Math.min(s.hp, 45) : s.hp,
          isBitten: wasBittenNow,
          virusProgress: newVirus,
          injuries: newInjuries,
        };
      });

      // Update colony survivors: stick to Home Base sector; sleep if bed exists, otherwise stay awake
      setNpcs((prevNpcs) => {
        const baseBeds = structuresRef.current.filter(
          (st) =>
            (st.type === 'bed' || st.type === 'sleeping_mat') &&
            Math.floor(st.x / 800) === base.sectorX &&
            Math.floor(st.y / 800) === base.sectorY
        );
        const hasBed = baseBeds.length > 0;

        return prevNpcs.map((n, idx) => {
          if (n.state !== 'recruited' || n.assignedTask === 'follow') return n;

          if (hasBed) {
            const bed = baseBeds[idx % baseBeds.length];
            return {
              ...n,
              x: bed.x + bed.width / 2,
              y: bed.y + bed.height / 2,
              targetX: bed.x + bed.width / 2,
              targetY: bed.y + bed.height / 2,
              fatigue: 0,
              hp: Math.min(n.maxHp, n.hp + 20),
            };
          } else {
            // No bed at base sector: "if there is no bed they don't get to sleep!"
            return {
              ...n,
              x: base.x + ((idx % 2 === 0 ? 1 : -1) * 35),
              y: base.y + ((idx > 1 ? 1 : -1) * 35),
              targetX: base.x + ((idx % 2 === 0 ? 1 : -1) * 35),
              targetY: base.y + ((idx > 1 ? 1 : -1) * 35),
              fatigue: Math.min(100, (n.fatigue ?? 0) + 10), // Did not get to sleep
            };
          }
        });
      });

      if (rolledInfection) {
        soundManager.playZombieGrowl();
        soundManager.playAlarmBeep();
        setSystemMessage('☠️ CRITICAL: You collapsed outside unprotected! You awake with a gruesome bite mark. The Charval infection is coursing through your veins!');
      } else if (isInside) {
        setSystemMessage(`Day ${nextDay}. You collapsed indoors from exhaustion. Walls sheltered you from the roaming horde.`);
      } else {
        setSystemMessage(`Day ${nextDay}. You collapsed outdoors. By sheer miracle, no wandering shamblers discovered you.`);
      }

      // Party member chatter on every 5th day
      if (nextDay % 5 === 0) {
        triggerEvolutionChatter(nextDay);
      }
    }, 1200);

    setTimeout(() => {
      setSleepBlackout((prev) => (prev ? { ...prev, phase: 'fading_in' } : null));
      setSurvivor((s) => ({
        ...s,
        isSleeping: false,
      }));
    }, 2400);

    setTimeout(() => {
      setSleepBlackout(null);
    }, 3400);
  }, [recordHighScore, triggerEvolutionChatter]);

  const wakeUp = useCallback(() => {
    soundManager.playTerminalBlip();
    setSurvivor((s) => ({
      ...s,
      isSleeping: false,
      sleepingStructureId: undefined,
    }));
    setSystemMessage('Woke up and stood up from bed. Restored and alert.');
  }, []);

  // Update Overseer Narration
  const requestOverseerNarration = useCallback(
    async (tacticalDirective?: string, recentEventMsg?: string) => {
      setIsNarrating(true);
      const currSurvivor = survivorRef.current;
      const currEnv = environmentRef.current;
      const currZombies = zombiesRef.current;
      const currStructures = structuresRef.current;

      const nearbyCount = currZombies.filter(
        (z) => Math.hypot(z.x - currSurvivor.x, z.y - currSurvivor.y) < 180
      ).length;

      const deterministic = generateDeterministicObservationLog({
        environment: currEnv,
        survivor: currSurvivor,
        zombies: currZombies,
        structures: currStructures,
        tacticalAction: tacticalDirective,
        recentEvent: recentEventMsg,
        nearbyZombiesCount: nearbyCount,
      });

      try {
        const hours = Math.floor(currEnv.timeMinutes / 60);
        const minutes = currEnv.timeMinutes % 60;
        const timeFormatted = `${(hours % 12 || 12).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;

        const payload = {
          gameState: {
            day: currEnv.day,
            timeFormatted,
            weather: `${currEnv.weather}, ${currEnv.temperatureC}°C`,
            gridPower: currEnv.gridPower,
            waterGrid: currEnv.waterGrid,
            noiseLevel: Math.round(15 + (currSurvivor.isRunning ? 25 : 0)),
            survivor: {
              name: currSurvivor.name,
              hp: Math.round(currSurvivor.hp),
              fatigue: Math.round(currSurvivor.fatigue),
              hunger: Math.round(currSurvivor.hunger),
              thirst: Math.round(currSurvivor.thirst),
              panic: Math.round(currSurvivor.panic),
              illness: Math.round(currSurvivor.illness),
              boredom: Math.round(currSurvivor.boredom),
              isInfected: currSurvivor.isBitten,
              injuries: currSurvivor.injuries.map((i) => `${i.part} (${i.type}${i.bleeding ? ', Bleeding' : ''})`),
              equippedWeapon: currSurvivor.equippedWeapon,
              equippedTool: currSurvivor.equippedTool,
            },
            zombieCount: nearbyCount,
            activeFires: 0,
            shelterStats: `Timber fortifications, ${currStructures.filter((s) => s.type === 'barricade_window').length} barricaded windows, workbench active`,
          },
          tacticalAction: tacticalDirective,
        };

        const res = await fetch('/api/overseer/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.markdown) {
            setActiveLog(data.markdown);
            setAvailableActions(deterministic.actions);
            soundManager.playTerminalBlip();
            setIsNarrating(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Overseer backend fallback active:', err);
      }

      setActiveLog(deterministic.markdown);
      setAvailableActions(deterministic.actions);
      soundManager.playTerminalBlip();
      setIsNarrating(false);
    },
    []
  );

  useEffect(() => {
    requestOverseerNarration(
      undefined,
      'Satellite uplink synchronizing. Optical thermal & acoustic sensors calibrated on Sector 4B.'
    );
  }, [requestOverseerNarration]);

  // Main simulation tick: Time, Stamina Recovery, Sleeping, Vitals, Noise Heatmap, and Zombie AI
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Advance time (Faster if sleeping! 40min day + 20min night = 3600s cycle)
      const currSurvivor = survivorRef.current;
      const timeStep = currSurvivor.isSleeping ? 12 : 1; // 1 real sec = 1 cycle sec, 12 when sleeping

      setEnvironment((prev) => {
        let newCycleSec = prev.cycleSeconds + timeStep;
        let newDay = prev.day;
        if (newCycleSec >= 3600) {
          newCycleSec = newCycleSec % 3600;
          newDay += 1;
        }

        // High score point tracking: Longest Survived is the goal!
        recordHighScore(newDay);

        const info = getDayNightInfo(newCycleSec);

        let weather = prev.weather;
        // Weather shift roll: odds it will rain is 10% + 1% more per day/sleep until it hits a 40% chance
        if (Math.random() < 0.015) {
          const rainChance = getRainChance(newDay);
          if (Math.random() < rainChance) {
            weather = Math.random() < 0.65 ? 'Heavy Rain' : 'Thunderstorm';
          } else {
            const dryWeathers: EnvironmentState['weather'][] = ['Fog', 'Overcast', 'Clear Cold'];
            weather = dryWeathers[Math.floor(Math.random() * dryWeathers.length)];
          }
          soundManager.setWeatherAmbience(weather);
        }

        return {
          ...prev,
          day: newDay,
          cycleSeconds: newCycleSec,
          timeMinutes: Math.round(info.inGameMinutesOfDay),
          isDay: info.isDay,
          cycleRemainingMinutes: info.remainingMinutes,
          gridPower: newDay < 14,
          waterGrid: newDay < 18,
          weather,
        };
      });

      // 2. Heatmap Decay (Rain dampens and washes away noise much faster!)
      const currWeatherForDecay = environmentRef.current.weather;
      const isRainingForDecay = currWeatherForDecay === 'Heavy Rain' || currWeatherForDecay === 'Thunderstorm' || currWeatherForDecay === 'Freezing Rain';
      const decayMultiplier = isRainingForDecay ? 0.70 : 0.90;

      setNoiseHeatmap((prev) =>
        prev.map((row) =>
          row.map((val) => (val > 0.01 ? val * decayMultiplier : 0))
        )
      );

      // 3. Survivor Vitals & Natural Stamina Recovery
      setSurvivor((prev) => {
        if (isGameOverRef.current) return prev;

        // Natural Stamina (Endurance) Recovery: slowly recovers over time!
        let staminaRecoverRate = 0.5; // +0.5% per tick when walking or standing
        if (prev.isRunning) staminaRecoverRate = -0.4;
        if (prev.isSleeping) staminaRecoverRate = 4.0;
        const newEndurance = Math.max(0, Math.min(100, prev.endurance + staminaRecoverRate));

        // Sleep recovery values
        let fatigueDelta = prev.isSleeping ? -2.5 : 0.05;
        let hpGain = prev.isSleeping ? 0.8 : 0;
        let panicDrop = prev.isSleeping ? 2.0 : 0;

        let newFatigue = Math.max(0, Math.min(100, prev.fatigue + fatigueDelta));

        let isSlipping = prev.isConsciousnessSlipping ?? false;
        let slippingTimer = prev.consciousnessSlippingTimer ?? null;

        // Consciousness slipping mechanism:
        // When fatigue reaches 95% and not sleeping, final "consciousness slipping" begins with a 5-minute (300s) countdown!
        if (newFatigue >= 95 && !prev.isSleeping) {
          if (!isSlipping || slippingTimer === null) {
            isSlipping = true;
            slippingTimer = 300; // 5 minutes = 300 seconds
            soundManager.playHeartbeat();
            setSystemMessage('⚠️ CONSCIOUSNESS SLIPPING: Your vision blurs and your knees buckle! You have 5 minutes to find a bed and sleep [F], or you will collapse on the spot!');
            triggerAnimation({
              type: 'floating_text',
              x: prev.x,
              y: prev.y - 20,
              angle: 0,
              text: 'CONSCIOUSNESS SLIPPING (5:00)!',
              color: '#ef4444',
              durationMs: 3000,
            });
          } else {
            slippingTimer = Math.max(0, slippingTimer - 1);
            if (slippingTimer <= 0) {
              // 5 minutes elapsed without going to bed -> Collapse and pass out on the spot!
              slippingTimer = null;
              isSlipping = false;
              setTimeout(() => {
                passOutFromExhaustion();
              }, 40);
            }
          }
        } else if (newFatigue < 85) {
          isSlipping = false;
          slippingTimer = null;
        }

        // Hunger: from 100% full, takes 30 minutes (1800s) to empty (0.05556%/sec)
        const hungerDrain = 100 / 1800;
        const newHunger = Math.max(0, prev.hunger - hungerDrain);

        // Thirst: from 100% full, takes 10 minutes (600s) to empty (0.16667%/sec)
        const thirstDrain = 100 / 600;
        const newThirst = Math.max(0, prev.thirst - thirstDrain);

        // HP: should ONLY go down from taking damage!
        let bleedDamage = 0;
        prev.injuries.forEach((inj) => {
          if (inj.bleeding && !inj.bandaged) {
            bleedDamage += 0.25;
          }
        });

        let virus = prev.virusProgress;
        if (prev.isBitten) {
          // If bitten while collapsed (virusProgress >= 50), fatal accelerated infection
          const virusSpeed = prev.virusProgress >= 50 ? 1.0 : 0.1;
          virus = Math.min(100, virus + virusSpeed);
        }

        const currZombies = zombiesRef.current;
        const closestZombieDist = currZombies.reduce((minDist, z) => {
          return Math.min(minDist, Math.hypot(z.x - prev.x, z.y - prev.y));
        }, 999);

        let panicDelta = -0.1 - panicDrop;
        if (!prev.isSleeping) {
          if (closestZombieDist < 120) panicDelta = 0.6;
          else if (closestZombieDist < 240) panicDelta = 0.2;
        }

        const newPanic = Math.max(0, Math.min(100, prev.panic + panicDelta));
        const newHp = Math.max(0, Math.min(100, prev.hp + hpGain - bleedDamage));

        // Auto wake up when fatigue reaches 0 in bed
        let stillSleeping = prev.isSleeping;
        if (prev.isSleeping && newFatigue <= 0) {
          stillSleeping = false;
          soundManager.playTerminalBlip();
        }

        // Fatal check: "If any of the 3 reach 0 the player will die"
        if (newHp <= 0) {
          setIsGameOver(true);
          setDeathCause('LETHAL TRAUMA: Health dropped to 0% from severe physical damage.');
          soundManager.playAlarmBeep();
        } else if (newHunger <= 0) {
          setIsGameOver(true);
          setDeathCause('STARVATION: Caloric reserves dropped to 0% (Starved to death).');
          soundManager.playAlarmBeep();
        } else if (newThirst <= 0) {
          setIsGameOver(true);
          setDeathCause('DEHYDRATION: Fluid reserves dropped to 0% (Died of fatal dehydration).');
          soundManager.playAlarmBeep();
        } else if (prev.isBitten && virus >= 100) {
          setIsGameOver(true);
          setDeathCause('CHARVAL VIRUS: 100% infection reached. Brain stem destroyed.');
          soundManager.playAlarmBeep();
        }

        return {
          ...prev,
          endurance: newEndurance,
          fatigue: newFatigue,
          hunger: newHunger,
          thirst: newThirst,
          panic: newPanic,
          hp: newHp,
          virusProgress: virus,
          isSleeping: stillSleeping,
          isConsciousnessSlipping: isSlipping,
          consciousnessSlippingTimer: slippingTimer,
        };
      });

      // 4. Zombie Sensory Tracking & Daylight Shelter Seeking AI
      setZombies((prevZombies) => {
        const s = survivorRef.current;
        const currHeatmap = noiseHeatmapRef.current;
        const currBuildings = buildingsRef.current;
        const currStructures = structuresRef.current;
        const isDaytime = environmentRef.current.isDay;

        return prevZombies
          .filter((z) => z.hp > 0)
          .map((z) => {
            const distToSurvivor = Math.hypot(s.x - z.x, s.y - z.y);
            let targetX = z.targetX ?? z.x;
            let targetY = z.targetY ?? z.y;
            let newState = z.state;

            const zMult = zombieMultiplierRef.current;
            const baseSightRadius = s.flashlightOn ? 280 : isDaytime ? 140 : 200;
            const sightRadius = baseSightRadius * zMult.sightMult;
            const bloodSmellRadius = 240 * zMult.smellMult;
            const generalScentRadius = 75 * zMult.smellMult;
            const detectsBySight = distToSurvivor < sightRadius && !s.isSleeping;
            const detectsByBlood = s.injuries.some((i) => i.bleeding) && distToSurvivor < bloodSmellRadius;
            const detectsByScent = distToSurvivor < generalScentRadius && !s.isSleeping;

            if (detectsBySight || detectsByBlood || detectsByScent) {
              newState = 'tracking';
              targetX = s.x;
              targetY = s.y;
            } else if (isDaytime) {
              // DAYTIME BEHAVIOR: "During the day zombies should try to get inside or in trees, anything to get them out of the light."
              const insideBuilding = isPointInsideBuilding(z.x, z.y, currBuildings, 6);
              const underTree = currStructures.some(
                (st) => st.type === 'tree' && Math.hypot(st.x + st.width / 2 - z.x, st.y + st.height / 2 - z.y) < 38
              );

              if (insideBuilding || underTree) {
                // Sheltered in shade from direct sun: stay idle/huddled
                newState = 'idle';
                if (Math.random() < 0.05) {
                  targetX = z.x + (Math.random() - 0.5) * 16;
                  targetY = z.y + (Math.random() - 0.5) * 16;
                }
              } else {
                // Out in direct sunlight: actively seek nearest building or tree to get out of the light!
                newState = 'wandering';
                let closestShadeDist = 9999;
                let bestTarget: { x: number; y: number } | null = null;

                for (const b of currBuildings) {
                  const bcx = b.x + b.width / 2;
                  const bcy = b.y + b.height / 2;
                  const d = Math.hypot(bcx - z.x, bcy - z.y);
                  if (d < closestShadeDist) {
                    closestShadeDist = d;
                    bestTarget = { x: bcx, y: bcy };
                  }
                }

                for (const st of currStructures) {
                  if (st.type === 'tree') {
                    const tcx = st.x + st.width / 2;
                    const tcy = st.y + st.height / 2;
                    const d = Math.hypot(tcx - z.x, tcy - z.y);
                    if (d < closestShadeDist) {
                      closestShadeDist = d;
                      bestTarget = { x: tcx, y: tcy };
                    }
                  }
                }

                if (bestTarget) {
                  targetX = bestTarget.x;
                  targetY = bestTarget.y;
                }
              }
            } else {
              // NIGHTTIME BEHAVIOR: Roam freely, pursue acoustic sound heatmap with hearing range multiplier
              const zCol = Math.floor(z.x / 20);
              const zRow = Math.floor(z.y / 20);
              const hearingRange = Math.min(14, Math.max(4, Math.round(6 * zMult.hearingMult)));
              const minHeatThreshold = Math.max(0.08, 0.20 / zMult.hearingMult);
              let peakHeat = minHeatThreshold;
              let bestCol = -1;
              let bestRow = -1;

              for (let dr = -hearingRange; dr <= hearingRange; dr++) {
                const r = zRow + dr;
                if (r < 0 || r >= GRID_ROWS) continue;
                for (let dc = -hearingRange; dc <= hearingRange; dc++) {
                  const c = zCol + dc;
                  if (c < 0 || c >= GRID_COLS) continue;
                  const heat = currHeatmap[r]?.[c] || 0;
                  if (heat > peakHeat) {
                    peakHeat = heat;
                    bestCol = c;
                    bestRow = r;
                  }
                }
              }

              if (bestCol !== -1 && bestRow !== -1) {
                newState = 'tracking';
                targetX = bestCol * 20 + 10;
                targetY = bestRow * 20 + 10;
                if (Math.random() < 0.08) soundManager.playZombieGrowl();
              } else if (newState === 'idle' && Math.random() < 0.25) {
                newState = 'wandering';
                targetX = z.x + (Math.random() - 0.5) * 160;
                targetY = z.y + (Math.random() - 0.5) * 160;
              }
            }

            return { ...z, targetX, targetY, state: newState };
          });
      });

      // 5. Periodic Zombie Spawning strictly outside buildings and fenced safe zones (scaling with spawnRateMult & populationMult)
      const zMult = zombieMultiplierRef.current;
      const baseSpawnChance = 0.12;
      const scaledSpawnChance = Math.min(0.60, baseSpawnChance * zMult.spawnRateMult);
      const maxZombieCap = Math.min(65, Math.round(28 * zMult.populationMult));
      if (Math.random() < scaledSpawnChance && zombiesRef.current.length < maxZombieCap) {
        const s = survivorRef.current;
        const validLoc = getValidZombieSpawnLocation(
          s.x,
          s.y,
          structuresRef.current,
          buildingsRef.current,
          320,
          750
        );
        if (validLoc) {
          const types: Zombie['type'][] = ['walker', 'shambler', 'crawler', 'bloated'];
          const zType = types[Math.floor(Math.random() * types.length)];
          const mult = zombieMultiplierRef.current;
          const scaledHp = Math.round(50 * mult.healthMult);
          const scaledSpeed = (0.38 + Math.random() * 0.12) * mult.speedMult;
          const newZ: Zombie = {
            id: `dyn_z_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            x: validLoc.x,
            y: validLoc.y,
            angle: Math.random() * Math.PI * 2,
            hp: scaledHp,
            maxHp: scaledHp,
            speed: scaledSpeed,
            state: 'wandering',
            type: zType,
            clothingColor: Math.random() < 0.5 ? '#475569' : '#334155',
            biteChance: 0.2,
          };
          setZombies((prev) => [...prev, newZ]);
        }
      }

      // Periodic party member chatter discussing evolving zombies every 5th day
      if (environmentRef.current.day % 5 === 0 && Math.random() < 0.015) {
        triggerEvolutionChatter(environmentRef.current.day);
      }

      // 6. Slow Material & Resource Regeneration & Outdoor Rain Barrel Water Harvesting
      const currEnvForRain = environmentRef.current;
      const isRainingForBarrels = currEnvForRain.weather === 'Heavy Rain' || currEnvForRain.weather === 'Thunderstorm' || currEnvForRain.weather === 'Freezing Rain';

      setStructures((prev) =>
        prev.map((struct) => {
          // A. Outdoor Rain Collector Barrel filling during rain (holds up to 50 bottle refills!)
          if (struct.type === 'rain_collector' && isRainingForBarrels) {
            const currentWater = struct.waterStored || 0;
            const maxW = struct.maxWater || 50;
            if (currentWater < maxW && Math.random() < 0.25) {
              // Only fills if outdoors (not covered by a roof/building)
              const isCovered = isPointInsideBuilding(
                struct.x + struct.width / 2,
                struct.y + struct.height / 2,
                buildingsRef.current,
                5
              );
              if (!isCovered) {
                return {
                  ...struct,
                  waterStored: Math.min(maxW, currentWater + 1),
                };
              }
            }
          }

          // B. Fruit bushes & orchard trees slowly regenerate fruit over time
          if (struct.type === 'fruit_bush' && (struct.fruitCount ?? 0) < (struct.maxFruit ?? 3)) {
            const now = Date.now();
            const lastHarvest = struct.lastHarvestTime || now;
            // 1 fruit regrown every 25 seconds
            if (now - lastHarvest > 25000) {
              return {
                ...struct,
                fruitCount: (struct.fruitCount || 0) + 1,
                lastHarvestTime: now,
              };
            }
          }
          // C. Young tree saplings slowly grow into mature trees
          if (struct.type === 'tree' && struct.hp < struct.maxHp) {
            if (Math.random() < 0.08) {
              const newHp = Math.min(struct.maxHp, struct.hp + 5);
              return {
                ...struct,
                hp: newHp,
                name: newHp >= struct.maxHp ? 'Charval Red Oak' : 'Young Pine Sapling',
              };
            }
          }
          return struct;
        })
      );

      // 7. Recruited NPC Survivors Autonomous Behavior, Tasks & Needs (Food, Thirst, Rest)
      setNpcs((prevNpcs) => {
        if (prevNpcs.length === 0) return prevNpcs;
        const s = survivorRef.current;
        const currZombies = zombiesRef.current;
        const currStructures = structuresRef.current;

        const base = homeBaseRef.current;

        return prevNpcs.map((npc, npcIdx) => {
          if (npc.hp <= 0 || npc.state !== 'recruited') return npc;

          let targetX = npc.targetX ?? npc.x;
          let targetY = npc.targetY ?? npc.y;
          let newHp = npc.hp;
          let npcInv = [...npc.inventory];

          // Autonomous Needs Decay: Hunger (-0.05/s), Thirst (-0.12/s), Fatigue (+0.05/s)
          let newHunger = Math.max(0, (npc.hunger ?? 100) - 0.05);
          let newThirst = Math.max(0, (npc.thirst ?? 100) - 0.12);
          let newFatigue = Math.min(100, (npc.fatigue ?? 0) + 0.05);

          // Find beds / sleeping mats located strictly within the Home Base sector
          const baseBeds = currStructures.filter(
            (st) =>
              (st.type === 'bed' || st.type === 'sleeping_mat') &&
              Math.floor(st.x / 800) === base.sectorX &&
              Math.floor(st.y / 800) === base.sectorY
          );
          const hasBaseBed = baseBeds.length > 0;

          // NEED 1: THIRST (Autonomous drink from personal canteen or rain barrel strictly in Home Base sector)
          if (newThirst < 50) {
            const drinkItem = npcInv.find(
              (i) => i.category === 'drink' && (!i.isRefillable || (i.currentSips ?? 0) > 0)
            );

            if (drinkItem) {
              if (drinkItem.isRefillable) {
                drinkItem.currentSips = Math.max(0, (drinkItem.currentSips ?? 6) - 1);
              } else if ((drinkItem.count ?? 1) > 1) {
                drinkItem.count = (drinkItem.count ?? 1) - 1;
              } else {
                npcInv = npcInv.filter((i) => i.id !== drinkItem.id);
              }
              newThirst = 100;
              triggerAnimation({
                type: 'floating_text',
                x: npc.x,
                y: npc.y - 18,
                angle: 0,
                text: `${npc.name.split(' ')[0]}: Drank Canteen`,
                color: '#38bdf8',
                durationMs: 1200,
              });
            } else {
              // Only search for rain barrels located inside the Home Base sector
              const rainBarrel = currStructures.find(
                (st) =>
                  st.type === 'rain_collector' &&
                  (st.waterStored || 0) > 0 &&
                  Math.floor(st.x / 800) === base.sectorX &&
                  Math.floor(st.y / 800) === base.sectorY
              );
              if (rainBarrel) {
                targetX = rainBarrel.x + rainBarrel.width / 2;
                targetY = rainBarrel.y + rainBarrel.height / 2;
                const bDist = Math.hypot(targetX - npc.x, targetY - npc.y);
                if (bDist <= 65) {
                  setStructures((allS) =>
                    allS.map((st) =>
                      st.id === rainBarrel.id
                        ? { ...st, waterStored: Math.max(0, (st.waterStored || 1) - 1) }
                        : st
                    )
                  );
                  newThirst = 100;
                  npcInv = npcInv.map((i) =>
                    i.isRefillable ? { ...i, currentSips: i.maxSips || 6 } : i
                  );
                  soundManager.playWaterSplash();
                  triggerAnimation({
                    type: 'floating_text',
                    x: npc.x,
                    y: npc.y - 18,
                    angle: 0,
                    text: `${npc.name.split(' ')[0]}: Refilled & Drank at Base Barrel`,
                    color: '#38bdf8',
                    durationMs: 1400,
                  });
                }
              }
            }
          }

          // NEED 2: HUNGER (Autonomous eating from personal inventory or food chest strictly in Home Base sector)
          if (newHunger < 50) {
            const foodItem = npcInv.find((i) => i.category === 'food');
            if (foodItem) {
              if ((foodItem.count ?? 1) > 1) {
                foodItem.count = (foodItem.count ?? 1) - 1;
              } else {
                npcInv = npcInv.filter((i) => i.id !== foodItem.id);
              }
              newHunger = 100;
              triggerAnimation({
                type: 'floating_text',
                x: npc.x,
                y: npc.y - 18,
                angle: 0,
                text: `${npc.name.split(' ')[0]}: Ate Rations`,
                color: '#f59e0b',
                durationMs: 1200,
              });
            } else {
              // Only search for food chests inside the Home Base sector
              const chestWithFood = currStructures.find(
                (st) =>
                  st.type === 'loot_container' &&
                  Math.floor(st.x / 800) === base.sectorX &&
                  Math.floor(st.y / 800) === base.sectorY &&
                  st.containedLoot?.some((i) => i.category === 'food')
              );
              if (chestWithFood) {
                targetX = chestWithFood.x + chestWithFood.width / 2;
                targetY = chestWithFood.y + chestWithFood.height / 2;
                const cDist = Math.hypot(targetX - npc.x, targetY - npc.y);
                if (cDist <= 65) {
                  setStructures((allS) =>
                    allS.map((st) => {
                      if (st.id === chestWithFood.id && st.containedLoot) {
                        const loot = [...st.containedLoot];
                        const fIdx = loot.findIndex((i) => i.category === 'food');
                        if (fIdx !== -1) {
                          if ((loot[fIdx].count ?? 1) > 1) {
                            loot[fIdx] = { ...loot[fIdx], count: (loot[fIdx].count ?? 1) - 1 };
                          } else {
                            loot.splice(fIdx, 1);
                          }
                        }
                        return { ...st, containedLoot: loot };
                      }
                      return st;
                    })
                  );
                  newHunger = 100;
                  triggerAnimation({
                    type: 'floating_text',
                    x: npc.x,
                    y: npc.y - 18,
                    angle: 0,
                    text: `${npc.name.split(' ')[0]}: Ate Rations from Base Chest`,
                    color: '#f59e0b',
                    durationMs: 1400,
                  });
                }
              }
            }
          }

          // NEED 3: EXHAUSTION FALLBACK (If fatigue > 85 and not following, go to base bed; if no bed, cannot sleep!)
          if (newFatigue > 85 && npc.assignedTask !== 'follow') {
            if (hasBaseBed) {
              const bed = baseBeds[npcIdx % baseBeds.length];
              targetX = bed.x + bed.width / 2;
              targetY = bed.y + bed.height / 2;
              const bDist = Math.hypot(targetX - npc.x, targetY - npc.y);
              if (bDist <= 60) {
                newFatigue = Math.max(0, newFatigue - 3.5);
                newHp = Math.min(npc.maxHp, newHp + 1.2);
              }
            } else {
              // No bed at base: they stay at base and do not get to sleep
              targetX = base.x + ((npcIdx % 2 === 0 ? 1 : -1) * 35);
              targetY = base.y + ((npcIdx > 1 ? 1 : -1) * 35);
            }
          }

          // TASK: REST / SLEEP (Must sleep at new base; if no bed in base sector, they do NOT sleep)
          if (npc.assignedTask === 'rest') {
            const isInBaseSector =
              Math.floor(npc.x / 800) === base.sectorX && Math.floor(npc.y / 800) === base.sectorY;

            if (!isInBaseSector) {
              targetX = base.x;
              targetY = base.y;
            } else if (hasBaseBed) {
              const assignedBed = baseBeds[npcIdx % baseBeds.length];
              targetX = assignedBed.x + assignedBed.width / 2;
              targetY = assignedBed.y + assignedBed.height / 2;
              const bDist = Math.hypot(targetX - npc.x, targetY - npc.y);
              if (bDist <= 60) {
                // In bed at home base -> Recover fatigue & HP
                if (newHp < npc.maxHp) newHp = Math.min(npc.maxHp, newHp + 1.5);
                newFatigue = Math.max(0, newFatigue - 3.5);
              }
            } else {
              // NO BED AT BASE: They don't get to sleep!
              targetX = base.x + ((npcIdx % 2 === 0 ? 1 : -1) * 35);
              targetY = base.y + ((npcIdx > 1 ? 1 : -1) * 35);
              // Fatigue does NOT recover without a bed
              if (Date.now() % 14000 < 1000) {
                triggerAnimation({
                  type: 'floating_text',
                  x: npc.x,
                  y: npc.y - 18,
                  angle: 0,
                  text: `${npc.name.split(' ')[0]}: No Bed at Base! Cannot sleep`,
                  color: '#f87171',
                  durationMs: 1600,
                });
              }
            }
            return {
              ...npc,
              targetX,
              targetY,
              hp: newHp,
              hunger: newHunger,
              thirst: newThirst,
              fatigue: newFatigue,
              inventory: npcInv,
            };
          }

          // TASK: FOLLOW (Follow player closely and guard them)
          if (npc.assignedTask === 'follow') {
            const distToPlayer = Math.hypot(s.x - npc.x, s.y - npc.y);
            const threatZombie = currZombies.find(
              (z) => z.hp > 0 && Math.hypot(z.x - npc.x, z.y - npc.y) < 140
            );

            if (threatZombie) {
              targetX = threatZombie.x;
              targetY = threatZombie.y;
              const zDist = Math.hypot(threatZombie.x - npc.x, threatZombie.y - npc.y);
              const isGun = npc.equippedWeapon?.weaponType === 'gun';
              const reach = isGun ? 160 : 45;

              if (zDist <= reach) {
                const dmg = npc.equippedWeapon?.damage || 25;
                if (isGun) {
                  soundManager.playMeleeHit(true);
                  emitSound(npc.x, npc.y, 250, 85, `${npc.name} Bodyguard Gunshot`);
                  triggerAnimation({
                    type: 'gunshot',
                    x: npc.x,
                    y: npc.y,
                    angle: Math.atan2(threatZombie.y - npc.y, threatZombie.x - npc.x),
                    durationMs: 200,
                  });
                } else {
                  soundManager.playMeleeHit(false);
                  triggerAnimation({
                    type: 'melee_swing',
                    x: npc.x,
                    y: npc.y,
                    angle: Math.atan2(threatZombie.y - npc.y, threatZombie.x - npc.x),
                    durationMs: 250,
                  });
                }

                triggerAnimation({
                  type: 'floating_text',
                  x: threatZombie.x,
                  y: threatZombie.y - 14,
                  angle: 0,
                  text: `${npc.name.split(' ')[0]}: -${dmg} HP`,
                  color: '#10b981',
                  durationMs: 900,
                });

                setZombies((allZ) =>
                  allZ
                    .map((z) => (z.id === threatZombie.id ? { ...z, hp: z.hp - dmg } : z))
                    .filter((z) => z.hp > 0)
                );
              }
            } else if (distToPlayer > 55) {
              targetX = s.x - Math.cos(s.angle) * 35;
              targetY = s.y - Math.sin(s.angle) * 35;
            }
          } else if (npc.assignedTask === 'patrol') {
            // TASK: PATROL (Patrol strictly the Home Base sector and eliminate any zombies strictly in that sector)
            const isInBaseSector =
              Math.floor(npc.x / 800) === base.sectorX && Math.floor(npc.y / 800) === base.sectorY;

            if (!isInBaseSector) {
              // Priority: Return directly to Home Base sector!
              targetX = base.x;
              targetY = base.y;
            } else {
              const baseZombie = currZombies.find(
                (z) =>
                  z.hp > 0 &&
                  Math.floor(z.x / 800) === base.sectorX &&
                  Math.floor(z.y / 800) === base.sectorY
              );

              if (baseZombie) {
                targetX = baseZombie.x;
                targetY = baseZombie.y;
                const zDist = Math.hypot(baseZombie.x - npc.x, baseZombie.y - npc.y);
                const isGun = npc.equippedWeapon?.weaponType === 'gun';
                const reach = isGun ? 160 : 45;

                if (zDist <= reach) {
                  const dmg = npc.equippedWeapon?.damage || 30;
                  if (isGun) {
                    soundManager.playMeleeHit(true);
                    emitSound(npc.x, npc.y, 250, 85, `${npc.name} Patrol Shot`);
                    triggerAnimation({
                      type: 'gunshot',
                      x: npc.x,
                      y: npc.y,
                      angle: Math.atan2(baseZombie.y - npc.y, baseZombie.x - npc.x),
                      durationMs: 200,
                    });
                  } else {
                    soundManager.playMeleeHit(false);
                    triggerAnimation({
                      type: 'melee_swing',
                      x: npc.x,
                      y: npc.y,
                      angle: Math.atan2(baseZombie.y - npc.y, baseZombie.x - npc.x),
                      durationMs: 250,
                    });
                  }

                  triggerAnimation({
                    type: 'floating_text',
                    x: baseZombie.x,
                    y: baseZombie.y - 14,
                    angle: 0,
                    text: `PATROL: -${dmg} HP`,
                    color: '#ef4444',
                    durationMs: 900,
                  });

                  setZombies((allZ) =>
                    allZ
                      .map((z) => (z.id === baseZombie.id ? { ...z, hp: z.hp - dmg } : z))
                      .filter((z) => z.hp > 0)
                  );
                }
              } else {
                // Patrol waypoints clamped strictly within the Home Base sector
                const secMinX = base.sectorX * 800 + 80;
                const secMaxX = base.sectorX * 800 + 720;
                const secMinY = base.sectorY * 800 + 80;
                const secMaxY = base.sectorY * 800 + 720;
                const pRadiusX = 140;
                const pRadiusY = 100;
                const waypoints = [
                  { x: Math.max(secMinX, Math.min(secMaxX, base.x - pRadiusX)), y: Math.max(secMinY, Math.min(secMaxY, base.y - pRadiusY)) },
                  { x: Math.max(secMinX, Math.min(secMaxX, base.x + pRadiusX)), y: Math.max(secMinY, Math.min(secMaxY, base.y - pRadiusY)) },
                  { x: Math.max(secMinX, Math.min(secMaxX, base.x + pRadiusX)), y: Math.max(secMinY, Math.min(secMaxY, base.y + pRadiusY)) },
                  { x: Math.max(secMinX, Math.min(secMaxX, base.x - pRadiusX)), y: Math.max(secMinY, Math.min(secMaxY, base.y + pRadiusY)) },
                ];
                const wpIndex = (Math.floor(Date.now() / 6000) + npcIdx) % waypoints.length;
                targetX = waypoints[wpIndex].x;
                targetY = waypoints[wpIndex].y;
              }
            }
          } else if (npc.assignedTask === 'maintain') {
            // TASK: MAINTAIN (Only repair structures strictly within the Home Base sector: pre-existing structures and anything player built there)
            const isInBaseSector =
              Math.floor(npc.x / 800) === base.sectorX && Math.floor(npc.y / 800) === base.sectorY;

            if (!isInBaseSector) {
              // Return directly to Home Base sector!
              targetX = base.x;
              targetY = base.y;
            } else {
              const damaged = currStructures.find(
                (st) =>
                  st.hp < st.maxHp &&
                  Math.floor(st.x / 800) === base.sectorX &&
                  Math.floor(st.y / 800) === base.sectorY &&
                  (st.type.includes('wall') || st.type.includes('fence') || st.type.includes('door') || st.type === 'barricade_window')
              );

              if (damaged) {
                targetX = damaged.x + damaged.width / 2;
                targetY = damaged.y + damaged.height / 2;
                const sDist = Math.hypot(targetX - npc.x, targetY - npc.y);

                if (sDist <= 55) {
                  soundManager.playHammerSound();
                  triggerAnimation({
                    type: 'tool_hammer',
                    x: targetX,
                    y: targetY,
                    angle: 0,
                    durationMs: 350,
                  });
                  triggerAnimation({
                    type: 'floating_text',
                    x: targetX,
                    y: targetY - 14,
                    angle: 0,
                    text: `REPAIRED +35 HP`,
                    color: '#10b981',
                    durationMs: 900,
                  });

                  setStructures((allS) =>
                    allS.map((st) =>
                      st.id === damaged.id ? { ...st, hp: Math.min(st.maxHp, st.hp + 35) } : st
                    )
                  );
                }
              } else {
                // Return to Home Base location strictly inside base sector when all structures are fully repaired
                const offsetSeed = parseInt(npc.id.replace(/\D/g, '') || '1', 10);
                targetX = base.x + Math.sin(Date.now() / 3500 + offsetSeed) * 35;
                targetY = base.y + Math.cos(Date.now() / 3500 + offsetSeed) * 35;
              }
            }
          }

          return {
            ...npc,
            targetX,
            targetY,
            hp: newHp,
            hunger: newHunger,
            thirst: newThirst,
            fatigue: newFatigue,
            inventory: npcInv,
          };
        });
      });
    }, 1000);

    // Dedicated 35ms loop for smooth zombie movement (about half player walk speed) and animation cleanup
    const movementInterval = setInterval(() => {
      if (isGameOverRef.current) return;
      const now = Date.now();
      const s = survivorRef.current;
      const currStructures = structuresRef.current;

      // Armor calculations for defense
      const armorList = Object.values(s.equippedArmor).filter(Boolean) as Item[];
      const totalArmorDefense = armorList.reduce((sum, a) => sum + (a.armorDefense || 0), 0) / 100;
      const maxBiteResistance = armorList.reduce((max, a) => Math.max(max, a.biteResistance || 0), 0) / 100;

      setZombies((prevZombies) => {
        return prevZombies.map((z) => {
          if (z.hp <= 0) return z;

          let targetX = z.targetX ?? z.x;
          let targetY = z.targetY ?? z.y;
          let newState = z.state;
          let angle = z.angle;
          let nextX = z.x;
          let nextY = z.y;
          let currentZombieHp = z.hp;

          if (newState === 'tracking') {
            const dx = targetX - z.x;
            const dy = targetY - z.y;
            angle = Math.atan2(dy, dx);
            const dist = Math.hypot(dx, dy);

            if (dist > 18) {
              // Undead move around about half as fast as player (Player walk speed is 2.2; half is 1.1)
              // During rain: increases zombie speed by 150% (x1.5): 1.1 * 1.5 = 1.65 px/tick, matching player!
              const currWeatherNow = environmentRef.current.weather;
              const isRainingNow = currWeatherNow === 'Heavy Rain' || currWeatherNow === 'Thunderstorm' || currWeatherNow === 'Freezing Rain';
              const baseDist = isRainingNow ? 1.65 : 1.1;
              // Dirt trenches slow zombies by 25%
              const isInTrench = currStructures.some(
                (st) =>
                  st.type === 'dirt_trench' &&
                  z.x >= st.x - 4 &&
                  z.x <= st.x + st.width + 4 &&
                  z.y >= st.y - 4 &&
                  z.y <= st.y + st.height + 4
              );
              // Tier 2 Clay Pit slows zombies severely by 65%!
              const isInClayPit = currStructures.some(
                (st) =>
                  st.type === 'trap_clay_pit' &&
                  z.x >= st.x - 4 &&
                  z.x <= st.x + st.width + 4 &&
                  z.y >= st.y - 4 &&
                  z.y <= st.y + st.height + 4
              );
              // Tier 2 Barbed wire slows zombies by 50% and deals contact damage!
              const touchingBarbedWire = currStructures.find(
                (st) =>
                  st.type === 'trap_barbed_wire' &&
                  z.x >= st.x - 4 &&
                  z.x <= st.x + st.width + 4 &&
                  z.y >= st.y - 4 &&
                  z.y <= st.y + st.height + 4
              );
              // Tier 3 Acid Pit slows zombies by 60% and deals 25 continuous chemical damage!
              const touchingAcidPit = currStructures.find(
                (st) =>
                  st.type === 'trap_acid_pit' &&
                  z.x >= st.x - 4 &&
                  z.x <= st.x + st.width + 4 &&
                  z.y >= st.y - 4 &&
                  z.y <= st.y + st.height + 4
              );
              // Tier 3 Shredder slows zombies by 70% and deals 35 contact damage!
              const touchingShredder = currStructures.find(
                (st) =>
                  st.type === 'trap_shredder' &&
                  z.x >= st.x - 4 &&
                  z.x <= st.x + st.width + 4 &&
                  z.y >= st.y - 4 &&
                  z.y <= st.y + st.height + 4
              );

              const trenchSpeedMod = touchingShredder ? 0.30 : isInClayPit ? 0.35 : touchingAcidPit ? 0.40 : touchingBarbedWire ? 0.50 : isInTrench ? 0.75 : 1.0;

              if (touchingAcidPit && Math.random() < 0.20) {
                const acidDmg = 25;
                currentZombieHp = Math.max(0, currentZombieHp - acidDmg);
                soundManager.playWaterSplash();
                triggerAnimation({
                  type: 'spark',
                  x: z.x,
                  y: z.y,
                  angle: angle,
                  durationMs: 300,
                });
                triggerAnimation({
                  type: 'floating_text',
                  x: z.x,
                  y: z.y - 14,
                  angle: 0,
                  text: '-25 HP (ACID PIT)',
                  color: '#22c55e',
                  durationMs: 700,
                });
              }

              if (touchingShredder && Math.random() < 0.20) {
                const shredDmg = 35;
                currentZombieHp = Math.max(0, currentZombieHp - shredDmg);
                soundManager.playMeleeHit(false);
                setBloodSplats((b) => [
                  ...b.slice(-25),
                  { x: z.x, y: z.y, radius: 12, intensity: 0.9 },
                ]);
                triggerAnimation({
                  type: 'spark',
                  x: z.x,
                  y: z.y,
                  angle: angle,
                  durationMs: 250,
                });
                triggerAnimation({
                  type: 'floating_text',
                  x: z.x,
                  y: z.y - 14,
                  angle: 0,
                  text: '-35 HP (SHREDDER)',
                  color: '#ef4444',
                  durationMs: 700,
                });
              }

              if (touchingBarbedWire && Math.random() < 0.14) {
                const wireDmg = 8;
                currentZombieHp = Math.max(0, currentZombieHp - wireDmg);
                soundManager.playMeleeHit(false);
                setBloodSplats((b) => [
                  ...b.slice(-25),
                  { x: z.x, y: z.y, radius: 10, intensity: 0.8 },
                ]);
                triggerAnimation({
                  type: 'spark',
                  x: z.x,
                  y: z.y,
                  angle: angle,
                  durationMs: 200,
                });
                triggerAnimation({
                  type: 'floating_text',
                  x: z.x,
                  y: z.y - 12,
                  angle: 0,
                  text: '-8 HP (BARBED WIRE)',
                  color: '#ef4444',
                  durationMs: 700,
                });
              }

              const moveDist = baseDist * (z.speed ? z.speed / 0.42 : 1) * zombieMultiplierRef.current.speedMult * trenchSpeedMod;
              const testX = z.x + Math.cos(angle) * moveDist;
              const testY = z.y + Math.sin(angle) * moveDist;

              const collides = currStructures.some((st) => {
                if (
                  st.type === 'tree' ||
                  st.type === 'table_chair' ||
                  st.type === 'bed' ||
                  st.type === 'sleeping_mat' ||
                  st.type === 'dirt_trench' ||
                  st.type === 'trap_clay_pit' ||
                  st.type === 'trap_barbed_wire' ||
                  st.type === 'trap_acid_pit' ||
                  st.type === 'trap_shredder' ||
                  st.type === 'ground_scrap_wood' ||
                  st.type === 'riverbed_clay'
                ) return false;
                if ((st.type === 'door_wood' || st.type === 'door_stone' || st.type === 'door_steel') && st.isOpen) return false;
                return testX >= st.x && testX <= st.x + st.width && testY >= st.y && testY <= st.y + st.height;
              });

              if (!collides) {
                nextX = testX;
                nextY = testY;
              } else {
                // If blocked by door or wall, pound on it
                if (Math.random() < 0.03) {
                  soundManager.playHammerSound();
                  setStructures((allS) =>
                    allS
                      .map((st) => {
                        if (
                          testX >= st.x - 10 &&
                          testX <= st.x + st.width + 10 &&
                          testY >= st.y - 10 &&
                          testY <= st.y + st.height + 10
                        ) {
                          const wallDmg = Math.max(1, Math.round(2 * zombieMultiplierRef.current.damageMult));
                          const newHp = st.hp - wallDmg;
                          triggerAnimation({
                            type: 'spark',
                            x: testX,
                            y: testY,
                            angle: angle,
                            durationMs: 250,
                          });
                          if (newHp <= 0 && (st.type === 'door_wood' || st.type === 'door_stone' || st.type === 'door_steel')) {
                            soundManager.playHammerSound();
                            setSystemMessage(`⚠️ ${st.name} was broken down by shamblers!`);
                            return { ...st, hp: 0, isOpen: true };
                          }
                          return { ...st, hp: Math.max(0, newHp) };
                        }
                        return st;
                      })
                      .filter((st) => st.type === 'door_wood' || st.type === 'door_stone' || st.type === 'door_steel' || st.hp > 0)
                  );
                }
              }
            } else if (dist <= 22 && Math.random() < 0.04) {
              soundManager.playZombieGrowl();

              // Check if survivor is blocking with shield!
              if (s.isBlocking) {
                soundManager.playHammerSound();
                triggerAnimation({
                  type: 'shield_block',
                  x: s.x,
                  y: s.y,
                  angle: angle + Math.PI,
                  durationMs: 400,
                });
                triggerAnimation({
                  type: 'floating_text',
                  x: s.x,
                  y: s.y - 18,
                  angle: 0,
                  text: 'SHIELD BLOCKED!',
                  color: '#38bdf8',
                  durationMs: 800,
                });
                setSurvivor((prev) => ({
                  ...prev,
                  hp: Math.max(0, prev.hp - 1),
                  endurance: Math.max(0, prev.endurance - 10),
                }));
                setSystemMessage('🛡️ Shield Blocked Zombie Attack! Zero vital damage sustained.');
                return z;
              }

              // Base damage scaled with compounding 2% / 10% evolution damage multiplier
              const zDmgMult = zombieMultiplierRef.current.damageMult;
              const baseDmg = Math.round(12 * zDmgMult);
              const mitigatedDmg = Math.round(baseDmg * (1 - Math.min(0.65, totalArmorDefense)));

              const roll = Math.random();
              const deflectRoll = Math.random();

              if (roll < z.biteChance) {
                if (deflectRoll < maxBiteResistance) {
                  soundManager.playMeleeHit(false);
                  triggerAnimation({
                    type: 'spark',
                    x: s.x,
                    y: s.y,
                    angle: angle,
                    durationMs: 300,
                  });
                  triggerAnimation({
                    type: 'floating_text',
                    x: s.x,
                    y: s.y - 18,
                    angle: 0,
                    text: 'ARMOR DEFLECTED BITE!',
                    color: '#10b981',
                    durationMs: 900,
                  });
                  setSurvivor((prev) => {
                    const finalHp = Math.max(0, prev.hp - mitigatedDmg);
                    if (finalHp <= 0) {
                      setIsGameOver(true);
                      setDeathCause('KILLED BY THE UNDEAD: Overwhelmed and killed by the horde.');
                      soundManager.playAlarmBeep();
                    }
                    return {
                      ...prev,
                      hp: finalHp,
                      injuries: [
                        ...prev.injuries,
                        {
                          id: Math.random().toString(),
                          part: 'Left Arm',
                          type: 'Scratch',
                          severity: 3,
                          bleeding: false,
                          bandaged: false,
                          dirtyBandage: false,
                          infected: false,
                        },
                      ],
                    };
                  });
                  setSystemMessage('🛡️ Armor deflected a lethal bite into a minor scratch!');
                } else {
                  soundManager.playAlarmBeep();
                  triggerAnimation({
                    type: 'floating_text',
                    x: s.x,
                    y: s.y - 18,
                    angle: 0,
                    text: 'BITTEN! VIRUS TRANSMITTED',
                    color: '#ef4444',
                    durationMs: 1400,
                  });
                  setSurvivor((prev) => {
                    const finalHp = Math.max(0, prev.hp - Math.round(16 * zDmgMult));
                    if (finalHp <= 0) {
                      setIsGameOver(true);
                      setDeathCause('KILLED BY THE UNDEAD: Sustained fatal bite trauma.');
                      soundManager.playAlarmBeep();
                    }
                    return {
                      ...prev,
                      isBitten: true,
                      hp: finalHp,
                      panic: 100,
                      injuries: [
                        ...prev.injuries,
                        {
                          id: Math.random().toString(),
                          part: 'Right Arm',
                          type: 'Bite',
                          severity: 9,
                          bleeding: true,
                          bandaged: false,
                          dirtyBandage: false,
                          infected: true,
                        },
                      ],
                    };
                  });
                  setSystemMessage('⚠️ SUBJECT BITTEN! Lethal transmission confirmed in tissue.');
                }
              } else {
                soundManager.playMeleeHit(false);
                triggerAnimation({
                  type: 'floating_text',
                  x: s.x,
                  y: s.y - 18,
                  angle: 0,
                  text: `-${mitigatedDmg} HP`,
                  color: '#ef4444',
                  durationMs: 800,
                });
                setSurvivor((prev) => {
                  const finalHp = Math.max(0, prev.hp - mitigatedDmg);
                  if (finalHp <= 0) {
                    setIsGameOver(true);
                    setDeathCause('KILLED BY THE UNDEAD: Overwhelmed and devoured by shamblers.');
                    soundManager.playAlarmBeep();
                  }
                  return {
                    ...prev,
                    hp: finalHp,
                    panic: Math.min(100, prev.panic + 20),
                    injuries: [
                      ...prev.injuries,
                      {
                        id: Math.random().toString(),
                        part: 'Torso',
                        type: 'Laceration',
                        severity: 4,
                        bleeding: true,
                        bandaged: false,
                        dirtyBandage: false,
                        infected: false,
                      },
                    ],
                  };
                });
                setSystemMessage(`⚠️ Laceration sustained (${mitigatedDmg} dmg taken through armor).`);
              }
            }
          } else if (newState === 'wandering') {
            // Wandering (seeking shade from sun or roaming at night)
            if (targetX !== undefined && targetY !== undefined) {
              const dx = targetX - z.x;
              const dy = targetY - z.y;
              const dist = Math.hypot(dx, dy);
              if (dist > 16) {
                angle = Math.atan2(dy, dx);
                nextX += Math.cos(angle) * 0.60;
                nextY += Math.sin(angle) * 0.60;
              } else {
                // Reached shaded building or tree!
                newState = 'idle';
              }
            } else {
              if (Math.random() < 0.05) angle += (Math.random() - 0.5) * 1.0;
              nextX += Math.cos(angle) * 0.45;
              nextY += Math.sin(angle) * 0.45;
            }
            if (Math.random() < 0.003) soundManager.playZombieGrowl();
          } else {
            // Idle (resting in shade / corner out of light)
            if (Math.random() < 0.01) angle += (Math.random() - 0.5) * 0.6;
          }

          return { ...z, hp: currentZombieHp, x: nextX, y: nextY, angle, state: newState };
        });
      });

      // Smooth NPC movement toward targetX, targetY (Survivors move as fast as the player!)
      const currWeatherNow2 = environmentRef.current.weather;
      const isRainingNow2 = currWeatherNow2 === 'Heavy Rain' || currWeatherNow2 === 'Thunderstorm' || currWeatherNow2 === 'Freezing Rain';
      const baseNpcSpeed = 2.2;
      const npcWalkSpeed = isRainingNow2 ? baseNpcSpeed * 0.75 : baseNpcSpeed;

      setNpcs((prevNpcs) =>
        prevNpcs.map((n) => {
          if (n.targetX === undefined || n.targetY === undefined) return n;
          const dx = n.targetX - n.x;
          const dy = n.targetY - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 8) {
            // If following player and far behind, or returning to Home Base from afar, sprint to reach base quickly
            const base = homeBaseRef.current;
            const isReturningToBase =
              n.assignedTask !== 'follow' &&
              (dist > 90 || Math.floor(n.x / 800) !== base.sectorX || Math.floor(n.y / 800) !== base.sectorY);
            const effectiveSpeed = ((n.assignedTask === 'follow' && dist > 110) || isReturningToBase)
              ? (isRainingNow2 ? 3.8 * 0.75 : 3.8)
              : npcWalkSpeed;
            const step = Math.min(dist, effectiveSpeed);
            return {
              ...n,
              x: n.x + (dx / dist) * step,
              y: n.y + (dy / dist) * step,
            };
          }
          return n;
        })
      );

      // Clear expired action on survivor
      if (s.activeAction && now - s.activeAction.timestamp > s.activeAction.durationMs) {
        setSurvivor((prev) => ({ ...prev, activeAction: undefined }));
      }

      // Cleanup expired animation effects
      setAnimationEffects((prev) => prev.filter((eff) => now - eff.createdAt < eff.durationMs));
    }, 35);

    return () => {
      clearInterval(interval);
      clearInterval(movementInterval);
    };
  }, [recordHighScore, triggerAnimation]);

  // Movement
  const moveSurvivor = useCallback(
    (dx: number, dy: number, running: boolean, sneaking: boolean) => {
      setSurvivor((prev) => {
        if (prev.isSleeping || isGameOverRef.current) return prev; // Cannot move while asleep in bed or dead

        let speed = 2.4;
        if (running && prev.endurance > 10) speed = 4.4;
        if (sneaking) speed = 1.3;
        if (prev.fatigue > 70) speed *= 0.6;
        if (prev.injuries.some((i) => i.part.includes('Leg'))) speed *= 0.7;

        // Rain slows players and survivors slightly
        const currWeather = environmentRef.current.weather;
        const isRaining = currWeather === 'Heavy Rain' || currWeather === 'Thunderstorm' || currWeather === 'Freezing Rain';
        if (isRaining) {
          speed *= 0.8;
        }

        const currStructures = structuresRef.current;
        const PLAYER_RADIUS = 3.5; // Compact foot contact radius for effortlessly gliding through doorways, around fences, and between furniture

        // Check if structure is solid obstacle
        const isSolid = (s: WorldStructure): boolean => {
          if (
            s.type === 'tree' ||
            s.type === 'table_chair' ||
            s.type === 'bed' ||
            s.type === 'sleeping_mat' ||
            s.type === 'fruit_bush' ||
            s.type === 'campfire' ||
            s.type === 'dirt_trench' ||
            s.type === 'trap_clay_pit' ||
            s.type === 'trap_barbed_wire' ||
            s.type === 'riverbed_clay' ||
            s.type === 'ground_scrap_wood' ||
            s.type === 'trap_acid_pit' ||
            s.type === 'trap_shredder'
          ) {
            return false;
          }
          // Open doors are never solid obstacles
          if ((s.type === 'door_wood' || s.type === 'door_stone' || s.type === 'door_steel') && s.isOpen) {
            return false;
          }
          return true;
        };

        // Inset interactive furniture and containers so player never gets snagged when approaching or interacting
        const getColliderBox = (s: WorldStructure) => {
          let bx = s.x;
          let by = s.y;
          let bw = s.width;
          let bh = s.height;
          if (
            s.type === 'workbench' ||
            s.type === 'kitchen_stove' ||
            s.type === 'loot_container' ||
            s.type === 'rain_collector' ||
            s.type === 'abandoned_car' ||
            s.type === 'bank_vault' ||
            s.type === 'home_foundation' ||
            s.type === 'boulder_rock' ||
            s.type === 'utility_pole'
          ) {
            bx += 3;
            by += 3;
            bw = Math.max(4, bw - 6);
            bh = Math.max(4, bh - 6);
          }
          return { bx, by, bw, bh };
        };

        // Circle vs AABB collision test
        const collidesAt = (testPx: number, testPy: number, radius = PLAYER_RADIUS): boolean => {
          for (const s of currStructures) {
            if (!isSolid(s)) continue;
            const { bx, by, bw, bh } = getColliderBox(s);
            const closestX = Math.max(bx, Math.min(testPx, bx + bw));
            const closestY = Math.max(by, Math.min(testPy, by + bh));
            const distX = testPx - closestX;
            const distY = testPy - closestY;
            if (distX * distX + distY * distY < radius * radius) {
              return true;
            }
          }
          return false;
        };

        // Unstuck depenetration: if player is deeply inside or overlapping any solid, find minimum push vector
        const getDepenetration = (testPx: number, testPy: number, radius = PLAYER_RADIUS) => {
          let pushX = 0;
          let pushY = 0;
          let hasPen = false;

          for (const s of currStructures) {
            if (!isSolid(s)) continue;
            const { bx, by, bw, bh } = getColliderBox(s);

            // Is center strictly inside box?
            if (testPx >= bx && testPx <= bx + bw && testPy >= by && testPy <= by + bh) {
              hasPen = true;
              const dLeft = testPx - bx + radius + 1;
              const dRight = bx + bw - testPx + radius + 1;
              const dTop = testPy - by + radius + 1;
              const dBottom = by + bh - testPy + radius + 1;
              const minD = Math.min(dLeft, dRight, dTop, dBottom);
              if (minD === dLeft) pushX -= dLeft;
              else if (minD === dRight) pushX += dRight;
              else if (minD === dTop) pushY -= dTop;
              else pushY += dBottom;
            } else {
              const closestX = Math.max(bx, Math.min(testPx, bx + bw));
              const closestY = Math.max(by, Math.min(testPy, by + bh));
              const distX = testPx - closestX;
              const distY = testPy - closestY;
              const distSq = distX * distX + distY * distY;
              if (distSq < (radius - 0.2) * (radius - 0.2)) {
                const dist = Math.sqrt(distSq);
                if (dist > 0.001) {
                  hasPen = true;
                  const pen = radius - dist;
                  pushX += (distX / dist) * pen;
                  pushY += (distY / dist) * pen;
                }
              }
            }
          }
          return { hasPen, pushX, pushY };
        };

        // 1. Initial Unstuck Depenetration
        let startX = prev.x;
        let startY = prev.y;
        const depen = getDepenetration(startX, startY);
        if (depen.hasPen) {
          startX += depen.pushX;
          startY += depen.pushY;
        }

        let moveX = dx;
        let moveY = dy;
        if (moveX !== 0 && moveY !== 0) {
          moveX *= 0.7071;
          moveY *= 0.7071;
        }
        moveX *= speed;
        moveY *= speed;

        let resolvedX = startX;
        let resolvedY = startY;

        // 2. Try full diagonal step first
        if (!collidesAt(resolvedX + moveX, resolvedY + moveY)) {
          resolvedX += moveX;
          resolvedY += moveY;
        } else {
          // X Movement with Perpendicular Sliding (slides around doors, corners & fence posts)
          if (moveX !== 0) {
            if (!collidesAt(resolvedX + moveX, resolvedY)) {
              resolvedX += moveX;
            } else {
              for (const nudge of [2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12]) {
                if (!collidesAt(resolvedX + moveX, resolvedY + nudge)) {
                  resolvedX += moveX;
                  resolvedY += nudge * 0.45;
                  break;
                }
              }
            }
          }

          // Y Movement with Perpendicular Sliding (slides through doorways & past fence ends)
          if (moveY !== 0) {
            if (!collidesAt(resolvedX, resolvedY + moveY)) {
              resolvedY += moveY;
            } else {
              for (const nudge of [2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12]) {
                if (!collidesAt(resolvedX + nudge, resolvedY + moveY)) {
                  resolvedX += nudge * 0.45;
                  resolvedY += moveY;
                  break;
                }
              }
            }
          }
        }

        // If no position change occurred and inputs were pressed, player is blocked
        if (resolvedX === prev.x && resolvedY === prev.y && (dx !== 0 || dy !== 0)) {
          return prev;
        }

        // Check procedural chunks around next player location
        updateProceduralChunks(resolvedX, resolvedY);

        const noise = running ? 45 : sneaking ? 8 : 20;
        if (Math.random() < (running ? 0.2 : 0.05)) {
          emitSound(resolvedX, resolvedY, noise * 4, noise, running ? 'Footsteps (Running)' : 'Footsteps');
        }

        const angle = dx !== 0 || dy !== 0 ? Math.atan2(dy, dx) : prev.angle;

        // Auto-collect scrap wood on the ground when the player walks over it
        const nearbyScrapWood = currStructures.filter(
          (s) => s.type === 'ground_scrap_wood' && Math.hypot(s.x + s.width / 2 - resolvedX, s.y + s.height / 2 - resolvedY) <= 30
        );
        if (nearbyScrapWood.length > 0) {
          const collectedIds = new Set(nearbyScrapWood.map((w) => w.id));
          const totalYield = nearbyScrapWood.length * 2;
          setStructures((prevList) => prevList.filter((s) => !collectedIds.has(s.id)));
          soundManager.playItemPickup();
          triggerAnimation({
            type: 'floating_text',
            x: resolvedX,
            y: resolvedY - 20,
            angle: 0,
            text: `+${totalYield} SCRAP WOOD (AUTO-COLLECTED)`,
            color: '#f59e0b',
            durationMs: 1200,
          });
          setSystemMessage(`Auto-collected ${totalYield} Scrap Wood.`);

          const newInv = [...prev.inventory];
          const woodItem = newInv.find((i) => i.id === 'inv_scrap_wood' || i.name.toLowerCase().includes('scrap wood'));
          if (woodItem) {
            woodItem.count = (woodItem.count ?? 1) + totalYield;
          } else {
            newInv.push({
              id: 'inv_scrap_wood',
              name: 'Scrap Wood',
              category: 'resource',
              description: 'Salvaged wooden boards and sturdy branches for workbench tool crafting.',
              weight: 0.6,
              count: totalYield,
            });
          }

          return {
            ...prev,
            x: resolvedX,
            y: resolvedY,
            angle,
            isRunning: running,
            isSneaking: sneaking,
            isBlocking: false,
            inventory: newInv,
          };
        }

        return {
          ...prev,
          x: resolvedX,
          y: resolvedY,
          angle,
          isRunning: running,
          isSneaking: sneaking,
          isBlocking: false,
        };
      });
    },
    [emitSound, triggerAnimation, updateProceduralChunks]
  );

  // Left Click Action: ATTACK ONLY! (Fists Strike / Melee Swing / Gunshot / Shield Block)
  const handlePrimaryAction = useCallback(
    (targetWorldX: number, targetWorldY: number) => {
      if (isGameOverRef.current) return;

      // 1. If in Placement Mode -> Left Click Places Structure!
      if (placementGhostRef.current) {
        confirmPlacement(targetWorldX, targetWorldY);
        return;
      }

      const curr = survivorRef.current;
      if (curr.isSleeping) {
        wakeUp();
        return;
      }

      // Determine active item
      const activeItem =
        curr.activeSlot === 'weapon1'
          ? curr.equippedWeapon
          : curr.activeSlot === 'weapon2'
          ? curr.equippedWeapon2
          : curr.equippedTool;

      const weaponType = activeItem?.weaponType || 'melee';

      // 2. If Shield -> Left Click Blocks!
      if (weaponType === 'shield') {
        const aimAngle = Math.atan2(targetWorldY - curr.y, targetWorldX - curr.x);
        soundManager.playTerminalBlip();
        triggerAnimation({
          type: 'shield_block',
          x: curr.x,
          y: curr.y,
          angle: aimAngle,
          durationMs: 500,
        });
        setSurvivor((s) => ({
          ...s,
          isBlocking: true,
          activeAction: {
            type: 'block',
            timestamp: Date.now(),
            durationMs: 1500,
            angle: aimAngle,
          },
        }));
        setSystemMessage('🛡️ Shield Raised! Blocking stance active.');
        setTimeout(() => {
          setSurvivor((s) => ({ ...s, isBlocking: false }));
        }, 1500);
        return;
      }

      // 3. If Gun -> Left Click Shoots!
      if (weaponType === 'gun') {
        // Check ammo in inventory
        const ammoName = activeItem?.ammoType || '12g Buckshot Shells';
        const ammoItem = curr.inventory.find((i) => i.name.toLowerCase().includes('shotgun') || i.name.toLowerCase().includes('shells'));

        if (!ammoItem || (ammoItem.count ?? 0) <= 0) {
          soundManager.playTerminalBlip();
          setSystemMessage(`*Dry click* Out of ${ammoName}! Press [C] at a Workbench to craft shells.`);
          return;
        }

        // Consume 1 round
        setSurvivor((s) => {
          const newInv = s.inventory
            .map((i) => (i.id === ammoItem.id ? (i.count && i.count > 1 ? { ...i, count: i.count - 1 } : null) : i))
            .filter(Boolean) as Item[];
          return { ...s, inventory: newInv };
        });

        // Fire gunshot blast with panic aim inaccuracy!
        const rawAimAngle = Math.atan2(targetWorldY - curr.y, targetWorldX - curr.x);
        const panicRatio = curr.panic / 100;
        // Panic degrades aim: up to 0.42 rad (~24 degrees) deflection
        const aimJitter = (Math.random() - 0.5) * panicRatio * 0.85;
        const aimAngle = rawAimAngle + aimJitter;

        const range = activeItem?.reach || 170;
        const shotTargetX = curr.x + Math.cos(aimAngle) * range;
        const shotTargetY = curr.y + Math.sin(aimAngle) * range;

        soundManager.playMeleeHit(true);
        emitSound(curr.x, curr.y, 350, 95, `GUNSHOT BLAST (${activeItem?.name || 'Shotgun'})`);

        setSurvivor((s) => ({
          ...s,
          activeAction: {
            type: 'shoot',
            timestamp: Date.now(),
            durationMs: 200,
            angle: aimAngle,
          },
        }));

        triggerAnimation({
          type: 'gunshot',
          x: curr.x,
          y: curr.y,
          angle: aimAngle,
          targetX: shotTargetX,
          targetY: shotTargetY,
          range,
          durationMs: 220,
        });

        if (panicRatio > 0.25) {
          triggerAnimation({
            type: 'floating_text',
            x: curr.x,
            y: curr.y - 20,
            angle: 0,
            text: `PANIC AIM -${Math.round(curr.panic)}%!`,
            color: '#f59e0b',
            durationMs: 900,
          });
        }

        // Damage zombies within shot cone along effective aimAngle!
        let hits = 0;
        const gunDmg = activeItem?.damage || 85;

        setZombies((prevZombies) =>
          prevZombies
            .map((z) => {
              const dist = Math.hypot(z.x - curr.x, z.y - curr.y);
              if (dist <= range) {
                // Check if zombie falls in spread cone around effective aimAngle
                const angleToZ = Math.atan2(z.y - curr.y, z.x - curr.x);
                let diff = Math.abs(angleToZ - aimAngle);
                while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

                if (diff <= 0.35) {
                  hits++;
                  setBloodSplats((b) => [
                    ...b.slice(-25),
                    { x: z.x, y: z.y, radius: 18, intensity: 0.95 },
                  ]);

                  triggerAnimation({
                    type: 'spark',
                    x: z.x,
                    y: z.y,
                    angle: aimAngle,
                    durationMs: 250,
                  });
                  triggerAnimation({
                    type: 'floating_text',
                    x: z.x,
                    y: z.y - 14,
                    angle: 0,
                    text: `-${gunDmg} HP`,
                    color: '#ef4444',
                    durationMs: 900,
                  });

                  return {
                    ...z,
                    hp: z.hp - gunDmg,
                    state: 'tracking' as ZombieState,
                    targetX: curr.x,
                    targetY: curr.y,
                  };
                }
              }
              return z;
            })
            .filter((z) => z.hp > 0)
        );

        setSystemMessage(
          hits > 0
            ? `💥 Shotgun blast struck ${hits} zombie${hits > 1 ? 's' : ''}!`
            : `💥 Shotgun fired (${panicRatio > 0.2 ? 'deflected by panic aim tremor!' : 'no targets in cone'}).`
        );
        return;
      }

      // 4. Check for Shovel Trench Digging when using Makeshift Shovel on open ground outside
      const isShovel = activeItem?.id.includes('shovel') || activeItem?.name.toLowerCase().includes('shovel');
      if (isShovel) {
        // If clicking on open ground with no zombie nearby, dig a dirt trench!
        const nearbyZombie = zombiesRef.current.find(
          (z) => Math.hypot(z.x - targetWorldX, z.y - targetWorldY) <= 30 || Math.hypot(z.x - curr.x, z.y - curr.y) <= 50
        );
        if (!nearbyZombie) {
          const distToTarget = Math.hypot(targetWorldX - curr.x, targetWorldY - curr.y);
          if (distToTarget > 95) {
            soundManager.playTerminalBlip();
            setSystemMessage('Move closer to dig a trench here.');
            return;
          }

          // Check if spot is indoors
          const insideBldg = buildingsRef.current.find(
            (b) =>
              targetWorldX >= b.x &&
              targetWorldX <= b.x + b.width &&
              targetWorldY >= b.y &&
              targetWorldY <= b.y + b.height
          );
          let isTearingFloor = false;
          if (insideBldg) {
            const bName = insideBldg.name.toLowerCase();
            const isHardFloor =
              bName.includes('clinic') ||
              bName.includes('medical') ||
              bName.includes('grocery') ||
              bName.includes('hardware') ||
              bName.includes('armory') ||
              bName.includes('bank');
            if (isHardFloor) {
              soundManager.playTerminalBlip();
              setSystemMessage('⚠️ Concrete/tile flooring cannot be dug with a shovel. Dig on wooden floors or open soil.');
              return;
            }
            // Can tear up wooden timber floorboards in houses/cabins/safehouses!
            isTearingFloor = true;
          }

          // Check if spot is already blocked by a solid building or tree
          const isBlocked = structuresRef.current.some(
            (st) =>
              st.type !== 'dirt_trench' &&
              targetWorldX >= st.x - 8 &&
              targetWorldX <= st.x + st.width + 8 &&
              targetWorldY >= st.y - 8 &&
              targetWorldY <= st.y + st.height + 8
          );
          if (isBlocked) {
            soundManager.playTerminalBlip();
            setSystemMessage('⚠️ Cannot dig trench on existing structures.');
            return;
          }

          const trenchX = Math.round(targetWorldX / 16) * 16 - 16;
          const trenchY = Math.round(targetWorldY / 16) * 16 - 16;
          const newTrench: WorldStructure = {
            id: `trench_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            x: trenchX,
            y: trenchY,
            width: 32,
            height: 32,
            type: 'dirt_trench',
            name: isTearingFloor ? 'Torn Floor Trench' : 'Dirt Trench',
            hp: 100,
            maxHp: 100,
          };

          setStructures((prev) => [...prev, newTrench]);
          setSurvivor((s) => {
            let inv = [...s.inventory];
            if (isTearingFloor) {
              const woodIdx = inv.findIndex(
                (i) => i.id === 'inv_scrap_wood' || i.name.toLowerCase().includes('scrap wood')
              );
              if (woodIdx !== -1) {
                inv[woodIdx] = { ...inv[woodIdx], count: (inv[woodIdx].count ?? 1) + 1 };
              } else {
                inv.push({
                  id: 'inv_scrap_wood',
                  name: 'Scrap Wood',
                  category: 'resource',
                  description: 'Salvaged wooden timber boards torn up from floorboards.',
                  weight: 0.5,
                  count: 1,
                });
              }
            } else {
              const topsoilIdx = inv.findIndex(
                (i) => i.id === 'inv_topsoil' || i.name.toLowerCase().includes('topsoil')
              );
              if (topsoilIdx !== -1) {
                inv[topsoilIdx] = { ...inv[topsoilIdx], count: (inv[topsoilIdx].count ?? 1) + 1 };
              } else {
                inv.push({
                  id: 'inv_topsoil',
                  name: 'Topsoil',
                  category: 'resource',
                  description: 'Rich excavated topsoil gathered from digging defensive trenches.',
                  weight: 0.8,
                  count: 1,
                });
              }
            }
            return {
              ...s,
              inventory: inv,
              endurance: Math.max(0, s.endurance - 5),
              fatigue: Math.min(100, s.fatigue + 0.4),
              activeAction: {
                type: 'tool_chop',
                timestamp: Date.now(),
                durationMs: 250,
                angle: Math.atan2(targetWorldY - s.y, targetWorldX - s.x),
              },
            };
          });

          soundManager.playVaultSound();
          triggerAnimation({
            type: 'tool_chop',
            x: trenchX + 16,
            y: trenchY + 16,
            angle: 0,
            durationMs: 300,
          });
          triggerAnimation({
            type: 'floating_text',
            x: trenchX + 16,
            y: trenchY - 10,
            angle: 0,
            text: isTearingFloor ? '+1 SCRAP WOOD · FLOOR TORN UP' : '+1 TOPSOIL · TRENCH DUG (-25% SLOW)',
            color: '#f59e0b',
            durationMs: 1400,
          });
          emitSound(trenchX, trenchY, 40, 16, isTearingFloor ? 'Tearing Up Floorboards' : 'Digging Dirt Trench');
          setSystemMessage(
            isTearingFloor
              ? '⛏️ Tore up wooden floorboards (+1 Scrap Wood) leaving an excavated trench.'
              : '⛏️ Dug a defensive dirt trench (+1 Topsoil). Slows zombies passing through.'
          );
          return;
        }
      }

      // 5. Default: Melee Attack with equipped weapon/tool or bare fists!
      const isBarehanded = !activeItem || (activeItem.category !== 'weapon' && activeItem.category !== 'tool');
      const rawAimAngle = Math.atan2(targetWorldY - curr.y, targetWorldX - curr.x);
      const panicRatio = curr.panic / 100;
      const aimJitter = (Math.random() - 0.5) * panicRatio * 0.5;
      const aimAngle = rawAimAngle + aimJitter;
      const reach = isBarehanded ? 38 : (activeItem?.reach ?? 48);
      const damage = isBarehanded ? 5 : (activeItem?.damage ?? 18); // Punch for 5 damage!
      const noise = isBarehanded ? 8 : (activeItem?.noise ?? 15);
      const strikeName = isBarehanded ? 'Punch' : (activeItem?.name || 'Fists');

      // Panic causes missed or grazed swings (up to 40% miss chance with panic)
      const panicMissChance = panicRatio * 0.40;
      const didPanicMiss = Math.random() < panicMissChance;

      setSurvivor((s) => ({
        ...s,
        activeAction: {
          type: 'swing',
          timestamp: Date.now(),
          durationMs: 240,
          angle: aimAngle,
        },
      }));

      triggerAnimation({
        type: 'melee_swing',
        x: curr.x,
        y: curr.y,
        angle: aimAngle,
        range: reach + 18,
        durationMs: 240,
      });

      if (didPanicMiss) {
        soundManager.playMeleeHit(false);
        triggerAnimation({
          type: 'floating_text',
          x: curr.x,
          y: curr.y - 18,
          angle: 0,
          text: `PANICKED SWING MISSED!`,
          color: '#f59e0b',
          durationMs: 900,
        });
        emitSound(curr.x, curr.y, noise * 2, noise, `Missed Strike (${strikeName})`);
        return;
      }

      if (activeItem && activeItem.durability) {
        activeItem.durability = Math.max(0, activeItem.durability - 1);
        if (activeItem.durability <= 0) {
          setSystemMessage(`⚠️ ${activeItem.name} broke!`);
          soundManager.playHammerSound();
        }
      }

      let hitAny = false;
      setZombies((prevZombies) =>
        prevZombies
          .map((z) => {
            const dist = Math.hypot(z.x - curr.x, z.y - curr.y);
            if (dist <= reach + 15) {
              hitAny = true;
              const isCrit = Math.random() < 0.25;
              const dealt = Math.round(damage * (isCrit ? 1.8 : 1.0));
              soundManager.playMeleeHit(isCrit);

              setBloodSplats((b) => [
                ...b.slice(-25),
                { x: z.x, y: z.y, radius: 12 + Math.random() * 8, intensity: 0.9 },
              ]);

              triggerAnimation({
                type: 'spark',
                x: z.x,
                y: z.y,
                angle: aimAngle,
                durationMs: 250,
              });
              triggerAnimation({
                type: 'floating_text',
                x: z.x,
                y: z.y - 14,
                angle: 0,
                text: isCrit ? `CRIT! -${dealt}` : `-${dealt} HP`,
                color: isCrit ? '#f59e0b' : '#ef4444',
                durationMs: 900,
              });

              if (isBarehanded) {
                setSystemMessage(isCrit ? '💥 CRITICAL PUNCH! (9 damage)' : '👊 Punched shambler for 5 damage!');
              }

              return {
                ...z,
                hp: z.hp - dealt,
                state: 'tracking' as ZombieState,
                targetX: curr.x,
                targetY: curr.y,
              };
            }
            return z;
          })
          .filter((z) => z.hp > 0)
      );

      emitSound(curr.x, curr.y, noise * 4, noise, `Strike (${strikeName})`);
      if (!hitAny) soundManager.playMeleeHit(false);
    },
    [confirmPlacement, emitSound, wakeUp]
  );

  // 1. World Action & Interact (Default Key: [E] or [F])
  // Handles: Open/Close Doors, Jump Fences, Looting Chests, Cutting Trees, Collecting Items, Going to Bed
  const interactWorldAction = useCallback(
    (
      onOpenWorkbench?: () => void,
      onOpenChest?: (chest: WorldStructure) => void,
      onOpenKitchen?: () => void
    ): boolean => {
      const curr = survivorRef.current;
      if (curr.isSleeping) {
        wakeUp();
        return true;
      }

      const currStructures = structuresRef.current;

      // A. Check for DOORS to open/close (within 100px of door boundary) - HIGHEST PRIORITY & 100% RELIABLE
      const nearestDoor = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'door_wood' && s.type !== 'door_stone' && s.type !== 'door_steel') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 100 }
      );

      if (nearestDoor.struct) {
        const target = nearestDoor.struct;
        soundManager.playHammerSound();
        const nextState = !target.isOpen;
        setStructures((prev) =>
          prev.map((s) => (s.id === target.id ? { ...s, isOpen: nextState } : s))
        );
        emitSound(target.x, target.y, 40, 18, nextState ? 'Door Opened' : 'Door Bolted Closed');
        triggerAnimation({
          type: 'floating_text',
          x: target.x + target.width / 2,
          y: target.y - 12,
          angle: 0,
          text: nextState ? 'DOOR OPENED' : 'DOOR CLOSED',
          color: '#38bdf8',
          durationMs: 800,
        });
        setSystemMessage(nextState ? `Unlatched and opened ${target.name}.` : `Closed and slide-bolted ${target.name}.`);
        return true;
      }

      // B. Check for nearby Fence to VAULT / JUMP OVER [E/F] (within 55px of fence boundary)
      const nearestFence = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'fence_wood' && s.type !== 'fence_wire') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 55 }
      );

      if (nearestFence.struct) {
        const fence = nearestFence.struct;
        let targetX = curr.x;
        let targetY = curr.y;

        // Vault across: hop cleanly over the fence boundary
        if (fence.width >= fence.height) {
          // Horizontal fence: hop vertically across
          if (curr.y < fence.y + fence.height / 2) {
            targetY = fence.y + fence.height + 22;
          } else {
            targetY = fence.y - 22;
          }
        } else {
          // Vertical fence: hop horizontally across
          if (curr.x < fence.x + fence.width / 2) {
            targetX = fence.x + fence.width + 22;
          } else {
            targetX = fence.x - 22;
          }
        }

        soundManager.playVaultSound();
        emitSound(targetX, targetY, 40, 15, 'Fence Vault Hop');
        triggerAnimation({
          type: 'floating_text',
          x: targetX,
          y: targetY - 14,
          angle: 0,
          text: 'VAULTED FENCE!',
          color: '#38bdf8',
          durationMs: 900,
        });
        setSurvivor((s) => ({
          ...s,
          x: targetX,
          y: targetY,
          endurance: Math.max(0, s.endurance - 3),
        }));
        setSystemMessage(`Vaulted over ${fence.name}!`);
        return true;
      }

      // C. Check for BED / SLEEPING MAT to go to bed [E/F]
      const nearestBed = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'bed' && s.type !== 'sleeping_mat') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 80 }
      );

      if (nearestBed.struct) {
        startSleeping(nearestBed.struct);
        return true;
      }

      // D. Check for LOOT CONTAINER & STORAGE CHEST [E/F]
      const nearestChest = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'loot_container') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 75 }
      );

      if (nearestChest.struct) {
        const target = nearestChest.struct;
        soundManager.playChestSound();
        if (target.name.toLowerCase().includes('tool') && !hasTriggeredToolboxSpeechRef.current) {
          hasTriggeredToolboxSpeechRef.current = true;
          triggerSurvivorSpeech("That's not enough. I should find more houses like this one to get more.", 9000);
        }
        if (onOpenChest) {
          onOpenChest(target);
        } else {
          setActiveChest(target);
        }
        setSystemMessage(`Opened ${target.name}. Store food, drink, and supplies for the colony.`);
        return true;
      }

      // E. Check for RAIN COLLECTOR BARREL [E/F] (Holds up to 50 bottle refills!)
      const nearestBarrel = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'rain_collector') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 75 }
      );

      if (nearestBarrel.struct) {
        const target = nearestBarrel.struct;
        const water = target.waterStored || 0;
        if (water <= 0) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Rain Collector Barrel is empty (0/50 refills). Wait for rainfall to collect water.');
          return true;
        }

        const canteen = curr.inventory.find((i) => i.isRefillable);
        const currentSips = canteen?.currentSips ?? 0;
        const maxSips = canteen?.maxSips ?? 10;

        if (canteen && currentSips < maxSips) {
          soundManager.playWaterSplash();
          const newWater = water - 1;
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, waterStored: newWater } : s))
          );
          setSurvivor((s) => {
            const inv = s.inventory.map((i) => {
              if (i.id === canteen.id) {
                return {
                  ...i,
                  currentSips: maxSips,
                  name: `Refillable Military Canteen (${maxSips}/${maxSips})`,
                };
              }
              return i;
            });
            return { ...s, inventory: inv };
          });
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 14,
            angle: 0,
            text: `REFILLED CANTEEN (${newWater}/50 LEFT)`,
            color: '#38bdf8',
            durationMs: 1300,
          });
          setSystemMessage(`Refilled canteen to full! (${newWater}/50 bottle refills remaining in barrel).`);
          return true;
        }

        if (curr.thirst < 85) {
          soundManager.playWaterSplash();
          const newWater = water - 1;
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, waterStored: newWater } : s))
          );
          setSurvivor((s) => ({ ...s, thirst: Math.min(100, s.thirst + 45) }));
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 14,
            angle: 0,
            text: `+45% WATER (${newWater}/50 LEFT)`,
            color: '#06b6d4',
            durationMs: 1300,
          });
          setSystemMessage(`Drank directly from rain barrel! (+45% Hydration, ${newWater}/50 refills left).`);
          return true;
        }

        setSystemMessage(`Rain Collector Barrel has ${water}/50 bottle refills. Canteen & hydration already full.`);
        return true;
      }

      // F. Check for FRUIT BUSH HARVEST [E/F]
      const nearestFruit = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'fruit_bush' || (s.fruitCount ?? 0) <= 0) return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 70 }
      );

      if (nearestFruit.struct) {
        const target = nearestFruit.struct;
        const count = target.fruitCount || 3;
        const fruitName = target.fruitType || 'Wild Blackberries';
        setSurvivor((s) => ({
          ...s,
          inventory: [
            ...s.inventory,
            {
              id: `harvest_${Date.now()}`,
              name: fruitName,
              category: 'food',
              description: 'Freshly harvested wild fruit.',
              weight: 0.3,
              nutrition: 20,
              hydration: 15,
              count,
            },
          ],
        }));
        setStructures((prev) =>
          prev.map((st) => (st.id === target.id ? { ...st, fruitCount: 0, lastHarvestTime: Date.now() } : st))
        );
        soundManager.playTerminalBlip();
        triggerAnimation({
          type: 'floating_text',
          x: target.x + target.width / 2,
          y: target.y - 14,
          angle: 0,
          text: `+${count} ${fruitName}`,
          color: '#a855f7',
          durationMs: 1200,
        });
        setSystemMessage(`Harvested ${count}x ${fruitName} from ${target.name}! Added to Backpack.`);
        return true;
      }

      // F2. Check for GROUND SCRAP WOOD to pick up [E/F]
      const nearestScrapWood = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'ground_scrap_wood') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 75 }
      );

      if (nearestScrapWood.struct) {
        const target = nearestScrapWood.struct;
        soundManager.playItemPickup();
        setStructures((prev) => prev.filter((s) => s.id !== target.id));
        setSurvivor((s) => {
          const inv = [...s.inventory];
          const existingWood = inv.find((i) => i.name === 'Scrap Wood' || i.id === 'inv_scrap_wood');
          if (existingWood) {
            existingWood.count = (existingWood.count ?? 1) + 1;
          } else {
            inv.push({
              id: `scrap_wood_${Date.now()}`,
              name: 'Scrap Wood',
              category: 'resource',
              description: 'Salvaged wooden boards and sturdy branches for workbench tool crafting.',
              weight: 0.6,
              count: 1,
            });
          }
          return { ...s, inventory: inv };
        });
        triggerAnimation({
          type: 'floating_text',
          x: target.x + target.width / 2,
          y: target.y - 14,
          angle: 0,
          text: '+1 SCRAP WOOD',
          color: '#f59e0b',
          durationMs: 1200,
        });
        setSystemMessage('Picked up Scrap Wood from the ground. Added to Backpack.');
        return true;
      }

      // G. Check for TREE to chop [E/F]
      const nearestTree = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'tree') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 75 }
      );

      if (nearestTree.struct) {
        const target = nearestTree.struct;
        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const hasIronSaw = playerOwnsTool(
          (name, id) => name.includes('iron saw') || id.includes('iron_saw') || name.includes('steel saw') || id.includes('steel_saw')
        );
        const hasAnySaw =
          hasIronSaw ||
          playerOwnsTool((name, id) => name.includes('saw') || id.includes('saw'));

        if (!hasAnySaw) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Hands cannot break down trees! Craft an Iron Saw (yields Hardwood Logs) or Scrap Saw (yields Simple Wood Planks).');
          return true;
        }

        const isTier2Saw = hasIronSaw;

        const treeAngle = Math.atan2(target.y + target.height / 2 - curr.y, target.x + target.width / 2 - curr.x);
        soundManager.playHammerSound();
        emitSound(target.x, target.y, 240, 65, 'Wood Sawing Impact');

        triggerAnimation({
          type: 'tool_chop',
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
          angle: treeAngle,
          durationMs: 320,
        });

        setSurvivor((s) => ({
          ...s,
          endurance: Math.max(0, s.endurance - 5),
          fatigue: Math.min(100, s.fatigue + 0.8),
          activeAction: {
            type: 'tool_chop',
            timestamp: Date.now(),
            durationMs: 260,
            angle: treeAngle,
          },
        }));

        const newHp = target.hp - 20;
        if (newHp <= 0) {
          setStructures((prev) => prev.filter((s) => s.id !== target.id));
          if (isTier2Saw) {
            triggerAnimation({
              type: 'floating_text',
              x: target.x + target.width / 2,
              y: target.y - 12,
              angle: 0,
              text: 'TIMBER! +4 HARDWOOD LOGS',
              color: '#10b981',
              durationMs: 1400,
            });
            setSurvivor((s) => {
              const inv = [...s.inventory];
              const logItem = inv.find((i) => i.id === 'inv_hardwood_logs' || i.name.toLowerCase().includes('hardwood log'));
              if (logItem) {
                logItem.count = (logItem.count ?? 0) + 4;
              } else {
                inv.push({
                  id: 'inv_hardwood_logs',
                  name: 'Hardwood Logs',
                  category: 'resource',
                  description: 'Dense, seasoned hardwood logs felled with an Iron Saw. Essential for Tier 2 construction and heavy weapons.',
                  weight: 2.0,
                  count: 4,
                });
              }
              return { ...s, inventory: inv };
            });
            setSystemMessage('Hardwood tree felled with Iron Saw! Harvested 4 Hardwood Logs.');
          } else {
            triggerAnimation({
              type: 'floating_text',
              x: target.x + target.width / 2,
              y: target.y - 12,
              angle: 0,
              text: 'TIMBER! +4 SIMPLE WOOD PLANKS',
              color: '#10b981',
              durationMs: 1400,
            });
            setSurvivor((s) => {
              const inv = [...s.inventory];
              const plankItem = inv.find((i) => i.id === 'inv_planks' || i.name.toLowerCase().includes('plank'));
              if (plankItem) {
                plankItem.count = (plankItem.count ?? 0) + 4;
                plankItem.name = 'Simple Wood Planks';
              } else {
                inv.push({
                  id: 'inv_planks',
                  name: 'Simple Wood Planks',
                  category: 'resource',
                  description: 'Fresh milled timber planks.',
                  weight: 1.5,
                  count: 4,
                });
              }
              return { ...s, inventory: inv };
            });
            setSystemMessage('Pine tree felled with Scrap Saw! Harvested 4 Simple Wood Planks.');
          }
        } else {
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `SAWING TREE (${newHp}/${target.maxHp})`,
            color: '#f59e0b',
            durationMs: 800,
          });
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, hp: newHp } : s))
          );
          setSystemMessage(`Sawing timber with ${isTier2Saw ? 'Iron Saw' : 'Scrap Saw'}... (${newHp}/${target.maxHp} HP)`);
        }
        return true;
      }

      // G2. Check for ABANDONED CAR to pry for Iron Pipes [E/F]
      const nearestCar = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'abandoned_car') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 80 }
      );

      if (nearestCar.struct) {
        const target = nearestCar.struct;
        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const isHoldingTemperedCrowbar = playerOwnsTool(
          (name, id) => name.includes('crowbar') || id.includes('crowbar') || name.includes('titanium') || id.includes('titanium')
        );

        if (!isHoldingTemperedCrowbar) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Prying vehicle frames requires a Tempered Crowbar (Tier 2)! Craft one at the Workbench.');
          return true;
        }

        soundManager.playHammerSound();
        emitSound(target.x, target.y, 180, 55, 'Prying Vehicle Frame');
        const nextHits = (target.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'spark',
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
          angle: 0,
          durationMs: 250,
        });

        if (nextHits >= 3) {
          setStructures((prev) => prev.filter((s) => s.id !== target.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const pIdx = inv.findIndex((i) => i.id === 'inv_iron_pipe' || i.name.toLowerCase().includes('iron pipe'));
            if (pIdx !== -1) {
              inv[pIdx] = { ...inv[pIdx], count: (inv[pIdx].count ?? 1) + 2 };
            } else {
              inv.push({
                id: 'inv_iron_pipe',
                name: 'Iron Pipes',
                category: 'resource',
                description: 'Heavy salvage iron pipes pried from vehicle chassis and dense structures. Essential for Tier 2 weapons, traps, and tools.',
                weight: 1.6,
                count: 2,
              });
            }
            const mIdx = inv.findIndex((i) => i.name.toLowerCase().includes('scrap steel') || i.name.toLowerCase().includes('scrap metal'));
            if (mIdx !== -1) {
              inv[mIdx] = { ...inv[mIdx], count: (inv[mIdx].count ?? 1) + 1 };
            } else {
              inv.push({
                id: 'inv_scrap_metal',
                name: 'Scrap Steel',
                category: 'resource',
                description: 'Scrap steel plating salvaged from vehicle chassis.',
                weight: 1.0,
                count: 1,
              });
            }
            return { ...prev, inventory: inv, endurance: Math.max(0, prev.endurance - 6) };
          });

          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 14,
            angle: 0,
            text: 'VEHICLE SALVAGED! +2 IRON PIPES, +1 SCRAP STEEL',
            color: '#38bdf8',
            durationMs: 1500,
          });
          setSystemMessage(`Pried apart ${target.name} with Tempered Crowbar! Harvested 2x Iron Pipes and 1x Scrap Steel.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `PRYING VEHICLE (${nextHits}/3)`,
            color: '#f59e0b',
            durationMs: 800,
          });
          setSystemMessage(`Prying apart ${target.name} with Tempered Crowbar... (${nextHits}/3 clicks).`);
        }
        return true;
      }

      // G3. Check for RIVERBED CLAY to excavate for Dense Clay [E/F]
      const nearestClay = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'riverbed_clay') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 75 }
      );

      if (nearestClay.struct) {
        const target = nearestClay.struct;
        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const isHoldingSteelSpade = playerOwnsTool(
          (name, id) => name.includes('spade') || id.includes('spade') || name.includes('shovel') || id.includes('shovel') || name.includes('excavator') || id.includes('excavator')
        );

        if (!isHoldingSteelSpade) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Excavating dense riverbed clay requires a Steel Spade (Tier 2)! Craft one at the Workbench.');
          return true;
        }

        soundManager.playVaultSound();
        emitSound(target.x, target.y, 80, 20, 'Excavating Dense Clay');

        triggerAnimation({
          type: 'tool_chop',
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
          angle: 0,
          durationMs: 280,
        });

        const newHp = target.hp - 40;
        if (newHp <= 0) {
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: '+2 DENSE CLAY!',
            color: '#f97316',
            durationMs: 1400,
          });
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, hp: s.maxHp } : s))
          );
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const cIdx = inv.findIndex((i) => i.id === 'inv_dense_clay' || i.name.toLowerCase().includes('dense clay'));
            if (cIdx !== -1) {
              inv[cIdx] = { ...inv[cIdx], count: (inv[cIdx].count ?? 1) + 2 };
            } else {
              inv.push({
                id: 'inv_dense_clay',
                name: 'Dense Clay',
                category: 'resource',
                description: 'Viscous, heavy riverbed clay. Used for crafting Clay Pit traps and mortar for Stone Walls.',
                weight: 1.2,
                count: 2,
              });
            }
            return { ...prev, inventory: inv, endurance: Math.max(0, prev.endurance - 6) };
          });
          setSystemMessage(`Excavated ${target.name} with Steel Spade! Harvested 2x Dense Clay.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, hp: newHp } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `DIGGING CLAY (${newHp}/${target.maxHp})`,
            color: '#f97316',
            durationMs: 700,
          });
          setSystemMessage(`Excavating clay deposit with Steel Spade... (${newHp}/${target.maxHp} HP)`);
        }
        return true;
      }

      // G4. Check for BRICK WALL to demolish for Stone Blocks [E/F]
      const nearestBrick = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'wall_brick') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 75 }
      );

      if (nearestBrick.struct) {
        const target = nearestBrick.struct;
        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const isHoldingClawHammer = playerOwnsTool(
          (name, id) => name.includes('claw hammer') || id.includes('claw_hammer') || name.includes('sledgehammer') || id.includes('sledgehammer')
        );

        if (!isHoldingClawHammer) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Demolishing brick walls requires a Claw Hammer (Tier 2) or Sledgehammer! Craft one at the Workbench.');
          return true;
        }

        soundManager.playHammerSound();
        emitSound(target.x, target.y, 160, 45, 'Demolishing Brick Wall');
        const nextHits = (target.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'tool_hammer',
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
          angle: 0,
          durationMs: 300,
        });

        if (nextHits >= 4) {
          setStructures((prev) => prev.filter((s) => s.id !== target.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const bIdx = inv.findIndex((i) => i.id === 'inv_stone_blocks' || i.name.toLowerCase().includes('stone block'));
            if (bIdx !== -1) {
              inv[bIdx] = { ...inv[bIdx], count: (inv[bIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_stone_blocks',
                name: 'Stone Blocks',
                category: 'resource',
                description: 'Solid masonry stone blocks reclaimed from demolished building walls. Used for Stone Walls and Stone Doors.',
                weight: 2.5,
                count: 3,
              });
            }
            return { ...prev, inventory: inv, endurance: Math.max(0, prev.endurance - 8) };
          });

          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 14,
            angle: 0,
            text: 'WALL DEMOLISHED! +3 STONE BLOCKS',
            color: '#cbd5e1',
            durationMs: 1500,
          });
          setSystemMessage(`Demolished ${target.name} with Claw Hammer! Salvaged 3x Stone Blocks.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `DEMOLISHING BRICK (${nextHits}/4)`,
            color: '#f59e0b',
            durationMs: 700,
          });
          setSystemMessage(`Demolishing ${target.name}... (${nextHits}/4 hits).`);
        }
        return true;
      }

      // G5. Check for UTILITY POLE to harvest for Treated Planks [E/F]
      const nearestPole = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'utility_pole') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 80 }
      );

      if (nearestPole.struct) {
        const target = nearestPole.struct;
        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const isHoldingMotorizedSaw = playerOwnsTool(
          (name, id) => name.includes('motorized saw') || id.includes('motorized_saw') || name.includes('chainsaw') || id.includes('chainsaw')
        );

        if (!isHoldingMotorizedSaw) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Harvesting utility poles requires a Motorized Saw (Tier 3)! Craft one at the Workbench.');
          return true;
        }

        soundManager.playHammerSound();
        emitSound(target.x, target.y, 250, 70, 'Motorized Saw Whine');
        const nextHits = (target.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'spark',
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
          angle: 0,
          durationMs: 250,
        });

        if (nextHits >= 3) {
          setStructures((prev) => prev.filter((s) => s.id !== target.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const pIdx = inv.findIndex((i) => i.id === 'inv_treated_planks' || i.name.toLowerCase().includes('treated plank'));
            if (pIdx !== -1) {
              inv[pIdx] = { ...inv[pIdx], count: (inv[pIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_treated_planks',
                name: 'Treated Planks',
                category: 'resource',
                description: 'Creosote-treated weather-resistant timber harvested from industrial utility poles. Used in heavy Tier 3 base structures.',
                weight: 2.0,
                count: 3,
              });
            }
            return { ...prev, inventory: inv, endurance: Math.max(0, prev.endurance - 6) };
          });

          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 14,
            angle: 0,
            text: 'POLE FELLED! +3 TREATED PLANKS',
            color: '#a855f7',
            durationMs: 1500,
          });
          setSystemMessage(`Felled ${target.name} with Motorized Saw! Harvested 3x Treated Planks.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `SAWING POLE (${nextHits}/3)`,
            color: '#a855f7',
            durationMs: 700,
          });
          setSystemMessage(`Sawing ${target.name} with Motorized Saw... (${nextHits}/3 hits).`);
        }
        return true;
      }

      // G6. Check for HOME FOUNDATION to demolish for Concrete Mix [E/F]
      const nearestFoundation = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'home_foundation') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 80 }
      );

      if (nearestFoundation.struct) {
        const target = nearestFoundation.struct;
        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const isHoldingSledgehammer = playerOwnsTool(
          (name, id) => name.includes('sledgehammer') || id.includes('sledgehammer') || name.includes('demolition') || id.includes('demolition')
        );

        if (!isHoldingSledgehammer) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Breaking home foundations requires a Sledgehammer (Tier 3)! Craft one at the Workbench.');
          return true;
        }

        soundManager.playHammerSound();
        emitSound(target.x, target.y, 200, 60, 'Sledgehammer Foundation Impact');
        const nextHits = (target.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'tool_hammer',
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
          angle: 0,
          durationMs: 300,
        });

        if (nextHits >= 4) {
          setStructures((prev) => prev.filter((s) => s.id !== target.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const cIdx = inv.findIndex((i) => i.id === 'inv_concrete_mix' || i.name.toLowerCase().includes('concrete mix'));
            if (cIdx !== -1) {
              inv[cIdx] = { ...inv[cIdx], count: (inv[cIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_concrete_mix',
                name: 'Concrete Mix',
                category: 'resource',
                description: 'Crushed and pulverized industrial concrete rubble. Used for casting Poured Concrete Fortifications.',
                weight: 2.8,
                count: 3,
              });
            }
            return { ...prev, inventory: inv, endurance: Math.max(0, prev.endurance - 8) };
          });

          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 14,
            angle: 0,
            text: 'FOUNDATION DEMOLISHED! +3 CONCRETE MIX',
            color: '#94a3b8',
            durationMs: 1500,
          });
          setSystemMessage(`Demolished ${target.name} with Sledgehammer! Salvaged 3x Concrete Mix.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `BREAKING CONCRETE (${nextHits}/4)`,
            color: '#94a3b8',
            durationMs: 700,
          });
          setSystemMessage(`Smashing ${target.name} with Sledgehammer... (${nextHits}/4 hits).`);
        }
        return true;
      }

      // G7. Check for BANK VAULT to breach for Steel Plates [E/F]
      const nearestVault = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'bank_vault') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 85 }
      );

      if (nearestVault.struct) {
        const target = nearestVault.struct;
        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const isHoldingHeavyBreaker = playerOwnsTool(
          (name, id) => name.includes('heavy breaker') || id.includes('heavy_breaker') || name.includes('breaker') || id.includes('breaker')
        );

        if (!isHoldingHeavyBreaker) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Breaching heavy bank vaults requires a Heavy Breaker (Tier 3)! Craft one at the Workbench.');
          return true;
        }

        soundManager.playHammerSound();
        emitSound(target.x, target.y, 220, 65, 'Hydraulic Breaker Vault Strike');
        const nextHits = (target.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'spark',
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
          angle: 0,
          durationMs: 250,
        });

        if (nextHits >= 4) {
          setStructures((prev) => prev.filter((s) => s.id !== target.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const sIdx = inv.findIndex((i) => i.id === 'inv_steel_plates' || i.name.toLowerCase().includes('steel plate'));
            if (sIdx !== -1) {
              inv[sIdx] = { ...inv[sIdx], count: (inv[sIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_steel_plates',
                name: 'Steel Plates',
                category: 'resource',
                description: 'Hardened high-tensile structural steel plates breached from bank vaults and heavy industrial installations.',
                weight: 3.2,
                count: 3,
              });
            }
            return { ...prev, inventory: inv, endurance: Math.max(0, prev.endurance - 9) };
          });

          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 14,
            angle: 0,
            text: 'VAULT BREACHED! +3 STEEL PLATES',
            color: '#38bdf8',
            durationMs: 1500,
          });
          setSystemMessage(`Breached ${target.name} with Heavy Breaker! Salvaged 3x Steel Plates.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `BREACHING VAULT (${nextHits}/4)`,
            color: '#38bdf8',
            durationMs: 700,
          });
          setSystemMessage(`Breaching ${target.name} with Heavy Breaker... (${nextHits}/4 hits).`);
        }
        return true;
      }

      // G8. Check for BOULDER ROCK to trench for Gravel [E/F]
      const nearestRock = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'boulder_rock') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 80 }
      );

      if (nearestRock.struct) {
        const target = nearestRock.struct;
        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const isHoldingPowerTrencher = playerOwnsTool(
          (name, id) => name.includes('power trencher') || id.includes('power_trencher') || name.includes('trencher') || id.includes('trencher')
        );

        if (!isHoldingPowerTrencher) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Excavating bedrock rocks requires a Power Trencher (Tier 3)! Craft one at the Workbench.');
          return true;
        }

        soundManager.playVaultSound();
        emitSound(target.x, target.y, 210, 60, 'Power Trencher Excavation');
        const nextHits = (target.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'tool_chop',
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
          angle: 0,
          durationMs: 280,
        });

        if (nextHits >= 3) {
          setStructures((prev) => prev.filter((s) => s.id !== target.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const gIdx = inv.findIndex((i) => i.id === 'inv_gravel' || i.name.toLowerCase().includes('gravel'));
            if (gIdx !== -1) {
              inv[gIdx] = { ...inv[gIdx], count: (inv[gIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_gravel',
                name: 'Gravel',
                category: 'resource',
                description: 'Coarse crushed stone aggregate milled from rocks with a Power Trencher. Key aggregate for Poured Concrete.',
                weight: 2.2,
                count: 3,
              });
            }
            return { ...prev, inventory: inv, endurance: Math.max(0, prev.endurance - 7) };
          });

          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 14,
            angle: 0,
            text: 'ROCK CRUSHED! +3 GRAVEL',
            color: '#e2e8f0',
            durationMs: 1500,
          });
          setSystemMessage(`Crushed ${target.name} with Power Trencher! Harvested 3x Gravel.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `TRENCHING ROCK (${nextHits}/3)`,
            color: '#e2e8f0',
            durationMs: 700,
          });
          setSystemMessage(`Trenching ${target.name} with Power Trencher... (${nextHits}/3 hits).`);
        }
        return true;
      }

      // H. Check for WORKBENCH [E/F]
      const nearestBench = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'workbench') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 75 }
      );

      if (nearestBench.struct) {
        soundManager.playTerminalBlip();
        setSystemMessage('Accessed Carpentry Workbench.');
        if (onOpenWorkbench) onOpenWorkbench();
        return true;
      }

      // I. Stove, Campfire, Table
      const nearestOther = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 75 }
      );

      if (nearestOther.struct) {
        const target = nearestOther.struct;
        if (target.type === 'kitchen_stove' || target.type === 'campfire') {
          soundManager.playTerminalBlip();
          setSystemMessage(`${target.name} ready for boiling and cooking.`);
          if (onOpenKitchen) onOpenKitchen();
          return true;
        }
        if (target.type === 'table_chair') {
          soundManager.playTerminalBlip();
          setSurvivor((s) => ({
            ...s,
            boredom: Math.max(0, s.boredom - 45),
            panic: Math.max(0, s.panic - 30),
            endurance: Math.min(100, s.endurance + 25),
          }));
          setSystemMessage('Sat at dining table. Anxiety and boredom cleared.');
          return true;
        }
      }

      return false;
    },
    [emitSound, startSleeping, wakeUp]
  );

  // Right Click Action: ALL OTHER INTERACTIONS (Looting, Workbench, Kitchen, Doors, Bed, Barrel, NPCs, Dismantle)
  const handleSecondaryAction = useCallback(
    (
      targetWorldX: number,
      targetWorldY: number,
      options?: {
        onOpenWorkbench?: () => void;
        onOpenKitchen?: () => void;
        onOpenChest?: (chest: WorldStructure) => void;
        onOpenNpc?: (npc: NpcSurvivor) => void;
      }
    ) => {
      if (isGameOverRef.current) return;

      // Cancel placement if right-clicked during placement mode
      if (placementGhostRef.current) {
        cancelPlacement();
        return;
      }

      const curr = survivorRef.current;
      if (curr.isSleeping) {
        wakeUp();
        return;
      }

      // Helper: tests if cursor is directly hovering over a structure boundary
      const isDirectlyOver = (s: WorldStructure, padding = 4) => {
        return (
          targetWorldX >= s.x - padding &&
          targetWorldX <= s.x + s.width + padding &&
          targetWorldY >= s.y - padding &&
          targetWorldY <= s.y + s.height + padding
        );
      };

      // 1. Right Click on NPC SURVIVOR (Must be hovering directly over NPC)
      const hoveredNpc = npcs.find((n) => Math.hypot(n.x - targetWorldX, n.y - targetWorldY) <= 22);
      if (hoveredNpc) {
        const dPlayer = Math.hypot(hoveredNpc.x - curr.x, hoveredNpc.y - curr.y);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to speak with ${hoveredNpc.name}. Move closer.`);
          return;
        }
        soundManager.playTerminalBlip();
        if (options?.onOpenNpc) {
          options.onOpenNpc(hoveredNpc);
        }
        return;
      }

      // 2. Right Click on DOORS (Must be hovering directly over door)
      const hoveredDoor = structuresRef.current.find(
        (s) => (s.type === 'door_wood' || s.type === 'door_stone' || s.type === 'door_steel') && isDirectlyOver(s, 6)
      );
      if (hoveredDoor) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredDoor.x, hoveredDoor.y, hoveredDoor.width, hoveredDoor.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to reach ${hoveredDoor.name}. Move closer.`);
          return;
        }
        soundManager.playHammerSound();
        const nextState = !hoveredDoor.isOpen;
        setStructures((prev) =>
          prev.map((s) => (s.id === hoveredDoor.id ? { ...s, isOpen: nextState } : s))
        );
        emitSound(hoveredDoor.x, hoveredDoor.y, 40, 18, nextState ? 'Door Opened' : 'Door Bolted Closed');
        triggerAnimation({
          type: 'floating_text',
          x: hoveredDoor.x + hoveredDoor.width / 2,
          y: hoveredDoor.y - 12,
          angle: 0,
          text: nextState ? 'DOOR OPENED' : 'DOOR CLOSED',
          color: '#38bdf8',
          durationMs: 800,
        });
        setSystemMessage(nextState ? `Opened ${hoveredDoor.name}.` : `Closed ${hoveredDoor.name}.`);
        return;
      }

      // 3. Right Click on LOOT CONTAINERS & STORAGE CHESTS (Must be hovering directly over container)
      const hoveredChest = structuresRef.current.find((s) => s.type === 'loot_container' && isDirectlyOver(s, 5));
      if (hoveredChest) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredChest.x, hoveredChest.y, hoveredChest.width, hoveredChest.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to access ${hoveredChest.name}. Move closer.`);
          return;
        }

        const activeItem =
          curr.activeSlot === 'weapon1'
            ? curr.equippedWeapon
            : curr.activeSlot === 'weapon2'
            ? curr.equippedWeapon2
            : curr.equippedTool;

        const isHoldingCrowbar =
          (activeItem?.name.toLowerCase().includes('crowbar') || activeItem?.id.toLowerCase().includes('crowbar')) ||
          (curr.activeSlot === 'tool' && curr.equippedTool?.name.toLowerCase().includes('crowbar'));

        // If holding Bent Crowbar: break down the grey lootable box into metal strips!
        if (isHoldingCrowbar) {
          soundManager.playHammerSound();
          emitSound(hoveredChest.x, hoveredChest.y, 45, 22, 'Prying Apart Supply Box');
          const nextHits = (hoveredChest.dismantleHits || 0) + 1;

          triggerAnimation({
            type: 'spark',
            x: targetWorldX,
            y: targetWorldY,
            angle: 0,
            durationMs: 250,
          });

          if (nextHits >= 3) {
            setStructures((prev) => prev.filter((s) => s.id !== hoveredChest.id));
            setSurvivor((prev) => {
              let inv = [...prev.inventory];
              const msIdx = inv.findIndex(
                (i) => i.id === 'inv_metal_strips' || i.name.toLowerCase().includes('metal strip')
              );
              if (msIdx !== -1) {
                inv[msIdx] = { ...inv[msIdx], count: (inv[msIdx].count ?? 1) + 2 };
              } else {
                inv.push({
                  id: 'inv_metal_strips',
                  name: 'Metal Strips',
                  category: 'resource',
                  description: 'Salvaged metal strips pried from supply crates and hardware fixtures.',
                  weight: 0.3,
                  count: 2,
                });
              }

              // Transfer any contained loot safely to player's backpack
              if (hoveredChest.containedLoot && hoveredChest.containedLoot.length > 0) {
                hoveredChest.containedLoot.forEach((lootItem) => {
                  const existingIdx = inv.findIndex((i) => i.name === lootItem.name);
                  if (existingIdx !== -1) {
                    inv[existingIdx] = {
                      ...inv[existingIdx],
                      count: (inv[existingIdx].count ?? 1) + (lootItem.count ?? 1),
                    };
                  } else {
                    inv.push({ ...lootItem });
                  }
                });
              }

              return {
                ...prev,
                inventory: inv,
                endurance: Math.max(0, prev.endurance - 5),
              };
            });

            soundManager.playChestSound();
            triggerAnimation({
              type: 'floating_text',
              x: hoveredChest.x + hoveredChest.width / 2,
              y: hoveredChest.y - 14,
              angle: 0,
              text: 'BOX BROKEN DOWN! +2 METAL STRIPS',
              color: '#38bdf8',
              durationMs: 1400,
            });
            setSystemMessage(
              `Pried apart ${hoveredChest.name} with Bent Crowbar! Harvested 2x Metal Strips and recovered all supplies.`
            );
            return;
          } else {
            setStructures((prev) =>
              prev.map((s) => (s.id === hoveredChest.id ? { ...s, dismantleHits: nextHits } : s))
            );
            triggerAnimation({
              type: 'floating_text',
              x: targetWorldX,
              y: targetWorldY - 14,
              angle: 0,
              text: `PRYING BOX (${nextHits}/3)`,
              color: '#38bdf8',
              durationMs: 700,
            });
            setSystemMessage(
              `Prying apart ${hoveredChest.name} with Bent Crowbar... (${nextHits}/3 prying clicks).`
            );
            return;
          }
        }

        // Default: Open or search container
        soundManager.playChestSound();
        if (options?.onOpenChest) {
          options.onOpenChest(hoveredChest);
        } else {
          setActiveChest(hoveredChest);
        }
        triggerAnimation({
          type: 'floating_text',
          x: hoveredChest.x + hoveredChest.width / 2,
          y: hoveredChest.y - 12,
          angle: 0,
          text: 'LOOT CONTAINER',
          color: '#38bdf8',
          durationMs: 800,
        });
        setSystemMessage(`Opened ${hoveredChest.name}.`);
        return;
      }

      // 4. Right Click on WORKBENCH (Must be hovering directly over workbench)
      const hoveredWorkbench = structuresRef.current.find((s) => s.type === 'workbench' && isDirectlyOver(s, 5));
      if (hoveredWorkbench) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredWorkbench.x, hoveredWorkbench.y, hoveredWorkbench.width, hoveredWorkbench.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to access ${hoveredWorkbench.name}. Move closer.`);
          return;
        }
        soundManager.playTerminalBlip();
        if (options?.onOpenWorkbench) {
          options.onOpenWorkbench();
        }
        triggerAnimation({
          type: 'floating_text',
          x: hoveredWorkbench.x + hoveredWorkbench.width / 2,
          y: hoveredWorkbench.y - 12,
          angle: 0,
          text: 'WORKBENCH CRAFTING',
          color: '#f59e0b',
          durationMs: 800,
        });
        setSystemMessage(`Accessed ${hoveredWorkbench.name} Crafting Table.`);
        return;
      }

      // 5. Right Click on KITCHEN STOVE / CAMPFIRE (Must be hovering directly over stove/campfire)
      const hoveredKitchen = structuresRef.current.find(
        (s) => (s.type === 'kitchen_stove' || s.type === 'campfire') && isDirectlyOver(s, 5)
      );
      if (hoveredKitchen) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredKitchen.x, hoveredKitchen.y, hoveredKitchen.width, hoveredKitchen.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to access ${hoveredKitchen.name}. Move closer.`);
          return;
        }
        soundManager.playTerminalBlip();
        if (options?.onOpenKitchen) {
          options.onOpenKitchen();
        }
        triggerAnimation({
          type: 'floating_text',
          x: hoveredKitchen.x + hoveredKitchen.width / 2,
          y: hoveredKitchen.y - 12,
          angle: 0,
          text: 'KITCHEN RATIONS',
          color: '#f97316',
          durationMs: 800,
        });
        setSystemMessage(`${hoveredKitchen.name} ready for food rations & cooking.`);
        return;
      }

      // 6. Right Click on BED / SLEEPING MAT (Must be hovering directly over bed)
      const hoveredBed = structuresRef.current.find(
        (s) => (s.type === 'bed' || s.type === 'sleeping_mat') && isDirectlyOver(s, 5)
      );
      if (hoveredBed) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredBed.x, hoveredBed.y, hoveredBed.width, hoveredBed.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to sleep in ${hoveredBed.name}. Move closer.`);
          return;
        }
        startSleeping(hoveredBed);
        return;
      }

      // 7. Right Click on RAIN COLLECTOR BARREL / WATER WELL (Must be hovering directly over water barrel)
      const hoveredWater = structuresRef.current.find(
        (s) => s.type === 'rain_collector' && isDirectlyOver(s, 5)
      );
      if (hoveredWater) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredWater.x, hoveredWater.y, hoveredWater.width, hoveredWater.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to reach ${hoveredWater.name}. Move closer.`);
          return;
        }
        const water = hoveredWater.waterStored || 0;
        if (water <= 0) {
          soundManager.playTerminalBlip();
          setSystemMessage(`⚠️ ${hoveredWater.name} is empty (0/50 refills). Wait for rainfall to collect water.`);
          return;
        }

        const canteen = curr.inventory.find((i) => i.isRefillable);
        const currentSips = canteen?.currentSips ?? 0;
        const maxSips = canteen?.maxSips ?? 10;

        if (canteen && currentSips < maxSips) {
          soundManager.playWaterSplash();
          const newWater = water - 1;
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredWater.id ? { ...s, waterStored: newWater } : s))
          );
          setSurvivor((s) => {
            const inv = s.inventory.map((i) => {
              if (i.id === canteen.id) {
                return {
                  ...i,
                  currentSips: maxSips,
                  name: `Refillable Military Canteen (${maxSips}/${maxSips})`,
                };
              }
              return i;
            });
            return { ...s, inventory: inv };
          });
          triggerAnimation({
            type: 'floating_text',
            x: hoveredWater.x + hoveredWater.width / 2,
            y: hoveredWater.y - 14,
            angle: 0,
            text: `REFILLED CANTEEN (${newWater}/50 LEFT)`,
            color: '#38bdf8',
            durationMs: 1300,
          });
          setSystemMessage(`Refilled canteen to full! (${newWater}/50 refills remaining in barrel).`);
          return;
        }

        if (curr.thirst < 85) {
          soundManager.playWaterSplash();
          const newWater = water - 1;
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredWater.id ? { ...s, waterStored: newWater } : s))
          );
          setSurvivor((s) => ({ ...s, thirst: Math.min(100, s.thirst + 45) }));
          triggerAnimation({
            type: 'floating_text',
            x: hoveredWater.x + hoveredWater.width / 2,
            y: hoveredWater.y - 14,
            angle: 0,
            text: `+45% WATER (${newWater}/50 LEFT)`,
            color: '#06b6d4',
            durationMs: 1300,
          });
          setSystemMessage(`Drank directly from rain barrel! (+45% Hydration, ${newWater}/50 refills left).`);
          return;
        }

        setSystemMessage(`Rain Collector Barrel has ${water}/50 bottle refills. Canteen & hydration already full.`);
        return;
      }

      // 8. Right Click on FRUIT BUSH (Must be hovering directly over bush)
      const hoveredBush = structuresRef.current.find(
        (s) => s.type === 'fruit_bush' && (s.fruitCount ?? 0) > 0 && isDirectlyOver(s, 5)
      );
      if (hoveredBush) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredBush.x, hoveredBush.y, hoveredBush.width, hoveredBush.height);
        if (dPlayer > 85) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to harvest ${hoveredBush.name}. Move closer.`);
          return;
        }
        const count = hoveredBush.fruitCount || 3;
        const fruitName = hoveredBush.fruitType || 'Wild Blackberries';
        setSurvivor((s) => ({
          ...s,
          inventory: [
            ...s.inventory,
            {
              id: `harvest_${Date.now()}`,
              name: fruitName,
              category: 'food',
              description: 'Freshly harvested wild fruit.',
              weight: 0.3,
              nutrition: 20,
              hydration: 15,
              count,
            },
          ],
        }));
        setStructures((prev) =>
          prev.map((st) => (st.id === hoveredBush.id ? { ...st, fruitCount: 0, lastHarvestTime: Date.now() } : st))
        );
        soundManager.playTerminalBlip();
        triggerAnimation({
          type: 'floating_text',
          x: hoveredBush.x + hoveredBush.width / 2,
          y: hoveredBush.y - 14,
          angle: 0,
          text: `+${count} ${fruitName}`,
          color: '#a855f7',
          durationMs: 1200,
        });
        setSystemMessage(`Harvested ${count}x ${fruitName} from ${hoveredBush.name}! Added to Backpack.`);
        return;
      }

      // 9. Right Click on FENCES (Wood Picket & Wire Fence)
      const hoveredFence = structuresRef.current.find(
        (s) => (s.type === 'fence_wood' || s.type === 'fence_wire') && isDirectlyOver(s, 6)
      );

      const activeItem =
        curr.activeSlot === 'weapon1'
          ? curr.equippedWeapon
          : curr.activeSlot === 'weapon2'
          ? curr.equippedWeapon2
          : curr.equippedTool;

      const isHoldingHammer = playerOwnsTool(
        (name, id) => name.includes('hammer') || id.includes('hammer') || name.includes('mallet') || id.includes('mallet')
      );

      const isScrapHammer = playerOwnsTool(
        (name, id) => name.includes('scrap hammer') || id.includes('scrap_hammer')
      );

      if (hoveredFence) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredFence.x, hoveredFence.y, hoveredFence.width, hoveredFence.height);
        if (dPlayer > 90) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to reach ${hoveredFence.name}. Move closer.`);
          return;
        }

        if (!isHoldingHammer) {
          soundManager.playTerminalBlip();
          setSystemMessage(`⚠️ Hands cannot break down fences! Equip a Scrap Hammer.`);
          return;
        }

        soundManager.playHammerSound();
        emitSound(hoveredFence.x, hoveredFence.y, 40, 20, 'Knocking Down Fence');
        const nextHits = (hoveredFence.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'tool_hammer',
          x: targetWorldX,
          y: targetWorldY,
          angle: Math.atan2(targetWorldY - curr.y, targetWorldX - curr.x),
          durationMs: 300,
        });

        // Knock down fence: 3 hits
        if (nextHits >= 3) {
          setStructures((prev) => prev.filter((s) => s.id !== hoveredFence.id));
          // Half the wood/nails of walls: 1 Simple Wood Plank & 1 Nail
          const planksYield = 1;
          const nailsYield = 1;

          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const pIdx = inv.findIndex((i) => i.id.includes('plank') || i.name.toLowerCase().includes('plank'));
            if (pIdx !== -1) {
              inv[pIdx] = { ...inv[pIdx], count: (inv[pIdx].count ?? 1) + planksYield };
            } else {
              inv.push({
                id: 'inv_planks',
                name: 'Simple Wood Planks',
                category: 'resource',
                description: 'Reclaimed pine timber planks from knocked down fence.',
                weight: 1.5,
                count: planksYield,
              });
            }

            const nIdx = inv.findIndex((i) => i.id.includes('nail') || i.name.toLowerCase().includes('nail'));
            if (nIdx !== -1) {
              inv[nIdx] = { ...inv[nIdx], count: (inv[nIdx].count ?? 1) + nailsYield };
            } else {
              inv.push({
                id: 'inv_nails',
                name: 'Box of Nails',
                category: 'resource',
                description: 'Reclaimed construction nails from knocked down fence.',
                weight: 0.4,
                count: nailsYield,
              });
            }

            return {
              ...prev,
              inventory: inv,
              endurance: Math.max(0, prev.endurance - 3),
              fatigue: Math.min(100, prev.fatigue + 1),
            };
          });

          triggerAnimation({
            type: 'floating_text',
            x: hoveredFence.x + hoveredFence.width / 2,
            y: hoveredFence.y - 14,
            angle: 0,
            text: `FENCE KNOCKED DOWN! +${planksYield} SIMPLE PLANK, +${nailsYield} NAIL`,
            color: '#10b981',
            durationMs: 1400,
          });

          setSystemMessage(
            `Knocked down ${hoveredFence.name} with Scrap Hammer! Recovered ${planksYield}x Simple Wood Plank & ${nailsYield}x Nail.`
          );
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredFence.id ? { ...s, dismantleHits: nextHits } : s))
          );

          triggerAnimation({
            type: 'floating_text',
            x: targetWorldX,
            y: targetWorldY - 14,
            angle: 0,
            text: `KNOCKING DOWN FENCE (${nextHits}/3)`,
            color: '#f59e0b',
            durationMs: 700,
          });

          setSystemMessage(
            `Knocking down ${hoveredFence.name}... (${nextHits}/3 hammer clicks). ${3 - nextHits} clicks remaining to tear down.`
          );
        }
        return;
      }

      // 10. Right Click on WALL (Must be hovering directly over wall)
      const hoveredWall = structuresRef.current.find((s) => s.type.includes('wall') && isDirectlyOver(s, 6));

      if (hoveredWall) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredWall.x, hoveredWall.y, hoveredWall.width, hoveredWall.height);
        if (dPlayer > 90) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to reach ${hoveredWall.name}. Move closer.`);
          return;
        }

        if (!isHoldingHammer) {
          soundManager.playTerminalBlip();
          setSystemMessage(`⚠️ Hands cannot break down walls! Equip an appropriate hammer.`);
          return;
        }

        // If brick wall: requires Claw Hammer or Sledgehammer!
        if (hoveredWall.type === 'wall_brick') {
          const isHoldingClawHammer = playerOwnsTool(
            (name, id) => name.includes('claw hammer') || id.includes('claw_hammer') || name.includes('sledgehammer') || id.includes('sledgehammer')
          );

          if (!isHoldingClawHammer) {
            soundManager.playTerminalBlip();
            setSystemMessage('⚠️ Demolishing brick walls requires a Claw Hammer (Tier 2) or Sledgehammer! Craft one at the Workbench.');
            return;
          }

          soundManager.playHammerSound();
          emitSound(hoveredWall.x, hoveredWall.y, 45, 20, 'Demolishing Brick Wall');
          const nextHits = (hoveredWall.dismantleHits || 0) + 1;

          triggerAnimation({
            type: 'tool_hammer',
            x: targetWorldX,
            y: targetWorldY,
            angle: Math.atan2(targetWorldY - curr.y, targetWorldX - curr.x),
            durationMs: 300,
          });

          if (nextHits >= 4) {
            setStructures((prev) => prev.filter((s) => s.id !== hoveredWall.id));
            setSurvivor((prev) => {
              let inv = [...prev.inventory];
              const bIdx = inv.findIndex((i) => i.id === 'inv_stone_blocks' || i.name.toLowerCase().includes('stone block'));
              if (bIdx !== -1) {
                inv[bIdx] = { ...inv[bIdx], count: (inv[bIdx].count ?? 1) + 3 };
              } else {
                inv.push({
                  id: 'inv_stone_blocks',
                  name: 'Stone Blocks',
                  category: 'resource',
                  description: 'Solid masonry stone blocks reclaimed from demolished building walls. Used for Stone Walls and Stone Doors.',
                  weight: 2.5,
                  count: 3,
                });
              }
              return {
                ...prev,
                inventory: inv,
                endurance: Math.max(0, prev.endurance - 6),
                fatigue: Math.min(100, prev.fatigue + 1.5),
              };
            });

            triggerAnimation({
              type: 'floating_text',
              x: hoveredWall.x + hoveredWall.width / 2,
              y: hoveredWall.y - 14,
              angle: 0,
              text: 'BRICK WALL DEMOLISHED! +3 STONE BLOCKS',
              color: '#cbd5e1',
              durationMs: 1500,
            });

            setSystemMessage(
              `Demolished ${hoveredWall.name} with Claw Hammer! Salvaged 3x Stone Blocks for Tier 2 construction.`
            );
          } else {
            setStructures((prev) =>
              prev.map((s) => (s.id === hoveredWall.id ? { ...s, dismantleHits: nextHits } : s))
            );

            triggerAnimation({
              type: 'floating_text',
              x: targetWorldX,
              y: targetWorldY - 14,
              angle: 0,
              text: `DEMOLISHING BRICK (${nextHits}/4)`,
              color: '#f59e0b',
              durationMs: 700,
            });

            setSystemMessage(
              `Demolishing ${hoveredWall.name} with Claw Hammer... (${nextHits}/4 hits). ${4 - nextHits} hits remaining.`
            );
          }
          return;
        }

        // Scrap Hammer CANNOT break down timber or reinforced building walls!
        if (isScrapHammer) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Scrap Hammer is too weak to break down building walls! It can only knock down fences.');
          return;
        }

        soundManager.playHammerSound();
        emitSound(hoveredWall.x, hoveredWall.y, 45, 20, 'Tearing Down Wall');
        const nextHits = (hoveredWall.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'tool_hammer',
          x: targetWorldX,
          y: targetWorldY,
          angle: Math.atan2(targetWorldY - curr.y, targetWorldX - curr.x),
          durationMs: 300,
        });

        if (nextHits >= 5) {
          setStructures((prev) => prev.filter((s) => s.id !== hoveredWall.id));
          const planksYield = 2;
          const nailsYield = 2;

          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const pIdx = inv.findIndex((i) => i.id.includes('plank') || i.name.toLowerCase().includes('plank'));
            if (pIdx !== -1) {
              inv[pIdx] = { ...inv[pIdx], count: (inv[pIdx].count ?? 1) + planksYield };
            } else {
              inv.push({
                id: 'inv_planks',
                name: 'Simple Wood Planks',
                category: 'resource',
                description: 'Reclaimed pine timber planks from dismantled wall.',
                weight: 1.5,
                count: planksYield,
              });
            }

            const nIdx = inv.findIndex((i) => i.id.includes('nail') || i.name.toLowerCase().includes('nail'));
            if (nIdx !== -1) {
              inv[nIdx] = { ...inv[nIdx], count: (inv[nIdx].count ?? 1) + nailsYield };
            } else {
              inv.push({
                id: 'inv_nails',
                name: 'Box of Nails',
                category: 'resource',
                description: 'Reclaimed construction nails from dismantled wall.',
                weight: 0.5,
                count: nailsYield,
              });
            }

            return {
              ...prev,
              inventory: inv,
              endurance: Math.max(0, prev.endurance - 4),
              fatigue: Math.min(100, prev.fatigue + 2),
            };
          });

          triggerAnimation({
            type: 'floating_text',
            x: hoveredWall.x + hoveredWall.width / 2,
            y: hoveredWall.y - 14,
            angle: 0,
            text: `WALL TORN DOWN! +${planksYield} SIMPLE PLANKS, +${nailsYield} NAILS`,
            color: '#10b981',
            durationMs: 1400,
          });

          setSystemMessage(
            `Tore down ${hoveredWall.name} with Plain Hammer! Recovered ${planksYield}x Simple Wood Planks & ${nailsYield}x Nails.`
          );
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredWall.id ? { ...s, dismantleHits: nextHits } : s))
          );

          triggerAnimation({
            type: 'floating_text',
            x: targetWorldX,
            y: targetWorldY - 14,
            angle: 0,
            text: `DISMANTLING WALL (${nextHits}/5)`,
            color: '#f59e0b',
            durationMs: 700,
          });

          setSystemMessage(
            `Dismantling ${hoveredWall.name}... (${nextHits}/5 hammer clicks). ${5 - nextHits} clicks remaining to tear down.`
          );
        }
        return;
      }

      // 11. Right Click on ABANDONED CAR (Prying for Iron Pipes)
      const hoveredCar = structuresRef.current.find((s) => s.type === 'abandoned_car' && isDirectlyOver(s, 6));
      if (hoveredCar) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredCar.x, hoveredCar.y, hoveredCar.width, hoveredCar.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to pry ${hoveredCar.name}. Move closer.`);
          return;
        }

        const isHoldingTemperedCrowbar = playerOwnsTool(
          (name, id) => name.includes('crowbar') || id.includes('crowbar') || name.includes('titanium') || id.includes('titanium')
        );

        if (!isHoldingTemperedCrowbar) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Prying vehicle frames requires a Tempered Crowbar (Tier 2)! Craft one at the Workbench.');
          return;
        }

        soundManager.playHammerSound();
        emitSound(hoveredCar.x, hoveredCar.y, 45, 22, 'Prying Vehicle Salvage');
        const nextHits = (hoveredCar.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'spark',
          x: targetWorldX,
          y: targetWorldY,
          angle: 0,
          durationMs: 250,
        });

        if (nextHits >= 3) {
          setStructures((prev) => prev.filter((s) => s.id !== hoveredCar.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const pIdx = inv.findIndex((i) => i.id === 'inv_iron_pipe' || i.name.toLowerCase().includes('iron pipe'));
            if (pIdx !== -1) {
              inv[pIdx] = { ...inv[pIdx], count: (inv[pIdx].count ?? 1) + 2 };
            } else {
              inv.push({
                id: 'inv_iron_pipe',
                name: 'Iron Pipes',
                category: 'resource',
                description: 'Heavy salvage iron pipes pried from vehicle chassis and dense structures. Essential for Tier 2 weapons, traps, and tools.',
                weight: 1.6,
                count: 2,
              });
            }
            const mIdx = inv.findIndex((i) => i.name.toLowerCase().includes('scrap steel') || i.name.toLowerCase().includes('scrap metal'));
            if (mIdx !== -1) {
              inv[mIdx] = { ...inv[mIdx], count: (inv[mIdx].count ?? 1) + 1 };
            } else {
              inv.push({
                id: 'inv_scrap_metal',
                name: 'Scrap Steel',
                category: 'resource',
                description: 'Scrap steel plating salvaged from vehicle chassis.',
                weight: 1.0,
                count: 1,
              });
            }
            return {
              ...prev,
              inventory: inv,
              endurance: Math.max(0, prev.endurance - 6),
              fatigue: Math.min(100, prev.fatigue + 1.2),
            };
          });

          triggerAnimation({
            type: 'floating_text',
            x: hoveredCar.x + hoveredCar.width / 2,
            y: hoveredCar.y - 14,
            angle: 0,
            text: 'VEHICLE SALVAGED! +2 IRON PIPES, +1 SCRAP STEEL',
            color: '#38bdf8',
            durationMs: 1500,
          });
          setSystemMessage(
            `Pried apart ${hoveredCar.name} with Tempered Crowbar! Harvested 2x Iron Pipes and 1x Scrap Steel.`
          );
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredCar.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: targetWorldX,
            y: targetWorldY - 14,
            angle: 0,
            text: `PRYING VEHICLE (${nextHits}/3)`,
            color: '#38bdf8',
            durationMs: 700,
          });
          setSystemMessage(
            `Prying apart ${hoveredCar.name} with Tempered Crowbar... (${nextHits}/3 clicks).`
          );
        }
        return;
      }

      // 12. Right Click on RIVERBED CLAY DEPOSIT (Digging for Dense Clay)
      const hoveredClay = structuresRef.current.find((s) => s.type === 'riverbed_clay' && isDirectlyOver(s, 6));
      if (hoveredClay) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredClay.x, hoveredClay.y, hoveredClay.width, hoveredClay.height);
        if (dPlayer > 90) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to excavate ${hoveredClay.name}. Move closer.`);
          return;
        }

        const isHoldingSteelSpade = playerOwnsTool(
          (name, id) => name.includes('spade') || id.includes('spade') || name.includes('shovel') || id.includes('shovel') || name.includes('excavator') || id.includes('excavator')
        );

        if (!isHoldingSteelSpade) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Excavating dense riverbed clay requires a Steel Spade (Tier 2)! Craft one at the Workbench.');
          return;
        }

        soundManager.playVaultSound();
        emitSound(hoveredClay.x, hoveredClay.y, 40, 18, 'Digging Dense Clay');

        triggerAnimation({
          type: 'tool_chop',
          x: targetWorldX,
          y: targetWorldY,
          angle: 0,
          durationMs: 280,
        });

        const newHp = hoveredClay.hp - 40;
        if (newHp <= 0) {
          triggerAnimation({
            type: 'floating_text',
            x: hoveredClay.x + hoveredClay.width / 2,
            y: hoveredClay.y - 14,
            angle: 0,
            text: '+2 DENSE CLAY!',
            color: '#f97316',
            durationMs: 1400,
          });
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredClay.id ? { ...s, hp: s.maxHp } : s))
          );
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const cIdx = inv.findIndex((i) => i.id === 'inv_dense_clay' || i.name.toLowerCase().includes('dense clay'));
            if (cIdx !== -1) {
              inv[cIdx] = { ...inv[cIdx], count: (inv[cIdx].count ?? 1) + 2 };
            } else {
              inv.push({
                id: 'inv_dense_clay',
                name: 'Dense Clay',
                category: 'resource',
                description: 'Viscous, heavy riverbed clay. Used for crafting Clay Pit traps and mortar for Stone Walls.',
                weight: 1.2,
                count: 2,
              });
            }
            return {
              ...prev,
              inventory: inv,
              endurance: Math.max(0, prev.endurance - 5),
              fatigue: Math.min(100, prev.fatigue + 1),
            };
          });
          setSystemMessage(`Excavated ${hoveredClay.name} with Steel Spade! Harvested 2x Dense Clay.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredClay.id ? { ...s, hp: newHp } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: targetWorldX,
            y: targetWorldY - 14,
            angle: 0,
            text: `DIGGING CLAY (${newHp}/${hoveredClay.maxHp})`,
            color: '#f97316',
            durationMs: 700,
          });
          setSystemMessage(`Excavating clay deposit with Steel Spade... (${newHp}/${hoveredClay.maxHp} HP)`);
        }
        return;
      }

      // 13. Right Click on UTILITY POLE (Felling for Treated Planks)
      const hoveredPole = structuresRef.current.find((s) => s.type === 'utility_pole' && isDirectlyOver(s, 6));
      if (hoveredPole) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredPole.x, hoveredPole.y, hoveredPole.width, hoveredPole.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to saw ${hoveredPole.name}. Move closer.`);
          return;
        }

        const isHoldingMotorizedSaw = playerOwnsTool(
          (name, id) => name.includes('motorized saw') || id.includes('motorized_saw') || name.includes('chainsaw') || id.includes('chainsaw')
        );

        if (!isHoldingMotorizedSaw) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Harvesting utility poles requires a Motorized Saw (Tier 3)! Craft one at the Workbench.');
          return;
        }

        soundManager.playHammerSound();
        emitSound(hoveredPole.x, hoveredPole.y, 250, 70, 'Motorized Saw Whine');
        const nextHits = (hoveredPole.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'spark',
          x: targetWorldX,
          y: targetWorldY,
          angle: 0,
          durationMs: 250,
        });

        if (nextHits >= 3) {
          setStructures((prev) => prev.filter((s) => s.id !== hoveredPole.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const pIdx = inv.findIndex((i) => i.id === 'inv_treated_planks' || i.name.toLowerCase().includes('treated plank'));
            if (pIdx !== -1) {
              inv[pIdx] = { ...inv[pIdx], count: (inv[pIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_treated_planks',
                name: 'Treated Planks',
                category: 'resource',
                description: 'Creosote-treated weather-resistant timber harvested from industrial utility poles. Used in heavy Tier 3 base structures.',
                weight: 2.0,
                count: 3,
              });
            }
            return {
              ...prev,
              inventory: inv,
              endurance: Math.max(0, prev.endurance - 6),
              fatigue: Math.min(100, prev.fatigue + 1),
            };
          });

          triggerAnimation({
            type: 'floating_text',
            x: hoveredPole.x + hoveredPole.width / 2,
            y: hoveredPole.y - 14,
            angle: 0,
            text: 'POLE FELLED! +3 TREATED PLANKS',
            color: '#a855f7',
            durationMs: 1500,
          });
          setSystemMessage(`Felled ${hoveredPole.name} with Motorized Saw! Harvested 3x Treated Planks.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredPole.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: targetWorldX,
            y: targetWorldY - 14,
            angle: 0,
            text: `SAWING POLE (${nextHits}/3)`,
            color: '#a855f7',
            durationMs: 700,
          });
          setSystemMessage(`Sawing ${hoveredPole.name} with Motorized Saw... (${nextHits}/3 clicks).`);
        }
        return;
      }

      // 14. Right Click on HOME FOUNDATION (Demolishing for Concrete Mix)
      const hoveredFoundation = structuresRef.current.find((s) => s.type === 'home_foundation' && isDirectlyOver(s, 6));
      if (hoveredFoundation) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredFoundation.x, hoveredFoundation.y, hoveredFoundation.width, hoveredFoundation.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to demolish ${hoveredFoundation.name}. Move closer.`);
          return;
        }

        const isHoldingSledgehammer = playerOwnsTool(
          (name, id) => name.includes('sledgehammer') || id.includes('sledgehammer') || name.includes('demolition') || id.includes('demolition')
        );

        if (!isHoldingSledgehammer) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Breaking home foundations requires a Sledgehammer (Tier 3)! Craft one at the Workbench.');
          return;
        }

        soundManager.playHammerSound();
        emitSound(hoveredFoundation.x, hoveredFoundation.y, 200, 60, 'Sledgehammer Strike');
        const nextHits = (hoveredFoundation.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'spark',
          x: targetWorldX,
          y: targetWorldY,
          angle: 0,
          durationMs: 250,
        });

        if (nextHits >= 4) {
          setStructures((prev) => prev.filter((s) => s.id !== hoveredFoundation.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const cIdx = inv.findIndex((i) => i.id === 'inv_concrete_mix' || i.name.toLowerCase().includes('concrete mix'));
            if (cIdx !== -1) {
              inv[cIdx] = { ...inv[cIdx], count: (inv[cIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_concrete_mix',
                name: 'Concrete Mix',
                category: 'resource',
                description: 'Crushed and pulverized industrial concrete rubble. Used for casting Poured Concrete Fortifications.',
                weight: 2.8,
                count: 3,
              });
            }
            return {
              ...prev,
              inventory: inv,
              endurance: Math.max(0, prev.endurance - 8),
              fatigue: Math.min(100, prev.fatigue + 1.2),
            };
          });

          triggerAnimation({
            type: 'floating_text',
            x: hoveredFoundation.x + hoveredFoundation.width / 2,
            y: hoveredFoundation.y - 14,
            angle: 0,
            text: 'FOUNDATION DEMOLISHED! +3 CONCRETE MIX',
            color: '#94a3b8',
            durationMs: 1500,
          });
          setSystemMessage(`Demolished ${hoveredFoundation.name} with Sledgehammer! Salvaged 3x Concrete Mix.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredFoundation.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: targetWorldX,
            y: targetWorldY - 14,
            angle: 0,
            text: `BREAKING CONCRETE (${nextHits}/4)`,
            color: '#94a3b8',
            durationMs: 700,
          });
          setSystemMessage(`Smashing ${hoveredFoundation.name} with Sledgehammer... (${nextHits}/4 clicks).`);
        }
        return;
      }

      // 15. Right Click on BANK VAULT (Breaching for Steel Plates)
      const hoveredVault = structuresRef.current.find((s) => s.type === 'bank_vault' && isDirectlyOver(s, 6));
      if (hoveredVault) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredVault.x, hoveredVault.y, hoveredVault.width, hoveredVault.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to breach ${hoveredVault.name}. Move closer.`);
          return;
        }

        const isHoldingHeavyBreaker = playerOwnsTool(
          (name, id) => name.includes('heavy breaker') || id.includes('heavy_breaker') || name.includes('breaker') || id.includes('breaker')
        );

        if (!isHoldingHeavyBreaker) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Breaching heavy bank vaults requires a Heavy Breaker (Tier 3)! Craft one at the Workbench.');
          return;
        }

        soundManager.playHammerSound();
        emitSound(hoveredVault.x, hoveredVault.y, 220, 65, 'Hydraulic Breaker Vault Strike');
        const nextHits = (hoveredVault.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'spark',
          x: targetWorldX,
          y: targetWorldY,
          angle: 0,
          durationMs: 250,
        });

        if (nextHits >= 4) {
          setStructures((prev) => prev.filter((s) => s.id !== hoveredVault.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const sIdx = inv.findIndex((i) => i.id === 'inv_steel_plates' || i.name.toLowerCase().includes('steel plate'));
            if (sIdx !== -1) {
              inv[sIdx] = { ...inv[sIdx], count: (inv[sIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_steel_plates',
                name: 'Steel Plates',
                category: 'resource',
                description: 'Hardened high-tensile structural steel plates breached from bank vaults and heavy industrial installations.',
                weight: 3.2,
                count: 3,
              });
            }
            return {
              ...prev,
              inventory: inv,
              endurance: Math.max(0, prev.endurance - 9),
              fatigue: Math.min(100, prev.fatigue + 1.4),
            };
          });

          triggerAnimation({
            type: 'floating_text',
            x: hoveredVault.x + hoveredVault.width / 2,
            y: hoveredVault.y - 14,
            angle: 0,
            text: 'VAULT BREACHED! +3 STEEL PLATES',
            color: '#38bdf8',
            durationMs: 1500,
          });
          setSystemMessage(`Breached ${hoveredVault.name} with Heavy Breaker! Salvaged 3x Steel Plates.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredVault.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: targetWorldX,
            y: targetWorldY - 14,
            angle: 0,
            text: `BREACHING VAULT (${nextHits}/4)`,
            color: '#38bdf8',
            durationMs: 700,
          });
          setSystemMessage(`Breaching ${hoveredVault.name} with Heavy Breaker... (${nextHits}/4 clicks).`);
        }
        return;
      }

      // 16. Right Click on BOULDER ROCK (Trenching for Gravel)
      const hoveredRock = structuresRef.current.find((s) => s.type === 'boulder_rock' && isDirectlyOver(s, 6));
      if (hoveredRock) {
        const dPlayer = getDistToBox(curr.x, curr.y, hoveredRock.x, hoveredRock.y, hoveredRock.width, hoveredRock.height);
        if (dPlayer > 95) {
          soundManager.playTerminalBlip();
          setSystemMessage(`Too far away to trench ${hoveredRock.name}. Move closer.`);
          return;
        }

        const isHoldingPowerTrencher = playerOwnsTool(
          (name, id) => name.includes('power trencher') || id.includes('power_trencher') || name.includes('trencher') || id.includes('trencher')
        );

        if (!isHoldingPowerTrencher) {
          soundManager.playTerminalBlip();
          setSystemMessage('⚠️ Excavating bedrock rocks requires a Power Trencher (Tier 3)! Craft one at the Workbench.');
          return;
        }

        soundManager.playVaultSound();
        emitSound(hoveredRock.x, hoveredRock.y, 210, 60, 'Power Trencher Excavation');
        const nextHits = (hoveredRock.dismantleHits || 0) + 1;

        triggerAnimation({
          type: 'spark',
          x: targetWorldX,
          y: targetWorldY,
          angle: 0,
          durationMs: 250,
        });

        if (nextHits >= 3) {
          setStructures((prev) => prev.filter((s) => s.id !== hoveredRock.id));
          setSurvivor((prev) => {
            let inv = [...prev.inventory];
            const gIdx = inv.findIndex((i) => i.id === 'inv_gravel' || i.name.toLowerCase().includes('gravel'));
            if (gIdx !== -1) {
              inv[gIdx] = { ...inv[gIdx], count: (inv[gIdx].count ?? 1) + 3 };
            } else {
              inv.push({
                id: 'inv_gravel',
                name: 'Gravel',
                category: 'resource',
                description: 'Coarse crushed stone aggregate milled from rocks with a Power Trencher. Key aggregate for Poured Concrete.',
                weight: 2.2,
                count: 3,
              });
            }
            return {
              ...prev,
              inventory: inv,
              endurance: Math.max(0, prev.endurance - 7),
              fatigue: Math.min(100, prev.fatigue + 1),
            };
          });

          triggerAnimation({
            type: 'floating_text',
            x: hoveredRock.x + hoveredRock.width / 2,
            y: hoveredRock.y - 14,
            angle: 0,
            text: 'ROCK CRUSHED! +3 GRAVEL',
            color: '#e2e8f0',
            durationMs: 1500,
          });
          setSystemMessage(`Crushed ${hoveredRock.name} with Power Trencher! Harvested 3x Gravel.`);
        } else {
          setStructures((prev) =>
            prev.map((s) => (s.id === hoveredRock.id ? { ...s, dismantleHits: nextHits } : s))
          );
          triggerAnimation({
            type: 'floating_text',
            x: targetWorldX,
            y: targetWorldY - 14,
            angle: 0,
            text: `TRENCHING ROCK (${nextHits}/3)`,
            color: '#e2e8f0',
            durationMs: 700,
          });
          setSystemMessage(`Trenching ${hoveredRock.name} with Power Trencher... (${nextHits}/3 clicks).`);
        }
        return;
      }

      // If clicked on open ground or nothing: DO NOTHING!
    },
    [cancelPlacement, emitSound, npcs, startSleeping, triggerAnimation, wakeUp]
  );

  // 2. Dedicated Structure Repairs (Default Key: [R])
  // Separated out so damaged doors or walls never block normal interaction!
  const repairNearby = useCallback(() => {
    const curr = survivorRef.current;
    if (curr.isSleeping) return;

    // Check for damaged wall, fence, door, or barricade within 75px
    const nearestDamaged = structuresRef.current.reduce<{ struct: WorldStructure | null; dist: number }>(
      (acc, s) => {
        if (s.hp >= s.maxHp) return acc;
        if (!s.type.includes('wall') && !s.type.includes('fence') && !s.type.includes('door') && s.type !== 'barricade_window') return acc;
        const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
        if (d < acc.dist) return { struct: s, dist: d };
        return acc;
      },
      { struct: null, dist: 75 }
    );

    if (!nearestDamaged.struct) {
      soundManager.playTerminalBlip();
      setSystemMessage('No damaged structures nearby to repair [R]. (Stand near damaged walls/doors with Planks & Nails)');
      return;
    }

    const target = nearestDamaged.struct;
    const damageRatio = Math.max(0, 1 - target.hp / target.maxHp);
    const planksNeeded = Math.max(1, Math.round((target.repairPlanks || 2) * damageRatio));
    const nailsNeeded = Math.max(1, Math.round((target.repairNails || 3) * damageRatio));

    const plankItem = curr.inventory.find((i) => i.id === 'inv_planks' || i.name.toLowerCase().includes('plank'));
    const nailItem = curr.inventory.find((i) => i.id === 'inv_nails' || i.name.toLowerCase().includes('nail'));
    const havePlanks = (plankItem?.count ?? 0) >= planksNeeded;
    const haveNails = (nailItem?.count ?? 0) >= nailsNeeded;

    if (havePlanks && haveNails) {
      setSurvivor((s) => {
        let inv = [...s.inventory];
        inv = inv
          .map((i) => {
            if (i.id === plankItem?.id) {
              return i.count && i.count > planksNeeded ? { ...i, count: i.count - planksNeeded } : null;
            }
            if (i.id === nailItem?.id) {
              return i.count && i.count > nailsNeeded ? { ...i, count: i.count - nailsNeeded } : null;
            }
            return i;
          })
          .filter(Boolean) as Item[];
        return { ...s, inventory: inv };
      });

      setStructures((prev) =>
        prev.map((st) => (st.id === target.id ? { ...st, hp: st.maxHp } : st))
      );

      soundManager.playHammerSound();
      emitSound(target.x, target.y, 80, 25, `Repaired ${target.name}`);
      triggerAnimation({
        type: 'tool_hammer',
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
        angle: 0,
        durationMs: 350,
      });
      triggerAnimation({
        type: 'floating_text',
        x: target.x + target.width / 2,
        y: target.y - 14,
        angle: 0,
        text: `REPAIRED (100% HP)!`,
        color: '#10b981',
        durationMs: 1200,
      });
      setSystemMessage(`Repaired ${target.name} back to 100% integrity (-${planksNeeded} Simple Wood Planks, -${nailsNeeded} Nails).`);
    } else {
      soundManager.playTerminalBlip();
      setSystemMessage(`⚠️ Cannot repair ${target.name}: Need ${planksNeeded} Simple Wood Planks and ${nailsNeeded} Nails.`);
    }
  }, [emitSound]);

  // 3. Dedicated Survivor Interaction (Default Key: [C])
  // Interacting with stranded or recruited colony survivors
  const interactSurvivor = useCallback((onOpenNpc?: (npc: NpcSurvivor) => void) => {
    const curr = survivorRef.current;
    if (curr.isSleeping) return;

    const nearestNpc = npcsRef.current.reduce<{ npc: NpcSurvivor | null; dist: number }>(
      (acc, n) => {
        const d = Math.hypot(n.x - curr.x, n.y - curr.y);
        if (d < acc.dist) return { npc: n, dist: d };
        return acc;
      },
      { npc: null, dist: 85 }
    );

    if (nearestNpc.npc) {
      soundManager.playTerminalBlip();
      if (onOpenNpc) {
        onOpenNpc(nearestNpc.npc);
      }
    } else {
      soundManager.playTerminalBlip();
      setSystemMessage('No survivor nearby to speak with [C].');
    }
  }, []);

  // Backwards compatible alias
  const interactNearby = interactWorldAction;

  // Crafting recipe execution: outputs directly to inventory!
  const craftRecipe = useCallback(
    (recipe: CraftingRecipe) => {
      const curr = survivorRef.current;
      const nearBench = isNearWorkbench;

      if (recipe.menuType === 'workbench' && !nearBench) {
        soundManager.playAlarmBeep();
        setSystemMessage(`⚠️ Workbench required! Move closer to a Carpentry Workbench to craft ${recipe.name}.`);
        return false;
      }

      const isIngredientMatch = (item: Item, ing: { itemId: string; name: string }) => {
        const itemId = item.id.toLowerCase();
        const itemName = item.name.toLowerCase();
        const ingId = ing.itemId.toLowerCase();
        const ingName = ing.name.toLowerCase();

        // Exact ID match or name match
        if (itemId === ingId || itemName === ingName) return true;

        // Treated Planks (Specific Tier 3 resource)
        const isIngTreated = ingId.includes('treated_planks') || ingName.includes('treated plank');
        const isItemTreated = itemId.includes('treated_planks') || itemName.includes('treated plank');
        if (isIngTreated || isItemTreated) {
          return isIngTreated && isItemTreated;
        }

        // Concrete Mix (Specific Tier 3 resource)
        const isIngConcrete = ingId.includes('concrete') || ingName.includes('concrete');
        const isItemConcrete = itemId.includes('concrete') || itemName.includes('concrete');
        if (isIngConcrete || isItemConcrete) {
          return isIngConcrete && isItemConcrete;
        }

        // Steel Plates (Specific Tier 3 resource - do not conflate with scrap steel)
        const isIngSteelPlates = ingId.includes('steel_plates') || ingName.includes('steel plate');
        const isItemSteelPlates = itemId.includes('steel_plates') || itemName.includes('steel plate');
        if (isIngSteelPlates || isItemSteelPlates) {
          return isIngSteelPlates && isItemSteelPlates;
        }

        // Gravel (Specific Tier 3 resource)
        const isIngGravel = ingId.includes('gravel') || ingName.includes('gravel');
        const isItemGravel = itemId.includes('gravel') || itemName.includes('gravel');
        if (isIngGravel || isItemGravel) {
          return isIngGravel && isItemGravel;
        }

        // Hardwood Logs (Specific Tier 2 resource - do not conflate with scrap wood)
        const isIngHardwood = ingId.includes('hardwood') || ingName.includes('hardwood');
        const isItemHardwood = itemId.includes('hardwood') || itemName.includes('hardwood');
        if (isIngHardwood || isItemHardwood) {
          return isIngHardwood && isItemHardwood;
        }

        // Stone Blocks
        const isIngStone = ingId.includes('stone') || ingName.includes('stone');
        const isItemStone = itemId.includes('stone') || itemName.includes('stone');
        if (isIngStone || isItemStone) {
          return isIngStone && isItemStone;
        }

        // Dense Clay
        const isIngClay = ingId.includes('clay') || ingName.includes('clay');
        const isItemClay = itemId.includes('clay') || itemName.includes('clay');
        if (isIngClay || isItemClay) {
          return isIngClay && isItemClay;
        }

        // Iron Pipes
        const isIngPipe = ingId.includes('pipe') || ingName.includes('pipe');
        const isItemPipe = itemId.includes('pipe') || itemName.includes('pipe');
        if (isIngPipe || isItemPipe) {
          return isIngPipe && isItemPipe;
        }

        // Planks (Simple Wood Planks only)
        const isIngPlank = ingId.includes('plank') || ingName.includes('plank');
        const isItemPlank = itemId.includes('plank') || itemName.includes('plank');
        if ((isIngPlank || isItemPlank) && !isIngTreated && !isItemTreated) {
          return isIngPlank && isItemPlank;
        }

        // Interchangeable scrap steel and scrap metal
        const isIngMetal = (ingId.includes('metal') || ingName.includes('metal') || ingId.includes('steel') || ingName.includes('steel')) && !isIngSteelPlates;
        const isItemMetal = (itemId.includes('metal') || itemName.includes('metal') || itemId.includes('steel') || itemName.includes('steel')) && !isItemSteelPlates;
        if (isIngMetal && isItemMetal) return true;

        // Scrap wood (twigs, scrap wood branch)
        const isIngScrapWood = ingId.includes('scrap_wood') || ingName.includes('scrap wood');
        const isItemScrapWood = itemId.includes('scrap_wood') || itemName.includes('scrap wood') || itemName.includes('branch');
        if (isIngScrapWood && isItemScrapWood) return true;

        // Nails
        const isIngNails = ingId.includes('nail') || ingName.includes('nail');
        const isItemNails = itemId.includes('nail') || itemName.includes('nail');
        if (isIngNails && isItemNails) return true;

        return false;
      };

      const hasAll = recipe.ingredients.every((ing) => {
        const matchingItems = curr.inventory.filter((i) => isIngredientMatch(i, ing));
        const totalCount = matchingItems.reduce((acc, i) => acc + (i.count ?? 1), 0);
        return totalCount >= ing.count;
      });

      if (!hasAll) {
        setSystemMessage(`Missing required materials to craft ${recipe.name}.`);
        return false;
      }

      const newInventory = [...curr.inventory];
      recipe.ingredients.forEach((ing) => {
        let needed = ing.count;
        for (let i = newInventory.length - 1; i >= 0 && needed > 0; i--) {
          const item = newInventory[i];
          if (isIngredientMatch(item, ing)) {
            const have = item.count ?? 1;
            if (have > needed) {
              item.count = have - needed;
              needed = 0;
            } else {
              needed -= have;
              newInventory.splice(i, 1);
            }
          }
        }
      });

      const newEndurance = Math.max(0, curr.endurance - recipe.enduranceCost);
      const newFatigue = Math.min(100, curr.fatigue + Math.round(recipe.enduranceCost * 0.4));

      soundManager.playHammerSound();
      emitSound(curr.x, curr.y, recipe.noiseDb * 4, recipe.noiseDb, `Crafted: ${recipe.name}`);

      setEnvironment((e) => ({
        ...e,
        timeMinutes: (e.timeMinutes + recipe.timeMinutes) % 1440,
      }));

      // Output goes directly into inventory!
      if (recipe.resultItem) {
        newInventory.push({ ...recipe.resultItem, id: Math.random().toString() });
        setSystemMessage(`Crafted: ${recipe.resultItem.name} (Added to Backpack)`);
      }

      if (recipe.id === 'bench_upgrade_max') {
        setStructures((prev) =>
          prev.map((s) =>
            s.type === 'workbench'
              ? { ...s, workbenchTier: 3, name: 'Max Industrial Machinist Workshop', maxHp: 500, hp: 500 }
              : s
          )
        );
        triggerAnimation({
          type: 'floating_text',
          x: curr.x,
          y: curr.y - 25,
          angle: 0,
          text: 'WORKBENCH UPGRADED TO MAX TIER 3!',
          color: '#38bdf8',
          durationMs: 2200,
        });
        setSystemMessage('⚙️ MAX WORKBENCH UPGRADE COMPLETE: Industrial Machinist Workshop unlocked! Tier 3 Base Structures, Traps & Weapons now craftable.');
      }

      setSurvivor((s) => ({
        ...s,
        inventory: newInventory,
        endurance: newEndurance,
        fatigue: newFatigue,
      }));

      requestOverseerNarration(`Survivor crafted ${recipe.name}.`);
      return true;
    },
    [emitSound, isNearWorkbench, requestOverseerNarration, triggerAnimation]
  );

  const useItem = useCallback((item: Item) => {
    soundManager.playTerminalBlip();
    setSurvivor((prev) => {
      let hp = prev.hp;
      let hunger = prev.hunger;
      let thirst = prev.thirst;
      let fatigue = prev.fatigue;
      let boredom = prev.boredom;
      let panic = prev.panic;
      const injuries = [...prev.injuries];

      if (item.category === 'food' && item.nutrition) {
        hunger = Math.min(100, hunger + item.nutrition);
        if (item.hydration) {
          thirst = Math.min(100, thirst + item.hydration);
        }
        setSystemMessage(`Consumed ${item.name}. (+${item.nutrition}% Satiety)`);
        triggerAnimation({
          type: 'floating_text',
          x: prev.x,
          y: prev.y - 18,
          angle: 0,
          text: `+${item.nutrition}% FOOD`,
          color: '#f59e0b',
          durationMs: 900,
        });
      }
      if (item.category === 'drink' && item.hydration) {
        if (item.isRefillable) {
          const sips = item.currentSips ?? item.maxSips ?? 10;
          if (sips <= 0) {
            soundManager.playTerminalBlip();
            setSystemMessage('⚠️ Canteen is empty (0 sips)! Refill at a Yard Rain Collector Barrel [E].');
            return prev;
          }
          soundManager.playWaterSplash();
          const nextSips = sips - 1;
          const newInv = prev.inventory.map((i) => {
            if (i.id === item.id) {
              return {
                ...i,
                currentSips: nextSips,
                name: nextSips > 0 ? `Refillable Military Canteen (${nextSips}/${i.maxSips || 10})` : 'Refillable Military Canteen (Empty)',
              };
            }
            return i;
          });
          triggerAnimation({
            type: 'floating_text',
            x: prev.x,
            y: prev.y - 18,
            angle: 0,
            text: `+${item.hydration}% WATER (${nextSips} sips left)`,
            color: '#06b6d4',
            durationMs: 1100,
          });
          setSystemMessage(`Drank from canteen. (+${item.hydration}% Hydration, ${nextSips} sips remaining).`);
          return {
            ...prev,
            thirst: Math.min(100, prev.thirst + item.hydration),
            inventory: newInv,
          };
        }

        thirst = Math.min(100, thirst + item.hydration);
        if (item.nutrition) {
          hunger = Math.min(100, hunger + item.nutrition);
        }
        setSystemMessage(`Drank ${item.name}. (+${item.hydration}% Hydration)`);
        triggerAnimation({
          type: 'floating_text',
          x: prev.x,
          y: prev.y - 18,
          angle: 0,
          text: `+${item.hydration}% WATER`,
          color: '#06b6d4',
          durationMs: 900,
        });
      }
      if (item.category === 'book' && item.boredomDelta) {
        boredom = Math.max(0, boredom + item.boredomDelta);
        panic = Math.max(0, panic - 15);
        setSystemMessage(`Read ${item.name}. Mental distress quieted.`);
      }
      if (item.category === 'medical') {
        const bleedingInj = injuries.find((i) => i.bleeding);
        if (bleedingInj) {
          bleedingInj.bleeding = false;
          bleedingInj.bandaged = true;
          bleedingInj.dirtyBandage = false;
          hp = Math.min(100, hp + (item.healValue ?? 15));
          setSystemMessage(`Applied ${item.name} to ${bleedingInj.part}. Bleeding stopped.`);
        } else {
          hp = Math.min(100, hp + (item.healValue ?? 10));
          setSystemMessage(`Applied ${item.name}.`);
        }
      }

      const newInv = prev.inventory
        .map((invItem) => {
          if (invItem.id === item.id) {
            if ((invItem.count ?? 1) > 1) {
              return { ...invItem, count: (invItem.count ?? 1) - 1 };
            }
            return null;
          }
          return invItem;
        })
        .filter(Boolean) as Item[];

      return {
        ...prev,
        hp,
        hunger,
        thirst,
        fatigue,
        boredom,
        panic,
        injuries,
        inventory: newInv,
      };
    });
  }, []);

  const executeTacticalAction = useCallback(
    (actionDirective: string, actionId?: string) => {
      soundManager.playTerminalBlip();
      setSystemMessage(`Executing: ${actionDirective}`);

      if (actionId === 'sleep_rest') {
        setSurvivor((s) => ({
          ...s,
          fatigue: Math.max(0, s.fatigue - 60),
          endurance: 100,
          hp: Math.min(100, s.hp + 15),
        }));
        setEnvironment((e) => ({ ...e, timeMinutes: (e.timeMinutes + 300) % 1440 }));
      } else if (actionId === 'chop_wood') {
        setSurvivor((s) => {
          const inv = [...s.inventory];
          const plank = inv.find((i) => i.id === 'inv_planks');
          if (plank) plank.count = (plank.count ?? 0) + 5;
          return { ...s, endurance: Math.max(0, s.endurance - 12), fatigue: Math.min(100, s.fatigue + 1.5), inventory: inv };
        });
        emitSound(survivorRef.current.x, survivorRef.current.y, 250, 65, 'Heavy Tree Chopping');
      } else if (actionId === 'scavenge_loot') {
        setSurvivor((s) => ({
          ...s,
          endurance: Math.max(0, s.endurance - 20),
          hunger: Math.min(100, s.hunger + 10),
          inventory: [
            ...s.inventory,
            { id: Math.random().toString(), name: 'Canned Luncheon Meat', category: 'food', description: 'Scavenged ration.', weight: 0.5, nutrition: 40, count: 1 },
            { id: Math.random().toString(), name: 'Box of Nails', category: 'resource', description: 'Rusted steel nails.', weight: 0.5, count: 6 },
          ],
        }));
      }

      requestOverseerNarration(actionDirective);
    },
    [emitSound, requestOverseerNarration]
  );

  // Recruited NPC management functions
  const recruitNpc = useCallback(
    (npcId: string) => {
      soundManager.playTerminalBlip();
      setNpcs((prev) =>
        prev.map((n) => {
          if (n.id === npcId) {
            triggerAnimation({
              type: 'floating_text',
              x: n.x,
              y: n.y - 20,
              angle: 0,
              text: 'RECRUITED TO COLONY!',
              color: '#10b981',
              durationMs: 1400,
            });
            return { ...n, state: 'recruited' as const, assignedTask: 'follow' as NpcTask };
          }
          return n;
        })
      );
      setSystemMessage('Survivor joined your colony! You can now assign them tasks or exchange gear.');
    },
    [triggerAnimation]
  );

  const setNpcTask = useCallback(
    (npcId: string, task: NpcTask) => {
      soundManager.playTerminalBlip();
      const base = homeBaseRef.current;
      const currStructures = structuresRef.current;
      const hasBaseBed = currStructures.some(
        (st) =>
          (st.type === 'bed' || st.type === 'sleeping_mat') &&
          Math.floor(st.x / 800) === base.sectorX &&
          Math.floor(st.y / 800) === base.sectorY
      );

      let targetNpcName = 'Survivor';

      setNpcs((prev) =>
        prev.map((n) => {
          if (n.id === npcId) {
            targetNpcName = n.name.split(' ')[0];
            triggerAnimation({
              type: 'floating_text',
              x: n.x,
              y: n.y - 18,
              angle: 0,
              text: `TASK: ${task.toUpperCase()}`,
              color: '#38bdf8',
              durationMs: 1200,
            });

            // Redirect to base sector coordinates immediately if not following player
            let targetX = n.targetX;
            let targetY = n.targetY;
            if (task !== 'follow') {
              targetX = base.x;
              targetY = base.y;
            }

            return { ...n, assignedTask: task, targetX, targetY };
          }
          return n;
        })
      );

      if (task === 'rest') {
        if (hasBaseBed) {
          setSystemMessage(`Assigned REST to ${targetNpcName}. Sleeping in Home Base bed to restore fatigue.`);
        } else {
          setSystemMessage(`Assigned REST to ${targetNpcName}. ⚠️ Note: No bed in Home Base Sector [${base.sectorX}, ${base.sectorY}]! Survivor cannot sleep until a bed is constructed.`);
        }
      } else if (task === 'patrol') {
        setSystemMessage(`Assigned PATROL to ${targetNpcName}. Patrolling and defending Home Base Sector [${base.sectorX}, ${base.sectorY}].`);
      } else if (task === 'maintain') {
        setSystemMessage(`Assigned MAINTAIN to ${targetNpcName}. Repairing structures strictly within Home Base Sector [${base.sectorX}, ${base.sectorY}].`);
      } else {
        setSystemMessage(`Assigned FOLLOW to ${targetNpcName}. Accompanying and guarding player.`);
      }
    },
    [triggerAnimation]
  );

  const transferToNpc = useCallback((npcId: string, item: Item) => {
    soundManager.playTerminalBlip();
    setSurvivor((s) => {
      const newInv = s.inventory
        .map((i) => (i.id === item.id ? (i.count && i.count > 1 ? { ...i, count: i.count - 1 } : null) : i))
        .filter(Boolean) as Item[];
      return { ...s, inventory: newInv };
    });

    setNpcs((prev) =>
      prev.map((n) => {
        if (n.id === npcId) {
          const singleItem = { ...item, count: 1 };
          return { ...n, inventory: [...n.inventory, singleItem] };
        }
        return n;
      })
    );
    setSystemMessage(`Gave ${item.name} to survivor.`);
  }, []);

  const transferToPlayer = useCallback((npcId: string, item: Item) => {
    soundManager.playTerminalBlip();
    setNpcs((prev) =>
      prev.map((n) => {
        if (n.id === npcId) {
          const newInv = n.inventory
            .map((i) => (i.id === item.id ? (i.count && i.count > 1 ? { ...i, count: i.count - 1 } : null) : i))
            .filter(Boolean) as Item[];
          return { ...n, inventory: newInv };
        }
        return n;
      })
    );

    setSurvivor((s) => ({
      ...s,
      inventory: [...s.inventory, { ...item, count: 1 }],
    }));
    setSystemMessage(`Received ${item.name} from survivor.`);
  }, []);

  const equipNpcWeapon = useCallback((npcId: string, item: Item) => {
    soundManager.playTerminalBlip();
    setNpcs((prev) =>
      prev.map((n) => {
        if (n.id === npcId) {
          const oldW = n.equippedWeapon;
          const newInv = n.inventory.filter((i) => i.id !== item.id);
          if (oldW) newInv.push(oldW);
          return { ...n, equippedWeapon: item, inventory: newInv };
        }
        return n;
      })
    );
    setSystemMessage(`Equipped ${item.name} on survivor.`);
  }, []);

  // Standalone Structure Repair (scales 0 to 100% of original wall cost)
  const repairStructure = useCallback(
    (structureId: string) => {
      const curr = survivorRef.current;
      const target = structuresRef.current.find((s) => s.id === structureId);
      if (!target || target.hp >= target.maxHp) return;

      const damageRatio = Math.max(0, 1 - target.hp / target.maxHp);
      const planksNeeded = Math.max(1, Math.round((target.repairPlanks || 2) * damageRatio));
      const nailsNeeded = Math.max(1, Math.round((target.repairNails || 3) * damageRatio));

      const plankItem = curr.inventory.find(
        (i) => i.id === 'inv_planks' || i.name.toLowerCase().includes('plank')
      );
      const nailItem = curr.inventory.find(
        (i) => i.id === 'inv_nails' || i.name.toLowerCase().includes('nail')
      );
      const havePlanks = (plankItem?.count ?? 0) >= planksNeeded;
      const haveNails = (nailItem?.count ?? 0) >= nailsNeeded;

      if (!havePlanks || !haveNails) {
        soundManager.playAlarmBeep();
        setSystemMessage(
          `⚠️ Insufficient materials: Repairing ${target.name} requires ${planksNeeded} Planks and ${nailsNeeded} Nails.`
        );
        return;
      }

      setSurvivor((s) => {
        let inv = [...s.inventory];
        inv = inv
          .map((i) => {
            if (i.id === plankItem?.id) {
              return i.count && i.count > planksNeeded ? { ...i, count: i.count - planksNeeded } : null;
            }
            if (i.id === nailItem?.id) {
              return i.count && i.count > nailsNeeded ? { ...i, count: i.count - nailsNeeded } : null;
            }
            return i;
          })
          .filter(Boolean) as Item[];
        return { ...s, inventory: inv };
      });

      setStructures((prev) =>
        prev.map((st) => (st.id === structureId ? { ...st, hp: st.maxHp } : st))
      );

      soundManager.playHammerSound();
      triggerAnimation({
        type: 'tool_hammer',
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
        angle: 0,
        durationMs: 350,
      });
      triggerAnimation({
        type: 'floating_text',
        x: target.x + target.width / 2,
        y: target.y - 14,
        angle: 0,
        text: 'REPAIRED (100% HP)!',
        color: '#10b981',
        durationMs: 1200,
      });
      setSystemMessage(
        `Repaired ${target.name} back to full structural integrity (-${planksNeeded} Planks, -${nailsNeeded} Nails).`
      );
    },
    [triggerAnimation]
  );

  const toggleFlashlight = useCallback(() => {
    soundManager.playTerminalBlip();
    setSurvivor((s) => {
      const nextVal = !s.flashlightOn;
      setSystemMessage(nextVal ? 'Tactical flashlight engaged.' : 'Flashlight extinguished for light discipline.');
      return { ...s, flashlightOn: nextVal };
    });
  }, []);

  const resetNewGame = useCallback(() => {
    soundManager.playTerminalBlip();
    const freshSurvivor: Survivor = JSON.parse(JSON.stringify(INITIAL_SURVIVOR));
    const survivorState = {
      ...freshSurvivor,
      hp: 100,
      endurance: 100,
      fatigue: 0,
      hunger: 100,
      thirst: 100,
      panic: 0,
      isBitten: false,
      virusProgress: 0,
      injuries: [],
      isSleeping: false,
      isBlocking: false,
      activeAction: undefined,
    };
    setSurvivor(survivorState);
    survivorRef.current = survivorState;

    setZombies(JSON.parse(JSON.stringify(INITIAL_ZOMBIES)));
    zombiesRef.current = JSON.parse(JSON.stringify(INITIAL_ZOMBIES));
    setStructures(JSON.parse(JSON.stringify(INITIAL_STRUCTURES)));
    structuresRef.current = JSON.parse(JSON.stringify(INITIAL_STRUCTURES));
    setBloodSplats([
      { x: 260, y: 390, radius: 14, intensity: 0.8 },
      { x: 630, y: 300, radius: 20, intensity: 0.6 },
    ]);
    setNoiseHeatmap(Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0)));
    const resetSec = 360;
    const resetInfo = getDayNightInfo(resetSec);
    const freshEnv: EnvironmentState = {
      day: 1, // Restart on Day 1!
      timeMinutes: Math.round(resetInfo.inGameMinutesOfDay),
      cycleSeconds: resetSec,
      isDay: resetInfo.isDay,
      cycleRemainingMinutes: resetInfo.remainingMinutes,
      weather: 'Clear Cold',
      temperatureC: 17,
      gridPower: true,
      waterGrid: true,
      windSpeedKmh: 9,
      fogDensity: 0.08,
    };
    setEnvironment(freshEnv);
    environmentRef.current = freshEnv;

    // Reset zombie evolution multipliers to 1.0 baseline
    zombieMultiplierRef.current = {
      speedMult: 1.0,
      healthMult: 1.0,
      damageMult: 1.0,
      spawnRateMult: 1.0,
      sightMult: 1.0,
      hearingMult: 1.0,
      smellMult: 1.0,
      populationMult: 1.0,
    };

    // Reset Home Base to starting safehouse
    const initBase: HomeBase = {
      x: 400,
      y: 400,
      sectorX: 0,
      sectorY: 0,
      name: 'Safehouse Base [Sector 0, 0]',
    };
    setHomeBase(initBase);
    homeBaseRef.current = initBase;
    try {
      localStorage.setItem(HOME_BASE_STORAGE_KEY, JSON.stringify(initBase));
    } catch {}

    setAnimationEffects([]);
    setPlacementGhost(null);
    setIsGameOver(false);
    isGameOverRef.current = false;
    setDeathCause(null);
    setActiveChest(null);
    hasTriggeredToolboxSpeechRef.current = false;
    setSpeechBubble(null);

    // Reset Chunks & NPCs
    const baseChunk: WorldChunk = {
      chunkX: 0,
      chunkY: 0,
      key: '0,0',
      type: 'safehouse_base',
      name: 'Safehouse Sector 4B',
      structures: JSON.parse(JSON.stringify(INITIAL_STRUCTURES)),
      zombies: JSON.parse(JSON.stringify(INITIAL_ZOMBIES)),
      npcs: [],
      buildings: [
        { id: 'safehouse_bldg', name: 'Safehouse Residence', x: 340, y: 220, width: 280, height: 260 },
      ],
      generatedAt: Date.now(),
    };
    setChunks({ '0,0': baseChunk });
    chunksRef.current = { '0,0': baseChunk };
    setNpcs([]);
    setBuildings([
      { id: 'safehouse_bldg', name: 'Safehouse Residence', x: 340, y: 220, width: 280, height: 260 },
    ]);
    buildingsRef.current = [
      { id: 'safehouse_bldg', name: 'Safehouse Residence', x: 340, y: 220, width: 280, height: 260 },
    ];
    updateProceduralChunks(INITIAL_SURVIVOR.x, INITIAL_SURVIVOR.y);

    setSystemMessage('Simulation deployed on Day 1. Welcome to Charval County.');
  }, [updateProceduralChunks]);

  // 3-Slot Save Game System directly in browser storage
  const SAVE_SLOT_PREFIX = 'charval_save_slot_';

  const [saveSlots, setSaveSlots] = useState<(SaveSlotData | null)[]>(() => {
    return [1, 2, 3].map((slotId) => {
      try {
        const raw = localStorage.getItem(`${SAVE_SLOT_PREFIX}${slotId}`);
        return raw ? (JSON.parse(raw) as SaveSlotData) : null;
      } catch {
        return null;
      }
    });
  });

  const refreshSaveSlots = useCallback(() => {
    setSaveSlots(
      [1, 2, 3].map((slotId) => {
        try {
          const raw = localStorage.getItem(`${SAVE_SLOT_PREFIX}${slotId}`);
          return raw ? (JSON.parse(raw) as SaveSlotData) : null;
        } catch {
          return null;
        }
      })
    );
  }, []);

  const saveGameSlot = useCallback(
    (slotId: number): boolean => {
      if (slotId < 1 || slotId > 3) return false;
      const curr = survivorRef.current;
      const env = environmentRef.current;
      const base = homeBaseRef.current;
      const hours = Math.floor(env.timeMinutes / 60);
      const minutes = env.timeMinutes % 60;
      const timeFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      const slotData: SaveSlotData = {
        slotId,
        savedAt: Date.now(),
        day: env.day,
        timeFormatted,
        timeMinutes: env.timeMinutes,
        weather: env.weather,
        survivorName: curr.name,
        survivorHp: Math.round(curr.hp),
        survivorHunger: Math.round(curr.hunger),
        survivorThirst: Math.round(curr.thirst),
        survivorFatigue: Math.round(curr.fatigue),
        homeBaseName: base.name,
        survivor: JSON.parse(JSON.stringify(curr)),
        environment: JSON.parse(JSON.stringify(env)),
        zombies: JSON.parse(JSON.stringify(zombiesRef.current)),
        structures: JSON.parse(JSON.stringify(structuresRef.current)),
        homeBase: JSON.parse(JSON.stringify(base)),
        npcs: JSON.parse(JSON.stringify(npcs)),
        buildings: JSON.parse(JSON.stringify(buildingsRef.current)),
        chunks: JSON.parse(JSON.stringify(chunksRef.current)),
        bloodSplats: JSON.parse(JSON.stringify(bloodSplats)),
        zombieMultipliers: JSON.parse(JSON.stringify(zombieMultiplierRef.current)),
        highScoreDays,
      };

      try {
        localStorage.setItem(`${SAVE_SLOT_PREFIX}${slotId}`, JSON.stringify(slotData));
        refreshSaveSlots();
        soundManager.playTerminalBlip();
        setSystemMessage(`💾 Game saved to Slot ${slotId} (Day ${env.day} · ${timeFormatted})!`);
        return true;
      } catch (err) {
        console.error('Failed to save slot:', err);
        setSystemMessage(`⚠️ Storage quota exceeded. Failed to save to Slot ${slotId}.`);
        return false;
      }
    },
    [bloodSplats, highScoreDays, npcs, refreshSaveSlots]
  );

  const loadGameSlot = useCallback(
    (slotId: number): boolean => {
      if (slotId < 1 || slotId > 3) return false;
      try {
        const raw = localStorage.getItem(`${SAVE_SLOT_PREFIX}${slotId}`);
        if (!raw) return false;
        const data = JSON.parse(raw) as SaveSlotData;

        // Restore all states
        setSurvivor(data.survivor);
        survivorRef.current = data.survivor;

        setEnvironment(data.environment);
        environmentRef.current = data.environment;

        setZombies(data.zombies);
        zombiesRef.current = data.zombies;

        setStructures(data.structures);
        structuresRef.current = data.structures;

        setHomeBase(data.homeBase);
        homeBaseRef.current = data.homeBase;

        setNpcs(data.npcs || []);

        setBuildings(data.buildings || []);
        buildingsRef.current = data.buildings || [];

        setChunks(data.chunks || {});
        chunksRef.current = data.chunks || {};

        setBloodSplats(data.bloodSplats || []);

        if (data.zombieMultipliers) {
          zombieMultiplierRef.current = data.zombieMultipliers;
        }

        setIsGameOver(false);
        isGameOverRef.current = false;
        setDeathCause(null);
        setPlacementGhost(null);
        setActiveChest(null);

        soundManager.playTerminalBlip();
        soundManager.setWeatherAmbience(data.environment.weather);
        setSystemMessage(`📁 Loaded Save Slot ${slotId}: Day ${data.day} (${data.timeFormatted}).`);
        return true;
      } catch (err) {
        console.error('Failed to load slot:', err);
        setSystemMessage(`⚠️ Corrupted or missing data in Save Slot ${slotId}.`);
        return false;
      }
    },
    []
  );

  const deleteGameSlot = useCallback(
    (slotId: number) => {
      try {
        localStorage.removeItem(`${SAVE_SLOT_PREFIX}${slotId}`);
        refreshSaveSlots();
        soundManager.playTerminalBlip();
        setSystemMessage(`🗑️ Deleted Save Slot ${slotId}.`);
      } catch (err) {
        console.error('Failed to delete save slot:', err);
      }
    },
    [refreshSaveSlots]
  );

  // Colony Storage Chest Management
  const openChest = useCallback((chest: WorldStructure) => {
    soundManager.playChestSound();
    setActiveChest(chest);
    if (chest.name.toLowerCase().includes('tool') && !hasTriggeredToolboxSpeechRef.current) {
      hasTriggeredToolboxSpeechRef.current = true;
      triggerSurvivorSpeech("That's not enough. I should find more houses like this one to get more.", 9000);
    }
    setSystemMessage(`Opened ${chest.name}. Deposit food and water for colony survivors.`);
  }, [triggerSurvivorSpeech]);

  const closeChest = useCallback(() => {
    soundManager.playChestSound();
    setActiveChest(null);
  }, []);

  const storeItemInChest = useCallback((item: Item, count: number = 1) => {
    const chest = activeChestRef.current;
    if (!chest) return;
    soundManager.playTerminalBlip();

    const transferCount = Math.min(count, item.count ?? 1);

    // Deduct from player inventory
    setSurvivor((prev) => {
      const inv = prev.inventory
        .map((i) => {
          if (i.id === item.id) {
            const rem = (i.count ?? 1) - transferCount;
            return rem > 0 ? { ...i, count: rem } : null;
          }
          return i;
        })
        .filter(Boolean) as Item[];
      return { ...prev, inventory: inv };
    });

    // Add to chest loot
    setStructures((prev) =>
      prev.map((s) => {
        if (s.id === chest.id) {
          const loot = [...(s.containedLoot || [])];
          const existingIdx = loot.findIndex((i) => i.name === item.name);
          if (existingIdx !== -1) {
            loot[existingIdx] = {
              ...loot[existingIdx],
              count: (loot[existingIdx].count ?? 1) + transferCount,
            };
          } else {
            loot.push({ ...item, count: transferCount });
          }
          const updatedChest = { ...s, containedLoot: loot };
          setActiveChest(updatedChest);
          return updatedChest;
        }
        return s;
      })
    );
    setSystemMessage(`Stored ${transferCount}x ${item.name} into ${chest.name}.`);
  }, []);

  const takeItemFromChest = useCallback((item: Item, count: number = 1) => {
    const chest = activeChestRef.current;
    if (!chest) return;
    soundManager.playTerminalBlip();

    if (chest.name.toLowerCase().includes('tool') && !hasTriggeredToolboxSpeechRef.current) {
      hasTriggeredToolboxSpeechRef.current = true;
      triggerSurvivorSpeech("That's not enough. I should find more houses like this one to get more.", 9000);
    }

    const transferCount = Math.min(count, item.count ?? 1);

    // Deduct from chest
    setStructures((prev) =>
      prev.map((s) => {
        if (s.id === chest.id) {
          const loot = (s.containedLoot || [])
            .map((i) => {
              if (i.id === item.id || i.name === item.name) {
                const rem = (i.count ?? 1) - transferCount;
                return rem > 0 ? { ...i, count: rem } : null;
              }
              return i;
            })
            .filter(Boolean) as Item[];
          const updatedChest = { ...s, containedLoot: loot };
          setActiveChest(updatedChest);
          return updatedChest;
        }
        return s;
      })
    );

    // Add to player inventory
    setSurvivor((prev) => {
      const inv = [...prev.inventory];
      const existingIdx = inv.findIndex((i) => i.name === item.name);
      if (existingIdx !== -1) {
        inv[existingIdx] = {
          ...inv[existingIdx],
          count: (inv[existingIdx].count ?? 1) + transferCount,
        };
      } else {
        inv.push({ ...item, count: transferCount });
      }
      return { ...prev, inventory: inv };
    });
    setSystemMessage(`Took ${transferCount}x ${item.name} from ${chest.name}.`);
  }, []);

  return {
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
    handleSecondaryAction,
    cycleActiveSlot,
    equipItem,
    unequipItem,
    startPlacingItem,
    cancelPlacement,
    rotatePlacement,
    interactNearby,
    interactWorldAction,
    repairNearby,
    interactSurvivor,
    craftRecipe,
    useItem,
    executeTacticalAction,
    toggleFlashlight,
    startSleeping,
    wakeUp,
    sleepBlackout,
    requestOverseerNarration,
    // Chunks & NPCs
    chunks,
    npcs,
    buildings,
    recruitNpc,
    setNpcTask,
    transferToNpc,
    transferToPlayer,
    equipNpcWeapon,
    repairStructure,
    // High Score Days & Chest Storage
    highScoreDays,
    saveSlots,
    saveGameSlot,
    loadGameSlot,
    deleteGameSlot,
    refreshSaveSlots,
    activeChest,
    openChest,
    closeChest,
    storeItemInChest,
    takeItemFromChest,
    // Home Base & Shelter
    homeBase,
    currentShelter,
    setAsHomeBase,
    // Story & In-world Speech
    speechBubble,
    triggerSurvivorSpeech,
  };
}
