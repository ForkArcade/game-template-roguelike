// Roguelike — Rendering
// Layers: map (autotiled), entities (glow), lighting, effects, UI, overlays
(function() {
  'use strict';
  var FA = window.FA;

  function setupLayers() {
    var cfg = FA.lookup('config', 'game');
    var colors = FA.lookup('config', 'colors');
    var ts = cfg.tileSize;
    var W = cfg.canvasWidth;
    var H = cfg.canvasHeight;
    var uiY = cfg.rows * ts;

    // Depth palettes — customize per game theme
    // Each palette: wall cap, face, panel, side, inner, line; floor A, B, dot
    var PALETTES = [null,
      { wCap:'#1e1638', wFace:'#2a2248', wPanel:'#332a55', wSide:'#1e1a36', wInner:'#12101e', wLine:'#332a55', fA:'#0d0b1a', fB:'#0f0d1c', fDot:'#161230' }
      // TODO: add more palettes for deeper floors (warmer/darker tones)
    ];

    function isOpen(map, x, y) {
      if (x < 0 || x >= cfg.cols || y < 0 || y >= cfg.rows) return false;
      return map[y][x] !== 1;
    }

    // === START SCREEN (z=0) ===
    FA.addLayer('startScreen', function() {
      var state = FA.getState();
      if (state.screen !== 'start') return;
      FA.draw.clear(colors.bg);
      FA.draw.text('GAME TITLE', W / 2, H / 2 - 80, { color: colors.player, size: 36, bold: true, align: 'center', baseline: 'middle' });
      // TODO: description, controls, enemy preview
      FA.draw.text('[ SPACE ]  to begin', W / 2, H / 2 + 80, { color: '#fff', size: 18, bold: true, align: 'center', baseline: 'middle' });
    }, 0);

    // === MAP WITH WALL AUTOTILING (z=1) ===
    FA.addLayer('map', function() {
      var state = FA.getState();
      if (state.screen !== 'playing' && state.screen !== 'victory' && state.screen !== 'defeat') return;
      if (!state.map) return;
      var ctx = FA.getCtx();
      var map = state.map;
      var depth = state.depth || 1;
      var pal = PALETTES[depth] || PALETTES[1];

      for (var y = 0; y < cfg.rows; y++) {
        for (var x = 0; x < cfg.cols; x++) {
          var tile = map[y][x];
          var px = x * ts, py = y * ts;

          if (tile === 0) {
            // Floor — subtle grid
            ctx.fillStyle = (x + y) % 2 === 0 ? pal.fA : pal.fB;
            ctx.fillRect(px, py, ts, ts);
            if ((x + y) % 3 === 0) {
              ctx.fillStyle = pal.fDot;
              ctx.fillRect(px + ts / 2, py + ts / 2, 1, 1);
            }
          } else if (tile === 2) {
            // Stairs down
            ctx.fillStyle = '#1a1000';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = colors.stairsDown;
            ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
            FA.draw.text('v', px + ts / 2, py + ts / 2, { color: '#fff', size: 12, bold: true, align: 'center', baseline: 'middle' });
          } else if (tile === 3) {
            // Stairs up
            ctx.fillStyle = '#001a1a';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = colors.stairsUp;
            ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
            FA.draw.text('^', px + ts / 2, py + ts / 2, { color: '#fff', size: 12, bold: true, align: 'center', baseline: 'middle' });
          } else if (tile === 1) {
            // Wall autotiling
            var openS = isOpen(map, x, y + 1);
            var openN = isOpen(map, x, y - 1);
            var openE = isOpen(map, x + 1, y);
            var openW = isOpen(map, x - 1, y);

            if (openS) {
              var capH = Math.floor(ts * 0.35);
              ctx.fillStyle = pal.wCap;
              ctx.fillRect(px, py, ts, capH);
              ctx.fillStyle = pal.wFace;
              ctx.fillRect(px, py + capH, ts, ts - capH);
              ctx.fillStyle = pal.wLine;
              ctx.fillRect(px, py + capH, ts, 1);
              ctx.fillStyle = pal.wPanel;
              ctx.fillRect(px, py + ts - 1, ts, 1);
              if (x % 3 === 0) {
                ctx.fillStyle = pal.wSide;
                ctx.fillRect(px + ts / 2, py + capH + 2, 1, ts - capH - 3);
              }
            } else if (openN) {
              ctx.fillStyle = pal.wInner;
              ctx.fillRect(px, py, ts, ts);
              ctx.fillStyle = pal.wSide;
              ctx.fillRect(px, py, ts, 2);
            } else {
              ctx.fillStyle = pal.wInner;
              ctx.fillRect(px, py, ts, ts);
            }

            if (openE) {
              ctx.fillStyle = pal.wSide;
              ctx.fillRect(px + ts - 2, py, 2, ts);
            }
            if (openW) {
              ctx.fillStyle = pal.wSide;
              ctx.fillRect(px, py, 2, ts);
            }
          }
          // TODO: tile 4 (interactable), tile 5 (used interactable)
        }
      }
    }, 1);

    // === ENTITIES WITH GLOW (z=10) ===
    FA.addLayer('entities', function() {
      var state = FA.getState();
      if (state.screen !== 'playing' && state.screen !== 'victory' && state.screen !== 'defeat') return;
      if (!state.player) return;
      var ctx = FA.getCtx();

      // Items
      for (var i = 0; i < state.items.length; i++) {
        var item = state.items[i];
        FA.draw.sprite('items', item.type, item.x * ts, item.y * ts, ts, item.char, item.color, 0);
      }

      // Enemies with glow + AI state indicator
      for (var e = 0; e < state.enemies.length; e++) {
        var en = state.enemies[e];
        var ecx = en.x * ts + ts / 2, ecy = en.y * ts + ts / 2;

        // Glow
        ctx.save();
        ctx.globalAlpha = 0.25;
        var eg = ctx.createRadialGradient(ecx, ecy, 2, ecx, ecy, ts * 1.2);
        eg.addColorStop(0, en.color);
        eg.addColorStop(1, 'transparent');
        ctx.fillStyle = eg;
        ctx.fillRect(en.x * ts - ts / 2, en.y * ts - ts / 2, ts * 2, ts * 2);
        ctx.restore();

        FA.draw.sprite('enemies', en.behavior, en.x * ts, en.y * ts, ts, en.char, en.color, 0);

        // HP bar
        var hpRatio = en.hp / en.maxHp;
        if (hpRatio < 1) {
          FA.draw.bar(en.x * ts + 2, en.y * ts - 3, ts - 4, 2, hpRatio, '#f44', '#400');
        }

        // AI state indicator
        if (en.stunTurns > 0) {
          FA.draw.text('~', ecx, ecy - ts / 2 - 2, { color: '#ff0', size: 10, bold: true, align: 'center', baseline: 'bottom' });
        } else if (en.aiState === 'hunting') {
          FA.draw.text('!', ecx, ecy - ts / 2 - 2, { color: '#f44', size: 10, bold: true, align: 'center', baseline: 'bottom' });
        } else if (en.aiState === 'alert') {
          FA.draw.text('?', ecx, ecy - ts / 2 - 2, { color: '#ff0', size: 10, bold: true, align: 'center', baseline: 'bottom' });
        }
      }

      // Player with glow
      var p = state.player;
      var pcx = p.x * ts + ts / 2, pcy = p.y * ts + ts / 2;
      ctx.save();
      ctx.globalAlpha = 0.2;
      var pg = ctx.createRadialGradient(pcx, pcy, 2, pcx, pcy, ts * 1.3);
      pg.addColorStop(0, colors.player);
      pg.addColorStop(1, 'transparent');
      ctx.fillStyle = pg;
      ctx.fillRect(p.x * ts - ts / 2, p.y * ts - ts / 2, ts * 2, ts * 2);
      ctx.restore();
      FA.draw.sprite('player', 'base', p.x * ts, p.y * ts, ts, '@', colors.player, 0);
    }, 10);

    // === LIGHTING / FOV (z=15) ===
    FA.addLayer('lighting', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      if (!state.player) return;
      var ctx = FA.getCtx();
      var p = state.player;

      // Raycast FOV
      var lightRadius = 10 - (state.depth || 1) * 0.5;
      var vis = [];
      for (var vy = 0; vy < cfg.rows; vy++) {
        vis[vy] = [];
        for (var vx = 0; vx < cfg.cols; vx++) vis[vy][vx] = 0;
      }
      vis[p.y][p.x] = 1;
      var rays = 720;
      for (var a = 0; a < rays; a++) {
        var angle = (a / rays) * Math.PI * 2;
        var dx = Math.cos(angle) * 0.5, dy = Math.sin(angle) * 0.5;
        var rx = p.x + 0.5, ry = p.y + 0.5;
        for (var d = 0; d < lightRadius * 2; d++) {
          rx += dx; ry += dy;
          var tx = Math.floor(rx), ty = Math.floor(ry);
          if (tx < 0 || tx >= cfg.cols || ty < 0 || ty >= cfg.rows) break;
          var dist = Math.sqrt((tx - p.x) * (tx - p.x) + (ty - p.y) * (ty - p.y));
          if (dist > lightRadius) break;
          var light = dist < 2 ? 1 : Math.max(0, 1 - (dist - 2) / (lightRadius - 2));
          if (light > vis[ty][tx]) vis[ty][tx] = light;
          if (state.map[ty][tx] === 1) break;
        }
      }

      // Mark explored
      var explored = state.explored;
      for (var ey = 0; ey < cfg.rows; ey++) {
        for (var ex = 0; ex < cfg.cols; ex++) {
          if (vis[ey][ex] > 0.05) explored[ey][ex] = true;
        }
      }

      // Darken non-visible tiles
      ctx.save();
      ctx.fillStyle = '#000';
      for (var sy = 0; sy < cfg.rows; sy++) {
        for (var sx = 0; sx < cfg.cols; sx++) {
          if (vis[sy][sx] > 0.97) continue;
          else if (vis[sy][sx] > 0.03) ctx.globalAlpha = Math.min(1 - vis[sy][sx], 0.88);
          else if (explored[sy][sx]) ctx.globalAlpha = 0.72;
          else ctx.globalAlpha = 0.96;
          ctx.fillRect(sx * ts, sy * ts, ts, ts);
        }
      }
      ctx.restore();
    }, 15);

    // === DYNAMIC EFFECTS (z=18) ===
    FA.addLayer('effects', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      var ctx = FA.getCtx();

      // Alert tint (hunting enemies = danger)
      var huntingCount = 0;
      for (var hi = 0; hi < state.enemies.length; hi++) {
        if (state.enemies[hi].aiState === 'hunting') huntingCount++;
      }
      if (huntingCount > 0) {
        var alertLevel = huntingCount / Math.max(1, state.enemies.length);
        ctx.save();
        ctx.globalAlpha = alertLevel * 0.06;
        ctx.fillStyle = '#f00';
        ctx.fillRect(0, 0, W, uiY);
        ctx.restore();
      }

      // Sound wave rings
      if (state.soundWaves) {
        for (var wi = 0; wi < state.soundWaves.length; wi++) {
          var wave = state.soundWaves[wi];
          var progress = 1 - wave.life / 500;
          var waveR = progress * wave.maxR * ts;
          ctx.save();
          ctx.globalAlpha = (1 - progress) * 0.15;
          ctx.strokeStyle = '#ff0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(wave.tx * ts + ts / 2, wave.ty * ts + ts / 2, waveR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Kill burst particles
      if (state.particles) {
        for (var pi = 0; pi < state.particles.length; pi++) {
          var pt = state.particles[pi];
          ctx.save();
          ctx.globalAlpha = pt.life / pt.maxLife;
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x - 1, pt.y - 1, 3, 3);
          ctx.restore();
        }
      }
    }, 18);

    // === FLOATING MESSAGES (z=20) ===
    FA.addLayer('floats', function() {
      var state = FA.getState();
      if (state.screen !== 'playing' && state.screen !== 'victory' && state.screen !== 'defeat') return;
      FA.drawFloats();
    }, 20);

    // === NARRATIVE BAR (z=25) ===
    FA.addLayer('narrative', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      var nm = state.narrativeMessage;
      if (!nm || nm.life <= 0) return;
      var alpha = nm.life < 1000 ? nm.life / 1000 : 1;
      FA.draw.pushAlpha(alpha * 0.85);
      FA.draw.rect(0, 0, W, 28, '#0a0f1a');
      FA.draw.popAlpha();
      FA.draw.pushAlpha(alpha);
      FA.draw.text(nm.text, W / 2, 14, { color: nm.color, size: 13, align: 'center', baseline: 'middle' });
      FA.draw.popAlpha();
    }, 25);

    // === THOUGHT BUBBLE (z=26) ===
    FA.addLayer('thoughtBubble', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      if (!state.thoughts || state.thoughts.length === 0) return;

      var thought = null;
      for (var ti = state.thoughts.length - 1; ti >= 0; ti--) {
        var t = state.thoughts[ti];
        if (!(t.done && t.life <= 0)) { thought = t; break; }
      }
      if (!thought) return;

      var ctx = FA.getCtx();
      var p = state.player;
      var ppx = p.x * ts + ts / 2;
      var ppy = p.y * ts;

      var chars = thought.done ? thought.text.length : Math.floor(thought.timer / thought.speed);
      var text = thought.text.substring(0, Math.min(chars, thought.text.length));
      var tw = Math.max(90, thought.text.length * 6.5 + 24);
      var th = 26;
      var bx = ppx - tw / 2;
      var by = ppy - th - 14;

      if (bx < 4) bx = 4;
      if (bx + tw > W - 4) bx = W - tw - 4;
      var flipped = by < 4;
      if (flipped) by = ppy + ts + 10;

      var alpha = 1;
      if (thought.done && thought.life < 1500) alpha = thought.life / 1500;

      ctx.save();
      ctx.globalAlpha = 0.82 * alpha;
      ctx.fillStyle = '#060a12';
      ctx.fillRect(bx, by, tw, th);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.3 * alpha;
      ctx.strokeStyle = colors.player;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, th - 1);
      ctx.restore();

      // Connector line
      ctx.save();
      ctx.globalAlpha = 0.15 * alpha;
      ctx.strokeStyle = colors.player;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (!flipped) { ctx.moveTo(ppx, by + th); ctx.lineTo(ppx, ppy - 2); }
      else { ctx.moveTo(ppx, by); ctx.lineTo(ppx, ppy + ts + 2); }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.9 * alpha;
      FA.draw.text(text, bx + 8, by + 7, { color: colors.player, size: 11 });
      ctx.restore();

      if (!thought.done && Math.floor(Date.now() / 350) % 2 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = colors.player;
        ctx.fillRect(bx + 8 + chars * 6.2, by + 7, 5, 12);
        ctx.restore();
      }

      if (thought.done && thought.life > 1500) {
        ctx.save();
        ctx.globalAlpha = 0.2 * alpha;
        FA.draw.text('[SPC]', bx + tw - 35, by + 9, { color: colors.player, size: 8 });
        ctx.restore();
      }
    }, 26);

    // === UI PANEL (z=30) ===
    FA.addLayer('ui', function() {
      var state = FA.getState();
      if (state.screen !== 'playing' && state.screen !== 'victory' && state.screen !== 'defeat') return;
      if (!state.player) return;
      var p = state.player;

      FA.draw.rect(0, uiY, W, H - uiY, '#0c1018');

      // HP bar
      FA.draw.text('HP', 8, uiY + 6, { color: colors.text, size: 11 });
      FA.draw.bar(28, uiY + 6, 90, 10, p.hp / p.maxHp, '#4f4', '#1a0a0a');
      FA.draw.text(p.hp + '/' + p.maxHp, 122, uiY + 6, { color: colors.text, size: 11 });
      FA.draw.text('ATK:' + p.atk + '  DEF:' + p.def, 185, uiY + 6, { color: colors.dim, size: 11 });
      FA.draw.text('LVL:' + (state.depth || 1) + '/' + cfg.maxDepth, 310, uiY + 6, { color: colors.stairsDown, size: 11, bold: true });

      // Module slots
      var mods = p.modules || [];
      for (var m = 0; m < 3; m++) {
        var mx = 8 + m * 120;
        if (m < mods.length) {
          FA.draw.text('[' + (m + 1) + '] ' + mods[m].name, mx, uiY + 21, { color: mods[m].color, size: 11, bold: true });
        } else {
          FA.draw.text('[' + (m + 1) + '] ---', mx, uiY + 21, { color: '#223', size: 11 });
        }
      }

      // Stats
      FA.draw.text('Gold:' + p.gold + '  Kills:' + p.kills + '  Turn:' + state.turn, 8, uiY + 36, { color: colors.dim, size: 11 });

      // Messages
      var msgs = state.messages;
      for (var i = 0; i < msgs.length; i++) {
        var msg = msgs[i];
        FA.draw.text(msg.text || msg, 8, uiY + 50 + i * 10, { color: msg.color || colors.dim, size: 10 });
      }
    }, 30);

    // === GAME OVER (z=40) ===
    FA.addLayer('gameOver', function() {
      var state = FA.getState();
      if (state.screen !== 'victory' && state.screen !== 'defeat') return;
      FA.draw.pushAlpha(0.8);
      FA.draw.rect(0, 0, W, uiY, '#000');
      FA.draw.popAlpha();

      var title = state.screen === 'victory' ? 'VICTORY' : 'DEFEAT';
      var color = state.screen === 'victory' ? '#4f4' : '#f44';
      FA.draw.text(title, W / 2, uiY / 2 - 50, { color: color, size: 28, bold: true, align: 'center', baseline: 'middle' });

      var p = state.player;
      FA.draw.text('Kills: ' + p.kills, W / 2, uiY / 2, { color: colors.text, size: 14, align: 'center', baseline: 'middle' });
      FA.draw.text('Gold: ' + p.gold, W / 2, uiY / 2 + 20, { color: colors.gold, size: 14, align: 'center', baseline: 'middle' });
      FA.draw.text('Deepest level: ' + (state.maxDepthReached || 1), W / 2, uiY / 2 + 40, { color: colors.stairsDown, size: 14, align: 'center', baseline: 'middle' });
      FA.draw.text('SCORE: ' + (state.score || 0), W / 2, uiY / 2 + 75, { color: '#fff', size: 22, bold: true, align: 'center', baseline: 'middle' });
      FA.draw.text('[ R ]  Restart', W / 2, uiY / 2 + 115, { color: colors.dim, size: 16, align: 'center', baseline: 'middle' });
    }, 40);

    // === CUTSCENE (z=50) ===
    FA.addLayer('cutscene', function() {
      var state = FA.getState();
      if (state.screen !== 'cutscene' || !state.cutscene) return;
      var cs = state.cutscene;
      var ctx = FA.getCtx();

      FA.draw.clear('#040810');

      // Scan lines
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.12;
      for (var sy = 0; sy < H; sy += 3) ctx.fillRect(0, sy, W, 1);
      ctx.restore();

      // Typewriter text
      var charsRevealed = Math.floor(cs.timer / cs.speed);
      var lineH = 24;
      var startY = Math.max(50, Math.floor((H - cs.lines.length * lineH) / 2) - 20);
      var charsLeft = charsRevealed;

      for (var i = 0; i < cs.lines.length; i++) {
        if (charsLeft <= 0) break;
        var line = cs.lines[i];
        var showChars = Math.min(charsLeft, line.length);
        var text = line.substring(0, showChars);
        var dimmed = showChars >= line.length && charsLeft - line.length - 4 > 0;
        if (dimmed) {
          ctx.save(); ctx.globalAlpha = 0.7;
          FA.draw.text(text, 80, startY + i * lineH, { color: cs.color, size: 15 });
          ctx.restore();
        } else {
          FA.draw.text(text, 80, startY + i * lineH, { color: cs.color, size: 15 });
        }
        charsLeft -= line.length + 4;
      }

      if (cs.done) {
        if (Math.floor(Date.now() / 600) % 2 === 0) {
          FA.draw.text('[ SPACE ]', W / 2, H - 45, { color: '#445', size: 14, align: 'center', baseline: 'middle' });
        }
      }
    }, 50);
  }

  window.Render = { setup: setupLayers };
})();
