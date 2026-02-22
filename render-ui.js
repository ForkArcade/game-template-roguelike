// UI Rendering — HUD, screens, bubbles, floats
// Separated from render.js (map/entities/lighting)
(function() {
  'use strict';
  var FA = window.FA;

  var _cwCache = {};
  function getCW(ctx, size) {
    if (!size) size = 11;
    if (_cwCache[size]) return _cwCache[size];
    ctx.font = size + 'px monospace';
    _cwCache[size] = ctx.measureText('M').width;
    return _cwCache[size];
  }

  var _o = {};
  function O(color, size, bold, align, baseline) {
    _o.color = color; _o.size = size; _o.bold = !!bold;
    _o.align = align || 'left'; _o.baseline = baseline || 'top';
    return _o;
  }

  var _fx = {};
  function FX(color, dimColor, size, duration, charDelay, flicker) {
    _fx.color = color; _fx.dimColor = dimColor; _fx.size = size;
    _fx.duration = duration; _fx.charDelay = charDelay; _fx.flicker = flicker;
    return _fx;
  }

  function drawBox(ctx, bx, by, tw, th, color) {
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#060a12';
    ctx.fillRect(bx, by, tw, th);
    ctx.globalAlpha = 0.3; ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, th - 1);
    ctx.globalAlpha = 0.04; ctx.fillStyle = '#000';
    for (var sl = by; sl < by + th; sl += 2) ctx.fillRect(bx, sl, tw, 1);
    ctx.globalAlpha = 1;
  }

  function setup() {
    var cfg = FA.lookup('config', 'game');
    var C = FA.lookup('config', 'colors');
    var ts = cfg.tileSize, W = cfg.canvasW, H = cfg.canvasH;
    var uiY = cfg.rows * ts;

    // === START SCREEN (z=0) ===
    FA.addLayer('startScreen', function() {
      var state = FA.getState();
      if (state.screen !== 'start') return;
      FA.draw.clear(C.bg);
      FA.draw.text('ROGUELIKE', W / 2, H / 2 - 40, { color: C.player, size: 32, bold: true, align: 'center', baseline: 'middle' });
      FA.draw.text('Arrow keys to move, bump to attack', W / 2, H / 2 + 10, { color: C.dim, size: 13, align: 'center', baseline: 'middle' });
      FA.draw.text('[ SPACE ]', W / 2, H / 2 + 50, { color: '#fff', size: 16, bold: true, align: 'center', baseline: 'middle' });
    }, 0);

    // === FLOATS (z=20) ===
    FA.addLayer('floats', function() { FA.drawFloats(); }, 20);

    // === SYSTEM BUBBLE (z=25) ===
    FA.addLayer('systemBubble', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      var sb = state.systemBubble;
      if (!sb) return;
      var ctx = FA.getCtx();
      var cw = getCW(ctx);
      var bcfg = FA.lookup('config', 'bubble');
      var lines = sb.lines;
      var lineH = 16;
      var maxLineLen = 0;
      for (var mi = 0; mi < lines.length; mi++)
        if (lines[mi].length > maxLineLen) maxLineLen = lines[mi].length;
      var tw = Math.min(W - 40, Math.max(140, maxLineLen * cw + 24));
      var th = lines.length * lineH + 12;
      var bx = W / 2 - tw / 2, by = 8;
      drawBox(ctx, bx, by, tw, th, sb.color);
      ctx.globalAlpha = 0.9;
      for (var li = 0; li < lines.length; li++) {
        var lineElapsed = sb.timer - li * bcfg.lineDelay;
        if (lineElapsed <= 0) continue;
        TextFX.render(ctx, lines[li], lineElapsed, bx + 12, by + 6 + li * lineH,
          FX(sb.color, bcfg.dimColor, 11, bcfg.duration, bcfg.charDelay, bcfg.flicker));
      }
      if (sb.done) {
        ctx.globalAlpha = 0.3;
        FA.draw.text('[SPACE]', bx + tw - 48, by + th + 4, O(sb.color, 8));
      }
      ctx.globalAlpha = 1;
    }, 25);

    // === HUD (z=30) ===
    FA.addLayer('hud', function() {
      var state = FA.getState();
      if (!state.player) return;
      if (state.screen !== 'playing' && state.screen !== 'victory' && state.screen !== 'defeat') return;
      var p = state.player;
      FA.draw.rect(0, uiY, W, H - uiY, C.hudBg);
      FA.draw.rect(0, uiY, W, 1, '#1a2030');
      var hpRatio = p.hp / p.maxHp;
      FA.draw.text('HP', 8, uiY + 8, { color: C.hud, size: 12 });
      FA.draw.bar(30, uiY + 8, 80, 10, hpRatio, hpRatio > 0.3 ? '#4caf50' : '#ef5350', '#1a0a0a');
      FA.draw.text(p.hp + '/' + p.maxHp, 116, uiY + 8, { color: C.hud, size: 11 });
      FA.draw.text('ATK:' + p.atk + ' DEF:' + p.def, 185, uiY + 8, { color: C.dim, size: 11 });
      FA.draw.text('Depth:' + state.depth + '/' + cfg.maxDepth, 320, uiY + 8, { color: C.stairs, size: 11, bold: true });
      FA.draw.text('Gold:' + p.gold, 460, uiY + 8, { color: '#ffd54f', size: 11 });
      FA.draw.text('Kills:' + p.kills, 550, uiY + 8, { color: '#ef5350', size: 11 });
      FA.draw.text('Turn:' + state.turn, 640, uiY + 8, { color: C.dim, size: 11 });
    }, 30);

    // === GAME OVER (z=40) ===
    FA.addLayer('gameOver', function() {
      var state = FA.getState();
      if (state.screen !== 'victory' && state.screen !== 'defeat') return;
      FA.draw.pushAlpha(0.8); FA.draw.rect(0, 0, W, uiY, '#000'); FA.draw.popAlpha();
      var win = state.screen === 'victory';
      FA.draw.text(win ? 'VICTORY' : 'DEFEAT', W / 2, uiY / 2 - 50, { color: win ? '#4caf50' : '#ef5350', size: 28, bold: true, align: 'center', baseline: 'middle' });
      FA.draw.text('Kills: ' + state.player.kills + '   Gold: ' + state.player.gold + '   Depth: ' + state.maxDepth, W / 2, uiY / 2, { color: C.hud, size: 14, align: 'center', baseline: 'middle' });
      FA.draw.text('SCORE: ' + (state.score || 0), W / 2, uiY / 2 + 40, { color: '#fff', size: 22, bold: true, align: 'center', baseline: 'middle' });
      FA.draw.text('[ R ] Restart', W / 2, uiY / 2 + 80, { color: C.dim, size: 14, align: 'center', baseline: 'middle' });
    }, 40);
  }

  window.RenderUI = { setup: setup };
})();
