/* ============================================================================
   S25 // SKYCRUMB — 6-STOP SCROLLYTELLING, WAVE EXPLOSION & CAMERA CHOREOGRAPHY
   ============================================================================ */

import * as THREE from 'three';
import { homeState, renderParams } from './state.js';
import { GROUPS_CONFIG } from './config.js';
import {
  isGroupUnlocked,
  isAllFullyDetached,
  compSpinAngle,
  mark3DActive,
  scene,
  camera,
  overviewCamPos,
  overviewTarget,
  desiredCamPos,
  desiredCamTarget,
  renderer,
  controls,
  deskGroup,
  deskTopMat,
  deskTrimMat,
  shadowMat,
  levGroup,
  pcRoot,
  groupNodes,
  groupInitialPos,
  groupInitialRot,
  groupBoxAnchors,
  groupSubAnchors,
  groupFocusCenterLocal,
  subNodes,
  glassPanels,
  fadeMeshes
} from './studio-engine.js';

let scrollScrubUpdater = null;
export function registerScrollScrubUpdater(fn) {
  scrollScrubUpdater = typeof fn === 'function' ? fn : null;
}

// =========================================================================
// 5. 6-STOP SCROLLYTELLING, 6-WAVE GPU EXTRACTION & 60FPS RENDER ENGINE
// =========================================================================
export const SCROLL_STOPS = [0.00, 0.16, 0.33, 0.50, 0.67, 0.84, 1.00];
window.focusedGroupId = null;


const smootherstep = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
};

export const currentGroupScreenPos = {};
const scrollDeckEl = document.querySelector('.scroll-snap-deck');
const stageSlideLayers = [
  document.getElementById('viewport-container'),
  document.querySelector('.studio-spotlight-layer')
].filter(Boolean);

export function getStageScrollMax() {
  return Math.max(1, (scrollDeckEl ? scrollDeckEl.offsetHeight : window.innerHeight * 7) - window.innerHeight);
}
window.getStageScrollMax = getStageScrollMax;

const tbLogoEl = document.getElementById('tbLogo');
function outroTweenTo(targetY, dur) {
  const startY = window.scrollY;
  const t0 = performance.now();
  const token = ++homeState.outroTweenToken;
  homeState.outroTweenActive = true;
  const step = (now) => {
    if (token !== homeState.outroTweenToken) return;
    const u = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - u, 3);
    window.scrollTo(0, startY + (targetY - startY) * e);
    if (u < 1) requestAnimationFrame(step);
    else homeState.outroTweenActive = false;
  };
  requestAnimationFrame(step);
}

export function updateStageVerticalSlide(scrollYPos) {
  const stageMax = getStageScrollMax();
  const vh = window.innerHeight || 900;
  const vw = window.innerWidth || 1440;
  const overflowY = Math.max(0, scrollYPos - stageMax);
  const o = overflowY / vh;
  const vp = stageSlideLayers[0];
  const k = Math.max(0, Math.min(1, (o - 0.52) / 0.38));
  if (vp) {
    if (k > 0) {
      const e = k * k * (3 - 2 * k);
      let lx = 60, ly = 40;
      if (tbLogoEl) { const lr = tbLogoEl.getBoundingClientRect(); lx = lr.left + 23; ly = lr.top + lr.height / 2; }
      const sc = Math.max(0.02, 1 - 0.98 * e);
      vp.style.transformOrigin = '50% 50%';
      vp.style.transform = `translate3d(${((lx - vw / 2) * e).toFixed(1)}px, ${((ly - vh / 2) * e).toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
      vp.style.opacity = Math.max(0, 1 - Math.pow(e, 1.35)).toFixed(3);
    } else {
      vp.style.transform = '';
      vp.style.opacity = '';
    }
  }
  if (stageSlideLayers[1]) stageSlideLayers[1].style.opacity = k > 0 ? Math.max(0, 1 - k).toFixed(3) : '';
  document.body.classList.toggle('below-3d-active', overflowY > 2);
  document.body.classList.toggle('case-flying', k > 0 && k < 0.99);
  document.body.classList.toggle('topbar-on', o > 0.54);
  document.body.classList.toggle('logo-catch', o > 0.86 && o < 1.25);
  homeState.outroShrinkDeskAlpha = k > 0 ? Math.max(0, 1 - k / 0.22) : 1.0;
  if (o <= 0.90) homeState.force3DRedraw = true;
  if (typeof scrollScrubUpdater === 'function') scrollScrubUpdater();
  if (overflowY > 0) {
    const a = Math.max(0, Math.min(1, o / 0.50));
    return 1 - a * a * (3 - 2 * a);
  }
  return null;
}
window.updateStageVerticalSlide = updateStageVerticalSlide;

export function initScrollCameraListeners() {
  window.addEventListener('scroll', () => {
    const foldP = updateStageVerticalSlide(window.scrollY);
    if (foldP !== null) {
      homeState.isTweeningScroll = false;
      homeState.targetScrollProgress = foldP;
      homeState.scrollProgress = foldP;
      homeState.currentStopIdx = SCROLL_STOPS.length - 1;
      if (homeState.focusedGroupId) window.closeDrawer();
      homeState.force3DRedraw = true;
      return;
    }
    if (performance.now() < homeState.ignoreNativeScrollUntil) return;
    const stageMax = getStageScrollMax();
    const rawP = Math.max(0, Math.min(1, window.scrollY / stageMax));
    homeState.isTweeningScroll = false;
    homeState.targetScrollProgress = rawP;
    homeState.scrollProgress = rawP;
    let bestIdx = 0;
    let bestDiff = 999;
    SCROLL_STOPS.forEach((sp, i) => {
      const diff = Math.abs(homeState.targetScrollProgress - sp);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    homeState.currentStopIdx = bestIdx;
    if (homeState.focusedGroupId && !isGroupUnlocked(homeState.focusedGroupId, homeState.targetScrollProgress)) {
      window.closeDrawer();
    }
    mark3DActive();
  });

  window.addEventListener('wheel', (e) => {
    if (e.target.closest('.product-drawer, .sec3-options-tray, .sec3-slot-list')) return;
    const stageMax = getStageScrollMax();
    {
      const vhh = window.innerHeight;
      const outro = [stageMax, stageMax + vhh * 0.50, stageMax + vhh * 1.15];
      const y = window.scrollY;
      const d = e.deltaY > 0 ? 1 : -1;
      const inOutro = y >= stageMax - 2 && y <= outro[2] + 4;
      const atLastStop = homeState.currentStopIdx === SCROLL_STOPS.length - 1 && homeState.scrollProgress >= 0.96;
      if (inOutro && ((y > stageMax + 2 && !(d < 0 && y < stageMax + 16)) || (d > 0 && atLastStop))) {
        let idx = 0, best = 1e9;
        outro.forEach((v, i) => { const df = Math.abs(y - v); if (df < best) { best = df; idx = i; } });
        if (d > 0 && idx === 2 && !homeState.outroTweenActive) return;
        e.preventDefault();
        if (homeState.outroTweenActive || Math.abs(e.deltaY) < 5) return;
        const ni = Math.max(0, Math.min(2, idx + d));
        if (ni !== idx) outroTweenTo(outro[ni], 1150);
        return;
      }
    }
    if (window.scrollY > stageMax + 4) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (dir > 0 && homeState.currentStopIdx === SCROLL_STOPS.length - 1 && homeState.scrollProgress >= 0.96) return;
    e.preventDefault();
    if (homeState.wheelStepLocked || Math.abs(e.deltaY) < 5) return;
    const nextIdx = Math.max(0, Math.min(SCROLL_STOPS.length - 1, homeState.currentStopIdx + dir));
    if (nextIdx !== homeState.currentStopIdx) {
      homeState.wheelStepLocked = true;
      homeState.currentStopIdx = nextIdx;
      window.scrollToProgress(SCROLL_STOPS[nextIdx]);
      setTimeout(() => { homeState.wheelStepLocked = false; }, 220);
    }
  }, { passive: false });
}

export function startScrollTweenNow(fromP, toP, now) {
  const dist = Math.abs(toP - fromP);
  const baseMs = 540;
  homeState.tweenDurationMs = Math.max(260, Math.min(baseMs * 1.65, baseMs * Math.pow(Math.max(0.02, dist) / 0.16, 0.42)));
  homeState.tweenStartP = fromP;
  homeState.tweenEndP = toP;
  homeState.tweenStartTime = now || performance.now();
  homeState.isTweeningScroll = true;

  const stageMax = getStageScrollMax();
  homeState.ignoreNativeScrollUntil = (now || performance.now()) + 160;
  window.scrollTo({ top: toP * stageMax, behavior: 'auto' });
  mark3DActive();
}

window.scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (id === 'sec1Editorial') {
    const settledY = getStageScrollMax() + Math.round((window.innerHeight || 900) * 1.15);
    outroTweenTo(settledY, 1150);
    return;
  }
  homeState.outroTweenToken++;
  homeState.outroTweenActive = false;
  const targetY = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - 24));
  window.scrollTo({ top: targetY, behavior: 'smooth' });
};

window.scrollToProgress = (p) => {
  if (homeState.focusedGroupId && !isGroupUnlocked(homeState.focusedGroupId, p)) {
    window.closeDrawer();
  }
  let bestIdx = 0;
  let bestDiff = 999;
  SCROLL_STOPS.forEach((sp, i) => {
    const diff = Math.abs(p - sp);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  });
  homeState.currentStopIdx = bestIdx;
  homeState.targetScrollProgress = p;
  startScrollTweenNow(homeState.scrollProgress, p, performance.now());
};

// Precompute constant camera basis vectors for the 6-wave doorway extraction & reusable math objects
const _refCamBasis = (() => {
  const m = new THREE.Matrix4().lookAt(
    new THREE.Vector3(3.55, 2.20, 5.55),
    new THREE.Vector3(0, 0.83, 0.45),
    new THREE.Vector3(0, 1, 0)
  );
  return {
    right: new THREE.Vector3().setFromMatrixColumn(m, 0),
    up: new THREE.Vector3().setFromMatrixColumn(m, 1),
    back: new THREE.Vector3().setFromMatrixColumn(m, 2)
  };
})();

const LOGICAL_EXTRACTION = {
  Group_Accessories: { pStart: 0.01, pEnd: 0.15, doorX: 0.00, doorY: 0.00, doorZ: 0.00, xDelay: 0.00, yDelay: 0.00, zDelay: 0.00 },
  Group_Cables:      { pStart: 0.17, pEnd: 0.32, doorX: 0.95, doorY: 0.25, doorZ: 1.55, xDelay: 0.00, yDelay: 0.45, zDelay: 0.00 },
  Group_GPU:         { pStart: 0.34, pEnd: 0.49, doorX: 0.14, doorY: 0.08, doorZ: 0.88, xDelay: 0.34, yDelay: 0.30, zDelay: 0.00 },
  Group_RAM:         { pStart: 0.34, pEnd: 0.49, doorX: 0.68, doorY: -0.22, doorZ: 1.05, xDelay: 0.00, yDelay: 0.55, zDelay: 0.00 },
  Group_Cooling:     { pStart: 0.51, pEnd: 0.66, doorX: 0.48, doorY: -0.10, doorZ: 0.88, xDelay: 0.00, yDelay: 0.28, zDelay: 0.00 },
  Group_SSD:         { pStart: 0.51, pEnd: 0.66, doorX: 0.18, doorY: 0.02, doorZ: 1.08, xDelay: 0.34, yDelay: 0.20, zDelay: 0.00 },
  Group_CPU:         { pStart: 0.68, pEnd: 0.83, doorX: 0.14, doorY: 0.16, doorZ: 1.15, xDelay: 0.30, yDelay: 0.15, zDelay: 0.00 },
  Group_PSU:         { pStart: 0.68, pEnd: 0.83, doorX: 0.00, doorY: -0.18, doorZ: -0.42, xDelay: 0.20, yDelay: 0.00, zDelay: 0.38 },
  Group_Mainboard:   { pStart: 0.85, pEnd: 0.99, doorX: 0.30, doorY: 0.00, doorZ: 1.20, xDelay: 0.38, yDelay: 0.22, zDelay: 0.00 },
  Group_Case:        { pStart: 0.10, pEnd: 0.95, doorX: 0.00, doorY: 0.00, doorZ: 0.00, xDelay: 0.00, yDelay: 0.00, zDelay: 0.00 }
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const BOTTOM_FAN_PIVOT = new THREE.Vector3(-0.06, 0.185, 0.130);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _e1 = new THREE.Euler();
const _box1 = new THREE.Box3();
const _box2 = new THREE.Box3();
const _camRight = new THREE.Vector3();

export function updateSceneByScroll(p) {
  const deskMoveT = smootherstep(p / 0.42);
  const deskFadeT = smootherstep((p - 0.01) / 0.28);
  const deskAlpha = Math.min(1.0 - deskFadeT, homeState.outroShrinkDeskAlpha);
  deskGroup.position.y = -deskMoveT * 1.15;
  deskGroup.visible = deskAlpha > 0.005;
  deskTopMat.transparent = deskAlpha < 0.999;
  deskTopMat.opacity = deskAlpha;
  deskTopMat.depthWrite = deskAlpha > 0.65;
  deskTrimMat.transparent = deskAlpha < 0.999;
  deskTrimMat.opacity = deskAlpha;
  deskTrimMat.depthWrite = deskAlpha > 0.65;
  shadowMat.opacity = 0.85 * Math.pow(deskAlpha, 1.4);

  const levShow = smootherstep((p - 0.005) / 0.10);
  levGroup.visible = levShow > 0.01;
  levGroup.position.y = -smootherstep(p) * 3.10;
  levGroup.rotation.y = p * 0.28;
  for (let i = 0; i < levGroup.children.length; i++) {
    const ch = levGroup.children[i];
    if (ch.material && ch.material.userData && ch.material.userData.baseOp !== undefined) {
      ch.material.opacity = ch.material.userData.baseOp * levShow;
    }
  }

  const masterT = smootherstep(p);
  pcRoot.position.y = masterT * 0.22;
  pcRoot.rotation.y = -0.22 + masterT * 0.12;

  const camT = smootherstep(Math.pow(p, 0.44));
  overviewTarget.set(0, 0.78 + camT * 0.05, camT * 0.45);
  overviewCamPos.set(2.35 + camT * 1.2, 1.45 + camT * 0.75, 2.75 + camT * 2.8);
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (aspect < 1.35) {
    const distBoost = Math.min(1.26, Math.pow(1.35 / Math.max(0.68, aspect), 0.35));
    overviewCamPos.sub(overviewTarget).multiplyScalar(distBoost).add(overviewTarget);
  }

  const glassMoveT = smootherstep((p - 0.01) / 0.14);
  const glassFadeT = smootherstep((p - 0.09) / 0.06);
  const glassAlpha = 1.0 - glassFadeT;
  const detachBoost = (p > 0.01 && p < 0.15) ? 1.35 : 1.0;
  for (let i = 0; i < glassPanels.length; i++) {
    const gp = glassPanels[i];
    gp.mesh.position.copy(gp.initPos).addScaledVector(gp.slideVec, glassMoveT);
    gp.mesh.material.transparent = true;
    gp.mesh.material.opacity = Math.min(1.0, gp.baseOpacity * detachBoost) * glassAlpha;
    gp.mesh.visible = glassAlpha > 0.01;
  }

  pcRoot.updateMatrixWorld(true);

  for (const cfg of Object.values(GROUPS_CONFIG)) {
    const node = groupNodes[cfg.id];
    if (!node || !groupInitialPos[cfg.id]) continue;
    const eo = cfg.explodeOffset;
    const er = cfg.explodeRot;
    _v1.set(0, 0, 0)
      .addScaledVector(_refCamBasis.right, eo[0])
      .addScaledVector(_refCamBasis.up, eo[1])
      .addScaledVector(_refCamBasis.back, eo[2]);
    node.parent.getWorldQuaternion(_q1);
    _v1.applyQuaternion(_q1.invert());

    const ext = LOGICAL_EXTRACTION[cfg.id];
    const gt = smootherstep((p - ext.pStart) / (ext.pEnd - ext.pStart));
    const tX = ext.xDelay > 0 ? smootherstep((gt - ext.xDelay) / (1.0 - ext.xDelay)) : gt;
    const tY = ext.yDelay > 0 ? smootherstep((gt - ext.yDelay) / (1.0 - ext.yDelay)) : smootherstep(gt / 0.65);
    const tZ = ext.zDelay > 0 ? smootherstep((gt - ext.zDelay) / (1.0 - ext.zDelay)) : smootherstep(gt / 0.70);
    const bell = Math.sin(Math.pow(gt, 0.72) * Math.PI);

    _v2.set(
      _v1.x * tX + ext.doorX * bell,
      _v1.y * tY + ext.doorY * bell,
      _v1.z * tZ + ext.doorZ * bell
    );
    node.position.copy(groupInitialPos[cfg.id]).add(_v2);
    node.rotation.set(
      groupInitialRot[cfg.id].x + er[0] * gt,
      groupInitialRot[cfg.id].y + er[1] * gt,
      groupInitialRot[cfg.id].z + er[2] * gt
    );
  }

  if (homeState.modelScene) {
    const cpuRoot = homeState.modelScene.getObjectByName('CPU_i9_14900K_Root');
    if (cpuRoot) {
      const s = 1.0 + smootherstep((p - 0.68) / 0.15) * 1.50;
      cpuRoot.scale.set(s, s, s);
    }
    const psuRoot = homeState.modelScene.getObjectByName('PSU_1000W_Root');
    if (psuRoot) {
      const psuT = smootherstep((p - 0.68) / 0.15);
      psuRoot.rotation.set(psuT * (Math.PI * 0.47), psuT * 0.14, psuT * (-0.05));
      const s = 1.0 + psuT * 0.16;
      psuRoot.scale.set(s, s, s);
    }
    const moboRoot = homeState.modelScene.getObjectByName('Mobo_Z790_Root');
    if (moboRoot) {
      const s = 1.0 + smootherstep((p - 0.85) / 0.14) * 0.18;
      moboRoot.scale.set(s, s, s);
    }
    const ramRotT = smootherstep((p - 0.34) / 0.15);
    const ramRx = (Math.PI / 2) * (1 - ramRotT) + 0.12 * ramRotT;
    const ramRy = (Math.PI / 2) * (1 - ramRotT) + (-0.18) * ramRotT;
    const ramScale = 1.0 + ramRotT * 0.22;
    for (const rName of ['RAM_1_Root', 'RAM_2_Root']) {
      const rNode = homeState.modelScene.getObjectByName(rName);
      if (rNode) {
        rNode.rotation.set(ramRx, ramRy, 0);
        rNode.scale.set(ramScale, ramScale, ramScale);
      }
    }
    const ssdWaveT = smootherstep((p - 0.51) / 0.15);
    const ssdScale = 1.0 + ssdWaveT * 0.20;
    for (const sName of ['SSD_NVMe1_Root', 'SSD_NVMe2_Root', 'SSD_SATA_Root']) {
      const sNode = homeState.modelScene.getObjectByName(sName);
      if (sNode) sNode.scale.set(ssdScale, ssdScale, ssdScale);
    }
  }

  for (let i = 0; i < subNodes.length; i++) {
    const item = subNodes[i];
    const nName = item.node.name || '';
    let subT = 0;
    if (nName.startsWith('Bear_') || nName.startsWith('CloudHook_') || nName.startsWith('Acc2_')) {
      subT = smootherstep((p - 0.01) / 0.14);
    } else if (nName.startsWith('Cable_')) {
      subT = smootherstep((p - 0.17) / 0.15);
    } else if (nName.startsWith('RAM_') || nName.startsWith('GPU_')) {
      subT = smootherstep((p - 0.34) / 0.15);
    } else if (nName.startsWith('Case_BottomFan_') || nName.includes('NVMe') || nName.includes('SATA') || nName.includes('M2') || nName.includes('SSD')) {
      subT = smootherstep((p - 0.51) / 0.15);
    } else if (nName.startsWith('PSU_')) {
      subT = smootherstep((p - 0.68) / 0.15);
    }

    if (nName.startsWith('Case_BottomFan_')) {
      _e1.set(subT * (Math.PI * 0.48), 0, 0);
      _q1.setFromEuler(_e1);
      _v1.copy(item.initPos).sub(BOTTOM_FAN_PIVOT).applyQuaternion(_q1).add(BOTTOM_FAN_PIVOT);
      item.node.position.copy(_v1).addScaledVector(item.cfg.deltaPos, subT);
      item.node.quaternion.copy(item.initQuat).premultiply(_q1);
    } else {
      item.node.position.copy(item.initPos).addScaledVector(item.cfg.deltaPos, subT);
    }
  }

  const fadeT = Math.max(0, Math.min(1, (p - 0.01) / 0.13));
  const alphaFactor = 1 - fadeT * fadeT * (3 - 2 * fadeT);
  for (let i = 0; i < fadeMeshes.length; i++) {
    const m = fadeMeshes[i];
    const targetOp = m.userData.baseOpacity * alphaFactor;
    m.material.transparent = alphaFactor < 0.999 || m.userData.baseOpacity < 1.0;
    m.material.opacity = targetOp;
    m.material.depthWrite = alphaFactor > 0.85;
    m.visible = alphaFactor > 0.01;
  }

  // Hover / focus turntable Y-axis spin pivoted cleanly on each group's visible geometric center
  pcRoot.updateMatrixWorld(true);
  for (const id of Object.keys(GROUPS_CONFIG)) {
    const ang = compSpinAngle[id] || 0;
    if (Math.abs(ang) < 0.002) continue;
    const node = groupNodes[id];
    const anchors = groupBoxAnchors[id];
    if (!node || !anchors || !anchors.length) continue;
    _box1.makeEmpty();
    for (let i = 0; i < anchors.length; i++) {
      const m = anchors[i];
      if (!m.visible || !m.geometry.boundingBox) continue;
      _box2.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      _box1.union(_box2);
    }
    if (_box1.isEmpty()) continue;
    _box1.getCenter(_v1);
    node.parent.worldToLocal(_v1);
    _v2.copy(_v1).sub(node.position);
    _q1.setFromAxisAngle(Y_AXIS, ang);
    _v3.copy(_v2).applyQuaternion(_q1);
    node.position.add(_v2).sub(_v3);
    node.quaternion.premultiply(_q1);
  }

  pcRoot.updateMatrixWorld(true);
}

let _scrimMaskCanvas = null;
let _scrimMaskCtx = null;
let _lastScrimMaskKey = '';

function computeConvexHull2D(pts) {
  if (pts.length <= 3) return pts;
  pts.sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (let i = 0; i < pts.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
    lower.push(pts[i]);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
    upper.push(pts[i]);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function pointToConvexHullDist(px, py, hull) {
  let inside = true;
  let minDistSq = Infinity;
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    if (ex * (py - a.y) - ey * (px - a.x) < -1e-6) inside = false;
    const lenSq = ex * ex + ey * ey;
    let t = lenSq > 1e-6 ? ((px - a.x) * ex + (py - a.y) * ey) / lenSq : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const dx = px - (a.x + t * ex);
    const dy = py - (a.y + t * ey);
    const dSq = dx * dx + dy * dy;
    if (dSq < minDistSq) minDistSq = dSq;
  }
  return inside ? 0 : Math.sqrt(minDistSq);
}

function updateCaseScrimMask(scrimEl, vw, vh) {
  if (!scrimEl || vw <= 0 || vh <= 0) return;
  const maskKey = [
    Math.round(camera.position.x * 160),
    Math.round(camera.position.y * 160),
    Math.round(camera.position.z * 160),
    Math.round(pcRoot.rotation.y * 160),
    vw,
    vh
  ].join('|');
  if (maskKey === _lastScrimMaskKey) return;

  const pts = [];
  for (const gid of ['Group_Case', 'Group_Accessories']) {
    const anchors = groupBoxAnchors[gid];
    if (!anchors || !anchors.length) continue;
    for (let i = 0; i < anchors.length; i++) {
      const m = anchors[i];
      const posAttr = m.visible && m.geometry && m.geometry.attributes && m.geometry.attributes.position;
      if (!posAttr || !posAttr.count) continue;
      const cnt = posAttr.count;
      const stride = Math.max(1, Math.floor(cnt / 220));
      for (let vi = 0; vi < cnt; vi += stride) {
        _v1.fromBufferAttribute(posAttr, vi).applyMatrix4(m.matrixWorld).project(camera);
        pts.push({
          x: (_v1.x * 0.5 + 0.5) * vw,
          y: (-_v1.y * 0.5 + 0.5) * vh
        });
      }
    }
  }
  if (pts.length < 3) return;
  const hull = computeConvexHull2D(pts);
  if (hull.length < 3) return;
  _lastScrimMaskKey = maskKey;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const caseW = Math.max(160, maxX - minX);
  const caseH = Math.max(160, maxY - minY);
  const clearPadPx = 4;
  const bandPx = Math.max(80, Math.round(0.5 * Math.min(caseW, caseH)));
  const maxReach = clearPadPx + bandPx;

  scrimEl.style.setProperty('--scrim-cx', `${Math.round((minX + maxX) * 0.5)}px`);
  scrimEl.style.setProperty('--scrim-cy', `${Math.round((minY + maxY) * 0.5)}px`);
  scrimEl.style.setProperty('--scrim-orx', `${Math.round(caseW * 0.5 + maxReach)}px`);
  scrimEl.style.setProperty('--scrim-ory', `${Math.round(caseH * 0.5 + maxReach)}px`);

  const mw = 288;
  const mh = Math.max(120, Math.round(mw * (vh / vw)));
  if (!_scrimMaskCanvas) {
    _scrimMaskCanvas = document.createElement('canvas');
    _scrimMaskCtx = _scrimMaskCanvas.getContext('2d');
  }
  if (!_scrimMaskCtx) return;
  if (_scrimMaskCanvas.width !== mw || _scrimMaskCanvas.height !== mh) {
    _scrimMaskCanvas.width = mw;
    _scrimMaskCanvas.height = mh;
  }

  const img = _scrimMaskCtx.createImageData(mw, mh);
  const data = img.data;
  const bx0 = minX - maxReach;
  const bx1 = maxX + maxReach;
  const by0 = minY - maxReach;
  const by1 = maxY + maxReach;

  for (let cy = 0; cy < mh; cy++) {
    const py = ((cy + 0.5) / mh) * vh;
    const outsideY = py <= by0 || py >= by1;
    for (let cx = 0; cx < mw; cx++) {
      const idx = (cy * mw + cx) * 4;
      const px = ((cx + 0.5) / mw) * vw;
      let alpha = 255;
      if (!outsideY && px > bx0 && px < bx1) {
        const dist = pointToConvexHullDist(px, py, hull);
        if (dist <= clearPadPx) {
          alpha = 0;
        } else if (dist < maxReach) {
          const t = (dist - clearPadPx) / bandPx;
          alpha = Math.round(255 * Math.pow(t, 0.62));
        }
      }
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = alpha;
    }
  }
  _scrimMaskCtx.putImageData(img, 0, 0);
  const maskUrl = `url("${_scrimMaskCanvas.toDataURL('image/png')}")`;
  scrimEl.style.webkitMaskImage = maskUrl;
  scrimEl.style.maskImage = maskUrl;
}

function projectBoxCornersToScreen(mn, mx, matrixWorld, vw, vh) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let c = 0; c < 8; c++) {
    _v1.set(
      (c & 1) ? mx.x : mn.x,
      (c & 2) ? mx.y : mn.y,
      (c & 4) ? mx.z : mn.z
    );
    if (matrixWorld) _v1.applyMatrix4(matrixWorld);
    _v1.project(camera);
    const sx = (_v1.x * 0.5 + 0.5) * vw;
    const sy = (-_v1.y * 0.5 + 0.5) * vh;
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
  }
  return { minX, minY, maxX, maxY };
}

function finalizeScreenBox(minX, minY, maxX, maxY) {
  const bw = Math.max(12, maxX - minX);
  const bh = Math.max(12, maxY - minY);
  return { left: minX, top: minY, right: minX + bw, bottom: minY + bh, w: bw, h: bh };
}

function computeTightClusterScreenBox(meshes, vw, vh) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i];
    if (!m.visible || !m.geometry.boundingBox) continue;
    any = true;
    const { minX: x0, minY: y0, maxX: x1, maxY: y1 } = projectBoxCornersToScreen(
      m.geometry.boundingBox.min,
      m.geometry.boundingBox.max,
      m.matrixWorld,
      vw,
      vh
    );
    if (x0 < minX) minX = x0;
    if (x1 > maxX) maxX = x1;
    if (y0 < minY) minY = y0;
    if (y1 > maxY) maxY = y1;
  }
  return any ? finalizeScreenBox(minX, minY, maxX, maxY) : null;
}

function updateGroupScreenBounds(vw, vh) {
  for (const id of Object.keys(GROUPS_CONFIG)) {
    const node = groupNodes[id];
    const anchors = groupBoxAnchors[id];
    if (!node || !anchors || !anchors.length) continue;

    const subClusters = groupSubAnchors[id];
    if (subClusters && subClusters.length) {
      const subBoxes = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < subClusters.length; i++) {
        const sb = computeTightClusterScreenBox(subClusters[i], vw, vh);
        if (!sb) continue;
        subBoxes.push(sb);
        if (sb.left < minX) minX = sb.left;
        if (sb.top < minY) minY = sb.top;
        if (sb.right > maxX) maxX = sb.right;
        if (sb.bottom > maxY) maxY = sb.bottom;
      }
      if (!subBoxes.length) continue;
      const box = finalizeScreenBox(minX, minY, maxX, maxY);
      currentGroupScreenPos[id] = {
        x: (box.left + box.right) * 0.5,
        y: (box.top + box.bottom) * 0.5,
        box,
        subBoxes
      };
      continue;
    }

    _box1.makeEmpty();
    for (let i = 0; i < anchors.length; i++) {
      const m = anchors[i];
      if (!m.visible || !m.geometry.boundingBox) continue;
      _box2.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      _box1.union(_box2);
    }
    if (_box1.isEmpty()) continue;

    const { minX, minY, maxX, maxY } = projectBoxCornersToScreen(_box1.min, _box1.max, null, vw, vh);
    const box = finalizeScreenBox(minX, minY, maxX, maxY);
    currentGroupScreenPos[id] = {
      x: (box.left + box.right) * 0.5,
      y: (box.top + box.bottom) * 0.5,
      box
    };
  }
  const scrimEl = document.getElementById('sec1CaseScrim');
  const nearOutroZone = window.scrollY > getStageScrollMax() * 0.92;
  if (scrimEl && homeState.scrollProgress <= 0.08 && (nearOutroZone || !_lastScrimMaskKey)) {
    updateCaseScrimMask(scrimEl, vw, vh);
  }
}


export function renderFrameAndUI(p, now) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Skip 100% of 3D work once scrolled cleanly past the outro flight
  const vpLayer = stageSlideLayers[0];
  if (document.body.classList.contains('below-3d-active') && vpLayer && parseFloat(vpLayer.style.opacity || '1') <= 0.01) {
    return;
  }

  const allUnlocked = isAllFullyDetached(p);
  const isAtM0 = (p < 0.006 && !homeState.focusedGroupId && (!homeState.isTweeningScroll || homeState.tweenEndP < 0.006));
  const spinCandidate = homeState.hoveredGroupId || homeState.focusedGroupId;
  const spinAllowed = !isAtM0 && spinCandidate && isGroupUnlocked(spinCandidate, p) &&
    (spinCandidate !== 'Group_Case' || allUnlocked);
  const activeSpinGroupId = spinAllowed ? spinCandidate : null;

  let spinSig = '';
  for (const id of Object.keys(GROUPS_CONFIG)) {
    let ang = compSpinAngle[id] || 0;
    if (id === activeSpinGroupId) {
      if (renderParams.get('spin') !== null) {
        ang = parseFloat(renderParams.get('spin')) * (Math.PI * 2 / 72);
      } else {
        ang = (ang + 0.013 * homeState.globalTickScale) % (Math.PI * 2);
      }
    } else if (ang > 0.003) {
      if (ang > Math.PI) {
        ang += (Math.PI * 2 - ang) * (1 - Math.pow(0.82, homeState.globalTickScale));
        if (Math.PI * 2 - ang < 0.006) ang = 0;
      } else {
        ang *= Math.pow(0.82, homeState.globalTickScale);
        if (ang < 0.006) ang = 0;
      }
    } else {
      ang = 0;
    }
    compSpinAngle[id] = ang;
    if (ang > 0.002) spinSig += `${id}:${Math.round(ang * 250)},`;
  }

  const sceneNeedsUpdate = homeState.force3DRedraw || !window._isModelReady || Math.abs(p - homeState.lastSceneAppliedP) > 1e-4 || Math.abs(homeState.outroShrinkDeskAlpha - homeState.lastDeskShrinkAlpha) > 1e-3 || spinSig !== homeState.lastSpinSig;
  if (sceneNeedsUpdate) {
    updateSceneByScroll(p);
    homeState.lastSceneAppliedP = p;
    homeState.lastDeskShrinkAlpha = homeState.outroShrinkDeskAlpha;
    homeState.lastSpinSig = spinSig;
  }

  const drawerEl = document.getElementById('productDrawer');
  const isExpandedShop = drawerEl && drawerEl.classList.contains('expanded-shop');
  const allowFreeOrbit = isAtM0 && window.scrollY <= getStageScrollMax() * 0.01 && renderParams.get('p') === null;

  if (allowFreeOrbit) {
    if (homeState.prevCamState !== 'm0' && !homeState.m0IsDragging) {
      const camLerp = 1 - Math.pow(0.84, homeState.globalTickScale);
      camera.position.lerp(overviewCamPos, camLerp);
      controls.target.lerp(overviewTarget, camLerp);
      if (camera.position.distanceTo(overviewCamPos) < 0.03) homeState.prevCamState = 'm0';
    } else {
      homeState.prevCamState = 'm0';
    }
    controls.enabled = true;
    controls.autoRotate = homeState.m0AutoSpin && !homeState.m0IsDragging && (now - homeState.last3DInteractionAt < 15000);
    controls.autoRotateSpeed = 0.85;
    controls.update();
  } else {
    homeState.prevCamState = 'exploded';
    controls.enabled = false;
    controls.autoRotate = false;

    if (homeState.focusedGroupId && groupNodes[homeState.focusedGroupId] && !isExpandedShop) {
      const node = groupNodes[homeState.focusedGroupId];
      if (groupFocusCenterLocal[homeState.focusedGroupId]) {
        _v4.copy(groupFocusCenterLocal[homeState.focusedGroupId]).applyMatrix4(node.matrixWorld);
      } else {
        _v4.copy(overviewTarget);
      }
      const cfg = GROUPS_CONFIG[homeState.focusedGroupId];
      const fc = cfg.focus || { distance: 1.3, camDir: [0.25, 0.22, 0.96], offsetTargetY: 0 };
      if (fc.offsetTargetY) _v4.y += fc.offsetTargetY;
      const dist = fc.distance || 1.25;
      if (!renderParams.get('focus') && vw > 760) {
        _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        _v4.addScaledVector(_camRight, dist * 0.25);
      }
      desiredCamTarget.copy(_v4);
      _v2.set(fc.camDir[0], fc.camDir[1], fc.camDir[2]).normalize();
      desiredCamPos.copy(desiredCamTarget).addScaledVector(_v2, dist);
    } else {
      desiredCamTarget.copy(overviewTarget);
      desiredCamPos.copy(overviewCamPos);
    }

    if (
      (renderParams.get('drawer') && homeState.focusedGroupId && !window._camSnapped) ||
      (renderParams.get('p') !== null && !window._pCamSnapped) ||
      (window._backCamSnapPending && window._isModelReady)
    ) {
      if (homeState.focusedGroupId) window._camSnapped = true;
      if (renderParams.get('p') !== null) window._pCamSnapped = true;
      if (window._isModelReady) window._backCamSnapPending = false;
      camera.position.copy(desiredCamPos);
      controls.target.copy(desiredCamTarget);
    } else {
      const camLerp = 1 - Math.pow(0.84, homeState.globalTickScale);
      camera.position.lerp(desiredCamPos, camLerp);
      controls.target.lerp(desiredCamTarget, camLerp);
    }
    camera.lookAt(controls.target);
  }

  const renderKey = [
    Math.round(p * 4000),
    Math.round(camera.position.x * 600),
    Math.round(camera.position.y * 600),
    Math.round(camera.position.z * 600),
    Math.round(controls.target.x * 600),
    Math.round(controls.target.y * 600),
    Math.round(controls.target.z * 600),
    spinSig,
    homeState.focusedGroupId || '',
    Math.round(homeState.outroShrinkDeskAlpha * 100),
    homeState.currentThemeName,
    `${vw}x${vh}`,
    window._isModelReady ? 1 : 0
  ].join('|');

  if (!homeState.force3DRedraw && renderKey === homeState.last3DRenderKey) {
    return;
  }
  homeState.last3DRenderKey = renderKey;
  homeState.force3DRedraw = false;

  camera.updateMatrixWorld(true);
  renderer.render(scene, camera);
  window._rendererDrawCount++;
  updateGroupScreenBounds(vw, vh);
}

