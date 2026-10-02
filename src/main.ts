import { boot } from './app/composition';

const container = document.getElementById('app');
if (container) {
  boot(container).catch((e) => console.error('[punctum] boot failed', e));
}
