import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createScene, LAYOUT } from './scene.js';
import { createAlarmPreview } from './alarm-preview.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (selector) => document.querySelector(selector);
const menuToggle = $('#menu-toggle');
const primaryNav = $('#primary-nav');
function closeMenu() {
  primaryNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}
menuToggle.addEventListener('click', () => {
  const open = primaryNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && primaryNav.classList.contains('open')) {
    closeMenu();
    menuToggle.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.header')) closeMenu();
});
const media = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = media.matches;
let userPaused = false;
let activeChapter = -1;
let scene;
const chapters = [
  { kicker: 'Overview', caption: 'Cooling alarm active on Level 10.' },
  { kicker: 'Inside', caption: 'Cooling alarm active. Entering the affected office on Level 10.' },
  { kicker: 'Blockage', caption: 'Chilled-water pipe blocked — cooling interrupted.' },
  { kicker: 'Repair', caption: 'Isolate the affected section. Remove the blockage. Restore the pipe.' },
  { kicker: 'Recovery', caption: 'Flow restored. Cooling recovered. Alarm cleared.' },
  { kicker: 'Airflow', caption: 'Cooling restored to the office.' },
  { kicker: 'Circulation', caption: 'Continuous chilled-water supply and return circulation verified.' },
  { kicker: 'In balance', caption: 'Alarm resolved. Airflow restored. Chilled-water circulation verified.' },
];

function showChapter(index) {
  if (index === activeChapter) return;
  activeChapter = index;
  document.body.classList.toggle('exterior', index === 0 || index >= 6);
  document.body.dataset.storyChapter = String(index);
  $('#scroll-cue').setAttribute('aria-label', index === 7 ? 'Replay the story' : 'Scroll to continue the story');
  document.querySelectorAll('[data-chapter]').forEach((button, i) => {
    button.classList.toggle('active', i === index);
    button.classList.toggle('complete', i < index);
    if (i === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.setAttribute('aria-label', `Chapter ${i + 1}: ${chapters[i].kicker}`);
  });
}

try {
  scene = createScene($('#scene'), reducedMotion);
} catch (error) {
  console.error('Unable to initialize the architectural scene:', error);
  $('#loading').classList.add('loaded');
  $('#scene-error').hidden = false;
}

if (scene) {
  const state = scene.state;
  const hero = $('#landing-hero');
  const finalHero = $('#final-hero');
  const scrollCue = $('#scroll-cue');
  const valveDialog = $('#valve-dialog');
  const valveDialogView = $('#valve-dialog-view');
  let modalPreview;
  let previousOverflow = '';
  let returnFocus;
  function openValveDialog() {
    if (valveDialog.open) return;
    returnFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    valveDialog.showModal();
    const scrubTween = trigger.getTween();
    if (scrubTween) scrubTween.pause();
    $('#valve-dialog-error').hidden = true;
    try {
      modalPreview ??= createAlarmPreview(valveDialogView, { wheelRotate: true, fitToView: true });
      modalPreview.setPaused(true);
      modalPreview.resetView();
      $('#valve-dialog-reset').disabled = false;
      valveDialogView.focus({ preventScroll: true });
    } catch (error) {
      console.error('Unable to initialize the expanded valve inspection:', error);
      $('#valve-dialog-error').hidden = false;
      $('#valve-dialog-reset').disabled = true;
    }
  }
  function closeValveDialog() {
    document.body.style.overflow = previousOverflow;
    const scrubTween = trigger.getTween();
    if (scrubTween) scrubTween.play();
    if (returnFocus instanceof HTMLElement && returnFocus.checkVisibility()) returnFocus.focus({ preventScroll: true });
  }
  function keepDialogFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...valveDialog.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  valveDialog.addEventListener('close', closeValveDialog);
  valveDialog.addEventListener('keydown', keepDialogFocus);
  $('#valve-dialog-close').addEventListener('click', () => valveDialog.close());
  $('#valve-dialog-reset').addEventListener('click', () => modalPreview?.resetView());
  let preview;
  try {
    preview = createAlarmPreview($('#valve-preview'), { onActivate: openValveDialog });
  } catch (error) {
    console.error('Unable to initialize the 3D inspection preview:', error);
    $('#preview-error').hidden = false;
    $('#preview-pause').disabled = true;
  }
  let previewPaused = false;
  $('#preview-pause').addEventListener('click', () => {
    if (!preview) return;
    previewPaused = !previewPaused;
    preview.setPaused(previewPaused);
    $('#preview-pause').setAttribute('aria-pressed', String(previewPaused));
    $('#preview-pause').textContent = previewPaused ? 'Resume rotation' : 'Pause rotation';
  });
  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'sine.inOut' } });
  timeline
    .to(hero, { autoAlpha: 0, y: -18, duration: 0.2, ease: 'none' }, 0.015)
    .to(state, { composition: 0, duration: 0.75 }, 0.3)
    .to(state, { alarm: 1, duration: 0.18 }, 0.06)
    .to(state, { cameraX: 8.8, cameraY: 42.8, cameraZ: 12, targetX: 0.4, targetY: 38.2, targetZ: 0.65, duration: 1.05 }, 0.3)
    .to(state, { cutaway: 1, duration: 0.65 }, 0.42)
    .to(state, { district: 0, duration: 0.55 }, 0.35)
    .to(state, { ceiling: 1, duration: 0.42 }, 0.96)
    .to(state, { cameraX: 3.5, cameraY: 40.38, cameraZ: 3.0, targetX: 2.3, targetY: LAYOUT.serviceY, targetZ: 1.35, duration: 0.8 }, 1.4)
    .to(state, { repair: 1, duration: 1.08, ease: 'none' }, 2.9)
    .to(state, { flow: 1, duration: 0.01 }, 4.03)
    .to(state, { healthy: 1, duration: 0.25 }, 4.42)
    .to(state, { cameraX: 7.8, cameraY: 41.7, cameraZ: 10.5, targetX: 0.4, targetY: 38.35, targetZ: 0.8, duration: 0.7 }, 4.55)
    .to(state, { air: 1, duration: 0.35 }, 4.9)
    .to(state, { cameraX: 30, cameraY: 79, cameraZ: 37, targetX: 1.8, targetY: 29, targetZ: 0, duration: 1.0 }, 5.65)
    .to(state, { district: 1, duration: 0.7 }, 5.9)
    .to(state, { network: 1, duration: 0.55 }, 5.75)
    .to(state, { cutaway: 0, duration: 0.6 }, 6.1)
    .to(state, { cameraX: 31, cameraY: 81, cameraZ: 38, targetX: 0, targetY: 30, targetZ: 0, duration: 0.65 }, 6.9)
    .fromTo(finalHero, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'none' }, 7.55);

  const trigger = ScrollTrigger.create({
    trigger: '#scroll-story', start: 'top top', end: 'bottom bottom',
    animation: timeline, scrub: reducedMotion ? true : 1.1, invalidateOnRefresh: true,
  });
  // Chapters deliberately switch after the camera arrives; recovery waits for flow.
  const chapterStarts = [0, 1.08, 2.03, 2.9, 4.7, 5.12, 6.25, 7.23];
  function jumpToChapter(index) {
    const time = index === 0 ? 0 : Math.min(7.95, chapterStarts[index] + 0.16);
    const y = trigger.start + time / timeline.duration() * (trigger.end - trigger.start);
    window.scrollTo({ top: y, behavior: reducedMotion ? 'instant' : 'smooth' });
  }
  document.querySelectorAll('[data-chapter]').forEach(button => {
    button.addEventListener('click', () => jumpToChapter(Number(button.dataset.chapter)));
  });
  $('#scroll-cue').addEventListener('click', () => {
    if (activeChapter === 0 && state.alarm < 0.95) {
      window.scrollTo({ top: trigger.start + 0.26 / timeline.duration() * (trigger.end - trigger.start), behavior: reducedMotion ? 'instant' : 'smooth' });
    } else {
      jumpToChapter((activeChapter + 1) % chapters.length);
    }
  });
  $('.wordmark').addEventListener('click', event => { event.preventDefault(); jumpToChapter(0); });
  $('#explore-platform').addEventListener('click', () => jumpToChapter(1));
  $('#inspect-office').addEventListener('click', () => jumpToChapter(1));

  function updateMotionButton() {
    const paused = userPaused || reducedMotion;
    scene.setPaused(paused);
    $('#motion-button').setAttribute('aria-pressed', String(paused));
    $('#motion-button').setAttribute('aria-label', reducedMotion ? 'Reduced motion enabled by device preference' : paused ? 'Resume scene animation' : 'Pause scene animation');
    $('#motion-button').innerHTML = paused
      ? '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m6 4 8 5-8 5Z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M6 4v10M12 4v10" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  }
  $('#motion-button').addEventListener('click', () => {
    if (reducedMotion) return;
    userPaused = !userPaused;
    updateMotionButton();
  });
  function onMotionChange(event) {
    reducedMotion = event.matches;
    scene.setReducedMotion(reducedMotion);
    trigger.scrubDuration(reducedMotion ? 0 : 1.1);
    updateMotionButton();
  }
  media.addEventListener('change', onMotionChange);
  updateMotionButton();

  const panel = $('#alarm-panel');
  const details = $('#alarm-details');
  const checklist = $('#recovery-checklist');
  const progressPanel = $('#recovery-progress');
  const progressBar = $('#recovery-bar');
  const progressFill = $('#recovery-fill');
  const progressPercent = $('#recovery-percent');
  const progressStatus = $('#recovery-status');
  const connector = $('#alarm-connector');
  const connectorPath = $('#alarm-connector-path');
  const connectorTarget = $('#alarm-connector-target');
  const hotspots = $('#device-hotspots');
  const deviceTooltip = $('#device-tooltip');
  const deviceButtons = new Map();
  let activeDevice = null, hideDeviceTimer;
  let lastDeviceData = '';
  let tooltipWidth = 340, tooltipHeight = 420;
  const deviceHealth = $('#device-health-value');
  const deviceConnection = $('#device-connection');
  const activeCount = $('#device-active-count');
  const inactiveCount = $('#device-inactive-count');
  const totalCount = $('#device-total-count');
  const deviceReadings = $('#device-readings');
  const deviceTrend = $('#device-trend');
  const deviceTrendRange = $('#device-trend-range');
  const deviceTrendChart = $('#device-trend-chart');
  const deviceTrendLine = $('#device-trend-line');
  function updateDeviceCard(id) {
    const status = scene.getRoomDeviceStatus(id);
    const key = `${id}-${JSON.stringify(status)}`;
    if (key === lastDeviceData) return;
    lastDeviceData = key;
    deviceHealth.textContent = status.health;
    deviceConnection.textContent = status.connection;
    activeCount.textContent = String(status.room.active);
    inactiveCount.textContent = String(status.room.inactive);
    totalCount.textContent = String(status.room.total);
    deviceReadings.replaceChildren(...status.fields.map(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const reading = document.createElement('dd');
      term.textContent = label;
      reading.textContent = value;
      if (label === 'Cooling') reading.dataset.status = value === 'Interrupted' ? 'warning' : value === 'Recovered' ? 'healthy' : 'pending';
      row.append(term, reading);
      return row;
    }));
    deviceTrend.hidden = status.temperatureTrend === null;
    if (status.temperatureTrend) {
      const samples = status.temperatureTrend;
      const first = samples[0].toFixed(1), last = samples.at(-1).toFixed(1);
      deviceTrendRange.textContent = `${first} C - ${last} C`;
      deviceTrendLine.setAttribute('points', samples.map((value, i) => `${4 + i * 272 / (samples.length - 1)},${42 - (value - 21) * 5.5}`).join(' '));
      deviceTrendChart.setAttribute('aria-label', `Simulated room temperature during recovery: ${first} to ${last} degrees Celsius`);
    }
  }
  const tooltipObserver = new ResizeObserver(([entry]) => {
    tooltipWidth = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
    tooltipHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
  });
  tooltipObserver.observe(deviceTooltip);
  function hideDeviceTooltip() {
    clearTimeout(hideDeviceTimer);
    if (activeDevice) deviceButtons.get(activeDevice)?.removeAttribute('aria-describedby');
    activeDevice = null;
    deviceTooltip.dataset.visible = 'false';
    deviceTooltip.setAttribute('aria-hidden', 'true');
  }
  function showDeviceTooltip(annotation) {
    clearTimeout(hideDeviceTimer);
    if (activeDevice && activeDevice !== annotation.id) deviceButtons.get(activeDevice)?.removeAttribute('aria-describedby');
    activeDevice = annotation.id;
    $('#device-tooltip-title').textContent = annotation.title;
    $('#device-tooltip-description').textContent = annotation.description;
    updateDeviceCard(annotation.id);
    deviceButtons.get(annotation.id).setAttribute('aria-describedby', 'device-tooltip');
    deviceTooltip.dataset.visible = 'true';
    deviceTooltip.setAttribute('aria-hidden', 'false');
  }
  function deferHideDevice() {
    clearTimeout(hideDeviceTimer);
    hideDeviceTimer = setTimeout(() => {
      if (!hotspots.contains(document.activeElement)) hideDeviceTooltip();
    }, 120);
  }
  for (const annotation of scene.getRoomAnnotations()) {
    const button = document.createElement('button');
    button.className = 'device-hotspot';
    button.dataset.device = annotation.id;
    button.setAttribute('aria-label', annotation.title);
    button.hidden = true;
    button.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') showDeviceTooltip(annotation);
    });
    button.addEventListener('pointerleave', deferHideDevice);
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.focus({ preventScroll: true });
      showDeviceTooltip(annotation);
    });
    button.addEventListener('focus', () => showDeviceTooltip(annotation));
    button.addEventListener('blur', deferHideDevice);
    button.addEventListener('click', () => showDeviceTooltip(annotation));
    hotspots.appendChild(button);
    deviceButtons.set(annotation.id, button);
  }
  deviceTooltip.addEventListener('pointerenter', () => clearTimeout(hideDeviceTimer));
  deviceTooltip.addEventListener('pointerleave', deferHideDevice);
  function dismissDeviceOnEscape(event) {
    if (event.key === 'Escape') hideDeviceTooltip();
  }
  function dismissDeviceOnOutside(event) {
    if (!event.target.closest('.device-hotspot, .device-tooltip')) hideDeviceTooltip();
  }
  document.addEventListener('keydown', dismissDeviceOnEscape);
  document.addEventListener('pointerdown', dismissDeviceOnOutside);
  function updateDeviceTooltips() {
    const placedTargets = [];
    for (const annotation of scene.getRoomAnnotations()) {
      const button = deviceButtons.get(annotation.id);
      button.hidden = !annotation.visible || valveDialog.open || boundsViewportWidth !== innerWidth || boundsViewportHeight !== innerHeight;
      if (button.hidden) {
        if (activeDevice === annotation.id) hideDeviceTooltip();
        continue;
      }
      let anchorX = innerWidth <= 760 ? Math.min(annotation.x, innerWidth - 78) : annotation.x;
      let anchorY = annotation.y;
      if (innerWidth <= 760 && !panel.hidden && panelBounds &&
          anchorX > panelBounds.left - 16 && anchorX < panelBounds.right + 16 &&
          anchorY > panelBounds.top - 16 && anchorY < panelBounds.bottom + 16) {
        anchorY = anchorY < panelBounds.top + panelBounds.height / 2 ? panelBounds.top - 24 : panelBounds.bottom + 24;
      }
      if (innerWidth <= 760) {
        const obstacles = [!panel.hidden && panelBounds, !progressPanel.hidden && progressBounds].filter(Boolean);
        const fits = (x, y) => x >= 24 && x <= innerWidth - 78 && y >= 90 && y <= innerHeight - 24 &&
          obstacles.every(rect => x + 18 < rect.left || x - 18 > rect.right || y + 18 < rect.top || y - 18 > rect.bottom) &&
          placedTargets.every(point => Math.hypot(point.x - x, point.y - y) >= 38);
        if (!fits(anchorX, anchorY)) {
          const candidates = [];
          for (let step = 1; step <= 5; step++) {
            candidates.push([anchorX, anchorY + step * 40], [anchorX - step * 40, anchorY], [anchorX, anchorY - step * 40]);
          }
          const free = candidates.find(([x, y]) => fits(x, y));
          if (free) [anchorX, anchorY] = free;
        }
      }
      placedTargets.push({ x: anchorX, y: anchorY });
      const offsetX = annotation.x - anchorX, offsetY = annotation.y - anchorY;
      const offset = Math.hypot(offsetX, offsetY);
      button.dataset.offset = String(offset > 1);
      button.style.setProperty('--leader-width', `${Math.max(0, offset - 16)}px`);
      button.style.setProperty('--leader-angle', `${Math.atan2(offsetY, offsetX)}rad`);
      button.style.transform = `translate3d(${anchorX - 16}px,${anchorY - 16}px,0)`;
      if (activeDevice !== annotation.id) continue;
      updateDeviceCard(annotation.id);
      let x = Math.max(16, Math.min(innerWidth - tooltipWidth - 16, anchorX - tooltipWidth / 2));
      const fitsAbove = anchorY - tooltipHeight - 22 >= 16;
      let y = fitsAbove ? anchorY - tooltipHeight - 22 : anchorY + 22;
      if (!fitsAbove && y + tooltipHeight > innerHeight - 16) {
        if (anchorX - tooltipWidth - 22 >= 16) x = anchorX - tooltipWidth - 22;
        else if (anchorX + tooltipWidth + 22 < innerWidth - 16) x = anchorX + 22;
        y = anchorY - tooltipHeight / 2;
      }
      deviceTooltip.style.transform = `translate3d(${x}px,${Math.max(16, Math.min(innerHeight - tooltipHeight - 16, y))}px,0)`;
    }
  }
  const checks = [...document.querySelectorAll('.recovery-steps input')];
  // Milestones match camera arrival, isolation, obstruction removal, pipe closure and verified flow.
  const recoveryMilestones = [1.08, 2.2, 2.9 + 1.08 * 0.18, 2.9 + 1.08 * 0.64, 3.98, 4.67];
  const recoveryColor = gsap.utils.interpolate(['#E80004', '#c6b36b', '#19A877']);
  let recoveryProgress = 0, completedChecks = 0, lastPercent = -1, lastFraction = -1;
  let panelBounds = null, progressBounds = null;
  let boundsViewportWidth = 0, boundsViewportHeight = 0;
  const panelObserver = new ResizeObserver(() => {
    panelBounds = panel.hidden ? null : panel.getBoundingClientRect();
    progressBounds = progressPanel.hidden ? null : progressPanel.getBoundingClientRect();
    boundsViewportWidth = innerWidth;
    boundsViewportHeight = innerHeight;
  });
  panelObserver.observe(panel);
  panelObserver.observe(progressPanel);
  panelObserver.observe($('#experience'));
  let lastStatusKey = '';
  function updateStatus(time) {
    const healthy = time >= 4.67 && state.healthy === 1 && state.flow === 1 && state.repair === 1;
    const flowing = state.flow > 0.5;
    const repairing = state.repair > 0 && state.repair < 1;
    const revealed = time >= 0.215 && state.alarm > 0.05;
    const inside = time >= recoveryMilestones[0];
    const finale = time >= 7.55;
    let fraction = 0;
    for (let i = 0; i < recoveryMilestones.length - 1; i++) {
      if (time >= recoveryMilestones[i]) {
        fraction = (i + gsap.utils.clamp(0, 1, (time - recoveryMilestones[i]) / (recoveryMilestones[i + 1] - recoveryMilestones[i]))) / 5;
      }
    }
    recoveryProgress = healthy ? 100 : Math.min(99, Math.floor(fraction * 100));
    completedChecks = recoveryMilestones.slice(1).filter((end, i) => time >= end && (i < 4 || healthy)).length;
    if (lastFraction !== fraction) {
      lastFraction = fraction;
      progressFill.style.transform = `scaleX(${fraction})`;
      progressPanel.style.setProperty('--recovery-color', recoveryColor(fraction));
    }
    if (lastPercent !== recoveryProgress) {
      lastPercent = recoveryProgress;
      progressPercent.textContent = `${recoveryProgress}%`;
      progressBar.setAttribute('aria-valuenow', String(recoveryProgress));
      progressBar.setAttribute('aria-valuetext', `${recoveryProgress}% - ${progressStatus.textContent}`);
    }
    const key = `${revealed}-${inside}-${healthy}-${flowing}-${repairing}-${completedChecks}-${activeChapter}-${finale}`;
    if (key === lastStatusKey) return;
    lastStatusKey = key;
    document.body.classList.toggle('healthy', healthy);
    panel.hidden = !revealed || finale;
    panel.classList.toggle('checklist-mode', inside);
    details.hidden = inside;
    checklist.hidden = !inside;
    progressPanel.hidden = !inside || finale;
    panel.dataset.state = healthy ? 'resolved' : 'active';
    $('#alarm-panel-title').textContent = healthy ? 'Recovery complete' : inside ? 'Recovery checklist' : 'Alarm center';
    $('#checklist-summary').textContent = `${completedChecks} of 5 checks complete`;
    $('#checklist-note').textContent = healthy ? 'Cooling recovered. Alarm cleared.' : 'Scroll to advance the simulated recovery.';
    checks.forEach((check, i) => {
      check.checked = i < completedChecks;
      check.closest('li').classList.toggle('complete', check.checked);
      check.closest('li').classList.toggle('current', i === completedChecks);
    });
    const status = healthy ? 'Issue solved. Cooling recovered.' : flowing ? 'Verifying circulation' : repairing ? 'Repair in progress' : inside ? 'Investigating the fault' : 'Cooling alarm active';
    progressStatus.textContent = status;
    progressBar.setAttribute('aria-valuetext', `${recoveryProgress}% - ${status}`);
    $('#accessible-caption').textContent = !revealed
      ? 'Pulse building overview with wind turbines and road traffic. Scroll to investigate.'
      : flowing && !healthy && time >= 4.03 ? 'Circulation resumed. Verifying recovery.'
        : healthy && activeChapter < 4 ? chapters[4].caption : chapters[activeChapter].caption;
  }
  function updateConnector(chapter) {
    if (panel.hidden || !panelBounds) { connector.setAttribute('hidden', ''); return; }
    const anchor = scene.project(chapter >= 1 && chapter <= 5 ? [2.55, LAYOUT.serviceY, 1.35] : [3.4, LAYOUT.ceilingY - 1.2, 2.6]);
    const mobile = window.innerWidth <= 760;
    const startX = mobile ? panelBounds.left + panelBounds.width * 0.6 : panelBounds.right;
    const startY = mobile ? panelBounds.bottom : panelBounds.top + panelBounds.height * 0.54;
    const hidden = !anchor.visible || anchor.x < 0 || anchor.x > innerWidth || anchor.y < 85 || anchor.y > innerHeight - 70 ||
      (mobile ? anchor.y < startY + 12 : anchor.x < startX + 12);
    connector.toggleAttribute('hidden', hidden);
    if (hidden) return;
    const elbow = mobile ? `V${startY + 18}` : `H${startX + Math.min(55, (anchor.x - startX) * 0.3)}`;
    connectorPath.setAttribute('d', `M${startX},${startY} ${elbow} L${anchor.x},${anchor.y}`);
    connectorTarget.setAttribute('cx', anchor.x);
    connectorTarget.setAttribute('cy', anchor.y);
  }
  function animate(_time, deltaMilliseconds) {
    const time = timeline.time();
    hero.inert = time > 0.015;
    finalHero.inert = time <= 7.55;
    scrollCue.hidden = trigger.progress > 0.001;
    let chapter = 0;
    chapterStarts.forEach((start, i) => { if (time >= start) chapter = i; });
    showChapter(chapter);
    updateStatus(time);
    if (!valveDialog.open) {
      scene.render(deltaMilliseconds / 1000);
      preview?.render(deltaMilliseconds / 1000, !panel.hidden && !details.hidden, userPaused || reducedMotion);
    }
    modalPreview?.render(deltaMilliseconds / 1000, valveDialog.open, true);
    updateConnector(chapter);
    updateDeviceTooltips();
  }
  // Render after GSAP updates the scroll timeline, on the same animation tick.
  gsap.ticker.add(animate);
  $('#loading').classList.add('loaded');
  // Read-only state makes the explanatory sequence inspectable in browser tests.
  window.__FORMA__ = { getState: () => ({ ...scene.getDiagnostics(), chapter: activeChapter, time: timeline.time(), progress: trigger.progress, reducedMotion, recoveryProgress, completedChecks, preview: preview?.getDiagnostics(), valveInspection: { open: valveDialog.open, ...modalPreview?.getDiagnostics() } }) };
  const onPageHide = () => gsap.ticker.remove(animate);
  const onPageShow = event => { if (event.persisted) gsap.ticker.add(animate); };
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    gsap.ticker.remove(animate);
    panelObserver.disconnect();
    tooltipObserver.disconnect();
    clearTimeout(hideDeviceTimer);
    document.removeEventListener('keydown', dismissDeviceOnEscape);
    document.removeEventListener('pointerdown', dismissDeviceOnOutside);
    hotspots.replaceChildren();
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    trigger.kill();
    timeline.kill();
    valveDialog.removeEventListener('close', closeValveDialog);
    valveDialog.removeEventListener('keydown', keepDialogFocus);
    if (valveDialog.open) {
      valveDialog.close();
      document.body.style.overflow = previousOverflow;
    }
    media.removeEventListener('change', onMotionChange);
    scene.dispose();
    preview?.dispose();
    modalPreview?.dispose();
  });
} else {
  showChapter(0);
}
