import { fixture, number } from './data.js';

export function profileChart(data, scope) {
  const max = Math.ceil(data.peak / 50) * 50;
  const x = i => 48 + i / 24 * 548;
  const y = v => 166 - v / max * 132;
  const points = data.hourly.map((v, i) => `${x(i + 0.5)},${y(v)}`).join(' ');
  return `<figure class="pp-profile">
    <figcaption><strong>Electricity through the day</strong><span>${fixture.date} · ${scope}</span></figcaption>
    <svg viewBox="0 0 620 230" role="img" aria-label="${scope}: hourly average demand, kW. Peak ${number(data.peak, 1)} kW. Daily electricity ${number(data.consumption, 1)} kWh.">
      ${[0, 0.5, 1].map(t => `<path d="M48 ${y(max * t)}H596" stroke="#dce4e9"/><text x="38" y="${y(max * t) + 4}" text-anchor="end">${number(max * t)}</text>`).join('')}
      <text x="48" y="18">kW · hourly average</text>
      <polygon points="48,166 ${points} 596,166" fill="#277b9a" fill-opacity=".09"/>
      <polyline points="${points}" fill="none" stroke="#277b9a" stroke-width="2.5" stroke-linejoin="round"/>
      ${[0, 6, 12, 18, 24].map(h => `<text x="${x(h)}" y="193" text-anchor="${h === 24 ? 'end' : 'middle'}">${String(h).padStart(2, '0')}:00</text>`).join('')}
      <text x="596" y="222" text-anchor="end">Local time · 24 hours</text>
    </svg>
    <p class="pp-legend"><i></i> Electricity demand <span>1-hour samples · not instantaneous peaks</span></p>
    <details><summary>View hourly data</summary><div class="pp-table-scroll"><table><caption>${scope} · ${fixture.date} · one-hour intervals</caption><thead><tr><th>Hour starting</th><th>Average kW</th><th>Energy kWh</th></tr></thead><tbody>${data.hourly.map((value, i) => `<tr><th>${String(i).padStart(2, '0')}:00</th><td>${number(value, 2)}</td><td>${number(value, 2)}</td></tr>`).join('')}</tbody></table></div></details>
  </figure>`;
}

export function distributionChart(data) {
  return `<figure class="pp-distribution"><figcaption><strong>Where the energy goes</strong><span>${fixture.date} · Whole building · kWh</span></figcaption>
    <div class="pp-distribution-total"><strong>${number(data.consumption)}</strong><span>kWh / day</span></div>
    <div class="pp-flow-bar" role="img" aria-label="Electricity distribution: ${fixture.systems.map(s => `${s.name} ${number(s.share * 100)} percent, ${number(s.share * data.consumption, 1)} kWh`).join('; ')}">${fixture.systems.map(s => `<span style="width:${s.share * 100}%;background:${s.color}"></span>`).join('')}</div>
    <ul>${fixture.systems.map(s => `<li><i style="background:${s.color}"></i><div><strong>${s.name}</strong><small>${s.equipment}</small></div><span>${number(s.share * data.consumption, 1)} <small>kWh · ${number(s.share * 100)}%</small></span></li>`).join('')}</ul>
    <p class="pp-note">Illustrative end-use allocation; shares reconcile to the building’s daily total.</p>
  </figure>`;
}
