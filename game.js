// Roguelike — Game Logic
// Generacja mapy, ruch, combat, AI, tury
(function() {
  'use strict';
  var FA = window.FA;

  // === MAP ===

  function generateMap(cols, rows) {
    // TODO: proceduralna generacja dungeonu
    var map = [];
    for (var y = 0; y < rows; y++) {
      map[y] = [];
      for (var x = 0; x < cols; x++) {
        map[y][x] = (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) ? 1 : 0;
      }
    }
    return map;
  }

  function isWalkable(map, x, y) {
    if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return false;
    return map[y][x] === 0;
  }

  // === INIT ===

  function initGame() {
    var cfg = FA.lookup('config', 'game');
    var map = generateMap(cfg.cols, cfg.rows);

    FA.resetState({
      map: map,
      player: { x: 1, y: 1, hp: 20, maxHp: 20, atk: 5, def: 1, gold: 0, kills: 0 },
      enemies: [],
      items: [],
      messages: [],
      gameOver: false,
      turn: 0
    });

    var narCfg = FA.lookup('config', 'narrative');
    if (narCfg) FA.narrative.init(narCfg);
  }

  // === MOVEMENT ===

  function movePlayer(dx, dy) {
    var state = FA.getState();
    if (state.gameOver) return;

    var nx = state.player.x + dx;
    var ny = state.player.y + dy;

    // TODO: combat check
    if (!isWalkable(state.map, nx, ny)) return;

    state.player.x = nx;
    state.player.y = ny;
    state.turn++;
    // TODO: enemy turns, item pickup
  }

  // === EXPORTS ===

  window.Game = {
    init: initGame,
    movePlayer: movePlayer
  };

})();
