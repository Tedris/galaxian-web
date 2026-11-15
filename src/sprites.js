/* Galaxian clone — graphics data.
 *
 * Everything here is hand-authored pixel data chosen to match the look of the
 * 1979 arcade original (native 224x256, portrait, 8x8-tile art): sprite shapes
 * and the red/blue/purple/teal/yellow colours were traced from arcade
 * screenshots; nothing is lifted from Namco ROMs.
 *
 * Sprites are authored at native resolution. `half` rows describe the LEFT
 * eight columns of a 16-wide sprite and are mirrored automatically; `map` rows
 * are literal. '.' is transparent.
 */
(function (GX) {
  'use strict';

  var PAL = {
    '.': null,
    r: '#db0000', // red
    R: '#ff2a2a', // bright red
    d: '#6d0000', // dark red
    b: '#0000db', // blue
    B: '#4a4aff', // bright blue
    n: '#00006d', // dark blue
    p: '#8500db', // purple
    P: '#b04aff', // bright purple
    c: '#00c3d9', // light cyan
    T: '#39e6ff', // cyan highlight
    t: '#008594', // teal (the "light blue" Galaxian body)
    k: '#00495a', // dark teal
    y: '#dbdb00', // yellow
    Y: '#ffff5a', // bright yellow
    w: '#c3c3db', // grey-white
    W: '#ffffff', // white
    g: '#6d6d6d' // grey
  };

  // ---------------------------------------------------------------- sprites

  var SPRITES = {
    // The Galaxip. Traced from an arcade screenshot (red nose, cyan hull,
    // grey-white wings).
    galaxip: { map: [
      '.......rr.......',
      '......rrrr......',
      '.....rrrrrr.....',
      '.....rrrrrr.....',
      '.....r.rr.r.....',
      '..ww..crrc..ww..',
      '..ww..crrc..ww..',
      '.wwww.crrc.wwww.',
      '.wcwwccrrccwwcw.',
      '.wcwcccrrcccwcw.',
      '.wccccrrrrrrccw.',
      '.wcwcccrrcccwcw.',
      '.wcww..cc..wwcw.',
      '.wcww..cc..wwcw.',
      '.wwww......wwww.',
      '..ww........ww..'
    ] },

    // Lives counter icon: same ship, condensed.
    shipMini: { map: [
      '.....rr.....',
      '....rrrr....',
      '....rrrr....',
      '.....rr.....',
      '..ww.cr.cc..',
      '.wwwwcrccwww',
      '.wcwwcccccww',
      '.wwww.....ww',
      '..ww.......w'
    ] },

    // Common alien shape, two wing positions. Colours come from the per-type
    // palettes in ENEMY below: t = body, b = wings, r = cockpit/eyes.
    fly0: { shapesOnly: true, half: [
      '........',
      '.....t..',
      '....tttt',
      '..bbtttr',
      '..bbtttt',
      '.....ttt',
      '.......t',
      '........'
    ] },
    fly1: { shapesOnly: true, half: [
      '........',
      '.....t..',
      '....tttt',
      '.....ttr',
      '....tttt',
      '..bbtttt',
      '..bb...t',
      '........'
    ] },

    // Galaxian Flagship: yellow hull, blue wings, red mast, wider than the rest.
    flag0: { shapesOnly: true, half: [
      '........',
      '.......r',
      '..byyyyy',
      '..byyyrr',
      '...yyyyy',
      '.......y',
      '.......y',
      '........'
    ] },
    flag1: { shapesOnly: true, half: [
      '........',
      '.......r',
      '...yyyyy',
      '.....yrr',
      '...yyyyy',
      '..byyyyy',
      '.......y',
      '........'
    ] },

    // Explosion, 4 frames.
    ex0: { map: [
      '................',
      '................',
      '................',
      '.......ww.......',
      '......wWWw......',
      '.....wWyyWw.....',
      '.....wWyyWw.....',
      '......wWWw......',
      '.......ww.......',
      '................',
      '................',
      '................'
    ] },
    ex1: { map: [
      '................',
      '.....w..ww..w...',
      '......w.Ww.w....',
      '....yy..Ww..yy..',
      '.....wWyyyyWw...',
      '..ww..WywwyWww..',
      '..WW..WywwyWww..',
      '.....wWyyyyWw...',
      '....yy..Ww..yy..',
      '......w.Ww.w....',
      '.....w..ww..w...',
      '................'
    ] },
    ex2: { map: [
      '..r....r..r....r',
      '....yr..yy..ry..',
      '..r...y..yy..r..',
      '....y..yWWy..y..',
      '.r..y.WyWWyW..r.',
      '..yr.yWyyyyWy.r.',
      '..ry.yWyyyyWy.r.',
      '.r..y.WyWWyW..r.',
      '....y..yWWy..y..',
      '..r...y..yy..r..',
      '....yr..yy..ry..',
      '..r....r..r....r'
    ] },
    ex3: { map: [
      '................',
      '..d........d....',
      '.....d......d...',
      '........d.......',
      '..d......d...d..',
      '.......d........',
      '...d.......d....',
      '........d.......',
      '.....d.....d....',
      '..d.........d...',
      '................',
      '................'
    ] },

    // Galaxip destroyed, 4 frames.
    pe0: { map: [
      '......rwr.......',
      '.....rwWwr......',
      '....rwWWWwr.....',
      '...rwWWyWWwr....',
      '..rwWWyyyyWWwr..',
      '.rwWWyyWWyyWWwr.',
      'rwWWyyWWWWyyWWwr',
      'rwWWyyWWWWyyWWwr',
      '.rwWWyyWWyyWWwr.',
      '..rwWWyyyyWWwr..',
      '...rwWWyWWwr....',
      '....rwWWWwr.....',
      '.....rwWwr......',
      '......rwr.......'
    ] },
    pe1: { map: [
      '..r....rr....r..',
      '....r..yy..r....',
      '..r..y.yy.y..r..',
      '.....y.rWr.y....',
      '.r...yWWWWy...r.',
      '....Wy.yy.Wy....',
      '..r.Wy.yy.Wy.r..',
      '..r.Wy.yy.Wy.r..',
      '....Wy.yy.Wy....',
      '.r...yWWWWy...r.',
      '.....y.yy.y.....',
      '..r..y.yy.y..r..',
      '....r..yy..r....',
      '..r....rr....r..'
    ] },
    pe2: { map: [
      '................',
      '..r..r....r..r..',
      '....r.yy.yy.r...',
      '.....y.yy.yy.r..',
      '......y....y....',
      '.r..Wy......Wy..',
      '....y........y..',
      '....y........y..',
      '....Wy......Wy..',
      '.r..y........y..',
      '......y....y....',
      '..r..y.yy.yy.r..',
      '....r.yy.yy.r...',
      '..r..r....r..r..'
    ] },
    pe3: { map: [
      '................',
      '..d.......d.....',
      '.......d.....d..',
      '..d........d....',
      '.....d.........d',
      '..........d.....',
      '...d......d.....',
      '.......d........',
      '..d.........d...',
      '.....d.......d..',
      '..........d.....',
      '...d.....d......',
      '................',
      '................'
    ] },

    // Shots: the Galaxip bullet is a 1x4 yellow streak, enemy shots are small
    // diagonal sparks.
    bullet: { map: ['W', 'y', 'y', 'y'] },
    ebullet: { map: ['W.', 'yy', 'y.', 'r.'] }
  };

  // ------------------------------------------------------------------- font

  var FONT = {
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.##.', '.##.'],
    ',': ['.....', '.....', '.....', '.....', '.##.', '.##.', '..#..'],
    ':': ['.....', '.##.', '.##.', '.....', '.##.', '.##.', '.....'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
    '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '#..#.', '#...#'],
    "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....']
  };

  // ------------------------------------------------------------------ build

  function rowsOf(def) {
    if (def.map) return def.map;
    return def.half.map(function (row) { return row + row.split('').reverse().join(''); });
  }

  function bake(def) {
    var rows = rowsOf(def);
    var w = rows[0].length, h = rows.length;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    var pal = def.pal ? Object.assign({}, PAL, def.pal) : PAL;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var col = pal[rows[y][x]];
        if (col === undefined) throw new Error('sprite: unknown colour "' + rows[y][x] + '"');
        if (col === null) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    return { canvas: c, w: w, h: h, ox: w >> 1, oy: h >> 1 };
  }

  // Shapes are recoloured per type: the arcade drew the same bug silhouette in
  // three hull colours plus the flagship's yellow hull.
  var ENEMY = {
    flagship: { shape: ['flag0', 'flag1'], pal: { y: '#dbdb00', Y: '#ffff5a', b: '#0000db', r: '#db0000' }, points: [60, 150], w: 12, h: 6 },
    red: { shape: ['fly0', 'fly1'], pal: { t: '#db0000', b: '#00006d', r: '#ffe14a' }, points: [50, 100], w: 10, h: 6 },
    purple: { shape: ['fly0', 'fly1'], pal: { t: '#8500db', b: '#0000db', r: '#ff2a2a' }, points: [40, 80], w: 10, h: 6 },
    blue: { shape: ['fly0', 'fly1'], pal: { t: '#008594', b: '#0000db', r: '#ff2a2a' }, points: [30, 60], w: 10, h: 6 }
  };

  GX.gfx = {
    PAL: PAL,
    sprites: {},
    ENEMY: ENEMY,
    build: function () {
      for (var name in SPRITES) if (!SPRITES[name].shapesOnly) this.sprites[name] = bake(SPRITES[name]);
      for (var type in ENEMY) {
        var def = ENEMY[type];
        def.sprite = def.shape.map(function (shape, i) {
          var key = type + i;
          GX.gfx.sprites[key] = bake(Object.assign({}, SPRITES[shape], { pal: def.pal }));
          return key;
        });
      }
      this.font = {};
      for (var ch in FONT) {
        this.font[ch] = FONT[ch].map(function (row) {
          var mask = 0;
          for (var i = 0; i < 5; i++) if (row[i] === '#') mask |= 1 << (4 - i);
          return mask;
        });
      }
      return this;
    },
    // Blit a baked sprite centred on (x, y).
    draw: function (g, name, x, y) {
      var s = this.sprites[name];
      g.drawImage(s.canvas, Math.round(x - s.ox), Math.round(y - s.oy));
    },
    blit: function (g, name, x, y) {
      g.drawImage(this.sprites[name].canvas, Math.round(x), Math.round(y));
    },
    measure: function (text, scale) {
      return text.length * 6 * (scale || 1) - (scale || 1);
    },
    text: function (g, text, x, y, colour, opts) {
      opts = opts || {};
      var scale = opts.scale || 1;
      var str = String(text).toUpperCase();
      var width = this.measure(str, scale);
      if (opts.align === 'center') x -= width / 2;
      else if (opts.align === 'right') x -= width;
      x = Math.round(x); y = Math.round(y);
      g.fillStyle = colour;
      for (var i = 0; i < str.length; i++) {
        var glyph = this.font[str[i]];
        if (!glyph) continue;
        for (var r = 0; r < 7; r++) {
          var bits = glyph[r];
          if (!bits) continue;
          for (var b = 0; b < 5; b++) {
            if (bits & (1 << (4 - b))) g.fillRect(x + i * 6 * scale + b * scale, y + r * scale, scale, scale);
          }
        }
      }
    }
  };
})(window.GX = window.GX || {});
