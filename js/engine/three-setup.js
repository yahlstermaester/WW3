// Three.js scene, camera, renderer, lights setup.
import { G } from '../state.js';

export function initThree() {
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x6a5a48);
  G.scene.fog = new THREE.FogExp2(0x6a5a48, 0.012);
  
  G.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  G.camera.position.set(0, 1.7, 0);
  
  G.renderer = new THREE.WebGLRenderer({ antialias: true });
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  G.renderer.shadowMap.enabled = true;
  document.body.appendChild(G.renderer.domElement);
  
  G.clock = new THREE.Clock();
  
  // Lights
  const ambient = new THREE.AmbientLight(0xccbb99, 1.2);
  G.scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.4);
  dirLight.position.set(20, 30, 10);
  dirLight.castShadow = true;
  G.scene.add(dirLight);
  const hemi = new THREE.HemisphereLight(0xccb898, 0x886644, 0.8);
  G.scene.add(hemi);
  
  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
