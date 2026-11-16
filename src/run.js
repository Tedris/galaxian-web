/* Galaxian clone — run mode: medals, upgrades, mission map.
 *
 * The roguelite layer. Everything here is data: run.js never touches the
 * canvas, game.js draws these screens. Meta state (medals, unlocks) lives in
 * localStorage; a run itself lasts only until death. Offers and mission rows
 * are drawn from a seeded stream, so a daily seed gives every browser the
 * same run.
 */
(function (GX) {
  'use strict';

  var META_KEY = 'galaxian-web.runmeta.v1';

  // Permanent unlocks, bought with medals and kept between runs.
  var UNLOCKS = [
    { id: 'swift', name: 'SWIFT', desc: ['FASTER', '10% SPEED'], cost: 12 },
    { id: 'spare', name: 'SPARE', desc: ['EXTRA', 'LIFE'], cost: 25 },
    { id: 'banker', name: 'BANKER', desc: ['25% MORE', 'MEDALS'], cost: 40 }
  ];

  // Per-run modifiers; one is drafted between stages. Field names are the
  // hook points game.js reads through agg().
  var MODS = [
    { id: 'twin', name: 'TWIN', lines: ['2 SHOTS', '-25% PTS'], maxShots: 2, scoreMul: 0.75 },
    { id: 'burner', name: 'BURNER', lines: ['30% FASTER', 'MORE SWAY'], speedMul: 1.3, swayMul: 1.35 },
    { id: 'flak', name: 'FLAK', lines: ['EATS SHOTS', 'FIRE OFTEN'], flak: true, fireMul: 0.8 },
    { id: 'eagle', name: 'EAGLE', lines: ['25% MORE PTS', 'FAST DIVES'], scoreMul: 1.25, diveMul: 1.2 },
    { id: 'cold', name: 'COLD', lines: ['SLOW DIVES', '-20% PTS'], diveMul: 0.85, scoreMul: 0.8 },
    { id: 'hull', name: 'HULL', lines: ['BLOCKS 1 HIT'], shield: 1 },
    { id: 'bait', name: 'BAIT', lines: ['FLAG KILLS', '1 MORE MEDAL'], bait: true },
    { id: 'broker', name: 'BROKER', lines: ['50% MORE', 'MEDALS'], medalMul: 1.5 },
    { id: 'reserve', name: 'RESERVE', lines: ['2 LIVES', '-15% PTS'], livesBonus: 2, scoreMul: 0.85 }
  ];

  // Mission types. `rows` lists the formation rows present (0 = flagships);
  // `swarm` keeps the armada in its forever-looping attack pattern.
  var NODES = {
    strike: { id: 'strike', name: 'STRIKE', desc: ['STANDARD', 'ARMADA'], reward: 1 },
    ambush: { id: 'ambush', name: 'AMBUSH', desc: ['FLAGSHIP', 'HUNT'], reward: 2 },
    laststand: { id: 'laststand', name: 'LAST STAND', desc: ['SWARM', 'ONLY'], reward: 3, rows: [3, 4, 5], swarm: true }
  };

  var meta = load();
  var run = null;
  var last = null;

  function load() {
    try {
      var m = JSON.parse(localStorage.getItem(META_KEY));
      if (m && typeof m.medals === 'number') {
        return {
          medals: m.medals, unlocks: m.unlocks || {},
          runs: m.runs || 0, bestStage: m.bestStage || 0
        };
      }
    } catch (e) { /* private mode: meta lasts for the page only */ }
    return { medals: 0, unlocks: {}, runs: 0, bestStage: 0 };
  }
  function save() {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
  }

  // FNV-1a + mulberry32: the same seed always deals the same offers and rows.
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rngFor(str) {
    var a = hash(str);
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Combine owned modifiers and unlocks into the numbers game.js reads.
  function agg() {
    var a = {
      maxShots: 1, scoreMul: 1, speedMul: 1, swayMul: 1, diveMul: 1,
      fireMul: 1, shield: 0, livesBonus: 0, bait: false, flak: false, medalMul: 1
    };
    if (!run) return a;
    MODS.forEach(function (m) {
      if (!run.taken[m.id]) return;
      for (var k in m) {
        if (k === 'id' || k === 'name' || k === 'lines' || k === 'desc') continue;
        if (k === 'maxShots') a[k] = Math.max(a[k], m[k]);
        else if (k === 'shield' || k === 'livesBonus') a[k] += m[k];
        else if (typeof m[k] === 'number') a[k] *= m[k];
        else a[k] = a[k] || m[k];
      }
    });
    if (meta.unlocks.swift) a.speedMul *= 1.1;
    if (meta.unlocks.spare) a.livesBonus += 1;
    if (meta.unlocks.banker) a.medalMul *= 1.25;
    return a;
  }

  GX.run = {
    UNLOCKS: UNLOCKS,
    MODS: MODS,
    meta: function () { return meta; },
    owned: function (id) { return !!meta.unlocks[id]; },
    buy: function (id) {
      var u = null;
      for (var i = 0; i < UNLOCKS.length; i++) if (UNLOCKS[i].id === id) u = UNLOCKS[i];
      if (!u || meta.unlocks[id] || meta.medals < u.cost) return false;
      meta.medals -= u.cost;
      meta.unlocks[id] = true;
      save();
      return true;
    },

    dailySeed: function () {
      var d = new Date();
      return 'D' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    },
    start: function (seedStr) {
      run = { seed: String(seedStr || 'X'), taken: {}, medals: 0, lastReward: 0 };
      last = null;
    },

    agg: agg,
    take: function (id) { if (run) run.taken[id] = true; },
    hasMod: function (id) { return !!run && !!run.taken[id]; },
    medals: function () { return run ? run.medals : last ? last.medals : 0; },
    reward: function () { return run ? run.lastReward : (last ? last.reward : 0); },
    last: function () { return last; },

    // Three upgrades the run does not own yet; fewer near the end.
    offer: function (stage) {
      if (!run) return [];
      var pool = MODS.filter(function (m) { return !run.taken[m.id]; });
      var rng = rngFor(run.seed + '|offer|' + stage);
      var out = [];
      while (out.length < 3 && pool.length) {
        out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      }
      return out;
    },

    // Mission row for one stage; column 0 is always a safe strike.
    row: function (stage) {
      if (!run || stage <= 1) return [NODES.strike, NODES.strike, NODES.ambush];
      var rng = rngFor(run.seed + '|row|' + stage);
      var cols = [NODES.strike];
      for (var i = 0; i < 2; i++) {
        var r = rng();
        cols.push(r < 0.45 ? NODES.strike : r < 0.8 ? NODES.ambush : NODES.laststand);
      }
      return cols;
    },

    addMedal: function (n) {
      if (!run) return;
      run.medals += Math.max(1, Math.round(n * agg().medalMul));
    },
    clearStage: function (node) {
      if (!run || !node) return;
      run.lastReward = Math.max(1, Math.round(node.reward * agg().medalMul));
      run.medals += run.lastReward;
    },
    endRun: function (stage) {
      if (!run) return;
      last = { medals: run.medals, stage: stage, reward: run.lastReward };
      meta.medals += run.medals;
      meta.runs += 1;
      meta.bestStage = Math.max(meta.bestStage, stage);
      save();
      run = null;
    }
  };
})(window.GX = window.GX || {});
