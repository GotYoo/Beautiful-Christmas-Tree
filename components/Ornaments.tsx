import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { generateFoliageData, lerp, randomVector3 } from '../utils/math';

interface OrnamentData {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  rotation: THREE.Euler;
  color: THREE.Color;
  scale: THREE.Vector3; 
}

interface OrnamentsProps {
  mixFactor: number;
  type: 'BALL' | 'BOX' | 'STAR' | 'CANDY' | 'CRYSTAL' | 'PHOTO';
  count: number;
  colors?: string[];
  scale?: number;
}

const Ornaments: React.FC<OrnamentsProps> = ({ mixFactor, type, count, colors, scale = 1 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const currentMixRef = useRef(1);

  // Generate data once
  const data = useMemo(() => {
    const items: OrnamentData[] = [];
    const { target } = generateFoliageData(count, 18, 7);

    for (let i = 0; i < count; i++) {
      // Target: On the surface of the tree
      const tPos = new THREE.Vector3(target[i*3], target[i*3+1], target[i*3+2]);
      
      // Push outward based on type
      const pushOut = type === 'STAR' ? 1.15 : 1.08;
      tPos.multiplyScalar(pushOut);

      // Chaos: Random space
      const cPos = randomVector3(25);

      const colorHex = colors ? colors[Math.floor(Math.random() * colors.length)] : '#ffffff';

      // Shape specific scaling
      const baseScale = new THREE.Vector3(1, 1, 1);
      const randScale = Math.random() * 0.4 + 0.8; // Variation
      
      if (type === 'CANDY') {
          baseScale.set(0.2, 1.5, 0.2); // Stick shape
      } else if (type === 'PHOTO') {
          baseScale.set(1.0, 1.2, 0.05); // Card shape
      } else if (type === 'STAR') {
          baseScale.setScalar(1.2);
      }

      baseScale.multiplyScalar(scale * randScale);

      items.push({
        chaosPos: cPos,
        targetPos: tPos,
        rotation: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, 0),
        color: new THREE.Color(colorHex),
        scale: baseScale
      });
    }
    return items;
  }, [count, type, colors, scale]);

  // Texture for photos
  const photoTexture = useMemo(() => {
    if (type !== 'PHOTO') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#fffaea';
        ctx.fillRect(0,0, 256, 300);
        ctx.fillStyle = '#111';
        ctx.fillRect(20, 20, 216, 216);
        ctx.fillStyle = '#d4af37';
        ctx.font = '40px serif';
        ctx.textAlign = 'center';
        ctx.fillText('Grand', 128, 120);
        ctx.font = '30px serif';
        ctx.fillText('Holiday', 128, 160);
    }
    return new THREE.CanvasTexture(canvas);
  }, [type]);

  useLayoutEffect(() => {
     if (!meshRef.current) return;
     
     data.forEach((item, i) => {
         if (type !== 'PHOTO') {
             meshRef.current!.setColorAt(i, item.color);
         }
         
         dummy.position.copy(item.targetPos);
         dummy.scale.copy(item.scale);
         dummy.rotation.copy(item.rotation);
         dummy.updateMatrix();
         meshRef.current!.setMatrixAt(i, dummy.matrix);
     });
     
     if (type !== 'PHOTO' && meshRef.current.instanceColor) {
         meshRef.current.instanceColor.needsUpdate = true;
     }
     meshRef.current.instanceMatrix.needsUpdate = true;
  }, [data, type, dummy]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const speed = 2.0 * delta;
    currentMixRef.current = lerp(currentMixRef.current, mixFactor, speed);
    const t = currentMixRef.current;
    
    data.forEach((item, i) => {
      // 1. Position
      const currentPos = new THREE.Vector3().lerpVectors(item.chaosPos, item.targetPos, t);
      dummy.position.copy(currentPos);
      
      // 2. Rotation
      if ((type === 'PHOTO' || type === 'STAR') && t > 0.8) {
         // Face outward
         dummy.lookAt(0, currentPos.y, 0); 
         if (type === 'PHOTO') dummy.rotateY(Math.PI); 
         if (type === 'STAR') dummy.rotateX(Math.PI / 2); // Orient star tip out
      } else {
         dummy.rotation.copy(item.rotation);
      }

      // 3. Scale
      dummy.scale.copy(item.scale); 

      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {type === 'BALL' && <sphereGeometry args={[1, 12, 12]} />} 
      {type === 'BOX' && <boxGeometry args={[1, 1, 1]} />}
      {type === 'PHOTO' && <boxGeometry args={[1, 1.2, 1]} />}
      {type === 'STAR' && <octahedronGeometry args={[1, 0]} />}
      {type === 'CRYSTAL' && <dodecahedronGeometry args={[0.8, 0]} />}
      {type === 'CANDY' && <cylinderGeometry args={[0.3, 0.3, 1, 8]} />}
      
      {type === 'PHOTO' ? (
        <meshStandardMaterial map={photoTexture} roughness={0.8} />
      ) : (
        <meshStandardMaterial roughness={0.15} metalness={0.95} />
      )}
    </instancedMesh>
  );
};

export default Ornaments;