# Roguelike — Game Design Prompt

You are creating a roguelike game for the ForkArcade platform. The game uses multi-file architecture with the FA engine and rot.js for roguelike algorithms. This prompt describes proven patterns — use them as building blocks, adapt the theme and content to the game concept.

## File architecture

```
forkarcade-sdk.js   — PLATFORM: SDK (scoring, auth) — do not modify
fa-narrative.js     — PLATFORM: narrative module — do not modify
sprites.js          — generated from _sprites.json — do not modify manually
rot.min.js          — ENGINE: rot.js roguelike toolkit (map gen, pathfinding, FOV) — do not modify
fa-engine.js        — ENGINE: game loop, event bus, state, registry — do not modify
fa-renderer.js      — ENGINE: canvas, layers, draw helpers — do not modify
fa-input.js         — ENGINE: keyboard/mouse, keybindings — do not modify
fa-audio.js         — ENGINE: Web Audio, sounds — do not modify
data.js             — GAME DATA: config, enemies, items, modules, narrative, thoughts
game.js             — GAME LOGIC: dungeon gen, movement, combat, AI, floor management
render.js           — RENDERING: map, entities, lighting, effects, UI, overlays
main.js             — ENTRY POINT: keybindings, input routing, game loop, timers
```

**You only modify: `data.js`, `game.js`, `render.js`, `main.js`.**

## 3 Screens (mandatory)

Every game MUST have 3 screen states:
1. **Start** (`screen: 'start'`) — title, description, controls, `[SPACE]` to begin
2. **Playing** (`screen: 'playing'`) — gameplay
3. **End** (`screen: 'victory'` / `screen: 'defeat'`) — narrative text, stats, score, `[R]` to restart

Additional screen: `screen: 'cutscene'` — full-screen typewriter text at key moments.

---

## Dungeon generation (rot.js)

Use `ROT.Map.Digger` for room-based dungeons. **Never hand-roll map generation.**

```js
function generateFloor(cols, rows, depth, maxDepth) {
  var cfg = FA.lookup('config', 'game');
  var digger = new ROT.Map.Digger(cols, rows, {
    roomWidth: [cfg.roomMinSize, cfg.roomMaxSize],
    roomHeight: [cfg.roomMinSize, cfg.roomMaxSize],
    dugPercentage: 0.35 + depth * 0.03  // deeper = more open
  });

  var map = [];
  for (var y = 0; y < rows; y++) { map[y] = []; for (var x = 0; x < cols; x++) map[y][x] = 1; }
  digger.create(function(x, y, value) { map[y][x] = value; });

  // Convert ROT rooms to { x, y, w, h } format
  var rotRooms = digger.getRooms();
  var rooms = [];
  for (var r = 0; r < rotRooms.length; r++) {
    var rr = rotRooms[r];
    rooms.push({
      x: rr.getLeft(), y: rr.getTop(),
      w: rr.getRight() - rr.getLeft() + 1,
      h: rr.getBottom() - rr.getTop() + 1
    });
  }

  // Place stairs down in last room (tile 2), stairs up in first room (tile 3)
  // Place interactables (terminals/shrines/etc.) in middle rooms (tile 4)
  // Create explored[][] grid (all false)
  return { map, rooms, stairsDown, stairsUp, explored };
}
```

**Alternative generators**: `ROT.Map.Uniform` (guaranteed-connected rooms), `ROT.Map.Cellular` (organic caves — good for overworld areas), `ROT.Map.Arena` (single open room for boss fights).

Tile values: `0` = floor, `1` = wall, `2` = stairs down, `3` = stairs up, `4` = interactable, `5` = used interactable.

Helper: `findEmptyInRooms(map, rooms, occupied)` — random empty floor tile not in occupied list.

## FOV / Visibility (rot.js)

Use `ROT.FOV.PreciseShadowcasting` for field of view. **Never hand-roll raycasting.**

FOV is computed once per turn (not per frame) and stored in `state.visible`:

```js
function computeVisibility(map, px, py, radius) {
  var rows = map.length, cols = map[0].length;
  var vis = [];
  for (var y = 0; y < rows; y++) { vis[y] = []; for (var x = 0; x < cols; x++) vis[y][x] = 0; }

  var fov = new ROT.FOV.PreciseShadowcasting(function(x, y) {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
    return map[y][x] !== 1;
  });

  fov.compute(px, py, radius, function(x, y, r, visibility) {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    var light = r < 2 ? 1 : Math.max(0, 1 - (r - 2) / (radius - 2));
    if (light > vis[y][x]) vis[y][x] = light;
  });

  return vis;  // 2D array, values 0..1
}
```

Call in `endTurn()` and `beginPlaying()`:
```js
state.visible = computeVisibility(state.map, state.player.x, state.player.y, lightRadius);
```

The render.js lighting layer reads `state.visible` directly — no computation in the render loop.

## Pathfinding (rot.js)

Use `ROT.Path.AStar` for enemy movement. **Never hand-roll pathfinding.**

```js
function findPath(fromX, fromY, toX, toY, map) {
  var path = [];
  var astar = new ROT.Path.AStar(toX, toY, function(x, y) {
    return isWalkable(map, x, y);
  }, { topology: 4 });
  astar.compute(fromX, fromY, function(x, y) { path.push({ x: x, y: y }); });
  return path;  // path[0] = start, path[1] = next step
}
```

Use in `moveToward()`:
```js
function moveToward(e, tx, ty, state, skipIdx) {
  var path = findPath(e.x, e.y, tx, ty, state.map);
  if (path.length >= 2) {
    var next = path[1];
    if (canStep(next.x, next.y, state, skipIdx)) {
      e.x = next.x; e.y = next.y;
      return true;
    }
  }
  // Fallback to direct movement if A* blocked by entities
  // ... axis-priority heuristic
}
```

## Multi-floor system

Floors are persistent — leaving and returning preserves state.

```js
state.floors = {};
state.floors[depth] = { map, rooms, enemies, items, stairsDown, stairsUp, explored };
```

`changeFloor(direction)`:
1. Save current floor's enemies/items/explored to `state.floors[oldDepth]`
2. Generate new floor if `!state.floors[newDepth]`
3. Load new floor's map/enemies/items/explored into state
4. Place player at appropriate stairs position
5. Recompute FOV: `state.visible = computeVisibility(state.map, state.player.x, state.player.y, lightRadius)`

## Movement & turn structure

Turn cycle: player acts → `endTurn()` → recompute FOV → `enemyTurn()` → `checkThoughts()`.

**Entity collision rule**: no two entities share a tile. Bump hostile → attack. Bump friendly NPC → swap positions.

```js
function movePlayer(dx, dy) {
  // Check enemy at target → bump attack
  // Check friendly NPC at target → swap positions
  // Check walkable → move
  // Check tile type: stairs (changeFloor), interactable (hack/use), floor (pickup items)
  // Call endTurn()
}

function endTurn() {
  state.turn++;
  state.visible = computeVisibility(state.map, state.player.x, state.player.y, lightRadius);
  enemyTurn();
  checkThoughts(state);
}
```

Item pickup: iterate items at player position, handle by type (gold, potion, module).

## AI state machine

Three states: `patrol → alert → hunting`. Each enemy has:
```js
{ aiState: 'patrol', alertTarget: null, alertTimer: 0, patrolTarget: null, stunTurns: 0 }
```

### State transitions
- **patrol**: Wander between random room centers. Sentinels stay idle.
- **alert** (8-turn timer): Investigate sound/last known position. Counts down to patrol.
- **hunting**: Actively chase player. Loses sight → drops to alert.

### computeEnemyAction(enemy, state)
1. Calculate distance and LOS to player
2. Adjacent + not cloaked → always attack (self-defense)
3. Can see player → transition to hunting
4. Lost sight while hunting → transition to alert
5. Alert timer expired → transition to patrol
6. Return action: `{ type: 'chase'|'flank'|'shoot'|'investigate'|'patrol'|'random'|'idle'|'attack' }`

### Bresenham LOS
Keep simple Bresenham for point-to-point AI line-of-sight checks:
```js
function hasLOS(map, x1, y1, x2, y2) {
  // Bresenham line, return false if hitting wall (map[y][x] === 1)
}
```

Note: Player FOV uses `ROT.FOV.PreciseShadowcasting`. Bresenham is only for enemy AI "can I see the player?" checks.

### Sound propagation
Combat and abilities generate sound. Nearby enemies in patrol/alert switch to alert:
```js
function propagateSound(state, x, y, radius) {
  // For each enemy within Manhattan distance <= radius
  // Set aiState = 'alert', alertTarget = {x, y}, alertTimer = 8
  // Add visual sound wave: state.soundWaves.push({tx, ty, maxR: radius, life: 500})
}
```

### Movement helpers
- `moveToward(entity, tx, ty, state, skipIdx)` — A* pathfinding with direct movement fallback
- `flankTarget(entity, tx, ty, state, skipIdx)` — move perpendicular to approach angle
- `randomStep(entity, state, skipIdx)` — shuffle directions, try each

## Combat

### Damage formula
```js
var dmg = Math.max(1, atk - def + FA.rand(-1, 2));
```

### Damage application
```js
function applyDamageToPlayer(dmg, sourceName, state) {
  // Check shield/firewall absorption first
  state.player.hp -= dmg;
  state.shake = 6;  // screen shake
  FA.addFloat(px, py, '-' + dmg, '#f84', 800);
  addMessage(sourceName + ' deals ' + dmg + ' damage!');
  // Check death, check low health threshold
}
```

### Kill effects
On enemy death: spawn 8 burst particles in enemy color, emit `entity:killed`, check win condition.

## Module/ability system

Collectible abilities with limited slots (e.g., max 3):
```js
state.player.modules = [];  // { type, name, color }
// Pickup: state.player.modules.push(...)
// Use: hotkeys 1/2/3 → Game.useModule(slotIdx) → splice from array → apply effect → endTurn()
```

Register module definitions in data.js:
```js
FA.register('modules', 'emp', { name: 'EMP Pulse', char: 'E', color: '#ff0' });
```

## Effects system

### Screen shake
```js
state.shake = 6;  // set on damage
// In update: state.shake -= dt * 0.012; generate shakeX/shakeY
// In render: ctx.translate(shakeX, shakeY) before layers, translate back after
```

### Kill burst particles
```js
state.particles.push({ x, y, vx, vy, life: 500, maxLife: 500, color });
// In update: move by velocity * dt/1000, apply drag (0.97), decrement life
```

### Sound wave rings
```js
state.soundWaves.push({ tx, ty, maxR: radius, life: 500 });
// In render: expanding circle, alpha fades with progress
```

### Alert tint
Count hunting enemies, overlay red with `alpha = huntingRatio * 0.06`.

### Depth corruption
Random glitch bars with probability scaling by depth: `Math.random() < 0.002 * depth`.

## Thought / inner monologue system

Context-sensitive short thoughts (under 30 chars) displayed as floating bubble above player.

### Data structure
```js
FA.register('config', 'thoughts', {
  floor_enter: { 1: ['...', '...'], 2: ['...', '...'] },  // keyed by depth
  combat: ['...', '...'],       // random from pool
  damage: ['...', '...'],
  low_health: ['...'],
  ambient: ['...', '...']       // triggered every N turns
});
```

### Trigger system
`checkThoughts(state)` runs at end of each turn. Compares current state to previous snapshot:
- depth changed → floor_enter thought
- kills increased → combat thought
- hp decreased → damage or low_health thought
- gold/modules increased → pickup thought
- every N turns → ambient thought

5-turn cooldown between thoughts prevents spam.

### Bubble rendering
Floating above player, follows position, flips below when near top of screen. Typewriter effect with blinking cursor. `[SPC]` dismiss hint. Fades after 8 seconds.

## Cutscene system

Full-screen typewriter text at key narrative moments.

```js
function startCutscene(def, state) {
  state.cutsceneReturn = state.screen;
  state.screen = 'cutscene';
  state.cutscene = { lines, color, speed, totalChars, timer: 0, done: false };
}
function dismissCutscene() {
  if (!done) { skip to end; return; }
  state.screen = state.cutsceneReturn;
}
```

Render: scan lines, screen flicker, per-line typewriter, blinking cursor, `[SPACE]` prompt when done.

## Depth-dependent palettes

Array of color sets indexed by depth. Each palette defines: wall cap, wall face, wall panel, wall side, wall inner, wall line, floor A, floor B, floor dot.

```js
var PALETTES = [null,
  { wCap:'#181d30', wFace:'#252b42', ... },  // depth 1: cool
  { wCap:'#261d18', wFace:'#3b2b20', ... },  // depth 3: warm
  { wCap:'#301414', wFace:'#451e1e', ... }    // depth 5: hostile
];
var pal = PALETTES[depth] || PALETTES[1];
```

## Wall autotiling

Check 4 neighbors for open space:
```js
var openS = isOpen(map, x, y + 1);
var openN = isOpen(map, x, y - 1);
var openE = isOpen(map, x + 1, y);
var openW = isOpen(map, x - 1, y);
```

- `openS` (facing player): cap top + face below + panel line + vertical dividers
- `openN`: dark inner + top highlight
- Neither: solid inner
- Side accents on `openE`/`openW` edges
- Deep floors: damage marks on wall faces, cable traces on floor tiles

## Narrative

### Graph structure
Define acts, paths, climax, endings. Use `FA.narrative.init()` with nodes and edges.

```js
// Nodes: { id, label, type: 'scene' }
// Edges: { from, to }
// Register text: FA.register('narrativeText', nodeId, { text, color })
```

### Path detection
Track player behavior (kills, stealth, collection) and assign a path when thresholds are met. Path determines climax and ending.

### showNarrative pattern
```js
function showNarrative(nodeId) {
  FA.narrative.transition(nodeId);
  var narText = FA.lookup('narrativeText', nodeId);
  if (narText) {
    state.narrativeMessage = { text: narText.text, color: narText.color, life: 4000, maxLife: 4000 };
    addMessage(narText.text);
  }
  // Optionally trigger cutscene if defined
}
```

## Message log

Color-coded by content detection:
```js
function addMessage(text) {
  var color = '#556';  // default dim
  if (text.indexOf('HACK') >= 0) color = '#0ff';
  else if (text.indexOf('destroyed') >= 0 || text.indexOf('damage') >= 0) color = '#f44';
  else if (text.charAt(0) === '+') color = '#4f4';
  // etc.
  msgs.push({ text, color });
  if (msgs.length > 6) msgs.shift();
}
```

## Scoring

Configurable via registry:
```js
FA.register('config', 'scoring', { killMultiplier: 100, goldMultiplier: 10, depthBonus: 500 });
// score = kills * killMult + gold * goldMult + (maxDepth - 1) * depthBonus
```

## Sprites

Sprites are optional — ASCII fallback is the base. Use `FA.draw.sprite(category, name, x, y, size, fallbackChar, fallbackColor, frame)`.

### Frame conventions
- **Enemies**: frame 0 = alive, frame 1 = dead/destroyed variant
- **Player**: frame 0 = base, frame 1 = shielded/buffed
- **Tiles**: frames for visual variants (e.g., frame 0 = normal, frame 1 = damaged)

## Available map generators (rot.js)

Choose the generator that fits the game concept:

| Generator | Use case | Example |
|-----------|----------|---------|
| `ROT.Map.Digger` | Classic dungeon rooms + corridors | Standard dungeon crawl |
| `ROT.Map.Uniform` | Rooms with guaranteed connectivity | Controlled layout with every room reachable |
| `ROT.Map.Cellular` | Organic caves, natural terrain | Overworld areas, cave systems, organic maps |
| `ROT.Map.Arena` | Single open room | Boss arenas, tutorial rooms |

Games with **overworld + dungeon** (like a surface map plus underground levels) can use `ROT.Map.Cellular` for the organic overworld and `ROT.Map.Digger` for dungeons — both share the same `isWalkable()` callback and pathfinding system.

## What to avoid

- Real-time movement (must be turn-based)
- Hand-rolling dungeon generation — use `ROT.Map.*`
- Hand-rolling pathfinding — use `ROT.Path.AStar`
- Hand-rolling FOV / raycasting — use `ROT.FOV.PreciseShadowcasting`
- Complex inventory/crafting systems
- Animations between turns (instant feedback, floats for damage numbers)
- Modifying ENGINE files (rot.min.js, fa-*.js)
- Behaviors registered as functions — use AI state machine with string tags instead
