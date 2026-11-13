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
];

export const THEME_OPTIONS = [
  { id: 'default', label: 'Current' },
  { id: 'midnight-glass', label: 'Midnight Glass' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'paper', label: 'Paper' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'ember', label: 'Ember' },
];

// The picker exists only for previewing; never show it on the live domain.
const LIVE_HOSTS = ['jonathanrainey.dev', 'www.jonathanrainey.dev'];
export const isPreviewSite = () =>
  typeof window !== 'undefined' && !LIVE_HOSTS.includes(window.location.hostname);
