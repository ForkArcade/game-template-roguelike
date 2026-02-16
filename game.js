// Roguelike — Game Logic
// Map generation (ROT.Map), pathfinding (ROT.Path), FOV (ROT.FOV), combat, AI, floor management
(function() {
  'use strict';
  var FA = window.FA;

  // === MAP GENERATION (rot.js) ===

  function generateFloor(cols, rows, depth, maxDepth) {
    var cfg = FA.lookup('config', 'game');

    // Generate dungeon using ROT.Map.Digger
    var digger = new ROT.Map.Digger(cols, rows, {
      roomWidth: [cfg.roomMinSize, cfg.roomMaxSize],
      roomHeight: [cfg.roomMinSize, cfg.roomMaxSize],
      dugPercentage: 0.35 + depth * 0.03
    });

    var map = [];
    for (var y = 0; y < rows; y++) { map[y] = []; for (var x = 0; x < cols; x++) map[y][x] = 1; }
    digger.create(function(x, y, value) { map[y][x] = value; });

    // Convert ROT rooms to our format { x, y, w, h }
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

    // Fallback if not enough rooms
    if (rooms.length < 2) {
      rooms = [{ x: 2, y: 2, w: 5, h: 5 }, { x: cols - 8, y: rows - 8, w: 5, h: 5 }];
      for (var fy = 0; fy < rooms.length; fy++) {
        var fr = rooms[fy];
        for (var ry = fr.y; ry < fr.y + fr.h; ry++) {
          for (var rx = fr.x; rx < fr.x + fr.w; rx++) map[ry][rx] = 0;
        }
      }
    }

    // Stairs
    var stairsDown = null;
    if (depth < maxDepth) {
      var lastRoom = rooms[rooms.length - 1];
      var sdx = Math.floor(lastRoom.x + lastRoom.w / 2);
      var sdy = Math.floor(lastRoom.y + lastRoom.h / 2);
      map[sdy][sdx] = 2;
      stairsDown = { x: sdx, y: sdy };
    }
    var stairsUp = null;
    if (depth > 1) {
      var firstRoom = rooms[0];
      var sux = Math.floor(firstRoom.x + firstRoom.w / 2);
      var suy = Math.floor(firstRoom.y + firstRoom.h / 2);
      map[suy][sux] = 3;
      stairsUp = { x: sux, y: suy };
    }

    // TODO: place interactables (tile 4) in middle rooms

    // Explored grid
    var explored = [];
    for (var ey = 0; ey < rows; ey++) {
      explored[ey] = [];
      for (var ex = 0; ex < cols; ex++) explored[ey][ex] = false;
    }

    return { map: map, rooms: rooms, stairsDown: stairsDown, stairsUp: stairsUp, explored: explored };
  }

  function findEmptyInRooms(map, rooms, occupied) {
    for (var i = 0; i < 200; i++) {
      var room = FA.pick(rooms);
      var x = FA.rand(room.x, room.x + room.w - 1);
      var y = FA.rand(room.y, room.y + room.h - 1);
      if (map[y][x] !== 0) continue;
      var taken = false;
      for (var j = 0; j < occupied.length; j++) {
        if (occupied[j].x === x && occupied[j].y === y) { taken = true; break; }
      }
      if (!taken) return { x: x, y: y };
    }
    return { x: rooms[0].x + 1, y: rooms[0].y + 1 };
  }

  function isWalkable(map, x, y) {
    if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return false;
    return map[y][x] !== 1;
  }

  // === FOV (rot.js) ===

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

    return vis;
  }

  // === PATHFINDING (rot.js) ===

  function findPath(fromX, fromY, toX, toY, map) {
    var path = [];
    var astar = new ROT.Path.AStar(toX, toY, function(x, y) {
      return isWalkable(map, x, y);
    }, { topology: 4 });
    astar.compute(fromX, fromY, function(x, y) { path.push({ x: x, y: y }); });
    return path;  // path[0] = start, path[1] = next step
  }

  // === POPULATE FLOOR ===

  function populateFloor(map, rooms, depth) {
    var occupied = [];
    var enemies = [];
    var items = [];

    // TODO: spawn enemies based on depth
    // Each enemy needs: id, x, y, hp, maxHp, atk, def, char, color, name, behavior, stunTurns,
    //   aiState: 'patrol', alertTarget: null, alertTimer: 0, patrolTarget: null

    // TODO: spawn items (gold, potions, modules) based on depth

    return { enemies: enemies, items: items };
  }

  // === SCREENS ===

  function startGame() {
    FA.resetState({ screen: 'start' });
    FA.clearEffects();
  }

  function beginPlaying() {
    var cfg = FA.lookup('config', 'game');
    var floor = generateFloor(cfg.cols, cfg.rows, 1, cfg.maxDepth);
    var populated = populateFloor(floor.map, floor.rooms, 1);

    var firstRoom = floor.rooms[0];
    var px = Math.floor(firstRoom.x + firstRoom.w / 2);
    var py = Math.floor(firstRoom.y + firstRoom.h / 2);
    if (floor.map[py][px] !== 0) { px = firstRoom.x + 1; py = firstRoom.y + 1; }

    var floors = {};
    floors[1] = {
      map: floor.map, rooms: floor.rooms,
      enemies: populated.enemies, items: populated.items,
      stairsDown: floor.stairsDown, stairsUp: floor.stairsUp,
      explored: floor.explored
    };

    var lightRadius = 10 - 0.5;
    FA.resetState({
      screen: 'playing',
      map: floor.map,
      explored: floor.explored,
      visible: computeVisibility(floor.map, px, py, lightRadius),
      player: {
        x: px, y: py, hp: 20, maxHp: 20, atk: 5, def: 1, gold: 0, kills: 0,
        modules: []
        // TODO: add buff fields (cloakTurns, overclockActive, firewallHp, etc.)
      },
      enemies: populated.enemies,
      items: populated.items,
      depth: 1,
      maxDepthReached: 1,
      floors: floors,
      messages: [],
      narrativeMessage: null,
      turn: 0,
      shake: 0, particles: [], soundWaves: [],
      thoughts: [], lastThoughtTurn: -10
    });

    FA.clearEffects();
    var narCfg = FA.lookup('config', 'narrative');
    if (narCfg) FA.narrative.init(narCfg);
    showNarrative('arc', 'start');
  }

  // === FLOOR TRANSITION ===

  function changeFloor(direction) {
    var state = FA.getState();
    var cfg = FA.lookup('config', 'game');
    var oldDepth = state.depth;
    var newDepth = direction === 'down' ? oldDepth + 1 : oldDepth - 1;

    // Save current floor
    state.floors[oldDepth].enemies = state.enemies;
    state.floors[oldDepth].items = state.items;
    state.floors[oldDepth].explored = state.explored;

    // Generate or load target floor
    if (!state.floors[newDepth]) {
      var floor = generateFloor(cfg.cols, cfg.rows, newDepth, cfg.maxDepth);
      var populated = populateFloor(floor.map, floor.rooms, newDepth);
      state.floors[newDepth] = {
        map: floor.map, rooms: floor.rooms,
        enemies: populated.enemies, items: populated.items,
        stairsDown: floor.stairsDown, stairsUp: floor.stairsUp,
        explored: floor.explored
      };
    }

    var target = state.floors[newDepth];
    state.map = target.map;
    state.enemies = target.enemies;
    state.items = target.items;
    state.explored = target.explored;
    state.depth = newDepth;
    if (newDepth > state.maxDepthReached) state.maxDepthReached = newDepth;

    // Place player at appropriate stairs
    if (direction === 'down' && target.stairsUp) {
      state.player.x = target.stairsUp.x;
      state.player.y = target.stairsUp.y;
    } else if (direction === 'up' && target.stairsDown) {
      state.player.x = target.stairsDown.x;
      state.player.y = target.stairsDown.y;
    }

    // Recompute FOV
    var lightRadius = 10 - (newDepth) * 0.5;
    state.visible = computeVisibility(state.map, state.player.x, state.player.y, lightRadius);

    FA.clearEffects();
    addMessage(direction === 'down' ? '> Descending to level ' + newDepth + '...' : '> Returning to level ' + newDepth + '...');
    triggerThought('floor_enter');
  }

  // === NARRATIVE ===

  function showNarrative(graphId, nodeId) {
    FA.narrative.transition(graphId, nodeId);
    var narText = FA.lookup('narrativeText', nodeId);
    if (narText) {
      FA.getState().narrativeMessage = { text: narText.text, color: narText.color, life: 4000, maxLife: 4000 };
      addMessage(narText.text);
    }
    // TODO: check for cutscene definition and trigger if exists
  }

  function selectDialogue(npcId) {
    var entry = FA.select(FA.lookup('dialogues', npcId));
    return entry ? entry.text : null;
  }

  // === MOVEMENT ===

  function movePlayer(dx, dy) {
    var state = FA.getState();
    if (state.screen !== 'playing') return;
    var nx = state.player.x + dx;
    var ny = state.player.y + dy;

    // Bump attack (hostile)
    for (var i = 0; i < state.enemies.length; i++) {
      if (state.enemies[i].x === nx && state.enemies[i].y === ny) {
        attackEnemy(state.player, state.enemies[i], i);
        endTurn();
        return;
      }
    }

    if (!isWalkable(state.map, nx, ny)) return;

    // Bump friendly NPC → swap positions (no tile sharing)
    // TODO: if game has NPCs, check for NPC at (nx,ny) and swap

    state.player.x = nx;
    state.player.y = ny;
    FA.playSound('step');

    // Tile interactions
    var tile = state.map[ny][nx];
    if (tile === 2) { changeFloor('down'); return; }
    if (tile === 3) { changeFloor('up'); return; }
    // TODO: tile 4 = interactable (terminal/shrine)

    // Item pickup
    for (var j = state.items.length - 1; j >= 0; j--) {
      if (state.items[j].x === nx && state.items[j].y === ny) {
        pickupItem(state.items[j], j);
      }
    }
    endTurn();
  }

  function attackEnemy(attacker, target, idx) {
    var state = FA.getState();
    var cfg = FA.lookup('config', 'game');
    var ts = cfg.tileSize;
    var dmg = Math.max(1, attacker.atk - target.def + FA.rand(-1, 2));
    target.hp -= dmg;
    FA.emit('entity:damaged', { entity: target, damage: dmg });
    FA.addFloat(target.x * ts + ts / 2, target.y * ts, '-' + dmg, '#f44', 800);
    addMessage('You deal ' + dmg + ' to ' + target.name + '.');
    propagateSound(state, target.x, target.y, 8);

    if (target.hp <= 0) {
      state.enemies.splice(idx, 1);
      state.player.kills++;
      FA.emit('entity:killed', { entity: target });

      // Kill burst particles
      var bx = target.x * ts + ts / 2, by = target.y * ts + ts / 2;
      for (var pi = 0; pi < 8; pi++) {
        var angle = (pi / 8) * Math.PI * 2 + Math.random() * 0.5;
        state.particles.push({
          x: bx, y: by,
          vx: Math.cos(angle) * (40 + Math.random() * 30),
          vy: Math.sin(angle) * (40 + Math.random() * 30),
          life: 500, maxLife: 500, color: target.color
        });
      }
      addMessage(target.name + ' destroyed.');
      // TODO: check win condition, check path/climax
    }
  }

  function pickupItem(item, idx) {
    var state = FA.getState();
    state.items.splice(idx, 1);
    FA.emit('item:pickup', { item: item });
    // TODO: handle by item.type (gold, potion, module)
    addMessage('Picked up ' + (item.name || item.type) + '.');
  }

  // === AI SYSTEM ===

  function hasLOS(map, x1, y1, x2, y2) {
    var dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    var sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    var err = dx - dy;
    var cx = x1, cy = y1;
    while (true) {
      if (cx === x2 && cy === y2) return true;
      var e2 = err * 2;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
      if (cx === x2 && cy === y2) return true;
      if (cy < 0 || cy >= map.length || cx < 0 || cx >= map[0].length) return false;
      if (map[cy][cx] === 1) return false;
    }
  }

  function canStep(x, y, state, skipIdx) {
    if (!isWalkable(state.map, x, y)) return false;
    if (isOccupied(x, y, skipIdx)) return false;
    if (x === state.player.x && y === state.player.y) return false;
    return true;
  }

  function isOccupied(x, y, skipIdx) {
    var enemies = FA.getState().enemies;
    for (var i = 0; i < enemies.length; i++) {
      if (i === skipIdx) continue;
      if (enemies[i].x === x && enemies[i].y === y) return true;
    }
    return false;
  }

  function moveToward(e, tx, ty, state, skipIdx) {
    // Use A* pathfinding for smart movement
    var path = findPath(e.x, e.y, tx, ty, state.map);
    if (path.length >= 2) {
      var next = path[1];
      if (canStep(next.x, next.y, state, skipIdx)) {
        e.x = next.x; e.y = next.y;
        return true;
      }
    }
    // Fallback to direct movement if A* blocked by entities
    var dx = tx - e.x, dy = ty - e.y;
    var sx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    var sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    var moves;
    if (Math.abs(dx) >= Math.abs(dy)) {
      moves = [{dx: sx, dy: 0}, {dx: 0, dy: sy || 1}, {dx: 0, dy: -(sy || 1)}];
    } else {
      moves = [{dx: 0, dy: sy}, {dx: sx || 1, dy: 0}, {dx: -(sx || 1), dy: 0}];
    }
    for (var i = 0; i < moves.length; i++) {
      if (moves[i].dx === 0 && moves[i].dy === 0) continue;
      var nx = e.x + moves[i].dx, ny = e.y + moves[i].dy;
      if (canStep(nx, ny, state, skipIdx)) {
        e.x = nx; e.y = ny;
        return true;
      }
    }
    return false;
  }

  function flankTarget(e, tx, ty, state, skipIdx) {
    var dx = tx - e.x, dy = ty - e.y;
    var moves;
    if (Math.abs(dx) >= Math.abs(dy)) {
      moves = [{dx: 0, dy: 1}, {dx: 0, dy: -1}];
    } else {
      moves = [{dx: 1, dy: 0}, {dx: -1, dy: 0}];
    }
    if (Math.random() > 0.5) { var t = moves[0]; moves[0] = moves[1]; moves[1] = t; }
    for (var i = 0; i < moves.length; i++) {
      var nx = e.x + moves[i].dx, ny = e.y + moves[i].dy;
      if (canStep(nx, ny, state, skipIdx)) {
        e.x = nx; e.y = ny;
        return true;
      }
    }
    return moveToward(e, tx, ty, state, skipIdx);
  }

  function randomStep(e, state, skipIdx) {
    var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (var i = dirs.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = dirs[i]; dirs[i] = dirs[j]; dirs[j] = t;
    }
    for (var d = 0; d < dirs.length; d++) {
      var nx = e.x + dirs[d][0], ny = e.y + dirs[d][1];
      if (canStep(nx, ny, state, skipIdx)) {
        e.x = nx; e.y = ny;
        return;
      }
    }
  }

  function propagateSound(state, x, y, radius) {
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (e.aiState === 'hunting') continue;
      var dist = Math.abs(e.x - x) + Math.abs(e.y - y);
      if (dist <= radius) {
        e.aiState = 'alert';
        e.alertTarget = { x: x, y: y };
        e.alertTimer = 8;
      }
    }
    if (state.soundWaves) state.soundWaves.push({ tx: x, ty: y, maxR: radius, life: 500 });
  }

  function computeEnemyAction(e, state) {
    var p = state.player;
    var dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    var sightRange = 8;  // TODO: vary by enemy behavior
    var canSee = dist <= sightRange && hasLOS(state.map, e.x, e.y, p.x, p.y);

    // Adjacent = always attack
    if (dist === 1) {
      e.aiState = 'hunting';
      return { type: 'attack' };
    }

    // State transitions
    if (canSee) {
      e.aiState = 'hunting';
      e.alertTarget = { x: p.x, y: p.y };
    } else if (e.aiState === 'hunting') {
      e.aiState = 'alert';
      e.alertTimer = 8;
    }

    if (e.aiState === 'alert') {
      e.alertTimer--;
      if (e.alertTimer <= 0) {
        e.aiState = 'patrol';
        e.alertTarget = null;
        e.patrolTarget = null;
      }
    }

    switch (e.aiState) {
      case 'hunting':
        return { type: 'chase' };
      case 'alert':
        if (e.alertTarget) {
          if (e.x === e.alertTarget.x && e.y === e.alertTarget.y) return { type: 'random' };
          return { type: 'investigate' };
        }
        return { type: 'random' };
      default:  // patrol
        if (!e.patrolTarget || (e.x === e.patrolTarget.x && e.y === e.patrolTarget.y)) {
          var rooms = state.floors[state.depth].rooms;
          var room = rooms[Math.floor(Math.random() * rooms.length)];
          e.patrolTarget = { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
        }
        return { type: 'patrol' };
    }
  }

  function applyDamageToPlayer(dmg, sourceName, state) {
    // TODO: check shield/firewall absorption
    state.player.hp -= dmg;
    state.shake = 6;
    FA.emit('entity:damaged', { entity: state.player, damage: dmg });
    var cfg = FA.lookup('config', 'game');
    var ts = cfg.tileSize;
    FA.addFloat(state.player.x * ts + ts / 2, state.player.y * ts, '-' + dmg, '#f84', 800);
    addMessage(sourceName + ' deals ' + dmg + ' damage!');
    if (state.player.hp <= 0) {
      endGame(false);
    }
  }

  function enemyTurn() {
    var state = FA.getState();
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (e.stunTurns > 0) { e.stunTurns--; continue; }

      var action = computeEnemyAction(e, state);

      switch (action.type) {
        case 'attack':
          var dmg = Math.max(1, e.atk - state.player.def + FA.rand(-1, 1));
          applyDamageToPlayer(dmg, e.name, state);
          if (state.player.hp <= 0) return;
          break;
        case 'chase':
          moveToward(e, state.player.x, state.player.y, state, i);
          break;
        case 'flank':
          flankTarget(e, state.player.x, state.player.y, state, i);
          break;
        case 'investigate':
          moveToward(e, e.alertTarget.x, e.alertTarget.y, state, i);
          break;
        case 'patrol':
          if (e.patrolTarget) moveToward(e, e.patrolTarget.x, e.patrolTarget.y, state, i);
          break;
        case 'random':
          randomStep(e, state, i);
          break;
      }
    }
  }

  function endTurn() {
    var state = FA.getState();
    if (state.screen !== 'playing') return;
    state.turn++;

    // Recompute FOV after player action
    var lightRadius = 10 - (state.depth || 1) * 0.5;
    state.visible = computeVisibility(state.map, state.player.x, state.player.y, lightRadius);

    enemyTurn();
    checkThoughts(state);
  }

  function endGame(victory) {
    var state = FA.getState();
    state.screen = victory ? 'victory' : 'defeat';
    var scoring = FA.lookup('config', 'scoring');
    state.score = (state.player.kills * scoring.killMultiplier) +
                  (state.player.gold * scoring.goldMultiplier) +
                  ((state.maxDepthReached - 1) * scoring.depthBonus);
    FA.emit('game:over', { victory: victory, score: state.score });
  }

  // === MESSAGES ===

  function addMessage(text) {
    var color = '#556';
    if (text.indexOf('destroyed') >= 0 || text.indexOf('damage') >= 0) color = '#f44';
    else if (text.charAt(0) === '+') color = '#4f4';
    else if (text.charAt(0) === '>') color = '#8af';
    // TODO: add more auto-detection patterns
    var msgs = FA.getState().messages;
    msgs.push({ text: text, color: color });
    if (msgs.length > 6) msgs.shift();
  }

  // === THOUGHT SYSTEM ===

  function addThought(text) {
    var state = FA.getState();
    state.thoughts.push({ text: text, timer: 0, speed: 30, done: false, life: 8000 });
    if (state.thoughts.length > 4) state.thoughts.shift();
    state.lastThoughtTurn = state.turn;
  }

  function triggerThought(category) {
    var state = FA.getState();
    if (state.turn - (state.lastThoughtTurn || 0) < 5) return;
    var entry = FA.select(FA.lookup('thoughts', category));
    if (!entry || !entry.pool || !entry.pool.length) return;
    addThought(FA.pick(entry.pool));
  }

  function checkThoughts(state) {
    var prev = state._prevThought || {};
    if (state.depth !== prev.depth) triggerThought('floor_enter');
    if (state.player.kills > (prev.kills || 0)) triggerThought('combat');
    if (state.player.hp < (prev.hp || state.player.maxHp)) {
      if (state.player.hp < state.player.maxHp * 0.3) triggerThought('low_health');
      else triggerThought('damage');
    }
    if (state.turn > 0 && state.turn % 20 === 0) triggerThought('ambient');
    // TODO: add more triggers (pickup, terminal hack, path activation)
    state._prevThought = {
      depth: state.depth, kills: state.player.kills, hp: state.player.hp
    };
  }

  function dismissThought() {
    FA.getState().thoughts = [];
  }

  // === EXPORTS ===

  window.Game = {
    start: startGame,
    begin: beginPlaying,
    movePlayer: movePlayer,
    useModule: function(idx) { /* TODO */ },
    dismissCutscene: function() { /* TODO */ },
    dismissThought: dismissThought
  };

})();
