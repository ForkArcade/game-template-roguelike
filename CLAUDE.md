# Roguelike — ForkArcade

Procedural dungeons, permadeath, tile-based movement, turn-based combat.

## File structure

| File | Description |
|------|-------------|
| `data.js` | Config, locations, enemy types, item types, AI config, sounds (`FA.register`) |
| `locations.js` | Location registry query API (`window.Location`) |
| `core.js` | Map gen, FOV, pathfinding, collision, map registry, bubble system (`window.Core`) |
| `combat.js` | Attack, pickup, 3-state AI, enemy turns (`window.Combat`) |
| `game.js` | Movement, floor transitions, turn flow, lifecycle (`window.Game`) |
| `render.js` | Map tiles, entities, lighting, particles (`window.Render`) |
| `render-ui.js` | HUD, start/gameover screens, system bubbles, floats (`window.RenderUI`) |
| `main.js` | Entry point: canvas, keys, input routing, update/render loops |

Do not edit: `rot.min.js`, `fa-engine.js`, `fa-renderer.js`, `fa-input.js`, `fa-audio.js`, `fa-textfx.js`, `fa-narrative.js`, `forkarcade-sdk.js`, `sprites.js`

## Engine API (window.FA)

- **State**: `FA.resetState(obj)`, `FA.getState()`, `FA.setState(key, val)`
- **Registry**: `FA.register(reg, id, def)`, `FA.lookup(reg, id)`, `FA.lookupAll(reg)`
- **Events**: `FA.on(event, fn)`, `FA.emit(event, data)`
- **Game loop**: `FA.setUpdate(fn)`, `FA.setRender(fn)`, `FA.start()` — **dt in milliseconds**
- **Canvas**: `FA.initCanvas(id, w, h)`, `FA.getCtx()`
- **Layers**: `FA.addLayer(name, drawFn, order)`, `FA.renderLayers()` — **guard with `if (!state.player) return;`**
- **Draw**: `FA.draw.clear/rect/text/bar/circle/sprite/pushAlpha/popAlpha`
- **Input**: `FA.bindKey(action, keys)`, `FA.isAction(action)`
- **Audio**: `FA.defineSound(name, fn)`, `FA.playSound(name)`
- **Effects**: `FA.addFloat(x, y, text, color, dur)`, `FA.updateFloats(dt)`, `FA.drawFloats()`
- **Narrative**: `FA.narrative.init(config)`, `FA.narrative.setVar()`, `FA.narrative.getVar()`, `FA.select(entries)`
- **Utils**: `FA.rand(min,max)`, `FA.pick(arr)`, `FA.shuffle(arr)`, `FA.uid()`

## rot.js API (window.ROT)

```js
// Map generation
var digger = new ROT.Map.Digger(cols, rows, { roomWidth: [4,9], roomHeight: [4,9], dugPercentage: 0.35 });
digger.create(function(x, y, value) { map[y][x] = value; }); // 0=floor, 1=wall
var rooms = digger.getRooms(); // .getLeft(), .getRight(), .getTop(), .getBottom()

// FOV
var fov = new ROT.FOV.PreciseShadowcasting(function(x, y) { return map[y][x] !== 1; });
fov.compute(px, py, radius, function(x, y, r, vis) { /* 0..1 */ });

// Pathfinding
var astar = new ROT.Path.AStar(toX, toY, passabilityFn, { topology: 4 });
astar.compute(fromX, fromY, function(x, y) { path.push({x,y}); });
```

**DO NOT USE**: `ROT.Display` (use FA.draw), `ROT.Engine` (use FA.setUpdate)

## State shape

```js
{
  screen: 'start'|'playing'|'victory'|'defeat',
  mapId: 'floor_1', depth: 1, maxDepth: 1,
  maps: { floor_1: { grid, entities, items, explored, rooms, stairsDown, stairsUp } },
  map: maps[mapId].grid,  // shortcut
  visible: [[]],           // FOV result, recomputed per turn
  player: { x, y, hp, maxHp, atk, def, gold, kills },
  turn: 0, score: 0, shake: 0, particles: [],
  bubbleQueue: [], systemBubble: null
}
```

## Module APIs

### Location (locations.js)
- `Location.get(mapId)` → location def or null
- `Location.depth(mapId)` → depth number
- `Location.isDungeon(mapId)` → boolean
- `Location.palette(mapId)` → palette object or null
- `Location.hasEffect(mapId, name)` → boolean

### Combat (combat.js)
- `Combat.attack(attacker, target)` — damage calc, kill handling, particles
- `Combat.applyDamage(dmg, state)` — player damage with shake
- `Combat.pickup(item, idx)` — gold/potion pickup
- `Combat.enemyTurn()` — all enemy AI + actions

### Core bubble system (core.js)
- `Core.addSystemBubble(text, color)` — queue a message (string or array of lines)
- `Core.dismissBubble()` — dismiss current bubble, advance queue

### TextFX (engine: fa-textfx.js)
- `FA.textFX.render(ctx, text, elapsed, x, y, opts)` — split-flap animation
- `FA.textFX.totalTime(text, opts)` — total reveal duration
- `FA.textFX.charWidth(ctx, size, bold)` — monospace char width (cached)
- Also available as `window.TextFX` for backward compat

## Tile values

`0` = floor, `1` = wall, `2` = stairs down, `3` = stairs up

## Core functions

| Function | Purpose |
|----------|---------|
| `Core.generateFloor(cols, rows, depth, maxDepth)` | ROT.Map.Digger → map, rooms, stairs, explored |
| `Core.populateFloor(map, rooms, depth)` | Spawn enemies + items scaled by depth |
| `Core.computeVisibility(map, px, py, radius)` | ROT.FOV → visibility grid 0..1 |
| `Core.isWalkable(map, x, y)` | Tile !== 1 |
| `Core.canStep(x, y, skip)` | Terrain + entities + player |
| `Core.getEntityAt(x, y)` | Find entity on current map |
| `Core.hasLOS(map, x1, y1, x2, y2)` | Bresenham for AI sight |
| `Core.moveToward(e, tx, ty)` | A* + cardinal fallback |
| `Core.randomStep(e)` | Shuffle + try 4 dirs |
| `Core.changeMap(id, sx, sy)` | Switch map via Location registry |

## Turn cycle

`movePlayer(dx,dy)` → bump attack or move → pickup items → stairs → `endTurn()` → FOV → `Combat.enemyTurn()`

## AI (3 states: patrol → alert → hunting)

- **patrol** — wander between random room centers
- **alert** — investigate last known position, timeout after `config.ai.alertTimeout` turns
- **hunting** — LOS to player → A* chase; adjacent → attack

Enemy state shown as indicator: `!` (hunting), `?` (alert).

Entity fields: `aiState`, `alertTarget`, `alertTimer`, `patrolTarget`, `stunTurns`, `sightRange`.

## Combat

`dmg = max(1, atk - def + rand(-1, 2))` — floats for damage numbers, screen shake on player hit, burst particles on kill.

## Scoring

`kills × 100 + gold × 10 + (maxDepth-1) × 500` — submitted via `ForkArcade.submitScore()`.

## Data-driven pattern

All tunable values in `data.js` via `FA.register()`. Game code reads via `FA.lookup()`:
- `FA.lookup('config', 'game')` — canvas, grid, depth config
- `FA.lookup('config', 'colors')` — all colors
- `FA.lookup('config', 'ai')` — sight range, alert timeout
- `FA.lookup('config', 'bubble')` — timing, colors
- `FA.lookup('config', 'scoring')` — score multipliers
- `FA.lookup('locations', mapId)` — location definitions
- `FA.lookup('enemies', key)` — enemy type definitions
- `FA.lookup('items', key)` — item type definitions

**Never hardcode numbers/texts in game logic** — put them in data.js config.

## Sprites

`FA.draw.sprite(cat, name, x, y, size, fallbackChar, fallbackColor, frame)` — ASCII fallback when no sprite exists.

## Layer order

| z | Layer | File |
|---|-------|------|
| 0 | startScreen | render-ui.js |
| 1 | map | render.js |
| 10 | entities | render.js |
| 15 | lighting | render.js |
| 18 | particles | render.js |
| 20 | floats | render-ui.js |
| 25 | systemBubble | render-ui.js |
| 30 | hud | render-ui.js |
| 40 | gameOver | render-ui.js |

## What to avoid

- Real-time movement (must be turn-based)
- Hand-rolling map gen / pathfinding / FOV — use rot.js
- Letting entities share tiles
- Animations between turns (use instant floats)
- Modifying engine files
- Hardcoding values in JS — use FA.register/lookup
