import { mountPerformance } from './section.js';

const dispose = mountPerformance(document.querySelector('#pulse-performance'));
if (import.meta.hot) import.meta.hot.dispose(dispose);
