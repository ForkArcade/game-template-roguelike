// Location Registry — query API over FA.register('locations', ...)
// Data-driven map type checks instead of hardcoded if-statements
(function() {
  'use strict';
  var FA = window.FA;

  function get(mapId) {
    return FA.lookup('locations', mapId) || null;
  }

  function depth(mapId) {
    var loc = get(mapId);
    return loc ? (loc.depth || 0) : 0;
  }

  function isDungeon(mapId) {
    var loc = get(mapId);
    return loc ? !!loc.dungeon : false;
  }

  function palette(mapId) {
    var loc = get(mapId);
    return loc ? (loc.palette || null) : null;
  }

  function hasEffect(mapId, name) {
    var loc = get(mapId);
    if (!loc || !loc.effects) return false;
    for (var i = 0; i < loc.effects.length; i++) {
      if (loc.effects[i] === name) return true;
    }
    return false;
  }

  window.Location = {
    get: get,
    depth: depth,
    isDungeon: isDungeon,
    palette: palette,
    hasEffect: hasEffect
  };
})();
