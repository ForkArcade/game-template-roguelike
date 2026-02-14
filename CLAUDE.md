# Roguelike — ForkArcade

Proceduralne dungeony, permadeath, tile-based movement, turowy combat.

## Struktura plików

| Plik | Opis |
|------|------|
| `data.js` | Rejestracja danych: `FA.register('enemies', ...)`, `FA.register('items', ...)`, config, behaviors, narrative |
| `game.js` | Logika: generacja mapy, ruch, combat, AI, tury |
| `render.js` | Warstwy renderowania: mapa, entity, floats, UI, overlay |
| `main.js` | Entry point: keybindings, event wiring, game loop, `ForkArcade.onReady/submitScore` |

Pliki z szablonu (nie edytuj):
- `fa-engine.js`, `fa-renderer.js`, `fa-input.js`, `fa-audio.js` — engine

Pliki kopiowane przez platformę (nie edytuj):
- `forkarcade-sdk.js` — SDK (scoring, auth)
- `fa-narrative.js` — moduł narracji (graf, zmienne, transition)
- `sprites.js` — generowany z `_sprites.json`

## Engine API (window.FA)

- **Event bus**: `FA.on(event, fn)`, `FA.emit(event, data)`, `FA.off(event, fn)`
- **State**: `FA.resetState(obj)`, `FA.getState()`, `FA.setState(key, val)`
- **Registry**: `FA.register(registry, id, def)`, `FA.lookup(registry, id)`, `FA.lookupAll(registry)`
- **Game loop**: `FA.setUpdate(fn)`, `FA.setRender(fn)`, `FA.start()`, `FA.stop()` — **UWAGA: `dt` jest w milisekundach** (~16.67ms per tick)
- **Canvas**: `FA.initCanvas(id, w, h)`, `FA.getCtx()`, `FA.getCanvas()`
- **Layers**: `FA.addLayer(name, drawFn, order)`, `FA.renderLayers()` — **every layer accessing `state.player`/`state.enemies`/`state.items` MUST start with `if (!state.player) return;`** (title screen has no player; an error in any layer kills the game loop permanently)
- **Draw**: `FA.draw.clear/rect/text/bar/circle/sprite/withAlpha`
- **Input**: `FA.bindKey(action, keys)`, `FA.isAction(action)`, `FA.consumeClick()`
- **Audio**: `FA.defineSound(name, fn)`, `FA.playSound(name)` — built-in: hit, pickup, death, step, spell, levelup
- **Effects**: `FA.addFloat(x, y, text, color, dur)`, `FA.addEffect(obj)`, `FA.updateFloats(dt)`
- **Narrative**: `FA.narrative.init(cfg)`, `.transition(nodeId, event)`, `.setVar(name, val, reason)`
- **Utils**: `FA.rand(min,max)`, `FA.clamp`, `FA.pick(arr)`, `FA.shuffle(arr)`, `FA.uid()`

## Eventy

| Event | Opis |
|-------|------|
| `input:action` | Klawisz zbindowany do akcji |
| `entity:damaged` | Coś dostało obrażenia |
| `entity:killed` | Coś zginęło |
| `item:pickup` | Podniesienie przedmiotu |
| `game:over` | Koniec gry (victory/score) |
| `state:changed` | Zmiana stanu |
| `narrative:transition` | Przejście w grafie narracji |

## Scoring

`ForkArcade.submitScore(score)` w obsłudze `game:over`.

## Sprite fallback

`FA.draw.sprite(category, name, x, y, size, fallbackChar, fallbackColor)` — jeśli brak sprite'a, rysuje tekst.
