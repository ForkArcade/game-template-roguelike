(function() {
  'use strict';
  var FA = window.FA;

  // === LOCATION REGISTRY ===

  function locGet(mapId) { return FA.lookup('locations', mapId) || null; }
  function locDepth(mapId) { var l = locGet(mapId); return l ? (l.depth || 0) : 0; }
  function locIsDungeon(mapId) { var l = locGet(mapId); return l ? !!l.dungeon : false; }
  function locPalette(mapId) { var l = locGet(mapId); return l ? (l.palette || null) : null; }
  function locHasEffect(mapId, name) {
    var l = locGet(mapId);
    if (!l || !l.effects) return false;
    for (var i = 0; i < l.effects.length; i++) { if (l.effects[i] === name) return true; }
    return false;
  }

  window.Location = { get: locGet, depth: locDepth, isDungeon: locIsDungeon, palette: locPalette, hasEffect: locHasEffect };

  // === MAP GENERATION ===

  function generateFloor(cols, rows, depth, maxDepth) {
    var cfg = FA.lookup('config', 'game');
    var digger = new ROT.Map.Digger(cols, rows, {
      roomWidth: [cfg.roomMin, cfg.roomMax],
      roomHeight: [cfg.roomMin, cfg.roomMax],
      dugPercentage: 0.35 + depth * 0.03
    });
    var map = [];
    for (var y = 0; y < rows; y++) { map[y] = []; for (var x = 0; x < cols; x++) map[y][x] = 1; }
    digger.create(function(x, y, v) { map[y][x] = v; });

    var rotRooms = digger.getRooms();
    var rooms = [];
    for (var r = 0; r < rotRooms.length; r++) {
      var rr = rotRooms[r];
      rooms.push({ x: rr.getLeft(), y: rr.getTop(), w: rr.getRight() - rr.getLeft() + 1, h: rr.getBottom() - rr.getTop() + 1 });
    }
    if (rooms.length < 2) {
      rooms = [{ x: 2, y: 2, w: 5, h: 5 }, { x: cols - 8, y: rows - 8, w: 5, h: 5 }];
      for (var fi = 0; fi < rooms.length; fi++) {
        var fr = rooms[fi];
        for (var fy = fr.y; fy < fr.y + fr.h; fy++)
          for (var fx = fr.x; fx < fr.x + fr.w; fx++) map[fy][fx] = 0;
      }
    }

    var stairsDown = null;
    if (depth < maxDepth) {
      var last = rooms[rooms.length - 1];
      var sdx = Math.floor(last.x + last.w / 2), sdy = Math.floor(last.y + last.h / 2);
      map[sdy][sdx] = 2; stairsDown = { x: sdx, y: sdy };
    }
    var stairsUp = null;
    if (depth > 1) {
      var first = rooms[0];
      var sux = Math.floor(first.x + first.w / 2), suy = Math.floor(first.y + first.h / 2);
      map[suy][sux] = 3; stairsUp = { x: sux, y: suy };
    }

    var explored = [];
    for (var ey = 0; ey < rows; ey++) { explored[ey] = []; for (var ex = 0; ex < cols; ex++) explored[ey][ex] = false; }
    return { map: map, rooms: rooms, stairsDown: stairsDown, stairsUp: stairsUp, explored: explored };
  }

  function findEmpty(map, rooms, occupied) {
    for (var i = 0; i < 200; i++) {
      var room = FA.pick(rooms);
      var x = FA.rand(room.x, room.x + room.w - 1), y = FA.rand(room.y, room.y + room.h - 1);
      if (map[y][x] !== 0) continue;
      var taken = false;
      for (var j = 0; j < occupied.length; j++) { if (occupied[j].x === x && occupied[j].y === y) { taken = true; break; } }
      if (!taken) return { x: x, y: y };
    }
    return { x: rooms[0].x + 1, y: rooms[0].y + 1 };
  }

  function populateFloor(map, rooms, depth) {
    var occupied = [], entities = [], items = [];
    var types = FA.lookupAll('enemies');
    var typeKeys = Object.keys(types);
    var enemyCount = 3 + depth * 2;
    for (var e = 0; e < enemyCount; e++) {
      var key = typeKeys[FA.rand(0, typeKeys.length - 1)];
      var def = types[key];
      var pos = findEmpty(map, rooms, occupied);
      occupied.push(pos);
      var scale = 1 + (depth - 1) * 0.15;
      entities.push({
        id: FA.uid(), type: 'enemy', x: pos.x, y: pos.y,
        name: def.name, char: def.char, color: def.color, behavior: key,
        hp: Math.ceil(def.hp * scale), maxHp: Math.ceil(def.hp * scale),
        atk: Math.ceil(def.atk * scale), def: def.def, speed: def.speed,
        sightRange: def.sightRange || 8,
        aiState: 'patrol', alertTarget: null, alertTimer: 0,
        patrolTarget: null, turnWait: 0, stunTurns: 0
      });
    }
    var goldCount = 2 + depth;
    for (var g = 0; g < goldCount; g++) {
      var gp = findEmpty(map, rooms, occupied); occupied.push(gp);
      items.push({ x: gp.x, y: gp.y, type: 'gold', char: '$', color: '#ffd54f', name: 'Gold', value: FA.rand(5, 10 + depth * 5) });
    }
    var potionCount = FA.rand(1, 2);
    for (var p = 0; p < potionCount; p++) {
      var pp = findEmpty(map, rooms, occupied); occupied.push(pp);
      items.push({ x: pp.x, y: pp.y, type: 'potion', char: '!', color: '#e91e63', name: 'Potion', heal: 8 });
    }
    return { entities: entities, items: items };
  }

  // === COLLISION & MOVEMENT ===

  function isWalkable(map, x, y) {
    if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return false;
    return map[y][x] !== 1;
  }

  function canStep(x, y, skip) {
    var state = FA.getState();
    if (!isWalkable(state.map, x, y)) return false;
    if (state.player && x === state.player.x && y === state.player.y) return false;
    var ents = state.maps[state.mapId].entities;
    for (var i = 0; i < ents.length; i++) {
      if (ents[i] === skip) continue;
      if (ents[i].x === x && ents[i].y === y) return false;
    }
    return true;
  }

  function getEntityAt(x, y) {
    var state = FA.getState();
    var ents = state.maps[state.mapId].entities;
    for (var i = 0; i < ents.length; i++) { if (ents[i].x === x && ents[i].y === y) return ents[i]; }
    return null;
  }

  function hasLOS(map, x1, y1, x2, y2) {
    var dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    var sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    var err = dx - dy, cx = x1, cy = y1;
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

  function moveToward(e, tx, ty) {
    var state = FA.getState();
    var path = [];
    var astar = new ROT.Path.AStar(tx, ty, function(x, y) { return isWalkable(state.map, x, y); }, { topology: 4 });
    astar.compute(e.x, e.y, function(x, y) { path.push({ x: x, y: y }); });
    if (path.length >= 2 && canStep(path[1].x, path[1].y, e)) { e.x = path[1].x; e.y = path[1].y; return; }
    var ddx = tx - e.x, ddy = ty - e.y;
    var moves = Math.abs(ddx) >= Math.abs(ddy)
      ? [{ x: ddx > 0 ? 1 : -1, y: 0 }, { x: 0, y: ddy > 0 ? 1 : -1 }]
      : [{ x: 0, y: ddy > 0 ? 1 : -1 }, { x: ddx > 0 ? 1 : -1, y: 0 }];
    for (var i = 0; i < moves.length; i++) {
      var nx = e.x + moves[i].x, ny = e.y + moves[i].y;
      if (canStep(nx, ny, e)) { e.x = nx; e.y = ny; return; }
    }
  }

  function randomStep(e) {
    var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (var i = dirs.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = dirs[i]; dirs[i] = dirs[j]; dirs[j] = t; }
    for (var d = 0; d < dirs.length; d++) {
      var nx = e.x + dirs[d][0], ny = e.y + dirs[d][1];
      if (canStep(nx, ny, e)) { e.x = nx; e.y = ny; return; }
    }
  }

  // === FOV ===

  function computeVisibility(map, px, py, radius) {
    var rows = map.length, cols = map[0].length;
    var vis = [];
    for (var y = 0; y < rows; y++) { vis[y] = []; for (var x = 0; x < cols; x++) vis[y][x] = 0; }
    var fov = new ROT.FOV.PreciseShadowcasting(function(x, y) {
      if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
      return map[y][x] !== 1;
    });
    fov.compute(px, py, radius, function(x, y, r) {
      if (x < 0 || x >= cols || y < 0 || y >= rows) return;
      vis[y][x] = r < 2 ? 1 : Math.max(0, 1 - (r - 2) / (radius - 2));
    });
    return vis;
  }

  // === MAP REGISTRY ===

  function changeMap(id, sx, sy) {
    var state = FA.getState();
    state.mapId = id; state.map = state.maps[id].grid;
    state.depth = Location.depth(id) || id;
    state.player.x = sx; state.player.y = sy;
  }

  // === BUBBLE SYSTEM ===

  function addSystemBubble(text, color) {
    var state = FA.getState();
    if (!state.bubbleQueue) state.bubbleQueue = [];
    var lines = typeof text === 'string' ? text.split('\n') : text;
    state.bubbleQueue.push({ lines: lines, color: color || FA.lookup('config', 'colors').bubble, timer: 0, done: false });
    if (!state.systemBubble) advanceBubble();
  }

  function advanceBubble() {
    var state = FA.getState();
    if (!state.bubbleQueue || state.bubbleQueue.length === 0) {
      state.systemBubble = null;
      return;
    }
    state.systemBubble = state.bubbleQueue.shift();
  }

  function dismissBubble() {
    var state = FA.getState();
    if (!state.systemBubble) return false;
    if (!state.systemBubble.done) return false;
    advanceBubble();
    return true;
  }

  window.Core = {
    generateFloor: generateFloor, populateFloor: populateFloor, findEmpty: findEmpty,
    isWalkable: isWalkable, canStep: canStep, getEntityAt: getEntityAt,
    hasLOS: hasLOS, moveToward: moveToward, randomStep: randomStep,
    computeVisibility: computeVisibility, changeMap: changeMap,
    addSystemBubble: addSystemBubble, dismissBubble: dismissBubble
  };
})();
