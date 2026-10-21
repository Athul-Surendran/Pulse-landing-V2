// Hourly average electrical demand, 20 October 2026, 00:00–24:00.
export const fixture = {
  date: '20 Oct 2026',
  workDate: '21 Oct 2026',
  rate: 0.18,
  hourly: [92, 88, 84, 82, 86, 110, 148, 205, 272, 310, 328, 340, 322, 334, 346, 330, 292, 242, 190, 154, 130, 116, 104, 98],
  floors: Array.from({ length: 14 }, (_, i) => ({ id: i + 1, area: 720, weight: i === 9 ? 13 : i < 4 ? 6 : 7 })),
  systems: [
    { name: 'Cooling & ventilation', share: 0.48, color: '#277b9a', equipment: 'AHU-10 · Level 10' },
    { name: 'Lighting', share: 0.24, color: '#7279bb', equipment: 'Lighting circuits · All floors' },
    { name: 'Plug loads', share: 0.20, color: '#36958b', equipment: 'Tenant distribution · All floors' },
    { name: 'Lifts & common', share: 0.08, color: '#9a7950', equipment: 'Core services · All floors' },
  ],
};

export function metrics(floor = null) {
  const selected = fixture.floors.find(item => item.id === floor);
  const totalWeight = fixture.floors.reduce((sum, item) => sum + item.weight, 0);
  const share = selected ? selected.weight / totalWeight : 1;
  const hourly = fixture.hourly.map(value => value * share);
  const consumption = hourly.reduce((sum, value) => sum + value, 0);
  const area = selected ? selected.area : fixture.floors.reduce((sum, item) => sum + item.area, 0);
  return { hourly, consumption, cost: consumption * fixture.rate, area, intensity: consumption / area, peak: Math.max(...hourly) };
}

export const number = (value, digits = 0) => value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const scopeName = floor => floor ? `Level ${String(floor).padStart(2, '0')}` : 'Whole building';

export const work = [
  { id: 'review', type: 'Notifications', title: 'Review overnight AHU schedule', location: 'AHU-10 · Level 10', status: 'Needs review', due: '09:00', owner: 'Maya · Facilities manager', next: 'Compare the occupied-hours schedule with tenant access before deciding whether to adjust it.', detail: 'Cooling represents 48% of this illustrative day’s electricity. Overnight demand is not automatically waste: ventilation, cleaning and tenant activity may require it. Verify the schedule and operating context first.' },
  { id: 'belt', type: 'Work orders', title: 'Inspect supply-fan drive', location: 'AHU-10 · Level 10', status: 'Planned', due: '11:00', owner: 'Alex · HVAC technician', next: 'Inspect belt tension under the approved isolation procedure; record findings.', detail: 'WO-1042 · Routine inspection raised during the last service visit. Review the asset service history before attending. This preview does not issue instructions to equipment.' },
  { id: 'ppm', type: 'PPM', title: 'Monthly filter inspection', location: 'AHU-06 · Level 06', status: 'Scheduled', due: '14:00', owner: 'Sam · Maintenance technician', next: 'Check filter condition and differential pressure; log inspection results.', detail: 'PPM-026 · Monthly preventive maintenance plan. Filter replacement requires condition assessment; no replacement is assumed from energy data alone.' },
  { id: 'task', type: 'Assigned tasks', title: 'Confirm meter floor mapping', location: 'Tenant meters · Levels 01–04', status: 'In progress', due: '16:00', owner: 'Jordan · BMS manager', next: 'Compare the meter register with the floor plan and record any mapping discrepancies.', detail: 'TASK-018 · Validate meter-to-space relationships before using floor comparisons for operational decisions.' },
];
