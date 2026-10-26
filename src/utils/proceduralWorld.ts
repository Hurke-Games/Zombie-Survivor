import {
  WorldStructure,
  Zombie,
  NpcSurvivor,
  BuildingBounds,
  WorldChunk,
  StructureType,
  Item,
} from '../types/game';

export const CHUNK_SIZE = 800;

// Seeded pseudo-random generator
function createRng(seed: number) {
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s = 123456789;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

export function getChunkCoords(worldX: number, worldY: number): { chunkX: number; chunkY: number } {
  return {
    chunkX: Math.floor(worldX / CHUNK_SIZE),
    chunkY: Math.floor(worldY / CHUNK_SIZE),
  };
}

// Check if a point is inside any building
export function isPointInsideBuilding(
  x: number,
  y: number,
  buildings: BuildingBounds[],
  margin: number = 10
): boolean {
  return buildings.some(
    (b) =>
      x >= b.x - margin &&
      x <= b.x + b.width + margin &&
      y >= b.y - margin &&
      y <= b.y + b.height + margin
  );
}

// Check if a point is within fenced safe zones, compound perimeters, or near player beds/workbenches
export function isPointInsideFencedOrSafeZone(
  x: number,
  y: number,
  structures: WorldStructure[],
  margin: number = 20
): boolean {
  // Core Base safe zone around chunk (0, 0) safehouse
  if (x >= 280 && x <= 680 && y >= 150 && y <= 500) {
    return true;
  }

  // Safe radius around any placed bed, sleeping mat, or workbench
  for (const s of structures) {
    if (s.type === 'bed' || s.type === 'sleeping_mat' || s.type === 'workbench') {
      const dist = Math.hypot(s.x + s.width / 2 - x, s.y + s.height / 2 - y);
      if (dist < 130) return true;
    }
  }

  // Any point directly inside or adjacent to a fence line
  for (const s of structures) {
    if (s.type === 'fence_wood' || s.type === 'fence_wire' || s.type === 'wall_wood' || s.type === 'wall_wood_reinforced') {
      if (
        x >= s.x - margin &&
        x <= s.x + s.width + margin &&
        y >= s.y - margin &&
        y <= s.y + s.height + margin
      ) {
        return true;
      }
    }
  }

  return false;
}

// Find a valid spawn position for zombies: MUST be outside buildings and outside fenced/safe zones!
export function getValidZombieSpawnLocation(
  playerX: number,
  playerY: number,
  structures: WorldStructure[],
  buildings: BuildingBounds[],
  minRadius: number = 260,
  maxRadius: number = 650
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 25; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minRadius + Math.random() * (maxRadius - minRadius);
    const testX = Math.round(playerX + Math.cos(angle) * dist);
    const testY = Math.round(playerY + Math.sin(angle) * dist);

    // 1. Must NOT be inside any building
    if (isPointInsideBuilding(testX, testY, buildings, 15)) continue;

    // 2. Must NOT be inside fenced zones or player safe compounds
    if (isPointInsideFencedOrSafeZone(testX, testY, structures, 25)) continue;

    // 3. Must not collide with solid structure directly
    const collidesWithSolid = structures.some((s) => {
      if (s.type === 'tree' || s.type === 'fruit_bush') return false;
      return (
        testX >= s.x - 12 &&
        testX <= s.x + s.width + 12 &&
        testY >= s.y - 12 &&
        testY <= s.y + s.height + 12
      );
    });

    if (!collidesWithSolid) {
      return { x: testX, y: testY };
    }
  }
  return null;
}

const SURVIVOR_FIRST_NAMES = [
  'Sarah',
  'David',
  'Elena',
  'Marcus',
  'Chloe',
  'Officer Ray',
  'Doc Harris',
  'Hannah',
  'Jack',
  'Maya',
  'Liam',
  'Valerie',
];

const SURVIVOR_LAST_NAMES = [
  'Vance',
  'Chen',
  'Rostova',
  'Brody',
  'Hayes',
  'Miller',
  'Kowalski',
  'Bennett',
  'Diaz',
  'Sinclair',
];

const PROFESSIONS: {
  name: string;
  avatarColor: string;
  weapon: Item;
  dialogue: string;
  startingSupplies: Item[];
}[] = [
  {
    name: 'Paramedic',
    avatarColor: '#06b6d4',
    weapon: {
      id: 'npc_scalpel',
      name: 'Surgical Scalpel',
      category: 'weapon',
      weaponType: 'melee',
      description: 'Precision blade.',
      weight: 0.2,
      damage: 22,
      reach: 35,
    },
    dialogue: 'Thank God you found me! I was an EMT in Muldraugh before the quarantine collapsed. I have medical training and can treat wounds!',
    startingSupplies: [
      { id: 'npc_med_gauze', name: 'Sterile Gauze Bandage', category: 'medical', count: 3, weight: 0.2, healValue: 30, description: 'Surgical gauze dressing.' },
      { id: 'npc_med_water', name: 'Clean Water Bottle', category: 'drink', count: 2, weight: 1.0, hydration: 50, description: 'Potable tap water.' },
    ],
  },
  {
    name: 'Master Carpenter',
    avatarColor: '#f59e0b',
    weapon: {
      id: 'npc_carp_hammer',
      name: 'Steel Framing Hammer',
      category: 'tool',
      weaponType: 'melee',
      description: 'Heavy 22oz framing hammer.',
      weight: 1.2,
      damage: 28,
      reach: 45,
    },
    dialogue: 'Watch the rafters! I built half the timber cabins in this sector. Let me join your base and I can maintain walls, reinforce doors, and repair damage.',
    startingSupplies: [
      { id: 'simple_wood_plank', name: 'Simple Wood Planks', category: 'resource', count: 5, weight: 3.0, description: 'Pine framing boards.' },
      { id: 'npc_carp_nails', name: 'Box of Nails', category: 'resource', count: 12, weight: 0.6, description: 'Framing nails.' },
    ],
  },
  {
    name: 'County Deputy',
    avatarColor: '#10b981',
    weapon: {
      id: 'npc_shotgun',
      name: 'Police 12g Pump Shotgun',
      category: 'weapon',
      weaponType: 'gun',
      ammoType: '12g Buckshot Shells',
      description: 'Tactical shotgun.',
      weight: 3.4,
      damage: 85,
      reach: 160,
    },
    dialogue: 'Hold your fire! Charval County Sheriff Office. Patrol squad went dark three days ago. Keep me supplied with shells and I will keep the perimeter clear of shamblers!',
    startingSupplies: [
      { id: 'npc_dep_shells', name: '12g Buckshot Shells', category: 'resource', count: 10, weight: 0.8, description: 'Shotgun shells.' },
      { id: 'npc_dep_jerky', name: 'Dried Beef Jerky', category: 'food', count: 2, weight: 0.3, nutrition: 25, description: 'Dried smoked beef.' },
    ],
  },
  {
    name: 'Veteran Hunter',
    avatarColor: '#84cc16',
    weapon: {
      id: 'npc_machete',
      name: 'Forest Machete',
      category: 'weapon',
      weaponType: 'melee',
      description: 'High carbon steel brush blade.',
      weight: 1.4,
      damage: 38,
      reach: 55,
    },
    dialogue: 'I have been living in these woods since the broadcast towers fell silent. I can track the dead, patrol the compound borders, or scout out fresh supplies.',
    startingSupplies: [
      { id: 'npc_hunt_berries', name: 'Wild Forest Berries', category: 'food', count: 4, weight: 0.4, nutrition: 20, hydration: 15, description: 'Wild harvested berries.' },
      { id: 'npc_hunt_shield', name: 'Hardwood Buckler', category: 'weapon', weaponType: 'shield', blockDefense: 0.8, weight: 2.0, description: 'Hardwood defensive buckler.' },
    ],
  },
];

// Helper to spawn stranded NPC survivors with full needs and refillable drink container
export function createStrandedNpc(
  id: string,
  profIndex: number,
  x: number,
  y: number,
  chunkKey: string,
  rng: () => number
): NpcSurvivor {
  const prof = PROFESSIONS[profIndex % PROFESSIONS.length];
  const firstName = SURVIVOR_FIRST_NAMES[Math.floor(rng() * SURVIVOR_FIRST_NAMES.length)];
  const lastName = SURVIVOR_LAST_NAMES[Math.floor(rng() * SURVIVOR_LAST_NAMES.length)];

  // Make sure everyone has one refillable drink container!
  const refillableCanteen: Item = {
    id: `npc_canteen_${id}`,
    name: 'Refillable Metal Canteen',
    category: 'drink',
    count: 1,
    weight: 0.5,
    hydration: 35,
    isRefillable: true,
    currentSips: 4 + Math.floor(rng() * 3), // 4 to 6 sips
    maxSips: 6,
    description: 'Refillable water canteen. Refills at any rain barrel [E].',
  };

  return {
    id,
    name: `${firstName} ${lastName}`,
    avatarColor: prof.avatarColor,
    profession: prof.name,
    x,
    y,
    hp: 90 + Math.floor(rng() * 11),
    maxHp: 100,
    hunger: 70 + Math.floor(rng() * 25),
    thirst: 70 + Math.floor(rng() * 25),
    fatigue: 10 + Math.floor(rng() * 20),
    hasRefillableBottle: true,
    state: 'stranded',
    assignedTask: profIndex === 2 ? 'patrol' : profIndex === 1 ? 'maintain' : 'follow',
    equippedWeapon: prof.weapon,
    inventory: [refillableCanteen, ...prof.startingSupplies],
    dialogue: prof.dialogue,
    chunkKey,
  };
}

// Generate procedural content for any chunk
export function generateChunk(
  chunkX: number,
  chunkY: number,
  worldSeed: number = 42
): WorldChunk {
  const key = getChunkKey(chunkX, chunkY);
  const baseX = chunkX * CHUNK_SIZE;
  const baseY = chunkY * CHUNK_SIZE;

  // Use unique seed per chunk
  const chunkSeed = worldSeed * 10007 + chunkX * 73856093 + chunkY * 19349663;
  const rng = createRng(chunkSeed);

  // Chunk types selection (excluding chunk 0,0 which is safehouse base)
  const types: WorldChunk['type'][] = [
    'forest',
    'forest',
    'suburban_house',
    'suburban_house',
    'hardware_store',
    'grocery_store',
    'pharmacy_clinic',
    'police_gunshop',
    'farm_orchard',
  ];

  let chunkType = types[Math.floor(rng() * types.length)];
  // Spoken clue: "My neighbor three blocks west had some tools..." -> Sector [-3, 0] is guaranteed to be neighbor's house
  if (chunkX === -3 && chunkY === 0) {
    chunkType = 'suburban_house';
  }
  let name = `Sector [${chunkX}, ${chunkY}]`;

  const structures: WorldStructure[] = [];
  const zombies: Zombie[] = [];
  const npcs: NpcSurvivor[] = [];
  const buildings: BuildingBounds[] = [];
  const groundDetails: WorldChunk['groundDetails'] = [];

  // Ground details (dirt trails, gravel, foliage)
  const detailCount = 10 + Math.floor(rng() * 12);
  for (let i = 0; i < detailCount; i++) {
    groundDetails.push({
      x: baseX + Math.floor(rng() * (CHUNK_SIZE - 40)),
      y: baseY + Math.floor(rng() * (CHUNK_SIZE - 40)),
      type: rng() < 0.4 ? 'gravel' : rng() < 0.7 ? 'flowers' : 'puddle',
    });
  }

  if (chunkType === 'forest') {
    name = `Blackwood Forest [${chunkX}, ${chunkY}]`;
    // 20 - 30 Trees
    const treeCount = 22 + Math.floor(rng() * 10);
    for (let i = 0; i < treeCount; i++) {
      const tx = baseX + 40 + Math.floor(rng() * (CHUNK_SIZE - 120));
      const ty = baseY + 40 + Math.floor(rng() * (CHUNK_SIZE - 120));
      structures.push({
        id: `tree_${key}_${i}`,
        x: tx,
        y: ty,
        width: 48,
        height: 48,
        type: 'tree',
        name: rng() < 0.5 ? 'White Pine Tree' : 'Charval Red Oak',
        hp: 120,
        maxHp: 120,
        chunkKey: key,
      });
    }

    // 4 - 6 Harvestable Fruit Bushes & Apple Trees
    const fruitCount = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < fruitCount; i++) {
      const fx = baseX + 60 + Math.floor(rng() * (CHUNK_SIZE - 140));
      const fy = baseY + 60 + Math.floor(rng() * (CHUNK_SIZE - 140));
      const isApple = rng() < 0.4;
      structures.push({
        id: `fruit_${key}_${i}`,
        x: fx,
        y: fy,
        width: 36,
        height: 36,
        type: 'fruit_bush',
        name: isApple ? 'Wild Apple Tree' : 'Ripe Blackberry Bush',
        hp: 60,
        maxHp: 60,
        fruitCount: 3,
        maxFruit: 3,
        lastHarvestTime: Date.now(),
        fruitType: isApple ? 'Red Orchard Apple' : 'Wild Blackberries',
        chunkKey: key,
      });
    }

    // 2 - 3 Riverbed Clay Deposits along natural depressions/forest creek
    const clayCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < clayCount; i++) {
      const cx = baseX + 70 + Math.floor(rng() * (CHUNK_SIZE - 140));
      const cy = baseY + 70 + Math.floor(rng() * (CHUNK_SIZE - 140));
      structures.push({
        id: `clay_${key}_${i}`,
        x: cx,
        y: cy,
        width: 44,
        height: 44,
        type: 'riverbed_clay',
        name: 'Riverbed Clay Deposit',
        hp: 120,
        maxHp: 120,
        chunkKey: key,
      });
    }

    // 2 - 3 Boulders / Quarry Rocks in Forest (Power Trencher pulverizes for Gravel)
    const rockCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < rockCount; i++) {
      const rx = baseX + 90 + Math.floor(rng() * (CHUNK_SIZE - 180));
      const ry = baseY + 90 + Math.floor(rng() * (CHUNK_SIZE - 180));
      structures.push({
        id: `rock_${key}_${i}`,
        x: rx,
        y: ry,
        width: 44,
        height: 40,
        type: 'boulder_rock',
        name: 'Granite Quarry Boulder',
        hp: 300,
        maxHp: 300,
        chunkKey: key,
      });
    }

    // Stranded Hunter Survivor (15% chance)
    if (rng() < 0.18) {
      npcs.push(
        createStrandedNpc(
          `npc_${key}`,
          3, // Hunter
          baseX + 350 + Math.floor(rng() * 100),
          baseY + 350 + Math.floor(rng() * 100),
          key,
          rng
        )
      );
    }

    // Outdoor zombies along forest trail (outside buildings)
    const zCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < zCount; i++) {
      zombies.push({
        id: `z_${key}_${i}`,
        x: baseX + 80 + Math.floor(rng() * (CHUNK_SIZE - 160)),
        y: baseY + 80 + Math.floor(rng() * (CHUNK_SIZE - 160)),
        angle: rng() * Math.PI * 2,
        hp: 45 + Math.floor(rng() * 20),
        maxHp: 55,
        speed: 0.35 + rng() * 0.15,
        state: 'wandering',
        type: rng() < 0.6 ? 'shambler' : 'walker',
        clothingColor: rng() < 0.5 ? '#475569' : '#334155',
        biteChance: 0.2,
      });
    }
  } else if (chunkType === 'suburban_house') {
    name = `Residential Cabin [${chunkX}, ${chunkY}]`;
    const hx = baseX + 240;
    const hy = baseY + 220;
    const hw = 300;
    const hh = 240;

    buildings.push({
      id: `bldg_${key}`,
      name: 'Residential House',
      x: hx,
      y: hy,
      width: hw,
      height: hh,
    });

    // Walls (North & West walls are Red Brick Walls that player can break down with Claw Hammer for Stone Blocks!)
    structures.push(
      { id: `wall_${key}_n`, x: hx, y: hy, width: hw, height: 16, type: 'wall_brick', name: 'Red Brick Wall', hp: 400, maxHp: 400, chunkKey: key },
      { id: `wall_${key}_s1`, x: hx, y: hy + hh - 16, width: 120, height: 16, type: 'wall_wood', name: 'Timber Wall', hp: 250, maxHp: 250, repairPlanks: 3, repairNails: 4, chunkKey: key },
      { id: `door_${key}`, x: hx + 120, y: hy + hh - 16, width: 60, height: 16, type: 'door_wood', name: 'Cabin Front Door', hp: 200, maxHp: 200, isOpen: false, repairPlanks: 2, repairNails: 4, chunkKey: key },
      { id: `wall_${key}_s2`, x: hx + 180, y: hy + hh - 16, width: 120, height: 16, type: 'wall_wood', name: 'Timber Wall', hp: 250, maxHp: 250, repairPlanks: 3, repairNails: 4, chunkKey: key },
      { id: `wall_${key}_w`, x: hx, y: hy + 16, width: 16, height: hh - 32, type: 'wall_brick', name: 'Red Brick Wall', hp: 400, maxHp: 400, chunkKey: key },
      { id: `wall_${key}_e`, x: hx + hw - 16, y: hy + 16, width: 16, height: hh - 32, type: 'wall_wood', name: 'Timber Wall', hp: 250, maxHp: 250, repairPlanks: 3, repairNails: 4, chunkKey: key }
    );

    // Abandoned car in driveway (Tempered Crowbar dismantles for Iron Pipes!)
    structures.push({
      id: `car_${key}`,
      x: hx + hw + 20,
      y: hy + 70,
      width: 70,
      height: 36,
      type: 'abandoned_car',
      name: rng() < 0.5 ? 'Abandoned Sedan' : 'Rusted Station Wagon',
      hp: 350,
      maxHp: 350,
      chunkKey: key,
    });

    // Utility Pole along front road (Motorized Saw fells for Treated Planks!)
    structures.push({
      id: `pole_${key}`,
      x: hx - 60,
      y: hy + hh + 40,
      width: 20,
      height: 20,
      type: 'utility_pole',
      name: 'Creosote Utility Pole',
      hp: 220,
      maxHp: 220,
      chunkKey: key,
    });

    // Concrete Home Foundation slab (Sledgehammer smashes for Concrete Mix!)
    structures.push({
      id: `foundation_${key}`,
      x: hx - 90,
      y: hy + 60,
      width: 65,
      height: 32,
      type: 'home_foundation',
      name: 'Concrete Home Foundation',
      hp: 380,
      maxHp: 380,
      chunkKey: key,
    });

    // Interior furniture & pantry
    structures.push(
      { id: `bed_${key}`, x: hx + 35, y: hy + 35, width: 65, height: 42, type: 'bed', name: 'Cabin Cot Bed', hp: 160, maxHp: 160, chunkKey: key },
      { id: `stove_${key}`, x: hx + hw - 85, y: hy + 35, width: 48, height: 42, type: 'kitchen_stove', name: 'Kitchen Cooking Stove', hp: 200, maxHp: 200, chunkKey: key },
      {
        id: `pantry_${key}`,
        x: hx + hw - 85,
        y: hy + 105,
        width: 45,
        height: 38,
        type: 'loot_container',
        name: 'Kitchen Food Cupboard',
        hp: 120,
        maxHp: 120,
        chunkKey: key,
        containedLoot: [
          { id: `loot_can_${key}_1`, name: 'Canned Beef Chili', category: 'food', nutrition: 35, hydration: 10, count: 2, weight: 0.5, description: 'Hearty preserved chili.' },
          { id: `loot_water_${key}_1`, name: 'Clean Water Bottle', category: 'drink', hydration: 50, count: 2, weight: 1.0, description: 'Potable fresh water.' },
        ],
      },
      {
        id: `toolbox_${key}`,
        x: hx + 40,
        y: hy + 105,
        width: 44,
        height: 28,
        type: 'loot_container',
        name: 'Tool Box',
        hp: 150,
        maxHp: 150,
        chunkKey: key,
        containedLoot: [
          { id: `scrap_steel_${key}_1`, name: 'Scrap Steel', category: 'resource', count: 2, weight: 1.0, description: 'Dense scrap steel plates and structural salvage.' },
          { id: `box_nails_${key}_1`, name: 'Box of Nails', category: 'resource', count: 2, weight: 0.4, description: 'Steel construction nails essential for carpentry and scrap tools.' },
        ],
      }
    );

    // Backyard perimeter fence
    structures.push(
      { id: `fence_${key}_1`, x: hx - 50, y: hy - 50, width: hw + 100, height: 12, type: 'fence_wood', name: 'Backyard Wood Fence', hp: 150, maxHp: 150, repairPlanks: 1, repairNails: 2, chunkKey: key },
      { id: `fence_${key}_2`, x: hx - 50, y: hy - 50, width: 12, height: hh + 80, type: 'fence_wood', name: 'Backyard Wood Fence', hp: 150, maxHp: 150, repairPlanks: 1, repairNails: 2, chunkKey: key },
      { id: `fruit_yard_${key}`, x: hx + 50, y: hy - 35, width: 34, height: 34, type: 'fruit_bush', name: 'Backyard Berry Bush', hp: 60, maxHp: 60, fruitCount: 3, maxFruit: 3, fruitType: 'Sweet Garden Berries', chunkKey: key }
    );

    // 25% chance of stranded survivor hiding inside
    if (rng() < 0.28) {
      npcs.push(createStrandedNpc(`npc_${key}`, Math.floor(rng() * 2), hx + 140, hy + 110, key, rng));
    }

    // Outdoor zombies (strictly outside house & yard fence!)
    const zCount = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < zCount; i++) {
      const zx = rng() < 0.5 ? baseX + 70 + Math.floor(rng() * 110) : baseX + hw + 360 + Math.floor(rng() * 100);
      const zy = baseY + 100 + Math.floor(rng() * (CHUNK_SIZE - 200));
      zombies.push({
        id: `z_${key}_${i}`,
        x: zx,
        y: zy,
        angle: rng() * Math.PI * 2,
        hp: 45 + Math.floor(rng() * 20),
        maxHp: 55,
        speed: 0.38 + rng() * 0.12,
        state: 'wandering',
        type: 'walker',
        clothingColor: '#64748b',
        biteChance: 0.2,
      });
    }
  } else if (chunkType === 'hardware_store') {
    name = `Charval Hardware & Tools [${chunkX}, ${chunkY}]`;
    const sx = baseX + 220;
    const sy = baseY + 200;
    const sw = 340;
    const sh = 260;

    buildings.push({
      id: `bldg_${key}`,
      name: 'Hardware Store',
      x: sx,
      y: sy,
      width: sw,
      height: sh,
    });

    // Walls & entrance
    structures.push(
      { id: `wall_${key}_n`, x: sx, y: sy, width: sw, height: 16, type: 'wall_wood_reinforced', name: 'Reinforced Concrete Wall', hp: 450, maxHp: 450, repairPlanks: 4, repairNails: 6, chunkKey: key },
      { id: `wall_${key}_s1`, x: sx, y: sy + sh - 16, width: 140, height: 16, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 450, maxHp: 450, repairPlanks: 4, repairNails: 6, chunkKey: key },
      { id: `door_${key}`, x: sx + 140, y: sy + sh - 16, width: 60, height: 16, type: 'door_wood', name: 'Storefront Double Door', hp: 280, maxHp: 280, isOpen: false, repairPlanks: 3, repairNails: 5, chunkKey: key },
      { id: `wall_${key}_s2`, x: sx + 200, y: sy + sh - 16, width: 140, height: 16, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 450, maxHp: 450, repairPlanks: 4, repairNails: 6, chunkKey: key },
      { id: `wall_${key}_w`, x: sx, y: sy + 16, width: 16, height: sh - 32, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 450, maxHp: 450, repairPlanks: 4, repairNails: 6, chunkKey: key },
      { id: `wall_${key}_e`, x: sx + sw - 16, y: sy + 16, width: 16, height: sh - 32, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 450, maxHp: 450, repairPlanks: 4, repairNails: 6, chunkKey: key }
    );

    // Shelving units with carpentry, tools, and nails!
    structures.push(
      {
        id: `shelf_${key}_1`,
        x: sx + 40,
        y: sy + 40,
        width: 70,
        height: 35,
        type: 'loot_container',
        name: 'Lumber & Nails Rack',
        hp: 180,
        maxHp: 180,
        chunkKey: key,
        containedLoot: [
          { id: `simple_wood_plank_${key}`, name: 'Simple Wood Planks', category: 'resource', count: 8, weight: 3.5, description: 'Heavy timber boards.' },
          { id: `loot_nails_${key}`, name: 'Box of Nails', category: 'resource', count: 18, weight: 0.8, description: 'Framing nails.' },
        ],
      },
      {
        id: `shelf_${key}_2`,
        x: sx + sw - 120,
        y: sy + 40,
        width: 75,
        height: 35,
        type: 'loot_container',
        name: 'Tool & Rig Display Case',
        hp: 200,
        maxHp: 200,
        chunkKey: key,
        containedLoot: [
          { id: `loot_crowbar_${key}`, name: 'Heavy Steel Crowbar', category: 'weapon', weaponType: 'melee', damage: 35, reach: 55, durability: 95, maxDurability: 100, weight: 2.0, description: 'Forged prying crowbar.' },
          { id: `loot_shield_${key}`, name: 'Improvised Wood Shield', category: 'weapon', weaponType: 'shield', blockDefense: 0.85, durability: 75, maxDurability: 75, weight: 2.2, description: 'Blocks 85% damage.' },
        ],
      },
      {
        id: `toolbox_${key}`,
        x: sx + 120,
        y: sy + 40,
        width: 44,
        height: 28,
        type: 'loot_container',
        name: 'Tool Box',
        hp: 150,
        maxHp: 150,
        chunkKey: key,
        containedLoot: [
          { id: `scrap_steel_${key}_1`, name: 'Scrap Steel', category: 'resource', count: 2, weight: 1.0, description: 'Dense scrap steel plates and structural salvage.' },
          { id: `box_nails_${key}_1`, name: 'Box of Nails', category: 'resource', count: 2, weight: 0.4, description: 'Steel construction nails essential for carpentry and scrap tools.' },
        ],
      },
      { id: `bench_${key}`, x: sx + 180, y: sy + 40, width: 55, height: 35, type: 'workbench', name: 'Store Demonstration Workbench', hp: 300, maxHp: 300, chunkKey: key },
      {
        id: `car_hw_${key}`,
        x: sx + 50,
        y: sy + sh + 25,
        width: 72,
        height: 36,
        type: 'abandoned_car',
        name: 'Derelict Pickup Truck',
        hp: 350,
        maxHp: 350,
        chunkKey: key,
      },
      {
        id: `vault_hw_${key}`,
        x: sx + sw - 70,
        y: sy + 120,
        width: 48,
        height: 44,
        type: 'bank_vault',
        name: 'Heavy Industrial Steel Safe',
        hp: 500,
        maxHp: 500,
        chunkKey: key,
      },
      {
        id: `pole_hw_${key}`,
        x: sx - 40,
        y: sy + sh + 30,
        width: 20,
        height: 20,
        type: 'utility_pole',
        name: 'Commercial Utility Pole',
        hp: 250,
        maxHp: 250,
        chunkKey: key,
      }
    );

    // 35% chance of stranded Carpenter survivor!
    if (rng() < 0.35) {
      npcs.push(createStrandedNpc(`npc_${key}`, 1, sx + 160, sy + 130, key, rng));
    }

    // Outdoor zombies in parking lot
    const zCount = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < zCount; i++) {
      const zx = baseX + 60 + Math.floor(rng() * (CHUNK_SIZE - 120));
      const zy = baseY + sh + 240 + Math.floor(rng() * 140);
      zombies.push({
        id: `z_${key}_${i}`,
        x: zx,
        y: zy,
        angle: rng() * Math.PI * 2,
        hp: 55 + Math.floor(rng() * 15),
        maxHp: 65,
        speed: 0.4,
        state: 'wandering',
        type: 'shambler',
        clothingColor: '#475569',
        biteChance: 0.25,
      });
    }
  } else if (chunkType === 'grocery_store') {
    name = `Sun Valley Grocery & Pantry [${chunkX}, ${chunkY}]`;
    const gx = baseX + 220;
    const gy = baseY + 200;
    const gw = 340;
    const gh = 260;

    buildings.push({
      id: `bldg_${key}`,
      name: 'Grocery Supermarket',
      x: gx,
      y: gy,
      width: gw,
      height: gh,
    });

    structures.push(
      { id: `wall_${key}_n`, x: gx, y: gy, width: gw, height: 16, type: 'wall_wood', name: 'Market Wall', hp: 300, maxHp: 300, chunkKey: key },
      { id: `wall_${key}_s1`, x: gx, y: gy + gh - 16, width: 140, height: 16, type: 'wall_wood', name: 'Market Wall', hp: 300, maxHp: 300, chunkKey: key },
      { id: `door_${key}`, x: gx + 140, y: gy + gh - 16, width: 60, height: 16, type: 'door_wood', name: 'Market Automatic Door (Off)', hp: 200, maxHp: 200, isOpen: false, chunkKey: key },
      { id: `wall_${key}_s2`, x: gx + 200, y: gy + gh - 16, width: 140, height: 16, type: 'wall_wood', name: 'Market Wall', hp: 300, maxHp: 300, chunkKey: key },
      { id: `wall_${key}_w`, x: gx, y: gy + 16, width: 16, height: gh - 32, type: 'wall_wood', name: 'Market Wall', hp: 300, maxHp: 300, chunkKey: key },
      { id: `wall_${key}_e`, x: gx + gw - 16, y: gy + 16, width: 16, height: gh - 32, type: 'wall_wood', name: 'Market Wall', hp: 300, maxHp: 300, chunkKey: key },
      {
        id: `shelf_${key}_food`,
        x: gx + 45,
        y: gy + 50,
        width: 80,
        height: 35,
        type: 'loot_container',
        name: 'Canned Goods Aisle',
        hp: 150,
        maxHp: 150,
        chunkKey: key,
        containedLoot: [
          { id: `can_stew_${key}`, name: 'Canned Beef Chili', category: 'food', nutrition: 35, hydration: 10, count: 3, weight: 0.5, description: 'Hearty chili.' },
          { id: `can_beans_${key}`, name: 'Canned Baked Beans', category: 'food', nutrition: 30, hydration: 5, count: 3, weight: 0.4, description: 'Baked beans.' },
        ],
      },
      {
        id: `shelf_${key}_drinks`,
        x: gx + gw - 125,
        y: gy + 50,
        width: 80,
        height: 35,
        type: 'loot_container',
        name: 'Beverage Coolers',
        hp: 150,
        maxHp: 150,
        chunkKey: key,
        containedLoot: [
          { id: `drink_water_${key}`, name: 'Clean Water Bottle', category: 'drink', hydration: 50, count: 4, weight: 1.0, description: 'Purified water.' },
          { id: `drink_soda_${key}`, name: 'Lemon Soda Can', category: 'drink', hydration: 35, nutrition: 10, count: 3, weight: 0.35, description: 'Cold soda.' },
        ],
      }
    );

    // Outdoor zombies in street
    const zCount = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < zCount; i++) {
      zombies.push({
        id: `z_${key}_${i}`,
        x: baseX + 50 + Math.floor(rng() * (CHUNK_SIZE - 100)),
        y: baseY + 50 + Math.floor(rng() * 120),
        angle: rng() * Math.PI * 2,
        hp: 50,
        maxHp: 50,
        speed: 0.42,
        state: 'wandering',
        type: 'walker',
        clothingColor: '#334155',
        biteChance: 0.2,
      });
    }
  } else if (chunkType === 'police_gunshop') {
    name = `Charval County Armory & Surplus [${chunkX}, ${chunkY}]`;
    const px = baseX + 230;
    const py = baseY + 210;
    const pw = 320;
    const ph = 240;

    buildings.push({
      id: `bldg_${key}`,
      name: 'Police Armory',
      x: px,
      y: py,
      width: pw,
      height: ph,
    });

    structures.push(
      { id: `wall_${key}_n`, x: px, y: py, width: pw, height: 16, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 500, maxHp: 500, chunkKey: key },
      { id: `wall_${key}_s1`, x: px, y: py + ph - 16, width: 130, height: 16, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 500, maxHp: 500, chunkKey: key },
      { id: `door_${key}`, x: px + 130, y: py + ph - 16, width: 60, height: 16, type: 'door_wood', name: 'Security Vault Door', hp: 350, maxHp: 350, isOpen: false, chunkKey: key },
      { id: `wall_${key}_s2`, x: px + 190, y: py + ph - 16, width: pw - 190, height: 16, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 500, maxHp: 500, chunkKey: key },
      { id: `wall_${key}_w`, x: px, y: py + 16, width: 16, height: ph - 32, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 500, maxHp: 500, chunkKey: key },
      { id: `wall_${key}_e`, x: px + pw - 16, y: py + 16, width: 16, height: ph - 32, type: 'wall_wood_reinforced', name: 'Reinforced Wall', hp: 500, maxHp: 500, chunkKey: key },
      {
        id: `toolbox_${key}`,
        x: px + 40,
        y: py + 40,
        width: 75,
        height: 35,
        type: 'loot_container',
        name: 'Tool Box',
        hp: 300,
        maxHp: 300,
        chunkKey: key,
        containedLoot: [
          { id: `scrap_steel_${key}_1`, name: 'Scrap Steel', category: 'resource', count: 2, weight: 1.0, description: 'Dense scrap steel plates and structural salvage.' },
          { id: `box_nails_${key}_1`, name: 'Box of Nails', category: 'resource', count: 2, weight: 0.4, description: 'Steel construction nails essential for carpentry and scrap tools.' },
        ],
      },
      {
        id: `vault_armory_${key}`,
        x: px + pw - 65,
        y: py + 40,
        width: 48,
        height: 44,
        type: 'bank_vault',
        name: 'Armored Evidence Bank Vault',
        hp: 550,
        maxHp: 550,
        chunkKey: key,
      }
    );

    // 40% chance of Deputy NPC survivor!
    if (rng() < 0.4) {
      npcs.push(createStrandedNpc(`npc_${key}`, 2, px + 150, py + 100, key, rng));
    }

    // Heavy zombie patrol outside armory
    const zCount = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < zCount; i++) {
      zombies.push({
        id: `z_${key}_${i}`,
        x: baseX + 60 + Math.floor(rng() * (CHUNK_SIZE - 120)),
        y: baseY + ph + 240 + Math.floor(rng() * 180),
        angle: rng() * Math.PI * 2,
        hp: 60,
        maxHp: 60,
        speed: 0.42,
        state: 'wandering',
        type: 'bloated',
        clothingColor: '#1e293b',
        biteChance: 0.25,
      });
    }
  } else if (chunkType === 'farm_orchard') {
    name = `Greenbrier Orchard & Farm [${chunkX}, ${chunkY}]`;

    // 8 - 12 Fruit Trees & Bushes
    const fruitTreeCount = 8 + Math.floor(rng() * 5);
    for (let i = 0; i < fruitTreeCount; i++) {
      const fx = baseX + 80 + (i % 4) * 160 + Math.floor(rng() * 30);
      const fy = baseY + 80 + Math.floor(i / 4) * 180 + Math.floor(rng() * 30);
      structures.push({
        id: `orchard_tree_${key}_${i}`,
        x: fx,
        y: fy,
        width: 44,
        height: 44,
        type: 'fruit_bush',
        name: i % 2 === 0 ? 'Orchard Peach Tree' : 'Heirloom Apple Tree',
        hp: 80,
        maxHp: 80,
        fruitCount: 3,
        maxFruit: 3,
        lastHarvestTime: Date.now(),
        fruitType: i % 2 === 0 ? 'Sweet Orchard Peach' : 'Crisp Heirloom Apple',
        chunkKey: key,
      });
    }

    // Fencing around orchard
    structures.push(
      { id: `fence_farm_${key}_1`, x: baseX + 40, y: baseY + 40, width: CHUNK_SIZE - 80, height: 12, type: 'fence_wood', name: 'Orchard Picket Fence', hp: 150, maxHp: 150, repairPlanks: 1, repairNails: 2, chunkKey: key },
      { id: `fence_farm_${key}_2`, x: baseX + 40, y: baseY + 40, width: 12, height: CHUNK_SIZE - 80, type: 'fence_wood', name: 'Orchard Picket Fence', hp: 150, maxHp: 150, repairPlanks: 1, repairNails: 2, chunkKey: key },
      {
        id: `clay_farm_${key}`,
        x: baseX + 80,
        y: baseY + CHUNK_SIZE - 120,
        width: 44,
        height: 44,
        type: 'riverbed_clay',
        name: 'Irrigation Canal Clay Deposit',
        hp: 120,
        maxHp: 120,
        chunkKey: key,
      }
    );

    // Outdoor zombies wandering along farm edges
    const zCount = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < zCount; i++) {
      zombies.push({
        id: `z_${key}_${i}`,
        x: baseX + 50 + Math.floor(rng() * 120),
        y: baseY + 120 + Math.floor(rng() * (CHUNK_SIZE - 240)),
        angle: rng() * Math.PI * 2,
        hp: 50,
        maxHp: 50,
        speed: 0.38,
        state: 'wandering',
        type: 'walker',
        clothingColor: '#4d7c0f',
        biteChance: 0.2,
      });
    }
  } else {
    // Pharmacy clinic fallback
    name = `Charval Emergency Clinic [${chunkX}, ${chunkY}]`;
    const cx = baseX + 230;
    const cy = baseY + 210;
    const cw = 320;
    const ch = 240;

    buildings.push({
      id: `bldg_${key}`,
      name: 'Medical Clinic',
      x: cx,
      y: cy,
      width: cw,
      height: ch,
    });

    structures.push(
      { id: `wall_${key}_n`, x: cx, y: cy, width: cw, height: 16, type: 'wall_wood', name: 'Clinic Wall', hp: 250, maxHp: 250, chunkKey: key },
      { id: `wall_${key}_s1`, x: cx, y: cy + ch - 16, width: 130, height: 16, type: 'wall_wood', name: 'Clinic Wall', hp: 250, maxHp: 250, chunkKey: key },
      { id: `door_${key}`, x: cx + 130, y: cy + ch - 16, width: 60, height: 16, type: 'door_wood', name: 'Clinic Glass Door', hp: 180, maxHp: 180, isOpen: false, chunkKey: key },
      { id: `wall_${key}_s2`, x: cx + 190, y: cy + ch - 16, width: cw - 190, height: 16, type: 'wall_wood', name: 'Clinic Wall', hp: 250, maxHp: 250, chunkKey: key },
      { id: `wall_${key}_w`, x: cx, y: cy + 16, width: 16, height: ch - 32, type: 'wall_wood', name: 'Clinic Wall', hp: 250, maxHp: 250, chunkKey: key },
      { id: `wall_${key}_e`, x: cx + cw - 16, y: cy + 16, width: 16, height: ch - 32, type: 'wall_wood', name: 'Clinic Wall', hp: 250, maxHp: 250, chunkKey: key },
      {
        id: `med_cabinet_${key}`,
        x: cx + 40,
        y: cy + 40,
        width: 70,
        height: 35,
        type: 'loot_container',
        name: 'Emergency Medical Cabinet',
        hp: 150,
        maxHp: 150,
        chunkKey: key,
        containedLoot: [
          { id: `med_gauze_${key}`, name: 'Sterile Gauze Bandage', category: 'medical', count: 4, weight: 0.2, healValue: 25, isSterile: true, description: 'Medical dressing.' },
          { id: `med_water_${key}`, name: 'Clean Water Bottle', category: 'drink', count: 2, hydration: 50, weight: 1.0, description: 'Saline water.' },
        ],
      }
    );

    // 40% chance of Paramedic NPC survivor
    if (rng() < 0.4) {
      npcs.push(createStrandedNpc(`npc_${key}`, 0, cx + 150, cy + 100, key, rng));
    }

    // Outdoor zombies in clinic lot
    const zCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < zCount; i++) {
      zombies.push({
        id: `z_${key}_${i}`,
        x: baseX + 60 + Math.floor(rng() * (CHUNK_SIZE - 120)),
        y: baseY + 50 + Math.floor(rng() * 120),
        angle: rng() * Math.PI * 2,
        hp: 50,
        maxHp: 50,
        speed: 0.4,
        state: 'wandering',
        type: 'walker',
        clothingColor: '#0284c7',
        biteChance: 0.2,
      });
    }
  }

  // 1-2 pieces of Scrap Wood scattered outside on the ground to pick up
  const scrapWoodCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < scrapWoodCount; i++) {
    structures.push({
      id: `ground_scrap_${key}_${i}`,
      x: baseX + 80 + Math.floor(rng() * (CHUNK_SIZE - 160)),
      y: baseY + 80 + Math.floor(rng() * (CHUNK_SIZE - 160)),
      width: 22,
      height: 20,
      type: 'ground_scrap_wood',
      name: 'Scrap Wood',
      hp: 1,
      maxHp: 1,
      chunkKey: key,
    });
  }

  return {
    chunkX,
    chunkY,
    key,
    type: chunkType,
    name,
    structures,
    zombies,
    npcs,
    buildings,
    groundDetails,
    generatedAt: Date.now(),
  };
}
