// Font and theme options for the test-site style picker.
// "default" in each list means "leave the site exactly as it is".

export const FONT_OPTIONS = [
  { id: 'default', label: 'Current' },

  { id: 'inter', label: 'Inter', family: "'Inter', sans-serif", google: 'Inter:wght@300;400;500;600;700' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk', sans-serif", google: 'Space+Grotesk:wght@300;400;500;600;700' },
  { id: 'outfit', label: 'Outfit', family: "'Outfit', sans-serif", google: 'Outfit:wght@300;400;500;600;700' },
  { id: 'sora', label: 'Sora', family: "'Sora', sans-serif", google: 'Sora:wght@300;400;500;600;700' },
  { id: 'manrope', label: 'Manrope', family: "'Manrope', sans-serif", google: 'Manrope:wght@300;400;500;600;700' },
  { id: 'plus-jakarta', label: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif", google: 'Plus+Jakarta+Sans:wght@300;400;500;600;700' },
  { id: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif", google: 'Poppins:wght@300;400;500;600;700' },
  { id: 'lexend', label: 'Lexend', family: "'Lexend', sans-serif", google: 'Lexend:wght@300;400;500;600;700' },
  { id: 'syne', label: 'Syne', family: "'Syne', sans-serif", google: 'Syne:wght@400;500;600;700' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace", google: 'JetBrains+Mono:wght@300;400;500;600;700' },

  { id: 'fraunces', label: 'Fraunces (soft serif)', family: "'Fraunces', serif", google: 'Fraunces:wght@300;400;500;600;700' },
  { id: 'playfair', label: 'Playfair Display (elegant serif)', family: "'Playfair Display', serif", google: 'Playfair+Display:wght@400;500;600;700' },
  { id: 'barlow-condensed', label: 'Barlow Condensed (sporty)', family: "'Barlow Condensed', sans-serif", google: 'Barlow+Condensed:wght@300;400;500;600;700' },
  { id: 'rajdhani', label: 'Rajdhani (techy)', family: "'Rajdhani', sans-serif", google: 'Rajdhani:wght@300;400;500;600;700' },
  { id: 'orbitron', label: 'Orbitron (futuristic)', family: "'Orbitron', sans-serif", google: 'Orbitron:wght@400;500;600;700' },
  { id: 'nunito', label: 'Nunito (rounded)', family: "'Nunito', sans-serif", google: 'Nunito:wght@300;400;500;600;700' },
  { id: 'courier-prime', label: 'Courier Prime (typewriter)', family: "'Courier Prime', monospace", google: 'Courier+Prime:wght@400;700' },
  { id: 'vt323', label: 'VT323 (retro terminal)', family: "'VT323', monospace", google: 'VT323' },
  { id: 'bebas', label: 'Bebas Neue (tall caps)', family: "'Bebas Neue', sans-serif", google: 'Bebas+Neue' },
  { id: 'anton', label: 'Anton (heavy condensed)', family: "'Anton', sans-serif", google: 'Anton' },
  { id: 'teko', label: 'Teko (scoreboard)', family: "'Teko', sans-serif", google: 'Teko:wght@300;400;500;600;700' },
  { id: 'russo', label: 'Russo One (blocky sport)', family: "'Russo One', sans-serif", google: 'Russo+One' },
  { id: 'saira-condensed', label: 'Saira Condensed (jersey)', family: "'Saira Condensed', sans-serif", google: 'Saira+Condensed:wght@300;400;500;600;700' },
  { id: 'kanit', label: 'Kanit (punchy)', family: "'Kanit', sans-serif", google: 'Kanit:wght@300;400;500;600;700' },
  { id: 'archivo', label: 'Archivo (grotesk)', family: "'Archivo', sans-serif", google: 'Archivo:wght@300;400;500;600;700' },
  { id: 'bricolage', label: 'Bricolage Grotesque (quirky)', family: "'Bricolage Grotesque', sans-serif", google: 'Bricolage+Grotesque:wght@300;400;500;600;700' },
  { id: 'unbounded', label: 'Unbounded (wide round)', family: "'Unbounded', sans-serif", google: 'Unbounded:wght@300;400;500;600;700' },
  { id: 'michroma', label: 'Michroma (wide tech)', family: "'Michroma', sans-serif", google: 'Michroma' },
  { id: 'audiowide', label: 'Audiowide (sci-fi)', family: "'Audiowide', sans-serif", google: 'Audiowide' },
  { id: 'chakra-petch', label: 'Chakra Petch (angular)', family: "'Chakra Petch', sans-serif", google: 'Chakra+Petch:wght@300;400;500;600;700' },
  { id: 'exo2', label: 'Exo 2 (space age)', family: "'Exo 2', sans-serif", google: 'Exo+2:wght@300;400;500;600;700' },
  { id: 'righteous', label: 'Righteous (retro)', family: "'Righteous', sans-serif", google: 'Righteous' },
  { id: 'bungee', label: 'Bungee (street signage)', family: "'Bungee', sans-serif", google: 'Bungee' },
  { id: 'silkscreen', label: 'Silkscreen (pixel)', family: "'Silkscreen', sans-serif", google: 'Silkscreen:wght@400;700' },
  { id: 'dm-serif', label: 'DM Serif Display (bold serif)', family: "'DM Serif Display', serif", google: 'DM+Serif+Display' },
  { id: 'cormorant', label: 'Cormorant Garamond (classic serif)', family: "'Cormorant Garamond', serif", google: 'Cormorant+Garamond:wght@300;400;500;600;700' },
  { id: 'caveat', label: 'Caveat (handwritten)', family: "'Caveat', cursive", google: 'Caveat:wght@400;500;600;700' },
  { id: 'permanent-marker', label: 'Permanent Marker (marker)', family: "'Permanent Marker', cursive", google: 'Permanent+Marker' },
];

// `vars: true` themes are built from colour variables (see StylePicker.css);
// `light: true` themes get a light picker bar; `logos: true` themes restyle the
// team-cell logos (bigger, and an effect when a game is opened).
export const THEME_OPTIONS = [
  { id: 'default', label: 'Current' },

  { id: 'midnight-glass', label: 'Midnight Glass' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'paper', label: 'Paper', light: true },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'ember', label: 'Ember' },

  { id: 'true-dark', label: 'True Dark', vars: true },
  { id: 'nord', label: 'Nord', vars: true },
  { id: 'dracula', label: 'Dracula', vars: true },
  { id: 'terminal', label: 'Terminal', vars: true },
  { id: 'cyberpunk', label: 'Cyberpunk', vars: true },
  { id: 'ocean', label: 'Ocean', vars: true },
  { id: 'forest', label: 'Forest', vars: true },
  { id: 'sakura', label: 'Sakura', vars: true },
  { id: 'royal', label: 'Royal', vars: true },
  { id: 'arctic', label: 'Arctic (light)', vars: true, light: true },
  { id: 'jumbotron', label: 'Jumbotron', vars: true, logos: true },
  { id: 'holo', label: 'Holo Foil', vars: true, logos: true },
  { id: 'neon-sign', label: 'Neon Sign', vars: true, logos: true },
  { id: 'poster', label: 'Poster', vars: true, logos: true },
  { id: 'glitch', label: 'Glitch', vars: true, logos: true },
];

// The picker exists only for previewing; never show it on the live domain.
const LIVE_HOSTS = ['jonathanrainey.dev', 'www.jonathanrainey.dev'];
export const isPreviewSite = () =>
  typeof window !== 'undefined' && !LIVE_HOSTS.includes(window.location.hostname);
