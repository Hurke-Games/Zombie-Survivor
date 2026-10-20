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
} from '../types/game';
import { generateDeterministicObservationLog } from '../utils/deterministicNarrator';
import { soundManager } from '../utils/audio';
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

  // Dedicated Equipment: Weapon 1, Backup Weapon 2, Tool 1
  equippedWeapon: {
    id: 'crowbar_init',
    name: 'Heavy Steel Crowbar',
    category: 'weapon',
    weaponType: 'melee',
    description: 'Pries doors and crushes skulls with minimal maintenance.',
    weight: 2.0,
    durability: 88,
    maxDurability: 100,
    damage: 35,
    noise: 18,
    reach: 55,
  },
  equippedWeapon2: {
    id: 'pipe_shotgun_init',
    name: 'Improvised 12g Shotgun',
    category: 'weapon',
    weaponType: 'gun',
    ammoType: '12g Buckshot Shells',
    description: 'Single-barrel pipe shotgun. Thunderous 95dB blast.',
    weight: 3.2,
    durability: 75,
    maxDurability: 80,
    damage: 90,
    noise: 95,
    reach: 160,
  },
  equippedTool: {
    id: 'hammer_init',
    name: 'Claw Hammer',
    category: 'tool',
    weaponType: 'melee',
    description: 'Essential for driving nails and fortifying timber structures.',
    weight: 1.2,
    durability: 94,
    maxDurability: 100,
    damage: 20,
    noise: 15,
  },
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

  inventory: [
    {
      id: 'inv_shotgun_shells',
      name: '12g Buckshot Shells',
      category: 'resource',
      description: 'Ammunition for the 12g Pipe Shotgun.',
      weight: 0.6,
      count: 8,
    },
    {
      id: 'inv_wood_shield',
      name: 'Improvised Wood Shield',
      category: 'weapon',
      weaponType: 'shield',
      blockDefense: 0.85,
      description: 'Left-click while in hand to block 85% damage and deflect bites.',
      weight: 2.2,
      durability: 70,
      maxDurability: 70,
      damage: 12,
      noise: 8,
    },
    {
      id: 'inv_planks',
      name: 'Wood Planks',
      category: 'resource',
      description: 'Sturdy pine boards for shelter walls, doors, and barricades.',
      weight: 3.0,
      count: 9,
    },
    {
      id: 'inv_nails',
      name: 'Box of Nails',
      category: 'resource',
      description: 'Framing nails essential for carpentry and barricades.',
      weight: 0.8,
      count: 16,
    },
    {
      id: 'inv_wall_kit',
      name: 'Pine Wall Frame',
      category: 'structure_kit',
      description: 'Crafted wall kit. Select in inventory then left-click map to place.',
      weight: 3.5,
      isPlaceable: true,
      placeStructureType: 'wall_wood',
      placeWidth: 65,
      placeHeight: 16,
      count: 2,
    },
    {
      id: 'inv_canned_stew',
      name: 'Canned Beef Chili',
      category: 'food',
      description: 'Preserved hearty chili rations. Restores +35% Satiety.',
      weight: 0.5,
      nutrition: 35,
      hydration: 10,
      count: 2,
    },
    {
      id: 'inv_baked_beans',
      name: 'Canned Baked Beans',
      category: 'food',
      description: 'High-protein navy beans in tomato sauce. Restores +30% Satiety.',
      weight: 0.4,
      nutrition: 30,
      hydration: 5,
      count: 2,
    },
    {
      id: 'inv_beef_jerky',
      name: 'Dried Beef Jerky',
      category: 'food',
      description: 'Smoked preserved beef strip. Restores +25% Satiety.',
      weight: 0.2,
      nutrition: 25,
      count: 2,
    },
    {
      id: 'inv_canteen',
      name: 'Refillable Military Canteen',
      category: 'drink',
      description: 'Rugged military canteen. Holds water and can be refilled at any rain barrel [E] (50 refills per full barrel).',
      weight: 0.6,
      hydration: 35,
      isRefillable: true,
      currentSips: 10,
      maxSips: 10,
      count: 1,
    },
    {
      id: 'inv_water_bottle',
      name: 'Clean Water Bottle',
      category: 'drink',
      description: 'Potable tap water collected before the grid pressure dropped. Restores +50% Hydration.',
      weight: 1.0,
      hydration: 50,
      count: 2,
    },
    {
      id: 'inv_lemon_soda',
      name: 'Lemon Soda Can',
      category: 'drink',
      description: 'Carbonated soda. Restores +35% Hydration and +10% Satiety.',
      weight: 0.35,
      hydration: 35,
      nutrition: 10,
      count: 2,
    },
    {
      id: 'inv_sterile_gauze',
      name: 'Sterile Gauze Bandage',
      category: 'medical',
      description: 'Surgical cotton wrap to arrest arterial bleeding.',
      weight: 0.1,
      healValue: 25,
      count: 2,
      isSterile: true,
    },
    {
      id: 'inv_scrap',
      name: 'Scrap Metal',
      category: 'resource',
      description: 'Sheet iron scrap for pipes, firearms, and workbench fixtures.',
      weight: 2.0,
      count: 4,
    },
  ],
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
  // Furniture
  { id: 'furn_bed', x: 370, y: 245, width: 55, height: 75, type: 'bed', name: 'Sturdy Wooden Cot Bed', hp: 100, maxHp: 100 },
  { id: 'furn_workbench', x: 535, y: 245, width: 55, height: 45, type: 'workbench', name: 'Carpentry Workbench', hp: 180, maxHp: 180 },
  { id: 'furn_table', x: 450, y: 330, width: 50, height: 40, type: 'table_chair', name: 'Dining Table & Chair', hp: 80, maxHp: 80 },
  { id: 'furn_stove', x: 370, y: 400, width: 45, height: 45, type: 'kitchen_stove', name: 'Field Kitchen Firebox', hp: 120, maxHp: 120, isLit: false },
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
      day: 5,
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
  // Not revealed in any tutorial or interface per specifications
  const zombieMultiplierRef = useRef<{ speedMult: number; healthMult: number }>({ speedMult: 1.0, healthMult: 1.0 });

  // High score tracking: Longest Survived Days (the primary goal & score!)
  const HIGH_SCORE_STORAGE_KEY = 'knox_longest_survived_days';
  const [highScoreDays, setHighScoreDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      return saved ? parseFloat(saved) : 5;
    } catch {
      return 5;
    }
  });

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

  const triggerAnimation = useCallback((effect: Omit<VisualAnimationEffect, 'id' | 'createdAt'>) => {
    const newEff: VisualAnimationEffect = {
      ...effect,
      id: Math.random().toString(),
      createdAt: Date.now(),
    };
    setAnimationEffects((prev) => [...prev.slice(-35), newEff]);
  }, []);

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
        actionLabel: 'Wake Up [F]',
        x: survivor.x,
        y: survivor.y,
        type: 'bed',
      };
    }

    // 1. Check for DOORS with top priority (within 80px) -> Open/Close with [F]!
    const nearestDoor = structures.reduce<{ struct: WorldStructure | null; dist: number }>(
      (acc, s) => {
        if (s.type !== 'door_wood') return acc;
        const nearestX = Math.max(s.x, Math.min(survivor.x, s.x + s.width));
        const nearestY = Math.max(s.y, Math.min(survivor.y, s.y + s.height));
        const d = Math.hypot(survivor.x - nearestX, survivor.y - nearestY);
        if (d < acc.dist) return { struct: s, dist: d };
        return acc;
      },
      { struct: null, dist: 80 }
    );

    if (nearestDoor.struct) {
      const s = nearestDoor.struct;
      const isDamaged = s.hp < s.maxHp;
      return {
        structureId: s.id,
        name: s.name,
        actionLabel: s.isOpen
          ? `Close Door [F]${isDamaged ? ' · [R] Repair' : ''}`
          : `Open Door [F]${isDamaged ? ' · [R] Repair' : ''}`,
        x: s.x + s.width / 2,
        y: s.y + s.height / 2,
        type: s.type,
      };
    }

    // 2. Check for nearby FENCES to vault / jump with [F] (within 48px)
    const nearestFence = structures.reduce<{ struct: WorldStructure | null; dist: number }>(
      (acc, s) => {
        if (s.type !== 'fence_wood' && s.type !== 'fence_wire') return acc;
        const nearestX = Math.max(s.x, Math.min(survivor.x, s.x + s.width));
        const nearestY = Math.max(s.y, Math.min(survivor.y, s.y + s.height));
        const d = Math.hypot(survivor.x - nearestX, survivor.y - nearestY);
        if (d < acc.dist) return { struct: s, dist: d };
        return acc;
      },
      { struct: null, dist: 48 }
    );

    if (nearestFence.struct) {
      const s = nearestFence.struct;
      return {
        structureId: s.id,
        name: s.name,
        actionLabel: `Jump / Vault Fence [F]`,
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

    let actionLabel = 'Interact [F]';
    if (s.type === 'door_wood') {
      actionLabel = s.isOpen ? 'Close Door [F]' : 'Open Door [F]';
    } else if (s.type === 'workbench') {
      actionLabel = 'Craft at Workbench [F]';
    } else if (s.type === 'bed') {
      actionLabel = 'Sleep on Cot Bed [F]';
    } else if (s.type === 'sleeping_mat') {
      actionLabel = 'Sleep on Mat [F]';
    } else if (s.type === 'kitchen_stove') {
      actionLabel = 'Kitchen Stove [F]';
    } else if (s.type === 'table_chair') {
      actionLabel = 'Sit at Table & Read [F]';
    } else if (s.type === 'tree') {
      actionLabel = `Chop Tree (${s.hp}/${s.maxHp} HP) [F]`;
    } else if (s.type === 'loot_container') {
      const isChest = s.name.toLowerCase().includes('chest');
      actionLabel = isChest ? `Open ${s.name} [F]` : (s.containedLoot && s.containedLoot.length > 0 ? `Search ${s.name} [F]` : `Store in ${s.name} [F]`);
    } else if (s.type === 'rain_collector') {
      actionLabel = `Rain Barrel (${s.waterStored || 0}/50 Refills) [F]`;
    } else if (s.type === 'campfire') {
      actionLabel = 'Warm Hands at Campfire [F]';
    }

    return {
      structureId: s.id,
      name: s.name,
      actionLabel,
      x: s.x + s.width / 2,
      y: s.y + s.height / 2,
      type: s.type,
    };
  }, [structures, survivor.x, survivor.y, survivor.isSleeping, survivor.sleepingStructureId, npcs]);

  // Cycle Active Slot with mouse scroll wheel: Weapon 1 <-> Backup Weapon 2 <-> Tool 1
  const cycleActiveSlot = useCallback((delta: number) => {
    soundManager.playTerminalBlip();
    setSurvivor((prev) => {
      const slots: ActiveHandSlot[] = ['weapon1', 'weapon2', 'tool'];
      const currentIndex = slots.indexOf(prev.activeSlot);
      let nextIndex = (currentIndex + (delta > 0 ? 1 : -1)) % slots.length;
      if (nextIndex < 0) nextIndex = slots.length - 1;
      const nextSlot = slots[nextIndex];

      const itemInHand =
        nextSlot === 'weapon1'
          ? prev.equippedWeapon
          : nextSlot === 'weapon2'
          ? prev.equippedWeapon2
          : prev.equippedTool;

      setSystemMessage(`Equipped Hand: ${nextSlot.toUpperCase()} (${itemInHand?.name || 'Empty'})`);

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
  const startPlacingItem = useCallback((item: Item) => {
    if (!item.isPlaceable || !item.placeStructureType) {
      setSystemMessage('This item cannot be placed on the ground.');
      return;
    }
    soundManager.playTerminalBlip();
    setPlacementGhost({
      item,
      structureType: item.placeStructureType,
      width: item.placeWidth || 50,
      height: item.placeHeight || 20,
    });
    setSystemMessage(`Placement Mode: Left-click map to place ${item.name}. (Right-click or ESC to cancel)`);
  }, []);

  // Cancel Placement Mode
  const cancelPlacement = useCallback(() => {
    setPlacementGhost(null);
    setSystemMessage('Placement cancelled.');
  }, []);

  // Confirm placing structure at mouse position
  const confirmPlacement = useCallback(
    (worldX: number, worldY: number) => {
      const ghost = placementGhostRef.current;
      if (!ghost) return;

      const px = Math.round(worldX - ghost.width / 2);
      const py = Math.round(worldY - ghost.height / 2);

      const isRainCollector = ghost.structureType === 'rain_collector';
      const isLootContainer = ghost.structureType === 'loot_container';

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
        text: 'BUILT!',
        color: '#10b981',
        durationMs: 900,
      });

      // Deduct from inventory
      setSurvivor((prev) => {
        const newInv = prev.inventory
          .map((i) => (i.id === ghost.item.id ? (i.count && i.count > 1 ? { ...i, count: i.count - 1 } : null) : i))
          .filter(Boolean) as Item[];
        return {
          ...prev,
          activeAction: {
            type: 'tool_hammer',
            timestamp: Date.now(),
            durationMs: 250,
            angle: Math.atan2(py - prev.y, px - prev.x),
          },
          inventory: newInv,
        };
      });

      setPlacementGhost(null);
      setSystemMessage(`Placed ${newStruct.name} down on the map!`);
    },
    [emitSound]
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
      setEnvironment((prev) => ({
        ...prev,
        day: prev.day + 1,
        cycleSeconds: morningCycleSec,
        timeMinutes: Math.round(info.inGameMinutesOfDay),
        isDay: true,
        cycleRemainingMinutes: info.remainingMinutes,
      }));

      // Compounding 2% zombie speed & 2% health
      zombieMultiplierRef.current.speedMult *= 1.02;
      zombieMultiplierRef.current.healthMult *= 1.02;
      setZombies((prevZombies) =>
        prevZombies.map((z) => ({
          ...z,
          speed: z.speed * 1.02,
          maxHp: Math.round(z.maxHp * 1.02),
          hp: Math.round(z.hp * 1.02),
        }))
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
  }, [triggerEvolutionChatter]);

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

    // 30% chance of waking up infected if NOT inside!
    const rolledInfection = !isInside && Math.random() < 0.30;

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
      setEnvironment((prev) => ({
        ...prev,
        day: prev.day + 1,
        cycleSeconds: morningCycleSec,
        timeMinutes: Math.round(info.inGameMinutesOfDay),
        isDay: true,
        cycleRemainingMinutes: info.remainingMinutes,
      }));

      // Compounding 10% on passing out!
      zombieMultiplierRef.current.speedMult *= 1.10;
      zombieMultiplierRef.current.healthMult *= 1.10;
      setZombies((prevZombies) =>
        prevZombies.map((z) => ({
          ...z,
          speed: z.speed * 1.10,
          maxHp: Math.round(z.maxHp * 1.10),
          hp: Math.round(z.hp * 1.10),
        }))
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

      if (rolledInfection) {
        soundManager.playZombieGrowl();
        soundManager.playAlarmBeep();
        setSystemMessage('☠️ CRITICAL: You collapsed outside unprotected! You awake with a gruesome bite mark. The Knox infection is coursing through your veins!');
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
  }, [triggerEvolutionChatter]);

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
        if (newDay > highScoreDaysRef.current) {
          setHighScoreDays(newDay);
          try {
            localStorage.setItem(HIGH_SCORE_STORAGE_KEY, newDay.toString());
          } catch {
            // ignore
          }
        }

        const info = getDayNightInfo(newCycleSec);

        let weather = prev.weather;
        // Weather shift roll: 1 in 7 (1d7) chance of rain!
        // Rolling 1 on a 7-sided die triggers downpour rain or thunderstorm
        if (Math.random() < 0.018) {
          const d7 = Math.floor(Math.random() * 7) + 1; // 1 to 7
          if (d7 === 1) {
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
          setDeathCause('KNOX VIRUS: 100% infection reached. Brain stem destroyed.');
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

            const sightRadius = s.flashlightOn ? 280 : isDaytime ? 140 : 200;
            const detectsBySight = distToSurvivor < sightRadius && !s.isSleeping;
            const detectsByBlood = s.injuries.some((i) => i.bleeding) && distToSurvivor < 240;

            if (detectsBySight || detectsByBlood) {
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
              // NIGHTTIME BEHAVIOR: Roam freely, pursue acoustic sound heatmap
              const zCol = Math.floor(z.x / 20);
              const zRow = Math.floor(z.y / 20);
              let peakHeat = 0.2;
              let bestCol = -1;
              let bestRow = -1;

              for (let dr = -6; dr <= 6; dr++) {
                const r = zRow + dr;
                if (r < 0 || r >= GRID_ROWS) continue;
                for (let dc = -6; dc <= 6; dc++) {
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

      // 5. Periodic Zombie Spawning strictly outside buildings and fenced safe zones
      if (Math.random() < 0.12 && zombiesRef.current.length < 28) {
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
                name: newHp >= struct.maxHp ? 'Knox Red Oak' : 'Young Pine Sapling',
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

        return prevNpcs.map((npc) => {
          if (npc.hp <= 0 || npc.state !== 'recruited') return npc;

          let targetX = npc.targetX ?? npc.x;
          let targetY = npc.targetY ?? npc.y;
          let newHp = npc.hp;
          let npcInv = [...npc.inventory];

          // Autonomous Needs Decay: Hunger (-0.05/s), Thirst (-0.12/s), Fatigue (+0.05/s)
          let newHunger = Math.max(0, (npc.hunger ?? 100) - 0.05);
          let newThirst = Math.max(0, (npc.thirst ?? 100) - 0.12);
          let newFatigue = Math.min(100, (npc.fatigue ?? 0) + 0.05);

          // NEED 1: THIRST (Autonomous drink from canteen or nearby rain barrel / chest at base)
          if (newThirst < 50) {
            // First check personal inventory for refillable canteen or drink
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
              // Look for nearby Rain Collector Barrel with water near base
              const rainBarrel = currStructures.find(
                (st) => st.type === 'rain_collector' && (st.waterStored || 0) > 0
              );
              if (rainBarrel) {
                targetX = rainBarrel.x + rainBarrel.width / 2;
                targetY = rainBarrel.y + rainBarrel.height / 2;
                const bDist = Math.hypot(targetX - npc.x, targetY - npc.y);
                if (bDist <= 65) {
                  // Drink and refill canteen to full!
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
                    text: `${npc.name.split(' ')[0]}: Refilled & Drank at Rain Barrel`,
                    color: '#38bdf8',
                    durationMs: 1400,
                  });
                }
              }
            }
          }

          // NEED 2: HUNGER (Autonomous eating from inventory or base food chest)
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
              // Look for base storage chest with food
              const chestWithFood = currStructures.find(
                (st) =>
                  st.type === 'loot_container' &&
                  st.containedLoot?.some((i) => i.category === 'food')
              );
              if (chestWithFood) {
                targetX = chestWithFood.x + chestWithFood.width / 2;
                targetY = chestWithFood.y + chestWithFood.height / 2;
                const cDist = Math.hypot(targetX - npc.x, targetY - npc.y);
                if (cDist <= 65) {
                  // Take 1 food ration from chest and eat
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
                    text: `${npc.name.split(' ')[0]}: Ate Rations from Chest`,
                    color: '#f59e0b',
                    durationMs: 1400,
                  });
                }
              }
            }
          }

          // NEED 3: REST & EXHAUSTION (Go to bed/mat to recover)
          if (newFatigue > 80 && npc.assignedTask !== 'follow') {
            const bed = currStructures.find(
              (st) => st.type === 'bed' || st.type === 'sleeping_mat'
            );
            if (bed) {
              targetX = bed.x + bed.width / 2;
              targetY = bed.y + bed.height / 2;
              const bDist = Math.hypot(targetX - npc.x, targetY - npc.y);
              if (bDist <= 65) {
                newFatigue = Math.max(0, newFatigue - 3.5);
                newHp = Math.min(npc.maxHp, newHp + 1.2);
              }
            }
          }

          if (npc.assignedTask === 'rest') {
            targetX = 420;
            targetY = 280;
            if (newHp < npc.maxHp) newHp = Math.min(npc.maxHp, newHp + 1.5);
            newFatigue = Math.max(0, newFatigue - 3.0);
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
            const baseZombie = currZombies.find(
              (z) => z.hp > 0 && Math.hypot(z.x - 480, z.y - 360) < 320
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
              const waypoints = [
                { x: 300, y: 220 },
                { x: 640, y: 220 },
                { x: 640, y: 480 },
                { x: 300, y: 480 },
              ];
              const wpIndex = Math.floor(Date.now() / 5000) % waypoints.length;
              targetX = waypoints[wpIndex].x;
              targetY = waypoints[wpIndex].y;
            }
          } else if (npc.assignedTask === 'maintain') {
            const damaged = currStructures.find(
              (st) =>
                st.hp < st.maxHp &&
                (st.type.includes('wall') || st.type.includes('fence') || st.type === 'door_wood' || st.type === 'barricade_window')
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
              targetX = 420;
              targetY = 270;
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
              const moveDist = baseDist * (z.speed ? z.speed / 0.42 : 1) * zombieMultiplierRef.current.speedMult;
              const testX = z.x + Math.cos(angle) * moveDist;
              const testY = z.y + Math.sin(angle) * moveDist;

              const collides = currStructures.some((st) => {
                if (st.type === 'tree' || st.type === 'table_chair' || st.type === 'bed' || st.type === 'sleeping_mat') return false;
                if (st.type === 'door_wood' && st.isOpen) return false;
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
                          const newHp = st.hp - 2;
                          triggerAnimation({
                            type: 'spark',
                            x: testX,
                            y: testY,
                            angle: angle,
                            durationMs: 250,
                          });
                          if (newHp <= 0 && st.type === 'door_wood') {
                            soundManager.playHammerSound();
                            setSystemMessage(`⚠️ ${st.name} was broken down by shamblers!`);
                            return { ...st, hp: 0, isOpen: true };
                          }
                          return { ...st, hp: Math.max(0, newHp) };
                        }
                        return st;
                      })
                      .filter((st) => st.type === 'door_wood' || st.hp > 0)
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

              // Base damage reduced by armor
              const baseDmg = 12;
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
                    const finalHp = Math.max(0, prev.hp - 16);
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

          return { ...z, x: nextX, y: nextY, angle, state: newState };
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
            // If following player and far behind, sprint to catch up!
            const effectiveSpeed = (n.assignedTask === 'follow' && dist > 110)
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
  }, [triggerAnimation]);

  // Movement
  const moveSurvivor = useCallback(
    (dx: number, dy: number, running: boolean, sneaking: boolean) => {
      setSurvivor((prev) => {
        if (prev.isSleeping || isGameOverRef.current) return prev; // Cannot move while asleep in bed or dead

        let speed = 2.2;
        if (running && prev.endurance > 10) speed = 4.2;
        if (sneaking) speed = 1.2;
        if (prev.fatigue > 70) speed *= 0.6;
        if (prev.injuries.some((i) => i.part.includes('Leg'))) speed *= 0.7;

        // Rain slows players and survivors to 75% speed! (2.2 * 0.75 = 1.65 px/tick)
        const currWeather = environmentRef.current.weather;
        const isRaining = currWeather === 'Heavy Rain' || currWeather === 'Thunderstorm' || currWeather === 'Freezing Rain';
        if (isRaining) {
          speed *= 0.75;
        }

        const nextX = prev.x + dx * speed;
        const nextY = prev.y + dy * speed;
        const angle = Math.atan2(dy, dx);

        const currStructures = structuresRef.current;
        const collides = currStructures.some((s) => {
          if (s.type === 'tree' || s.type === 'table_chair' || s.type === 'bed' || s.type === 'sleeping_mat') return false;
          if (s.type === 'door_wood' && s.isOpen) return false;
          // Thin collision margin for walls so player smoothly glides through open doorways without sticking
          const margin = s.type.includes('wall') ? 5 : 8;
          return (
            nextX >= s.x - margin &&
            nextX <= s.x + s.width + margin &&
            nextY >= s.y - margin &&
            nextY <= s.y + s.height + margin
          );
        });

        if (collides) return prev;

        // Check procedural chunks around next player location
        updateProceduralChunks(nextX, nextY);

        const noise = running ? 45 : sneaking ? 8 : 20;
        if (Math.random() < (running ? 0.2 : 0.05)) {
          emitSound(nextX, nextY, noise * 4, noise, running ? 'Footsteps (Running)' : 'Footsteps');
        }

        return {
          ...prev,
          x: nextX,
          y: nextY,
          angle: dx !== 0 || dy !== 0 ? angle : prev.angle,
          isRunning: running,
          isSneaking: sneaking,
          isBlocking: false,
        };
      });
    },
    [emitSound]
  );

  // Left Click Action: Handles Placement / Shoot / Block / Attack depending on active slot!
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

      // 4. Default: Melee Attack with equipped weapon/tool or fists!
      const rawAimAngle = Math.atan2(targetWorldY - curr.y, targetWorldX - curr.x);
      const panicRatio = curr.panic / 100;
      const aimJitter = (Math.random() - 0.5) * panicRatio * 0.5;
      const aimAngle = rawAimAngle + aimJitter;
      const reach = activeItem?.reach ?? 48;
      const damage = activeItem?.damage ?? 18;
      const noise = activeItem?.noise ?? 15;

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
        emitSound(curr.x, curr.y, noise * 2, noise, `Missed Strike (${activeItem?.name || 'Fists'})`);
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

      emitSound(curr.x, curr.y, noise * 4, noise, `Strike (${activeItem?.name || 'Fists'})`);
      if (!hitAny) soundManager.playMeleeHit(false);
    },
    [confirmPlacement, emitSound, wakeUp]
  );

  // Distance from point to axis-aligned bounding box
  const getDistToBox = (px: number, py: number, bx: number, by: number, bw: number, bh: number) => {
    const nearestX = Math.max(bx, Math.min(px, bx + bw));
    const nearestY = Math.max(by, Math.min(py, by + bh));
    return Math.hypot(px - nearestX, py - nearestY);
  };

  // 1. World Action & Interact (Default Key: [F])
  // Handles: Open/Close Doors, Jump Fences, Looting Chests, Cutting Trees, Collecting Items, Going to Bed
  const interactWorldAction = useCallback(
    (onOpenWorkbench?: () => void, onOpenChest?: (chest: WorldStructure) => void) => {
      const curr = survivorRef.current;
      if (curr.isSleeping) {
        wakeUp();
        return;
      }

      const currStructures = structuresRef.current;

      // A. Check for DOORS to open/close (within 85px of door boundary) - HIGHEST PRIORITY & 100% RELIABLE
      const nearestDoor = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'door_wood') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 85 }
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
        return;
      }

      // B. Check for nearby Fence to VAULT / JUMP OVER [F] (within 48px of fence boundary)
      const nearestFence = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'fence_wood' && s.type !== 'fence_wire') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 48 }
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
        return;
      }

      // C. Check for BED / SLEEPING MAT to go to bed [F]
      const nearestBed = currStructures.reduce<{ struct: WorldStructure | null; dist: number }>(
        (acc, s) => {
          if (s.type !== 'bed' && s.type !== 'sleeping_mat') return acc;
          const d = getDistToBox(curr.x, curr.y, s.x, s.y, s.width, s.height);
          if (d < acc.dist) return { struct: s, dist: d };
          return acc;
        },
        { struct: null, dist: 70 }
      );

      if (nearestBed.struct) {
        startSleeping(nearestBed.struct);
        return;
      }

      // D. Check for LOOT CONTAINER & STORAGE CHEST [F]
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
        if (onOpenChest) {
          onOpenChest(target);
        } else {
          setActiveChest(target);
        }
        setSystemMessage(`Opened ${target.name}. Store food, drink, and supplies for the colony.`);
        return;
      }

      // E. Check for RAIN COLLECTOR BARREL [F] (Holds up to 50 bottle refills!)
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
          return;
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
          return;
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
          return;
        }

        setSystemMessage(`Rain Collector Barrel has ${water}/50 bottle refills. Canteen & hydration already full.`);
        return;
      }

      // F. Check for FRUIT BUSH HARVEST [F]
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
        return;
      }

      // G. Check for TREE to chop [F]
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
        const treeAngle = Math.atan2(target.y + target.height / 2 - curr.y, target.x + target.width / 2 - curr.x);
        soundManager.playHammerSound();
        emitSound(target.x, target.y, 240, 65, 'Wood Chopping Impact');

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
          fatigue: Math.min(100, s.fatigue + 0.8), // 1/10th fatigue from chopping trees
          activeAction: {
            type: 'tool_chop',
            timestamp: Date.now(),
            durationMs: 260,
            angle: treeAngle,
          },
        }));

        const newHp = target.hp - 20;
        if (newHp <= 0) {
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: 'TIMBER! +4 PLANKS',
            color: '#10b981',
            durationMs: 1200,
          });
          setStructures((prev) => prev.filter((s) => s.id !== target.id));
          setSurvivor((s) => {
            const inv = [...s.inventory];
            const plankItem = inv.find((i) => i.id === 'inv_planks');
            if (plankItem) {
              plankItem.count = (plankItem.count ?? 0) + 4;
            } else {
              inv.push({
                id: 'inv_planks',
                name: 'Wood Planks',
                category: 'resource',
                description: 'Fresh pine timber planks.',
                weight: 3.0,
                count: 4,
              });
            }
            return { ...s, inventory: inv };
          });
          setSystemMessage('Pine tree felled! Harvested 4 Wood Planks.');
        } else {
          triggerAnimation({
            type: 'floating_text',
            x: target.x + target.width / 2,
            y: target.y - 12,
            angle: 0,
            text: `CHOP! (${newHp}/${target.maxHp})`,
            color: '#f59e0b',
            durationMs: 800,
          });
          setStructures((prev) =>
            prev.map((s) => (s.id === target.id ? { ...s, hp: newHp } : s))
          );
          setSystemMessage(`Chopping timber... (${newHp}/${target.maxHp} HP)`);
        }
        return;
      }

      // H. Check for WORKBENCH [F]
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
        return;
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
          return;
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
          return;
        }
      }

      setSystemMessage('No interactable door, fence, or object within reach [F].');
    },
    [emitSound, startSleeping, wakeUp]
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
        if (!s.type.includes('wall') && !s.type.includes('fence') && s.type !== 'door_wood' && s.type !== 'barricade_window') return acc;
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
      setSystemMessage(`Repaired ${target.name} back to 100% integrity (-${planksNeeded} Planks, -${nailsNeeded} Nails).`);
    } else {
      soundManager.playTerminalBlip();
      setSystemMessage(`⚠️ Cannot repair ${target.name}: Need ${planksNeeded} Wood Planks and ${nailsNeeded} Nails.`);
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

      const hasAll = recipe.ingredients.every((ing) => {
        const item = curr.inventory.find(
          (i) => i.id === ing.itemId || i.name.toLowerCase().includes(ing.name.toLowerCase())
        );
        return item && (item.count ?? 1) >= ing.count;
      });

      if (!hasAll) {
        setSystemMessage(`Missing required materials to craft ${recipe.name}.`);
        return false;
      }

      const newInventory = [...curr.inventory];
      recipe.ingredients.forEach((ing) => {
        const idx = newInventory.findIndex(
          (i) => i.id === ing.itemId || i.name.toLowerCase().includes(ing.name.toLowerCase())
        );
        if (idx !== -1) {
          const item = newInventory[idx];
          if ((item.count ?? 1) > ing.count) {
            item.count = (item.count ?? 1) - ing.count;
          } else {
            newInventory.splice(idx, 1);
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

      setSurvivor((s) => ({
        ...s,
        inventory: newInventory,
        endurance: newEndurance,
        fatigue: newFatigue,
      }));

      requestOverseerNarration(`Survivor crafted ${recipe.name}.`);
      return true;
    },
    [emitSound, isNearWorkbench, requestOverseerNarration]
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
      setNpcs((prev) =>
        prev.map((n) => {
          if (n.id === npcId) {
            triggerAnimation({
              type: 'floating_text',
              x: n.x,
              y: n.y - 18,
              angle: 0,
              text: `TASK: ${task.toUpperCase()}`,
              color: '#38bdf8',
              durationMs: 1200,
            });
            return { ...n, assignedTask: task };
          }
          return n;
        })
      );
      setSystemMessage(`Assigned ${task.toUpperCase()} directive to survivor.`);
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
    setSurvivor({
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
    });
    setZombies(JSON.parse(JSON.stringify(INITIAL_ZOMBIES)));
    setStructures(JSON.parse(JSON.stringify(INITIAL_STRUCTURES)));
    setBloodSplats([
      { x: 260, y: 390, radius: 14, intensity: 0.8 },
      { x: 630, y: 300, radius: 20, intensity: 0.6 },
    ]);
    setNoiseHeatmap(Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0)));
    const resetSec = 360;
    const resetInfo = getDayNightInfo(resetSec);
    setEnvironment({
      day: 5,
      timeMinutes: Math.round(resetInfo.inGameMinutesOfDay),
      cycleSeconds: resetSec,
      isDay: resetInfo.isDay,
      cycleRemainingMinutes: resetInfo.remainingMinutes,
      weather: 'Fog',
      temperatureC: 13,
      gridPower: true,
      waterGrid: true,
      windSpeedKmh: 14,
      fogDensity: 0.65,
    });
    setAnimationEffects([]);
    setPlacementGhost(null);
    setIsGameOver(false);
    setDeathCause(null);

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
    updateProceduralChunks(INITIAL_SURVIVOR.x, INITIAL_SURVIVOR.y);

    setSystemMessage('Simulation deployed. Survive in Knox County.');
  }, [updateProceduralChunks]);

  // Colony Storage Chest Management
  const openChest = useCallback((chest: WorldStructure) => {
    soundManager.playChestSound();
    setActiveChest(chest);
    setSystemMessage(`Opened ${chest.name}. Deposit food and water for colony survivors.`);
  }, []);

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
    cycleActiveSlot,
    equipItem,
    unequipItem,
    startPlacingItem,
    cancelPlacement,
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
    activeChest,
    openChest,
    closeChest,
    storeItemInChest,
    takeItemFromChest,
  };
}
