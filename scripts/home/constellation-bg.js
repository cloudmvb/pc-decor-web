/* ============================================================================
   S25 // SKYCRUMB — AMBIENT CONSTELLATION & LEVITATION UPDRAFT 2D CANVAS
   ============================================================================ */

import { homeState, renderParams } from './state.js';
import { getStageScrollMax } from './scroll-camera.js';

// =========================================================================
// 9. SUBTLE PERIPHERAL CONSTELLATION & LEVITATION UPDRAFT AMBIENCE
// =========================================================================
const cCanvas = document.getElementById('threeuiConstellationCanvas');
const cCtx = cCanvas.getContext('2d');
let cWidth = window.innerWidth;
let cHeight = window.innerHeight;
let cNodes = [];
let updraftStreaks = [];
const C_LINK_DIST = 140;
const C_MAX_NODES = window.innerWidth < 768 ? 24 : 44;
const pointer = { x: -1000, y: -1000 };

export function resizeConstellation() {
  cWidth = window.innerWidth;
  cHeight = window.innerHeight;
  cCanvas.width = Math.max(1, Math.floor(cWidth));
  cCanvas.height = Math.max(1, Math.floor(cHeight));
  cCtx.setTransform(1, 0, 0, 1, 0, 0);
}

export function initConstellationNodes() {
  cNodes = [];
  for (let i = 0; i < C_MAX_NODES; i++) {
    cNodes.push({
      x: Math.random() * cWidth,
      y: Math.random() * cHeight,
      vx: (Math.random() - 0.5) * 0.24,
      vy: (Math.random() - 0.5) * 0.24,
      radius: Math.random() * 1.6 + 1.0
    });
  }
  updraftStreaks = [];
  for (let i = 0; i < 32; i++) {
    updraftStreaks.push({
      x: Math.random() * cWidth,
      y: Math.random() * cHeight,
      len: 32 + Math.random() * 68,
      speed: 1.2 + Math.random() * 2.4,
      alpha: 0.10 + Math.random() * 0.22
    });
  }
}

let lastConstellationAt = 0;
let constellationClearedOnce = false;
export function renderThreeUIConstellation(now) {
  if (now && now - lastConstellationAt < 38) return;
  lastConstellationAt = now || performance.now();
  if (document.body.classList.contains('sec2-sky-on') && parseFloat(document.body.style.getPropertyValue('--s2-bg') || '0') > 0.85) {
    if (!constellationClearedOnce) {
      cCtx.clearRect(0, 0, cWidth, cHeight);
      constellationClearedOnce = true;
    }
    return;
  }
  constellationClearedOnce = false;
  if (window.scrollY > (typeof getStageScrollMax === 'function' ? getStageScrollMax() + window.innerHeight * 2.5 : 9e9)) {
    return;
  }
  cCtx.clearRect(0, 0, cWidth, cHeight);
  const color = document.body.classList.contains('sec2-sky-on')
    ? 'rgba(255, 255, 255, 0.58)'
    : homeState.cachedConstellationColor;
  cCtx.strokeStyle = color;
  cCtx.fillStyle = color;
  cCtx.lineWidth = 0.8;

  const scrollVel = Math.max(0, homeState.scrollProgress - homeState.prevScrollProgress) * 480;
  const levFactor = Math.min(1, homeState.scrollProgress * 3.5);
  if (levFactor > 0.01) {
    cCtx.save();
    cCtx.strokeStyle = color;
    cCtx.lineCap = 'round';
    for (const st of updraftStreaks) {
      st.y += (st.speed * (0.45 + levFactor * 1.35) + scrollVel);
      if (st.y - st.len > cHeight) {
        st.y = -20;
        st.x = Math.random() * cWidth;
      }
      cCtx.globalAlpha = st.alpha * levFactor * (0.7 + Math.min(0.6, scrollVel * 0.04));
      cCtx.lineWidth = 1.2;
      cCtx.beginPath();
      cCtx.moveTo(st.x, st.y - st.len);
      cCtx.lineTo(st.x, st.y);
      cCtx.stroke();
    }
    cCtx.restore();
  }
  homeState.prevScrollProgress = homeState.scrollProgress;

  cCtx.globalAlpha = 0.18;
  cCtx.beginPath();
  const linkDistSq = C_LINK_DIST * C_LINK_DIST;
  for (let i = 0; i < cNodes.length; i++) {
    const ni = cNodes[i];
    for (let j = i + 1; j < cNodes.length; j++) {
      const nj = cNodes[j];
      const dx = ni.x - nj.x;
      const dy = ni.y - nj.y;
      if (dx * dx + dy * dy < linkDistSq) {
        cCtx.moveTo(ni.x, ni.y);
        cCtx.lineTo(nj.x, nj.y);
      }
    }
  }
  cCtx.stroke();

  cCtx.globalAlpha = 0.55;
  cCtx.beginPath();
  for (const node of cNodes) {
    node.x += node.vx;
    node.y += node.vy;
    if (node.x < 0 || node.x > cWidth) node.vx *= -1;
    if (node.y < 0 || node.y > cHeight) node.vy *= -1;
    cCtx.moveTo(node.x + node.radius, node.y);
    cCtx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
  }
  cCtx.fill();
  cCtx.globalAlpha = 1;
}

 

export function initConstellation() {
  window.addEventListener('resize', () => {
    clearTimeout(window._cResTimer);
    window._cResTimer = setTimeout(() => { resizeConstellation(); initConstellationNodes(); }, 200);
  });
  resizeConstellation();
  initConstellationNodes();

  document.addEventListener('mousemove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    homeState.cursorTargetX = e.clientX;
    homeState.cursorTargetY = e.clientY;
    homeState.pointerInsideWindow = true;
  }, { passive: true });
  document.addEventListener('mouseleave', () => {
    homeState.pointerInsideWindow = false;
    pointer.x = -1000;
    pointer.y = -1000;
  });
}
