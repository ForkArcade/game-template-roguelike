var GAME_DATA = {
  config: {
    game: {
      canvasW: 800, canvasH: 500, cols: 40, rows: 25, tileSize: 20,
      maxDepth: 5, roomMin: 4, roomMax: 9, roomAttempts: 30
    },
    layout: { type: 'tile', cols: 40, rows: 25, panel: 'bottom', panelSize: 60 },
    colors: {
      bg: '#0a0a12', floor: '#1a1a2e', wall: '#2d2d44', wallCap: '#3d3d5c',
      wallFace: '#2a2248', wallLine: '#332a55', wallInner: '#12101e',
      player: '#4fc3f7', stairs: '#4caf50', hud: '#b0bec5', hudBg: '#111118',
      dim: '#556', bubble: '#4ef', bubbleBg: '#060a12'
    },
    scoring: { kill: 100, gold: 10, depth: 500 },
    ai: { sightRange: 8, alertTimeout: 8, patrolIdleChance: 0.3 },
    bubble: { lineDelay: 200, charDelay: 6, duration: 60, flicker: 25, dimColor: '#1a3030', dismissDelay: 300 }
  },
  locations: {
    floor_1: { depth: 1, dungeon: true, label: 'Floor 1' },
    floor_2: { depth: 2, dungeon: true, label: 'Floor 2' },
    floor_3: { depth: 3, dungeon: true, label: 'Floor 3' },
    floor_4: { depth: 4, dungeon: true, label: 'Floor 4' },
    floor_5: { depth: 5, dungeon: true, label: 'Floor 5' }
  },
  enemies: {
    rat:   { name: 'Rat',   char: 'r', hp: 4,  atk: 2, def: 0, color: '#a67c52', speed: 1, sightRange: 6 },
    snake: { name: 'Snake', char: 's', hp: 6,  atk: 3, def: 1, color: '#66bb6a', speed: 1, sightRange: 8 },
    golem: { name: 'Golem', char: 'G', hp: 12, atk: 5, def: 3, color: '#78909c', speed: 2, sightRange: 5 }
  },
  items: {
    gold:   { name: 'Gold',   char: '$', color: '#ffd54f' },
    potion: { name: 'Potion', char: '!', color: '#e91e63', heal: 8 }
  }
};

(function() {
  var FA = window.FA;
  for (var registry in GAME_DATA) {
    var entries = GAME_DATA[registry];
    for (var id in entries) FA.register(registry, id, entries[id]);
  }

  // Sounds (Web Audio synthesis — must use FA.defineSound)
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
