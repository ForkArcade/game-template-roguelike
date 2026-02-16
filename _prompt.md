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

### Narrative-driven thoughts
Thoughts use the `FA.select` pattern — priority-ordered arrays, first match wins. Register in data.js:
```js
FA.register('thoughts', 'floor_enter', [
  { var: 'depth', eq: 1, pool: ['First steps...', 'Here we go.'] },
  { var: 'depth', gte: 4, pool: ['Too deep...', 'The walls hum.'] },
  { pool: ['Another level.', 'Deeper.'] }  // fallback
]);

FA.register('thoughts', 'combat', [
  { var: 'kills', gte: 10, pool: ['Too many.', 'Efficient.'] },
  { pool: ['One less.', 'They fall.'] }
]);
```

In game.js, select thought:
```js
function triggerThought(category) {
  var state = FA.getState();
  if (state.turn - (state.lastThoughtTurn || 0) < 5) return;
  var entry = FA.select(FA.lookup('thoughts', category));
  if (!entry || !entry.pool || !entry.pool.length) return;
  addThought(FA.pick(entry.pool));
}
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

### Multi-graph structure
Define global arc + per-quest/situation graphs. Variables are global (shared across all graphs).

```js
FA.narrative.init({
  variables: { day: 1, kills: 0, path: null },
  graphs: {
    arc: {
      startNode: 'start',
      nodes: [
        { id: 'start', label: 'Beginning', type: 'scene' },
        { id: 'explore', label: 'Exploration', type: 'scene' },
        { id: 'climax', label: 'Climax', type: 'choice' },
        { id: 'victory', label: 'Victory', type: 'scene' },
        { id: 'defeat', label: 'Defeat', type: 'scene' }
      ],
      edges: [
        { from: 'start', to: 'explore' },
        { from: 'explore', to: 'climax' },
        { from: 'climax', to: 'victory' },
        { from: 'climax', to: 'defeat' },
        { from: 'defeat', to: 'explore' }
      ]
    }
    // Quest graphs with conditional edges (auto-trigger on setVar)
    quest_npc: {
      startNode: 'stranger',
      nodes: [
        { id: 'stranger', label: 'Stranger', type: 'state' },
        { id: 'acquaintance', label: 'Acquaintance', type: 'state' },
        { id: 'confidant', label: 'Confidant', type: 'state' }
      ],
      edges: [
        { from: 'stranger', to: 'acquaintance', var: 'npc_interactions', gte: 1 },
        { from: 'acquaintance', to: 'confidant', var: 'npc_interactions', gte: 3 }
      ]
    }
  }
});
```

### Conditional edges
Edges with `var` conditions auto-trigger when `setVar()` changes a variable. No game.js logic needed — define thresholds in data.js:
```js
// data.js — declarative
edges: [
  { from: 'stranger', to: 'acquaintance', var: 'npc_interactions', gte: 1 },  // auto
  { from: 'routine', to: 'first_system' }  // manual — requires transition() call
]

// game.js — just set the variable, _evaluate() handles the rest
FA.narrative.setVar('npc_interactions', prev + 1, 'Talked to NPC');
```
Conditions: `eq`, `gte`, `lte` (same syntax as `FA.select`). Keep dramatic beats (cutscenes, endings) as manual transitions via `showNarrative()`.

### showNarrative pattern (multi-graph)
```js
function showNarrative(graphId, nodeId) {
  FA.narrative.transition(graphId, nodeId);
  var narText = FA.lookup('narrativeText', nodeId);
  if (narText) {
    state.narrativeMessage = { text: narText.text, color: narText.color, life: 4000, maxLife: 4000 };
    addMessage(narText.text);
  }
  // Optionally trigger cutscene if defined
}
```

### Narrative-driven dialogues
Priority-ordered arrays, first match wins. Register in data.js:
```js
FA.register('dialogues', 'npc_name', [
  { node: 'quest_npc:allied', text: 'I found something useful.' },
  { var: 'system_visits', gte: 3, text: 'You keep going deeper.' },
  { text: 'Hello.' }  // fallback (no condition)
]);
```

In game.js, select dialogue:
```js
function selectDialogue(npcId) {
  var entry = FA.select(FA.lookup('dialogues', npcId));
  return entry ? entry.text : null;
}
```

### Path detection
Track player behavior (kills, stealth, collection) and assign a path when thresholds are met. Path determines climax and ending.

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

## Overworld zones (optional pattern)

Games with an overworld benefit from **zone detection** — the HUD, actions, and mood change based on where the player stands. Each zone gets its own name, color palette, and available actions.

### Zone detection from tiles
Tile types already carry semantic meaning. Map them to zones:
```js
var ZONES = {
  home:    { bg: '#100e14', sep: '#2a2040', name: 'HOME',    nameColor: '#8878aa' },
  market:  { bg: '#14100a', sep: '#302518', name: 'MARKET',  nameColor: '#c8a060' },
  wilds:   { bg: '#0a120a', sep: '#1a3018', name: 'WILDS',   nameColor: '#6aaa5a' },
  streets: { bg: '#0e0e10', sep: '#222228', name: 'STREETS', nameColor: '#7a7a88' }
};

function detectZone(tile, map, px, py) {
  if (tile === 6) return 'home';
  if (tile === 9) return 'market';
  if (tile === 3) return 'wilds';
  // Check adjacent tiles for context (walking NEAR a market = market zone)
  var dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  for (var d = 0; d < dirs.length; d++) {
    var adj = map[py + dirs[d][1]] && map[py + dirs[d][1]][px + dirs[d][0]];
    if (adj === 9) return 'market';
    if (adj === 3) return 'wilds';
  }
  return 'streets';
}
```

### Zone-aware HUD
Each zone renders its own background color, separator, and name in the bottom panel. Actions are context-sensitive per zone. This makes each area feel distinct without touching narrative.

```js
// In overworldUI render layer:
var zone = ZONES[detectZone(tile, state.owMap, px, py)];
FA.draw.rect(0, uiY, W, H - uiY, zone.bg);
FA.draw.rect(0, uiY, W, 1, zone.sep);
FA.draw.text(zone.name, 8, uiY + 6, { color: zone.nameColor, size: 11, bold: true });
```

Zones are game-specific — define them in data.js or render.js based on the game's locations. The pattern works for any tile-based overworld.

## NPC overworld behavior (optional pattern)

Dungeon enemies use AI state machines. Overworld NPCs need a different system — they follow schedules, approach the player to talk, and have individual movement rhythms.

### Pace and idle
Not all NPCs should move in sync. Give each NPC a `pace` (move every N player turns) and an `idleTimer` (linger at destination before moving on):

```js
// In initNPCs:
{ pace: 1, turnCounter: i, idleTimer: 0 }  // i = index for staggered start

// In npcOverworldStep:
npc.turnCounter++;
if (npc.turnCounter % npc.pace !== 0) return;  // skip this turn

// At goal: idle before picking new one
if (atGoal) {
  if (npc.idleTimer > 0) { npc.idleTimer--; return; }
  selectNPCGoal(npc, state);
  npc.idleTimer = FA.rand(2, 6);
}
```

`turnCounter` starts at the NPC's index so even NPCs with the same pace don't move on the same turn.

### Approach and auto-initiate dialogue
NPCs approach the player when they have something to say (`wantsToTalk` flag). When adjacent, they auto-initiate dialogue — no `[SPACE]` needed from the player.

```js
// In selectNPCGoal: approach if wants to talk and player is nearby
if (npc.wantsToTalk && !npc.talkedToday && dist < 8) { npc.goal = 'player'; return; }

// In npcOverworldTurn: auto-initiate when adjacent
if (npc.wantsToTalk && !npc.talkedToday && distToPlayer === 1) {
  talkToNPC(npc, state);
}
```

### Follow and give up
NPCs follow the player for a limited number of turns, then give up and resume their schedule:

```js
if (npc.goal === 'player') {
  npc.followTurns++;
  if (npc.followTurns > 3) {
    npc.wantsToTalk = false;
    npc.followTurns = 0;
    selectNPCGoal(npc, state);  // return to schedule
  }
}
```

### Narrative-driven desire to talk
NPCs react to narrative graph transitions — when the story changes, they want to talk about it:

```js
FA.on('narrative:transition', function(data) {
  if (data.graph === 'arc') {
    // Major story beat — all NPCs react
    for (var i = 0; i < state.npcs.length; i++) {
      if (!state.npcs[i].talkedToday) state.npcs[i].wantsToTalk = true;
    }
  } else if (data.graph.indexOf('quest_') === 0) {
    // Quest update — only that NPC reacts
    var npcId = data.graph.replace('quest_', '');
    // find and set wantsToTalk for that NPC
  }
});
```

Daily reset (`goToBed` or equivalent) restores `wantsToTalk = true` and `followTurns = 0` for all NPCs.

## What to avoid

- Real-time movement (must be turn-based)
- Hand-rolling dungeon generation — use `ROT.Map.*`
- Hand-rolling pathfinding — use `ROT.Path.AStar`
- Hand-rolling FOV / raycasting — use `ROT.FOV.PreciseShadowcasting`
- Complex inventory/crafting systems
- Animations between turns (instant feedback, floats for damage numbers)
- Modifying ENGINE files (rot.min.js, fa-*.js)
- Behaviors registered as functions — use AI state machine with string tags instead
