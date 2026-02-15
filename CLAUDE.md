# Roguelike — ForkArcade

Procedural dungeons, permadeath, tile-based movement, turn-based combat.

## File structure

| File | Description |
|------|-------------|
| `data.js` | Data registration: `FA.register('enemies', ...)`, `FA.register('items', ...)`, config, modules, narrative, thoughts |
| `game.js` | Logic: map generation, movement, combat, AI state machine, floor management, turns |
| `render.js` | Render layers: map (autotiled walls), entities (with glow), lighting, effects, UI, overlays |
| `main.js` | Entry point: keybindings, input routing, game loop timers, `ForkArcade.onReady/submitScore` |

Template files (do not edit):
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
- **Narrative**: `FA.narrative.init(cfg)`, `.transition(nodeId, event)`, `.setVar(name, val, reason)`, `.getVar(name)`, `.getNode()`, `.getEvents()`
- **Utils**: `FA.rand(min,max)`, `FA.clamp(val,min,max)`, `FA.pick(arr)`, `FA.shuffle(arr)`, `FA.uid()`

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
