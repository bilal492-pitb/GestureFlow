import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureType, HandState } from '../types';

export const useHandTracking = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const [handState, setHandState] = useState<HandState>({
    detected: false,
    position: { x: 0.5, y: 0.5, z: 0 },
    gesture: GestureType.NONE,
    tilt: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const prevCenterRef = useRef<{x:number,y:number,ts:number} | null>(null);
  const swipeCooldownRef = useRef<number>(0);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setIsLoading(false);
        startLoop();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        setIsLoading(false); // Stop loading indicator even if failed
      }
    };

    initMediaPipe();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectGesture = (landmarks: any[]): GestureType => {
    const wrist = landmarks[0];

    // Simple heuristic: Count fingers extended
    // A finger is extended if tip is higher (lower y) than its PIP joint (knuckle equivalent for this simplified logic)
    // We compare distance to wrist to determine extension vs contraction
    const isFingerBent = (tipIdx: number, pipIdx: number) => {
      const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
      const dPip = Math.hypot(landmarks[pipIdx].x - wrist.x, landmarks[pipIdx].y - wrist.y);
      return dTip < dPip; 
    };

    const indexBent = isFingerBent(8, 6);
    const middleBent = isFingerBent(12, 10);
    const ringBent = isFingerBent(16, 14);
    const pinkyBent = isFingerBent(20, 18);

    // Thumb-index distance -> pinch/spread
    const thumb = landmarks[4];
    const indexTip = landmarks[8];
    const handSize = Math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y) + 1e-6;
    const thumbIndexDist = Math.hypot(thumb.x - indexTip.x, thumb.y - indexTip.y) / handSize;

    if (indexBent && middleBent && ringBent && pinkyBent) return GestureType.CLOSED_FIST;
    if (!indexBent && !middleBent && !ringBent && !pinkyBent) return GestureType.OPEN_PALM;
    if (!indexBent && middleBent && ringBent && pinkyBent) return GestureType.POINTING;

    if (thumbIndexDist < 0.22) return GestureType.PINCH; // fingers close
    if (thumbIndexDist > 0.45) return GestureType.SPREAD; // fingers wide

    return GestureType.NONE;
  };

  const startLoop = () => {
    // If video isn't ready, retry in next frame
    if (!handLandmarkerRef.current || !videoRef.current) {
        requestRef.current = requestAnimationFrame(startLoop);
        return;
    }

    const renderLoop = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const nowInMs = performance.now();
        const detections = handLandmarkerRef.current?.detectForVideo(videoRef.current, nowInMs);
        
        if (detections && detections.landmarks && detections.landmarks.length > 0) {
          const landmarks = detections.landmarks[0];
          const gesture = detectGesture(landmarks);

          // Calculate Center of Palm
          const cx = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3;
          const cy = (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3;

          // Calculate Tilt (angle between wrist and middle finger MCP)
          const dx = landmarks[9].x - landmarks[0].x;
          const dy = landmarks[9].y - landmarks[0].y;
          const angle = Math.atan2(dy, dx);

          // Swipe detection (velocity-based)
          const now = performance.now();
          let swipe = GestureType.NONE;
          const prev = prevCenterRef.current;
          if (prev) {
            const dt = Math.max(1, now - prev.ts);
            const vx = (cx - prev.x) / (dt / 1000); // normalized units per second
            // If quick horizontal velocity and cooldown passed
            if (Math.abs(vx) > 0.8 && (now - swipeCooldownRef.current) > 400) {
              swipe = vx > 0 ? GestureType.SWIPE_RIGHT : GestureType.SWIPE_LEFT;
              swipeCooldownRef.current = now;
            }
          }
          prevCenterRef.current = { x: cx, y: cy, ts: now };

          // Prioritize swipe then pinch/spread then other gestures
          const finalGesture = swipe !== GestureType.NONE ? swipe : gesture;

          setHandState({
            detected: true,
            position: { x: 1 - cx, y: cy, z: landmarks[9].z }, // Mirror X
            gesture: finalGesture,
            tilt: angle
          });
        } else {
          setHandState(prev => prev.detected ? { ...prev, detected: false, gesture: GestureType.NONE } : prev);
        }
      }
      requestRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();
  };

  return { handState, isLoading };
};