// Roguelike — Data
// Rejestracja danych gry: config, wrogowie, itemy, zachowania, scoring, narracja
(function() {
  'use strict';
  var FA = window.FA;

  // === CONFIG ===
  FA.register('config', 'game', {
    cols: 40, rows: 25,
    tileSize: 20,
    canvasWidth: 800,
    canvasHeight: 600
  });

  FA.register('config', 'colors', {
    bg: '#0d0b1a', wall: '#1e1638', floor: '#201c3a',
    player: '#4ef', text: '#ddd', dim: '#777'
  });

  FA.register('config', 'scoring', {
    killMultiplier: 100,
    goldMultiplier: 10
  });

  // === ENEMIES ===
  // FA.register('enemies', id, { name, char, color, hp, atk, def, xp, behavior })

  // === ITEMS ===
  // FA.register('items', id, { name, type, char, color, ... })

  // === BEHAVIORS ===
  // FA.register('behaviors', id, { act: function(entity, state) { return {type:'move', dx, dy} } })

  // === NARRATIVE ===
  FA.register('config', 'narrative', {
    startNode: 'start',
    variables: {},
    graph: {
      nodes: [
        { id: 'start', label: 'Poczatek', type: 'scene' }
      ],
      edges: []
    }
  });

})();
