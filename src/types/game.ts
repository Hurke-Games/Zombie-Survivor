/**
 * Core types for the Overseer AI Knox County survival simulation.
 */

export type BodyPart = 'Head' | 'Torso' | 'Left Arm' | 'Right Arm' | 'Left Leg' | 'Right Leg';

export type InjuryType = 'Scratch' | 'Laceration' | 'Deep Wound' | 'Bite';

export interface Injury {
  id: string;
  part: BodyPart;
  type: InjuryType;
  severity: number; // 1-10
  bleeding: boolean;
  bandaged: boolean;
  dirtyBandage: boolean;
  infected: boolean; // Bacterial infection (treatable with disinfectant/antibiotics)
}

export type ItemCategory =
  | 'weapon'
  | 'tool'
  | 'medical'
  | 'food'
  | 'drink'
  | 'resource'
  | 'book'
  | 'armor'
  | 'structure_kit';

export type ArmorSlot = 'head' | 'chest' | 'legs' | 'gloves' | 'footwear';

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  weight: number; // kg
  durability?: number; // 0 - 100
  maxDurability?: number;
  count?: number;
  damage?: number;
  noise?: number; // dB generated when used
  reach?: number; // pixels
  nutrition?: number; // hunger restore
  hydration?: number; // thirst restore
  fatigueDelta?: number; // e.g. coffee -15
  boredomDelta?: number;
  painDelta?: number;
  healValue?: number;
  isCooked?: boolean;
  isSterile?: boolean;

  // Combat weapon & tool properties
  weaponType?: 'melee' | 'gun' | 'shield';
  ammoType?: string;
  ammoCount?: number;
  blockDefense?: number; // 0 to 1.0 (e.g. 0.85 = 85% damage mitigation)

  // Armor properties
  armorSlot?: ArmorSlot;
  armorDefense?: number; // damage percentage mitigated
  biteResistance?: number; // chance to prevent bite transmission

  // Placement for structures (crafted walls, workbench, beds, etc.)
  isPlaceable?: boolean;
  placeStructureType?: StructureType;
  placeWidth?: number;
  placeHeight?: number;

  // Refillable container properties
  isRefillable?: boolean;
  currentSips?: number;
  maxSips?: number;
}

export interface SurvivorArmor {
  head: Item | null;
  chest: Item | null;
  legs: Item | null;
  gloves: Item | null;
  footwear: Item | null;
}

export type ActiveHandSlot = 'weapon1' | 'weapon2' | 'tool';

export interface Survivor {
  name: string;
  x: number;
  y: number;
  angle: number; // radians
  hp: number; // 0 - 100
  endurance: number; // 0 - 100 (stamina)
  fatigue: number; // 0 - 100 (100 = collapsed)
  hunger: number; // 0 - 100 (100 = starving)
  thirst: number; // 0 - 100 (100 = dehydrated)
  panic: number; // 0 - 100 (reduces accuracy)
  illness: number; // 0 - 100 (fever / food sickness)
  boredom: number; // 0 - 100
  pain: number; // 0 - 100
  isBitten: boolean; // 100% fatal virus
  virusProgress: number; // 0 - 100 (turns to zombie at 100)
  injuries: Injury[];

  // Dedicated Equipment & Weapons
  equippedWeapon: Item | null; // Weapon 1
  equippedWeapon2: Item | null; // Backup Weapon 2
  equippedTool: Item | null; // Selected Tool 1
  activeSlot: ActiveHandSlot; // Currently in hand
  equippedArmor: SurvivorArmor; // Head, Chest, Legs, Gloves, Footwear

  // States
  isSleeping: boolean;
  sleepingStructureId?: string;
  isBlocking: boolean;
  isConsciousnessSlipping?: boolean;
  consciousnessSlippingTimer?: number | null; // Seconds countdown until collapse (e.g. 300s = 5m)
  activeAction?: {
    type: 'shoot' | 'swing' | 'tool_chop' | 'tool_hammer' | 'block';
    timestamp: number;
    durationMs: number;
    angle: number;
  };

  inventory: Item[];
  maxCarryWeight: number;
  flashlightOn: boolean;
  isSneaking: boolean;
  isRunning: boolean;
}

export interface SleepBlackoutState {
  active: boolean;
  phase: 'fading_out' | 'blackout' | 'fading_in';
  message: string;
  subMessage?: string;
  isPassedOut: boolean;
  targetDay: number;
}

export interface PlacementGhost {
  item: Item;
  structureType: StructureType;
  width: number;
  height: number;
}

export type ZombieState = 'idle' | 'wandering' | 'tracking' | 'attacking' | 'feeding';

export interface Zombie {
  id: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  speed: number;
  state: ZombieState;
  targetX?: number;
  targetY?: number;
  type: 'walker' | 'shambler' | 'bloated' | 'crawler';
  clothingColor: string;
  biteChance: number;
}

export type StructureType =
  | 'wall_wood'
  | 'wall_wood_crude'
  | 'wall_wood_reinforced'
  | 'fence_wood'
  | 'fence_wire'
  | 'barricade_window'
  | 'door_wood'
  | 'sleeping_mat'
  | 'bed'
  | 'kitchen_stove'
  | 'table_chair'
  | 'workbench'
  | 'medical_station'
  | 'loot_container'
  | 'tree'
  | 'fruit_bush'
  | 'campfire'
  | 'rain_collector';

export interface WorldStructure {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: StructureType;
  name: string;
  hp: number;
  maxHp: number;
  isOpen?: boolean;
  isLit?: boolean;
  containedLoot?: Item[];
  waterStored?: number; // for rain collectors
  maxWater?: number;
  repairPlanks?: number;
  repairNails?: number;
  fruitCount?: number;
  maxFruit?: number;
  lastHarvestTime?: number;
  fruitType?: string;
  chunkKey?: string;
}

export type NpcTask = 'follow' | 'patrol' | 'maintain' | 'rest';

export interface NpcSurvivor {
  id: string;
  name: string;
  avatarColor: string;
  profession: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hunger: number; // 0 (starving) to 100 (full)
  thirst: number; // 0 (parched) to 100 (hydrated)
  fatigue: number; // 0 (rested) to 100 (exhausted)
  hasRefillableBottle?: boolean;
  state: 'stranded' | 'recruited';
  assignedTask: NpcTask;
  equippedWeapon: Item;
  equippedArmor?: Item;
  inventory: Item[];
  dialogue: string;
  targetX?: number;
  targetY?: number;
  targetStructureId?: string;
  lastAttackTime?: number;
  lastRepairTime?: number;
  lastFedTime?: number;
  chunkKey?: string;
}

export interface BuildingBounds {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldChunk {
  chunkX: number;
  chunkY: number;
  key: string;
  type:
    | 'safehouse_base'
    | 'forest'
    | 'suburban_house'
    | 'hardware_store'
    | 'grocery_store'
    | 'pharmacy_clinic'
    | 'police_gunshop'
    | 'farm_orchard';
  name: string;
  structures: WorldStructure[];
  zombies: Zombie[];
  npcs: NpcSurvivor[];
  buildings: BuildingBounds[];
  groundDetails?: { x: number; y: number; type: 'gravel' | 'flowers' | 'blood' | 'road' | 'puddle' }[];
  generatedAt: number;
}

export interface SoundEvent {
  id: string;
  x: number;
  y: number;
  radius: number; // propagation range
  decibels: number;
  label: string;
  timestamp: number;
}

export interface NoiseCell {
  x: number;
  y: number;
  intensity: number; // 0.0 to 1.0+
}

export interface InteractablePrompt {
  structureId?: string;
  targetId?: string;
  targetType?: 'structure' | 'npc' | 'repair' | 'harvest' | 'chest' | 'barrel';
  name: string;
  actionLabel: string;
  x: number;
  y: number;
  type?: StructureType;
  repairPlanksNeeded?: number;
  repairNailsNeeded?: number;
  npc?: NpcSurvivor;
  waterStored?: number;
  maxWater?: number;
}

export interface BloodSplat {
  x: number;
  y: number;
  radius: number;
  intensity: number;
}

export interface FireEmitter {
  x: number;
  y: number;
  radius: number;
  duration: number;
}

export type WeatherType = 'Fog' | 'Overcast' | 'Heavy Rain' | 'Thunderstorm' | 'Clear Cold' | 'Freezing Rain';

export interface EnvironmentState {
  day: number;
  timeMinutes: number; // 0 to 1440
  cycleSeconds: number; // 0 to 3600 (40 min Day = 0-2400s, 20 min Night = 2400-3600s)
  isDay: boolean;
  cycleRemainingMinutes: number;
  weather: WeatherType;
  temperatureC: number;
  gridPower: boolean; // cuts off around day 14
  waterGrid: boolean; // cuts off around day 18
  windSpeedKmh: number;
  fogDensity: number; // 0.0 to 1.0
}

// 40 minutes Day (0-2400s), 20 minutes Night (2400-3600s) cycle calculation
export function getDayNightInfo(cycleSeconds: number) {
  const normSeconds = ((Math.floor(cycleSeconds) % 3600) + 3600) % 3600;
  const isDay = normSeconds < 2400; // 0 to 2400s = 40 minutes of day
  const remainingSeconds = isDay ? 2400 - normSeconds : 3600 - normSeconds;
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

  // In-game 24h clock: 06:00 to 22:00 (16 hrs) in Day, 22:00 to 06:00 (8 hrs) in Night
  let inGameMinutesOfDay = 0;
  if (isDay) {
    const dayProgress = normSeconds / 2400;
    inGameMinutesOfDay = 360 + dayProgress * 960; // 06:00 AM to 10:00 PM
  } else {
    const nightSeconds = normSeconds - 2400;
    const nightProgress = nightSeconds / 1200;
    inGameMinutesOfDay = (1320 + nightProgress * 480) % 1440; // 10:00 PM to 06:00 AM
  }

  let darkness = 0.08;
  if (isDay) {
    if (normSeconds > 2160) {
      // Sunset twilight (last 4 minutes of day: 36m-40m)
      const prog = (normSeconds - 2160) / 240;
      darkness = 0.08 + prog * 0.82;
    } else if (normSeconds < 180) {
      // Sunrise twilight (first 3 minutes of day: 0m-3m)
      const prog = normSeconds / 180;
      darkness = 0.90 - prog * 0.82;
    } else {
      darkness = 0.08;
    }
  } else {
    darkness = 0.90;
  }

  return {
    isDay,
    isNight: !isDay,
    remainingMinutes,
    remainingSeconds,
    inGameMinutesOfDay,
    darkness,
    phaseText: isDay ? `DAY (${remainingMinutes}m left)` : `NIGHT (${remainingMinutes}m left)`,
  };
}

export interface CraftingRecipe {
  id: string;
  name: string;
  menuType: 'build' | 'workbench'; // 'build' = anywhere field, 'workbench' = workbench exclusive
  category: 'Tools' | 'Weapons' | 'Shelter' | 'Furniture' | 'Medical' | 'Cooking' | 'Guns';
  description: string;
  ingredients: { itemId: string; name: string; count: number }[];
  requiredStation?: StructureType;
  requiredTool?: string;
  resultItem?: Item;
  buildsStructure?: StructureType;
  enduranceCost: number;
  noiseDb: number;
  timeMinutes: number;
}

export interface OverseerLogEntry {
  id: string;
  timestamp: string;
  markdown: string;
  isAiGenerated: boolean;
  actionTaken?: string;
}

export interface VisualAnimationEffect {
  id: string;
  type: 'gunshot' | 'melee_swing' | 'tool_chop' | 'tool_hammer' | 'shield_block' | 'spark' | 'floating_text';
  x: number;
  y: number;
  angle: number;
  createdAt: number;
  durationMs: number;
  targetX?: number;
  targetY?: number;
  range?: number;
  text?: string;
  color?: string;
}
