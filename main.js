(function() {
  'use strict';
  var FA = window.FA;
  var cfg = FA.lookup('config', 'game');

  FA.initCanvas('game', cfg.canvasW, cfg.canvasH);

  FA.bindKey('up', ['ArrowUp', 'w']);
  FA.bindKey('down', ['ArrowDown', 's']);
  FA.bindKey('left', ['ArrowLeft', 'a']);
  FA.bindKey('right', ['ArrowRight', 'd']);
  FA.bindKey('start', [' ', 'Enter']);
  FA.bindKey('restart', ['r']);

  FA.on('input:action', function(data) {
    var state = FA.getState();
    if (state.screen === 'start' && data.action === 'start') { Game.begin(); return; }
    if ((state.screen === 'victory' || state.screen === 'defeat') && data.action === 'restart') { Game.start(); return; }
    if (state.screen !== 'playing') return;
    switch (data.action) {
      case 'up': Game.movePlayer(0, -1); break;
      case 'down': Game.movePlayer(0, 1); break;
      case 'left': Game.movePlayer(-1, 0); break;
      case 'right': Game.movePlayer(1, 0); break;
    }
  });

  FA.on('game:over', function(data) {
    if (typeof ForkArcade !== 'undefined') ForkArcade.submitScore(data.score);
  });

  FA.setUpdate(function(dt) {
    FA.updateEffects(dt);
    FA.updateFloats(dt);
    var state = FA.getState();
    if (state.shake > 0) {
      state.shakeX = (Math.random() - 0.5) * state.shake;
      state.shakeY = (Math.random() - 0.5) * state.shake;
      state.shake -= dt * 0.012;
      if (state.shake < 0) { state.shake = 0; state.shakeX = 0; state.shakeY = 0; }
    }
    if (state.particles) {
      for (var i = state.particles.length - 1; i >= 0; i--) {
        var p = state.particles[i];
        p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000;
        p.vx *= 0.97; p.vy *= 0.97; p.life -= dt;
        if (p.life <= 0) state.particles.splice(i, 1);
      }
    }
  });

  FA.setRender(function() {
    var state = FA.getState();
    FA.draw.clear(FA.lookup('config', 'colors').bg);
    var ctx = FA.getCtx();
    var sx = state.shakeX || 0, sy = state.shakeY || 0;
    if (sx || sy) ctx.translate(sx, sy);
    FA.renderLayers();
    if (sx || sy) ctx.translate(-sx, -sy);
  });

  Render.setup();
  Game.start();
  if (typeof ForkArcade !== 'undefined') ForkArcade.onReady(function() {});
  FA.start();
})();
