(function() {
  'use strict';
  var FA = window.FA;
  var Core = window.Core;

  function start() { FA.resetState({ screen: 'start' }); }

  function begin() {
    var cfg = FA.lookup('config', 'game');
    var floor = Core.generateFloor(cfg.cols, cfg.rows, 1, cfg.maxDepth);
    var pop = Core.populateFloor(floor.map, floor.rooms, 1);
    var room0 = floor.rooms[0];
    var px = Math.floor(room0.x + room0.w / 2), py = Math.floor(room0.y + room0.h / 2);
    var maps = {};
    maps[1] = { grid: floor.map, entities: pop.entities, items: pop.items, explored: floor.explored, rooms: floor.rooms, stairsDown: floor.stairsDown, stairsUp: floor.stairsUp };
    FA.resetState({
      screen: 'playing', mapId: 1, maps: maps, map: floor.map,
      visible: Core.computeVisibility(floor.map, px, py, 10),
      player: { x: px, y: py, hp: 20, maxHp: 20, atk: 5, def: 1, gold: 0, kills: 0 },
      depth: 1, maxDepth: 1, turn: 0, shake: 0, particles: []
    });
  }

  // === FLOOR TRANSITIONS ===

  function changeFloor(dir) {
    var state = FA.getState();
    var cfg = FA.lookup('config', 'game');
    var newD = dir === 'down' ? state.depth + 1 : state.depth - 1;
    if (!state.maps[newD]) {
      var floor = Core.generateFloor(cfg.cols, cfg.rows, newD, cfg.maxDepth);
      var pop = Core.populateFloor(floor.map, floor.rooms, newD);
      state.maps[newD] = { grid: floor.map, entities: pop.entities, items: pop.items, explored: floor.explored, rooms: floor.rooms, stairsDown: floor.stairsDown, stairsUp: floor.stairsUp };
    }
    var target = state.maps[newD];
    var sp = dir === 'down' ? target.stairsUp : target.stairsDown;
    Core.changeMap(newD, sp ? sp.x : state.player.x, sp ? sp.y : state.player.y);
    if (newD > state.maxDepth) state.maxDepth = newD;
    state.visible = Core.computeVisibility(state.map, state.player.x, state.player.y, 10 - newD * 0.5);
    FA.playSound('stairs');
  }

  // === MOVEMENT & COMBAT ===

  function movePlayer(dx, dy) {
    var state = FA.getState();
    if (state.screen !== 'playing') return;
    var nx = state.player.x + dx, ny = state.player.y + dy;
    var entity = Core.getEntityAt(nx, ny);
    if (entity && entity.type === 'enemy') { attackEnemy(state.player, entity, state); endTurn(); return; }
    if (!Core.isWalkable(state.map, nx, ny)) return;
    state.player.x = nx; state.player.y = ny;
    var tile = state.map[ny][nx];
    if (tile === 2) { changeFloor('down'); return; }
    if (tile === 3 && state.depth > 1) { changeFloor('up'); return; }
    var items = state.maps[state.mapId].items;
    for (var i = items.length - 1; i >= 0; i--) {
      if (items[i].x === nx && items[i].y === ny) { pickupItem(items[i], i, state); }
    }
    endTurn();
  }

  function attackEnemy(atk, target, state) {
    var cfg = FA.lookup('config', 'game');
    var ts = cfg.tileSize;
    var dmg = Math.max(1, atk.atk - target.def + FA.rand(-1, 2));
    target.hp -= dmg;
    FA.emit('entity:damaged', { entity: target, damage: dmg });
    FA.addFloat(target.x * ts + ts / 2, target.y * ts, '-' + dmg, '#f44', 800);
    FA.playSound('hit');
    if (target.hp <= 0) {
      var ents = state.maps[state.mapId].entities;
      for (var i = 0; i < ents.length; i++) { if (ents[i] === target) { ents.splice(i, 1); break; } }
      state.player.kills++;
      FA.emit('entity:killed', { entity: target });
      for (var p = 0; p < 6; p++) {
        var a = (p / 6) * Math.PI * 2;
        state.particles.push({ x: target.x * ts + ts / 2, y: target.y * ts + ts / 2, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, life: 400, maxLife: 400, color: target.color });
      }
    }
  }

  function pickupItem(item, idx, state) {
    state.maps[state.mapId].items.splice(idx, 1);
    FA.playSound('pickup');
    var cfg = FA.lookup('config', 'game');
    var ts = cfg.tileSize;
    if (item.type === 'gold') {
      state.player.gold += item.value;
      FA.addFloat(item.x * ts + ts / 2, item.y * ts, '+' + item.value + 'g', '#ffd54f', 800);
    } else if (item.type === 'potion') {
      var heal = Math.min(item.heal, state.player.maxHp - state.player.hp);
      state.player.hp += heal;
      FA.addFloat(item.x * ts + ts / 2, item.y * ts, '+' + heal + 'hp', '#4caf50', 800);
    }
  }

  // === ENEMY AI ===

  function enemyTurn() {
    var state = FA.getState();
    var ents = state.maps[state.mapId].entities;
    var p = state.player;
    var cfg = FA.lookup('config', 'game');
    var ts = cfg.tileSize;
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.type !== 'enemy') continue;
      e.turnWait = (e.turnWait || 0) + 1;
      if (e.turnWait < e.speed) continue;
      e.turnWait = 0;
      var dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      var canSee = dist <= 8 && Core.hasLOS(state.map, e.x, e.y, p.x, p.y);
      if (canSee) e.aiState = 'chase';
      else if (e.aiState === 'chase') e.aiState = 'patrol';

      if (dist === 1) {
        var dmg = Math.max(1, e.atk - p.def + FA.rand(-1, 1));
        p.hp -= dmg;
        state.shake = 4;
        FA.emit('entity:damaged', { entity: p, damage: dmg });
        FA.addFloat(p.x * ts + ts / 2, p.y * ts, '-' + dmg, '#f84', 800);
        FA.playSound('hit');
        if (p.hp <= 0) { endGame(false); return; }
      } else if (e.aiState === 'chase') {
        Core.moveToward(e, p.x, p.y);
      } else {
        if (!e.patrolTarget || (e.x === e.patrolTarget.x && e.y === e.patrolTarget.y)) {
          var rooms = state.maps[state.mapId].rooms;
          if (rooms && rooms.length) { var rm = FA.pick(rooms); e.patrolTarget = { x: Math.floor(rm.x + rm.w / 2), y: Math.floor(rm.y + rm.h / 2) }; }
        }
        if (e.patrolTarget) Core.moveToward(e, e.patrolTarget.x, e.patrolTarget.y);
        else Core.randomStep(e);
      }
    }
  }

  // === TURN & END ===

  function endTurn() {
    var state = FA.getState();
    if (state.screen !== 'playing') return;
    state.turn++;
    state.visible = Core.computeVisibility(state.map, state.player.x, state.player.y, 10 - state.depth * 0.5);
    enemyTurn();
  }

  function endGame(victory) {
    var state = FA.getState();
    state.screen = victory ? 'victory' : 'defeat';
    var s = FA.lookup('config', 'scoring');
    state.score = state.player.kills * s.kill + state.player.gold * s.gold + (state.maxDepth - 1) * s.depth;
    FA.emit('game:over', { victory: victory, score: state.score });
  }

  window.Game = { start: start, begin: begin, movePlayer: movePlayer };
})();
