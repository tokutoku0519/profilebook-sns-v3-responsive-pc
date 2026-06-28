'use client';

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ margin: 0, padding: 24, fontFamily: 'monospace', fontSize: 13, background: '#fef2f2', minHeight: '100vh' }}>
      <p style={{ fontWeight: 'bold', color: '#e11d48', marginBottom: 8, fontSize: 15 }}>
        クラッシュエラー
      </p>
      <pre style={{
        background: '#fff',
        border: '1px solid #fca5a5',
        padding: 12,
        borderRadius: 8,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        fontSize: 12,
      }}>
        {error?.message ?? '不明なエラー'}{'\n\n'}{error?.stack ?? ''}
      </pre>
    </div>
  );
}
