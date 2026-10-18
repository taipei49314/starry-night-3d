import { boot } from './app/composition';

/** The loading overlay sits above everything, so a failed boot must never leave it spinning over the error. */
function showBootFailure(container: HTMLElement): void {
  const loader = document.getElementById('loading-overlay');
  if (!loader || loader.getAttribute('data-ready') === '1') return; // already past the first frame
  if (container.querySelector('.fallback')) {
    loader.remove(); // the WebGL 2 message is already in #app
    return;
  }
  const msg = document.createElement('p');
  msg.className = 'fallback';
  msg.textContent = '作品無法啟動，請重新整理，或改用開啟硬體加速的新版桌面瀏覽器。This piece could not start. Try reloading, or a current desktop browser with hardware acceleration on.';
  loader.replaceChildren(msg);
  loader.setAttribute('role', 'alert');
}

const container = document.getElementById('app');
if (container) {
  // A throw in the first animation frame never reaches boot()'s promise, so watch for errors until the overlay lifts.
  const onEarlyError = (): void => showBootFailure(container);
  window.addEventListener('error', onEarlyError);
  window.setTimeout(() => window.removeEventListener('error', onEarlyError), 30_000);
  boot(container).catch((e) => {
    console.error('[punctum] boot failed', e);
    showBootFailure(container);
  });
}
