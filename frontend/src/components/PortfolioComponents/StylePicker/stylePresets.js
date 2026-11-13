// Font and theme options for the test-site style picker.
// "default" in each list means "leave the site exactly as it is".
// `group` puts the option under a heading in the dropdown.

export const FONT_OPTIONS = [
  { id: 'default', label: 'Current' },

  { group: 'Clean & modern', id: 'inter', label: 'Inter', family: "'Inter', sans-serif", google: 'Inter:wght@300;400;500;600;700' },
  { group: 'Clean & modern', id: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk', sans-serif", google: 'Space+Grotesk:wght@300;400;500;600;700' },
  { group: 'Clean & modern', id: 'outfit', label: 'Outfit', family: "'Outfit', sans-serif", google: 'Outfit:wght@300;400;500;600;700' },
  { group: 'Clean & modern', id: 'sora', label: 'Sora', family: "'Sora', sans-serif", google: 'Sora:wght@300;400;500;600;700' },
  { group: 'Clean & modern', id: 'manrope', label: 'Manrope', family: "'Manrope', sans-serif", google: 'Manrope:wght@300;400;500;600;700' },
  { group: 'Clean & modern', id: 'plus-jakarta', label: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif", google: 'Plus+Jakarta+Sans:wght@300;400;500;600;700' },
  { group: 'Clean & modern', id: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif", google: 'Poppins:wght@300;400;500;600;700' },
  { group: 'Clean & modern', id: 'lexend', label: 'Lexend', family: "'Lexend', sans-serif", google: 'Lexend:wght@300;400;500;600;700' },
  { group: 'Clean & modern', id: 'syne', label: 'Syne', family: "'Syne', sans-serif", google: 'Syne:wght@400;500;600;700' },
  { group: 'Clean & modern', id: 'jetbrains-mono', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace", google: 'JetBrains+Mono:wght@300;400;500;600;700' },

  { group: 'Something different', id: 'fraunces', label: 'Fraunces (soft serif)', family: "'Fraunces', serif", google: 'Fraunces:wght@300;400;500;600;700' },
  { group: 'Something different', id: 'playfair', label: 'Playfair Display (elegant serif)', family: "'Playfair Display', serif", google: 'Playfair+Display:wght@400;500;600;700' },
  { group: 'Something different', id: 'barlow-condensed', label: 'Barlow Condensed (sporty)', family: "'Barlow Condensed', sans-serif", google: 'Barlow+Condensed:wght@300;400;500;600;700' },
  { group: 'Something different', id: 'rajdhani', label: 'Rajdhani (techy)', family: "'Rajdhani', sans-serif", google: 'Rajdhani:wght@300;400;500;600;700' },
  { group: 'Something different', id: 'orbitron', label: 'Orbitron (futuristic)', family: "'Orbitron', sans-serif", google: 'Orbitron:wght@400;500;600;700' },
  { group: 'Something different', id: 'nunito', label: 'Nunito (rounded)', family: "'Nunito', sans-serif", google: 'Nunito:wght@300;400;500;600;700' },
  { group: 'Something different', id: 'courier-prime', label: 'Courier Prime (typewriter)', family: "'Courier Prime', monospace", google: 'Courier+Prime:wght@400;700' },
  { group: 'Something different', id: 'vt323', label: 'VT323 (retro terminal)', family: "'VT323', monospace", google: 'VT323' },
];

// `vars: true` themes are built from colour variables (see StylePicker.css);
// `light: true` themes get a light picker bar.
export const THEME_OPTIONS = [
  { id: 'default', label: 'Current' },

  { group: 'Originals', id: 'midnight-glass', label: 'Midnight Glass' },
  { group: 'Originals', id: 'aurora', label: 'Aurora' },
  { group: 'Originals', id: 'paper', label: 'Paper', light: true },
  { group: 'Originals', id: 'synthwave', label: 'Synthwave' },
  { group: 'Originals', id: 'ember', label: 'Ember' },

  { group: 'New', id: 'true-dark', label: 'True Dark', vars: true },
  { group: 'New', id: 'nord', label: 'Nord', vars: true },
  { group: 'New', id: 'dracula', label: 'Dracula', vars: true },
  { group: 'New', id: 'terminal', label: 'Terminal', vars: true },
  { group: 'New', id: 'cyberpunk', label: 'Cyberpunk', vars: true },
  { group: 'New', id: 'ocean', label: 'Ocean', vars: true },
  { group: 'New', id: 'forest', label: 'Forest', vars: true },
  { group: 'New', id: 'sakura', label: 'Sakura', vars: true },
  { group: 'New', id: 'royal', label: 'Royal', vars: true },
  { group: 'New', id: 'arctic', label: 'Arctic (light)', vars: true, light: true },
];

// Splits an option list into [ungrouped options, [groupName, options][]] for <optgroup>s.
export const groupOptions = (options) => {
  const loose = options.filter((o) => !o.group);
  const groups = [];
  options
    .filter((o) => o.group)
    .forEach((o) => {
      const existing = groups.find(([name]) => name === o.group);
      if (existing) existing[1].push(o);
      else groups.push([o.group, [o]]);
    });
  return [loose, groups];
};

// The picker exists only for previewing; never show it on the live domain.
const LIVE_HOSTS = ['jonathanrainey.dev', 'www.jonathanrainey.dev'];
export const isPreviewSite = () =>
  typeof window !== 'undefined' && !LIVE_HOSTS.includes(window.location.hostname);
