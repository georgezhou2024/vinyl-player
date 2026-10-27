class VinylEngine {
  constructor() {
    this.el = document.getElementById('player');
    this.ready = false;
    this.rpm = 33.333;
    this.track = null;
    this.warmFreq = 6000;
  }

  ensureContext() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);

      this.crackleGain = this.ctx.createGain(); this.crackleGain.gain.value = 0;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q = 0.7;
      this.crackleSrc = this.ctx.createBufferSource();
      this.crackleSrc.buffer = this.makeCrackle(this.ctx, 4);
      this.crackleSrc.loop = true;
      this.crackleSrc.connect(bp); bp.connect(this.crackleGain); this.crackleGain.connect(this.master);
      this.crackleSrc.start();

      this.rumbleGain = this.ctx.createGain(); this.rumbleGain.gain.value = 0;
      const lp2 = this.ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 90;
      this.rumbleSrc = this.ctx.createBufferSource();
      this.rumbleSrc.buffer = this.makeBrown(this.ctx, 4);
      this.rumbleSrc.loop = true;
      this.rumbleSrc.connect(lp2); lp2.connect(this.rumbleGain); this.rumbleGain.connect(this.master);
      this.rumbleSrc.start();

      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 512;
      this.master.connect(this.analyser);

      this.ready = true;
    } catch (e) {
      console.warn('Web Audio init failed, fallback to native playback', e);
      this.ready = false;
    }
  }

  makeBrown(ctx, sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0); let v = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      v = (v + 0.02 * w) / 1.02; d[i] = v * 3.5;
    }
    return b;
  }
  makeCrackle(ctx, sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      let s = (Math.random() * 2 - 1) * 0.25;
      if (Math.random() < 0.00035) {
        const decay = 0.004;
        for (let k = 0; k < 300 && i + k < d.length; k++)
          d[i + k] += (Math.random() * 2 - 1) * Math.exp(-k * decay) * 0.9;
      }
      d[i] = s;
    }
    return b;
  }
  makeThud(ctx) {
    const len = 0.4, b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / ctx.sampleRate;
      d[i] = Math.exp(-t / 0.05) * (Math.sin(2 * Math.PI * 55 * t) * 0.6 + (Math.random() * 2 - 1) * 0.35);
    }
    return b;
  }

  async play(track) {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch(e) {}
    }
    this.track = track;
    this.el.src = URL.createObjectURL(track.blob);
    this.el.playbackRate = this.rpm / 33.333;
    this.el.volume = (document.getElementById('vol')?.value || 80) / 100;

    try {
      await this.el.play();
    } catch (e) {
      console.error('playback failed:', e);
      throw e;
    }

    if (this.ready) {
      const cv = document.getElementById('crackle')?.value || 35;
      this.crackleGain.gain.value = (cv / 100) * 0.15;
      this.rumbleGain.gain.value = 0.03;
      this.needleDrop();
    }
  }

  pause() {
    this.el.pause();
    if (this.ready) {
      this.crackleGain.gain.value = 0;
      this.rumbleGain.gain.value = 0;
      this.click();
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch(e) {}
    }
    this.el.volume = (document.getElementById('vol')?.value || 80) / 100;
    await this.el.play();
    if (this.ready) {
      const cv = document.getElementById('crackle')?.value || 35;
      this.crackleGain.gain.value = (cv / 100) * 0.15;
      this.rumbleGain.gain.value = 0.03;
    }
  }

  stop() {
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
    if (this.ready) {
      this.crackleGain.gain.value = 0;
      this.rumbleGain.gain.value = 0;
      this.click();
    }
  }

  needleDrop() {
    if (!this.ready) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.makeThud(this.ctx);
    const g = this.ctx.createGain(); g.gain.value = 0.2;
    s.connect(g); g.connect(this.master); s.start();
  }
  click() {
    if (!this.ready) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.makeThud(this.ctx);
    const g = this.ctx.createGain(); g.gain.value = 0.1;
    s.connect(g); g.connect(this.master); s.start();
  }

  setRpm(rpm) {
    this.rpm = rpm;
    if (!this.el.paused) this.el.playbackRate = rpm / 33.333;
  }
  setVolume(v)   { this.el.volume = v / 100; }
  setCrackle(v)  { if (this.ready && !this.el.paused) this.crackleGain.gain.value = (v / 100) * 0.15; }
  setWarm(f)     { this.warmFreq = f; }

  startWow(amount) {
    if (this.wowTimer) clearInterval(this.wowTimer);
    this.wowTimer = setInterval(() => {
      if (this.el.paused) return;
      const w = (Math.random() - 0.5) * (amount / 100) * 0.012;
      this.el.playbackRate = (this.rpm / 33.333) * (1 + w);
    }, 60);
  }

  getLevel() {
    if (!this.ready || !this.analyser) return 0;
    const arr = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(arr);
    let s = 0; for (const v of arr) s += v;
    return s / arr.length / 255;
  }
}
