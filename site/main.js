import { messages } from './i18n.js';

const REPO = 'Jeromearsene/cenacle-AI';
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const LANG_KEY = 'cenacle-lang';
const THEME_KEY = 'cenacle-theme';
const CACHE_KEY = 'cenacle-release';
const CACHE_MS = 10 * 60 * 1000;
const PROVIDER_COUNT = 4;

// Installer names look like Cenacle-0.7.0-mac-arm64.dmg (see artifactName in electron-builder.yml).
const ASSET_PATTERNS = {
  macArm: /-mac-arm64\.dmg$/,
  macIntel: /-mac-x64\.dmg$/,
  win: /-win-x64\.exe$/,
  appImage: /\.AppImage$/,
  deb: /\.deb$/,
};

const OS_NAMES = { mac: 'macOS', win: 'Windows', linux: 'Linux' };
const OS_HERO = {
  mac: { hint: 'hintMac', asset: 'macArm' },
  win: { hint: 'hintWin', asset: 'win' },
  linux: { hint: 'hintLinux', asset: 'appImage' },
};

const root = document.documentElement;
const state = {
  lang: 'en',
  themeMode: 'auto',
  os: detectOs(),
  release: null,
};

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked: the choice then only lasts until the page is closed.
  }
}

function detectLang() {
  const saved = readStored(LANG_KEY);
  if (saved === 'fr' || saved === 'en') return saved;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const language of languages) {
    const code = String(language).toLowerCase();
    if (code.startsWith('fr')) return 'fr';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

function detectOs() {
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(ua)) return 'mobile';
  // iPadOS announces itself as a Mac, with a touch screen.
  if (platform.includes('mac') && navigator.maxTouchPoints > 1) return 'mobile';
  if (platform.includes('win') || ua.includes('windows')) return 'win';
  if (platform.includes('mac') || ua.includes('macintosh')) return 'mac';
  if (platform.includes('linux') || ua.includes('x11') || ua.includes('cros')) return 'linux';
  return 'unknown';
}

function text(key) {
  return messages[state.lang][key] ?? messages.en[key] ?? key;
}

function isDark() {
  return root.dataset.theme === 'dark';
}

function applyTexts() {
  root.lang = state.lang;
  document.title = text('titleTag');
  document.querySelector('meta[name="description"]')?.setAttribute('content', text('metaDesc'));

  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.dataset.i18n;
    let value = text(key);
    if (el.dataset.n) value = value.replace('{n}', String(PROVIDER_COUNT));
    el.textContent = value;
  }
  for (const el of document.querySelectorAll('[data-i18n-alt]')) {
    el.setAttribute('alt', text(el.dataset.i18nAlt));
  }
  for (const el of document.querySelectorAll('[data-i18n-label]')) {
    el.setAttribute('aria-label', text(el.dataset.i18nLabel));
  }
  for (const el of document.querySelectorAll('[data-href-en]')) {
    el.setAttribute('href', state.lang === 'fr' ? el.dataset.hrefFr : el.dataset.hrefEn);
  }
  for (const button of document.querySelectorAll('[data-lang-set]')) {
    button.setAttribute('aria-pressed', String(button.dataset.langSet === state.lang));
  }
}

function shotSource(name) {
  const prefix = state.lang === 'fr' ? 'fr-' : '';
  if (name === 'grid') return `assets/${prefix}grid${isDark() ? '-dark' : ''}.png`;
  if (name === 'grid-other-theme') return `assets/${prefix}grid${isDark() ? '' : '-dark'}.png`;
  return `assets/${prefix}${name}.png`;
}

function applyShots() {
  for (const img of document.querySelectorAll('[data-shot]')) {
    img.setAttribute('src', shotSource(img.dataset.shot));
  }
}

function applyTheme() {
  const dark =
    state.themeMode === 'dark' ||
    (state.themeMode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  for (const button of document.querySelectorAll('[data-theme-set]')) {
    button.setAttribute('aria-pressed', String(button.dataset.themeSet === state.themeMode));
  }
  applyShots();
}

function assetUrl(key) {
  const assets = state.release?.assets;
  if (!Array.isArray(assets)) return RELEASES_URL;
  const found = assets.find((asset) => ASSET_PATTERNS[key].test(asset.name));
  const url = found?.browser_download_url;
  // Only ever link to GitHub: anything else falls back to the releases page.
  return typeof url === 'string' && url.startsWith('https://github.com/') ? url : RELEASES_URL;
}

function applyDownloads() {
  const hero = OS_HERO[state.os];
  const label = document.getElementById('hero-label');
  const hint = document.getElementById('hero-hint');
  const button = document.getElementById('hero-download');
  const intel = document.getElementById('mac-intel');
  const intelLink = document.getElementById('mac-intel-link');

  if (hero) {
    label.textContent = text('dlFor').replace('{os}', OS_NAMES[state.os]);
    hint.textContent = text(hero.hint);
    button.setAttribute('href', assetUrl(hero.asset));
  } else {
    label.textContent = text('dlGeneric');
    hint.textContent = text('hintGeneric');
    button.setAttribute('href', RELEASES_URL);
  }
  intel.hidden = state.os !== 'mac';
  intelLink.setAttribute('href', assetUrl('macIntel'));

  for (const link of document.querySelectorAll('[data-asset]')) {
    link.setAttribute('href', assetUrl(link.dataset.asset));
  }
  for (const card of document.querySelectorAll('.os-card')) {
    const recommended = card.dataset.os === state.os;
    card.classList.toggle('recommended', recommended);
    card.querySelector('.badge-reco').hidden = !recommended;
  }

  const version = document.getElementById('version');
  const tag = state.release?.tag_name;
  if (typeof tag === 'string' && /^v?[\w.-]{1,20}$/.test(tag)) {
    version.textContent = ` · ${text('version').replace('{version}', tag)}`;
    version.hidden = false;
  }
}

async function loadRelease() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null');
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.release;
  } catch {
    // No cache: ask GitHub.
  }
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    const release = await response.json();
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release }));
    } catch {
      // The cache only saves a request.
    }
    return release;
  } catch {
    return null;
  }
}

function render() {
  applyTexts();
  applyDownloads();
  applyShots();
}

function setLang(lang) {
  state.lang = lang;
  writeStored(LANG_KEY, lang);
  render();
}

function setThemeMode(mode) {
  state.themeMode = mode;
  writeStored(THEME_KEY, mode);
  applyTheme();
}

function init() {
  state.lang = detectLang();
  const savedTheme = readStored(THEME_KEY);
  state.themeMode = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'auto';

  for (const button of document.querySelectorAll('[data-lang-set]')) {
    button.addEventListener('click', () => setLang(button.dataset.langSet));
  }
  for (const button of document.querySelectorAll('[data-theme-set]')) {
    button.addEventListener('click', () => setThemeMode(button.dataset.themeSet));
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.themeMode === 'auto') applyTheme();
  });

  applyTheme();
  render();
  root.classList.add('ready');

  loadRelease().then((release) => {
    if (!release) return;
    state.release = release;
    applyDownloads();
  });
}

init();
