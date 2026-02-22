# Roguelike — Game Design Prompt

You are creating a roguelike game for the ForkArcade platform. The template provides a complete playable foundation — procedural dungeons, FOV, pathfinding, 3-state AI, bump combat, multi-floor progression, bubble messages, and scoring. Adapt the theme and content to the game concept.

## File architecture

```
forkarcade-sdk.js   — PLATFORM: SDK (scoring, auth) — do not modify
fa-narrative.js     — PLATFORM: narrative module — do not modify
sprites.js          — generated from _sprites.json — do not modify
rot.min.js          — ENGINE: rot.js (map gen, pathfinding, FOV) — do not modify
fa-engine.js        — ENGINE: game loop, event bus, state, registry — do not modify
fa-renderer.js      — ENGINE: canvas, layers, draw helpers — do not modify
fa-input.js         — ENGINE: keyboard/mouse — do not modify
fa-audio.js         — ENGINE: Web Audio — do not modify
text-fx.js          — GAME: split-flap typewriter animation
data.js             — GAME DATA: config, locations, enemies, items, AI config, sounds
locations.js        — GAME: location registry query API
core.js             — CORE: map gen, FOV, pathfinding, collision, bubbles
combat.js           — GAME: attack, pickup, 3-state AI, enemy turns
game.js             — GAME: movement, floor transitions, turn flow, lifecycle
render.js           — RENDER: map tiles, entities, lighting, particles
render-ui.js        — RENDER: HUD, start/gameover screens, bubbles, floats
main.js             — ENTRY: canvas, keys, input routing, update/render loops
```

**You modify: `data.js`, `locations.js`, `core.js`, `combat.js`, `game.js`, `render.js`, `render-ui.js`, `main.js`, `text-fx.js`.**

## 3 Screens (mandatory)

1. **Start** (`screen: 'start'`) — title, controls, `[SPACE]` to begin
2. **Playing** (`screen: 'playing'`) — gameplay
3. **End** (`screen: 'victory'` / `screen: 'defeat'`) — stats, score, `[R]` to restart

## Data-driven pattern

**All tunable values in `data.js`** via `FA.register()`. Game code reads via `FA.lookup()`:

```js
// In data.js:
FA.register('config', 'ai', { sightRange: 8, alertTimeout: 8 });
FA.register('locations', 'floor_1', { depth: 1, dungeon: true, label: 'Floor 1' });
FA.register('enemies', 'rat', { name: 'Rat', char: 'r', hp: 4, atk: 2, def: 0, color: '#a67c52', speed: 1, sightRange: 6 });

// In game code:
var aiCfg = FA.lookup('config', 'ai');
var loc = FA.lookup('locations', state.mapId);
var enemyDef = FA.lookup('enemies', 'rat');
```

**Never hardcode numbers, texts, or thresholds in JS** — put them in data.js.

## Location registry

Maps identified by string IDs (`'floor_1'`, `'floor_2'`, etc.), registered in data.js:

```js
FA.register('locations', 'floor_1', { depth: 1, dungeon: true, label: 'Floor 1' });
```

Query via `Location.get(mapId)`, `Location.depth(mapId)`, `Location.isDungeon(mapId)`.

## Dungeon generation

`ROT.Map.Digger` for room-based dungeons. Tiles: `0`=floor, `1`=wall, `2`=stairs down, `3`=stairs up.

Alternatives: `ROT.Map.Uniform` (guaranteed connectivity), `ROT.Map.Cellular` (organic caves), `ROT.Map.Arena` (boss rooms).

## Multi-floor system

Maps stored by location ID: `state.maps['floor_1']`. Floors are persistent.

```js
function changeFloor(dir) {
  var newId = floorId(newDepth);
  if (!state.maps[newId]) { /* generate + populate */ }
  Core.changeMap(newId, spawnX, spawnY);
}
```

## Movement & turn structure

```
movePlayer(dx, dy)
  → bubble active? block input
  → entity at target? Combat.attack()
  → walkable? move player
  → stairs? changeFloor()
  → items at tile? Combat.pickup()
  → endTurn()

endTurn()
  → turn++
  → recompute FOV
  → Combat.enemyTurn()
```

## AI (3 states: patrol → alert → hunting)

In `combat.js`, `computeEnemyAction()`:

```js
// Sight → hunting (chase with A*)
if (canSee) { e.aiState = 'hunting'; e.alertTarget = {x: px, y: py}; }
// Lost sight → alert (investigate last position, 8 turn timeout)
else if (e.aiState === 'hunting') { e.aiState = 'alert'; e.alertTimer = 8; }
// Alert expired → patrol (wander room centers)
if (e.alertTimer <= 0) e.aiState = 'patrol';
```

Per-enemy `sightRange` in enemy definition. Visual indicators: `!` (hunting), `?` (alert).

Entity fields: `aiState`, `alertTarget`, `alertTimer`, `patrolTarget`, `stunTurns`, `sightRange`.

## Combat

```js
var dmg = Math.max(1, atk - def + FA.rand(-1, 2));
// Combat.attack(attacker, target) handles damage, kill, particles, events
// Combat.applyDamage(dmg, state) handles player damage with shake
// Combat.pickup(item, idx) handles gold/potion
```

## Bubble system

Messages displayed as typewriter boxes:

```js
Core.addSystemBubble('Floor 3', '#4caf50');          // single line
Core.addSystemBubble('Line 1\nLine 2', '#4ef');      // multi-line
Core.dismissBubble();                                 // dismiss current
```

Bubbles block player input until dismissed with SPACE. Timer + done flag managed in main.js update loop.

## Rendering separation

- **render.js** — map tiles, entities (with AI indicators), lighting (FOV), particles
- **render-ui.js** — start screen, HUD, system bubbles (typewriter), floats, game over

Layer order: map(1) → entities(10) → lighting(15) → particles(18) → floats(20) → bubbles(25) → hud(30) → gameOver(40)

## Narrative (optional)

`fa-narrative.js` provides multi-graph story system. Initialize in game.js:

```js
FA.narrative.init({ variables: { kills: 0 }, graphs: { main: { startNode: 'intro', nodes: [...], edges: [...] } } });
FA.narrative.setVar('kills', 5, 'Killed 5 enemies');
FA.select([{ var: 'kills', gte: 10, text: 'Veteran' }, { text: 'Novice' }]);
```

## Scoring

```js
score = kills * 100 + gold * 10 + (maxDepth - 1) * 500;
FA.emit('game:over', { victory: victory, score: score });
```

## Extending the template

| Feature | Where | Pattern |
|---------|-------|---------|
| New enemy type | `data.js` + `core.js` populateFloor | `FA.register('enemies', 'id', { name, char, color, hp, atk, def, speed, sightRange })` |
| New item type | `data.js` + `combat.js` pickup | `FA.register('items', 'id', { name, char, color, ... })` |
| Equipment/modules | `state.player.modules[]` | Max 3 slots, hotkeys 1-3, splice on use |
| Interactables | Tile 4+ in map, handle in movePlayer | Terminals, shrines, chests |
| Narrative | `FA.narrative.init()` in game.js | Multi-graph, conditional edges, FA.select |
| NPC system | Entities with `type: 'npc'` | Needs/jobs/moods, scheduling, dialogue via FA.select |
| Day cycle | `state.timeOfDay`, `state.day` | Turns per day, period checks, curfew |
| Economy | `state.credits`, `state.rent` | Work mechanic, rent scaling |
| Choice menus | `state.choiceMenu` in render-ui.js | Title + options, W/S navigate, Space confirms |
| Depth palettes | `locations.js` palette field | Per-location wall/floor colors |
| Message log | `state.messages[]` | Color-coded, max 6, shift on overflow |

## What to avoid

- Real-time movement (must be turn-based)
- Hand-rolling dungeon gen / pathfinding / FOV — use rot.js
- Entities sharing tiles — always check collision
- Animations between turns — use instant floats
- Modifying engine files
- Hardcoding values in JS — use FA.register/lookup
