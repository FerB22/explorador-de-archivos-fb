// ════════════════════════════════════════════════════════════════════════════
// UTILIDADES: FORMATEADORES E ICONOS
// ════════════════════════════════════════════════════════════════════════════

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EXT_ICONS = {
  pdf:'🔴', doc:'📘', docx:'📘', ppt:'📊', pptx:'📊',
  xls:'📈', xlsx:'📈', csv:'🟢', md:'📝', txt:'📄',
  py:'🐍', js:'🟡', ts:'🟡', jsx:'🟡', tsx:'🟡',
  html:'🌐', css:'🎨', sql:'🔷', json:'🔧', xml:'🔧',
  yaml:'🔧', yml:'🔧', png:'🖼️', jpg:'🖼️', jpeg:'🖼️',
  gif:'🖼️', svg:'🖼️', webp:'🖼️', zip:'📦', rar:'📦',
  '7z':'📦', tar:'📦', gz:'📦', tgz:'📦', bz2:'📦',
  mp3:'🎵', wav:'🎵', ogg:'🎵', m4a:'🎵', aac:'🎵', flac:'🎵',
  mp4:'🎬', webm:'🎬', mov:'🎬', ipynb:'🪐',
  bat:'⚙️', ps1:'⚙️', exe:'⚙️',
};

function getIcon(ext) {
  return EXT_ICONS[ext] || '📄';
}
