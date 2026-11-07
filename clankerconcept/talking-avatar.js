/* TalkingAvatar - layered talking head driver (vanilla JS, no dependencies).
   Stacks three same-size images: base (mouth cavity), jaw (moving layer), eyes glow.
   Feed it a voice level 0..1 (from an audio analyser, a TTS callback, or setLevel())
   and it moves the jaw and lights the eyes to match. */
class TalkingAvatar {
  constructor(container, opts = {}) {
    this.maxDropPct = opts.maxDropPct ?? 2.8;   // jaw travel, % of avatar height
    this.gain = opts.gain ?? 3.0;               // audio level -> jaw sensitivity
    this.level = 0; this.jaw = 0; this.speaking = false;
    container.classList.add('ta-wrap');
    container.innerHTML =
      '<img class="ta-layer ta-base" src="' + (opts.base || 'assets/avatar_base.png') + '" alt="">' +
      '<img class="ta-layer ta-jaw"  src="' + (opts.jaw  || 'assets/avatar_jaw.png') + '" alt="">' +
      '<img class="ta-layer ta-glow" src="' + (opts.glow || 'assets/avatar_eyes_glow.png') + '" alt="">';
    this.jawEl = container.querySelector('.ta-jaw');
    this.glowEl = container.querySelector('.ta-glow');
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  /* Manual drive: call with 0..1 from any voice source (TTS viseme, VU meter, test slider). */
  setLevel(v) { this.level = Math.max(0, Math.min(1, v)); this.speaking = v > 0.02; }
  /* Drive from an <audio> element that plays TTS/mp3 voice. Returns the AudioContext. */
  attachAudio(audioEl) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audioEl);
    const an = ctx.createAnalyser(); an.fftSize = 512;
    src.connect(an); an.connect(ctx.destination);
    const buf = new Float32Array(an.fftSize);
    this._analyserTick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      this.setLevel(Math.sqrt(sum / buf.length) * this.gain);
    };
    return ctx;
  }
  /* Drive from browser speechSynthesis (no analysable audio): pseudo lip-flap
     synced to word boundary events while the utterance plays. Prefers a George /
     en-GB voice when present. Returns the utterance. */
  speakText(text, opts = {}) {
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find(v => /george/i.test(v.name)) ||
              voices.find(v => v.lang === 'en-GB') || null;
    u.rate = opts.rate ?? 1.0;
    let flap = null;
    u.onstart = () => { this.speaking = true;
      flap = setInterval(() => this.setLevel(0.35 + Math.random() * 0.6), 110); };
    u.onboundary = () => this.setLevel(0.9);
    u.onend = u.onerror = () => { clearInterval(flap); this.setLevel(0); this.speaking = false; };
    speechSynthesis.speak(u);
    return u;
  }
  _loop() {
    if (this._analyserTick) this._analyserTick();
    const target = this.speaking ? this.level : 0;
    const k = target > this.jaw ? 0.45 : 0.14;       // fast open, slower close
    this.jaw += (target - this.jaw) * k;
    this.jawEl.style.transform = 'translateY(' + (this.jaw * this.maxDropPct).toFixed(3) + '%)';
    const breathe = 0.05 * (1 + Math.sin(Date.now() / 900)) / 2;
    this.glowEl.style.opacity = Math.min(1, 0.12 + this.jaw * 0.95 + breathe).toFixed(3);
    requestAnimationFrame(this._loop);
  }
}
