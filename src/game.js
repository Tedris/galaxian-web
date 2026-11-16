/* Galaxian clone — game logic and rendering.
 *
 * Modelled on Namco's 1979 arcade version:
 *   - native 224x256 portrait playfield, 60 Hz fixed-step simulation
 *   - 46 aliens per round: 2 Galaxian Flagships, 6 red escorts, 8 purple and
 *     30 blue Galaxians in three rows of ten, on a 15 px pitch grid
 *   - one Galaxip shot on screen at a time; aliens peel off from the edges of
 *     the formation, dive along type-specific curves and drop shots that lean
 *     toward the player; survivors climb back into their slot
 *   - flagships attack in convoys of up to two red escorts, "capture" the
 *     escorts parked under them, and can run away once their escorts are dead
 *     (escaped flagships join the next round, up to four in total)
 *   - once three or fewer aliens remain in formation, or no blue/purple remain,
 *     the armada swarms and nobody goes home
 *   - scoring 30/40/50/60 in formation, 60/80/100 diving, and 150/200/300/800
 *     for a diving flagship depending on how its escorts died
 */
(function (GX) {
  'use strict';

  var W = 224, H = 256;
  var CX = W / 2;

  var FORM = { pitch: 15, rowStep: 12, top: 54, swayAmp: 6, swayPeriod: 2.6 };
  var ROWS = [
    { type: 'flagship', n: 2 },
    { type: 'red', n: 6 },
    { type: 'purple', n: 8 },
    { type: 'blue', n: 10 },
    { type: 'blue', n: 10 },
    { type: 'blue', n: 10 }
  ];
  // Flagship slots, in order of appearance; slots 3 and 4 are escaped ships.
  var FLAG_X = [-22.5, 22.5, -52.5, 52.5];

  var PLAYER = { y: 232, speed: 140, hw: 5, hh: 6 };
  var PBULLET = { speed: 430, hw: 1, hh: 2 };
  var EBULLET = { speed: 235, hw: 1, hh: 2, lean: 55, fireRange: 90 };
  var ARMADA = 46;
  var EXTRA_LIFE_AT = 4000;
  var SCORE_MAX = 999990;
  var FLAG_LIMIT = 48;
  var LIVES = 3;
  var STORE_KEY = 'galaxian-web.scores.v1';

  var COL = {
    score: '#db0000', white: '#c3c3db', bright: '#ffffff', yellow: '#dbdb00',
    cyan: '#00c3d9', blue: '#4a4aff', red: '#ff2a2a', dim: '#6d6d6d'
  };

  // ------------------------------------------------------------------ utils

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s.slice(-len);
  }

  function loadScores() {
    try {
      var list = JSON.parse(localStorage.getItem(STORE_KEY));
      if (Array.isArray(list)) {
        return list.filter(function (n) { return typeof n === 'number'; }).slice(0, 3);
      }
    } catch (e) { /* private mode: scores stay in memory */ }
    return [];
  }
  function saveScores(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {}
  }

  // ------------------------------------------------------------------ state

  var G = {
    state: 'attract',   // attract | ready | play | dying | clear | over | map | draft | shop
    stateT: 0,
    t: 0,
    players: [],
    turn: 0,
    nPlayers: 1,
    round: 1,
    escapedFlags: 0,
    enemies: [],
    pshots: [],
    eshots: [],
    fx: [],
    stars: [],
    swayT: 0,
    swayX: 0,
    swayPause: 0,
    attackTimer: 2,
    convoyTimer: 5,
    freezeTimer: 0,
    convoy: null,
    attackSide: 1,
    demo: true,
    hiscores: loadScores(),
    paused: false,
    input: { left: false, right: false, fire: false },
    fireLatch: false,
    mode: 'arcade',      // 'arcade' stays byte-identical to the board sim
    node: null,          // the mission node picked on the map screen
    cursor: 0,
    offers: null,
    mapRow: null,
    prevIn: { left: false, right: false, fire: false }
  };
  G.best = G.hiscores.length ? G.hiscores[0] : 0;

  function newPlayer() {
    return { score: 0, lives: LIVES, bonusGiven: false, x: CX, alive: true, invuln: 0, shield: 0 };
  }
  function P() { return G.players[G.turn]; }

  // Identity modifier set; GX.run.agg() overrides it during a run.
  var NEUTRAL = { maxShots: 1, scoreMul: 1, speedMul: 1, swayMul: 1, diveMul: 1, fireMul: 1, shield: 0, livesBonus: 0, bait: false, flak: false, medalMul: 1 };
  function M() { return G.mode === 'run' && GX.run ? GX.run.agg() : NEUTRAL; }
  function edge(name) { return G.input[name] && !G.prevIn[name]; }
  function latch() {
    G.prevIn.left = G.input.left;
    G.prevIn.right = G.input.right;
    G.prevIn.fire = G.input.fire;
  }

  G.stars = (function () {
    var cols = [COL.red, COL.white, COL.blue, COL.cyan, COL.dim, COL.white];
    var out = [];
    for (var i = 0; i < 96; i++) {
      out.push({
        x: Math.floor(Math.random() * W),
        y: Math.floor(Math.random() * H),
        c: cols[Math.floor(Math.random() * cols.length)],
        v: 6 + Math.random() * 18
      });
    }
    return out;
  })();

  // ------------------------------------------------------------ formation

  function rowCount(row) {
    if (G.node && G.node.rows && G.node.rows.indexOf(row) < 0) return 0;
    return row === 0 ? Math.min(4, 2 + G.escapedFlags) : ROWS[row].n;
  }
  function slotX(row, col) {
    if (row === 0) return CX + FLAG_X[col % FLAG_X.length];
    return CX + (col - (ROWS[row].n - 1) / 2) * FORM.pitch;
  }
  function slotY(row) { return FORM.top + row * FORM.rowStep; }

  function buildFormation(demo) {
    G.enemies = [];
    G.pshots.length = 0;
    G.eshots.length = 0;
    G.convoy = null;
    G.demo = !!demo;
    if (demo) { G.round = 1; G.escapedFlags = 0; }
    for (var r = 0; r < ROWS.length; r++) {
      for (var c = 0; c < rowCount(r); c++) {
        G.enemies.push({
          type: ROWS[r].type, row: r, col: c,
          slotX: slotX(r, c), slotY: slotY(r),
          x: slotX(r, c), y: slotY(r),
          state: 'form', base: 0, diveT: 0, dir: 1,
          fireT: 0.5 + Math.random(), lag: 0, convoy: null, captured: false
        });
      }
    }
    G.swayT = 0;
    G.attackTimer = demo ? 1.2 : 2.2;
    G.convoyTimer = demo ? 4 : 6;
    if (!demo && G.node && G.node.id === 'ambush') G.convoyTimer = 0.8;
    G.freezeTimer = 0;
    G.convoy = null;
  }

  function countInFormation(type) {
    var n = 0;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.state === 'form' && (!type || e.type === type)) n++;
    }
    return n;
  }

  function isSwarm() {
    if (G.node && G.node.swarm) return true;
    return countInFormation() <= 3 || (countInFormation('blue') + countInFormation('purple')) === 0;
  }

  // A flagship holds the red escorts parked under it; they only fly with her.
  function markCaptured() {
    var flags = [];
    for (var i = 0; i < G.enemies.length; i++) {
      if (G.enemies[i].type === 'flagship' && G.enemies[i].state === 'form') flags.push(G.enemies[i]);
    }
    for (var j = 0; j < G.enemies.length; j++) {
      var e = G.enemies[j];
      e.captured = false;
      if (e.type !== 'red' || e.state !== 'form') continue;
      for (var k = 0; k < flags.length; k++) {
        if (Math.abs(flags[k].slotX - e.slotX) < FORM.pitch * 0.6) { e.captured = true; break; }
      }
    }
  }

  // True when every red escort that could fly with this flagship is destroyed.
  function flagEscortsGone(flag) {
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.type === 'red' && Math.abs(e.slotX - flag.slotX) < FORM.pitch * 1.5) return false;
    }
    return true;
  }

  function sway(dt) {
    if (G.swayPause > 0) { G.swayPause -= dt; return G.swayX; }
    G.swayT += dt;
    G.swayX = FORM.swayAmp * M().swayMul * Math.sin(G.swayT * Math.PI * 2 / FORM.swayPeriod);
    return G.swayX;
  }

  // ----------------------------------------------------------------- dives

  // Headings are in radians: 0 = straight down, positive = drifting right;
  // `dir` (+1/-1) mirrors the whole curve. A diver eases toward each phase's
  // target heading, which gives the smooth arcs the arcade is known for:
  // blue swings out then bounces side to side, purple traces one long S, red
  // loops over before dropping, the flagship arcs wide and slow.
  var DIVE = {
    blue: [{ t: 0.22, spd: 60, head: 1.2, rate: 240 },
           { t: 0.30, spd: 95, head: 0.12, rate: 300 },
           { t: -1, spd: 100, head: 0.05, weave: 0.75, wfreq: 6 }],
    purple: [{ t: 0.45, spd: 70, head: 1.05, rate: 150 },
             { t: 0.55, spd: 92, head: -0.18, rate: 130 },
             { t: -1, spd: 96, head: 0.1, weave: 0.3, wfreq: 2.2 }],
    red: [{ t: 0.5, spd: 84, head: 2.6, rate: 430 },
          { t: 0.35, spd: 100, head: 0.2, rate: 400 },
          { t: -1, spd: 104, head: 0.05 }],
    flagship: [{ t: 0.8, spd: 66, head: 1.35, rate: 130 },
               { t: 0.5, spd: 80, head: 0.2, rate: 100 },
               { t: -1, spd: 88, head: 0.05, weave: 0.25, wfreq: 1.3 }]
  };

  function difficulty() {
    var r = G.round - 1;
    return {
      speed: 1 + Math.min(0.7, 0.045 * r),
      gap: Math.max(0.45, 2.3 * Math.pow(0.94, r)),
      maxDivers: Math.min(6, 2 + Math.floor(r / 2)),
      fire: Math.max(0.34, 0.95 - 0.05 * r)
    };
  }

  function startDive(e, dir) {
    e.state = 'dive';
    e.diveT = 0;
    e.dir = dir || (e.x < CX ? 1 : -1);
    e.base = e.dir * 0.25;
    e.trail = null;
    e.convoy = null;
    if (!G.demo) GX.audio.dive();
  }

  function pickAttacker() {
    // Attack runs start from an outer column of some row, never the middle.
    var edges = [], byRow = {}, i;
    for (i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.state !== 'form' || e.type === 'flagship' || e.captured) continue;
      (byRow[e.row] = byRow[e.row] || []).push(e);
    }
    for (var row in byRow) {
      var list = byRow[row].sort(function (a, b) { return a.col - b.col; });
      edges.push(list[0]);
      if (list.length > 1) edges.push(list[list.length - 1]);
    }
    if (!edges.length) return null;
    var wantRight = G.attackSide > 0;
    G.attackSide = -G.attackSide;
    var side = edges.filter(function (e) { return (e.slotX > CX) === wantRight; });
    var pool = side.length ? side : edges;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function startConvoy(flag) {
    var escorts = [], i;
    for (i = 0; i < G.enemies.length && escorts.length < 2; i++) {
      var e = G.enemies[i];
      if (e.type === 'red' && e.state === 'form' && Math.abs(e.slotX - flag.slotX) < FORM.pitch * 1.5) {
        escorts.push(e);
      }
    }
    var convoy = { flag: flag, escorts: escorts, killed: 0, total: escorts.length, done: false };
    G.convoy = convoy;
    startDive(flag, flag.x < CX ? 1 : -1);
    flag.convoy = convoy;
    flag.trail = [];
    for (i = 0; i < escorts.length; i++) {
      var esc = escorts[i];
      startDive(esc, flag.dir);
      esc.state = 'escort';
      esc.convoy = convoy;
      esc.lag = 18 * (i + 1);
    }
  }

  // ---------------------------------------------------------------- effects

  function explode(x, y, kind) {
    G.fx.push({
      x: x, y: y, i: 0, t: 0, step: kind === 'player' ? 0.14 : 0.09,
      frames: kind === 'player' ? ['pe0', 'pe1', 'pe2', 'pe3'] : ['ex0', 'ex1', 'ex2', 'ex3']
    });
  }

  function addScore(pts) {
    var p = P();
    if (!p) return;
    if (G.mode === 'run') pts = Math.max(1, Math.round(pts * M().scoreMul));
    p.score += pts;
    if (p.score > SCORE_MAX) p.score -= SCORE_MAX;
    if (!p.bonusGiven && p.score >= EXTRA_LIFE_AT) {
      p.bonusGiven = true;
      p.lives++;
      GX.audio.bonus();
    }
  }

  function kill(e, byPlayer) {
    var diving = e.state === 'dive' || e.state === 'escort';
    var cv = e.convoy;
    var pts;
    if (e.type === 'flagship') {
      // The payout follows how many of her escorts died first — none 150,
      // one 200, both 800 — which is the arcade's own table.
      if (!diving) pts = 60;
      else if (!cv || cv.killed === 0) pts = 150;
      else if (cv.killed === 1) pts = 200;
      else pts = 800;
      if (diving) {
        G.freezeTimer = 1.3;              // the armada holds its fire
        if (cv) cv.done = true;
        if (byPlayer && G.mode === 'run') GX.run.addMedal(1 + (M().bait ? 1 : 0));
      }
      GX.audio.flagBoom();
    } else {
      pts = GX.gfx.ENEMY[e.type].points[diving ? 1 : 0];
      GX.audio.boom();
      if (cv && diving) cv.killed++;
    }
    if (byPlayer) addScore(pts);
    explode(e.x, e.y, 'enemy');

    var i = G.enemies.indexOf(e);
    if (i >= 0) G.enemies.splice(i, 1);
    if (cv && G.convoy === cv) {
      if (e === cv.flag) cv.done = true;
      var stillFlying = cv.escorts.filter(function (x) { return G.enemies.indexOf(x) >= 0; });
      if (G.enemies.indexOf(cv.flag) < 0 && !stillFlying.length) G.convoy = null;
    }
  }

  // ------------------------------------------------------------- lifecycle

  function startRound(first) {
    buildFormation(false);
    var p = P();
    p.x = CX;
    p.alive = true;
    p.invuln = 2.2;
    p.shield = G.mode === 'run' ? M().shield : 0;
    G.state = 'ready';
    G.stateT = 0;
    GX.audio.stageStart();
  }

  function startGame(nPlayers) {
    GX.audio.unlock();
    G.nPlayers = nPlayers;
    G.mode = 'arcade';
    G.node = null;
    G.players = [];
    for (var i = 0; i < nPlayers; i++) G.players.push(newPlayer());
    G.turn = 0;
    G.round = 1;
    G.escapedFlags = 0;
    G.fx.length = 0;
    G.paused = false;
    startRound(true);
  }

  function startRun(seedStr) {
    GX.audio.unlock();
    GX.run.start(seedStr);
    G.mode = 'run';
    G.node = null;
    G.players = [newPlayer()];
    G.players[0].lives += GX.run.agg().livesBonus;
    G.turn = 0;
    G.round = 1;
    G.escapedFlags = 0;
    G.fx.length = 0;
    G.paused = false;
    G.mapRow = null;
    G.offers = null;
    G.cursor = 1;
    G.state = 'map';
    G.stateT = 0;
    GX.audio.stageStart();
  }

  function openShop() {
    GX.audio.unlock();
    G.state = 'shop';
    G.stateT = 0;
    G.cursor = 0;
  }

  function selectFromAttract() {
    if (GX.run && G.cursor === 1) startRun(GX.run.dailySeed());
    else if (GX.run && G.cursor === 2) openShop();
    else startGame(1);
  }

  function toAttract() {
    G.state = 'attract';
    G.cursor = 0;
    G.node = null;
    G.stateT = 0;
    G.round = 1;
    buildFormation(true);
  }

  function nextTurnOrAttract() {
    var next = G.turn + 1;
    if (G.nPlayers > 1 && next < G.nPlayers) {
      G.turn = next;
      startRound(false);
    } else if (G.players.some(function (p) { return p.lives > 0; })) {
      G.turn = 0;
      startRound(false);
    } else {
      toAttract();
    }
  }

  function recordScore(score) {
    G.hiscores.push(score);
    G.hiscores.sort(function (a, b) { return b - a; });
    G.hiscores = G.hiscores.slice(0, 3);
    G.best = G.hiscores[0];
    saveScores(G.hiscores);
  }

  // ---------------------------------------------------------------- update

  function updateStars(dt) {
    for (var i = 0; i < G.stars.length; i++) {
      var s = G.stars[i];
      s.y += s.v * dt;
      if (s.y > H) { s.y -= H; s.x = Math.floor(Math.random() * W); }
    }
  }

  function phaseAt(prog, t) {
    var acc = 0;
    for (var i = 0; i < prog.length; i++) {
      if (prog[i].t < 0 || t < acc + prog[i].t) return prog[i];
      acc += prog[i].t;
    }
    return prog[prog.length - 1];
  }

  function steer(e, dt, f) {
    var seg = phaseAt(DIVE[e.type], e.diveT);
    var target = (seg.head + (seg.weave ? Math.sin(e.diveT * seg.wfreq) * seg.weave : 0)) * e.dir;
    var maxStep = (seg.rate || 200) * Math.PI / 180 * dt;
    e.base += clamp(target - e.base, -maxStep, maxStep);
    if (e.x < 12) e.base = Math.max(e.base, 0.35);         // steer back inside
    if (e.x > W - 12) e.base = Math.min(e.base, -0.35);
    var spd = seg.spd * f;
    e.x += Math.sin(e.base) * spd * dt;
    e.y += Math.cos(e.base) * spd * dt;
  }

  function enemyFire(e, dt) {
    if (G.demo || G.freezeTimer > 0) return;
    e.fireT -= dt;
    if (e.fireT > 0) return;
    var above = PLAYER.y - e.y;
    if (above > EBULLET.fireRange || above < 14) return;   // never from far up
    e.fireT = difficulty().fire * M().fireMul * (0.6 + Math.random() * 0.8);
    var p = P();
    G.eshots.push({
      x: e.x, y: e.y + 4,
      vx: clamp(((p ? p.x : CX) - e.x) * 0.7, -EBULLET.lean, EBULLET.lean),
      vy: EBULLET.speed
    });
    GX.audio.enemyShot();
  }

  function returnToFormation(e) {
    e.state = 'return';
    e.y = -10;
    e.x = clamp(e.slotX + Math.random() * 30 - 15, 12, W - 12);
    e.base = 0;
    if (!G.demo) GX.audio.diveReturn();
  }

  function updateEnemies(dt) {
    var f = difficulty().speed * M().diveMul;
    var swarm = isSwarm();
    var frozen = G.freezeTimer > 0 || G.state !== 'play';
    var sx0 = sway(dt);

    markCaptured();

    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      e.slotX = slotX(e.row, e.col);
      e.slotY = slotY(e.row);
      var sx = e.slotX + sx0;

      switch (e.state) {
        case 'form':
          e.x += (sx - e.x) * Math.min(1, dt * 12);
          e.y += (e.slotY - e.y) * Math.min(1, dt * 12);
          break;

        case 'escort': {
          var cv = e.convoy;
          if (!cv || cv.done || cv.flag.state !== 'dive') {
            e.state = 'dive'; e.diveT = 0; e.convoy = null;
            break;
          }
          var tr = cv.flag.trail, idx = tr ? tr.length - e.lag : -1;
          if (idx >= 0) { e.x = tr[idx].x; e.y = tr[idx].y; }
          else steer(e, dt, f);
          if (!frozen) enemyFire(e, dt);
          break;
        }

        case 'dive':
          e.diveT += dt;
          steer(e, dt, f);
          if (e.convoy && e.convoy.flag === e) {
            e.trail.push({ x: e.x, y: e.y });
            if (e.trail.length > 400) e.trail.shift();
          }
          if (!frozen) enemyFire(e, dt);
          break;

        case 'return':
          e.y += 80 * f * dt;
          if (e.y > e.slotY - 40) e.x += (sx - e.x) * Math.min(1, dt * 4);
          else e.x += Math.sin(e.y * 0.05) * 30 * dt;
          if (e.y >= e.slotY - 1 && Math.abs(e.x - sx) < 2) {
            e.state = 'form'; e.x = sx; e.y = e.slotY;
          }
          break;

        case 'escape':
          e.y += 95 * f * dt;
          e.x += Math.sin(e.y * 0.06) * 26 * dt;
          break;
      }

      if (e.state === 'dive' || e.state === 'escort') e.x = clamp(e.x, 8, W - 8);

      if (e.y > H + 8 && e.state !== 'form' && e.state !== 'return') {
        if (e.type === 'flagship' && !swarm && flagEscortsGone(e)) {
          G.escapedFlags = Math.min(2, G.escapedFlags + 1);
          if (G.convoy && G.convoy.flag === e) G.convoy = null;
          G.enemies.splice(i, 1);
          continue;
        }
        if (swarm) {
          e.y = -8; e.x = clamp(W - e.x, 12, W - 12); e.diveT = 0; e.base = 0; e.convoy = null;
        } else {
          returnToFormation(e);
        }
      }
      if (e.y > H + 40) { G.enemies.splice(i, 1); continue; }
    }

    if (G.state !== 'play') return;
    if (G.freezeTimer > 0) { G.freezeTimer -= dt; return; }

    var d = difficulty();
    var divers = 0;
    for (var k = 0; k < G.enemies.length; k++) {
      if (G.enemies[k].state === 'dive' || G.enemies[k].state === 'escort') divers++;
    }

    // one convoy at a time; flagships otherwise stay home
    G.convoyTimer -= dt;
    if (G.convoyTimer <= 0 && !G.convoy) {
      var flags = G.enemies.filter(function (e) { return e.type === 'flagship' && e.state === 'form'; });
      if (flags.length) startConvoy(flags[Math.floor(Math.random() * flags.length)]);
      G.convoyTimer = (swarm ? 4 : 8) + Math.random() * 4;
    }

    G.attackTimer -= dt;
    if (G.attackTimer <= 0) {
      if (divers < (swarm ? 12 : d.maxDivers)) {
        var e = pickAttacker();
        if (e) { startDive(e, swarm ? (e.x < CX ? 1 : -1) : 0); divers++; }
      }
      G.attackTimer = d.gap * (0.55 + Math.random() * 0.9);
    }
  }

  function updatePlayer(dt) {
    var p = P();
    if (!p || !p.alive) return;
    var dir = (G.input.right ? 1 : 0) - (G.input.left ? 1 : 0);
    p.x = clamp(p.x + dir * PLAYER.speed * M().speedMul * dt, 10, W - 10);
    if (p.invuln > 0) p.invuln -= dt;
    if (G.input.fire && G.pshots.length < M().maxShots && !G.fireLatch) {
      G.pshots.push({ x: p.x, y: PLAYER.y - 8 });
      GX.audio.shot();
      G.fireLatch = true;
    }
    if (!G.input.fire) G.fireLatch = false;
  }

  function updateShots(dt) {
    var i, j;
    for (i = G.pshots.length - 1; i >= 0; i--) {
      var b = G.pshots[i];
      b.y -= PBULLET.speed * dt;
      if (b.y < 12) {
        G.pshots.splice(i, 1);
        G.swayPause = 0.22;        // a miss makes the armada hesitate
        continue;
      }
      if (M().flak) {
        var ate = false;
        for (j = 0; j < G.eshots.length; j++) {
          var s0 = G.eshots[j];
          if (Math.abs(s0.x - b.x) < 3 && Math.abs(s0.y - b.y) < 5) {
            G.eshots.splice(j, 1);
            G.pshots.splice(i, 1);
            GX.audio.enemyShot();
            ate = true;
            break;
          }
        }
        if (ate) continue;
      }
      var hit = null;
      for (j = 0; j < G.enemies.length; j++) {
        var e = G.enemies[j];
        var box = GX.gfx.ENEMY[e.type];
        if (Math.abs(e.x - b.x) < box.w / 2 + PBULLET.hw && Math.abs(e.y - b.y) < box.h / 2 + PBULLET.hh) {
          hit = e;
          break;
        }
      }
      if (hit) { G.pshots.splice(i, 1); kill(hit, true); }
    }

    var p = P();
    for (i = G.eshots.length - 1; i >= 0; i--) {
      var s = G.eshots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > H || s.x < -4 || s.x > W + 4) { G.eshots.splice(i, 1); continue; }
      if (p && p.alive && p.invuln <= 0 && G.state === 'play' &&
          Math.abs(s.x - p.x) < EBULLET.hw + PLAYER.hw && Math.abs(s.y - p.y) < EBULLET.hh + PLAYER.hh) {
        G.eshots.splice(i, 1);
        killPlayer();
      }
    }
  }

  function collideShip() {
    var p = P();
    if (!p || !p.alive || p.invuln > 0) return;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i], box = GX.gfx.ENEMY[e.type];
      if (Math.abs(e.x - p.x) < box.w / 2 + PLAYER.hw && Math.abs(e.y - PLAYER.y) < box.h / 2 + PLAYER.hh) {
        kill(e, true);          // a ram pays out, and still costs the Galaxip
        killPlayer();
        return;
      }
    }
  }

  function updateFx(dt) {
    for (var i = G.fx.length - 1; i >= 0; i--) {
      var f = G.fx[i];
      f.t += dt;
      while (f.t > f.step) { f.t -= f.step; f.i++; }
      if (f.i >= f.frames.length) G.fx.splice(i, 1);
    }
  }

  function killPlayer() {
    var p = P();
    if (p.shield > 0) {              // hull plating eats one hit per shield
      p.shield--;
      p.invuln = 1.6;
      GX.audio.bonus();
      return;
    }
    p.alive = false;
    p.lives--;
    explode(p.x, PLAYER.y, 'player');
    GX.audio.playerBoom();
    GX.audio.setPulse(false);
    G.state = 'dying';
    G.stateT = 0;
    G.pshots.length = 0;
    G.eshots.length = 0;
  }

  function update(dt) {
    if (G.paused) { latch(); return; }
    G.t += dt;
    updateStars(dt);
    GX.audio.updatePulse(dt);

    switch (G.state) {
      case 'attract': {
        G.stateT += dt;
        updateEnemies(dt);
        if (GX.run) {
          if (edge('left')) G.cursor = (G.cursor + 2) % 3;
          if (edge('right')) G.cursor = (G.cursor + 1) % 3;
          if (edge('fire')) selectFromAttract();
        }
        if (G.state === 'attract' && G.stateT > 1.0) {
          G.stateT = 0;
          var e = pickAttacker();
          if (e) startDive(e);
        }
        if (!G.enemies.length) buildFormation(true);
        break;
      }

      case 'ready':
        G.stateT += dt;
        updateEnemies(dt);
        updatePlayer(dt);
        if (G.stateT > 1.5) { G.state = 'play'; G.stateT = 0; }
        break;

      case 'play':
        G.stateT += dt;
        updateEnemies(dt);
        updatePlayer(dt);
        updateShots(dt);
        collideShip();
        GX.audio.setPulse(true, G.enemies.length / ARMADA);
        if (!G.enemies.length) {
          G.state = 'clear';
          G.stateT = 0;
          if (G.mode === 'run') GX.run.clearStage(G.node);
          GX.audio.stageClear();
          GX.audio.setPulse(false);
        }
        break;

      case 'dying':
        G.stateT += dt;
        updateEnemies(dt);
        updateShots(dt);
        if (G.stateT > 1.8) {
          var p = P();
          if (p.lives < 0) {
            G.state = 'over';
            G.stateT = 0;
            recordScore(p.score);
            if (G.mode === 'run') GX.run.endRun(G.round);
          } else {
            p.alive = true;
            p.x = CX;
            p.invuln = 2.2;
            G.freezeTimer = 1.0;
            G.state = 'play';
            G.stateT = 0;
          }
        }
        break;

      case 'clear':
        G.stateT += dt;
        if (G.stateT > 2.0) {
          G.round++;
          if (G.mode === 'run') {
            G.node = null;
            G.offers = GX.run.offer(G.round);
            G.cursor = Math.min(1, G.offers.length - 1);
            G.state = G.offers.length ? 'draft' : 'map';
            G.mapRow = null;
            G.stateT = 0;
          } else {
            startRound(false);
          }
        }
        break;

      case 'map':
        G.stateT += dt;
        if (!G.mapRow) G.mapRow = GX.run.row(G.round);
        if (edge('left')) G.cursor = (G.cursor + 2) % 3;
        if (edge('right')) G.cursor = (G.cursor + 1) % 3;
        if (edge('fire')) {
          G.node = G.mapRow[G.cursor];
          GX.audio.coin();
          startRound(false);
        }
        break;

      case 'draft':
        G.stateT += dt;
        if (G.offers.length > 1) {
          if (edge('left')) G.cursor = (G.cursor + G.offers.length - 1) % G.offers.length;
          if (edge('right')) G.cursor = (G.cursor + 1) % G.offers.length;
        }
        if (edge('fire')) {
          GX.run.take(G.offers[G.cursor].id);
          GX.audio.coin();
          G.cursor = 1;
          G.state = 'map';
          G.mapRow = null;
          G.stateT = 0;
        }
        break;

      case 'shop':
        G.stateT += dt;
        if (edge('left')) G.cursor = (G.cursor + 3) % 4;
        if (edge('right')) G.cursor = (G.cursor + 1) % 4;
        if (edge('fire')) {
          if (G.cursor === 3) {
            toAttract();
          } else if (GX.run.buy(GX.run.UNLOCKS[G.cursor].id)) {
            GX.audio.coin();
          } else {
            GX.audio.enemyShot();
          }
        }
        break;

      case 'over':
        G.stateT += dt;
        updateEnemies(dt);
        if (G.stateT > 3.0) nextTurnOrAttract();
        break;
    }
    updateFx(dt);
    latch();
  }

  // ------------------------------------------------------------------ draw

  function flagSprite(g, x, y, big) {
    g.fillStyle = COL.white;
    g.fillRect(x, y, 1, big ? 13 : 9);
    g.fillStyle = COL.score;
    var w = big ? [4, 6, 6, 5, 3] : [3, 4, 3, 2];
    for (var i = 0; i < w.length; i++) g.fillRect(x + 1, y + i, w[i], 1);
  }

  function drawRoundFlags(g, round) {
    round = Math.min(FLAG_LIMIT, round);
    var tens, units;
    if (round === FLAG_LIMIT) { tens = 4; units = 8; }     // the arcade caps at 48
    else { tens = Math.floor(round / 10); units = round % 10; }
    var x = W - 3 - (tens + units) * 8;
    for (var i = 0; i < tens; i++, x += 8) flagSprite(g, x, 243, true);
    for (var j = 0; j < units; j++, x += 8) flagSprite(g, x, 247, false);
  }

  function drawHud(g) {
    var p = P();
    GX.gfx.text(g, pad(p ? p.score : 0, 6), 8, 9, COL.score);
    GX.gfx.text(g, 'HIGH SCORE', CX, 1, COL.white, { align: 'center' });
    GX.gfx.text(g, pad(G.best, 6), CX, 9, COL.white, { align: 'center' });
    if (G.state === 'attract') return;
    if (G.mode === 'run') GX.gfx.text(g, 'MEDALS ' + pad(GX.run.medals(), 3), 8, 20, COL.yellow);
    if (G.nPlayers > 1) {
      GX.gfx.text(g, (G.turn + 1) + ' UP', 8, 1, G.turn === 0 ? COL.cyan : COL.yellow);
    }
    var lives = p ? Math.max(0, p.lives) : LIVES;
    for (var i = 0; i < Math.min(lives, 6); i++) GX.gfx.blit(g, 'shipMini', 12 + i * 15, 246);
    drawRoundFlags(g, G.round);
  }

  function drawEnemies(g) {
    var flap = Math.floor(G.t * 5);
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      GX.gfx.draw(g, GX.gfx.ENEMY[e.type].sprite[(e.col + e.row + flap) % 2], e.x, e.y);
    }
  }

  function drawShots(g) {
    for (var i = 0; i < G.pshots.length; i++) GX.gfx.blit(g, 'bullet', G.pshots[i].x, G.pshots[i].y - 4);
    for (var j = 0; j < G.eshots.length; j++) GX.gfx.blit(g, 'ebullet', G.eshots[j].x - 1, G.eshots[j].y - 2);
  }

  function drawPlayer(g) {
    var p = P();
    if (!p || !p.alive) return;
    if (p.invuln > 0 && Math.floor(G.t * 12) % 2 === 0) return;
    GX.gfx.draw(g, 'galaxip', p.x, PLAYER.y);
  }

  function drawFx(g) {
    for (var i = 0; i < G.fx.length; i++) {
      var f = G.fx[i];
      GX.gfx.draw(g, f.frames[Math.min(f.i, f.frames.length - 1)], f.x, f.y);
    }
  }

  function drawAttract(g) {
    GX.gfx.text(g, 'GALAXIAN', CX + 1, 35, COL.score, { align: 'center', scale: 3 });
    GX.gfx.text(g, 'GALAXIAN', CX, 34, COL.yellow, { align: 'center', scale: 3 });
    GX.gfx.text(g, 'WE ARE THE GALAXIANS.', CX, 196, COL.white, { align: 'center' });
    GX.gfx.text(g, 'MISSION: DESTROY ALIENS', CX, 206, COL.cyan, { align: 'center' });
    if (GX.run) {
      var modes = ['ARCADE', 'RUN', 'SHOP'];
      var mx = [CX - 42, CX + 9, CX + 55];
      var blink = Math.floor(G.t * 2.5) % 2 === 0;
      for (var m = 0; m < 3; m++) {
        GX.gfx.text(g, modes[m], mx[m], 166, m === G.cursor ? (blink ? COL.yellow : COL.bright) : COL.dim, { align: 'center' });
      }
      GX.gfx.text(g, 'ARROWS AND FIRE OR 1 2 ENTER', CX, 176, COL.dim, { align: 'center' });
    } else if (Math.floor(G.t * 1.2) % 2 === 0) {
      GX.gfx.text(g, '1 PLAYER: PRESS 1', CX, 166, COL.yellow, { align: 'center' });
      GX.gfx.text(g, '2 PLAYERS: PRESS 2', CX, 176, COL.yellow, { align: 'center' });
    }
    var labels = ['1ST', '2ND', '3RD'];
    for (var i = 0; i < 3; i++) {
      GX.gfx.text(g, labels[i], CX - 54, 130 + i * 10, COL.score);
      GX.gfx.text(g, pad(G.hiscores[i] || 0, 6), CX + 22, 130 + i * 10, COL.white, { align: 'right' });
    }
    GX.gfx.text(g, 'A CANVAS TRIBUTE TO NAMCO 1979', CX, 224, COL.dim, { align: 'center' });
  }

  var NODE_SPRITE = { strike: 'blue0', ambush: 'flagship0', laststand: 'red0' };

  function drawMap(g) {
    GX.gfx.text(g, 'SELECT MISSION', CX, 10, COL.white, { align: 'center' });
    GX.gfx.text(g, 'STAGE ' + G.round, CX, 24, COL.cyan, { align: 'center' });
    GX.gfx.text(g, pad(GX.run.meta().medals, 3) + ' MEDALS', W - 8, 1, COL.yellow, { align: 'right' });
    var xs = [37, 112, 187];
    var row = G.mapRow || GX.run.row(G.round);
    for (var i = 0; i < 3; i++) {
      var n = row[i];
      var sel = i === G.cursor ? COL.yellow : COL.dim;
      GX.gfx.text(g, n.name, xs[i], 48, sel, { align: 'center' });
      GX.gfx.draw(g, NODE_SPRITE[n.id], xs[i], 72);
      for (var d = 0; d < n.desc.length; d++) {
        GX.gfx.text(g, n.desc[d], xs[i], 92 + d * 10, i === G.cursor ? COL.white : COL.dim, { align: 'center' });
      }
      GX.gfx.text(g, n.reward + ' MEDALS', xs[i], 118, i === G.cursor ? COL.bright : COL.dim, { align: 'center' });
    }
    GX.gfx.draw(g, 'galaxip', xs[G.cursor], 200);
    if (Math.floor(G.t * 2) % 2 === 0) {
      GX.gfx.text(g, 'FIRE TO LAUNCH', CX, 224, COL.white, { align: 'center' });
    }
  }

  function drawDraft(g) {
    GX.gfx.text(g, 'SALVAGE ONE UPGRADE', CX, 12, COL.white, { align: 'center' });
    GX.gfx.text(g, pad(GX.run.medals(), 3) + ' MEDALS', CX, 26, COL.yellow, { align: 'center' });
    var xs = [37, 112, 187];
    for (var i = 0; i < G.offers.length; i++) {
      var m = G.offers[i];
      GX.gfx.text(g, m.name, xs[i], 58, i === G.cursor ? COL.yellow : COL.white, { align: 'center' });
      for (var l = 0; l < m.lines.length; l++) {
        GX.gfx.text(g, m.lines[l], xs[i], 76 + l * 10, i === G.cursor ? COL.bright : COL.dim, { align: 'center' });
      }
    }
    GX.gfx.draw(g, 'galaxip', xs[G.cursor], 190);
    if (Math.floor(G.t * 2) % 2 === 0) {
      GX.gfx.text(g, 'FIRE TO TAKE', CX, 224, COL.white, { align: 'center' });
    }
  }

  function drawShop(g) {
    GX.gfx.text(g, 'MEDAL SHOP', CX, 10, COL.yellow, { align: 'center' });
    GX.gfx.text(g, pad(GX.run.meta().medals, 3) + ' MEDALS', CX, 24, COL.white, { align: 'center' });
    GX.gfx.text(g, 'BEST STAGE ' + GX.run.meta().bestStage, CX, 34, COL.dim, { align: 'center' });
    var xs = [28, 84, 140, 196];
    for (var i = 0; i < GX.run.UNLOCKS.length; i++) {
      var u = GX.run.UNLOCKS[i];
      var own = GX.run.owned(u.id);
      var sel = i === G.cursor;
      GX.gfx.text(g, u.name, xs[i], 64, sel ? COL.bright : COL.white, { align: 'center' });
      for (var d = 0; d < u.desc.length; d++) {
        GX.gfx.text(g, u.desc[d], xs[i], 78 + d * 10, sel ? COL.cyan : COL.dim, { align: 'center' });
      }
      GX.gfx.text(g, own ? 'OWNED' : u.cost + ' MEDALS', xs[i], 104,
        own ? COL.yellow : sel ? COL.white : COL.dim, { align: 'center' });
    }
    GX.gfx.text(g, 'BACK', xs[3], 64, G.cursor === 3 ? COL.bright : COL.dim, { align: 'center' });
    GX.gfx.draw(g, 'galaxip', xs[G.cursor], 190);
    if (Math.floor(G.t * 2) % 2 === 0) {
      GX.gfx.text(g, 'FIRE TO BUY', CX, 224, COL.white, { align: 'center' });
    }
  }

  function draw(g) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    for (var i = 0; i < G.stars.length; i++) {
      var s = G.stars[i];
      g.fillStyle = s.c;
      g.fillRect(s.x, Math.round(s.y), 1, 1);
    }

    if (G.state === 'attract') {
      drawEnemies(g);
      drawAttract(g);
      return;
    }
    if (G.state === 'map') { drawMap(g); return; }
    if (G.state === 'draft') { drawDraft(g); return; }
    if (G.state === 'shop') { drawShop(g); return; }

    drawEnemies(g);
    drawShots(g);
    drawPlayer(g);
    drawFx(g);
    drawHud(g);

    if (G.state === 'ready') {
      if (G.nPlayers > 1) GX.gfx.text(g, 'PLAYER ' + (G.turn + 1), CX, 148, COL.cyan, { align: 'center' });
      else if (G.mode === 'run' && G.node) GX.gfx.text(g, G.node.name, CX, 148, COL.cyan, { align: 'center' });
      GX.gfx.text(g, 'READY', CX, 160, Math.floor(G.t * 8) % 2 ? COL.yellow : COL.white, { align: 'center' });
    } else if (G.state === 'clear') {
      GX.gfx.text(g, (G.mode === 'run' ? 'STAGE ' : 'ROUND ') + G.round + ' CLEAR', CX, 156,
        Math.floor(G.t * 6) % 2 ? COL.yellow : COL.white, { align: 'center' });
      if (G.mode === 'run') GX.gfx.text(g, GX.run.reward() + ' MEDALS', CX, 168, COL.bright, { align: 'center' });
    } else if (G.state === 'over') {
      GX.gfx.text(g, 'GAME OVER', CX, 156, Math.floor(G.t * 4) % 2 ? COL.score : COL.white, { align: 'center' });
      if (G.mode === 'run' && GX.run.last()) {
        GX.gfx.text(g, GX.run.last().medals + ' MEDALS  STAGE ' + GX.run.last().stage, CX, 168, COL.yellow, { align: 'center' });
      }
    }
    if (G.paused) GX.gfx.text(g, 'PAUSE', CX, 128, COL.cyan, { align: 'center' });
  }

  // ------------------------------------------------------------------- api

  GX.game = {
    W: W,
    H: H,
    world: G,
    init: function () { buildFormation(true); },
    setKey: function (name, down) { if (name in G.input) G.input[name] = down; },
    start: function (nPlayers) {
      if (G.state !== 'attract' && G.state !== 'over') return false;
      startGame(nPlayers);
      return true;
    },
    startRun: function (seedStr) {
      if (!GX.run || G.state !== 'attract') return false;
      startRun(seedStr);
      return true;
    },
    shop: function () {
      if (!GX.run || G.state !== 'attract') return false;
      openShop();
      return true;
    },
    select: function () {
      if (G.state !== 'attract') return false;
      selectFromAttract();
      return true;
    },
    togglePause: function () {
      if (['attract', 'map', 'draft', 'shop'].indexOf(G.state) < 0) G.paused = !G.paused;
    },
    isPaused: function () { return G.paused; },
    state: function () { return G.state; },
    update: update,
    draw: draw
  };
})(window.GX = window.GX || {});
