(function() {
  'use strict';
  var FA = window.FA;
  var Core = window.Core;
  var Combat = window.Combat;

  function start() { FA.resetState({ screen: 'start' }); }

  function begin() {
    var cfg = FA.lookup('config', 'game');
    var mapId = 'floor_1';
    var floor = Core.generateFloor(cfg.cols, cfg.rows, 1, cfg.maxDepth);
    var pop = Core.populateFloor(floor.map, floor.rooms, 1);
    var room0 = floor.rooms[0];
    var px = Math.floor(room0.x + room0.w / 2), py = Math.floor(room0.y + room0.h / 2);
    var maps = {};
    maps[mapId] = { grid: floor.map, entities: pop.entities, items: pop.items, explored: floor.explored, rooms: floor.rooms, stairsDown: floor.stairsDown, stairsUp: floor.stairsUp };
    FA.resetState({
      screen: 'playing', mapId: mapId, maps: maps, map: floor.map,
      visible: Core.computeVisibility(floor.map, px, py, 10),
      player: { x: px, y: py, hp: 20, maxHp: 20, atk: 5, def: 1, gold: 0, kills: 0 },
      depth: 1, maxDepth: 1, turn: 0, shake: 0, particles: [],
      bubbleQueue: [], systemBubble: null
    });
    var loc = Location.get(mapId);
    if (loc) Core.addSystemBubble(loc.label, FA.lookup('config', 'colors').stairs);
  }

  // === FLOOR TRANSITIONS ===

  function floorId(d) { return 'floor_' + d; }

  function changeFloor(dir) {
    var state = FA.getState();
    var cfg = FA.lookup('config', 'game');
    var curDepth = Location.depth(state.mapId) || state.depth;
    var newD = dir === 'down' ? curDepth + 1 : curDepth - 1;
    var newId = floorId(newD);
    if (!state.maps[newId]) {
      var floor = Core.generateFloor(cfg.cols, cfg.rows, newD, cfg.maxDepth);
      var pop = Core.populateFloor(floor.map, floor.rooms, newD);
      state.maps[newId] = { grid: floor.map, entities: pop.entities, items: pop.items, explored: floor.explored, rooms: floor.rooms, stairsDown: floor.stairsDown, stairsUp: floor.stairsUp };
    }
    var target = state.maps[newId];
    var sp = dir === 'down' ? target.stairsUp : target.stairsDown;
    Core.changeMap(newId, sp ? sp.x : state.player.x, sp ? sp.y : state.player.y);
    if (newD > state.maxDepth) state.maxDepth = newD;
    state.visible = Core.computeVisibility(state.map, state.player.x, state.player.y, 10 - newD * 0.5);
    FA.playSound('stairs');
    var loc = Location.get(newId);
    if (loc) Core.addSystemBubble(loc.label, FA.lookup('config', 'colors').stairs);
  }

  // === MOVEMENT ===

  function movePlayer(dx, dy) {
    var state = FA.getState();
    if (state.screen !== 'playing') return;
    if (state.systemBubble) return;
    var nx = state.player.x + dx, ny = state.player.y + dy;
    var entity = Core.getEntityAt(nx, ny);
    if (entity && entity.type === 'enemy') { Combat.attack(state.player, entity); endTurn(); return; }
    if (!Core.isWalkable(state.map, nx, ny)) return;
    state.player.x = nx; state.player.y = ny;
    var tile = state.map[ny][nx];
    if (tile === 2) { changeFloor('down'); return; }
    if (tile === 3 && state.depth > 1) { changeFloor('up'); return; }
    var items = state.maps[state.mapId].items;
    for (var i = items.length - 1; i >= 0; i--) {
      if (items[i].x === nx && items[i].y === ny) { Combat.pickup(items[i], i); }
    }
    endTurn();
  }

  // === TURN & END ===

  function endTurn() {
    var state = FA.getState();
    if (state.screen !== 'playing') return;
    state.turn++;
    state.visible = Core.computeVisibility(state.map, state.player.x, state.player.y, 10 - state.depth * 0.5);
    Combat.enemyTurn();
  }

  function endGame(victory) {
    var state = FA.getState();
    state.screen = victory ? 'victory' : 'defeat';
    var s = FA.lookup('config', 'scoring');
    state.score = state.player.kills * s.kill + state.player.gold * s.gold + (state.maxDepth - 1) * s.depth;
    FA.emit('game:over', { victory: victory, score: state.score });
  }

  function _handlePlayerDeath(state) {
    endGame(false);
  }

  window.Game = { start: start, begin: begin, movePlayer: movePlayer, _handlePlayerDeath: _handlePlayerDeath };
})();
