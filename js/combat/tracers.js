// Line tracer effects for bullets.
import { G } from '../state.js';

export function createTracer(origin, direction, color) {
  const len = 8;
  const end = origin.clone().add(direction.clone().multiplyScalar(len));
  const points = [origin, end];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ 
    color: color, transparent: true, opacity: 0.8, linewidth: 2
  });
  const line = new THREE.Line(geometry, material);
  line.userData.levelObj = true;
  G.scene.add(line);
  
  // Fade and remove
  let opacity = 0.8;
  const fade = setInterval(() => {
    opacity -= 0.15;
    material.opacity = Math.max(0, opacity);
    if (opacity <= 0) {
      clearInterval(fade);
      G.scene.remove(line);
      geometry.dispose();
      material.dispose();
    }
  }, 30);
}
