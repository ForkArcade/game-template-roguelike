// Roguelike — Data
// Game data registration: config, enemies, items, modules, narrative, thoughts
(function() {
  'use strict';
  var FA = window.FA;

  // === CONFIG ===
  FA.register('config', 'game', {
    cols: 40, rows: 25,
    tileSize: 20,
    canvasWidth: 800,
    canvasHeight: 600,
    maxDepth: 5,
    roomAttempts: 30,
    roomMinSize: 4,
    roomMaxSize: 9
  });

  FA.register('config', 'colors', {
    bg: '#0d0b1a', wall: '#1e1638', floor: '#201c3a',
    player: '#4ef', enemy: '#fa3', gold: '#fd4', potion: '#4f4',
    stairsDown: '#f80', stairsUp: '#4cf',
    terminal: '#0ff', terminalUsed: '#334',
    text: '#bcc8dd', dim: '#556', narrative: '#8af'
  });

  FA.register('config', 'scoring', {
    killMultiplier: 100,
    goldMultiplier: 10,
    depthBonus: 500
  });

  // === ENEMIES ===
  // behavior is a string tag used by AI state machine in game.js
  // FA.register('enemies', 'id', { name, char, color, hp, atk, def, xp, behavior })

  // === ITEMS ===
  // FA.register('items', 'id', { name, type, char, color, value/healAmount/... })

  // === MODULES (collectible abilities, max 3 slots) ===
  // FA.register('modules', 'id', { name, char, color })

  // === INTERACTABLE INTEL (random text from terminals/shrines) ===
  // FA.register('config', 'terminals', { intel: ['...', '...'] });

  // === NARRATIVE (multi-graph) ===
  FA.register('config', 'narrative', {
    variables: {},
    graphs: {
      arc: {
        startNode: 'start',
        nodes: [
          { id: 'start', label: 'Beginning', type: 'scene' }
          // TODO: add act nodes, path nodes, ending nodes
        ],
        edges: []
      }
      // quest_* graphs added per quest/NPC relationship
    }
  });

  // Narrative text — register one per narrative node
  // FA.register('narrativeText', 'start', { text: '> ...', color: '#4ef' });

  // Cutscenes — full-screen typewriter text at key moments
  // FA.register('cutscenes', 'nodeId', { lines: ['...'], color: '#4ef', speed: 30 });

  // === THOUGHTS (narrative-driven — FA.select pattern, first match wins) ===
  // FA.register('thoughts', 'category', [
  //   { var: 'depth', gte: 4, pool: ['Too deep...', 'The walls hum.'] },
  //   { pool: ['Another level.', 'Deeper.'] }  // fallback
  // ]);
  FA.register('thoughts', 'floor_enter', [{ pool: [] }]);
  FA.register('thoughts', 'combat', [{ pool: [] }]);
  FA.register('thoughts', 'damage', [{ pool: [] }]);
  FA.register('thoughts', 'low_health', [{ pool: [] }]);
  FA.register('thoughts', 'ambient', [{ pool: [] }]);

  // === DIALOGUES (narrative-driven — FA.select pattern, first match wins) ===
  // FA.register('dialogues', 'npc_id', [
  //   { node: 'quest_npc:allied', text: 'I found something useful.' },
  //   { var: 'system_visits', gte: 3, text: 'You keep going deeper.' },
  //   { text: 'Hello.' }  // fallback
  // ]);

})();
