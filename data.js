(function() {
  'use strict';
  var FA = window.FA;

  FA.register('config', 'game', {
    canvasW: 800, canvasH: 500, cols: 40, rows: 25, tileSize: 20,
    maxDepth: 5, roomMin: 4, roomMax: 9, roomAttempts: 30
  });

  FA.register('config', 'colors', {
    bg: '#0a0a12', floor: '#1a1a2e', wall: '#2d2d44', wallCap: '#3d3d5c',
    wallFace: '#2a2248', wallLine: '#332a55', wallInner: '#12101e',
    player: '#4fc3f7', stairs: '#4caf50', hud: '#b0bec5', hudBg: '#111118',
    dim: '#556'
  });

  FA.register('config', 'scoring', { kill: 100, gold: 10, depth: 500 });

  FA.register('enemies', 'rat',   { name: 'Rat',   char: 'r', hp: 4,  atk: 2, def: 0, color: '#a67c52', speed: 1 });
  FA.register('enemies', 'snake', { name: 'Snake', char: 's', hp: 6,  atk: 3, def: 1, color: '#66bb6a', speed: 1 });
  FA.register('enemies', 'golem', { name: 'Golem', char: 'G', hp: 12, atk: 5, def: 3, color: '#78909c', speed: 2 });

  FA.register('items', 'gold',   { name: 'Gold',   char: '$', color: '#ffd54f' });
  FA.register('items', 'potion', { name: 'Potion', char: '!', color: '#e91e63', heal: 8 });

  FA.defineSound('hit', function(ctx, dest) {
    var o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
    o.connect(dest); o.start(); o.stop(ctx.currentTime + 0.08);
  });
  FA.defineSound('pickup', function(ctx, dest) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(600, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    o.connect(dest); o.start(); o.stop(ctx.currentTime + 0.1);
  });
  FA.defineSound('stairs', function(ctx, dest) {
    var o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(300, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
    o.connect(dest); o.start(); o.stop(ctx.currentTime + 0.2);
  });
})();
