import React, { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import Foliage from './Foliage';
import Ornaments from './Ornaments';
import SpiralLights from './SpiralLights';
import Snow from './Snow';
import { TreeColors } from '../types';

interface ExperienceProps {
  mixFactor: number;
  colors: TreeColors;
  inputRef: React.MutableRefObject<{ x: number, y: number }>;
}

// STATIC CONSTANTS FOR STABILITY
// Defining these outside the component prevents them from being re-created on every render.
// This ensures that the useMemo in Ornaments.tsx doesn't re-run (which would re-randomize positions).
const BALL_COLORS = ['#8B0000', '#D4AF37', '#191970', '#C0C0C0']; // Red, Gold, Navy, Silver
const BOX_COLORS = ['#800000', '#228B22', '#D4AF37'];
const STAR_COLORS = ['#D4AF37', '#E5E4E2'];
const CRYSTAL_COLORS = ['#F0F8FF', '#E0FFFF']; // AliceBlue, LightCyan
const CANDY_COLORS = ['#FF0000', '#FFFFFF'];

// Handles Camera Parallax and Tree Rotation Physics
const SceneController: React.FC<{ inputRef: React.MutableRefObject<{ x: number, y: number }>, groupRef: React.RefObject<THREE.Group> }> = ({ inputRef, groupRef }) => {
    const { camera } = useThree();
    const vec = new THREE.Vector3();
    
    // Physics State
    const currentInput = useRef({ x: 0, y: 0 }); 
    const velocity = useRef(0);
    const lastX = useRef(0);

    useFrame((state, delta) => {
        // Safe delta to prevent huge jumps on lag spikes
        const safeDelta = Math.min(delta, 0.1);

        // 1. Smooth Input Interpolation
        const targetX = inputRef.current.x;
        const targetY = inputRef.current.y;
        
        const inputSmoothing = 3.0 * safeDelta;
        currentInput.current.x = THREE.MathUtils.lerp(currentInput.current.x, targetX, inputSmoothing);
        currentInput.current.y = THREE.MathUtils.lerp(currentInput.current.y, targetY, inputSmoothing);

        // 2. Camera Parallax
        // Adjusted Z base from 24 to 32 to give the tree more margin
        const camX = currentInput.current.x * 6; 
        const camY = currentInput.current.y * 3; 
        const camZ = 32 + Math.abs(currentInput.current.x) * 4; 
        
        camera.position.lerp(vec.set(camX, camY, camZ), 2.0 * safeDelta);
        camera.lookAt(0, 0, 0);

        // 3. Tree Momentum Physics
        if (groupRef.current) {
            const deltaX = currentInput.current.x - lastX.current;
            lastX.current = currentInput.current.x;
            velocity.current += deltaX * 0.5;
            velocity.current *= 0.95; 
            groupRef.current.rotation.y += 0.002 + velocity.current;
        }
    });
    
    return null;
};

const SceneContent: React.FC<ExperienceProps> = ({ mixFactor, colors, inputRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  return (
    <>
      <SceneController inputRef={inputRef} groupRef={groupRef} />
      
      <ambientLight intensity={0.2} />
      <spotLight position={[20, 20, 20]} angle={0.3} penumbra={1} intensity={1.5} color="#ffeebb" castShadow />
      <pointLight position={[-10, 5, -10]} intensity={0.8} color="#00ff00" />
      <pointLight position={[10, -5, 10]} intensity={0.8} color="#ff0000" />
      
      {/* Luxury Environment */}
      <Environment preset="city" background={false} />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      {/* Global Snow Effect */}
      <Snow mixFactor={mixFactor} />

      {/* Tree Group centered at 0,0,0 */}
      <group ref={groupRef} position={[0, 0, 0]}>
        
        {/* Dense Foliage with Snow tips */}
        <Foliage mixFactor={mixFactor} colors={colors} />
        
        {/* Spiral Light Strip */}
        <SpiralLights mixFactor={mixFactor} />
        
        {/* --- ORNAMENTS LAYERS --- */}

        {/* 1. Classic Balls */}
        <Ornaments 
            mixFactor={mixFactor} 
            type="BALL" 
            count={60} 
            scale={0.5}
            colors={BALL_COLORS} 
        />

        {/* 2. Presents (Boxes) */}
        <Ornaments 
            mixFactor={mixFactor} 
            type="BOX" 
            count={30} 
            scale={0.6}
            colors={BOX_COLORS} 
        />
        
        {/* 3. Luxury Stars */}
        <Ornaments 
            mixFactor={mixFactor} 
            type="STAR" 
            count={40} 
            scale={0.5}
            colors={STAR_COLORS} 
        />

        {/* 4. Crystals/Snowflakes */}
        <Ornaments 
            mixFactor={mixFactor} 
            type="CRYSTAL" 
            count={50} 
            scale={0.3}
            colors={CRYSTAL_COLORS} 
        />

        {/* 5. Candy Canes */}
        <Ornaments 
            mixFactor={mixFactor} 
            type="CANDY" 
            count={40} 
            scale={0.4}
            colors={CANDY_COLORS} 
        />

        {/* 6. Polaroids */}
        <Ornaments 
            mixFactor={mixFactor} 
            type="PHOTO" 
            count={30} 
        />
      </group>

      {/* Post Processing */}
      <EffectComposer enableNormalPass={false}>
        <Bloom 
            luminanceThreshold={0.9} 
            mipmapBlur 
            intensity={1.2} 
            radius={0.6}
        />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </>
  );
};

const Experience: React.FC<ExperienceProps> = (props) => {
  return (
    <Canvas
      dpr={[1, 1.5]} 
      camera={{ position: [0, 0, 32], fov: 45 }}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      shadows
    >
      <SceneContent {...props} />
    </Canvas>
  );
};

export default Experience;