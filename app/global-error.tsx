'use client';

// Last resort: a crash in the root layout itself. This file replaces the root
// layout when active, so there is no I18nProvider, no toast host and no app
// shell to lean on — it has to carry its own <html> and <body>, and its text
// cannot go through t(). Both sentences are kept short and plain for that
// reason; every other error surface in the app is translated.
//
// The crash is still reported, because this is the screen that used to be a
// blank page.

import { useEffect } from 'react';
import { reportCrash } from '@/lib/reportCrash';
import './globals.css';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    reportCrash(error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f6f8fa', color: '#0b1f2a' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
              The app failed to start / แอปเริ่มทำงานไม่สำเร็จ
            </h2>
            <p style={{ fontSize: 14, opacity: 0.75, margin: '0 0 20px' }}>
              Reloading usually fixes it. This has been recorded.
            </p>
            {error.message && (
              <p style={{ fontSize: 12, fontFamily: 'monospace', background: '#fff', border: '1px solid #dde3e8',
                borderRadius: 12, padding: '8px 12px', margin: '0 0 20px', textAlign: 'left', overflowWrap: 'break-word' }}>
                {error.message}
              </p>
            )}
            <button onClick={() => window.location.reload()}
              style={{ padding: '10px 20px', borderRadius: 12, border: 0, background: '#0b6bcb', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Reload / โหลดใหม่
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
