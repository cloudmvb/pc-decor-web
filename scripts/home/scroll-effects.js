/* ============================================================================
   S25 // SKYCRUMB — SCROLL REVEAL TIMELINE & BACK-NAVIGATION RESTORE
   ============================================================================ */

import { homeState, renderParams } from './state.js';
import { ensureFullCatalogLoaded } from './catalog-store.js';
import { mark3DActive } from './studio-engine.js';
import {
  SCROLL_STOPS,
  getStageScrollMax,
  updateStageVerticalSlide
} from './scroll-camera.js';
import {
  sec1EdEl,
  sec2BuildsEl,
  sec1SnapTo
} from './sec1-sec2-builds.js';
import { sec3BuilderEl } from './sec3-builder.js';
import { sec4SetupEl } from './sec4-ecosystem-booking.js';
import { sec5LookbookEl } from './sec5-lookbook.js';
import { sec6CaseGameEl } from './sec6-case-game.js';

// Split each section headline into non-breaking word containers + sequential character tokens
function prepareTokenReveal(el) {
  if (!el || el.dataset.tokensReady) return;
  const rawText = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!rawText) return;
  el.setAttribute('aria-label', rawText);
  const words = rawText.split(' ');
  const totalChars = Math.max(1, words.join('').length);
  let charIdx = 0;
  const html = words.map((word) => {
    const charsHtml = [...word].map((ch) => {
      const cs = ((charIdx / totalChars) * 0.72).toFixed(4);
      const cd = charIdx;
      charIdx++;
      return `<span class="s25-ch" aria-hidden="true" style="--cs:${cs};--cd:${cd}">${ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch}</span>`;
    }).join('');
    return `<span class="s25-word" aria-hidden="true">${charsHtml}</span>`;
  }).join(' ');
  el.innerHTML = html;
  el.dataset.tokensReady = '1';
}
document.querySelectorAll('.s25-ed-line > span, #sec1Title, .sec3-title, .sec4-title, .sec5-title, .sec6-title').forEach(prepareTokenReveal);

function prepareSubtextReveal(el) {
  if (!el || el.dataset.subTokensReady) return;
  const fragNodes = [...el.childNodes];
  const tokens = [];
  const newFrag = document.createDocumentFragment();
  fragNodes.forEach((node) => {
    if (node.nodeType === 3) {
      const parts = node.textContent.split(/(\s+)/);
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          newFrag.appendChild(document.createTextNode(' '));
        } else {
          const span = document.createElement('span');
          span.className = 's25-sub-w';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = part;
          tokens.push(span);
          newFrag.appendChild(span);
        }
      });
    } else if (node.nodeType === 1) {
      node.classList.add('s25-sub-w');
      tokens.push(node);
      newFrag.appendChild(node);
    }
  });
  const total = Math.max(1, tokens.length);
  tokens.forEach((tok, idx) => {
    tok.style.setProperty('--sw', ((idx / total) * 0.74).toFixed(4));
    tok.style.setProperty('--sd', String(idx));
  });
  el.setAttribute('aria-label', (el.textContent || '').replace(/\s+/g, ' ').trim());
  el.innerHTML = '';
  el.appendChild(newFrag);
  el.dataset.subTokensReady = '1';
}
document.querySelectorAll('.s25-ed-cols p, .sec1-sub, .sec3-sub, .sec4-sub, .sec5-sub, .sec6-sub').forEach(prepareSubtextReveal);

// Align Section 2 carousel to left margin and scrub Editorial + Builds + Builder smoothly with scroll
sec1SnapTo(homeState.sec1Spot);
homeState.sec1X = homeState.sec1TargetX;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const twoBeatTimers = new WeakMap();
/**
 * Separate Beat 1 (display headline) from Beat 2 (smaller description text)
 * across sections while preserving immediate reveal on deep jump/back-restore.
 */
function updateTwoBeatSection(el, headClass, subClass, enter, exit, subDelayMs, subImmediate) {
  if (!el) return;
  let store = twoBeatTimers.get(el);
  if (!store) {
    store = {};
    twoBeatTimers.set(el, store);
  }
  if (enter) {
    const wasHeadOn = el.classList.contains(headClass);
    if (!wasHeadOn) el.classList.add(headClass);
    if (subImmediate && !el.classList.contains(subClass)) {
      clearTimeout(store[subClass]);
      store[subClass] = 0;
      el.classList.add(subClass);
    } else if (!el.classList.contains(subClass) && !store[subClass]) {
      store[subClass] = setTimeout(() => {
        store[subClass] = 0;
        if (el.classList.contains(headClass)) el.classList.add(subClass);
      }, subDelayMs);
    }
  } else if (exit) {
    clearTimeout(store[subClass]);
    store[subClass] = 0;
    el.classList.remove(headClass, subClass);
  }
}

export function updateScrollScrubbedSections() {
  const vh = window.innerHeight || 900;
  const stageMax = getStageScrollMax();
  const o = Math.max(0, (window.scrollY - stageMax) / vh);
  const scrimIn = clamp01((o - 0.14) / 0.24);
  const scrimOut = clamp01((0.92 - o) / 0.30);
  document.body.style.setProperty('--s1-scrim', (scrimIn * scrimOut).toFixed(3));
  if (sec1EdEl) {
    if (o >= 0.08) sec1EdEl.classList.add('s1-p1-on');
    else if (o <= 0.03) sec1EdEl.classList.remove('s1-p1-on');
    updateTwoBeatSection(
      sec1EdEl,
      's1-p2-on',
      's1-sub-on',
      o >= 0.54,
      o <= 0.51,
      680,
      o >= 1.35 && !sec1EdEl.classList.contains('s1-p2-on')
    );
  }
  let r2Top = 1e9;
  if (sec2BuildsEl) {
    const r2 = sec2BuildsEl.getBoundingClientRect();
    r2Top = r2.top;
    updateTwoBeatSection(
      sec2BuildsEl,
      'revealed',
      'sub-revealed',
      r2.top <= vh * 0.90,
      r2.top > vh * 1.04,
      660,
      r2.top <= vh * 0.12 && !sec2BuildsEl.classList.contains('revealed')
    );
    const bgMix = clamp01((vh * 0.92 - r2.top) / (vh * 0.56));
    document.body.style.setProperty('--s2-bg', bgMix.toFixed(3));
    document.body.classList.toggle('sec2-sky-on', bgMix >= 0.35);
  }
  let r3Top = 1e9;
  if (sec3BuilderEl) {
    const r3 = sec3BuilderEl.getBoundingClientRect();
    r3Top = r3.top;
    if (r3.top <= vh * 1.15) ensureFullCatalogLoaded();
    updateTwoBeatSection(
      sec3BuilderEl,
      'revealed',
      'sub-revealed',
      r3.top <= vh * 0.90,
      r3.top > vh * 1.04,
      660,
      r3.top <= vh * 0.12 && !sec3BuilderEl.classList.contains('revealed')
    );
  }
  if (sec4SetupEl) {
    const r4 = sec4SetupEl.getBoundingClientRect();
    if (r4.top <= vh * 1.35) ensureFullCatalogLoaded();
    updateTwoBeatSection(
      sec4SetupEl,
      'revealed',
      'sub-revealed',
      r4.top <= vh * 0.90,
      r4.top > vh * 1.04,
      660,
      r4.top <= vh * 0.12 && !sec4SetupEl.classList.contains('revealed')
    );
  }
  if (sec5LookbookEl) {
    const r5 = sec5LookbookEl.getBoundingClientRect();
    if (r5.top <= vh * 1.45) ensureFullCatalogLoaded();
    updateTwoBeatSection(
      sec5LookbookEl,
      'revealed',
      'sub-revealed',
      r5.top <= vh * 0.90,
      r5.top > vh * 1.04,
      660,
      r5.top <= vh * 0.12 && !sec5LookbookEl.classList.contains('revealed')
    );
  }
  if (sec6CaseGameEl) {
    const r6 = sec6CaseGameEl.getBoundingClientRect();
    if (r6.top <= vh * 1.45) ensureFullCatalogLoaded();
    updateTwoBeatSection(
      sec6CaseGameEl,
      'revealed',
      'sub-revealed',
      r6.top <= vh * 0.90,
      r6.top > vh * 1.04,
      660,
      r6.top <= vh * 0.12 && !sec6CaseGameEl.classList.contains('revealed')
    );
  }
}
updateScrollScrubbedSections();

const HOME_SCROLL_STORAGE_KEY = 's25_home_scroll_y';
const persistHomeScrollY = (yVal) => {
  try { sessionStorage.setItem(HOME_SCROLL_STORAGE_KEY, String(Math.max(0, Math.round(yVal)))); } catch {}
};
const syncStateFromScrollY = () => {
  const yNow = window.scrollY;
  const foldP = updateStageVerticalSlide(yNow);
  if (foldP !== null) {
    homeState.isTweeningScroll = false;
    homeState.targetScrollProgress = foldP;
    homeState.scrollProgress = foldP;
    homeState.currentStopIdx = SCROLL_STOPS.length - 1;
  } else {
    const rawP = Math.max(0, Math.min(1, yNow / getStageScrollMax()));
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
  }
  window._backCamSnapPending = true;
  mark3DActive();
  homeState.force3DRedraw = true;
};

window.addEventListener('scroll', () => {
  if (homeState.homeScrollRestoring) return;
  clearTimeout(homeState.homeScrollSaveTimer);
  homeState.homeScrollSaveTimer = setTimeout(() => persistHomeScrollY(window.scrollY), 100);
}, { passive: true });
window.addEventListener('pagehide', () => {
  if (!homeState.homeScrollRestoring) persistHomeScrollY(window.scrollY);
});

const hasDeepViewParam = renderParams.has('sec') || renderParams.has('p') || renderParams.has('drawer') || renderParams.has('hover');
if (!hasDeepViewParam) {
  const resetHomeScrollTop = () => {
    window.scrollTo(0, 0);
    homeState.targetScrollProgress = 0;
    homeState.scrollProgress = 0;
    homeState.currentStopIdx = 0;
    updateStageVerticalSlide(0);
    persistHomeScrollY(0);
  };
  let initialSavedBackY = 0;
  try { initialSavedBackY = Number(sessionStorage.getItem(HOME_SCROLL_STORAGE_KEY) || '0') || 0; } catch {}
  const restoreHomeBackScroll = (done) => {
    const restoreY = Math.max(window.scrollY, initialSavedBackY);
    if (restoreY > 0) window.scrollTo(0, restoreY);
    if (done) {
      homeState.homeScrollRestoring = false;
      persistHomeScrollY(window.scrollY);
    }
    syncStateFromScrollY();
  };

  if (window.__S25_IS_BACK_NAV) {
    restoreHomeBackScroll(false);
    window.addEventListener('load', () => {
      restoreHomeBackScroll(false);
      setTimeout(() => restoreHomeBackScroll(true), 40);
    });
  } else {
    try { sessionStorage.removeItem(HOME_SCROLL_STORAGE_KEY); } catch {}
    window.addEventListener('load', () => {
      if (window.__S25_IS_BACK_NAV) return;
      resetHomeScrollTop();
      setTimeout(resetHomeScrollTop, 40);
    });
  }

  window.addEventListener('pageshow', (e) => {
    // When returning via browser Back (bfcache OR cold back_forward), preserve prior milestone!
    if (e.persisted) {
      homeState.homeScrollRestoring = false;
      syncStateFromScrollY();
    }
  });
}

window.openSec1 = () => window.scrollToSection && window.scrollToSection('sec1Editorial');
const secParam = renderParams.get('sec');
if (secParam === '1' || secParam === '2' || secParam === '3' || secParam === '4' || secParam === '5' || secParam === '6') {
  const alignSecTarget = () => {
    const targetEl = secParam === '6'
      ? sec6CaseGameEl
      : (secParam === '5' ? sec5LookbookEl : (secParam === '4' ? sec4SetupEl : (secParam === '3' ? sec3BuilderEl : (secParam === '2' ? sec2BuildsEl : sec1EdEl))));
    if (!targetEl) return;
    targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
    updateStageVerticalSlide(window.scrollY);
    if (sec1EdEl) sec1EdEl.classList.add('revealed', 's1-p1-on', 's1-p2-on', 's1-sub-on');
    if (sec2BuildsEl && (secParam === '2' || secParam === '3' || secParam === '4' || secParam === '5' || secParam === '6')) sec2BuildsEl.classList.add('revealed', 'sub-revealed');
    if (sec3BuilderEl && (secParam === '3' || secParam === '4' || secParam === '5' || secParam === '6')) sec3BuilderEl.classList.add('revealed', 'sub-revealed');
    if (sec4SetupEl && (secParam === '4' || secParam === '5' || secParam === '6')) sec4SetupEl.classList.add('revealed', 'sub-revealed');
    if (sec5LookbookEl && (secParam === '5' || secParam === '6')) sec5LookbookEl.classList.add('revealed', 'sub-revealed');
    if (sec6CaseGameEl && secParam === '6') sec6CaseGameEl.classList.add('revealed', 'sub-revealed');
  };
  requestAnimationFrame(alignSecTarget);
  if (secParam === '3' || secParam === '4' || secParam === '5' || secParam === '6') {
    ensureFullCatalogLoaded().then(() => requestAnimationFrame(alignSecTarget));
  }
}

