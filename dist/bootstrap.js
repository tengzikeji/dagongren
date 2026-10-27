import {prepareBrandIntro} from './launch.js';
// Paint the small launch surface before loading and calculating the ledger.
const intro=prepareBrandIntro();
globalThis.dagongrenIntro=intro;
await intro.painted;
await intro.beforeApp;
await import('./app.js');
