/**
 * Optional partial offline support for static app code only.
 * OPFS keeps user media separately; provider/model downloads require network.
 * Fake-ASR E2E builds only register when the test explicitly requests it.
 */
export function registerOfflineShell(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (import.meta.env.VITE_FAKE_ASR && !new URLSearchParams(location.search).has('offline-test')) return;
  // Do not block first render or advertise complete offline editing.
  void navigator.serviceWorker.register(new URL('/sw.js', location.origin), { scope: '/' }).catch(() => {
    // No service worker (private/restricted browsing): the app still works online.
  });
}
