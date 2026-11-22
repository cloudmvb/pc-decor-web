/* ============================================================================
   S25 // SKYCRUMB — THREE.JS WEBGL GPU ENGINE & GLB MATERIAL PIPELINE
   ============================================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { homeState, renderParams } from './state.js';
import { GROUPS_CONFIG } from './config.js';
import { THEME_PRESETS } from './theme.js';

// =========================================================================
// 4. REAL-TIME THREE.JS GPU STUDIO ENGINE & GLB ASSET PIPELINE
// =========================================================================
window._gpuPipelineMode = 'three-webgl';
window._isModelReady = false;
window._rendererDrawCount = 0;

const s25CoverEl = document.getElementById('s25Cover');
const s25CoverPercentEl = document.getElementById('s25CoverPercent');
const s25CoverBarEl = document.getElementById('s25CoverBar');
const s25CoverStatusEl = document.getElementById('s25CoverStatus');

export function dismissCoverLoader() {
  if (homeState.coverDismissed) return;
  homeState.coverDismissed = true;
  if (s25CoverPercentEl) s25CoverPercentEl.textContent = '100';
  if (s25CoverBarEl) s25CoverBarEl.style.width = '100%';
  if (s25CoverStatusEl) s25CoverStatusEl.textContent = 'READY // GPU 3D ENGINE';
  setTimeout(() => {
    if (s25CoverEl) s25CoverEl.classList.add('loaded');
  }, 150);
}

if (renderParams.get('p') !== null || renderParams.get('drawer') !== null) {
  homeState.coverDismissed = true;
  if (s25CoverEl) s25CoverEl.style.display = 'none';
}

export function isGroupUnlocked(groupId, p = homeState.scrollProgress) {
  const cfg = GROUPS_CONFIG[groupId];
  if (!cfg) return false;
  return p >= (cfg.unlockAt || 0.15);
}

export function isAllFullyDetached(p = homeState.scrollProgress) {
  return p >= 0.98;
}

export const compSpinAngle = {};
Object.keys(GROUPS_CONFIG).forEach((id) => { compSpinAngle[id] = 0; });


export function mark3DActive() {
  homeState.last3DInteractionAt = performance.now();
  homeState.force3DRedraw = true;
}

export const frameCanvas = document.getElementById('frameCanvas');
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(
  42,
  Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight)),
  0.2,
  40
);
camera.position.set(2.35, 1.45, 2.75);

export const overviewCamPos = new THREE.Vector3(2.35, 1.45, 2.75);
export const overviewTarget = new THREE.Vector3(0, 0.78, 0);
export const desiredCamPos = new THREE.Vector3(2.35, 1.45, 2.75);
export const desiredCamTarget = new THREE.Vector3(0, 0.78, 0);

export const renderer = new THREE.WebGLRenderer({
  canvas: frameCanvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = false;
renderer.setClearColor(0x000000, 0);
window._threeRenderer = renderer;

function createStudioEnvironment() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#334155');
  grad.addColorStop(0.25, '#1e293b');
  grad.addColorStop(0.55, '#0f172a');
  grad.addColorStop(1.0, '#050811');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);

  const sb1 = g.createRadialGradient(260, 80, 10, 260, 80, 170);
  sb1.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
  sb1.addColorStop(0.5, 'rgba(226, 232, 240, 0.45)');
  sb1.addColorStop(1, 'rgba(226, 232, 240, 0)');
  g.fillStyle = sb1;
  g.fillRect(60, 10, 400, 170);

  g.fillStyle = 'rgba(248, 250, 252, 0.90)';
  g.fillRect(560, 40, 200, 85);

  const sb3 = g.createLinearGradient(780, 110, 980, 260);
  sb3.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
  sb3.addColorStop(1, 'rgba(14, 165, 233, 0.0)');
  g.fillStyle = sb3;
  g.fillRect(780, 100, 200, 180);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

(function compileStudioEnv() {
  const rawEnv = createStudioEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = pmrem.fromEquirectangular(rawEnv).texture;
  rawEnv.dispose();
  pmrem.dispose();
})();

function generatePlanarUVs(geometry) {
  if (!geometry || !geometry.attributes?.position) return;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const pos = geometry.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  const axes = [
    { idx: 'x', len: size.x },
    { idx: 'y', len: size.y },
    { idx: 'z', len: size.z }
  ].sort((a, b) => b.len - a.len);
  const a0 = axes[0].idx;
  const a1 = axes[1].idx;
  const min0 = box.min[a0], span0 = Math.max(0.0001, size[a0]);
  const min1 = box.min[a1], span1 = Math.max(0.0001, size[a1]);
  for (let i = 0; i < pos.count; i++) {
    const v0 = a0 === 'x' ? pos.getX(i) : (a0 === 'y' ? pos.getY(i) : pos.getZ(i));
    const v1 = a1 === 'x' ? pos.getX(i) : (a1 === 'y' ? pos.getY(i) : pos.getZ(i));
    uvs[i * 2] = (v0 - min0) / span0;
    uvs[i * 2 + 1] = (v1 - min1) / span1;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

function createMoboPCBTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 2048;
  const g = c.getContext('2d');
  g.fillStyle = '#b0bdd0';
  g.fillRect(0, 0, 2048, 2048);

  g.fillStyle = '#9aa9be';
  for (let i = -2048; i < 4096; i += 160) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 58, 0);
    g.lineTo(i - 1400 + 58, 2048);
    g.lineTo(i - 1400, 2048);
    g.closePath();
    g.fill();
  }
  g.fillStyle = '#8293aa';
  g.fillRect(180, 180, 760, 720);
  g.fillRect(180, 1020, 1680, 840);

  g.strokeStyle = '#e2e8f0';
  g.lineWidth = 3.5;
  for (let grp = 0; grp < 16; grp++) {
    const startX = 110 + grp * 120;
    for (let lane = 0; lane < 7; lane++) {
      const x = startX + lane * 9;
      g.beginPath();
      g.moveTo(x, 60);
      g.lineTo(x, 620 + (grp % 3) * 130);
      g.lineTo(x + 85, 705 + (grp % 3) * 130);
      g.lineTo(x + 85, 1960);
      g.stroke();
    }
  }

  g.strokeStyle = '#cbd5e1';
  g.lineWidth = 3;
  for (let row = 0; row < 14; row++) {
    const y = 160 + row * 135;
    for (let t = 0; t < 5; t++) {
      g.beginPath();
      g.moveTo(80, y + t * 8);
      g.lineTo(860, y + t * 8);
      g.lineTo(930, y + t * 8 + 45);
      g.lineTo(1960, y + t * 8 + 45);
      g.stroke();
    }
  }

  for (let x = 120; x < 1940; x += 56) {
    for (let y = 120; y < 1940; y += 56) {
      if ((x + y) % 112 === 0) {
        g.fillStyle = '#1e293b';
        g.fillRect(x - 7, y - 4, 14, 8);
        g.fillStyle = '#f8fafc';
        g.fillRect(x - 9, y - 4, 3, 8);
        g.fillRect(x + 6, y - 4, 3, 8);
      } else {
        g.fillStyle = '#f59e0b';
        g.beginPath();
        g.arc(x, y, 3.8, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  g.strokeStyle = '#38bdf8';
  g.lineWidth = 4;
  g.strokeRect(190, 190, 740, 700);
  g.strokeRect(190, 1030, 1660, 820);
  g.fillStyle = '#e2e8f0';
  for (let k = 0; k < 8; k++) {
    g.fillRect(220 + k * 90, 1890, 55, 16);
    g.fillRect(1120 + k * 85, 290, 50, 16);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 4);
  return tex;
}

function createBrushedMetalTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#e8eef5';
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 2) {
    const v = 210 + ((y * 17) % 36);
    g.fillStyle = `rgb(${v}, ${v + 4}, ${v + 8})`;
    g.fillRect(0, y, 512, 1);
  }
  g.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  g.lineWidth = 3;
  for (let i = -512; i < 1024; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 512);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enableZoom = false;
controls.enablePan = false;
controls.minPolarAngle = 0.30;
controls.maxPolarAngle = Math.PI * 0.56;
controls.target.set(0, 0.78, 0);
controls.addEventListener('start', () => { homeState.m0IsDragging = true; mark3DActive(); });
controls.addEventListener('end', () => { homeState.m0IsDragging = false; mark3DActive(); });
controls.addEventListener('change', () => { homeState.force3DRedraw = true; });

const ambientLight = new THREE.AmbientLight(0xd0e0ff, 0.46);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 0.58);
scene.add(hemiLight);
const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.18);
keyLight.position.set(5, 7, 3);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xbbe6ff, 0.45);
fillLight.position.set(-5, 3, 2);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.6);
rimLight.position.set(-3, 4, -6);
scene.add(rimLight);
const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
frontLight.position.set(-1.5, 2.0, 4.0);
scene.add(frontLight);

export const deskGroup = new THREE.Group();
export const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x162238, roughness: 0.35, metalness: 0.05 });
const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 2.0), deskTopMat);
deskTop.position.set(0, -0.04, 0);
deskGroup.add(deskTop);

export const deskTrimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55 });
const deskTrim = new THREE.Mesh(new THREE.BoxGeometry(3.62, 0.04, 2.02), deskTrimMat);
deskTrim.position.set(0, -0.09, 0);
deskGroup.add(deskTrim);

const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = 256;
shadowCanvas.height = 256;
const sCtx = shadowCanvas.getContext('2d');
const sGrad = sCtx.createRadialGradient(128, 128, 15, 128, 128, 120);
sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
sGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
sCtx.fillStyle = sGrad;
sCtx.fillRect(0, 0, 256, 256);
const shadowTex = new THREE.CanvasTexture(shadowCanvas);
export const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.85, depthWrite: false });
const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.45), shadowMat);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.set(0.02, 0.001, 0.02);
deskGroup.add(contactShadow);
scene.add(deskGroup);

// Concentric anti-gravity holo rings beneath rising Case
export const levGroup = new THREE.Group();
levGroup.name = 'Levitation_Ascension_Stage';
[0.68, 1.05, 1.48, 1.98, 2.55, 3.25].forEach((r, idx) => {
  const rGeo = new THREE.RingGeometry(r, r + (idx % 2 === 0 ? 0.020 : 0.011), 96);
  rGeo.rotateX(-Math.PI / 2);
  const rMat = new THREE.MeshBasicMaterial({
    color: idx % 2 === 0 ? 0x38bdf8 : 0x818cf8,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  rMat.userData = { baseOp: 0.36 - idx * 0.048, baseY: -0.02 - idx * 0.22 };
  const rMesh = new THREE.Mesh(rGeo, rMat);
  rMesh.position.y = rMat.userData.baseY;
  levGroup.add(rMesh);
});
scene.add(levGroup);

window._applyStudioTheme = (themeName) => {
  const preset = THEME_PRESETS[themeName] || THEME_PRESETS.sky;
  deskTopMat.color.setHex(preset.deskColor);
  deskTrimMat.color.setHex(preset.deskTrimColor);
  ambientLight.color.setHex(preset.ambientColor);
  ambientLight.intensity = preset.ambientIntensity;
  keyLight.intensity = preset.keyIntensity;
  renderer.toneMappingExposure = preset.exposure;
  homeState.force3DRedraw = true;
};

function resizeFrameCanvas() {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const aspect = vw / vh;
  const dpr = Math.min(window.devicePixelRatio || 1, vw < 760 ? 1.25 : 1.5);
  camera.aspect = aspect;
  camera.fov = aspect < 1.35 ? Math.min(54, 42 * (1.35 / Math.max(0.68, aspect))) : 42;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(vw, vh, false);
  homeState.force3DRedraw = true;
}
window.addEventListener('resize', resizeFrameCanvas);
resizeFrameCanvas();

export const pcRoot = new THREE.Group();
scene.add(pcRoot);

export const groupNodes = {};
export const groupInitialPos = {};
export const groupInitialRot = {};
export const groupInitialQuat = {};
export const groupBoxAnchors = {};
export const groupSubAnchors = {};
export const groupFocusCenterLocal = {};
export const subNodes = [];
export const glassPanels = [];
export const fadeMeshes = [];
export const raycastMeshes = [];

export const SUB_EXPLODE_MAP = {
  'Case_SideFan_1': { deltaPos: new THREE.Vector3(0.06, 0.00, 0.04) },
  'Case_SideFan_2': { deltaPos: new THREE.Vector3(0.06, 0.00, 0.04) },
  'Case_SideFan_3': { deltaPos: new THREE.Vector3(0.06, 0.00, 0.04) },
  'Case_BottomFan_1': { deltaPos: new THREE.Vector3(0.05, 0.38, -0.06) },
  'Case_BottomFan_2': { deltaPos: new THREE.Vector3(0.05, 0.38, -0.06) },
  'Case_BottomFan_3': { deltaPos: new THREE.Vector3(0.05, 0.38, -0.06) },
  'Case_RearFan': { deltaPos: new THREE.Vector3(-0.04, 0.00, 0.04) },
  'AIO_Logic_RearFanPads': { deltaPos: new THREE.Vector3(-0.04, 0.00, 0.04) },
  'Bear_A_': { deltaPos: new THREE.Vector3(-0.06, 0.04, 0.00) },
  'Bear_B_': { deltaPos: new THREE.Vector3(-0.02, 0.12, 0.05) },
  'Bear_C_': { deltaPos: new THREE.Vector3(0.02, 0.05, 0.00) },
  'Bear_D_': { deltaPos: new THREE.Vector3(0.06, -0.08, 0.00) },
  'CloudHook_': { deltaPos: new THREE.Vector3(-0.04, 0.43, 0.70) },
  'Acc2_': { deltaPos: new THREE.Vector3(-0.04, 0.43, 0.70) },
  'RAM_1_Root': { deltaPos: new THREE.Vector3(0.026, 0.085, 0.02) },
  'RAM_2_Root': { deltaPos: new THREE.Vector3(-0.026, -0.085, -0.02) },
  'SSD_NVMe1_Root': { deltaPos: new THREE.Vector3(0.00, -0.02, 0.08) },
  'SSD_NVMe2_Root': { deltaPos: new THREE.Vector3(0.00, 0.00, 0.08) },
  'SSD_SATA_Root': { deltaPos: new THREE.Vector3(-0.50, 0.02, 0.08) },
  'GPU_Fan': { deltaPos: new THREE.Vector3(0.00, 0.02, 0.04) },
  'GPU_Shroud': { deltaPos: new THREE.Vector3(0.00, 0.01, 0.02) },
  'GPU_Backplate': { deltaPos: new THREE.Vector3(0.00, -0.01, -0.02) },
  'Cable_24Pin': { deltaPos: new THREE.Vector3(0.10, -0.04, 0.08) },
  'Cable_12VHPWR': { deltaPos: new THREE.Vector3(0.18, -0.02, 0.04) },
  'Cable_EPS': { deltaPos: new THREE.Vector3(0.14, -0.32, 0.18) },
  'Cable_PCIeRiser': { deltaPos: new THREE.Vector3(0.02, 0.14, 0.06) },
  'PSU_Fan': { deltaPos: new THREE.Vector3(0.00, 0.00, 0.00) },
  'PSU_Grille': { deltaPos: new THREE.Vector3(0.00, 0.00, 0.00) }
};

function createStudioMaterials() {
  const moboPcbTex = createMoboPCBTexture();
  const brushedTex = createBrushedMetalTexture();
  return {
    moboPcbTex,
    brushedTex,
    glassMain: new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe, transparent: true, opacity: 0.15, roughness: 0.03,
      metalness: 0.10, transmission: 0, ior: 1.52, reflectivity: 0.92,
      clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 2.4,
      side: THREE.FrontSide, depthWrite: false
    }),
    glassSeam: new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc, emissive: 0x0284c7, emissiveIntensity: 0.18,
      transparent: true, opacity: 0.48, roughness: 0.05, metalness: 0.20,
      side: THREE.FrontSide, depthWrite: false
    }),
    floorWell: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide }),
    floorLouvers: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.28, metalness: 0.25, side: THREE.DoubleSide }),
    grommet: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75, metalness: 0.08, side: THREE.DoubleSide }),
    grommetSlit: new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.88, metalness: 0.05, side: THREE.DoubleSide }),
    rearGunmetal: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.26, metalness: 0.78, side: THREE.DoubleSide }),
    rearDark: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.50, metalness: 0.45, side: THREE.DoubleSide }),
    chromeScrew: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.14, metalness: 0.94, side: THREE.DoubleSide }),
    brassStandoff: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.16, metalness: 0.96, side: THREE.DoubleSide }),
    frontIOBezel: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.72, side: THREE.DoubleSide }),
    frontIOPwr: new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 2.5 }),
    usbTng: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.2 }),
    frontIOVoid: new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 }),
    sideChamber: new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, roughness: 0.34, metalness: 0.18,
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2, side: THREE.DoubleSide
    }),
    greyFilter: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.60, metalness: 0.35, side: THREE.DoubleSide }),
    sideFanInner: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide }),
    sideFanSilver: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.65, side: THREE.DoubleSide }),
    meshFrameWhite: new THREE.MeshStandardMaterial({ color: 0xdbe4f0, roughness: 0.30, metalness: 0.20, side: THREE.DoubleSide }),
    moboTray: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.34, metalness: 0.20, side: THREE.DoubleSide }),
    chassisWhite: new THREE.MeshStandardMaterial({
      color: 0xf8fafc, emissive: 0xe0f2fe, emissiveIntensity: 0.12,
      roughness: 0.30, metalness: 0.08, side: THREE.DoubleSide
    }),
    psuFrontWall: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.12, side: THREE.DoubleSide }),
    psuDarkWell: new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.70, metalness: 0.15, side: THREE.DoubleSide }),
    psuStep: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.40, metalness: 0.45, side: THREE.DoubleSide }),
    psuBlades: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, emissive: 0x38bdf8, emissiveIntensity: 0.14,
      roughness: 0.22, metalness: 0.48, side: THREE.DoubleSide
    }),
    psuHub: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.16, metalness: 0.85, side: THREE.DoubleSide }),
    psuHubGroove: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85, roughness: 0.15, side: THREE.DoubleSide }),
    psuGrilleWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.88, side: THREE.DoubleSide }),
    moboPcb: new THREE.MeshStandardMaterial({
      map: moboPcbTex, bumpMap: moboPcbTex, bumpScale: 0.004,
      color: 0xe2e8f0, roughness: 0.34, metalness: 0.22, side: THREE.DoubleSide
    }),
    moboCopper: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.22, metalness: 0.92 }),
    moboBrushedWhite: new THREE.MeshStandardMaterial({
      map: brushedTex, bumpMap: brushedTex, bumpScale: 0.003,
      color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 0.06,
      roughness: 0.18, metalness: 0.55, envMapIntensity: 1.9, side: THREE.DoubleSide
    }),
    moboSilverBody: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.20, metalness: 0.85, envMapIntensity: 1.9, side: THREE.DoubleSide }),
    moboDiagDark: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.28, metalness: 0.85, side: THREE.DoubleSide }),
    moboCyanLight: new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 2.4, roughness: 0.1 }),
    moboCyanText: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85, roughness: 0.12, metalness: 0.92 }),
    moboChokes: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.26, metalness: 0.78 }),
    moboChokeTops: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.14, metalness: 0.94 }),
    moboChromeSocket: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.12, metalness: 0.96, envMapIntensity: 2.2 }),
    moboGold: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.16, metalness: 0.96 }),
    moboDebugRed: new THREE.MeshStandardMaterial({ color: 0xff453a, emissive: 0xff3b30, emissiveIntensity: 2.6 }),
    moboDarkDetail: new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.42, metalness: 0.35 }),
    gpuBlades: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.22, metalness: 0.72 }),
    gpuBarrier: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.16, metalness: 0.92 }),
    gpuStripe: new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 1.8 }),
    argbCyan: new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 1.75, roughness: 0.15 }),
    argbPurple: new THREE.MeshStandardMaterial({ color: 0xf5d0fe, emissive: 0xc084fc, emissiveIntensity: 1.75, roughness: 0.15 }),
    cpuIHS: new THREE.MeshStandardMaterial({ color: 0xefefef, metalness: 0.70, roughness: 0.22, envMapIntensity: 2.2 }),
    cpuLaser: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5, metalness: 0.1 }),
    cpuPcb: new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.35, metalness: 0.15 })
  };
}

function applyStudioMaterials(model) {
  const M = createStudioMaterials();
  const flatNormalNames = new Set([
    'Case_SideChamber_DuctAndRails', 'Case_SideFan_MountingWall',
    'Case_Top_FilterFrame', 'Case_Top_VentGrid', 'Case_Motherboard_Tray',
    'Case_CPU_WindowLip', 'Case_Bottom_Plinth', 'Case_Top_RoofDeck',
    'Case_Rear_StructuralFrame', 'Case_Rear_UnibodyWall', 'Case_Right_SteelDoor',
    'PSU_Fan_ScimitarBlades'
  ]);

  model.traverse((child) => {
    if (GROUPS_CONFIG[child.name]) {
      groupNodes[child.name] = child;
      groupInitialPos[child.name] = child.position.clone();
      groupInitialRot[child.name] = child.rotation.clone();
      groupInitialQuat[child.name] = child.quaternion.clone();
    }
    for (const prefix in SUB_EXPLODE_MAP) {
      if (child.name === prefix || child.name.startsWith(prefix)) {
        let isChildOfSubNode = false;
        let curr = child.parent;
        while (curr && curr !== model) {
          if (subNodes.some((s) => s.node === curr)) { isChildOfSubNode = true; break; }
          curr = curr.parent;
        }
        if (!isChildOfSubNode) {
          subNodes.push({
            node: child,
            cfg: SUB_EXPLODE_MAP[prefix],
            initPos: child.position.clone(),
            initQuat: child.quaternion.clone()
          });
        }
        break;
      }
    }
    if (!child.isMesh) return;
    const n = child.name || '';
    if (n.startsWith('Case_') && child.material) child.material.side = THREE.DoubleSide;

    if ((flatNormalNames.has(n) || n.startsWith('Case_Right_MeshFrame')) && child.geometry) {
      child.geometry = child.geometry.toNonIndexed();
      child.geometry.computeVertexNormals();
    }

    if (n === 'Case_Glass_Front' || n === 'Case_Glass_Side' || n === 'Case_Glass_Corner45') {
      child.material = M.glassMain.clone();
      child.renderOrder = 10;
    } else if (n === 'Case_Glass_WhiteBezels') {
      child.visible = false;
    } else if (n.startsWith('Case_Glass_Seam')) {
      child.material = M.glassSeam.clone();
      child.renderOrder = 11;
    } else if (n === 'Case_Floor_VentWell') {
      child.material = M.floorWell;
    } else if (n === 'Case_Floor_Louvers') {
      child.material = M.floorLouvers;
    } else if (n === 'Case_Rubber_Grommets') {
      child.material = M.grommet;
    } else if (n === 'Case_Rubber_GrommetSlits') {
      child.material = M.grommetSlit;
    } else if (n === 'Case_Rear_FanHexGrille' || n === 'Case_Rear_HorizPCIeBrackets' || n === 'Case_Rear_VertPCIeBrackets' || n === 'Case_Rear_VertClampBar' || n === 'Case_Internal_VertGPUMount') {
      child.material = M.rearGunmetal;
    } else if (n === 'Case_Rear_HorizPCIeSlits' || n === 'Case_Rear_VertPCIeSlits' || n === 'Case_Rear_VertProngPockets' || n === 'Case_Rear_MoboIOBezel' || n === 'Case_Rear_PSUBayBezel') {
      child.material = M.rearDark;
    } else if (n === 'Case_Rear_CaptiveThumbscrews' || n === 'Case_Rear_FanMountScrews' || n === 'Case_Rear_HorizPCIeScrews') {
      child.material = M.chromeScrew;
    } else if (n === 'Case_MB_BrassStandoffs') {
      child.material = M.brassStandoff;
    } else if (n === 'Case_FrontIO_Bezel') {
      child.material = M.frontIOBezel;
    } else if (n === 'Case_FrontIO_PwrGlow') {
      child.material = M.frontIOPwr;
    } else if (n.startsWith('Case_FrontIO_USB') && n.endsWith('_Tng')) {
      child.material = M.usbTng;
    } else if (n.startsWith('Case_FrontIO_') && (n.endsWith('_Cav') || n.endsWith('Void'))) {
      child.material = M.frontIOVoid;
    } else if (n === 'Case_SideChamber_DuctAndRails' || n === 'Case_SideFan_MountingWall') {
      child.material = M.sideChamber;
    } else if (n.startsWith('Case_Right_GreyFilter') || n === 'Case_Top_FilterMesh') {
      child.material = M.greyFilter;
    } else if (n.startsWith('Case_Right_SideFanInner')) {
      child.material = M.sideFanInner;
    } else if (n.startsWith('Case_Right_PSUFanRing') || n.startsWith('Case_Right_SideFan')) {
      child.material = M.sideFanSilver;
    } else if (n.startsWith('Case_Right_MeshFrame') || n === 'Case_Top_FilterFrame' || n === 'Case_Top_VentGrid') {
      child.material = M.meshFrameWhite;
    } else if (n === 'Case_Motherboard_Tray' || n === 'Case_CPU_WindowLip') {
      child.material = M.moboTray;
    } else if (n === 'Case_Bottom_Plinth' || n === 'Case_Top_RoofDeck' || n === 'Case_Rear_StructuralFrame' || n === 'Case_Rear_UnibodyWall' || n === 'Case_Right_SteelDoor') {
      child.material = M.chassisWhite;
    } else if (n === 'PSU_Front_FanWall') {
      child.material = M.psuFrontWall;
    } else if (n.startsWith('PSU_Fan_') || n.startsWith('PSU_Grille_')) {
      if (n === 'PSU_Fan_DarkWell') child.position.z -= 0.0205;
      else if (n === 'PSU_Fan_InnerShroudStep') child.position.z -= 0.0165;
      else if (n === 'PSU_Fan_ScimitarBlades' || n === 'PSU_Fan_Hub' || n === 'PSU_Fan_CenterCap' || n.startsWith('PSU_Fan_HubGroove_')) child.position.z -= 0.0065;
      else child.position.z -= 0.0030;

      if (n === 'PSU_Fan_DarkWell') child.material = M.psuDarkWell;
      else if (n === 'PSU_Fan_InnerShroudStep') child.material = M.psuStep;
      else if (n === 'PSU_Fan_ScimitarBlades') child.material = M.psuBlades;
      else if (n === 'PSU_Fan_Hub' || n === 'PSU_Fan_CenterCap') child.material = M.psuHub;
      else if (n.startsWith('PSU_Fan_HubGroove_')) child.material = M.psuHubGroove;
      else if (n.startsWith('PSU_Grille_') || n === 'PSU_Fan_BezelRing' || n === 'PSU_Fan_OuterShroudRim' || n.startsWith('PSU_Fan_Screw')) child.material = M.psuGrilleWhite;
    } else if (n === 'Mobo_PCB_FrontWhite' || n === 'Mobo_PCB_BackWhite') {
      generatePlanarUVs(child.geometry);
      child.material = M.moboPcb;
    } else if (n === 'Mobo_PCB_CopperCore') {
      child.material = M.moboCopper;
    } else if (n === 'Mobo_VRM_LeftWhiteHood' || n === 'Mobo_VRM_TopCap' || n.startsWith('Mobo_M2_ArmorPlate_') || n === 'Mobo_PCH_WhiteUpper' || n === 'Mobo_Audio_EMIShield' || n === 'Mobo_24Pin_Armor') {
      generatePlanarUVs(child.geometry);
      child.material = M.moboBrushedWhite;
    } else if (n === 'Mobo_VRM_LeftSilverFlank' || n === 'Mobo_VRM_LeftBaseTower' || n === 'Mobo_VRM_TopBase' || n === 'Mobo_PCH_HeatsinkBase' || n === 'Mobo_RearIO_ShieldPlate' || n === 'Mobo_RearIO_CanTower' || n === 'Mobo_Back_AluminumArmor' || n === 'Mobo_Back_LGA1700_Plate') {
      child.material = M.moboSilverBody;
    } else if (n === 'Mobo_VRM_LeftDiagSlots' || n === 'Mobo_VRM_TopGrooves' || n === 'Mobo_M2_ArmorDiagGrooves') {
      child.material = M.moboDiagDark;
    } else if (n.startsWith('Mobo_VRM_CyanLight') || n.startsWith('Mobo_PCH_CyanRibbon') || n === 'Mobo_VRM_TopCyanAccent') {
      child.material = M.moboCyanLight;
    } else if (n === 'Mobo_VRM_TxtZ790' || n === 'Mobo_PCH_TxtZ790' || n === 'Mobo_Audio_TxtSupreme') {
      child.material = M.moboCyanText;
    } else if (n === 'Mobo_VRM_Chokes' || n === 'Mobo_VRM_DrMOS') {
      child.material = M.moboChokes;
    } else if (n === 'Mobo_VRM_ChokeTops' || n === 'Mobo_VRM_CapBodies' || n === 'Mobo_VRM_CapTops' || n === 'Mobo_CMOS_Coin') {
      child.material = M.moboChokeTops;
    } else if (n === 'Mobo_Socket_ILM_Frame' || n === 'Mobo_Socket_LoadLever' || n === 'Mobo_Socket_TorxAndPosts' || n === 'Mobo_PCIe_SafeSlotChrome' || n === 'Mobo_DIMM_ShellsSilv') {
      child.material = M.moboChromeSocket;
    } else if (n.startsWith('Mobo_Socket_GoldMatrix') || n.includes('Gold') || n.startsWith('Mobo_Mount_RosettePads') || n.startsWith('Mobo_MountRing_') || n.startsWith('Mobo_CoolerMountPad_')) {
      child.material = M.moboGold;
    } else if (n === 'Mobo_Debug_TxtA0') {
      child.material = M.moboDebugRed;
    } else if (n === 'Mobo_Debug_Screen' || n.includes('Trenches') || n.includes('Cavities') || n.includes('Dark') || n.includes('Socket_Housing')) {
      child.material = M.moboDarkDetail;
    } else if (n.startsWith('GPU_FanBlades_')) {
      child.material = M.gpuBlades;
    } else if (n.startsWith('GPU_FanBarrierRing_')) {
      child.material = M.gpuBarrier;
    } else if (n === 'GPU_Back_CyanDiagStripe') {
      child.material = M.gpuStripe;
    } else if (n.includes('ARGBRing') || n.startsWith('AIO_Pump_RainbowHalo') || n === 'AIO_Logic_FanEdgeARGB' || n.includes('_Strimer_Ch_') || n === 'SSD_NVMe1_HS_CyanLightBar' || n.includes('_LED_')) {
      const isAlt = n.endsWith('_2') || n.endsWith('_4') || n.endsWith('_6') || n.endsWith('_L');
      child.material = isAlt ? M.argbPurple : M.argbCyan;
    } else if (n.startsWith('CPU_IHS')) {
      child.material = M.cpuIHS;
    } else if (n.startsWith('CPU_Txt') || n.startsWith('CPU_Laser')) {
      child.material = M.cpuLaser;
    } else if (n.startsWith('CPU_PCB')) {
      child.material = M.cpuPcb;
    } else if (n.startsWith('CPU_Top_Gold') || n.startsWith('CPU_Pin1') || n.startsWith('CPU_LGA1700_GoldPads')) {
      child.material = M.moboGold;
    }
  });

  const casePanoramicRoot = model.getObjectByName('Case_Panoramic_Root') || groupNodes['Group_Case'];
  if (casePanoramicRoot) {
    const frontRightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.240, 0.326), M.chassisWhite);
    frontRightPillar.name = 'Case_FrontRight_SolidPillar';
    frontRightPillar.position.set(0.673, 0.760, -0.307);
    casePanoramicRoot.add(frontRightPillar);

    const cornerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.240, 0.018), M.chassisWhite);
    cornerTrim.name = 'Case_FrontRight_CornerTrim';
    cornerTrim.position.set(0.673, 0.760, -0.461);
    casePanoramicRoot.add(cornerTrim);

    const matTrayBacking = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.55, metalness: 0.18, side: THREE.DoubleSide });
    const cpuBackPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.008), matTrayBacking);
    cpuBackPlate.name = 'Case_CPU_Cutout_BackingPlate';
    cpuBackPlate.position.set(-0.31, 0.935, -0.232);
    casePanoramicRoot.add(cpuBackPlate);

    const sideFanWellBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.08, 0.008), matTrayBacking);
    sideFanWellBack.name = 'Case_SideFan_WellBacking';
    sideFanWellBack.position.set(0.38, 0.78, -0.240);
    casePanoramicRoot.add(sideFanWellBack);

    const matGlassTrim = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.28, metalness: 0.65, side: THREE.DoubleSide });
    const sideTopBand = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.028, 0.014), matGlassTrim.clone());
    sideTopBand.name = 'Case_Glass_SideTopBand';
    sideTopBand.position.set(-0.13, 1.368, 0.466);
    casePanoramicRoot.add(sideTopBand);

    const sideBotBand = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.028, 0.014), matGlassTrim.clone());
    sideBotBand.name = 'Case_Glass_SideBotBand';
    sideBotBand.position.set(-0.13, 0.152, 0.466);
    casePanoramicRoot.add(sideBotBand);

    const matAquaEdge = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc, emissive: 0x0284c7, emissiveIntensity: 0.32,
      transparent: true, opacity: 0.62, roughness: 0.05, metalness: 0.20,
      side: THREE.DoubleSide, depthWrite: false
    });
    const sideLeftEdge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.22, 0.014), matAquaEdge.clone());
    sideLeftEdge.name = 'Case_Glass_SideLeftEdge';
    sideLeftEdge.position.set(-0.675, 0.760, 0.466);
    casePanoramicRoot.add(sideLeftEdge);

    const frontTopBand = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 0.52), matGlassTrim.clone());
    frontTopBand.name = 'Case_Glass_FrontTopBand';
    frontTopBand.position.set(0.676, 1.368, -0.05);
    casePanoramicRoot.add(frontTopBand);

    const frontBotBand = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 0.52), matGlassTrim.clone());
    frontBotBand.name = 'Case_Glass_FrontBotBand';
    frontBotBand.position.set(0.676, 0.152, -0.05);
    casePanoramicRoot.add(frontBotBand);

    const frontRightEdge = new THREE.Mesh(new THREE.BoxGeometry(0.014, 1.22, 0.012), matAquaEdge.clone());
    frontRightEdge.name = 'Case_Glass_FrontRightEdge';
    frontRightEdge.position.set(0.676, 0.760, -0.308);
    casePanoramicRoot.add(frontRightEdge);
  }

  const caseGroup = groupNodes['Group_Case'] || casePanoramicRoot;
  if (caseGroup && !model.getObjectByName('Case_Right_SteelDoor')) {
    const backWallGroup = new THREE.Group();
    backWallGroup.name = 'Case_BackWall_Reconstructed';
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.24, 0.016), M.chassisWhite);
    wallMesh.position.set(0.015, 0.765, -0.456);
    backWallGroup.add(wallMesh);
    const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.94, 0.020), M.sideFanSilver);
    sideFrame.position.set(0.380, 0.765, -0.456);
    backWallGroup.add(sideFrame);
    const sideMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.90, 0.022), M.greyFilter);
    sideMesh.position.set(0.380, 0.765, -0.456);
    backWallGroup.add(sideMesh);
    const psuFrame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.020), M.sideFanSilver);
    psuFrame.position.set(-0.380, 0.340, -0.456);
    backWallGroup.add(psuFrame);
    const psuMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.022), M.greyFilter);
    psuMesh.position.set(-0.380, 0.340, -0.456);
    backWallGroup.add(psuMesh);
    const screwGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.022, 16);
    screwGeo.rotateX(Math.PI / 2);
    for (const [sx, sy] of [[-0.640, 1.340], [0.670, 1.340], [-0.640, 0.190], [0.670, 0.190]]) {
      const screw = new THREE.Mesh(screwGeo, M.chromeScrew);
      screw.position.set(sx, sy, -0.465);
      backWallGroup.add(screw);
    }
    caseGroup.add(backWallGroup);
  }

  // Build glassPanels, fadeMeshes, raycastMeshes & group box anchors once
  const cableFadePatterns = ['Paracord', 'SenseWires', 'PSU_Plug', 'FrontIO', 'BotHeaders', 'RearChamber', 'SATA', 'FloorRouting'];
  const fanFadePrefixes = ['Case_SideFan_1', 'Case_SideFan_2', 'Case_SideFan_3', 'Case_RearFan', 'AIO_Logic_RearFanPads', 'AIO_Logic_FanEdgeARGB', 'AIO_Logic_FanStatorStruts'];

  model.traverse((c) => {
    if (!c.isMesh) return;
    const n = c.name || '';
    if (c.geometry && !c.geometry.boundingBox) c.geometry.computeBoundingBox();

    let gpDir = null;
    if (n === 'Case_Glass_Side' || n === 'Case_Glass_SideTopBand' || n === 'Case_Glass_SideBotBand' || n === 'Case_Glass_SideLeftEdge') {
      gpDir = new THREE.Vector3(-0.22, -0.03, 0.82);
    } else if (n === 'Case_Glass_Corner45' || n.startsWith('Case_Glass_Seam')) {
      gpDir = new THREE.Vector3(0.62, -0.03, 0.62);
    } else if (n === 'Case_Glass_Front' || n === 'Case_Glass_FrontTopBand' || n === 'Case_Glass_FrontBotBand' || n === 'Case_Glass_FrontRightEdge') {
      gpDir = new THREE.Vector3(0.82, -0.03, 0.22);
    }
    if (gpDir) {
      c.material = c.material.clone();
      const baseOp = (n === 'Case_Glass_Side' || n === 'Case_Glass_Corner45' || n === 'Case_Glass_Front')
        ? 0.22
        : (c.material.opacity !== undefined ? c.material.opacity : 1.0);
      glassPanels.push({ mesh: c, initPos: c.position.clone(), slideVec: gpDir, baseOpacity: baseOp });
    }

    const isExtraFan = fanFadePrefixes.some((pre) => n === pre || n.startsWith(pre)) || (!n.startsWith('PSU_') && !n.startsWith('Case_BottomFan_') && n.includes('Fan') && n.includes('Screw'));
    const isExtraCable = n.startsWith('Cable_') && cableFadePatterns.some((pat) => n.includes(pat));
    if (isExtraFan || isExtraCable) {
      c.material = c.material.clone();
      c.userData.baseOpacity = c.material.opacity !== undefined ? c.material.opacity : 1.0;
      fadeMeshes.push(c);
    }
  });

  const getAccClusterKey = (name) => {
    const bearMatch = name.match(/^(Bear_[A-D])_/);
    if (bearMatch) return bearMatch[1];
    if (name.startsWith('CloudHook_') || name.startsWith('Acc2_')) return 'CloudHook';
    return name;
  };

  Object.keys(GROUPS_CONFIG).forEach((id) => {
    const node = groupNodes[id];
    if (!node) return;
    node.updateMatrixWorld(true);

    const anchors = [];
    const clusterMap = id === 'Group_Accessories' ? new Map() : null;
    node.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      let gIdFound = null;
      let pCur = m;
      while (pCur && pCur !== model) {
        if (GROUPS_CONFIG[pCur.name]) { gIdFound = pCur.name; break; }
        pCur = pCur.parent;
      }
      if (gIdFound === id) {
        m.userData.groupId = id;
        raycastMeshes.push(m);
        anchors.push(m);
        if (clusterMap) {
          const ck = getAccClusterKey(m.name || '');
          let list = clusterMap.get(ck);
          if (!list) { list = []; clusterMap.set(ck, list); }
          list.push(m);
        }
      }
    });
    groupBoxAnchors[id] = anchors;
    if (clusterMap) groupSubAnchors[id] = Array.from(clusterMap.values());

    if (id === 'Group_Accessories' && anchors.length) {
      // Compute focus/spin pivot using each sub-item's unlocked (p >= 0.15) position so
      // hover spin rotates the decor set in place instead of orbiting around the p=0 CloudHook.
      const nodeInvMat = new THREE.Matrix4().copy(node.matrixWorld).invert();
      const meshToNodeMat = new THREE.Matrix4();
      const tmpBox = new THREE.Box3();
      const deployedLocalBox = new THREE.Box3();
      for (const m of anchors) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        meshToNodeMat.multiplyMatrices(nodeInvMat, m.matrixWorld);
        tmpBox.copy(m.geometry.boundingBox).applyMatrix4(meshToNodeMat);
        let cur = m;
        while (cur && cur !== node) {
          const sub = subNodes.find((s) => s.node === cur);
          if (sub) {
            tmpBox.translate(sub.cfg.deltaPos);
            break;
          }
          cur = cur.parent;
        }
        deployedLocalBox.union(tmpBox);
      }
      groupFocusCenterLocal[id] = deployedLocalBox.isEmpty()
        ? node.worldToLocal(new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()))
        : deployedLocalBox.getCenter(new THREE.Vector3());
    } else {
      const fullBox = new THREE.Box3().setFromObject(node);
      const centerWorld = fullBox.getCenter(new THREE.Vector3());
      groupFocusCenterLocal[id] = node.worldToLocal(centerWorld);
    }
  });
}

export function initStudioLoader(onModelLoaded) {
  const glbLoader = new GLTFLoader();
  const glbModelPath = renderParams.get('model') || './assets/models/pc-build.glb';
  glbLoader.load(
    glbModelPath,
    (gltf) => {
      const model = gltf.scene;
      homeState.modelScene = model;
      pcRoot.add(model);
      applyStudioMaterials(model);

      const spinParam = renderParams.get('m0spin');
      if (spinParam !== null) {
        const az = (parseFloat(spinParam) / 432) * Math.PI * 2;
        const r = Math.hypot(2.35, 2.75);
        const baseAz = Math.atan2(2.35, 2.75) + az;
        camera.position.set(Math.sin(baseAz) * r, 1.45, Math.cos(baseAz) * r);
        controls.update();
      }

      window._isModelReady = true;
      if (typeof onModelLoaded === 'function') {
        onModelLoaded();
      }
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
      window._rendererDrawCount++;
      homeState.force3DRedraw = true;
      dismissCoverLoader();
    },
    (event) => {
      if (homeState.coverDismissed) return;
      const total = event.total || 29420000;
      const pct = Math.min(98, Math.max(2, Math.round((event.loaded / total) * 98)));
      if (s25CoverPercentEl) s25CoverPercentEl.textContent = String(pct).padStart(2, '0');
      if (s25CoverBarEl) s25CoverBarEl.style.width = `${pct}%`;
    },
    (err) => {
      console.error('GLB loading error:', err);
      if (s25CoverStatusEl) s25CoverStatusEl.textContent = '3D MODEL LOAD ERROR';
      dismissCoverLoader();
    }
  );
}
