export interface KeyBindings {
  interact: string;     // Default 'f': Doors, Fences, Loot Chests, Chop Trees, Bed, Barrels, Fruit
  equipment: string;    // Default 'e': Equipment & Rig Screen
  repair: string;       // Default 'r': Repair damaged walls, doors, fences
  survivor: string;     // Default 'c': Interact / recruit / talk with survivors
  workbench: string;    // Default 'h': Workbench Crafting Table
  build: string;        // Default 'b': Field Build Menu
  inventory: string;    // Default 'i': Backpack Inventory
  hunger: string;       // Default 'u': Food & Rations Menu
  thirst: string;       // Default 'y': Water & Hydration Menu
  colony: string;       // Default 'k': Colony Survivors Overview
  flashlight: string;   // Default 'g': Flashlight Toggle
}

export const DEFAULT_KEYBINDINGS: KeyBindings = {
  interact: 'f',
  equipment: 'e',
  repair: 'r',
  survivor: 'c',
  workbench: 'h',
  build: 'b',
  inventory: 'i',
  hunger: 'u',
  thirst: 'y',
  colony: 'k',
  flashlight: 'g',
};

export const KEYBINDING_LABELS: Record<keyof KeyBindings, { title: string; description: string }> = {
  interact: {
    title: 'World Action & Interact',
    description: 'Open/close doors, jump fences, loot containers, chop trees, sleep in bed, harvest fruit & rain barrels',
  },
  equipment: {
    title: 'Equipment & Armor Rig',
    description: 'Open dedicated gear, armor slots, weapon holsters, and bite defense rig',
  },
  repair: {
    title: 'Repair Structure',
    description: 'Separate repair action for damaged timber walls, fences, doors, and barricades using planks & nails',
  },
  survivor: {
    title: 'Survivor Interaction',
    description: 'Talk, recruit, trade, and assign tasks to stranded or allied colony survivors',
  },
  workbench: {
    title: 'Workbench Crafting',
    description: 'Open carpentry, metalworking, weaponsmithing, and ammunition reloading crafting bench',
  },
  build: {
    title: 'Field Build Menu',
    description: 'Craft deployable walls, fences, barricades, workbenches, campfires, and beds anywhere',
  },
  inventory: {
    title: 'Backpack Inventory',
    description: 'View full inventory items, inspect weights, and place items on the map',
  },
  hunger: {
    title: 'Food & Rations Menu',
    description: 'Inspect caloric reserves, eat canned rations, and cook food',
  },
  thirst: {
    title: 'Water & Thirst Menu',
    description: 'Inspect hydration reserves, drink clean bottles, and check water grid status',
  },
  colony: {
    title: 'Colony Overview',
    description: 'Manage colony survivors, assign assignments, and view base integrity',
  },
  flashlight: {
    title: 'Flashlight Toggle',
    description: 'Switch tactical forward illumination beam on and off',
  },
};

const STORAGE_KEY = 'knox_keybindings_v2';

export function loadKeyBindings(): KeyBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_KEYBINDINGS, ...parsed };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_KEYBINDINGS };
}

export function saveKeyBindings(bindings: KeyBindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // ignore
  }
}
