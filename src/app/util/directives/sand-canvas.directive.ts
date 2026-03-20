import { Directive, ElementRef, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, NgZone } from '@angular/core';

@Directive({
  selector: '[appSandCanvas]',
  standalone: true
})
export class SandCanvasDirective implements OnInit, OnChanges, OnDestroy {
  @Input('appSandCanvas') color: string = '#0ea5e9'; // Cyan/Blue
  @Input() tiltX: number = 0;
  @Input() tiltY: number = 0;
  @Input() percentage: number = 0; // 0 to 100

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationId!: number;
  private width: number = 0;
  private height: number = 0;

  private currentSlosh: number = 0;
  private targetSlosh: number = 0;
  private currentIntensity: number = 0;
  private targetIntensity: number = 0;

  constructor(private el: ElementRef, private ngZone: NgZone) {}

  ngOnInit() {
    this.canvas = this.el.nativeElement as HTMLCanvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) return;
    this.ctx = context;

    this.setupCanvas();

    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });

    window.addEventListener('resize', () => this.setupCanvas());
  }

  ngOnChanges(changes: SimpleChanges) {
    // Inputs are read directly in the animate loop
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', () => this.setupCanvas());
  }

  private setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 300;
    this.height = rect.height || 80;
    
    // Scale for High DPI (Retina)
    this.canvas.width = this.width * (window.devicePixelRatio || 1);
    this.canvas.height = this.height * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  }

  private hexToRgba(hex: string, alpha: number): string {
    hex = (hex || '#0ea5e9').replace('#', '');
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Gravity calculation from tilt
    this.targetSlosh = (this.tiltX / 20) * (this.height * 0.4); // scaled offset
    const tiltSpeed = Math.abs(this.targetSlosh - this.currentSlosh);
    this.currentSlosh += (this.targetSlosh - this.currentSlosh) * 0.12; // inertia

    // Movement intensity drives ripple heights (turbulance)
    this.targetIntensity = Math.min(15, tiltSpeed * 1.5 + Math.abs(this.currentSlosh) * 0.1);
    this.currentIntensity += (this.targetIntensity - this.currentIntensity) * 0.1;

    const baseHeight = this.height * (1 - this.percentage / 100);
    const time = Date.now() * 0.003;
    const rippleHeight = 2 + this.currentIntensity; // Dynamic height

    // Ambient drift fallback if stable
    if (Math.abs(this.targetSlosh) < 1) {
      this.currentSlosh = Math.sin(Date.now() * 0.001) * 3;
    }

    // Layer 1: Background Wave (Lighter)
    this.ctx.fillStyle = this.hexToRgba(this.color, 0.35);
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);
    this.ctx.lineTo(0, baseHeight - this.currentSlosh);
    
    // Add central ripple mod
    const midY1 = baseHeight + Math.sin(time) * rippleHeight;
    this.ctx.quadraticCurveTo(this.width / 2, midY1, this.width, baseHeight + this.currentSlosh);
    this.ctx.lineTo(this.width, this.height);
    this.ctx.fill();

    // Layer 2: Foreground Wave (Darker/Denser)
    this.ctx.fillStyle = this.hexToRgba(this.color, 0.6);
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);
    this.ctx.lineTo(0, baseHeight - this.currentSlosh + 2); // slight offset
    
    const midY2 = baseHeight + Math.cos(time + 1) * rippleHeight;
    this.ctx.quadraticCurveTo(this.width / 2, midY2, this.width, baseHeight + this.currentSlosh + 2);
    this.ctx.lineTo(this.width, this.height);
    this.ctx.fill();

    this.animationId = requestAnimationFrame(() => this.animate());
  }
}
