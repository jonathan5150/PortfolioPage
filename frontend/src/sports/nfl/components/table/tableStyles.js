// Shared inline styles for every stat panel (mirrors the MLB panels' look).

export const viewportStyle = {
  width: '100%',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  overflow: 'hidden',
  background: 'rgba(30, 30, 30, 0.55)',
};

export const sectionTitleStyle = {
  padding: '6px 10px',
  background: 'rgba(255, 255, 255, 0.04)',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '0.6rem',
  fontWeight: 300,
  letterSpacing: '0.08em',
  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  textAlign: 'left',
};

export const tableStyle = {
  width: '100%',
  fontSize: '12px',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

export const thStyle = {
  padding: '5px 4px',
  fontSize: '0.6rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.82)',
  background: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export const tdStyle = {
  padding: '5px 4px',
  color: 'white',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  textAlign: 'center',
  fontSize: '0.68rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export const nameCellStyle = {
  ...tdStyle,
  textAlign: 'left',
  paddingLeft: '8px',
};

export const totalRowStyle = {
  fontWeight: 700,
  background: 'rgba(255,255,255,0.04)',
};

export const messageStyle = {
  padding: '14px 10px',
  textAlign: 'center',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '0.7rem',
};

export const sourceNoteStyle = {
  padding: '4px 8px',
  textAlign: 'right',
  color: 'rgba(255,255,255,0.45)',
  fontSize: '0.55rem',
};
