import React, { useState, useEffect, useRef } from 'react';
import { HandState } from '../types';

interface Props {
  handState: HandState;
}

const IMAGES = [
  'https://picsum.photos/800/1200?random=1',
  'https://picsum.photos/800/1200?random=2',
  'https://picsum.photos/800/1200?random=3',
  'https://picsum.photos/800/1200?random=4',
  'https://picsum.photos/800/1200?random=5',
  'https://picsum.photos/800/1200?random=6',
];

export const CarouselView: React.FC<Props> = ({ handState }) => {
  const [scrollPos, setScrollPos] = useState(0); 
  const targetScrollRef = useRef(0);
  const prevHandXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Animation Frame Loop for smooth physics
  useEffect(() => {
    let animId: number;
    const updatePhysics = () => {
      setScrollPos(current => {
        const diff = targetScrollRef.current - current;
        // If very close and not holding, snap exactly
        if (Math.abs(diff) < 0.005 && !isDraggingRef.current) return targetScrollRef.current;
        // Lerp factor
        return current + diff * 0.15; 
      });
      animId = requestAnimationFrame(updatePhysics);
    };
    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Handle touch events for mobile
  const touchStartX = useRef<number | null>(null);
  const touchStartScroll = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartScroll.current = targetScrollRef.current;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const touchX = e.touches[0].clientX;
    const deltaX = touchStartX.current - touchX;
    const windowWidth = window.innerWidth;
    const sensitivity = 3.0; // Adjust sensitivity for touch
    
    // Calculate new scroll position based on touch movement
    targetScrollRef.current = touchStartScroll.current + (deltaX / windowWidth) * sensitivity;
    
    // Clamp values
    const max = IMAGES.length - 1;
    if (targetScrollRef.current < -0.5) targetScrollRef.current = -0.5;
    if (targetScrollRef.current > max + 0.5) targetScrollRef.current = max + 0.5;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    
    // Snap to nearest slide
    const snapIndex = Math.round(targetScrollRef.current);
    targetScrollRef.current = Math.max(0, Math.min(IMAGES.length - 1, snapIndex));
    touchStartX.current = null;
  };

  // Hand Interaction Logic
  useEffect(() => {
    if (handState.detected) {
      if (prevHandXRef.current !== null) {
        // Calculate Drag Delta
        // Sensitivity: Moving full screen width moves 5 slides
        const sensitivity = 5.0; 
        const delta = (handState.position.x - prevHandXRef.current) * sensitivity;
        
        // Direct Mapping: Hand Left (neg delta) -> Go Next (pos scroll)
        // Hand Right (pos delta) -> Go Prev (neg scroll)
        targetScrollRef.current -= delta; 
        
        // Soft Clamping
        const max = IMAGES.length - 1;
        if (targetScrollRef.current < -0.5) targetScrollRef.current = -0.5;
        if (targetScrollRef.current > max + 0.5) targetScrollRef.current = max + 0.5;
      }
      
      prevHandXRef.current = handState.position.x;
      isDraggingRef.current = true;
    } else {
      // Hand lost: Snap to nearest integer
      if (isDraggingRef.current) {
         const snapIndex = Math.round(targetScrollRef.current);
         // Hard clamp final index
         targetScrollRef.current = Math.max(0, Math.min(IMAGES.length - 1, snapIndex));
         isDraggingRef.current = false;
         prevHandXRef.current = null;
      }
    }
  }, [handState.detected, handState.position.x]);

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center bg-gray-950 overflow-hidden relative touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute top-4 left-4 z-10 select-none">
        <h2 className="text-2xl md:text-3xl font-thin text-white tracking-tight">Spatial Gallery</h2>
        <p className="text-xs text-gray-400 font-mono mt-1 md:mt-2">
          {window.innerWidth < 768 ? 'SWIPE to navigate' : 'DRAG air left/right to scroll'}
        </p>
      </div>

      {/* Hand Cursor - Only show on desktop when hand is detected */}
      {handState.detected && window.innerWidth >= 768 && (
        <div 
           className="absolute z-50 pointer-events-none transition-transform duration-75 ease-out"
           style={{
             left: `${handState.position.x * 100}%`,
             top: `${handState.position.y * 100}%`,
             transform: 'translate(-50%, -50%)'
           }}
        >
          <div className="w-14 h-14 border-2 border-blue-500 rounded-full flex items-center justify-center bg-blue-500/10 backdrop-blur-sm shadow-[0_0_20px_rgba(59,130,246,0.5)]">
             <div className="w-2 h-2 bg-blue-400 rounded-full" />
          </div>
          <div className="absolute top-16 left-1/2 -translate-x-1/2 text-[10px] font-mono text-blue-400 whitespace-nowrap bg-black/50 px-2 rounded">
             DRAG
          </div>
        </div>
      )}
      
      {/* Mobile touch indicator */}
      {window.innerWidth < 768 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center space-x-2 z-10">
          {IMAGES.map((_, index) => (
            <div 
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                Math.round(scrollPos) === index ? 'bg-white' : 'bg-gray-500/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* 3D Scene Container */}
      <div className="relative w-full h-[600px] perspective-[1200px] flex items-center justify-center">
        {IMAGES.map((src, i) => {
          // Calculate relative position to current scroll
          const offset = i - scrollPos;
          const absOffset = Math.abs(offset);
          
          // Optimization: Don't render if too far
          if (absOffset > 3.5) return null;

          // 3D Transform Logic
          // x: spreads them out
          // z: pushes side items back
          // ry: rotates them inward
          const translateX = offset * 500; 
          const translateZ = -absOffset * 400; 
          const rotateY = offset * -25; 
          
          const opacity = 1 - Math.min(1, absOffset * 0.4);
          const scale = 1 - Math.min(0.5, absOffset * 0.2);
          const zIndex = 100 - Math.round(absOffset * 10);

          return (
            <div
              key={i}
              className="absolute w-[400px] h-[600px] will-change-transform"
              style={{
                zIndex: zIndex,
                opacity: opacity,
                transform: `
                  translateX(${translateX}px) 
                  translateZ(${translateZ}px) 
                  rotateY(${rotateY}deg)
                  scale(${scale})
                `,
                transformStyle: 'preserve-3d'
              }}
            >
              <img
                src={src}
                alt={`Slide ${i}`}
                className="w-full h-full object-cover rounded-xl shadow-2xl border border-white/10"
                draggable={false}
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-8 left-6 text-white font-thin text-4xl">
                0{i + 1}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Scroll Progress Bar */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-75 ease-linear"
          style={{ 
            width: `${(100 / IMAGES.length)}%`,
            transform: `translateX(${scrollPos * 100}%)`
          }}
        />
      </div>
    </div>
  );
};