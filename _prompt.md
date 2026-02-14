# Roguelike — Game Design Prompt

You are creating a Roguelike game for the ForkArcade platform. The game uses multi-file architecture with the FA engine.

## File architecture

```
forkarcade-sdk.js   — PLATFORM: SDK (scoring, auth) (do not modify)
fa-narrative.js     — PLATFORM: narrative module (do not modify)
sprites.js          — generated from _sprites.json (do not modify manually)
fa-engine.js        — ENGINE (from template): game loop, event bus, state, registry (do not modify)
fa-renderer.js      — ENGINE (from template): canvas, layers, draw helpers (do not modify)
fa-input.js         — ENGINE (from template): keyboard/mouse, keybindings (do not modify)
fa-audio.js         — ENGINE (from template): Web Audio, sounds (do not modify)
data.js             — GAME DATA: definitions of enemies, spells, items, floors
game.js             — GAME LOGIC: dungeon gen, FOV, combat, turns, AI
render.js           — RENDERING: map, entity, UI, overlay
main.js             — ENTRY POINT: keybindings, wiring, ForkArcade.onReady
```

**You only modify: `data.js`, `game.js`, `render.js`, `main.js`.**

## Key mechanics

### Dungeon generation
- Procedural generation (BSP / cellular automata / drunkard walk)
- Tile-based: wall, floor, stairs
- Each new floor = harder

### Movement and exploration
- Turn-based: player moves → enemies react → render
- FOV: raycasting, radius 5-7 tiles
- Explored but not visible = dimmed

### Combat
- Bump-to-attack
- Formula: `damage = atk - def + FA.rand(-1, 2)`
- Enemies defined by behavior in registry

### Permadeath
- Death = end of run → `ForkArcade.submitScore()`

## Scoring
```
score = (floor * 100) + (kills * 10) + gold + (items * 25) + (boss ? 500 : 0)
```

## How to add content (data.js)

### New enemy
```js
FA.register('enemies', 'shadow_drake', {
  name: 'Shadow Drake', char: 'D', color: '#808',
  hp: 35, atk: 7, def: 2, xp: 25,
  behavior: 'ranged',
  lore: 'Shadow dragon hunting in the darkness'
});
```

### New spell
```js
FA.register('spells', 'Chain Lightning', {
  name: 'Chain Lightning', cost: 5, type: 'chain', range: 6,
  sound: 'spell', effectColor: '#48f',
  effect: function(caster, targets, state) {
    var dmg = 6;
    targets.forEach(function(e) { e.hp -= dmg; });
    return { msg: 'Chain Lightning!', color: '#48f' };
  }
});
```

### New item
```js
FA.register('items', 'fire_ring', {
  name: 'Ring of Fire', char: 'o', color: '#f84',
  type: 'accessory', atk: 3,
  description: 'Ring of flames — +3 ATK'
});
```

### New floor
```js
FA.register('floors', 3, {
  name: 'Armory',
  enemies: [['phantom', 1], ['mage', 2], ['armor', 2]],
  ambientMessages: ['Metal clangs...', 'Armor rotates...'],
  encounters: ['ghost-knight']
});
```

### New enemy behavior
```js
FA.register('behaviors', 'ranged', {
  act: function(enemy, state) {
    var p = state.player;
    var dist = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
    if (dist <= 1) return { type: 'flee', target: p };
    if (dist <= 3) return { type: 'ranged_attack', target: p };
    return { type: 'chase', target: p };
  }
});
```

## Event bus — key events

| Event | Payload | When |
|-------|---------|-------|
| `input:action` | `{ action, key }` | Player pressed key |
| `entity:damaged` | `{ entity, damage, attacker }` | Someone took damage |
| `entity:killed` | `{ entity, killer }` | Someone died |
| `item:pickup` | `{ item, entity }` | Item picked up |
| `floor:changed` | `{ floor, name }` | New floor |
| `game:over` | `{ victory, score }` | Game over |
| `message` | `{ text, color }` | Message to log |
| `narrative:transition` | `{ from, to, event }` | Narrative node change |

## Rendering (render.js)

Use layer system. **Every layer that accesses `state.player`, `state.enemies`, or `state.items` MUST guard against missing state** — the title screen and game-over states don't have these properties. An uncaught error in any layer kills the entire game loop permanently.

```js
FA.addLayer('map', function(ctx) {
  var state = FA.getState();
  if (!state.map) return;
  // draw tiles with FOV
}, 0);

FA.addLayer('entities', function(ctx) {
  var state = FA.getState();
  if (!state.player) return;  // REQUIRED — no player during title screen
  // draw enemies and player — FA.draw.sprite with fallback
}, 10);

FA.addLayer('floats', function(ctx) {
  var state = FA.getState();
  if (!state.player) return;  // REQUIRED if using camera based on player position
  // FA.drawFloats()
}, 20);

FA.addLayer('ui', function(ctx) {
  var state = FA.getState();
  if (!state.player) return;  // REQUIRED — no stats during title screen
  // HP/MP bar, floor info, spells — FA.draw.bar, FA.draw.text
}, 30);

FA.addLayer('title', function(ctx) {
  var state = FA.getState();
  if (!state.showTitle) return;
  // title screen — only needs showTitle flag
}, 40);
```

## Narrative

Use `FA.narrative` (from engine):
```js
FA.narrative.init({
  startNode: 'surface',
  variables: { corruption: 0, npcs_saved: 0, cursed: false },
  graph: { nodes: [...], edges: [...] }
});

FA.narrative.transition('dungeon-1', 'Descended to level 1');
FA.narrative.setVar('corruption', 3, 'Touched dark artifact');
```

Node types: `scene`, `choice`, `condition`.

## Sprites

Use `create_sprite` and `get_asset_guide` from MCP tools. Integration:
```js
FA.draw.sprite('enemies', 'rat', x, y, tileSize, 'r', '#a86')
```
Last 2 arguments = fallback char and color when sprite is missing.

## What to avoid
- Real-time instead of turn-based
- Complicated inventory/crafting
- Animations between turns (instant feedback)
- Modifying ENGINE files (fa-*.js)
