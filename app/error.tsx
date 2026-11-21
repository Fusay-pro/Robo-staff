'use client';

// Route-segment error boundary. A crash used to leave a blank page; now it
// leaves a readable panel, a way back, and a row in the error log.
//
// `unstable_retry` re-fetches and re-renders the children (Next 16.2+), which
// recovers a page that died on a transient failure without a full reload. The
// root layout stays mounted around this, so the sidebar, the navigation and
// the toast host keep working.

import { useEffect } from 'react';
import { useT } from '@/context/I18nContext';
import { reportCrash } from '@/lib/reportCrash';

export default function ErrorPage({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    console.error(error);
    reportCrash(error, { digest: error.digest });
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-error text-[28px]">report</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-2">{t('errors.crashTitle')}</h2>
        <p className="text-sm text-on-surface-variant mb-6">{t('errors.crashHint')}</p>

        {/* The message is shown because the owner asked to see what the error
            was. A crash in a Client Component carries its real message; one
            forwarded from the server carries a digest instead, which is what
            matches the row in the log. */}
        {error.message && (
          <p className="text-xs font-mono text-on-surface-variant bg-surface-container rounded-xl px-3 py-2 mb-6 break-words text-left">
            {error.message}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          {retry && (
            <button onClick={() => retry()}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity">
              {t('common.retry')}
            </button>
          )}
          <button onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container transition-colors">
            {t('errors.reload')}
          </button>
        </div>
      </div>
    </div>
  );
}
