/* ============================================================================
   S25 // SKYCRUMB — HOMEPAGE SHARED MUTABLE STATE
   Central state bag & URL query parameters shared cleanly across home modules
   to avoid cyclic ES module live-binding reassignment issues.
   ============================================================================ */

export const renderParams = new URLSearchParams(location.search);

export const homeState = {
  // Theme & ambient canvas accent
  currentThemeName: 'sky',
  force3DRedraw: true,
  cachedConstellationColor: '#38bdf8',

  // Lazy full-catalog loading
  isFullCatalogLoaded: Array.isArray(window.TTG_CATALOG_DATA) && window.TTG_CATALOG_DATA.length > 200,
  fullCatalogPromise: null,

  // 3D studio scene & user interaction
  coverDismissed: false,
  modelScene: null,
  m0AutoSpin: true,
  m0IsDragging: false,
  hoveredGroupId: null,
  last3DInteractionAt: performance.now(),
  last3DRenderKey: '',

  // 6-stop scrollytelling & camera choreography
  currentStopIdx: 0,
  wheelStepLocked: false,
  scrollProgress: 0,
  prevScrollProgress: 0,
  targetScrollProgress: 0,
  focusedGroupId: null,
  isTweeningScroll: false,
  tweenStartP: 0,
  tweenEndP: 0,
  tweenStartTime: 0,
  tweenDurationMs: 500,
  ignoreNativeScrollUntil: 0,
  globalTickScale: 1.0,
  outroTweenActive: false,
  outroTweenToken: 0,
  outroShrinkDeskAlpha: 1.0,
  prevCamState: 'm0',
  lastSceneAppliedP: -1,
  lastDeskShrinkAlpha: 1.0,
  lastSpinSig: '',

  // Magnetic cursor pill
  cursorTargetX: -200,
  cursorTargetY: -200,
  cursorCurX: -200,
  cursorCurY: -200,
  pointerInsideWindow: false,
  lastPillKey: '',

  // Section 1 carousel physics
  sec1X: 0,
  sec1TargetX: 0,
  sec1Vel: 0,
  sec1Dragging: false,
  sec1Spot: 0,

  // Homepage scroll position persistence & back-nav restoration
  homeScrollRestoring: Boolean(window.__S25_IS_BACK_NAV),
  homeScrollSaveTimer: 0
};

