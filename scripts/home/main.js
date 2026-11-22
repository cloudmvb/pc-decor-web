/* ============================================================================
   S25 // SKYCRUMB — HOMEPAGE BOOTSTRAP & 60FPS ANIMATION LOOP
   ============================================================================ */

import { homeState, renderParams } from './state.js';
import { GROUPS_CONFIG } from './config.js';
import { registerCatalogRefreshListener } from './catalog-store.js';
import './theme.js';
import { compSpinAngle, initStudioLoader } from './studio-engine.js';
import { initDrawerCart, renderDrawer } from './drawer-cart.js';
import {
  SCROLL_STOPS,
  currentGroupScreenPos,
  getStageScrollMax,
  updateStageVerticalSlide,
  updateSceneByScroll,
  renderFrameAndUI,
  registerScrollScrubUpdater,
  initScrollCameraListeners
} from './scroll-camera.js';
import { renderThreeUIConstellation, initConstellation } from './constellation-bg.js';
import { updateMagneticCursorPill, initCursorAndRaycaster } from './cursor-raycaster.js';
import { tickSec1 } from './sec1-sec2-builds.js';
import { renderSec3Builder, setBuilderLinkageHook } from './sec3-builder.js';
import { renderSec4Setup, updateSec4BuildLinkage } from './sec4-ecosystem-booking.js';
import { renderSec5Lookbook } from './sec5-lookbook.js';
import { renderSec6CaseGame } from './sec6-case-game.js';
import { updateScrollScrubbedSections } from './scroll-effects.js';

// Wire decoupled cross-section hooks
registerCatalogRefreshListener(() => {
  renderSec3Builder();
  renderSec4Setup();
  renderSec5Lookbook();
  renderSec6CaseGame();
  if (homeState.focusedGroupId && GROUPS_CONFIG[homeState.focusedGroupId]) {
    renderDrawer(GROUPS_CONFIG[homeState.focusedGroupId], homeState.focusedGroupId);
  }
});
setBuilderLinkageHook(() => updateSec4BuildLinkage());
registerScrollScrubUpdater(() => updateScrollScrubbedSections());

// Initialize UI & interaction controllers
window.switchTheme('sky');
initDrawerCart();
initScrollCameraListeners();
initConstellation();
initCursorAndRaycaster();
initStudioLoader(() => {
  updateSceneByScroll(homeState.scrollProgress);
});

// =========================================================================
// 11. MAIN 60FPS ANIMATION LOOP
// =========================================================================
let lastFrameTime = 0;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animate(currentTime) {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const now = currentTime || performance.now();
  const dt = lastFrameTime ? Math.min(50, Math.max(4, now - lastFrameTime)) : 16.6667;
  homeState.globalTickScale = dt / 16.6667;
  lastFrameTime = now;

  const forcedP = renderParams.get('p');
  if (forcedP !== null) {
    homeState.targetScrollProgress = parseFloat(forcedP);
    homeState.scrollProgress = homeState.targetScrollProgress;
    let bestIdx = 0, bestDiff = 999;
    SCROLL_STOPS.forEach((sp, i) => {
      const diff = Math.abs(homeState.scrollProgress - sp);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    homeState.currentStopIdx = bestIdx;
  }

  const forcedDrawer = renderParams.get('drawer');
  if (forcedDrawer && !window._drawerAutoOpened && GROUPS_CONFIG[forcedDrawer]) {
    window._drawerAutoOpened = true;
    if (forcedP === null) {
      homeState.targetScrollProgress = 1.0;
      homeState.scrollProgress = 1.0;
    }
    window.openCategoryDrawer(forcedDrawer);
  }

  const forcedShop = renderParams.get('shop');
  if (forcedShop && !window._shopAutoOpened) {
    window._shopAutoOpened = true;
    window.openFullShop(forcedShop);
  }

  const forcedHover = renderParams.get('hover');
  if (forcedHover && GROUPS_CONFIG[forcedHover]) {
    homeState.hoveredGroupId = forcedHover;
    homeState.pointerInsideWindow = true;
  }

  const forcedSpin = renderParams.get('spin');
  if (forcedSpin !== null && homeState.hoveredGroupId) {
    compSpinAngle[homeState.hoveredGroupId] = parseFloat(forcedSpin) * (Math.PI * 2 / 72);
  }

  if (homeState.isTweeningScroll && forcedP === null) {
    const elapsed = now - homeState.tweenStartTime;
    const rawT = Math.max(0, Math.min(1, elapsed / homeState.tweenDurationMs));
    const easedT = 1 - Math.pow(1 - rawT, 3);
    homeState.scrollProgress = homeState.tweenStartP + (homeState.tweenEndP - homeState.tweenStartP) * easedT;
    if (rawT >= 1.0) {
      homeState.scrollProgress = homeState.tweenEndP;
      homeState.isTweeningScroll = false;
    }
  } else if (forcedP === null) {
    homeState.scrollProgress += (homeState.targetScrollProgress - homeState.scrollProgress) * (1 - Math.pow(0.76, homeState.globalTickScale));
  }

  if (Math.abs((window._lastScrubY ?? -1) - window.scrollY) > 0.5) {
    window._lastScrubY = window.scrollY;
    const foldSync = updateStageVerticalSlide(window.scrollY);
    if (foldSync !== null && forcedP === null) {
      homeState.isTweeningScroll = false;
      homeState.targetScrollProgress = foldSync;
      homeState.scrollProgress = foldSync;
    } else if (
      forcedP === null &&
      !homeState.isTweeningScroll &&
      !homeState.homeScrollRestoring &&
      now >= homeState.ignoreNativeScrollUntil
    ) {
      const rawP = Math.max(0, Math.min(1, window.scrollY / getStageScrollMax()));
      homeState.targetScrollProgress = rawP;
      homeState.scrollProgress = rawP;
    }
  }

  renderFrameAndUI(homeState.scrollProgress, now);
  if (forcedHover && currentGroupScreenPos[forcedHover]) {
    homeState.cursorTargetX = currentGroupScreenPos[forcedHover].x;
    homeState.cursorTargetY = currentGroupScreenPos[forcedHover].y;
    homeState.cursorCurX = homeState.cursorTargetX;
    homeState.cursorCurY = homeState.cursorTargetY;
  }
  updateMagneticCursorPill();
  if (typeof tickSec1 === 'function') tickSec1();

  if (!prefersReducedMotion) {
    renderThreeUIConstellation(now);
  }
}
requestAnimationFrame(animate);
