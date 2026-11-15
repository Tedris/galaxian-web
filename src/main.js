/* Galaxian clone — bootstrap: canvas scaling, input, fixed-step loop. */
(function (GX) {
  'use strict';

  var canvas = document.getElementById('screen');
  var g = canvas.getContext('2d', { alpha: false });
  var W = 224, H = 256, STEP = 1 / 60;

  canvas.width = W;
  canvas.height = H;
  g.imageSmoothingEnabled = false;
  g.textBaseline = 'top';

  GX.gfx.build();
  GX.game.init();

  // ------------------------------------------------------------------ scale

  function fit() {
    var availW = window.innerWidth - 16;
    var availH = window.innerHeight - (document.body.classList.contains('touch') ? 16 : 56);
    var s = Math.max(1, Math.floor(Math.min(availW / W, availH / H)));
    canvas.style.width = (W * s) + 'px';
    canvas.style.height = (H * s) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  // ------------------------------------------------------------------ input

  var KEYS = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'fire', KeyZ: 'fire', KeyX: 'fire', ControlLeft: 'fire', ControlRight: 'fire'
  };

  function firstGesture() { GX.audio.unlock(); }

  window.addEventListener('keydown', function (ev) {
    if (ev.repeat) return;
    firstGesture();
    var act = KEYS[ev.code];
    if (act) {
      GX.game.setKey(act, true);
      ev.preventDefault();
      return;
    }
    switch (ev.code) {
      case 'Digit1': case 'Numpad1': GX.game.start(1); break;
      case 'Digit2': case 'Numpad2': GX.game.start(2); break;
      case 'Enter': case 'NumpadEnter': GX.game.start(1); break;
      case 'KeyP': GX.game.togglePause(); break;
      case 'KeyM': GX.audio.setMuted(!GX.audio.muted); break;
    }
  });

  window.addEventListener('keyup', function (ev) {
    var act = KEYS[ev.code];
    if (act) { GX.game.setKey(act, false); ev.preventDefault(); }
  });

  window.addEventListener('blur', function () {
    GX.game.setKey('left', false);
    GX.game.setKey('right', false);
    GX.game.setKey('fire', false);
  });

  // Touch: left/right thirds steer and shoot.
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch');
    var bind = function (el, name) {
      var on = function (ev) {
        ev.preventDefault();
        firstGesture();
        GX.game.setKey(name, true);
        if (GX.game.state() === 'attract') GX.game.start(1);
      };
      var off = function (ev) { ev.preventDefault(); GX.game.setKey(name, false); };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    };
    bind(document.getElementById('pad-left'), 'left');
    bind(document.getElementById('pad-right'), 'right');
    bind(document.getElementById('pad-fire'), 'fire');
  }

  // ------------------------------------------------------------------- loop

  var last = 0, acc = 0;
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    var steps = 0;
    while (acc >= STEP && steps < 5) { GX.game.update(STEP); acc -= STEP; steps++; }
    if (steps === 5) acc = 0;
    GX.game.draw(g);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(window.GX = window.GX || {});
