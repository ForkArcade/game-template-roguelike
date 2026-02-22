// Combat & AI System — extracted from game.js
// Handles: attack, pickup, 3-state enemy AI, enemy turns
(function() {
  'use strict';
  var FA = window.FA;
  var Core = window.Core;

  var PARTICLE_COUNT = 6;
  var PARTICLE_LIFE = 400;
  var SHAKE_INTENSITY = 4;

  // === ATTACK ===

  function attackEnemy(attacker, target) {
    var state = FA.getState();
    var cfg = FA.lookup('config', 'game');
    var ts = cfg.tileSize;
    var dmg = Math.max(1, attacker.atk - target.def + FA.rand(-1, 2));
    target.hp -= dmg;
    FA.emit('entity:damaged', { entity: target, damage: dmg });
    FA.addFloat(target.x * ts + ts / 2, target.y * ts, '-' + dmg, '#f44', 800);
    FA.playSound('hit');

    if (target.hp <= 0) {
      var ents = state.maps[state.mapId].entities;
      for (var i = 0; i < ents.length; i++) {
        if (ents[i] === target) { ents.splice(i, 1); break; }
      }
      state.player.kills++;
      FA.emit('entity:killed', { entity: target });

      var bx = target.x * ts + ts / 2, by = target.y * ts + ts / 2;
      for (var p = 0; p < PARTICLE_COUNT; p++) {
        var a = (p / PARTICLE_COUNT) * Math.PI * 2;
        state.particles.push({
          x: bx, y: by,
          vx: Math.cos(a) * 50, vy: Math.sin(a) * 50,
          life: PARTICLE_LIFE, maxLife: PARTICLE_LIFE, color: target.color
        });
      }
    }
  }

  // === PLAYER DAMAGE ===

  function applyDamageToPlayer(dmg, state) {
    var cfg = FA.lookup('config', 'game');
    var ts = cfg.tileSize;
    state.player.hp -= dmg;
    state.shake = SHAKE_INTENSITY;
    FA.emit('entity:damaged', { entity: state.player, damage: dmg });
    FA.addFloat(state.player.x * ts + ts / 2, state.player.y * ts, '-' + dmg, '#f84', 800);
    FA.playSound('hit');
    if (state.player.hp <= 0) {
      window.Game._handlePlayerDeath(state);
    }
  }

  // === PICKUP ===

  function pickupItem(item, idx) {
    var state = FA.getState();
    var cfg = FA.lookup('config', 'game');
    var ts = cfg.tileSize;
    state.maps[state.mapId].items.splice(idx, 1);
    FA.playSound('pickup');
    FA.emit('item:pickup', { item: item });

    if (item.type === 'gold') {
      state.player.gold += item.value;
      FA.addFloat(item.x * ts + ts / 2, item.y * ts, '+' + item.value + 'g', '#ffd54f', 800);
    } else if (item.type === 'potion') {
      var heal = Math.min(item.heal, state.player.maxHp - state.player.hp);
      state.player.hp += heal;
      FA.addFloat(item.x * ts + ts / 2, item.y * ts, '+' + heal + 'hp', '#4caf50', 800);
    }
  }

  // === 3-STATE AI ===

  function computeEnemyAction(e, state, rooms) {
    var p = state.player;
    if (!p) return { type: 'idle' };
    var dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    var sightRange = e.sightRange || FA.lookup('config', 'ai').sightRange;
    var canSee = dist <= sightRange && Core.hasLOS(state.map, e.x, e.y, p.x, p.y);

    // Adjacent — always attack
    if (dist === 1) {
      e.aiState = 'hunting';
      e.alertTarget = { x: p.x, y: p.y };
      return { type: 'attack' };
    }

    // Sight update
    if (canSee) {
      e.aiState = 'hunting';
      e.alertTarget = { x: p.x, y: p.y };
      e.alertTimer = 0;
    } else if (e.aiState === 'hunting') {
      e.aiState = 'alert';
      e.alertTimer = FA.lookup('config', 'ai').alertTimeout;
    }

    // Alert decay
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
      default:
        if (!e.patrolTarget || (e.x === e.patrolTarget.x && e.y === e.patrolTarget.y)) {
          if (rooms && rooms.length > 0) {
            var room = rooms[Math.floor(Math.random() * rooms.length)];
            e.patrolTarget = { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
          }
        }
        return { type: 'patrol' };
    }
  }

  // === ENEMY TURN ===

  function enemyTurn() {
    var state = FA.getState();
    if (state.screen !== 'playing' || !state.player) return;

    var mapData = state.maps[state.mapId];
    var entities = mapData.entities;
    var rooms = mapData.rooms || null;

    for (var i = 0; i < entities.length; i++) {
      if (state.screen !== 'playing' || !state.player) return;
      var e = entities[i];
      if (e.type !== 'enemy') continue;

      if (e.stunTurns > 0) { e.stunTurns--; continue; }

      e.turnWait = (e.turnWait || 0) + 1;
      if (e.turnWait < e.speed) continue;
      e.turnWait = 0;

      var action = computeEnemyAction(e, state, rooms);

      switch (action.type) {
        case 'attack':
          var dmg = Math.max(1, e.atk - state.player.def + FA.rand(-1, 1));
          applyDamageToPlayer(dmg, state);
          break;
        case 'chase':
          Core.moveToward(e, state.player.x, state.player.y);
          break;
        case 'investigate':
          Core.moveToward(e, e.alertTarget.x, e.alertTarget.y);
          break;
        case 'patrol':
          if (e.patrolTarget) Core.moveToward(e, e.patrolTarget.x, e.patrolTarget.y);
          break;
        case 'random':
          Core.randomStep(e);
          break;
      }
    }
  }

  window.Combat = {
    attack: attackEnemy,
    applyDamage: applyDamageToPlayer,
    pickup: pickupItem,
    enemyTurn: enemyTurn
  };
})();
