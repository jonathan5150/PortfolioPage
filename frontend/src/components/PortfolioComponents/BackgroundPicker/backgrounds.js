// Dark page backgrounds to try out. Each sets the page colour and an optional
// image layer (gradients / patterns), used by every page through the
// --pv-page and --pv-page-img variables (see BackgroundPicker.css).
const grain = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>",
);

export const BACKGROUNDS = [
  { key: 'plain', label: 'Plain dark', page: '#111111', img: 'none' },
  { key: 'black', label: 'Pure black', page: '#000000', img: 'none' },
  { key: 'charcoal', label: 'Charcoal', page: '#1a1a1a', img: 'none' },
  { key: 'graphite', label: 'Graphite', page: '#202226', img: 'none' },
  { key: 'slate', label: 'Slate', page: '#141a20', img: 'none' },
  { key: 'midnight', label: 'Midnight blue', page: '#0a0f1e', img: 'none' },
  { key: 'espresso', label: 'Espresso', page: '#15100c', img: 'none' },
  { key: 'forest', label: 'Forest night', page: '#0a120d', img: 'none' },
  { key: 'plum', label: 'Plum night', page: '#120c16', img: 'none' },
  {
    key: 'steel',
    label: 'Steel fade',
    page: '#0d0e10',
    img: 'linear-gradient(160deg, #1d2024 0%, #0d0e10 60%, #08090a 100%)',
  },
  {
    key: 'navy-fade',
    label: 'Navy fade',
    page: '#05070d',
    img: 'linear-gradient(180deg, #0f1730 0%, #05070d 70%)',
  },
  {
    key: 'vignette',
    label: 'Vignette',
    page: '#050505',
    img: 'radial-gradient(ellipse at 50% 40%, #1e1e1e 0%, #0c0c0c 55%, #030303 100%)',
  },
  {
    key: 'spotlight',
    label: 'Spotlight',
    page: '#0a0a0a',
    img: 'radial-gradient(70% 45% at 50% 0%, rgba(255, 255, 255, 0.09), transparent 70%)',
  },
  {
    key: 'stadium',
    label: 'Stadium lights',
    page: '#090909',
    img: 'radial-gradient(40% 30% at 0% 0%, rgba(255, 255, 255, 0.08), transparent 70%), radial-gradient(40% 30% at 100% 0%, rgba(255, 255, 255, 0.08), transparent 70%)',
  },
  {
    key: 'gold-glow',
    label: 'Gold glow',
    page: '#0b0a08',
    img: 'radial-gradient(60% 40% at 50% 0%, rgba(245, 209, 107, 0.1), transparent 70%)',
  },
  {
    key: 'ember',
    label: 'Ember',
    page: '#0b0808',
    img: 'radial-gradient(70% 40% at 50% 100%, rgba(230, 57, 70, 0.14), transparent 70%)',
  },
  {
    key: 'carbon',
    label: 'Carbon fiber',
    page: '#121212',
    img: 'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.025) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.35) 0 2px, transparent 2px 4px)',
  },
  {
    key: 'grid',
    label: 'Fine grid',
    page: '#0e0e0e',
    img: 'linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)',
    size: '24px 24px',
  },
  {
    key: 'pinstripe',
    label: 'Pinstripe',
    page: '#0f0f0f',
    img: 'repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 9px)',
  },
  {
    key: 'dots',
    label: 'Dot matrix',
    page: '#0d0d0d',
    img: 'radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1.4px)',
    size: '14px 14px',
  },
  {
    key: 'grain',
    label: 'Film grain',
    page: '#101010',
    img: `url("data:image/svg+xml,${grain}")`,
  },
];

export const DEFAULT_BACKGROUND = 'plain';
const STORE = 'siteBackground';

export const savedBackground = () => {
  try {
    const key = window.localStorage.getItem(STORE);
    return BACKGROUNDS.some((b) => b.key === key) ? key : DEFAULT_BACKGROUND;
  } catch {
    return DEFAULT_BACKGROUND;
  }
};

// Sets the page variables on <html> (so every page, portfolio and sports, follows).
export const applyBackground = (key) => {
  const bg = BACKGROUNDS.find((b) => b.key === key) || BACKGROUNDS[0];
  const root = document.documentElement;
  root.dataset.bg = bg.key;
  root.style.setProperty('--pv-page', bg.page);
  root.style.setProperty('--pv-page-img', bg.img);
  root.style.setProperty('--pv-page-size', bg.size || 'auto');
  try {
    window.localStorage.setItem(STORE, bg.key);
  } catch {
    // storage blocked
  }
};
