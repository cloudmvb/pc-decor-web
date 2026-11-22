/* ============================================================================
   S25 // SKYCRUMB — THEME ENGINE & STUDIO PALETTES
   ============================================================================ */

import { homeState, renderParams } from './state.js';

// =========================================================================
// 3. THEME SWITCHER (DOM CSS + THREE.JS STUDIO LIGHTING SYNC)
// =========================================================================
export function refreshConstellationColor() {
  try {
    homeState.cachedConstellationColor = getComputedStyle(document.body).getPropertyValue('--constellation-color').trim() || '#38bdf8';
  } catch (_) {}
}

export const THEME_PRESETS = {
  sky: {
    deskColor: 0xf8fafc, deskTrimColor: 0xe2c799,
    ambientColor: 0xf0f8ff, ambientIntensity: 0.50, keyIntensity: 1.9, exposure: 0.92
  }
};


window.switchTheme = () => {
  homeState.currentThemeName = 'sky';
  document.body.setAttribute('data-theme', 'sky');
  document.querySelectorAll('.theme-dot').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === 'sky');
  });
  refreshConstellationColor();
  if (window._applyStudioTheme) window._applyStudioTheme('sky');
  try { localStorage.setItem('s25_theme_v1', 'sky'); } catch (_) {}
  homeState.force3DRedraw = true;
};

