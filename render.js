// Map Rendering — map tiles, entities, lighting, particles
// UI layers (HUD, screens, bubbles) are in render-ui.js
(function() {
  'use strict';
  var FA = window.FA;

  function setup() {
    var cfg = FA.lookup('config', 'game');
    var C = FA.lookup('config', 'colors');
    var ts = cfg.tileSize;

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
        var aiIndicator = en.aiState === 'hunting' ? '!' : en.aiState === 'alert' ? '?' : null;
        var aiColor = en.aiState === 'hunting' ? '#f44' : '#fa0';
        if (aiIndicator) FA.draw.text(aiIndicator, en.x * ts + ts / 2, en.y * ts - 2, { color: aiColor, size: 9, bold: true, align: 'center', baseline: 'bottom' });
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

    // === PARTICLES (z=18) ===
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
  }

  window.Render = { setup: setup };
})();
