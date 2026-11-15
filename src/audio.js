/* Galaxian clone — sound.
 *
 * The arcade board used a tone generator plus discrete circuitry; these are
 * Web Audio approximations of the same gestures: a descending chirp per shot,
 * a filtered noise burst per kill, a warble while something is diving, and a
 * low formation pulse whose rate tracks how many aliens are still aloft.
 */
(function (GX) {
  'use strict';

  var ctx = null, master = null, noiseBuf = null;
  var muted = false, ready = false;
  var pulse = { on: false, timer: 0, rate: 0 };

  function init() {
    if (ready) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    var len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    ready = true;
    return true;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // A simple voice: oscillator or noise through a gain envelope.
  function tone(type, f0, f1, dur, gain, delay) {
    if (!ready || muted) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(f0, f1, dur, gain, q, delay) {
    if (!ready || muted) return;
    var t = ctx.currentTime + (delay || 0);
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q || 1;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  GX.audio = {
    /** Must be called from a user gesture before anything will be heard. */
    unlock: function () { if (init()) resume(); },
    get muted() { return muted; },
    setMuted: function (m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },

    shot: function () { tone('square', 1100, 260, 0.09, 0.18); },
    enemyShot: function () { noise(2400, 700, 0.07, 0.09, 1.4); },
    boom: function () { noise(1500, 120, 0.24, 0.3, 0.9); tone('triangle', 300, 60, 0.2, 0.12); },
    flagBoom: function () { noise(1200, 90, 0.4, 0.38, 0.8); tone('sawtooth', 420, 50, 0.34, 0.16); },
    playerBoom: function () {
      noise(900, 60, 0.75, 0.42, 0.7);
      tone('sawtooth', 320, 40, 0.7, 0.2);
      tone('square', 180, 30, 0.7, 0.12, 0.05);
    },
    dive: function () { tone('sawtooth', 260, 620, 0.28, 0.07); },
    diveReturn: function () { tone('sawtooth', 620, 240, 0.3, 0.06); },
    stageStart: function () {
      // The arcade's stage jingle: a fast descending run with a glide at the end.
      var n = [988, 784, 659, 523, 392, 330];
      for (var i = 0; i < n.length; i++) tone('square', n[i], n[i] * 0.94, 0.1, 0.13, i * 0.085);
      tone('triangle', 330, 82, 0.5, 0.14, n.length * 0.085);
    },
    stageClear: function () {
      var n = [523, 659, 784, 1046];
      for (var i = 0; i < n.length; i++) tone('square', n[i], n[i], 0.11, 0.13, i * 0.09);
    },
    bonus: function () {
      var n = [659, 784, 988, 1318];
      for (var i = 0; i < n.length; i++) tone('square', n[i], n[i], 0.09, 0.15, i * 0.07);
    },
    oneUp: function () { tone('square', 523, 523, 0.08, 0.14); tone('square', 784, 784, 0.14, 0.14, 0.08); },
    coin: function () { tone('square', 1568, 1568, 0.06, 0.12); tone('square', 2093, 2093, 0.1, 0.12, 0.06); },

    /** Low throb under the formation; `alive` in 0..1 speeds it up as the
     *  armada thins out. Started/stopped by the game, advanced in update(). */
    setPulse: function (on, alive) {
      pulse.on = on;
      pulse.rate = on ? 1.1 - 0.75 * Math.max(0, Math.min(1, alive)) : 0;
      if (!on) pulse.timer = 0;
    },
    updatePulse: function (dt) {
      if (!pulse.on || !ready || muted) return;
      pulse.timer -= dt;
      if (pulse.timer <= 0) {
        pulse.timer = pulse.rate;
        tone('triangle', 88, 60, 0.11, 0.07);
      }
    }
  };
})(window.GX = window.GX || {});
