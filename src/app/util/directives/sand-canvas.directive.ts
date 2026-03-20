import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  NgZone
} from '@angular/core';

@Directive({
  selector: '[appSandCanvas]',
  standalone: true
})
export class SandCanvasDirective implements OnInit, OnDestroy {

  /* ================= INPUTS ================= */
  @Input('appSandCanvas') color: string = '#0ea5e9';
  @Input() tiltX: number = 0;
  @Input() tiltY: number = 0;
  @Input() percentage: number = 0;
  @Input() useGyro: boolean = true;

  /* ================= CANVAS ================= */
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private offscreen!: HTMLCanvasElement;
  private offCtx!: CanvasRenderingContext2D;
  private animationId!: number;

  private width = 0;
  private height = 0;

  /* ================= PHYSICS STATE ================= */
  private currentSlosh = 0;
  private targetSlosh  = 0;
  private currentTiltY = 0;

  private gyroTiltX  = 0;
  private gyroTiltY  = 0;
  private hasGyroData = false;

  /* ================= NOISE / TIME ================= */
  private t = 0;
  private seed = Math.random() * 100;

  /* ================= CAUSTICS ================= */
  private caustics: { x: number; y: number; r: number; speed: number; phase: number }[] = [];

  /* ================= WAVE LAYERS ================= */
  /** [speed, amplitudeFactor, phaseOffset, opacity, color-mix-towards-white] */
  private readonly LAYERS = [
    { speed: 0.55, amp: 0.55, phase: 0,         alpha: 0.90, label: 'bg'  },
    { speed: 0.80, amp: 0.38, phase: Math.PI,    alpha: 0.65, label: 'mid' },
    { speed: 1.10, amp: 0.22, phase: Math.PI/2,  alpha: 0.55, label: 'fg'  },
  ];

  /* ================= CONFIG ================= */
  private readonly CFG = {
    sloshFactor:   0.70,
    depthFactor:   0.10,
    responseSpeed: 0.12,
    maxSlosh:      22,
    microAmp:      1.8,
    microFreq:     7.5,
    causticsCount: 15,
    causticsAlpha: 0.07,
  };

  constructor(private el: ElementRef, private zone: NgZone) {}

  /* =============================================
     LIFECYCLE
  ============================================= */

  ngOnInit() {
    this.applyRandomVariations();
    this.initCanvas();
    this.setupCanvas();
    this.initCaustics();

    this.zone.runOutsideAngular(() => {
      this.animate();
      if (this.useGyro) {
        window.addEventListener('deviceorientation', this.handleGyro);
      }
    });

    window.addEventListener('resize', this.setupCanvas);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.setupCanvas);
    if (this.useGyro) window.removeEventListener('deviceorientation', this.handleGyro);
  }

  /* =============================================
     GYRO HANDLER
  ============================================= */

  private handleGyro = (e: DeviceOrientationEvent) => {
    if (e.gamma === null && e.beta === null) return;
    this.hasGyroData = true;
    const gamma = e.gamma || 0;
    const beta  = e.beta  || 0;
    this.gyroTiltX = Math.max(-20, Math.min(20, (gamma / 45) * 15));
    this.gyroTiltY = Math.max(-20, Math.min(20, ((beta + 45) / 45) * 15));
  };

  private applyRandomVariations() {
    // Randomize speeds and amplitudes for each layer back-to-front
    this.LAYERS.forEach(l => {
      l.speed *= (0.8 + Math.random() * 0.4); // 80% to 120%
      l.amp   *= (0.8 + Math.random() * 0.4);
      l.phase = Math.random() * Math.PI * 2;   // random sync offset
    });

    // Jitter basic configs so motion behavior is variation-specific
    this.CFG.sloshFactor   *= (0.8 + Math.random() * 0.4);
    this.CFG.responseSpeed *= (0.8 + Math.random() * 0.4);
    this.CFG.microAmp      *= (0.7 + Math.random() * 0.6);
    this.CFG.microFreq     *= (0.8 + Math.random() * 0.4);
    this.CFG.causticsCount = Math.floor(Math.random() * 5) + 6; // 6 to 10
  }

  /* =============================================
     INIT
  ============================================= */

  private initCanvas() {
    this.canvas = this.el.nativeElement;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    this.ctx = ctx;
    this.offscreen = document.createElement('canvas');
    const oCtx = this.offscreen.getContext('2d');
    if (!oCtx) throw new Error('Offscreen canvas not supported');
    this.offCtx = oCtx;
  }

  private setupCanvas = () => {
    const rect = this.canvas.getBoundingClientRect();
    this.width  = rect.width  || 300;
    this.height = rect.height || 80;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = this.width  * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.offscreen.width  = this.width;
    this.offscreen.height = this.height;
  };

  private initCaustics() {
    this.caustics = [];
    for (let i = 0; i < this.CFG.causticsCount; i++) {
      this.caustics.push({
        x:     Math.random(),
        y:     Math.random() * 0.7 + 0.15,
        r:     Math.random() * 12 + 6,
        speed: Math.random() * 0.4 + 0.15,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  /* =============================================
     NOISE UTILITIES  (smooth value noise)
  ============================================= */

  /** Simple smooth hash → [0,1] */
  private hsh(n: number): number {
    const x = Math.sin(n + this.seed) * 43758.5453;
    return x - Math.floor(x);
  }

  /** 1-D value noise interpolated */
  private noise1(x: number): number {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f); // smoothstep
    return this.hsh(i) * (1 - u) + this.hsh(i + 1) * u;
  }

  /** fBm – fractal noise, summed octaves */
  private fbm(x: number, octaves = 3): number {
    let v = 0, amp = 0.5, freq = 1, max = 0;
    for (let o = 0; o < octaves; o++) {
      v   += this.noise1(x * freq) * amp;
      max += amp;
      amp  *= 0.5;
      freq *= 2.1;
    }
    return v / max; // normalised 0..1
  }

  /* =============================================
     PARSE COLOR UTIL
  ============================================= */

  private parseColor(hex: string): [number, number, number] {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  private rgba([r, g, b]: [number, number, number], a: number): string {
    return `rgba(${r},${g},${b},${a})`;
  }

  /** Shift colour towards white by `f` (0=original, 1=white) */
  private lighten([r, g, b]: [number, number, number], f: number): [number, number, number] {
    return [
      Math.round(r + (255 - r) * f),
      Math.round(g + (255 - g) * f),
      Math.round(b + (255 - b) * f)
    ];
  }

  /** Shift colour towards black (darken) */
  private darken([r, g, b]: [number, number, number], f: number): [number, number, number] {
    return [Math.round(r * (1 - f)), Math.round(g * (1 - f)), Math.round(b * (1 - f))];
  }

  /* =============================================
     PHYSICS
  ============================================= */

  private updatePhysics() {
    const rawX = this.hasGyroData ? this.gyroTiltX : this.tiltX;
    const rawY = this.hasGyroData ? this.gyroTiltY : this.tiltY;

    this.targetSlosh = Math.max(-this.CFG.maxSlosh,
      Math.min(this.CFG.maxSlosh, (rawX / 20) * (this.height * this.CFG.sloshFactor)));

    this.currentSlosh += (this.targetSlosh - this.currentSlosh) * this.CFG.responseSpeed;
    this.currentTiltY += (rawY - this.currentTiltY) * 0.10;

    // Idle gentle rocking when undisturbed
    if (Math.abs(this.targetSlosh) < 1.5) {
      const idle = Math.sin(this.t * 0.6) * 3;
      this.currentSlosh += (idle - this.currentSlosh) * 0.04;
    }
  }

  private getBaseY(): number {
    const depthOff = (this.currentTiltY / 20) * (this.height * this.CFG.depthFactor);
    return this.height * (1 - this.percentage / 100) - depthOff;
  }

  /* =============================================
     WAVE PATH BUILDER
  ============================================= */

  /**
   * Returns an array of y-values for each x column for one wave layer.
   * Uses fBm noise combined with a sine to create organic, non-repeating curves.
   */
  private buildWaveY(
    baseY: number,
    layerSpeed: number,
    layerAmp: number,
    layerPhase: number
  ): number[] {
    const pts: number[] = [];
    const amp  = layerAmp * (8 + Math.abs(this.currentSlosh) * 0.4);
    const slosh = this.currentSlosh;

    // slosh tilts the wave surface: left rises, right falls (or vice versa)
    for (let x = 0; x <= this.width; x++) {
      const nx = x / this.width;

      const angle = nx * Math.PI * 2.4 - this.t * layerSpeed * 0.4 + layerPhase;
      // Trochoidal approximation: sharpens crests and leans forward into motion
      const sharpAngle = angle - 0.42 * Math.sin(angle);
      const primary = Math.sin(sharpAngle) * amp;

      // fBm noise distortion (slow-changing "breathing")
      const noiseVal = this.fbm(nx * 2.2 - this.t * layerSpeed * 0.12 + layerPhase, 3);
      const noise    = (noiseVal - 0.5) * amp * 1.3;

      // Micro surface ripples (high-frequency)
      const micro = Math.sin(nx * Math.PI * this.CFG.microFreq - this.t * 1.4 + layerPhase)
                    * this.CFG.microAmp;

      // Linear slosh tilt across the surface
      const tilt = ((nx - 0.5) * slosh);

      pts.push(baseY + primary + noise + micro + tilt);
    }
    return pts;
  }

  /* =============================================
     MAIN ANIMATE LOOP
  ============================================= */

  private animate = () => {
    this.t += 0.016; // ~60fps tick increment
    this.updatePhysics();
    this.render();
    this.animationId = requestAnimationFrame(this.animate);
  };

  private render() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    const base  = this.getBaseY();
    const color = this.parseColor(this.color);

    // ── 1. Draw each wave layer back-to-front ─────────────────────────
    for (let i = 0; i < this.LAYERS.length; i++) {
      const layer = this.LAYERS[i];
      const pts   = this.buildWaveY(base, layer.speed, layer.amp, layer.phase);
      this.drawWaveLayer(pts, color, layer.alpha, i, base);
    }

    // ── 2. Surface cap (Fresnel highlight + edge glow) ────────────────
    const surfacePts = this.buildWaveY(base, 1.10, 0.22, Math.PI / 2);
    this.drawFresnelCap(surfacePts, color, base);

    // ── 3. Deep caustics ──────────────────────────────────────────────
    const lastLayerPts = this.buildWaveY(base, this.LAYERS[0].speed, this.LAYERS[0].amp, this.LAYERS[0].phase);
    this.drawCaustics(lastLayerPts, color, base);

    // ── 4. Glass refraction scanlines ────────────────────────────────
    this.drawRefractionShimmer(surfacePts, color, base);

    // ── 5. Glass overlay (top-left highlight) ─────────────────────────
    this.drawGlassOverlay();
  }

  /* =============================================
     DRAWING — WAVE LAYER
  ============================================= */

  private drawWaveLayer(
    pts: number[],
    color: [number, number, number],
    baseAlpha: number,
    layerIdx: number,
    baseY: number
  ) {
    const { ctx, width, height } = this;

    // Depth mix: deeper layers get slightly darker & more saturated
    const depthMix = layerIdx / (this.LAYERS.length - 1); // 0=bg, 1=fg
    const surfaceColor = this.lighten(color, 0.60 - depthMix * 0.10);
    const deepColor    = this.darken(color, 0.10 + depthMix * 0.08);

    // Find the topmost wave y for gradient start
    const minY = Math.min(...pts);

    const grad = ctx.createLinearGradient(0, minY, 0, height);
    grad.addColorStop(0,   this.rgba(surfaceColor, baseAlpha * 0.40));
    grad.addColorStop(0.3, this.rgba(surfaceColor, baseAlpha * 0.60));
    grad.addColorStop(0.7, this.rgba(deepColor,    baseAlpha * 0.75));
    grad.addColorStop(1,   this.rgba(this.darken(color, 0.20), 0.85));

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, pts[0]);

    // smooth through all pts using cardinal spline approach
    for (let x = 1; x < pts.length - 1; x++) {
      const mx = (x + x - 1) / 2;
      const my = (pts[x] + pts[x - 1]) / 2;
      ctx.quadraticCurveTo(x - 1, pts[x - 1], mx, my);
    }
    ctx.lineTo(width, pts[pts.length - 1]);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* =============================================
     DRAWING — FRESNEL CAP
  ============================================= */

  private drawFresnelCap(pts: number[], color: [number, number, number], baseY: number) {
    const { ctx, width } = this;
    const ellipseH = 10 + Math.abs(this.currentSlosh) * 0.4;

    ctx.save();

    // -- top edge glow (outer soft glow) --
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.rgba(this.lighten(color, 0.7), 0.18);
    ctx.filter = 'blur(3px)';
    ctx.beginPath();
    ctx.moveTo(0, pts[0]);
    for (let x = 1; x < pts.length - 1; x++) {
      const mx = (x + x - 1) / 2;
      const my = (pts[x] + pts[x - 1]) / 2;
      ctx.quadraticCurveTo(x - 1, pts[x - 1], mx, my);
    }
    ctx.lineTo(width, pts[pts.length - 1]);
    ctx.stroke();
    ctx.filter = 'none';

    // -- inner bright crest --
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, pts[0]);
    for (let x = 1; x < pts.length - 1; x++) {
      const mx = (x + x - 1) / 2;
      const my = (pts[x] + pts[x - 1]) / 2;
      ctx.quadraticCurveTo(x - 1, pts[x - 1], mx, my);
    }
    ctx.lineTo(width, pts[pts.length - 1]);
    ctx.stroke();

    // -- Fresnel specular ellipse cap --
    ctx.beginPath();
    ctx.moveTo(0, pts[0]);
    for (let x = 1; x < pts.length - 1; x++) {
      const mx = (x + x - 1) / 2;
      const my = (pts[x] + pts[x - 1]) / 2;
      ctx.quadraticCurveTo(x - 1, pts[x - 1], mx, my);
    }
    ctx.lineTo(width, pts[pts.length - 1]);
    ctx.lineTo(width, pts[pts.length - 1] - ellipseH);

    // reverse to close the cap
    for (let x = pts.length - 2; x >= 1; x--) {
      const mx = (x + x + 1) / 2;
      const my = (pts[x] + pts[x + 1]) / 2;
      ctx.quadraticCurveTo(x + 1, pts[x + 1] - ellipseH * 0.6, mx, my - ellipseH * 0.8);
    }

    const capGrad = ctx.createLinearGradient(0, Math.min(...pts) - ellipseH, 0, Math.max(...pts));
    capGrad.addColorStop(0,   'rgba(255,255,255,0.70)');
    capGrad.addColorStop(0.4, this.rgba(this.lighten(color, 0.50), 0.55));
    capGrad.addColorStop(1,   this.rgba(color, 0.0));
    ctx.fillStyle = capGrad;
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /* =============================================
     DRAWING — CAUSTICS
  ============================================= */

  private drawCaustics(surfacePts: number[], color: [number, number, number], baseY: number) {
    const { ctx, width, height } = this;
    ctx.save();

    // clip to liquid region using surface wave
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, surfacePts[0]);
    for (let x = 1; x < surfacePts.length - 1; x++) {
      const mx = (x + x - 1) / 2;
      const my = (surfacePts[x] + surfacePts[x - 1]) / 2;
      ctx.quadraticCurveTo(x - 1, surfacePts[x - 1], mx, my);
    }
    ctx.lineTo(width, surfacePts[surfacePts.length - 1]);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.clip();

    const light = this.lighten(color, 0.85);

    for (const c of this.caustics) {
      // animate position with independent noise path
      const nx = this.noise1(c.phase + this.t * c.speed);
      const ny = this.noise1(c.phase + 10 + this.t * c.speed * 0.7);
      const cx = (c.x * 0.6 + nx * 0.4) * width;
      const cy = baseY + (c.y * 0.5 + ny * 0.3) * (height - baseY);

      const pulsate = 0.5 + 0.5 * Math.sin(this.t * c.speed * 2.5 + c.phase);
      const r = c.r * (0.7 + 0.3 * pulsate);
      const alpha = this.CFG.causticsAlpha * (0.5 + 0.5 * pulsate);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0,   this.rgba(light, alpha * 1.5));
      grad.addColorStop(0.5, this.rgba(light, alpha));
      grad.addColorStop(1,   this.rgba(light, 0));

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /* =============================================
     DRAWING — REFRACTION SHIMMER
     Fast approximation — no pixel-level scanline
     (avoids expensive ImageData on every frame)
  ============================================= */

  private drawRefractionShimmer(
    surfacePts: number[],
    color: [number, number, number],
    baseY: number
  ) {
    const { ctx, width, height } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';

    const step = 6; // sample every N px for performance
    for (let x = 0; x < width - step; x += step) {
      const depth = (height - surfacePts[x]) / height; // 0 near surface, 1 at bottom
      const shift = Math.sin(this.t * 1.8 + (x / width) * Math.PI * 4) * depth * 2.5;

      if (Math.abs(shift) < 0.5) continue;

      const grad = ctx.createLinearGradient(x, surfacePts[x], x + step, surfacePts[x] + shift);
      grad.addColorStop(0, this.rgba(this.lighten(color, 0.6), 0.04));
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x + shift, surfacePts[x], step, height - surfacePts[x]);
    }

    ctx.restore();
  }

  /* =============================================
     DRAWING — GLASS OVERLAY
  ============================================= */

  private drawGlassOverlay() {
    const { ctx, width, height } = this;

    // Top-left soft highlight band (glass specular)
    const glassGrad = ctx.createLinearGradient(0, 0, width * 0.6, height * 0.4);
    glassGrad.addColorStop(0,   'rgba(255,255,255,0.14)');
    glassGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    glassGrad.addColorStop(1,   'rgba(255,255,255,0.00)');

    ctx.save();
    ctx.fillStyle = glassGrad;
    ctx.fillRect(0, 0, width, height);

    // Border rim
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    ctx.restore();
  }
}