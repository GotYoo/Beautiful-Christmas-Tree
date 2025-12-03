import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lerp } from '../utils/math';

const snowVertexShader = `
  uniform float uTime;
  uniform float uMix; // 1 = Formed (Gentle), 0 = Chaos (Storm)
  
  attribute float aScale;
  attribute vec3 aVelocity;
  
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    
    // Physics
    // Fall down based on time
    float fallSpeed = aVelocity.y * (1.0 + (1.0 - uMix) * 4.0); // Faster in chaos
    pos.y = mod(pos.y - uTime * fallSpeed + 15.0, 30.0) - 15.0; // Wrap Y (-15 to 15)
    
    // Side drift
    float drift = sin(uTime * aVelocity.x + pos.y) * (0.5 + (1.0 - uMix) * 2.0);
    pos.x += drift;
    pos.z += cos(uTime * aVelocity.z + pos.x) * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size
    gl_PointSize = aScale * (15.0 / -mvPosition.z);
    
    // Fade at edges of box
    vAlpha = 1.0 - smoothstep(12.0, 15.0, abs(pos.y));
  }
`;

const snowFragmentShader = `
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    float alpha = (1.0 - smoothstep(0.3, 0.5, dist)) * vAlpha * 0.8;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

const Snow: React.FC<{ mixFactor: number }> = ({ mixFactor }) => {
  const count = 3000;
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const currentMixRef = useRef(1);

  const { positions, scales, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sc = new Float32Array(count);
    const vel = new Float32Array(count * 3);
    
    for(let i=0; i<count; i++) {
        // Random box -20 to 20
        pos[i*3] = (Math.random() - 0.5) * 40;
        pos[i*3+1] = (Math.random() - 0.5) * 30; // Y height
        pos[i*3+2] = (Math.random() - 0.5) * 40;
        
        sc[i] = Math.random() * 2 + 1;
        
        vel[i*3] = Math.random() * 0.5 + 0.2; // Drift freq
        vel[i*3+1] = Math.random() * 2.0 + 1.0; // Fall speed
        vel[i*3+2] = Math.random() * 0.5 + 0.2;
    }
    return { positions: pos, scales: sc, velocities: vel };
  }, []);

  useFrame((state, delta) => {
     if (materialRef.current) {
         currentMixRef.current = lerp(currentMixRef.current, mixFactor, delta * 2.0);
         materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
         materialRef.current.uniforms.uMix.value = currentMixRef.current;
     }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aScale" count={count} array={scales} itemSize={1} />
        <bufferAttribute attach="attributes-aVelocity" count={count} array={velocities} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial 
        ref={materialRef}
        vertexShader={snowVertexShader}
        fragmentShader={snowFragmentShader}
        uniforms={{
            uTime: { value: 0 },
            uMix: { value: 1 }
        }}
        transparent
        depthWrite={false}
      />
    </points>
  );
};

export default Snow;