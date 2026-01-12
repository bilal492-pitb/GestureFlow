import React, { useRef, useEffect, useState } from 'react';
import { HandState, GestureType, ParticleShape } from '../types';
import { Share2, Grid, Circle } from 'lucide-react';

interface Props {
  handState: HandState;
}

const PARTICLE_COUNT = 1500;
const COLOR_PALETTES = [
  ['#ef4444', '#f97316', '#f59e0b', '#fee2e2'], // Fire
  ['#3b82f6', '#06b6d4', '#818cf8', '#e0f2fe'], // Ice
  ['#10b981', '#84cc16', '#22c55e', '#ecfdf5'], // Nature
  ['#d946ef', '#8b5cf6', '#6366f1', '#f5d0fe'], // Galaxy
];

class Particle {
  baseX: number; 
  baseY: number; 
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  friction: number;
  ease: number;
  
  constructor(w: number, h: number, colors: string[]) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.baseX = 0;
    this.baseY = 0;
    this.vx = 0;
    this.vy = 0;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.size = Math.random() * 2 + 1;
    this.friction = 0.85; // Less friction for snappier follow
    this.ease = 0.2; // High ease for tight sync
  }

  update(
    handState: HandState, 
    centerX: number, 
    centerY: number, 
    rotation: number,
    scale: number
  ) {
    // 1. Calculate Target Position based on Shape, Rotation, and Hand Position
    
    // Rotate base coordinates
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    // Apply scale to base shape
    const scaledX = this.baseX * scale;
    const scaledY = this.baseY * scale;

    const rotatedX = scaledX * cos - scaledY * sin;
    const rotatedY = scaledX * sin + scaledY * cos;

    const targetX = centerX + rotatedX;
    const targetY = centerY + rotatedY;

    // 2. Physics & Hand Interaction
    const dx = targetX - this.x;
    const dy = targetY - this.y;

    this.vx += dx * this.ease;
    this.vy += dy * this.ease;

    // Add turbulence if hand is pointing (Active Energy)
    if (handState.detected && handState.gesture === GestureType.POINTING) {
       this.vx += (Math.random() - 0.5) * 5;
       this.vy += (Math.random() - 0.5) * 5;
    }

    this.vx *= this.friction;
    this.vy *= this.friction;

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const ParticleView: React.FC<Props> = ({ handState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [activePalette, setActivePalette] = useState(0);
  const [activeShape, setActiveShape] = useState<ParticleShape>(ParticleShape.CIRCLE);

  // Initialize Particles
  useEffect(() => {
    if (!canvasRef.current) return;
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => new Particle(w, h, COLOR_PALETTES[activePalette]));
  }, [activePalette]);

  // Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // Fade effect
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)'; // Darker trails for clearer motion
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;

      // --- Determine Center Position ---
      let cx = w / 2;
      let cy = h / 2;
      
      // Follow hand exactly if detected
      if (handState.detected) {
        cx = handState.position.x * w;
        cy = handState.position.y * h;
      }

      // --- Determine Rotation (Spin) ---
      let rotation = 0;
      if (handState.detected) {
         // Adjust so upright hand = 0 rotation. 
         // Hand Up (12 o'clock) corresponds to -PI/2 in screen math.
         // We add PI/2 so Up = 0 rads.
         rotation = handState.tilt + Math.PI / 2; 
      } else {
         rotation = performance.now() * 0.0005; // Auto spin
      }

      // --- Determine Scale (Zoom) ---
      let targetScale = 1;
      if (handState.detected) {
        if (handState.gesture === GestureType.CLOSED_FIST) {
          targetScale = 0.3; // Strong Contract
        } else if (handState.gesture === GestureType.OPEN_PALM) {
          targetScale = 2.0; // Strong Expand
        }
      }

      // Update shape definitions (Base positions relative to 0,0)
      particlesRef.current.forEach((p, i) => {
        if (activeShape === ParticleShape.CIRCLE) {
          const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
          const r = 200 + Math.random() * 20; 
          p.baseX = Math.cos(angle) * r;
          p.baseY = Math.sin(angle) * r;
        } else if (activeShape === ParticleShape.SQUARE) {
          const size = 350;
          const perimeter = size * 4;
          const pos = (i / PARTICLE_COUNT) * perimeter;
          
          if (pos < size) { // Top
             p.baseX = pos - size/2; p.baseY = -size/2;
          } else if (pos < size * 2) { // Right
             p.baseX = size/2; p.baseY = (pos - size) - size/2;
          } else if (pos < size * 3) { // Bottom
             p.baseX = (size * 3 - pos) - size/2; p.baseY = size/2;
          } else { // Left
             p.baseX = -size/2; p.baseY = (size * 4 - pos) - size/2;
          }
          p.baseX += (Math.random() - 0.5) * 20;
          p.baseY += (Math.random() - 0.5) * 20;

        } else if (activeShape === ParticleShape.SOLAR) {
           const isSun = i < 300;
           if (isSun) {
             const r = Math.random() * 60;
             const a = Math.random() * Math.PI * 2;
             p.baseX = Math.cos(a) * r;
             p.baseY = Math.sin(a) * r;
           } else {
             const r = 200 + Math.random() * 100;
             const a = (i * 0.02);
             p.baseX = Math.cos(a) * r;
             p.baseY = Math.sin(a) * r;
           }
        } else if (activeShape === ParticleShape.GALAXY) {
           const spiralScale = 12;
           const angleOffset = i * 0.02;
           const r = angleOffset * spiralScale;
           const armOffset = (i % 3) * (Math.PI * 2 / 3);
           const finalAngle = angleOffset + armOffset;
           
           p.baseX = Math.cos(finalAngle) * r;
           p.baseY = Math.sin(finalAngle) * r;
        }

        p.update(handState, cx, cy, rotation, targetScale);
        p.draw(ctx);
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeShape, handState]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      
      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-4 bg-black/50 backdrop-blur-md p-4 rounded-2xl border border-white/10 transition-opacity duration-300 hover:opacity-100 opacity-60">
        <div className="flex flex-col items-center gap-2 border-r border-white/20 pr-4">
          <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Shape</span>
          <div className="flex gap-2">
            <button onClick={() => setActiveShape(ParticleShape.CIRCLE)} className={`p-2 rounded-lg transition ${activeShape === ParticleShape.CIRCLE ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-gray-400'}`}>
              <Circle size={20} />
            </button>
            <button onClick={() => setActiveShape(ParticleShape.SQUARE)} className={`p-2 rounded-lg transition ${activeShape === ParticleShape.SQUARE ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-gray-400'}`}>
              <Grid size={20} />
            </button>
            <button onClick={() => setActiveShape(ParticleShape.SOLAR)} className={`p-2 rounded-lg transition ${activeShape === ParticleShape.SOLAR ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-gray-400'}`}>
              <Share2 size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 pl-2">
          <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Color</span>
          <div className="flex gap-2">
             {COLOR_PALETTES.map((pal, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActivePalette(idx)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${activePalette === idx ? 'border-white scale-110' : 'border-transparent opacity-70 hover:scale-105'}`}
                  style={{ background: `linear-gradient(135deg, ${pal[0]}, ${pal[1]})` }}
                />
             ))}
          </div>
        </div>
      </div>

      <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
        <h2 className="text-3xl font-thin text-white tracking-tight">Kinetic Particles</h2>
        <div className="flex flex-col gap-1 mt-2 text-xs text-gray-400 font-mono">
           <p>MOVE hand to Position</p>
           <p>ROTATE hand to Spin</p>
           <p>FIST to Contract • PALM to Expand</p>
        </div>
      </div>
    </div>
  );
};