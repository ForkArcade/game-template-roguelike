# Roguelike — ForkArcade

Procedural dungeons, permadeath, tile-based movement, turn-based combat.

## File structure

| File | Description |
|------|-------------|
| `data.js` | Data registration: `FA.register('enemies', ...)`, `FA.register('items', ...)`, config, modules, narrative, thoughts |
| `game.js` | Logic: map generation (ROT.Map), pathfinding (ROT.Path), FOV (ROT.FOV), movement, combat, AI state machine, floor management, turns |
| `render.js` | Render layers: map (autotiled walls), entities (with glow), lighting, effects, UI, overlays |
| `main.js` | Entry point: keybindings, input routing, game loop timers, `ForkArcade.onReady/submitScore` |

Template files (do not edit):
- `rot.min.js` — rot.js roguelike toolkit (map gen, pathfinding, FOV, scheduling)
- `fa-engine.js`, `fa-renderer.js`, `fa-input.js`, `fa-audio.js` — engine

Platform files (copied by platform, do not edit):
- `forkarcade-sdk.js` — SDK (scoring, auth)
- `fa-narrative.js` — narrative module (graph, variables, transition)
- `sprites.js` — generated from `_sprites.json`

## Engine API (window.FA)

- **Event bus**: `FA.on(event, fn)`, `FA.emit(event, data)`, `FA.off(event, fn)`
- **State**: `FA.resetState(obj)`, `FA.getState()`, `FA.setState(key, val)`
- **Registry**: `FA.register(registry, id, def)`, `FA.lookup(registry, id)`, `FA.lookupAll(registry)`
- **Game loop**: `FA.setUpdate(fn)`, `FA.setRender(fn)`, `FA.start()`, `FA.stop()` — **dt is in milliseconds** (~16.67ms per tick)
- **Canvas**: `FA.initCanvas(id, w, h)`, `FA.getCtx()`, `FA.getCanvas()`
- **Layers**: `FA.addLayer(name, drawFn, order)`, `FA.renderLayers()` — **every layer accessing `state.player`/`state.enemies`/`state.items` MUST start with `if (!state.player) return;`** (title screen has no player; an error in any layer kills the game loop permanently)
- **Draw**: `FA.draw.clear/rect/text/bar/circle/sprite/pushAlpha/popAlpha` — **Use `pushAlpha(alpha)`/`popAlpha()` for alpha control** (avoids closure allocation per iteration)
- **Input**: `FA.bindKey(action, keys)`, `FA.isAction(action)`, `FA.consumeClick()`
- **Audio**: `FA.defineSound(name, fn)`, `FA.playSound(name)` — built-in: hit, pickup, death, step, spell, levelup
- **Effects**: `FA.addFloat(x, y, text, color, dur)`, `FA.addEffect(obj)`, `FA.updateFloats(dt)`, `FA.drawFloats()`, `FA.clearEffects()`
- **Narrative**: `FA.narrative.init(cfg)`, `.transition(graphId, nodeId, event)`, `.setVar(name, val, reason)`, `.getVar(name)`, `.getNode(graphId)`, `.getEvents()`
- **Content selection**: `FA.select(entries)` — first matching entry wins. Conditions: `{ node: 'graphId:nodeId' }`, `{ var: 'name', eq|gte|lte: val }`, no condition = fallback. Use for dialogues/thoughts.
- **Conditional edges**: edges with `var`/`eq`/`gte`/`lte` auto-trigger on `setVar()`. Unconditional edges = manual `transition()` only. Use for NPC relationship graphs, progression thresholds.
- **Utils**: `FA.rand(min,max)`, `FA.clamp(val,min,max)`, `FA.pick(arr)`, `FA.shuffle(arr)`, `FA.uid()`

## rot.js API (window.ROT)

rot.js provides battle-tested roguelike algorithms. **Use these instead of hand-rolling.**

### Map Generation

```js
var digger = new ROT.Map.Digger(cols, rows, {
  roomWidth: [min, max], roomHeight: [min, max], dugPercentage: 0.35
});
digger.create(function(x, y, value) { map[y][x] = value; });  // value: 0=floor, 1=wall
var rooms = digger.getRooms();  // Room objects
// Room API: room.getLeft(), getRight(), getTop(), getBottom(), getCenter() -> [cx, cy]
```

**Alternatives**: `ROT.Map.Uniform` (guaranteed connectivity), `ROT.Map.Cellular` (organic caves — good for overworlds), `ROT.Map.Arena` (single open room)

### Pathfinding

```js
var astar = new ROT.Path.AStar(toX, toY, function(x, y) {
  return isWalkable(map, x, y);
}, { topology: 4 });
var path = [];
astar.compute(fromX, fromY, function(x, y) { path.push({x: x, y: y}); });
// path[0] = start, path[1] = next step
```

### Field of View

```js
var fov = new ROT.FOV.PreciseShadowcasting(function(x, y) {
  return map[y] && map[y][x] !== 1;  // light passes through non-walls
});
fov.compute(px, py, radius, function(x, y, r, visibility) {
  // visibility: 0..1 — use for lighting falloff
});
```

### DO NOT USE
- `ROT.Display` — we have our own canvas renderer (`FA.draw.*`, `FA.addLayer()`)
- `ROT.Engine` — we have our own game loop (`FA.setUpdate`, `FA.start`)

### Available but optional
- `ROT.RNG.setSeed(seed)` / `.getUniformInt(min, max)` / `.shuffle(arr)` — seedable RNG for reproducible runs
- `ROT.Scheduler.Speed` — turn scheduling with varied actor speeds: actors implement `getSpeed()`, use `.add(actor, repeat)`, `.next()`

## Events

| Event | Description |
|-------|-------------|
| `input:action` | Key bound to an action was pressed |
| `entity:damaged` | Something took damage |
| `entity:killed` | Something was killed |
| `item:pickup` | Item picked up |
| `game:over` | Game over (victory/score) |
| `state:changed` | State changed |
| `narrative:transition` | Narrative graph node transition |

## Scoring

`ForkArcade.submitScore(score)` in the `game:over` event handler.

## Sprites (optional — ASCII is the base)

`FA.draw.sprite(category, name, x, y, size, fallbackChar, fallbackColor, frame)` — renders sprite frame, or fallback text when no sprite exists. Frame index selects which variant to render.

### Frame conventions
- **Enemies**: frame 0 = alive, frame 1 = dead/destroyed
- **Player**: frame 0 = base, frame 1 = shielded/buffed
- **Tiles**: frames for visual variants

## Entity collision rules

**No two entities may share a tile.** This applies to player, enemies, and NPCs on all maps.

| Bump target | Result |
|-------------|--------|
| Hostile enemy | Attack (bump combat) |
| Friendly NPC | Swap positions (player and NPC exchange tiles) |
| System NPC (dungeon) | Talk (player stays, consumes turn) |

`isWalkable(map, x, y)` checks terrain only (`tile !== 1 && tile !== 9`). Entity collision is checked separately — `canStep()` for enemies, `canStepOverworld()` for NPCs. Both block movement onto player and onto other entities of the same type.

## Overworld patterns (see `_prompt.md` for full details)

- **Zones**: detect zone from tile type → zone-specific HUD (bg color, name, actions). Makes each area feel distinct.
- **NPC pace/idle**: `pace` (move every N turns), `idleTimer` (linger at goals), `turnCounter` (staggered starts). Desynchronizes NPC movement.
- **NPC approach**: `wantsToTalk` flag → NPC sets goal to player → auto-initiates dialogue when adjacent → follows max 3 turns then gives up.
- **Narrative-driven NPC**: `narrative:transition` listener marks NPCs as `wantsToTalk` when story changes. Daily reset restores flags.

## What to avoid

- Real-time movement (must be turn-based)
- Hand-rolling dungeon generation, pathfinding, or FOV — use `ROT.Map.*`, `ROT.Path.AStar`, `ROT.FOV.PreciseShadowcasting`
- Letting entities share tiles — always check entity collision after terrain check
- Complex inventory/crafting systems
- Animations between turns (instant feedback, floats for damage numbers)
- Modifying ENGINE files (`rot.min.js`, `fa-*.js`)
- Behaviors registered as functions — use AI state machine with string tags instead
