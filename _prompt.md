# Roguelike — Game Design Prompt

You are creating a roguelike game for the ForkArcade platform. The template provides a complete playable foundation — procedural dungeons, FOV, pathfinding, bump combat, multi-floor progression, and scoring. Adapt the theme and content to the game concept.

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
data.js             — GAME DATA: config, enemy types, item types, sounds
core.js             — CORE SYSTEMS: map gen, FOV, pathfinding, collision, map registry
game.js             — GAME LOGIC: movement, combat, AI, floors, turns
render.js           — RENDERING: map, entities, lighting, HUD, screens
main.js             — ENTRY POINT: canvas, keys, input routing, game loop
```

**You only modify: `data.js`, `core.js`, `game.js`, `render.js`, `main.js`.**

## 3 Screens (mandatory)

1. **Start** (`screen: 'start'`) — title, controls, `[SPACE]` to begin
2. **Playing** (`screen: 'playing'`) — gameplay
3. **End** (`screen: 'victory'` / `screen: 'defeat'`) — stats, score, `[R]` to restart

## Dungeon generation

`ROT.Map.Digger` for room-based dungeons. Tiles: `0`=floor, `1`=wall, `2`=stairs down, `3`=stairs up.

```js
var digger = new ROT.Map.Digger(cols, rows, {
  roomWidth: [cfg.roomMin, cfg.roomMax],
  roomHeight: [cfg.roomMin, cfg.roomMax],
  dugPercentage: 0.35 + depth * 0.03
});
digger.create(function(x, y, v) { map[y][x] = v; });
var rooms = digger.getRooms();
```

Alternatives: `ROT.Map.Uniform` (guaranteed connectivity), `ROT.Map.Cellular` (organic caves), `ROT.Map.Arena` (boss rooms).

## FOV

`ROT.FOV.PreciseShadowcasting` — computed once per turn, stored in `state.visible`:
```js
state.visible = Core.computeVisibility(state.map, px, py, 10 - depth * 0.5);
```

## Pathfinding

`ROT.Path.AStar` — used by enemy AI in `Core.moveToward()`:
```js
var astar = new ROT.Path.AStar(tx, ty, function(x, y) { return Core.isWalkable(map, x, y); }, { topology: 4 });
```

## Multi-floor system

All maps in `state.maps[depth]`. Floors are persistent — leaving and returning preserves state.

```js
function changeFloor(dir) {
  var newD = dir === 'down' ? state.depth + 1 : state.depth - 1;
  if (!state.maps[newD]) { /* generate + populate */ }
  Core.changeMap(newD, spawnX, spawnY);
  state.visible = Core.computeVisibility(state.map, px, py, radius);
}
```

## Movement & turn structure

```
movePlayer(dx, dy)
  → entity at target? bump attack (enemy) or blocked
  → walkable? move player
  → stairs? changeFloor()
  → items at tile? pickup (gold adds value, potion heals)
  → endTurn()

endTurn()
  → turn++
  → recompute FOV
  → enemyTurn() (for each enemy: sight check → chase or patrol → attack if adjacent)
```

## AI (2 states: patrol / chase)

```js
var canSee = dist <= 8 && Core.hasLOS(map, ex, ey, px, py);
if (canSee) e.aiState = 'chase';
else if (e.aiState === 'chase') e.aiState = 'patrol';

if (dist === 1) { /* attack player */ }
else if (e.aiState === 'chase') Core.moveToward(e, px, py);
else { /* patrol: wander to random room centers */ }
```

Enemy speed: `e.turnWait` increments each turn, acts when `>= e.speed` (1=every turn, 2=every other).

## Combat

```js
var dmg = Math.max(1, atk - def + FA.rand(-1, 2));
target.hp -= dmg;
FA.addFloat(x, y, '-' + dmg, '#f44', 800);
// On kill: splice from entities, kills++, burst particles
```

## Scoring

```js
score = kills * 100 + gold * 10 + (maxDepth - 1) * 500;
FA.emit('game:over', { victory: victory, score: score });
// main.js submits via ForkArcade.submitScore(score)
```

## Effects

- **Screen shake**: `state.shake = 4` on player damage, decays in update loop
- **Kill particles**: 6 particles in enemy color, 400ms lifetime, velocity drag 0.97
- **Damage floats**: `FA.addFloat()` — auto-rise and fade

## Sprites

`FA.draw.sprite(cat, name, x, y, size, fallbackChar, fallbackColor, frame)` — ASCII fallback is the base. Sprites are optional.

## Extending the template

Common additions (implement as needed):

| Feature | Where | Pattern |
|---------|-------|---------|
| New enemy type | `data.js` + `core.js` populateFloor | `FA.register('enemies', 'id', { name, char, color, hp, atk, def, speed })` |
| New item type | `data.js` + `game.js` pickupItem | `FA.register('items', 'id', { name, char, color, ... })` |
| Equipment/modules | `state.player.modules[]` | Max 3 slots, hotkeys 1-3, splice on use |
| Interactables | Tile 4 in map, handle in movePlayer | Terminals, shrines, chests |
| Narrative | `FA.narrative.init()` in game.js | Multi-graph, conditional edges, FA.select for dialogues |
| NPC system | Entities with `type: 'npc'` | Bump = swap positions, dialogue via FA.select |
| Message log | `state.messages[]` | Color-coded, max 6, shift on overflow |
| Depth palettes | `render.js` PALETTES array | Different wall/floor colors per depth |

## What to avoid

- Real-time movement (must be turn-based)
- Hand-rolling dungeon gen / pathfinding / FOV — use rot.js
- Entities sharing tiles — always check collision
- Animations between turns — use instant floats
- Modifying engine files
