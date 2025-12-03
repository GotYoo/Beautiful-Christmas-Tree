import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

interface GestureControllerProps {
  onGesture: (data: { isOpen: boolean; position: { x: number; y: number }, isDetected: boolean }) => void;
}

const GestureController: React.FC<GestureControllerProps> = ({ onGesture }) => {
  const webcamRef = useRef<Webcam>(null);
  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [debugState, setDebugState] = useState<string>("-");
  
  const onGestureRef = useRef(onGesture);
  useEffect(() => {
    onGestureRef.current = onGesture;
  }, [onGesture]);

  const lastDetectionTime = useRef(0);
  
  // STABILIZATION REFS
  const ratioHistory = useRef<number[]>([]); // Store last N ratios for smoothing
  const posHistory = useRef<{x:number, y:number}[]>([]); // Store last N positions for smoothing
  const isCurrentlyOpen = useRef<boolean>(false); // Track internal state for hysteresis
  const missedFrames = useRef(0); // Debounce for tracking loss

  // Load Model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const net = await handpose.load();
        setModel(net);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load handpose model:", err);
        setLoading(false);
      }
    };
    loadModel();
  }, []);

  // Loop
  const runDetection = useCallback(async () => {
    if (model && webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
      
      const now = Date.now();
      // Throttle detection to every 60ms (~16 FPS) for smooth tracking
      if (now - lastDetectionTime.current < 60) {
        requestAnimationFrame(runDetection);
        return;
      }
      lastDetectionTime.current = now;

      const video = webcamRef.current.video;
      
      try {
        const predictions = await model.estimateHands(video);

        if (predictions.length > 0) {
          // Hand Found - Reset missed counter
          missedFrames.current = 0;
          
          const hand = predictions[0];
          const landmarks = hand.landmarks;
          const wrist = landmarks[0];

          // --- 1. Position Calculation with Smoothing ---
          const rawX = -1 * ((wrist[0] / video.videoWidth) * 2 - 1); 
          const rawY = -1 * ((wrist[1] / video.videoHeight) * 2 - 1);
          
          posHistory.current.push({x: rawX, y: rawY});
          if (posHistory.current.length > 8) posHistory.current.shift(); // Average last 8 frames

          const avgPos = posHistory.current.reduce((acc, curr) => ({ x: acc.x + curr.x, y: acc.y + curr.y }), {x:0, y:0});
          const count = posHistory.current.length;
          const x = avgPos.x / count;
          const y = avgPos.y / count;

          // --- 2. Robust Gesture Detection ---
          
          // Indices: Index, Middle, Ring, Pinky
          const tips = [8, 12, 16, 20]; 
          const bases = [5, 9, 13, 17]; // MCP Joints

          const getDist = (p1: number[], p2: number[]) => {
             return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
          };

          let totalBaseDist = 0;
          let totalTipDist = 0;

          for(let i=0; i<4; i++) {
              totalBaseDist += getDist(wrist, landmarks[bases[i]]);
              totalTipDist += getDist(wrist, landmarks[tips[i]]);
          }

          const avgBaseDist = totalBaseDist / 4;
          const avgTipDist = totalTipDist / 4;
          
          // Current instant ratio
          const rawRatio = avgTipDist / (avgBaseDist || 1);

          // A. Smoothing: Average last 5 frames
          ratioHistory.current.push(rawRatio);
          if (ratioHistory.current.length > 5) ratioHistory.current.shift();
          const smoothedRatio = ratioHistory.current.reduce((a,b) => a+b, 0) / ratioHistory.current.length;

          // B. Hysteresis (The State Lock)
          if (!isCurrentlyOpen.current && smoothedRatio > 1.6) {
             isCurrentlyOpen.current = true;
          } else if (isCurrentlyOpen.current && smoothedRatio < 1.2) {
             isCurrentlyOpen.current = false;
          }

          const isOpen = isCurrentlyOpen.current;

          // Debug Output
          const stateLabel = isOpen ? `OPEN (${smoothedRatio.toFixed(1)})` : `CLOSED (${smoothedRatio.toFixed(1)})`;
          setDebugState(stateLabel);

          if (onGestureRef.current) {
            onGestureRef.current({ isOpen, position: { x, y }, isDetected: true });
          }
        } else {
          // Hand Lost? Wait for 5 consecutive frames before declaring lost.
          missedFrames.current++;
          
          if (missedFrames.current > 5) {
              // Only reset state if hand is truly gone for ~300ms
              isCurrentlyOpen.current = false; 
              ratioHistory.current = []; 
              posHistory.current = []; // Reset smoothing buffers
              
              setDebugState("NO HAND");
              if (onGestureRef.current) {
                onGestureRef.current({ isOpen: false, position: {x:0, y:0}, isDetected: false });
              }
          }
        }
      } catch (err) {
        // Suppress ephemeral detection errors
      }
    }
    
    requestAnimationFrame(runDetection);
  }, [model]);

  useEffect(() => {
    if (model && !loading) {
      const timer = requestAnimationFrame(runDetection);
      return () => cancelAnimationFrame(timer);
    }
  }, [model, loading, runDetection]);

  return (
    <div className="fixed bottom-4 right-4 z-50 border-2 border-[#d4af37] bg-black/80 rounded-lg overflow-hidden w-48 h-36 shadow-[0_0_15px_#d4af37]">
      {cameraError ? (
         <div className="flex items-center justify-center h-full text-[#d4af37] text-xs p-2 text-center">
            Camera unavailable. Use mouse.
         </div>
      ) : (
        <Webcam
            ref={webcamRef}
            mirrored={true}
            className="w-full h-full object-cover opacity-80"
            onUserMediaError={() => setCameraError(true)}
        />
      )}
      {loading && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center text-[#d4af37] text-xs">
              Loading AI...
          </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-[#d4af37] flex justify-between px-2 py-1 font-mono">
        <span>GESTURE</span>
        <span className={debugState.includes("OPEN") ? "text-red-400" : "text-green-400"}>
            {debugState}
        </span>
      </div>
    </div>
  );
};

export default GestureController;