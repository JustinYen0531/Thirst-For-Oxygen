import {
  ATTACK_VALUE_LABELS as ZH_ATTACK_VALUE_LABELS,
  ENEMY_ENCYCLOPEDIA,
  MAP_ENCYCLOPEDIA,
  PASSIVE_ENCYCLOPEDIA,
  WEAPON_ENCYCLOPEDIA,
} from './enemy-encyclopedia.js';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  getLanguage,
  setLanguage,
} from './i18n.js';

export const DEFAULT_ENCYCLOPEDIA_LOCALE = DEFAULT_LANGUAGE;
export const SUPPORTED_ENCYCLOPEDIA_LOCALES = SUPPORTED_LANGUAGES;
export const ENCYCLOPEDIA_LOCALE_STORAGE_KEY = LANGUAGE_STORAGE_KEY;

const TIME_VALUE_KEYS = new Set([
  'aftermathDelay', 'bubbleLifetime', 'castTime', 'cooldown', 'detonationDelay',
  'duration', 'inkDuration', 'orbInvulnerableDuration', 'oxygenZoneDuration',
  'rerollInterval', 'returnDelay', 'shieldCooldown', 'shieldDuration', 'sludgeDuration',
  'stun', 'telegraph',
]);

const TIER_EN = Object.freeze({
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4',
  miniBoss: 'Mini Boss',
  mutatedMiniBoss: 'Mutated Mini Boss',
  finalBoss: 'Final Boss',
});

const TIER_ZH = Object.freeze({
  all: '全部',
  1: '等級 1',
  2: '等級 2',
  3: '等級 3',
  4: '等級 4',
  miniBoss: '小 Boss',
  mutatedMiniBoss: '變異小 Boss',
  finalBoss: 'Final Boss',
});

const ENEMY_EN = Object.freeze({
  explodingLanternfish: {
    name: 'Burst-Belly Lanternfish', role: 'Suicide melee',
    description: 'An unstable lanternfish that lures targets with a faint glow before turning itself into a deep-sea bomb.',
    lore: {
      scientificReference: 'Juvenile lanternfish (family Myctophidae), referenced for its small body and ventral photophores.',
      identification: 'Round pressure belly, small photophores, compact fish body, and a forward-charging pose.',
      visualSetting: 'A small stone-bodied lanternfish with an unstable pressure sac. Cyan cracks concentrate around the belly and head; avoid a humanoid bomb or equipped character.',
    },
    attacks: { contactExplosion: ['Contact Detonation', 'Continues pursuing a visible player, but only starts its one-second stationary detonation countdown after its body overlaps the player. Proximity alone does not arm it.'] },
  },
  juvenileSeahorseCaller: {
    name: 'Juvenile Seahorse Caller', role: 'Support',
    description: 'A timid juvenile that rarely pursues directly and instead hides in the current while calling allies into the fight.',
    lore: {
      scientificReference: 'Juvenile seahorse (genus Hippocampus), referenced for its upright body, curled tail, and tubular snout.',
      identification: 'Oversized head, short body, curled tail, and a sound-wave organ above the head.',
      visualSetting: 'A small, timid stone seahorse. Cyan cracks gather around the throat and crown; sound rings are an external effect, not an added weapon.',
    },
    attacks: { callForHelp: ['Rescue Call', 'Stops in place and broadcasts a distress signal. If the cast completes, one Tier 2 reinforcement arrives nearby; interrupt it to prevent the battle line from expanding.'] },
  },
  crabGuard: {
    name: 'Crab Guard', role: 'Melee defender',
    description: 'A heavily armored crab that blocks narrow waterways and seals short routes with its oversized claws.',
    lore: {
      scientificReference: 'True crabs (infraorder Brachyura), referenced for a broad shell, sideways gait, and paired claws.',
      identification: 'Broad carapace, oversized claws, low center of mass, and six-legged lateral movement.',
      visualSetting: 'A shield-like stone carapace with claws that dominate the silhouette. Prioritize readable animal anatomy over decoration; do not turn it into a humanoid soldier.',
    },
    attacks: {
      clawSwipe: ['Great-Claw Sweep', 'Sweeps a short frontal arc with a massive claw to punish targets that stay too close.'],
      dashClamp: ['Dash Clamp', 'Locks a direction, then dashes into a clamping strike with more reach than the normal swipe. Change depth when its wind-up appears.'],
    },
  },
  lobsterSoldier: {
    name: 'Lobster Soldier', role: 'Melee / ranged hybrid',
    description: 'A tide-cavern combatant that switches quickly between long-claw strikes and thrown coral spikes.',
    lore: {
      scientificReference: 'Clawed lobsters (family Nephropidae), referenced for long claws, a segmented abdomen, and antennae.',
      identification: 'Long claws, segmented body, long antennae, and a heavy dorsal shell.',
      visualSetting: 'A tall stone lobster with animal proportions through the claws and abdomen. The coral spear is a combat prop, not a reason to humanize the body.',
    },
    attacks: {
      longClawStab: ['Long-Claw Thrust', 'Extends a long claw in a fixed forward stab with more reach than a standard melee attack.'],
      spearThrow: ['Coral Spear Throw', 'Throws a coral spear along a straight flight path to maintain pressure at range.'],
    },
  },
  lionfishGunner: {
    name: 'Lionfish Gunner', role: 'Ranged suppressor',
    description: 'A lionfish that treats its venomous spines as ammunition, marking distant targets and scattering shots around cover.',
    lore: {
      scientificReference: 'Lionfish (genus Pterois), referenced for fan-like venomous spines and its open-mouth hunting posture.',
      identification: 'Radiating dorsal fins, fan-shaped spines, broad mouth, and a stationary charging pose.',
      visualSetting: 'Keep the body unmistakably fish-like and the spines readable as a broad fan. Shots originate from the mouth and spines; add no human firearm.',
    },
    attacks: {
      venomStraightShot: ['Venom Spine Shot', 'Fires one venomous spine that applies poison on hit, turning a brief graze into a lingering risk.'],
      spineScatter: ['Spine Scatter', 'Fires five spines across a fan to close several dodge routes at once.'],
    },
  },
  squidAssassin: {
    name: 'Squid Assassin', role: 'Ambusher',
    description: 'A squid that disappears into ink, waits for an opening, then teleports into a slash or finishes the target with an ink shot.',
    lore: {
      scientificReference: 'Squid (order Teuthida), referenced for a streamlined mantle, arms, jet propulsion, and an ink sac.',
      identification: 'Long body, grouped arms, dark ink cloud, and abrupt position changes.',
      visualSetting: 'Lead with a cephalopod silhouette and clearly grouped arms. Concealment comes from ink and disappearance, not humanoid assassin clothing.',
    },
    attacks: {
      inkShadowSlash: ['Ink-Shadow Blink Slash', 'Briefly charges in ink, then teleports near the target and slashes, often entering from a visual blind spot.'],
      inkGunSnipe: ['Ink Snipe', 'Shows a short aiming tell before firing a very fast straight ink projectile.'],
    },
  },
  splitLanternfish: {
    name: 'Fission Lanternfish', role: 'Splitting suicide attacker',
    description: 'An even less stable lanternfish whose death divides one threat into two pursuing offspring.',
    lore: {
      scientificReference: 'Lanternfish (family Myctophidae), an uncontrolled fission form that retains the same fish body and photophores.',
      identification: 'Cracked body, exposed cyan core, smaller post-split forms, and rapidly increasing numbers.',
      visualSetting: 'The stone body appears split from within, with cracks along the belly and lateral line. Every stage must remain a lanternfish, not an abstract energy orb.',
    },
    attacks: {
      splitRush: ['Fission Rush', 'Charges the target in a fast straight line and deals explosive contact damage.'],
      splitOnDeath: ['Death Fission', 'Splits into two juveniles on death; each continues pursuing and carries a smaller explosion.'],
    },
  },
  coralBackSeahorse: {
    name: 'Coralback Seahorse', role: 'Linked support',
    description: 'An adult seahorse carrying a living coral colony that shares vitality with nearby allies until its support network is severed.',
    lore: {
      scientificReference: 'Adult seahorse (genus Hippocampus), referenced for its upright body, curled tail, bony rings, and male brood pouch.',
      identification: 'Thick curled tail, adult seahorse head, coral growth across the back, and a brood area carrying juveniles.',
      visualSetting: 'It remains a seahorse, not a humanoid caretaker. Coral covers the stone body, the tail is thicker, juveniles cling to the back, and low-frequency resonance appears as energy links.',
    },
    attacks: {
      lifeLink: ['Life Link', 'Links its health to a nearby ally, healing it continuously and temporarily preventing the linked target from being destroyed directly.'],
      coralPulse: ['Coral Pulse', 'Emits a pulse that heals nearby allies and briefly protects them.'],
    },
  },
  mantisShrimpBrute: {
    name: 'Mantis Shrimp Warlord', role: 'Melee elite',
    description: 'A shockwave-producing bruiser whose striking claws dominate close range while beacons turn safe distance into an ambush point.',
    lore: {
      scientificReference: 'Mantis shrimp (order Stomatopoda), referenced for folded raptorial appendages, segmented armor, and explosive strikes.',
      identification: 'Massive striking claws, segmented body, low stance, and a tail built for sudden leaps.',
      visualSetting: 'A heavy stone mantis shrimp whose striking claws are the main focus. Preserve its many legs and shell rhythm rather than replacing them with humanoid armor.',
    },
    attacks: {
      punch: ['Charged Claw Punch', 'Charges, then delivers a heavy close-range punch that knocks the player away from a safe position.'],
      groundSmash: ['Seabed Smash', 'Slams the seabed to create a large damaging shockwave and brief stun. The wind-up is long but the coverage is broad.'],
      beaconAssault: ['Beacon Assault', 'Teleports to a marked beacon for a melee ambush, preventing distance alone from solving the encounter.'],
    },
  },
  nautilusOracle: {
    name: 'Nautilus Oracle', role: 'Ranged elite',
    description: 'A keeper of ancient coral relics that controls safe distance with twin-core magic and arcing coral mortars.',
    lore: {
      scientificReference: 'Nautilus (genus Nautilus), referenced for its coiled external shell, tentacles, and jet propulsion.',
      identification: 'Large spiral shell, frontal tentacles, relic at the shell opening, and a slow hovering artillery posture.',
      visualSetting: 'Oracle describes its combat role, not human clothing. The shell and tentacles remain primary; the coral relic and twin cores extend from the shell opening.',
    },
    attacks: {
      shortThrust: ['Short Relic Thrust', 'Uses the front of its relic for a short defensive stab when approached.'],
      coralMortar: ['Coral Mortar', 'Lobs a coral shell that explodes after a delay and can arc over straight cover.'],
      dualCoreMagic: ['Twin-Core Magic', 'Launches two core projectiles whose overlapping paths compress the available dodge space.'],
    },
  },
  arcTideRay: {
    name: 'Arc-Tide Hunting Ray', role: 'Anti-cover artillery',
    description: 'A hunting ray that reads tidal arcs and places projectiles where the player expected cover to remain safe.',
    lore: {
      scientificReference: 'Rays (superorder Batoidea), referenced for a flat wing-like body, broad pectoral fins, and tail propulsion.',
      identification: 'Wide flat silhouette, arcing pectoral fins, tail stabilizer, and curved stone plates across the back.',
      visualSetting: 'Keep the ray\'s flat body and wing silhouette. The back plates act like a living catapult whose flow lines clarify arcing attacks; do not make it a humanoid turret.',
    },
    attacks: {
      wingRam: ['Wing-Blade Ram', 'Rams a nearby target with a small collision radius and a short cooldown.'],
      arcTideBombardment: ['Arc-Tide Bombardment', 'Lobs a tidal projectile that warns before exploding and can bypass some cover.'],
    },
  },
  mutantMantisShrimp: {
    name: 'Mutant Mantis Shrimp Warlord', role: 'Mutant melee elite',
    description: 'A pressure-mutated warlord with faster claws and beacons that force the player into dangerous pressure zones.',
    lore: {
      scientificReference: 'Mantis shrimp (order Stomatopoda), derived from the Level 3 Mantis Shrimp Warlord.',
      identification: 'The striking claws, segmented shell, and many-legged silhouette remain; black abyssal crystals erupt from the shoulders, claws, and back.',
      visualSetting: 'The same animal in an uncontrolled mutation: split armor, leaking cyan energy, and clearly directed claw and afterimage attacks.',
    },
    attacks: {
      mutantPunch: ['Mutant Charged Punch', 'Tracks the player before striking with a shorter wind-up and wider reach.'],
      mutantGroundSmash: ['Empowered Seabed Smash', 'Creates a larger pressure field with a longer stun.'],
      mutantBeaconAssault: ['Empowered Beacon Assault', 'Completes its beacon teleport faster, making the former safe distance unreliable.'],
    },
  },
  mutantNautilusOracle: {
    name: 'Mutant Nautilus Oracle', role: 'Stationary ranged elite',
    description: 'An overloaded oracle that breaks its relic core into a persistent barrage, leaving almost no quiet interval.',
    lore: {
      scientificReference: 'Nautilus (genus Nautilus), derived from the Level 3 Nautilus Oracle.',
      identification: 'The spiral shell and tentacles remain primary; the shell is split and two persistent cores sit beside its opening.',
      visualSetting: 'Mutation stays in the shell and relic system, without a human face or robe. Orbiting energy trails express its full-circle scatter and persistent cores.',
    },
    attacks: {
      mutantCoralMortar: ['Empowered Coral Mortar', 'Explodes sooner across a larger radius, dividing cover into smaller unsafe pockets.'],
      mutantDualCoreMagic: ['Empowered Twin-Core Magic', 'Accelerates both cores so their paths overlap sooner.'],
      persistentCoreVolley: ['Persistent Core Volley', 'Maintains a long-lived core projectile that cannot be ignored as the battle moves.'],
    },
  },
  mutantArcTideRay: {
    name: 'Mutant Arc-Tide Hunting Ray', role: 'Mutant anti-cover artillery',
    description: 'A mutant ray whose blade and pressure shots leave delayed aftershocks, demanding sustained movement around every landing point.',
    lore: {
      scientificReference: 'Rays (superorder Batoidea), derived from the Level 3 Arc-Tide Hunting Ray.',
      identification: 'The flat wing-like body and curved plates remain; the plates crack while pressure marks form below the body and along the tail.',
      visualSetting: 'The animal silhouette stays primary. Mutation concentrates in the dorsal plates, tail stabilizer, and pressure energy; do not turn it into a floating gunship.',
    },
    attacks: {
      mutantWingRam: ['Empowered Wing-Blade Ram', 'Leaves a pressure blade after contact, so evading the first hit does not make an immediate return safe.'],
      mutantArcTideBombardment: ['Empowered Arc-Tide Bombardment', 'Adds a delayed pressure burst after impact, requiring continued movement around the landing zone.'],
    },
  },
  prismCrabGuardian: {
    name: 'Prism Crab Guardian', role: 'Area-control Mini Boss',
    description: 'A giant crab that gathers reinforcements, refracts lasers, and rewrites movement with gravity fields.',
    lore: {
      scientificReference: 'Large deep-sea crabs, especially spider crabs, referenced for a broad shell, long legs, and a low defensive stance.',
      identification: 'Huge paired claws, heavy back shell, dorsal laser prism, and a turret-like defensive posture.',
      visualSetting: 'A giant crab fully covered in ancient stone armor, not a person in heavy armor. The prism is fixed at the shell center, the claws guard both sides, and gravity orbs emerge beneath the carapace like abyssal organs.',
    },
    passive: 'Deep-Sea Carapace',
    attacks: {
      tidalGathering: ['Tidal Gathering', 'Summons tidal reinforcements while draining oxygen and energy, forcing the gathering node to become a priority.'],
      refractedLaser: ['Refracted Laser', 'Fires a beam that reflects through the arena; prolonged exposure stacks severe damage.'],
      deepSeaGravityField: ['Deep-Sea Gravity Field', 'Creates a targeted field that amplifies gravity and briefly controls the player.'],
    },
  },
  tideLawNautilus: {
    name: 'Tide-Law Nautilus', role: 'Pattern-control Mini Boss',
    description: 'A nautilus that treats the arena as editable law, cycling shield phases and tidal rules that repeatedly change combat conditions.',
    lore: {
      scientificReference: 'Large nautilus (genus Nautilus), referenced for its chambered spiral shell, tentacles, and jet propulsion.',
      identification: 'Huge intact spiral shell, tentacles at the shell opening, tidal orbs, and rule rings centered on the shell.',
      visualSetting: 'Oracle is a combat function, not a robe or human face. A translucent tide layer wraps the shell, while returning buckshot is visibly drawn back into its opening by current.',
    },
    passive: 'Tidal Shield',
    attacks: {
      deepSeaSummoning: ['Deep-Sea Summoning', 'Calls four abyssal reinforcements, turning a single-target encounter into a formation-clearing problem.'],
      returningBuckshot: ['Returning Buckshot', 'Fires a spread that reverses course, requiring attention to the return path after the first dodge.'],
      tidalLaw: ['Tidal Law', 'Temporarily changes the arena rule by reversing gravity, reducing it, or shifting horizontal current.'],
    },
  },
  mutantPrismCrabGuardian: {
    name: 'Mutant Prism Crab Guardian', role: 'Laser aftermath control',
    description: 'A mutant guardian that splits lasers and reflects ranged attacks while destructible gravity orbs become the immediate field threat.',
    lore: {
      scientificReference: 'Large deep-sea crab, retaining the original Prism Crab Guardian anatomy.',
      identification: 'Split carapace, divided prism, crossing secondary lasers, and gravity orbs transformed from invulnerable cores into destructible targets.',
      visualSetting: 'Preserve the broad shell, paired claws, and many-legged crab outline. Mutation remains in the dorsal prism and shell cracks without introducing humanoid proportions.',
    },
    passive: 'Empowered Deep-Sea Carapace',
    attacks: {
      mutantTidalGathering: ['Empowered Tidal Gathering', 'Calls a larger, faster reinforcement wave and cycles sooner while low-level summons survive.'],
      mutantRefractedLaser: ['Empowered Refracted Laser', 'Splits into secondary beams, rapidly erasing safe angles as the paths reflect.'],
      mutantGravityField: ['Empowered Gravity Field', 'Deploys a destructible gravity orb. The orb is briefly invulnerable, then must be destroyed to dismantle its field.'],
    },
  },
  mutantTideLawNautilus: {
    name: 'Mutant Tide-Law Nautilus', role: 'Shield and rule control',
    description: 'A mutant nautilus that overlaps tidal laws while its shield and returning spread punish repeated positioning errors.',
    lore: {
      scientificReference: 'Large nautilus, retaining the Tide-Law Nautilus spiral shell and tentacle anatomy.',
      identification: 'Cracked spiral shell, overgrown shields, buckshot condensed into an outer barrier, and two tidal laws running at once.',
      visualSetting: 'The shell appears pulled apart by opposing currents. Layered shields follow its chambers, while two counter-rotating energy rings express overlapping laws.',
    },
    passive: 'Empowered Tidal Shield',
    attacks: {
      mutantDeepSeaSummoning: ['Empowered Deep-Sea Summoning', 'Summons again while prior reinforcements remain alive, creating a population-control loop.'],
      mutantReturningBuckshot: ['Empowered Returning Buckshot', 'Returns faster and can block some player projectiles.'],
      lawOverlap: ['Law Overlap', 'Runs two tidal laws at once, changing gravity and current together for a short interval.'],
    },
  },
  abyssalSpermWhale: {
    name: 'Abyssal Sperm Whale', role: 'Final battlefield controller',
    description: 'The controller of an entire abyssal arena, summoning, rebuilding, altering gravity, and corrupting oxygen until every pocket of space must be managed.',
    lore: {
      scientificReference: 'Sperm whale (Physeter macrocephalus), referenced for deep diving, a massive square forehead, pressure tolerance, lower jaw, and echolocation.',
      identification: 'Huge square forehead, long heavy body, powerful tail flukes, visible blowhole, and ancient ruins arranged along the back.',
      visualSetting: 'A deep-sea organism carrying mobile ruins, not a crowned humanoid Boss. The forehead controls gravity and echoes, the back resembles a sunken temple, the blowhole releases corrupted oxygen mist, and the small form retains its whale anatomy.',
    },
    passive: 'Abyss Awakening',
    attacks: {
      abyssalSummoning: ['Abyssal Summoning', 'Summons deep-sea creatures, heals by sacrificing them, and raises the strength of later attacks with each sacrifice.'],
      ancientReconstruction: ['Ancient Reconstruction', 'Rebuilds arena ruins, heals over time, and turns former routes back into obstacles.'],
      abyssEcho: ['Abyss Echo', 'Creates an abyssal avatar that fires a three-shot barrage and absorbs some incoming fire.'],
      miniatureForm: ['Abyssal Juvenile Form', 'Temporarily becomes a fast juvenile with quicker movement and skill cycles, but also takes more damage.'],
      gravityDominion: ['Gravity Dominion', 'Shifts the gravity law of the whole arena deeper, changing every player launch route.'],
      corruptedOxygen: ['Corrupted Oxygen', 'Corrupts an oxygen bubble and detonates it after a delay; the remaining zone continuously drains oxygen.'],
    },
  },
});

const MAP_EN = Object.freeze({
  water: ['Terrain', 'Traversable Water', 'The base hex space where the character can move, launch, and read local water gravity.', [['Placement', 'Whole-cell terrain'], ['Gameplay', 'Provides navigable space and carries gravity, objects, edges, and actors.']]],
  blocked: ['Terrain', 'Blocked Area', 'A dark hex that cannot be entered. It also anchors edge barriers and multi-edge portals.', [['Placement', 'Whole-cell terrain'], ['Gameplay', 'Cuts routes and shapes narrow passages or portal boundaries.']]],
  'L-1': ['Water Gravity', 'L-1 Upward Water', 'Applies 1.0G upward, supporting ascent routes and return-path pressure.', [['Placement', 'Whole-cell water rule'], ['Physics', '1.0G upward while preserving inertia.']]],
  L0: ['Water Gravity', 'L0 Neutral Water', 'Applies no vertical acceleration so the player keeps inertia and can plan the next launch.', [['Placement', 'Whole-cell water rule'], ['Physics', '0G vertical acceleration; velocity is preserved.']]],
  L1: ['Water Gravity', 'L1 Standard Water', 'The baseline water rule, applying 1.0G downward for learning gravity and launch rhythm.', [['Placement', 'Whole-cell water rule'], ['Physics', '1.0G downward.']]],
  L2: ['Water Gravity', 'L2 Deep Transition', 'A higher-pressure transition zone that makes the player sink faster than standard water.', [['Placement', 'Whole-cell water rule'], ['Physics', '1.5G downward.']]],
  L3: ['Water Gravity', 'L3 Abyssal Water', 'The strongest sinking water, sharply reducing reaction time and route options.', [['Placement', 'Whole-cell water rule'], ['Physics', '2.0G downward.']]],
  conditionalGate: ['Water Gravity', 'Conditional Water Gate', 'A closed L1 water cell whose chain unlocks after its assigned button is triggered.', [['Placement', 'Whole-cell water rule'], ['Gameplay', 'Button-controlled; one button may open several assigned gates.']]],
  T1: ['Water Layer', 'T1 Water Layer', 'The primary water layer for ordinary routes and the first chapter\'s main space.', [['Placement', 'Whole-cell water layer'], ['Gameplay', 'Actors move here and can change layers through a layer portal.']]],
  T2: ['Water Layer', 'T2 Water Layer', 'A second stateful route over the same spatial area as T1.', [['Placement', 'Whole-cell water layer'], ['Gameplay', 'Entered through layer portals to support two-layer navigation puzzles.']]],
  ink: ['Cell Environment', 'Ink Zone', 'Hides the surrounding space and leaves only a small visible radius around the player.', [['Placement', 'Freely positioned cell overlay'], ['Gameplay', 'Restricts vision without directly changing gravity or collision.']]],
  coralCluster: ['Cell / Edge Object', 'Coral Colony', 'A stone coral colony that can mark a low-pressure refuge where enemies below Mini Boss rank stop pursuing.', [['Placement', 'Legacy maps use a cell object; new layouts prefer edge attachment.'], ['Gameplay', 'Creates a refuge and landmark; scale is adjustable and has no separate combat values yet.']]],
  mine: ['Cell Object', 'Deep-Sea Mine', 'A pressure explosive that deals extra collision damage and strongly rebounds the character.', [['Placement', 'Cell object, free-snap or centered'], ['Gameplay', 'Turns a collision route into a high-risk choice.']]],
  weightStone: ['Cell Object', 'Weight Stone', 'A massive stone that falls naturally and can push weak upward impacts back down.', [['Placement', 'Cell object, free-snap or centered'], ['Gameplay', 'High-speed impacts can break it, rewarding managed speed and angle.']]],
  seaweed: ['Cell / Edge Object', 'Seaweed', 'A flexible organism the player can hold onto, temporarily ignoring water gravity while energy recovers.', [['Placement', 'Legacy maps use a cell object; new layouts prefer edge attachment.'], ['Gameplay', 'Provides a short stop for recovery and re-aiming.']]],
  oxygen: ['Cell Object', 'Oxygen-Bearing Ore', 'A dark mineral with limited oxygen that must be opened by a high-speed collision, usually off the safe route.', [['Placement', 'Cell object, free-snap or centered'], ['Gameplay', 'Binds oxygen supply to risky body impact.']]],
  checkpoint: ['Cell Object', 'Checkpoint', 'Updates the return point and restores health, oxygen, and energy when touched.', [['Placement', 'Cell object, free-snap or centered'], ['Gameplay', 'Updates respawn resources without adding permanent lives.']]],
  bubble: ['Cell Object', 'Photosynthetic Bubble', 'Temporarily carries the player with inertia while ignoring gravity; its freedom can also cause an uncontrolled fall.', [['Placement', 'Cell object, free-snap or centered'], ['Gameplay', 'Crosses pressure zones quickly but demands a planned exit.']]],
  torricelli: ['Cell Object', 'Torricelli Space', 'A temporary oxygenated island that offers supply and breathing room, often placed on a risky detour.', [['Placement', 'Cell object, free-snap or centered'], ['Gameplay', 'Trades limited safe time for oxygen recovery.']]],
  razor: ['Cell Object', 'Razor Axis', 'A set of deep-sea blades rotating around a central axis that damage and forcefully repel on contact.', [['Placement', 'Cell object, free-snap or centered'], ['Gameplay', 'Supports one to four blades for rotating hazards and narrow timing gaps.']]],
  button: ['Cell Object', 'One-Shot Gate Button', 'Triggers once to open the conditional gates assigned in the Inspector.', [['Placement', 'Cell object, free-snap or centered'], ['Gameplay', 'Encodes exploration order, backtracking, and multi-gate chains.']]],
  springJelly: ['Edge Interaction', 'Spring Jellyfish', 'A reflective organism fixed to a shared cell edge, bouncing the character at an equal incidence and reflection angle.', [['Placement', 'Edge snap'], ['Gameplay', 'Turns impact into a predictable route jump, often along blocked boundaries.']]],
  spike: ['Edge Interaction', 'Spike', 'A sharp edge-mounted obstacle that blocks passage and deals contact damage.', [['Placement', 'Edge snap'], ['Gameplay', 'Seals one edge and forces a different launch angle.']]],
  barrier: ['Edge Interaction', 'Barrier', 'An impassable boundary that currently shares spike art but does not necessarily deal damage.', [['Placement', 'Edge snap'], ['Gameplay', 'Builds walls, narrow openings, and route boundaries.']]],
  current: ['Edge Interaction', 'Current', 'Applies horizontal force along a shared edge; direction and strength are Inspector settings.', [['Placement', 'Edge snap'], ['Gameplay', 'Acts like horizontal gravity to alter landing points and movement rhythm.']]],
  layerPortal: ['Edge Interaction', 'Layer Portal', 'Can only occupy a shared edge between adjacent T1 and T2 cells; crossing switches water layers.', [['Placement', 'Adjacent T1 / T2 edge'], ['Gameplay', 'Lets both layers share a position while keeping separate state.']]],
  multiPortal: ['Edge Interaction', 'Multi-Edge Portal', 'Runs along one full side of a blocked hex and maps each completed segment one-to-one to a paired endpoint.', [['Placement', 'Consecutive edges beside a blocked cell'], ['Gameplay', 'Creates a broad linked transfer route and activates only after pairing is complete.']]],
});

const WEAPON_EN = Object.freeze({
  knife: ['Knife', 'Melee', 'The fixed starting weapon that permanently occupies the first weapon slot.', 'Turns the player\'s movement path into a piercing cut, binding launch angle to close-range damage.', ['The movement path deals piercing damage.', 'Adds two side trails that deal 70% of the main trail\'s damage.', 'While stationary, continuously damages enemies within range.']],
  katana: ['Katana', 'Melee', 'A sustained melee weapon that automatically handles nearby enemies.', 'Swings clockwise around the player with directional afterimages. At Level 3 it also launches a projectile-clearing blade wave.', ['Automatically slashes every nearby enemy; longer contact produces more hits.', 'After each completed movement, the next slash deals double damage.', 'Each slash launches a large blade wave that destroys enemy projectiles.']],
  trident: ['Trident', 'Projectile', 'A high-damage single-shot weapon that requires a stable aim.', 'Best used to read enemy tells at medium to long range, with movement making a hit harder to secure.', ['Fires one high-damage projectile only while stationary.', 'A hit stuns the target, stopping movement and attacks.', 'A successful hit shortens the next cooldown.']],
  lightMachineGun: ['Light Machine Gun', 'Projectile', 'A sustained ranged weapon that converts a locked firing line into suppression.', 'Fires six shots along one locked direction, trading immediate retargeting for a committed burst.', ['Fires a six-shot burst with its direction locked until the burst ends.', 'The last three shots gain a distinct outline while retaining normal damage.', 'All six shots use distinct prismatic colors; no bonus explosion is added.']],
});

const PASSIVE_EN = Object.freeze({
  oxygenCirculator: ['Oxygen Circulator', 'Oxygen drain, resupply, and long-distance exploration.', 'Supports longer detours without removing oxygen management.', ['Reduces oxygen drain from launching and movement by 10%.', 'Increases maximum oxygen by 20%.', 'Retains prior effects; at low oxygen, also reduces energy costs and incoming damage.']],
  pressureStabilizer: ['Tidal Pressure Stabilizer', 'Aiming, launching, and energy rhythm.', 'Turns defeats into sustained output for weapons that depend on a managed firing rhythm.', ['Reduces energy spent on aiming and firing by 10%.', 'Reduces costs by 20% and restores 5% maximum energy per defeat.', 'Reduces costs by 30% and restores 8% maximum energy plus 4% maximum oxygen per defeat.']],
  ecologicalCarapace: ['Ecological Carapace', 'Ranged tolerance, resource-to-health recovery, and Boss survival.', 'Adds tolerance to ranged combat and resource management without adding permanent lives.', ['Reduces ranged damage taken by 20%.', 'A heavy single hit grants a two-second ecological shield with an eight-second cooldown.', 'Retains prior effects; recovering oxygen or energy also restores some health.']],
  abyssalAmplifier: ['Abyssal Amplifier', 'Pure weapon output and high-pressure clearing.', 'Trades safety for faster clearing, with the final level rewarding high oxygen.', ['Increases all weapon damage by 10%.', 'Increases all weapon damage by 20%.', 'Increases all weapon damage by 30%, plus another 15% at high oxygen.']],
});

const SKILL_TYPE_EN = Object.freeze({
  areaStun: 'Area stun', boomerangSpread: 'Returning spread', cloneBarrage: 'Clone barrage', contact: 'Contact attack', corruptOxygen: 'Oxygen corruption', dash: 'Dash attack', destroyableGravityOrb: 'Destructible gravity orb', gravityField: 'Gravity field', gravityRule: 'Global gravity rule', link: 'Life link', lobbed: 'Arcing projectile', melee: 'Melee attack', projectile: 'Projectile', rebuildArena: 'Arena reconstruction', reflectedBeam: 'Reflected beam', reflectedBeamSplit: 'Split reflected beam', repeatSummon: 'Repeating summon', ruleChange: 'Rule change', ruleCombination: 'Combined rules', sacrificeSummon: 'Sacrificial summon', shieldBoomerang: 'Shielding boomerang', speedForm: 'Speed form', split: 'On-death split', spread: 'Spread projectile', suicideCharge: 'Locked-point detonation', summon: 'Summon', summonResourceDrain: 'Summon and resource drain', summonWave: 'Summon wave', supportPulse: 'Support pulse', teleportMelee: 'Teleport melee',
});

export const ENGLISH_ATTACK_VALUE_LABELS = Object.freeze({
  aftermathDamage: 'Aftershock damage', aftermathDelay: 'Aftershock delay', aftermathRadius: 'Aftershock radius', applies: 'Applies', blocksPlayerProjectiles: 'Blocks player projectiles', bubbleLifetime: 'Bubble lifetime', castTime: 'Cast time', childCount: 'Offspring count', childExplosionDamage: 'Offspring blast damage', childExplosionRadius: 'Offspring blast radius', childHealth: 'Offspring health', childSpeed: 'Offspring speed', cloneHealthRatio: 'Clone health', combinations: 'Rule combinations', cooldown: 'Cooldown', cooldownMultiplier: 'Cooldown multiplier', cooldownReductionIfLv1Alive: 'Cooldown reduction with Level 1 summon alive', damage: 'Damage', damagePerSecond: 'Damage per second', damageStackPerSacrifice: 'Damage gained per sacrifice', damageTakenMultiplier: 'Damage taken multiplier', detonationDelay: 'Detonation delay', duration: 'Duration', energyDrain: 'Energy drain', explosionRadius: 'Explosion radius', gravityLevelShift: 'Gravity level shift', gravityModes: 'Gravity modes', gravityMultiplier: 'Gravity multiplier', healPerSecondRatio: 'Healing per second', healRatio: 'Healing', healRatioPerSacrifice: 'Healing per sacrifice', ignoresCover: 'Ignores cover', inkDuration: 'Ink duration', linkRange: 'Link range', linkedInvulnerable: 'Linked target invulnerable', locksTargetAtCast: 'Locks target at cast', maxReflections: 'Maximum reflections', moveSpeedMultiplier: 'Move-speed multiplier', orbHealth: 'Orb health', orbInvulnerableDuration: 'Orb invulnerability', oxygenDrain: 'Oxygen drain', oxygenZoneDuration: 'Oxygen-zone duration', persistent: 'Persistent', projectileCount: 'Projectile count', projectileSpeed: 'Projectile speed', radius: 'Radius', range: 'Range', repeatWhenSummonsAlive: 'Repeats while summons live', rerollInterval: 'Rule reroll interval', returnDelay: 'Return delay', secondaryBeamCount: 'Secondary beams', secondaryMaxReflections: 'Secondary reflections', shieldHealth: 'Shield health', sludgeDuration: 'Sludge duration', spreadDegrees: 'Spread angle', stun: 'Stun', summonCount: 'Summon count', summonRadius: 'Summon radius', summonSpeedMultiplier: 'Summon speed multiplier', telegraph: 'Telegraph',
});

export const ENGLISH_ENTRY_VALUE_LABELS = Object.freeze({
  aimEnergyCostMultiplier: 'Aim energy cost', burstCount: 'Burst size', burstInterval: 'Burst interval', cooldown: 'Cooldown', damage: 'Damage', damageMultiplier: 'Weapon damage', energyCost: 'Energy cost', highOxygenDamageMultiplier: 'High-oxygen damage', hitArcDegrees: 'Hit arc', killEnergyRecoveryRatio: 'Energy restored per defeat', killOxygenRecoveryRatio: 'Oxygen restored per defeat', launchEnergyCostMultiplier: 'Launch energy cost', lowOxygenDamageTakenMultiplier: 'Low-oxygen damage taken', lowOxygenEnergyCostMultiplier: 'Low-oxygen energy cost', maxOxygenMultiplier: 'Maximum oxygen', oxygenDrainMultiplier: 'Oxygen drain', projectileCount: 'Projectile count', projectileSpeed: 'Projectile speed', range: 'Range', rangedDamageTakenMultiplier: 'Ranged damage taken', resourceRecoveryHealthRatio: 'Resource-to-health recovery', shieldCooldown: 'Shield cooldown', shieldDuration: 'Shield duration', shieldThresholdRatio: 'Shield trigger threshold', weaponEnergyCostMultiplier: 'Weapon energy cost',
});

const UI_EN = Object.freeze({
  pageTitle: 'Thirst for Oxygen — World Field Guide', heading: 'World Field Guide', lede: 'Learn the game language of this abyss, from enemies and map elements to weapons and passive abilities.',
  navHome: 'Return to Command Console', navPlay: 'Play Map', navEditor: 'Return to Map Editor', navSandbox: 'Open Enemy Sandbox',
  guideLabel: 'Field guide instructions', guideTitle: 'One complete reference', guideBody: 'Enemy entries include natural drift, skill demonstrations, and Lore files. Map elements, weapons, and passives use the same card system for role, gameplay purpose, and level changes. Numeric values remain sourced from the game-data module.',
  afterimageLabel: 'Afterimage demonstration controls', afterimageToggle: 'Enable authored afterimages', afterimageHint: 'A single clean animation is shown by default; enable this to composite prior frames.', afterimageFrames: 'frames', afterimageOffset: 'offset per frame',
  sectionNavLabel: 'Field guide categories', tierNavLabel: 'Enemy level filters',
  all: 'All', tierDescriptions: { all: 'All enemies and Bosses', 1: 'Introductory creatures', 2: 'Core enemies', 3: 'Special enemies and elites', 4: 'Mutant elites', miniBoss: 'Large creature archetypes', mutatedMiniBoss: 'Mutated large archetypes', finalBoss: 'Final battlefield controller' },
  sections: { enemies: ['Enemies / Bosses', 'Creature reference, visual identity, and combat skill demonstrations.'], map: ['Map Elements', '29 placement entries and 27 unique elements, covering cells, gravity, water layers, and edges.'], weapons: ['Weapons', 'Roles, level changes, and build identity for four weapons.'], passives: ['Passive Abilities', 'Survival, resource, and damage directions across four passive lines.'] },
  naturalDrift: 'Natural drift', authoredAfterimage: 'Authored afterimage', animationPending: 'Animation asset pending', noPreview: 'No GIF preview is currently available', valuesAvailable: 'animation asset pending; numeric values remain available', materialPending: 'asset pending',
  loreButton: 'Lore File', loreHeading: 'LORE / CREATURE FILE', loreSubheading: 'Visual and biological reference', scientificReference: 'Real-world reference', identification: 'Identification', visualSetting: 'Visual direction', loreNote: 'These references guide silhouette, anatomy, and movement. They are not requests for a literal copy of the real animal.',
  health: 'Health', moveSpeed: 'Move speed', skills: 'Skills', ecology: 'Ecology Notes',
  levelIcon: 'icon', weapon: 'Weapon', passive: 'Passive Ability', maximum: 'Max', role: 'Role', openSandbox: 'Open Verification Sandbox', yes: 'Yes', no: 'No', seconds: 's',
  weaponTypeLabels: { melee: 'Melee', projectile: 'Projectile' },
  skillTypeLabels: SKILL_TYPE_EN,
  tierLabels: Object.freeze({ all: 'All', ...TIER_EN }),
  attackValueLabels: ENGLISH_ATTACK_VALUE_LABELS,
  entryValueLabels: ENGLISH_ENTRY_VALUE_LABELS,
});

const UI_ZH = Object.freeze({
  pageTitle: 'Thirst for Oxygen — 世界圖鑑', heading: '世界圖鑑', lede: '從敵人、地圖元素到武器與被動能力，一次讀懂這片深海的遊戲語言。',
  navHome: '返回主控台', navPlay: '遊玩地圖', navEditor: '返回地圖編輯器', navSandbox: '開啟敵人沙盒',
  guideLabel: '圖鑑使用說明', guideTitle: '完整資料入口已整合', guideBody: '敵人分類保留自然漂浮、技能演示與 Lore 檔案；地圖元素、武器與被動能力則用同一套卡片列出正式定位、玩法作用與等級變化。數值資料仍以遊戲資料模組為準。',
  afterimageLabel: '殘影演示控制', afterimageToggle: '啟用正式殘影', afterimageHint: '預設顯示單一乾淨動畫；勾選後才以歷史幀疊合。', afterimageFrames: '幀', afterimageOffset: '每幀偏移',
  sectionNavLabel: '圖鑑分類', tierNavLabel: '敵人等級篩選', all: '全部', tierDescriptions: { all: '所有敵人與 Boss', 1: '教學型生物', 2: '核心小怪', 3: '特殊小怪與精英', 4: '變異精英', miniBoss: '大型生物原型', mutatedMiniBoss: '變異大型生物原型', finalBoss: '最終戰場控制者' },
  sections: { enemies: ['敵人／Boss', '生物原型、視覺識別與戰鬥技能演示。'], map: ['地圖元素', '29 種放置語彙、27 個唯一元素；從 Cell、重力、水域層到 Edge 的完整地圖語言。'], weapons: ['武器', '四把武器的定位、等級變化與建構角色。'], passives: ['被動能力', '四條能力線的生存、資源與輸出方向。'] },
  naturalDrift: '自然漂浮', authoredAfterimage: '正式殘影', animationPending: '動畫素材待補', noPreview: '目前沒有 GIF 預覽素材', valuesAvailable: '動畫素材待補，數值已可查閱', materialPending: '待素材',
  loreButton: 'Lore 檔案', loreHeading: 'LORE / 生物檔案', loreSubheading: '視覺與原型參考', scientificReference: '現實生物參考', identification: '識別特徵', visualSetting: '視覺設定', loreNote: '這些參考提供輪廓、部位與動作靈感，不代表現實生物的寫實複製。',
  health: '生命', moveSpeed: '移速', skills: '技能', ecology: '生態觀察', levelIcon: '圖示', weapon: '武器', passive: '被動能力', maximum: '最高', role: '定位', openSandbox: '前往驗收沙盒', yes: '是', no: '否', seconds: '秒', weaponTypeLabels: { melee: '近戰', projectile: '遠程投射' }, skillTypeLabels: {}, tierLabels: TIER_ZH, attackValueLabels: ZH_ATTACK_VALUE_LABELS,
  entryValueLabels: {
    damage: '傷害', range: '距離', cooldown: '冷卻', energyCost: '能量消耗', projectileSpeed: '投射速度', projectileCount: '投射物數量', spreadDegrees: '散射角度', hitArcDegrees: '命中弧度', burstCount: '連射數量', burstInterval: '連射間隔', maxOxygenMultiplier: '最大氧氣倍率', launchEnergyCostMultiplier: '噴射消耗倍率', weaponEnergyCostMultiplier: '武器消耗倍率', aimEnergyCostMultiplier: '瞄準消耗倍率', rangedDamageTakenMultiplier: '遠程受傷倍率', lowOxygenDamageTakenMultiplier: '低氧受傷倍率', lowOxygenEnergyCostMultiplier: '低氧能量消耗', oxygenDrainMultiplier: '氧氣消耗', damageMultiplier: '武器傷害倍率', highOxygenDamageMultiplier: '高氧傷害倍率', killEnergyRecoveryRatio: '擊殺能量回復', killOxygenRecoveryRatio: '擊殺氧氣回復', resourceRecoveryHealthRatio: '資源轉生命', shieldThresholdRatio: '護盾觸發比例', shieldDuration: '護盾時間', shieldCooldown: '護盾冷卻',
  },
});

function requireEnglish(table, id, kind) {
  const value = table[id];
  if (!value) throw new Error(`Missing English ${kind} translation: ${id}`);
  return value;
}

const cloneEnemyEnglish = (enemy) => {
  const text = requireEnglish(ENEMY_EN, enemy.id, 'enemy');
  return Object.freeze({
    ...enemy,
    name: text.name,
    role: text.role,
    tierLabel: TIER_EN[enemy.tier] ?? String(enemy.tier),
    description: text.description,
    lore: Object.freeze({ ...text.lore }),
    passive: enemy.passive ? Object.freeze({ ...enemy.passive, name: text.passive ?? enemy.passive.id }) : enemy.passive,
    attacks: Object.freeze(enemy.attacks.map((attack) => {
      const [name, description] = requireEnglish(text.attacks, attack.id, `attack for ${enemy.id}`);
      return Object.freeze({ ...attack, name, typeLabel: SKILL_TYPE_EN[attack.type] ?? attack.type, description });
    })),
  });
};

const mapPlacementEnglish = ({ placementKind, id }) => {
  if (placementKind === 'cell' && ['seaweed', 'coralCluster'].includes(id)) return 'Cell placement (legacy maps)';
  if (placementKind === 'edge' && ['seaweed', 'coralCluster'].includes(id)) return 'Edge attachment (new layouts)';
  return { terrain: 'Terrain', gravity: 'Water Gravity', layer: 'Water Layer', overlay: 'Cell Environment', cell: 'Cell Object', edge: 'Edge Interaction' }[placementKind] ?? placementKind;
};

const cloneMapEnglish = (entry) => {
  const [group, name, description, details] = requireEnglish(MAP_EN, entry.id, 'map entry');
  return Object.freeze({ ...entry, group, name, description, placement: mapPlacementEnglish(entry), details: Object.freeze(details.map((row) => Object.freeze([...row]))) });
};

const cloneBuildEnglish = (entry, table, kind) => {
  const [name, typeOrRole, roleOrDescription, descriptionOrLevels, maybeLevels] = requireEnglish(table, entry.id, kind);
  const isWeapon = kind === 'weapon';
  const levelSummaries = isWeapon ? maybeLevels : descriptionOrLevels;
  return Object.freeze({
    ...entry,
    name,
    ...(isWeapon ? { typeLabel: typeOrRole, role: roleOrDescription, description: descriptionOrLevels } : { role: typeOrRole, description: roleOrDescription }),
    levels: Object.freeze(entry.levels.map((level) => Object.freeze({ ...level, summary: requireEnglish(levelSummaries, level.level - 1, `${kind} level`) }))),
  });
};

const sectionData = (locale) => {
  const ui = locale === 'zh-Hant' ? UI_ZH : UI_EN;
  return Object.freeze(Object.entries(ui.sections).map(([id, [label, description]]) => Object.freeze({ id, label, description })));
};

export function normalizeEncyclopediaLocale(locale) {
  const normalized = String(locale ?? '').trim().replaceAll('_', '-').toLowerCase();
  if (normalized === 'zh' || normalized === 'zh-tw' || normalized === 'zh-hk' || normalized === 'zh-hant' || normalized.startsWith('zh-hant-')) return 'zh-Hant';
  return 'en';
}

export function getStoredEncyclopediaLocale(storage = undefined) {
  return normalizeEncyclopediaLocale(getLanguage(storage));
}

export function setStoredEncyclopediaLocale(locale, storage = undefined) {
  const normalized = normalizeEncyclopediaLocale(locale);
  return setLanguage(normalized, storage);
}

export function formatEncyclopediaValue(key, value, locale = DEFAULT_ENCYCLOPEDIA_LOCALE) {
  const normalized = normalizeEncyclopediaLocale(locale);
  const ui = normalized === 'zh-Hant' ? UI_ZH : UI_EN;
  if (typeof value === 'boolean') return value ? ui.yes : ui.no;
  if (Array.isArray(value)) return value.join(normalized === 'zh-Hant' ? '／' : ' / ');
  if (typeof value === 'number') return `${value}${TIME_VALUE_KEYS.has(key) ? ` ${ui.seconds}` : ''}`;
  return String(value);
}

export function getLocalizedEncyclopedia(locale = DEFAULT_ENCYCLOPEDIA_LOCALE) {
  const normalized = normalizeEncyclopediaLocale(locale);
  if (normalized === 'zh-Hant') {
    return Object.freeze({
      locale: normalized,
      ui: UI_ZH,
      sections: sectionData(normalized),
      enemies: ENEMY_ENCYCLOPEDIA,
      mapEntries: MAP_ENCYCLOPEDIA,
      weapons: WEAPON_ENCYCLOPEDIA,
      passives: PASSIVE_ENCYCLOPEDIA,
    });
  }
  return Object.freeze({
    locale: normalized,
    ui: UI_EN,
    sections: sectionData(normalized),
    enemies: Object.freeze(ENEMY_ENCYCLOPEDIA.map(cloneEnemyEnglish)),
    mapEntries: Object.freeze(MAP_ENCYCLOPEDIA.map(cloneMapEnglish)),
    weapons: Object.freeze(WEAPON_ENCYCLOPEDIA.map((entry) => cloneBuildEnglish(entry, WEAPON_EN, 'weapon'))),
    passives: Object.freeze(PASSIVE_ENCYCLOPEDIA.map((entry) => cloneBuildEnglish(entry, PASSIVE_EN, 'passive'))),
  });
}
