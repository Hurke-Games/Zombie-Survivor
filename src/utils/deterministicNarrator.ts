import { EnvironmentState, Survivor, WorldStructure, Zombie } from '../types/game';

interface NarrationParams {
  environment: EnvironmentState;
  survivor: Survivor;
  zombies: Zombie[];
  structures: WorldStructure[];
  tacticalAction?: string;
  recentEvent?: string;
  nearbyZombiesCount: number;
}

export function generateDeterministicObservationLog(params: NarrationParams): {
  markdown: string;
  actions: { text: string; actionId: string; risk: 'low' | 'moderate' | 'high' | 'extreme' }[];
} {
  const { environment, survivor, zombies, structures, tacticalAction, recentEvent, nearbyZombiesCount } = params;

  // Format Time
  const hours = Math.floor(environment.timeMinutes / 60);
  const minutes = environment.timeMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const timeFormatted = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

  // Macro horde assessment based on Day / Night cycle
  let hordeActivity = environment.isDay
    ? 'DAYLIGHT PHASE (40m): Infected seek shelter inside buildings and under trees to escape direct light.'
    : 'NOCTURNAL HUNT (20m): Infected have emerged from buildings/trees, prowling outside under cover of darkness.';
  if (nearbyZombiesCount > 8) {
    hordeActivity = `CRITICAL DENSITY: ${nearbyZombiesCount} infected swarming the perimeter. Auditory vector converging.`;
  } else if (nearbyZombiesCount > 3) {
    hordeActivity = `Elevated prowling: ${nearbyZombiesCount} shamblers attracted to acoustic resonance and structure outline.`;
  }

  // Health state string
  let healthState = 'Stable';
  if (survivor.isBitten) {
    healthState = 'Lethally Infected (Charval Virus 100% Terminal)';
  } else if (survivor.injuries.some((i) => i.bleeding)) {
    healthState = 'Active Hemorrhage / Bleeding';
  } else if (survivor.injuries.length > 0) {
    healthState = 'Lacerated & Bandaged';
  } else if (survivor.hp < 40) {
    healthState = 'Critical Trauma';
  }

  // Mental state
  let mentalState = 'Calm';
  if (survivor.panic > 70) mentalState = 'Sheer Terror';
  else if (survivor.panic > 40) mentalState = 'Panicked';
  else if (survivor.boredom > 60) mentalState = 'Severe Cabin Fever & Depressed';
  else if (survivor.fatigue > 75) mentalState = 'Delirious Exhaustion';

  // Needs state
  const needsList: string[] = [];
  if (survivor.hunger > 60) needsList.push('Starving');
  else if (survivor.hunger > 30) needsList.push('Hungry');
  if (survivor.thirst > 60) needsList.push('Parched');
  else if (survivor.thirst > 30) needsList.push('Thirsty');
  if (survivor.fatigue > 70) needsList.push('Exhausted');
  else if (survivor.fatigue > 40) needsList.push('Fatigued');
  const needsState = needsList.length > 0 ? needsList.join(' / ') : 'Satiated & Rested';

  // Equipped gear
  const weaponStr = survivor.equippedWeapon
    ? `${survivor.equippedWeapon.name} [${survivor.equippedWeapon.durability ?? 100}% Cond]`
    : 'Bare Fists';
  const toolStr = survivor.equippedTool
    ? `${survivor.equippedTool.name} [${survivor.equippedTool.durability ?? 100}% Cond]`
    : 'None';
  const inventoryStr = `${weaponStr} · Tool: ${toolStr}`;

  // Paragraphs for Observation Log
  const p1 = `Surveillance feed captures Sector 4B in Charval County under a blanket of ${environment.weather.toLowerCase()}. The atmospheric barometer registers ${environment.temperatureC}°C with ${environment.gridPower ? 'substation transformers humming faintly' : 'complete blackout grid silence'}. ${
    tacticalAction ? `The subject executed tactical directive: "${tacticalAction}".` : ''
  } ${recentEvent || 'The survivor scans the perimeter through cracked vertical blinds, breath misting in the cold air.'}`;

  const structuresBuilt = structures.filter((s) => s.type !== 'tree' && s.type !== 'loot_container').length;
  const barricades = structures.filter((s) => s.type === 'barricade_window' || s.type === 'wall_wood').length;

  let p2 = '';
  if (nearbyZombiesCount > 5) {
    p2 = `Tactical threat escalated: ${nearbyZombiesCount} shamblers are shuffling within strike radius. Rotted fingernails scrape against exterior siding, leaving dark putrid grease. Structural integrity of existing timber defenses stands at ${barricades} reinforced barriers.`;
  } else if (survivor.fatigue > 60) {
    p2 = `Survivor motor control is deteriorating noticeably. Heavy eyelids and trembling grip reduce weapon leverage by an estimated 35%. Without restorative sleep on an uncompromised bed, systemic collapse is imminent within hours.`;
  } else if (structuresBuilt > 3) {
    p2 = `The homestead fortification holds. The workbench and crafted furniture create a defensible enclave amidst the dead county, though finite resources dictate that every timber plank and nail expended cannot be reclaimed.`;
  } else {
    p2 = `Structural assets remain sparse. The subject is vulnerable to nocturnal breaches. The surrounding woodland holds pine timber suitable for barricades and furniture, but the sound of heavy chopping carries over 60 meters through the stillness.`;
  }

  const p3 = survivor.isBitten
    ? `CRITICAL TELEMETRY WARNING: Viral genome progression has initiated in the bloodstream. The fever will mount inevitably. Cognitive and physical decline will culminate in total loss of subject vitals. There is no cure in Charval County.`
    : `Acoustic microphones register steady wind and distant metallic creaking. Every tactical decision exacts an inescapable toll on calories, hydration, and weapon steel.`;

  // Generate dynamic 3-4 available actions based on context
  const actions: { text: string; actionId: string; risk: 'low' | 'moderate' | 'high' | 'extreme' }[] = [];

  if (nearbyZombiesCount > 2) {
    actions.push({
      text: `Engage nearest shamblers with ${survivor.equippedWeapon?.name || 'blunt weapon'} before horde consolidates`,
      actionId: 'combat_engage',
      risk: 'high',
    });
    actions.push({
      text: 'Retreat silently into interior room, seal reinforced door, and extinguish flashlight',
      actionId: 'stealth_hide',
      risk: 'low',
    });
  } else {
    actions.push({
      text: 'Chop perimeter pine tree for timber planks and kindling (High noise hazard)',
      actionId: 'chop_wood',
      risk: 'moderate',
    });
    actions.push({
      text: 'Scavenge abandoned suburban kitchen cupboards and vehicle glovebox for rations',
      actionId: 'scavenge_loot',
      risk: 'moderate',
    });
  }

  if (survivor.fatigue > 50) {
    actions.push({
      text: 'Rest on cot bed for 4 hours to recover critical fatigue and stamina (Risk of night ambush)',
      actionId: 'sleep_rest',
      risk: nearbyZombiesCount > 0 ? 'high' : 'low',
    });
  } else {
    actions.push({
      text: 'Fortify northern window with heavy pine planks and iron nails at the workbench',
      actionId: 'craft_barricade',
      risk: 'low',
    });
  }

  if (survivor.hunger > 35 || survivor.thirst > 35) {
    actions.push({
      text: 'Boil collected rainwater and prepare warm canned rations over field stove',
      actionId: 'cook_eat',
      risk: 'low',
    });
  } else if (actions.length < 4) {
    actions.push({
      text: 'Conduct high-ground 360° visual recon to plot zombie migration vectors',
      actionId: 'recon_perimeter',
      risk: 'low',
    });
  }

  const markdown = `#### 📊 WORLD STATUS
* **Time/Date:** Day ${environment.day}, ${timeFormatted} (${environment.isDay ? '☀️ DAYTIME' : '🌙 NIGHT'})
* **Weather:** ${environment.weather}, ${environment.temperatureC}°C (Wind: ${environment.windSpeedKmh} km/h)
* **Grid Power:** ${environment.gridPower ? 'Operational' : 'Terminated (Permanent Blackout)'}
* **Water Grid:** ${environment.waterGrid ? 'Operational' : 'Terminated (Dry Pipes)'}
* **Horde Activity:** ${hordeActivity}

#### 👁️ OBSERVATION LOG
${p1}

${p2}

${p3}

#### 📈 SUBJECT VITAL METRICS
* **Health:** ${healthState} (HP: ${Math.round(survivor.hp)}/100)
* **Mental:** ${mentalState} (Panic: ${Math.round(survivor.panic)}% · Boredom: ${Math.round(survivor.boredom)}%)
* **Needs:** ${needsState} (Hunger: ${Math.round(survivor.hunger)}% · Thirst: ${Math.round(survivor.thirst)}% · Fatigue: ${Math.round(survivor.fatigue)}%)
* **Current Inventory/Gear:** ${inventoryStr}

#### 🎮 AVAILABLE ACTIONS
${actions.map((a, idx) => `${idx + 1}. **${a.text}** *[Risk: ${a.risk.toUpperCase()}]*`).join('\n\n')}
`;

  return { markdown, actions };
}
