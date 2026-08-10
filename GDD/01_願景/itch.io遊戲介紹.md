# Thirst for Oxygen｜itch.io 遊戲介紹

本文件是 itch.io 對外介紹的獨立草稿。遊戲頁面的文字、主題對應與公開定位集中放在這裡，之後修改宣傳文案時不需要改動核心 GDD。

## English Store Description

**Dive into the deepest trench. Take the heart that made the ocean forget how to breathe. Then survive what you woke up.**

*Thirst for Oxygen* is a deep-sea physics action game about oxygen, responsibility, and the living things you choose not to destroy.

You are not a hero. You are an atoner: a human diver sent into the deepest trench to retrieve the **Abyss Core**, an alien meteorite that has been poisoning the ocean's life cycle for generations. Only living flesh can cross the Core's resonance boundary. Machines fail. Autonomous weapons go silent. You have to dive in yourself.

Use drag-to-launch movement to travel through changing water gravity, dangerous currents, ancient ruins, and a sea that is slowly losing its ability to breathe. Every launch spends resources. Every shortcut can become a trap. Every fight asks whether the reward is worth the oxygen it costs.

The descent is only half of the story.

When you pull the Abyss Core from the trench, the sealed wound beneath the ocean opens again. Pressure, contamination, mutations, and the awakened guardian turn your route home into an ascent through a collapsing world. The same places return in altered form: familiar, but no longer safe.

## Two ways to meet the deep

You can fight the creatures of the trench, collect experience, and shape a run-based weapon and ability build.

Or you can choose **Resonance**.

Resonance asks you to move close to danger and learn a creature's rhythm instead of killing it. When the connection is complete, the creature becomes a neutral companion. It stays in the world, stops attacking you, and grants a permanent Resonance Buff for the rest of the run.

This is where **BUDDY** lives.

Buddy is not a disposable sidekick or a second playable character. Buddy is the relationship between a human being and the ocean they once damaged. Each creature can be a threat, a resource, or a living connection—depending on what you choose to do.

When the descent becomes the ascent, your weapons do not define what remains. The bonds you cultivated do. The ocean remembers the lives you understood.

## Why DIVE matters

- Dive physically into a deep ocean governed by gravity, momentum, oxygen, and pressure.
- Dive into the origin of a world that is slowly suffocating.
- Dive into the consequences of taking the Core away.
- Dive close enough to another living thing to choose Resonance over destruction.

## Features

- Physics-based drag-to-launch movement in shifting underwater gravity.
- Oxygen and stamina management where movement is also a survival decision.
- A run-based weapon and ability build shaped by the enemies you defeat—or spare.
- Resonance: neutralize living enemies instead of killing them and earn permanent run buffs.
- A two-part journey: descend to retrieve the Abyss Core, then ascend through the aftermath.
- Familiar environments transformed by ecological collapse rather than simple numerical difficulty.
- Boss encounters that control the battlefield through summons, terrain, gravity, oxygen, and chain reactions.

## How to Play

The current prototype is designed to be played with the mouse.

1. **Click and hold the diver.**
2. **Drag to aim.** The direction sets your launch direction, and the drag distance sets your launch strength.
3. **Release to launch.** Water gravity, currents, collisions, and special areas will take over your movement.
4. **Watch your oxygen and energy.** Find oxygen sources, plan your route, and avoid spending more resources than the next safe passage allows.
5. **Fight or move around enemies.** Your movement is also part of your attack, but not every creature has to die.
6. **Choose Resonance when you want a different relationship.** Move close to a living enemy, learn its rhythm, and neutralize it instead of killing it to earn a permanent buff for the current run.
7. **Reach the next route exit.** Descend to retrieve the Abyss Core, then survive the altered world on the way back up.

The most important rhythm is simple: **pull, release, read the water, find oxygen, then decide whether the danger is worth it.**

For more details, open **How to Play** from the game's main page. You can also learn the core controls and systems through the **Tutorial** when you begin the game.

**The ocean is full of water. You are still thirsty for oxygen.**

**The real way to save the ocean is not to carry oxygen down to it, but to pull out the heart that made it forget how to breathe.**

## Prototype status and honest warning

This build is closer to a playable concept showcase than to a finished, balanced game. Combat, progression, map routing, and difficulty are still being tuned. The balance is currently rough, and unexpected bugs may appear without warning. Some problems may be difficult to reproduce or confirm, so please treat this as an experimental prototype rather than a promise of a fair or stable challenge.

The game may also stutter or hitch, especially when a map contains many active effects or enemies. Performance improvements are planned for a later phase.

## If you get stuck: use the developer interface

The formal play page includes an exposed **Developer Interface** for testing and recovery. It is also the easiest way to make a run manageable when the current balance becomes frustrating.

Press **`Ctrl + Alt + D`** to open or close it. The shortcuts can then give you a much stronger run:

- **`Alt + 1`** fills the weapon slots.
- **`Alt + 2`** fills the passive slots.
- **`Alt + 3`** fills Resonance buffs.
- **`Alt + 0`** clears the temporary developer overrides.

You can also enter commands for individual values, for example:

```text
max weapons; max passives; max resonance
weapon 2 katana 3
passive 1 oxygenCirculator 3
resonance crabGuard 9
```

These overrides affect the current run's in-memory Build, Resonance, and player position. They do not edit the map files. They can bypass much of the intended progression, so use them freely as a prototype aid when you want to explore the content instead of wrestling with unfinished balance.

If a map becomes impossible to pass because of a routing or physics bug, enter a depth in the same interface and use **Depth Teleport**. The game will place you at the nearest traversable water cell for that depth; values outside the map are clamped to the closest available depth. This is a recovery tool for blocked routes, not a guarantee that every map bug has been fixed.

## Adjust the difficulty in Settings

If the normal challenge is too frustrating, open the **Settings** panel from the gear icon. You can adjust:

- **Player damage reduction**, up to 90%.
- **Oxygen / energy cost reduction**, up to 90%.

These values are saved locally on your device. They make survival more forgiving, but they do not remove every enemy attack or guarantee that a broken route will be passable. If you are here to see the concept, lowering these coefficients is completely fine.
