(function() {
  'use strict';
  var FA = window.FA;

  function setup() {
    var cfg = FA.lookup('config', 'game');
    var C = FA.lookup('config', 'colors');
    var ts = cfg.tileSize, W = cfg.canvasW, H = cfg.canvasH;

    // === START SCREEN (z=0) ===
    FA.addLayer('startScreen', function() {
      var state = FA.getState();
      if (state.screen !== 'start') return;
      FA.draw.clear(C.bg);
      FA.draw.text('ROGUELIKE', W / 2, H / 2 - 40, { color: C.player, size: 32, bold: true, align: 'center', baseline: 'middle' });
      FA.draw.text('Arrow keys to move, bump to attack', W / 2, H / 2 + 10, { color: C.dim, size: 13, align: 'center', baseline: 'middle' });
      FA.draw.text('[ SPACE ]', W / 2, H / 2 + 50, { color: '#fff', size: 16, bold: true, align: 'center', baseline: 'middle' });
    }, 0);

    // === MAP (z=1) ===
    FA.addLayer('map', function() {
      var state = FA.getState();
      if (!state.map) return;
      var ctx = FA.getCtx(), map = state.map;
      for (var y = 0; y < cfg.rows; y++) {
        for (var x = 0; x < cfg.cols; x++) {
          var tile = map[y][x], px = x * ts, py = y * ts;
          if (tile === 0) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#0d0b1a' : '#0f0d1c';
            ctx.fillRect(px, py, ts, ts);
          } else if (tile === 2) {
            ctx.fillStyle = '#1a1000'; ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = C.stairs; ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);
            FA.draw.text('v', px + ts / 2, py + ts / 2, { color: '#fff', size: 11, bold: true, align: 'center', baseline: 'middle' });
          } else if (tile === 3) {
            ctx.fillStyle = '#001a1a'; ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#4dd0e1'; ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);
            FA.draw.text('^', px + ts / 2, py + ts / 2, { color: '#fff', size: 11, bold: true, align: 'center', baseline: 'middle' });
          } else if (tile === 1) {
            var openS = y + 1 < cfg.rows && map[y + 1][x] !== 1;
            if (openS) {
              var capH = Math.floor(ts * 0.35);
              ctx.fillStyle = C.wallCap; ctx.fillRect(px, py, ts, capH);
              ctx.fillStyle = C.wallFace; ctx.fillRect(px, py + capH, ts, ts - capH);
              ctx.fillStyle = C.wallLine; ctx.fillRect(px, py + capH, ts, 1);
            } else {
              ctx.fillStyle = C.wallInner; ctx.fillRect(px, py, ts, ts);
            }
          }
        }
      }
    }, 1);

    // === ENTITIES (z=10) ===
    FA.addLayer('entities', function() {
      var state = FA.getState();
      if (!state.player || !state.maps || !state.maps[state.mapId]) return;
      var ctx = FA.getCtx(), md = state.maps[state.mapId];
      var items = md.items || [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        FA.draw.sprite('items', it.type, it.x * ts, it.y * ts, ts, it.char, it.color, 0);
      }
      var ents = md.entities;
      for (var e = 0; e < ents.length; e++) {
        var en = ents[e];
        FA.draw.sprite('enemies', en.behavior, en.x * ts, en.y * ts, ts, en.char, en.color, 0);
        if (en.hp < en.maxHp) FA.draw.bar(en.x * ts + 2, en.y * ts - 3, ts - 4, 2, en.hp / en.maxHp, '#f44', '#400');
        if (en.aiState === 'chase') FA.draw.text('!', en.x * ts + ts / 2, en.y * ts - 2, { color: '#f44', size: 9, bold: true, align: 'center', baseline: 'bottom' });
      }
      var p = state.player;
      FA.draw.sprite('player', 'base', p.x * ts, p.y * ts, ts, '@', C.player, 0);
    }, 10);

    // === LIGHTING (z=15) ===
    FA.addLayer('lighting', function() {
      var state = FA.getState();
      if (!state.visible || !state.maps || !state.maps[state.mapId]) return;
      var ctx = FA.getCtx(), vis = state.visible, exp = state.maps[state.mapId].explored;
      for (var y = 0; y < cfg.rows; y++) for (var x = 0; x < cfg.cols; x++) { if (vis[y][x] > 0.05) exp[y][x] = true; }
      ctx.fillStyle = '#000';
      for (var sy = 0; sy < cfg.rows; sy++) {
        for (var sx = 0; sx < cfg.cols; sx++) {
          if (vis[sy][sx] > 0.97) continue;
          ctx.globalAlpha = vis[sy][sx] > 0.03 ? Math.min(1 - vis[sy][sx], 0.88) : exp[sy][sx] ? 0.72 : 0.96;
          ctx.fillRect(sx * ts, sy * ts, ts, ts);
        }
      }
      ctx.globalAlpha = 1;
    }, 15);

    // === PARTICLES + FLOATS (z=18, z=20) ===
    FA.addLayer('particles', function() {
      var state = FA.getState();
      if (!state.particles) return;
      var ctx = FA.getCtx();
      for (var i = 0; i < state.particles.length; i++) {
        var pt = state.particles[i];
        ctx.globalAlpha = pt.life / pt.maxLife;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 1, pt.y - 1, 3, 3);
      }
      ctx.globalAlpha = 1;
    }, 18);
    FA.addLayer('floats', function() { FA.drawFloats(); }, 20);

    // === HUD (z=30) ===
    FA.addLayer('hud', function() {
      var state = FA.getState();
      if (!state.player) return;
      var p = state.player, y = cfg.rows * ts;
      FA.draw.rect(0, y, W, H - y, C.hudBg);
      FA.draw.rect(0, y, W, 1, '#1a2030');
      var hpRatio = p.hp / p.maxHp;
      FA.draw.text('HP', 8, y + 8, { color: C.hud, size: 12 });
      FA.draw.bar(30, y + 8, 80, 10, hpRatio, hpRatio > 0.3 ? '#4caf50' : '#ef5350', '#1a0a0a');
      FA.draw.text(p.hp + '/' + p.maxHp, 116, y + 8, { color: C.hud, size: 11 });
      FA.draw.text('ATK:' + p.atk + ' DEF:' + p.def, 185, y + 8, { color: C.dim, size: 11 });
      FA.draw.text('Depth:' + state.depth + '/' + cfg.maxDepth, 320, y + 8, { color: C.stairs, size: 11, bold: true });
      FA.draw.text('Gold:' + p.gold, 460, y + 8, { color: '#ffd54f', size: 11 });
      FA.draw.text('Kills:' + p.kills, 550, y + 8, { color: '#ef5350', size: 11 });
      FA.draw.text('Turn:' + state.turn, 640, y + 8, { color: C.dim, size: 11 });
    }, 30);

    // === GAME OVER (z=40) ===
    FA.addLayer('gameOver', function() {
      var state = FA.getState();
      if (state.screen !== 'victory' && state.screen !== 'defeat') return;
      var uy = cfg.rows * ts;
      FA.draw.pushAlpha(0.8); FA.draw.rect(0, 0, W, uy, '#000'); FA.draw.popAlpha();
      var win = state.screen === 'victory';
      FA.draw.text(win ? 'VICTORY' : 'DEFEAT', W / 2, uy / 2 - 50, { color: win ? '#4caf50' : '#ef5350', size: 28, bold: true, align: 'center', baseline: 'middle' });
      FA.draw.text('Kills: ' + state.player.kills + '   Gold: ' + state.player.gold + '   Depth: ' + state.maxDepth, W / 2, uy / 2, { color: C.hud, size: 14, align: 'center', baseline: 'middle' });
      FA.draw.text('SCORE: ' + (state.score || 0), W / 2, uy / 2 + 40, { color: '#fff', size: 22, bold: true, align: 'center', baseline: 'middle' });
      FA.draw.text('[ R ] Restart', W / 2, uy / 2 + 80, { color: C.dim, size: 14, align: 'center', baseline: 'middle' });
    }, 40);
  }

  window.Render = { setup: setup };
})();
