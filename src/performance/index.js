import './style.css';
import { fixture, metrics, number, scopeName, work } from './data.js';
import { profileChart, distributionChart } from './charts.js';

function metricMarkup(data) {
  return `<dl class="pp-metrics">
    <div><dt>Electricity</dt><dd data-pp-metric="consumption">${number(data.consumption, 1)} <small>kWh</small></dd></div>
    <div><dt>Estimated cost</dt><dd data-pp-metric="cost">£${number(data.cost, 2)}</dd></div>
    <div><dt>Period intensity</dt><dd data-pp-metric="intensity">${number(data.intensity, 3)} <small>kWh/m²</small></dd></div>
    <div><dt>Hourly-average peak</dt><dd data-pp-metric="peak">${number(data.peak, 1)} <small>kW</small></dd></div>
  </dl>`;
}

function modelMarkup(action) {
  return `<div class="pp-model-card ${action ? 'pp-cutaway' : ''}">
    <div class="pp-model-top"><span>${action ? '02 / Equipment context' : '01 / A connected view'}</span><span>14 floors</span></div>
    <div class="pp-model" role="group" aria-label="${action ? 'Building equipment cutaway' : 'Selectable architectural building model'}">
      <div class="pp-model-fallback"><svg viewBox="0 0 360 470" role="img" aria-label="14-floor tower schematic">
        <defs><linearGradient id="pp-glass"><stop stop-color="#dcebf1"/><stop offset="1" stop-color="#7ca3b7"/></linearGradient></defs>
        <path d="M45 409 176 366 320 408 186 455Z" fill="#dbe4ea"/>
        ${Array.from({ length: 14 }, (_, i) => {
          const y = 379 - i * 24;
          return `<path data-pp-floor-shape="${i + 1}" d="M110 ${y}Q174 ${y + 25} 249 ${y - 3}L249 ${y - 25}Q174 ${y + 3} 110 ${y - 22}Z" fill="${action && i === 9 ? '#2789a7' : 'url(#pp-glass)'}" stroke="#f3f7fa" stroke-width="2"/>
          ${[130, 155, 180, 205, 230].map(x => `<path d="M${x} ${y - 16}v20" stroke="#edf4f7"/>`).join('')}`;
        }).join('')}
        <ellipse cx="180" cy="44" rx="70" ry="17" fill="#e9f0f4" stroke="#a1b7c4"/>
        ${action ? '<path d="M249 151H306" stroke="#277b9a"/><text x="260" y="141" fill="#233745" font-size="14">L10</text>' : ''}
      </svg></div>
      <div class="pp-model-canvas"></div>
      <div class="pp-anchor"><span class="pp-anchor-dot"></span><strong>${action ? 'AHU-10 / Level 10' : 'Whole building'}</strong><span>${action ? 'Cooling & ventilation' : 'Select a floor to explore'}</span></div>
    </div>
    <p class="pp-model-status">Architectural schematic · loading 3D near view</p>
    ${action ? '<p class="pp-cutaway-caption">Level 10 opened to show the air-handling unit. End-use allocation is building-wide, not an AHU submeter reading.</p>' : `<div class="pp-floor-controls"><label for="pp-floor">Explore a floor</label><select id="pp-floor"><option value="">Whole building</option>${fixture.floors.map(f => `<option value="${f.id}">Level ${String(f.id).padStart(2, '0')}</option>`).join('')}</select><button type="button" data-pp-reset>Reset</button></div>`}
  </div>`;
}

export function mountPerformance(root, { alternatives = ['performance', 'action'] } = {}) {
  const names = { performance: 'Building Performance', action: 'Energy to Action' };
  const options = alternatives.filter((key, i, all) => names[key] && all.indexOf(key) === i);
  if (!root || !options.length) return () => {};
  let variant = options[0];
  let floor = null;
  let filter = 'All';
  let model;
  let near = false;
  let visible = false;
  let disposed = false;
  let generation = 0;
  let attempted = false;
  root.classList.add('pp-section');
  root.innerHTML = `<div class="pp-wrap">
    <header class="pp-heading"><div><p class="pp-eyebrow">The building, in perspective</p><h2 id="pp-title">See the energy.<br><em>Understand the building.</em></h2></div><p>From a whole-building view to the next useful action. Explore two ways Pulse can bring your building’s performance into focus.</p></header>
    <div class="pp-toolbar"><div class="pp-tabs" role="tablist" aria-label="Product preview design alternatives">${options.map(key => `<button type="button" role="tab" id="pp-tab-${key}" aria-controls="pp-panel-${key}" aria-selected="${key === variant}" tabindex="${key === variant ? 0 : -1}" data-pp-tab="${key}"><span>${key === 'performance' ? '01' : '02'}</span>${names[key]}</button>`).join('')}</div><span class="pp-sample"><i></i> Sample data · not live</span></div>
    ${options.map(key => `<div role="tabpanel" id="pp-panel-${key}" aria-labelledby="pp-tab-${key}" tabindex="0" ${key === variant ? '' : 'hidden'}></div>`).join('')}
    <footer class="pp-footnote"><span>Illustrative product preview · No live telemetry or real assignments</span><span>Energy: ${fixture.date} · GBP £${fixture.rate.toFixed(2)}/kWh · excludes standing charges and tax</span></footer>
  </div>`;
  const panel = () => root.querySelector(`#pp-panel-${variant}`);
  function updateMetrics() {
    const data = metrics(floor);
    panel().querySelector('.pp-scope').textContent = scopeName(floor);
    panel().querySelector('.pp-metric-slot').innerHTML = metricMarkup(data);
    panel().querySelector('.pp-chart-slot').innerHTML = profileChart(data, scopeName(floor));
    panel().querySelector('.pp-area').textContent = `${number(data.area)} m² · ${floor ? 'Allocated floor energy' : 'Whole-building electricity'}`;
    panel().querySelector('.pp-anchor strong').textContent = scopeName(floor);
    panel().querySelector('.pp-anchor > span:last-child').textContent = `${number(data.consumption, 1)} kWh · ${fixture.date}`;
    panel().querySelector('#pp-floor').value = floor || '';
    panel().querySelectorAll('[data-pp-floor-shape]').forEach(shape => {
      shape.setAttribute('fill', Number(shape.dataset.ppFloorShape) === floor ? '#2789a7' : 'url(#pp-glass)');
    });
    model?.setFloor(floor);
  }
  function setFloor(value) {
    floor = value;
    updateMetrics();
  }
  function workList() {
    const items = filter === 'All' ? work : work.filter(item => item.type === filter);
    panel().querySelector('.pp-work-list').innerHTML = items.map(item => `<article class="pp-work-item">
      <button type="button" data-pp-work="${item.id}" aria-expanded="false" aria-controls="pp-detail-${item.id}"><span><small>${item.type} · ${item.status}</small><strong>${item.title}</strong><small>${item.location} · Due ${item.due}</small></span><span aria-hidden="true">↗</span></button>
      <div class="pp-work-detail" id="pp-detail-${item.id}" hidden><p>${item.detail}</p><dl><div><dt>Owner</dt><dd>${item.owner}</dd></div><div><dt>Next step</dt><dd>${item.next}</dd></div></dl><p class="pp-note">Sample assignment only · no changes are sent.</p></div>
    </article>`).join('');
    panel().querySelectorAll('[data-pp-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ppFilter === filter)));
  }
  function render() {
    const data = metrics();
    panel().innerHTML = variant === 'performance' ? `<div class="pp-performance-grid">
      ${modelMarkup(false)}
      <div class="pp-performance-data"><p class="pp-eyebrow">Building Performance / Daily overview</p><div class="pp-scope-row"><h3 class="pp-scope" aria-live="polite">Whole building</h3><span>${fixture.date}</span></div><p class="pp-area"></p><div class="pp-metric-slot"></div><div class="pp-chart-slot"></div><p class="pp-note">Floor views allocate the same daily profile by illustrative floor shares. Not separately metered; no savings are inferred.</p></div>
    </div>` : `<div class="pp-action-grid">
      <div class="pp-energy-led"><p class="pp-eyebrow">Energy to Action / Follow the connection</p><h3>Every kWh has a context.</h3>${distributionChart(data)}
      <div class="pp-observation"><span class="pp-eyebrow">Observation → review</span><h4>Start with the operating schedule.</h4><p>Cooling & ventilation accounts for ${number(data.consumption * 0.48, 1)} kWh. Check overnight operation against occupancy—not against an assumption of waste.</p><button type="button" data-pp-observation>Review the AHU-10 schedule <span aria-hidden="true">↗</span></button></div></div>
      <div class="pp-equipment">${modelMarkup(true)}<div class="pp-mini-metrics"><span>Daily estimated cost <strong>£${number(data.cost, 2)}</strong></span><span>Intensity <strong>${number(data.intensity, 3)} kWh/m²</strong></span></div></div>
      <aside class="pp-work" aria-labelledby="pp-work-title"><div class="pp-work-heading"><div><p class="pp-eyebrow">A compact work preview</p><h3 id="pp-work-title">Your work<span> / 04</span></h3></div><span class="pp-work-date">Due ${fixture.workDate}<br>Local time · sample team</span></div><div class="pp-filters" role="group" aria-label="Filter sample work">${['All', 'Notifications', 'Work orders', 'PPM', 'Assigned tasks'].map(type => `<button type="button" data-pp-filter="${type}" aria-pressed="${type === filter}">${type}</button>`).join('')}</div><div class="pp-work-list" aria-live="polite"></div></aside>
      <div class="pp-action-profile">${profileChart(data, 'Whole building')}</div>
    </div>`;
    if (variant === 'performance') updateMetrics();
    else workList();
    attempted = false;
    startModel();
  }
  async function startModel() {
    if (!near || attempted || disposed || document.hidden) return;
    attempted = true;
    const token = ++generation;
    const currentPanel = panel();
    const status = currentPanel.querySelector('.pp-model-status');
    const host = currentPanel.querySelector('.pp-model-canvas');
    function fallback() {
      model?.dispose();
      model = undefined;
      currentPanel.querySelector('.pp-model-fallback').hidden = false;
      status.textContent = 'Architectural schematic · 3D unavailable. All data and floor controls remain available.';
    }
    try {
      const { createBuilding } = await import('./model.js');
      if (token !== generation || disposed) return;
      model = createBuilding(host, { variant, select: setFloor, floor: variant === 'action' ? 10 : floor });
      host.addEventListener('pp-model-failed', fallback, { once: true });
      currentPanel.querySelector('.pp-model-fallback').hidden = true;
      status.textContent = variant === 'action' ? 'Architectural study · Level 10 equipment cutaway' : 'Architectural study · Click a floor or use the selector';
      model.setActive(visible && !document.hidden);
    } catch {
      if (token === generation && !disposed) fallback();
    }
  }
  function switchOption(key) {
    if (key === variant) return;
    generation++;
    model?.dispose();
    model = undefined;
    panel().replaceChildren();
    panel().hidden = true;
    variant = key;
    panel().hidden = false;
    root.querySelectorAll('[data-pp-tab]').forEach(tab => {
      tab.setAttribute('aria-selected', String(tab.dataset.ppTab === key));
      tab.tabIndex = tab.dataset.ppTab === key ? 0 : -1;
    });
    render();
  }
  function click(event) {
    const tab = event.target.closest('[data-pp-tab]');
    if (tab) switchOption(tab.dataset.ppTab);
    if (event.target.closest('[data-pp-reset]')) setFloor(null);
    const filterButton = event.target.closest('[data-pp-filter]');
    if (filterButton) { filter = filterButton.dataset.ppFilter; workList(); }
    const item = event.target.closest('[data-pp-work]');
    if (item) {
      const expanded = item.getAttribute('aria-expanded') === 'true';
      item.setAttribute('aria-expanded', String(!expanded));
      root.querySelector(`#${item.getAttribute('aria-controls')}`).hidden = expanded;
    }
    if (event.target.closest('[data-pp-observation]')) {
      filter = 'Notifications';
      workList();
      const review = panel().querySelector('[data-pp-work="review"]');
      review.click();
      review.focus({ preventScroll: true });
      review.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }
  function keydown(event) {
    if (!event.target.matches('[data-pp-tab]')) return;
    const index = options.indexOf(variant);
    const next = { ArrowRight: (index + 1) % options.length, ArrowLeft: (index + options.length - 1) % options.length, Home: 0, End: options.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    switchOption(options[next]);
    root.querySelector(`[data-pp-tab="${options[next]}"]`).focus();
  }
  function change(event) {
    if (event.target.id === 'pp-floor') setFloor(Number(event.target.value) || null);
  }
  function visibility() {
    model?.setActive(visible && !document.hidden);
    if (!document.hidden) startModel();
  }
  const preload = new IntersectionObserver(entries => {
    near = entries[0].isIntersecting;
    if (near) startModel();
  }, { rootMargin: '250px' });
  const viewport = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    model?.setActive(visible && !document.hidden);
  });
  preload.observe(root);
  viewport.observe(root);
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  root.addEventListener('change', change);
  document.addEventListener('visibilitychange', visibility);
  render();
  return () => {
    disposed = true;
    generation++;
    preload.disconnect();
    viewport.disconnect();
    model?.dispose();
    root.removeEventListener('click', click);
    root.removeEventListener('keydown', keydown);
    root.removeEventListener('change', change);
    document.removeEventListener('visibilitychange', visibility);
    root.replaceChildren();
  };
}

const dispose = mountPerformance(document.querySelector('#pulse-performance'));
if (import.meta.hot) import.meta.hot.dispose(dispose);
