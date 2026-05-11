const EXT_LABEL = {
  '.pdf': 'PDF',
  '.md': 'MD',
  '.txt': 'TXT',
  '.py': 'PY',
  '.js': 'JS',
  '.ts': 'TS',
  '.css': 'CSS',
};

function extOf(filename) {
  const f = String(filename || '');
  const i = f.lastIndexOf('.');
  return i >= 0 ? f.slice(i).toLowerCase() : '';
}

function basenameOf(filename) {
  return String(filename || '').split('/').pop();
}

export default function PostDocument({ asset }) {
  if (!asset || asset.kind !== 'document') return null;
  const ext = extOf(asset.filename);
  const label = EXT_LABEL[ext] || ext.replace('.', '').toUpperCase() || 'DOC';
  const href = asset.url || '#';

  return (
    <a
      className="post-document"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open attached document ${basenameOf(asset.filename)}`}
    >
      <span className="post-document__ext">{label}</span>
      <span className="post-document__name">{basenameOf(asset.filename)}</span>
      <span className="post-document__open">Open</span>
    </a>
  );
}
