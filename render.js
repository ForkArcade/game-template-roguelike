// Roguelike — Rendering
// Warstwy: mapa, entity, floats, UI, overlay
(function() {
  'use strict';
  var FA = window.FA;

  function setupLayers() {
    var cfg = FA.lookup('config', 'game');
    var colors = FA.lookup('config', 'colors');
    var ts = cfg.tileSize;

    // Layer 0: Map
    FA.addLayer('map', function() {
      var state = FA.getState();
      if (!state.map) return;
      for (var y = 0; y < cfg.rows; y++) {
        for (var x = 0; x < cfg.cols; x++) {
          FA.draw.rect(x * ts, y * ts, ts, ts,
            state.map[y][x] === 1 ? colors.wall : colors.floor);
        }
      }
    }, 0);

    // Layer 10: Entities
    FA.addLayer('entities', function() {
      var state = FA.getState();
      if (!state.player) return;
      var p = state.player;
      FA.draw.sprite('player', 'base', p.x * ts, p.y * ts, ts, '@', colors.player);
      // TODO: render enemies, items
    }, 10);

    // Layer 20: Floating messages
    FA.addLayer('floats', function() {
      FA.drawFloats();
    }, 20);

    // Layer 30: UI
    FA.addLayer('ui', function() {
      var state = FA.getState();
      if (!state.player) return;
      // TODO: HP bar, stats, messages
    }, 30);
  }

  window.Render = {
    setup: setupLayers
  };

})();
