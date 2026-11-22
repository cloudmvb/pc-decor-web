/* ============================================================================
   S25 // SKYCRUMB — MAGNETIC CURSOR PILL & 3D RAYCAST INTERACTION
   ============================================================================ */

import * as THREE from 'three';
import { homeState, renderParams } from './state.js';
import { SITE_SVGS, GROUPS_CONFIG } from './config.js';
import {
  isGroupUnlocked,
  mark3DActive,
  frameCanvas,
  scene,
  camera,
  renderer,
  controls,
  raycastMeshes
} from './studio-engine.js';
import { currentGroupScreenPos } from './scroll-camera.js';

// =========================================================================
// 6. S25 MAGNETIC CURSOR-FOLLOWING PILL
// =========================================================================
const cursorPillEl = document.getElementById('s25CursorPill');

export function updateMagneticCursorPill() {
  if (!cursorPillEl) return;
  homeState.cursorCurX += (homeState.cursorTargetX - homeState.cursorCurX) * 0.22;
  homeState.cursorCurY += (homeState.cursorTargetY - homeState.cursorCurY) * 0.22;

  const drawerOpen = document.getElementById('productDrawer')?.classList.contains('open');
  if (!homeState.pointerInsideWindow || drawerOpen || document.body.classList.contains('below-3d-active')) {
    cursorPillEl.classList.remove('visible');
    return;
  }

  if (homeState.hoveredGroupId && GROUPS_CONFIG[homeState.hoveredGroupId]) {
    const cfg = GROUPS_CONFIG[homeState.hoveredGroupId];
    const key = `hit:${cfg.id}`;
    if (homeState.lastPillKey !== key) {
      homeState.lastPillKey = key;
      cursorPillEl.innerHTML = `${SITE_SVGS[cfg.svgKey] || SITE_SVGS.orbit}<span>${cfg.title}</span>${SITE_SVGS.arrowRight}`;
    }
    cursorPillEl.classList.add('visible', 'part-hit');
    cursorPillEl.style.transform = `translate3d(${Math.round(homeState.cursorCurX + 18)}px, ${Math.round(homeState.cursorCurY - 18)}px, 0) scale(1)`;
  } else if (false) {
    const key = 'm0:orbit';
    if (homeState.lastPillKey !== key) {
      homeState.lastPillKey = key;
      cursorPillEl.innerHTML = `${SITE_SVGS.orbit}<span>360° Drag</span>`;
    }
    cursorPillEl.classList.add('visible');
    cursorPillEl.classList.remove('part-hit');
    cursorPillEl.style.transform = `translate3d(${Math.round(homeState.cursorCurX + 16)}px, ${Math.round(homeState.cursorCurY - 16)}px, 0) scale(0.94)`;
  } else {
    cursorPillEl.classList.remove('visible', 'part-hit');
  }
}


// =========================================================================
// 8. 3D RAYCASTER + BOUNDING BOX HIT-TESTING & POINTER INTERACTION
// =========================================================================
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const pointerDownPos = { x: 0, y: 0 };

function isMeshChainVisible(obj) {
  let cur = obj;
  while (cur && cur !== scene) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

function findNearestGroupAtPoint(clientX, clientY) {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);

  if (window._isModelReady && raycastMeshes.length) {
    pointerNdc.set((clientX / vw) * 2 - 1, -(clientY / vh) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(raycastMeshes, false);
    for (let i = 0; i < hits.length; i++) {
      const obj = hits[i].object;
      const gid = obj.userData?.groupId;
      if (!gid || !isGroupUnlocked(gid, homeState.scrollProgress)) continue;
      if (!isMeshChainVisible(obj)) continue;
      const mat = obj.material;
      if (gid === 'Group_Case' && mat && mat.transparent && mat.opacity < 0.25) continue;
      return gid;
    }
  }

  let bestId = null;
  let bestScore = Infinity;
  for (const [id, pt] of Object.entries(currentGroupScreenPos)) {
    if (!isGroupUnlocked(id, homeState.scrollProgress) || id === 'Group_Case' || !pt.box) continue;
    const pad = (id === 'Group_Accessories') ? 5 : 8;
    const hitBoxes = (Array.isArray(pt.subBoxes) && pt.subBoxes.length) ? pt.subBoxes : [pt.box];
    for (let bi = 0; bi < hitBoxes.length; bi++) {
      const b = hitBoxes[bi];
      const insideX = clientX >= b.left - pad && clientX <= b.right + pad;
      const insideY = clientY >= b.top - pad && clientY <= b.bottom + pad;
      if (!insideX || !insideY) continue;
      const cx = (b.left + b.right) * 0.5;
      const cy = (b.top + b.bottom) * 0.5;
      const nx = (clientX - cx) / Math.max(20, b.w * 0.5);
      const ny = (clientY - cy) / Math.max(20, b.h * 0.5);
      const score = Math.hypot(nx, ny);
      if (score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
  }
  return bestId;
}

window.setHoveredGroup = (groupId) => {
  homeState.hoveredGroupId = (groupId && GROUPS_CONFIG[groupId]) ? groupId : null;
  if (homeState.hoveredGroupId) {
    homeState.pointerInsideWindow = true;
    if (currentGroupScreenPos[homeState.hoveredGroupId]) {
      homeState.cursorTargetX = currentGroupScreenPos[homeState.hoveredGroupId].x;
      homeState.cursorTargetY = currentGroupScreenPos[homeState.hoveredGroupId].y;
      homeState.cursorCurX = homeState.cursorTargetX;
      homeState.cursorCurY = homeState.cursorTargetY;
    }
  }
  frameCanvas.classList.toggle('hovering-part', Boolean(homeState.hoveredGroupId));
  mark3DActive();
};

window._get3DState = () => {
  const gl = renderer?.getContext?.();
  const boxes = {};
  for (const [k, v] of Object.entries(currentGroupScreenPos)) {
    boxes[k] = {
      x: Math.round(v.x),
      y: Math.round(v.y),
      box: v.box ? { left: Math.round(v.box.left), top: Math.round(v.box.top), w: Math.round(v.box.w), h: Math.round(v.box.h) } : null
    };
  }
  return {
    gpuMode: window._gpuPipelineMode,
    modelReady: window._isModelReady,
    drawCount: window._rendererDrawCount,
    scrollProgress: +homeState.scrollProgress.toFixed(4),
    hoveredGroupId: homeState.hoveredGroupId,
    focusedGroupId: window.focusedGroupId || null,
    cameraPos: [camera.position.x, camera.position.y, camera.position.z].map((n) => +n.toFixed(3)),
    controlsTarget: [controls.target.x, controls.target.y, controls.target.z].map((n) => +n.toFixed(3)),
    glRenderer: gl ? gl.getParameter(gl.RENDERER) : null,
    drawCalls: renderer.info?.render?.calls ?? 0,
    triangles: renderer.info?.render?.triangles ?? 0,
    groupBoxes: boxes
  };
};

export function initCursorAndRaycaster() {
  frameCanvas.addEventListener('pointermove', (e) => {
    homeState.cursorTargetX = e.clientX;
    homeState.cursorTargetY = e.clientY;
    homeState.pointerInsideWindow = true;
    mark3DActive();

    if (homeState.m0IsDragging || homeState.focusedGroupId) return;

    const hit = findNearestGroupAtPoint(e.clientX, e.clientY);
    if (hit !== homeState.hoveredGroupId) {
      homeState.hoveredGroupId = hit;
      document.body.style.cursor = hit ? 'pointer' : 'default';
      homeState.force3DRedraw = true;
    }
  });

  frameCanvas.addEventListener('pointerleave', () => {
    if (homeState.hoveredGroupId) {
      homeState.hoveredGroupId = null;
      document.body.style.cursor = 'default';
      homeState.force3DRedraw = true;
    }
  });

  frameCanvas.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
    mark3DActive();
  });

  frameCanvas.addEventListener('pointerup', (e) => {
    mark3DActive();
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > 6) return;
    const hit = findNearestGroupAtPoint(e.clientX, e.clientY);
    if (hit) {
      window.openCategoryDrawer(hit);
    }
  });
}
