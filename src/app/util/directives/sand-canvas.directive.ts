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

  private hexToRgba(hex: string, alpha: number, darken: number = 1.0): string {
    hex = (hex || '#0ea5e9').replace('#', '');
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
      r = Math.floor(parseInt(hex[0] + hex[0], 16) * darken);
      g = Math.floor(parseInt(hex[1] + hex[1], 16) * darken);
      b = Math.floor(parseInt(hex[2] + hex[2], 16) * darken);
    } else if (hex.length === 6) {
      r = Math.floor(parseInt(hex.substring(0, 2), 16) * darken);
      g = Math.floor(parseInt(hex.substring(2, 4), 16) * darken);
      b = Math.floor(parseInt(hex.substring(4, 6), 16) * darken);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Gravity calculation from tilt (increased range)
    this.targetSlosh = (this.tiltX / 20) * (this.height * 0.75); // Larger steeper offset
    const tiltSpeed = Math.abs(this.targetSlosh - this.currentSlosh);
    this.currentSlosh += (this.targetSlosh - this.currentSlosh) * 0.15; // Faster response

    // Movement intensity drives ripple heights (turbulance)
    this.targetIntensity = Math.min(25, tiltSpeed * 2.0 + Math.abs(this.currentSlosh) * 0.15);
    this.currentIntensity += (this.targetIntensity - this.currentIntensity) * 0.1;

    const depthSlosh = (this.tiltY / 20) * (this.height * 0.25); // Front/Back slosh height offset
    const baseHeight = this.height * (1 - this.percentage / 100) - depthSlosh;
    
    // Slower, rolling wave frequency
    const time = Date.now() * 0.0025; 
    const rippleHeight = 3 + this.currentIntensity * 1.25; // Taller peak ripples

    // Ambient drift fallback if stable
    if (Math.abs(this.targetSlosh) < 1) {
      this.currentSlosh = Math.sin(Date.now() * 0.001) * 4;
    }

    // Layer 1: Background Wave (Depth backscatter)
    const bgGrad = this.ctx.createLinearGradient(0, baseHeight - this.currentSlosh - 4, 0, this.height);
    bgGrad.addColorStop(0, this.hexToRgba(this.color, 0.2)); // Light Top
    bgGrad.addColorStop(1, this.hexToRgba(this.color, 0.7));  // Dark Thick Bottom
    
    this.ctx.fillStyle = bgGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);
    this.ctx.lineTo(0, baseHeight - this.currentSlosh);
    
    // Circular Orbiting Control Points (Gerstner-style continuous surges)
    const cp1x_1 = this.width * 0.33 + Math.cos(time) * 15;
    const cp1y_1 = baseHeight + Math.sin(time) * rippleHeight;
    const cp2x_1 = this.width * 0.66 + Math.cos(time + Math.PI / 2) * 15;
    const cp2y_1 = baseHeight + Math.sin(time + Math.PI / 2) * rippleHeight;

    this.ctx.bezierCurveTo(cp1x_1, cp1y_1, cp2x_1, cp2y_1, this.width, baseHeight + this.currentSlosh);
    this.ctx.lineTo(this.width, this.height);
    this.ctx.fill();

    // Layer 2: Foreground Wave WITH LIGHTING (Gradient + Crest Highlight)
    const topY = baseHeight - this.currentSlosh + 2;
    const botY = baseHeight + this.currentSlosh + 2;
    
    const cp1x_2 = this.width * 0.33 + Math.sin(time + 1) * 15;
    const cp1y_2 = baseHeight + Math.cos(time + 1) * rippleHeight;
    const cp2x_2 = this.width * 0.66 + Math.sin(time + 1 + Math.PI / 2) * 15;
    const cp2y_2 = baseHeight + Math.cos(time + 1 + Math.PI / 2) * rippleHeight;

    this.ctx.beginPath();
    this.ctx.moveTo(0, topY);
    this.ctx.bezierCurveTo(this.width * 0.33, cp1y_2, this.width * 0.66, cp2y_2, this.width, botY);
    
    // 2. Linear Gradient for depth absorption
    const grad = this.ctx.createLinearGradient(0, Math.min(topY, botY), 0, this.height);
    grad.addColorStop(0, this.hexToRgba(this.color, 0.85)); // Bright Surface
    grad.addColorStop(0.3, this.hexToRgba(this.color, 0.45)); // Core density
    grad.addColorStop(1, this.hexToRgba(this.color, 0.1));    // Base blend bottom

    this.ctx.fillStyle = grad;
    // Continue the path down to complete the filled polygon
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(0, this.height);
    this.ctx.lineTo(0, topY);
    this.ctx.fill();

    // Layer 3: --- 3D SURFACE CAP (Ellipse perspective) ---
    const ellipseWidth = 11 + Math.abs(this.tiltY / 20) * 4; // Slightly wider
    
    this.ctx.beginPath();
    this.ctx.moveTo(0, topY);
    // Curve A: Front Edge (matches Layer 2)
    this.ctx.bezierCurveTo(this.width * 0.33, cp1y_2, this.width * 0.66, cp2y_2, this.width, botY);
    
    // Curve B: Back Edge (Offset UP for 3D look)
    this.ctx.bezierCurveTo(
      this.width * 0.66, cp2y_2 - ellipseWidth, 
      this.width * 0.33, cp1y_2 - ellipseWidth, 
      0, topY
    );
    this.ctx.closePath();

    const topGrad = this.ctx.createLinearGradient(0, Math.min(topY, botY) - ellipseWidth, 0, Math.max(topY, botY));
    
    // Soft translucent gradient for top surface cap
    topGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)'); // Soft gloss reflection
    topGrad.addColorStop(1, this.hexToRgba(this.color, 0.65));   // Translucent Surface

    this.ctx.fillStyle = topGrad;
    this.ctx.fill();

    // Edge light highlight separating the back crest (Soft glowing rim)
    this.ctx.beginPath();
    this.ctx.moveTo(this.width, botY);
    this.ctx.bezierCurveTo(
      this.width * 0.66, cp2y_2 - ellipseWidth, 
      this.width * 0.33, cp1y_2 - ellipseWidth, 
      0, topY
    );
    
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    this.ctx.shadowBlur = 6;
    this.ctx.lineWidth = 1.6;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.stroke();
    this.ctx.restore();

    this.animationId = requestAnimationFrame(() => this.animate());
  }
}
