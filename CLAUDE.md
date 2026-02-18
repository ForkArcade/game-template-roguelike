# Roguelike — ForkArcade

Procedural dungeons, permadeath, tile-based movement, turn-based combat.

## File structure

| File | Description |
|------|-------------|
| `data.js` | Config, enemy types, item types, sounds (`window.FA.register`) |
| `core.js` | Map gen (ROT.Map), FOV (ROT.FOV), pathfinding (ROT.Path), collision, map registry (`window.Core`) |
| `game.js` | Movement, bump combat, AI, floor transitions, turns, lifecycle (`window.Game`) |
| `render.js` | All rendering: map, entities, lighting, particles, HUD, start/gameover screens (`window.Render`) |
| `main.js` | Entry point: canvas init, keybindings, input routing, game loop, `FA.start()` |

Do not edit: `rot.min.js`, `fa-engine.js`, `fa-renderer.js`, `fa-input.js`, `fa-audio.js`, `forkarcade-sdk.js`, `fa-narrative.js`, `sprites.js`

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
  mapId: 1, depth: 1, maxDepth: 1,
  maps: { 1: { grid, entities, items, explored, rooms, stairsDown, stairsUp } },
  map: maps[mapId].grid,  // shortcut
  visible: [[]],           // FOV result, recomputed per turn
  player: { x, y, hp, maxHp, atk, def, gold, kills },
  turn: 0, score: 0, shake: 0, particles: []
}
```

## Tile values

`0` = floor, `1` = wall, `2` = stairs down, `3` = stairs up

## Core functions

| Function | Purpose |
|----------|---------|
| `generateFloor(cols, rows, depth, maxDepth)` | ROT.Map.Digger → map, rooms, stairs, explored |
| `populateFloor(map, rooms, depth)` | Spawn enemies + items scaled by depth |
| `computeVisibility(map, px, py, radius)` | ROT.FOV → visibility grid 0..1 |
| `isWalkable(map, x, y)` | Tile !== 1 |
| `canStep(x, y, skip)` | Terrain + entities + player |
| `getEntityAt(x, y)` | Find entity on current map |
| `hasLOS(map, x1, y1, x2, y2)` | Bresenham for AI sight |
| `moveToward(e, tx, ty)` | A* + cardinal fallback |
| `randomStep(e)` | Shuffle + try 4 dirs |
| `changeMap(id, sx, sy)` | Switch map, move player |

## Turn cycle

`movePlayer(dx,dy)` → bump attack or move → pickup items → stairs → `endTurn()` → FOV → `enemyTurn()`

## AI (2 states)

- **patrol**: wander between random room centers
- **chase**: LOS to player → A* pathfind toward player; adjacent → attack

## Combat

`dmg = max(1, atk - def + rand(-1, 2))` — floats for damage numbers, screen shake on player hit, 6 burst particles on kill.

## Scoring

`kills × 100 + gold × 10 + (maxDepth-1) × 500` — submitted via `ForkArcade.submitScore()`.

## Sprites

`FA.draw.sprite(cat, name, x, y, size, fallbackChar, fallbackColor, frame)` — ASCII fallback when no sprite exists.

## What to avoid

- Real-time movement (must be turn-based)
- Hand-rolling map gen / pathfinding / FOV — use rot.js
- Letting entities share tiles
- Animations between turns (use instant floats)
- Modifying engine files
