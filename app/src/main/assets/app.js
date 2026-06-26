"use strict";

const $ = id => document.getElementById(id);

const LS = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
  }
};

const dateKey = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const uid = p => p + Math.random().toString(36).slice(2,8) + Date.now().toString(36).slice(-3);
const TODAY = dateKey(new Date());

// ===== VIEW STATE =====
let viewDate = new Date();
let viewKey = TODAY;

// ===== CONFIG =====
const DEFAULT_HABITS = [
  {id:'h_water', name:'Drink 3 L water'},
  {id:'h_run',   name:'Running'},
  {id:'h_speak', name:'Speaking practice'},
];
let config = LS.get('msn_config', null);
if (!config) { config = {habits: DEFAULT_HABITS.slice(), city: null}; LS.set('msn_config', config); }
const saveConfig = () => LS.set('msn_config', config);

// ===== DAY DATA =====
function loadDay(key) {
  const d = LS.get('msn_day_' + key, null);
  return d ? {study: d.study || [], habits: d.habits || {}} : {study: [], habits: {}};
}
let day = loadDay(viewKey);
const saveDay = () => LS.set('msn_day_' + viewKey, day);

// ===== DAY NAVIGATION =====
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function updateDayNav() {
  const isToday = viewKey === TODAY;
  $('dayName').textContent = isToday ? 'Today — ' + DAYS[viewDate.getDay()] : DAYS[viewDate.getDay()];
  $('dateSub').textContent = `${viewDate.getDate()} ${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  $('dayNavNext').disabled = isToday;
  $('dayNavToday').style.display = isToday ? 'none' : '';
}

function navigateDay(delta) {
  const d = new Date(viewDate);
  d.setDate(d.getDate() + delta);
  if (dateKey(d) > TODAY) return;
  viewDate = d;
  viewKey = dateKey(viewDate);
  day = loadDay(viewKey);
  updateDayNav();
  renderStudy();
  renderHabits();
}

$('dayNavPrev').addEventListener('click', () => navigateDay(-1));
$('dayNavNext').addEventListener('click', () => navigateDay(1));
$('dayNavToday').addEventListener('click', () => {
  viewDate = new Date();
  viewKey = TODAY;
  day = loadDay(viewKey);
  updateDayNav();
  renderStudy();
  renderHabits();
});

// ===== DASHBOARD =====
let dashRange = 'all';

function dayKeyToDate(k) {
  const p = k.replace('msn_day_','').split('-');
  return new Date(+p[0], +p[1]-1, +p[2]);
}

function hm(m) {
  return Math.floor(m/60) + 'h ' + (m%60) + 'm';
}

function aggregate(range) {
  const byTopic = {}; let totalMins = 0; const seen = new Set(); let best = 0;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (range === '7' ? 6 : 29)); cutoff.setHours(0,0,0,0);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || k.indexOf('msn_day_') !== 0) continue;
    if ((range === '7' || range === '30') && dayKeyToDate(k) < cutoff) continue;
    let d; try { d = JSON.parse(localStorage.getItem(k)); } catch(e) { continue; }
    if (!d || !Array.isArray(d.study)) continue;
    let dm = 0;
    d.study.forEach(r => {
      const m = parseInt(r.minutes) || 0; if (m <= 0) return;
      dm += m;
      const name = (r.topic || '').trim();
      if (name) {
        const key = name.toLowerCase();
        if (!byTopic[key]) byTopic[key] = {name, mins: 0};
        byTopic[key].mins += m;
        byTopic[key].name = name;
      }
    });
    if (dm > 0) { totalMins += dm; seen.add(k); if (dm > best) best = dm; }
  }
  return {topics: Object.values(byTopic).sort((a,b) => b.mins - a.mins), totalMins, days: seen.size, best};
}

function renderDashboard() {
  const a = aggregate(dashRange);
  $('dTotal').textContent = hm(a.totalMins);
  $('dDays').textContent = a.days;
  $('dBest').textContent = hm(a.best);
  if (topicChart) updateCharts();
}

$('dashSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  $('dashSeg').querySelectorAll('button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); dashRange = b.dataset.range; renderDashboard();
}));

// ===== CHARTS =====
const CHART_COLORS = [
  '#0e8c7f','#e8a33d','#5b9bd5','#c45c5c','#9b77c7',
  '#4ab0b8','#7fad7f','#d4776a','#e88c3d','#8090a0'
];

let topicChart = null;
let dailyChart = null;

function getDailyData(numDays) {
  const result = [];
  const now = new Date();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = dateKey(d);
    const dd = loadDay(key);
    const mins = dd.study.reduce((s, r) => s + (parseInt(r.minutes) || 0), 0);
    result.push({
      label: String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'),
      mins
    });
  }
  return result;
}

function initCharts() {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.color = '#6b7a88';

  topicChart = new Chart($('topicCanvas').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: CHART_COLORS,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, boxWidth: 11, boxHeight: 11, font: { size: 12 } }
        },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${hm(ctx.parsed)}` }
        }
      },
      animation: { duration: 500 }
    }
  });

  dailyChart = new Chart($('dailyCanvas').getContext('2d'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Minutes',
        data: [],
        backgroundColor: 'rgba(14,140,127,0.78)',
        hoverBackgroundColor: 'rgba(14,140,127,1)',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + hm(ctx.parsed.y) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(220,227,233,0.7)' },
          ticks: { font: { size: 11 }, callback: v => v + 'm' },
          beginAtZero: true
        }
      },
      animation: { duration: 400 }
    }
  });

  updateCharts();
}

function updateCharts() {
  if (!topicChart || !dailyChart) return;

  const a = aggregate(dashRange);

  if (a.topics.length === 0) {
    $('topicEmpty').style.display = '';
    $('topicCanvas').style.display = 'none';
  } else {
    $('topicEmpty').style.display = 'none';
    $('topicCanvas').style.display = '';
    topicChart.data.labels = a.topics.map(t => t.name);
    topicChart.data.datasets[0].data = a.topics.map(t => t.mins);
    topicChart.data.datasets[0].backgroundColor = CHART_COLORS.slice(0, a.topics.length);
    topicChart.update();
  }

  const numDays = dashRange === '7' ? 7 : 30;
  const daily = getDailyData(numDays);
  dailyChart.data.labels = daily.map(d => d.label);
  dailyChart.data.datasets[0].data = daily.map(d => d.mins);
  dailyChart.update();
}

$('chartTabs').querySelectorAll('.ctab').forEach(b => b.addEventListener('click', () => {
  $('chartTabs').querySelectorAll('.ctab').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  const chart = b.dataset.chart;
  $('wrapTopic').style.display = chart === 'topic' ? '' : 'none';
  $('wrapDay').style.display = chart === 'day' ? '' : 'none';
}));

// ===== STUDY =====
function renderStudy() {
  const body = $('studyBody'); body.innerHTML = '';
  if (day.study.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="empty">No topics yet — add your first one below.</td></tr>';
  } else {
    day.study.forEach(row => {
      const tr = document.createElement('tr');
      const tdT = document.createElement('td');
      const tdM = document.createElement('td'); tdM.className = 'num';
      const tdX = document.createElement('td'); tdX.style.textAlign = 'right';

      const it = document.createElement('input');
      it.type = 'text'; it.value = row.topic; it.placeholder = 'Topic';
      it.addEventListener('input', e => { row.topic = e.target.value; saveDay(); renderDashboard(); });

      const im = document.createElement('input');
      im.type = 'number'; im.min = '0'; im.inputMode = 'numeric';
      im.value = (row.minutes || row.minutes === 0) ? row.minutes : '';
      im.placeholder = '0';
      im.addEventListener('input', e => {
        row.minutes = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
        saveDay(); renderTotal(); renderDashboard();
      });

      const bx = document.createElement('button');
      bx.className = 'rowx'; bx.textContent = '×'; bx.title = 'Remove';
      bx.addEventListener('click', () => { day.study = day.study.filter(r => r.id !== row.id); saveDay(); renderStudy(); });

      tdT.appendChild(it); tdM.appendChild(im); tdX.appendChild(bx);
      tr.append(tdT, tdM, tdX); body.appendChild(tr);
    });
  }
  $('studyNote').textContent = day.study.length + (day.study.length === 1 ? ' entry' : ' entries');
  renderTotal(); renderDashboard();
}

function renderTotal() {
  const mins = day.study.reduce((s, r) => s + (parseInt(r.minutes) || 0), 0);
  $('totalMin').textContent = mins + (mins === 1 ? ' minute' : ' minutes');
  $('totalBig').innerHTML = `${Math.floor(mins/60)}<small>h</small>${mins%60}<small>m</small>`;
}

$('addRow').addEventListener('click', () => {
  day.study.push({id: uid('s_'), topic: '', minutes: ''}); saveDay(); renderStudy();
  const inputs = $('studyBody').querySelectorAll('input[type=text]');
  if (inputs.length) inputs[inputs.length-1].focus();
});

// ===== HABITS =====
function isDone(key, hid) {
  const d = (key === TODAY) ? day : loadDay(key);
  return !!d.habits[hid];
}

function streak(hid) {
  let s = 0; const d = new Date();
  if (!isDone(TODAY, hid)) d.setDate(d.getDate()-1);
  while (isDone(dateKey(d), hid)) { s++; d.setDate(d.getDate()-1); }
  return s;
}

function renderHabits() {
  const list = $('habitList'); list.innerHTML = '';
  config.habits.forEach(h => {
    const done = !!day.habits[h.id];
    const wrap = document.createElement('div'); wrap.className = 'habit' + (done ? ' done' : '');
    const btn = document.createElement('button'); btn.className = 'check' + (done ? ' on' : '');
    btn.setAttribute('aria-label', (done ? 'Mark not done: ' : 'Mark done: ') + h.name);
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>';
    btn.addEventListener('click', () => {
      if (day.habits[h.id]) delete day.habits[h.id]; else day.habits[h.id] = true;
      saveDay(); renderHabits();
    });

    const name = document.createElement('div'); name.className = 'habit-name'; name.textContent = h.name;
    const right = document.createElement('div'); right.style.cssText = 'display:flex;align-items:center;gap:8px';
    const st = streak(h.id);
    if (st > 0) {
      const sb = document.createElement('span'); sb.className = 'streak'; sb.textContent = '🔥 ' + st + 'd'; right.appendChild(sb);
    }
    const del = document.createElement('button'); del.className = 'habit-del'; del.textContent = '×'; del.title = 'Remove habit';
    del.addEventListener('click', () => { config.habits = config.habits.filter(x => x.id !== h.id); saveConfig(); renderHabits(); });
    right.appendChild(del);
    wrap.append(btn, name, right); list.appendChild(wrap);
  });

  const total = config.habits.length, done = config.habits.filter(h => day.habits[h.id]).length;
  $('habitNote').textContent = `${done} / ${total} done`;
  const pct = total ? Math.round(done/total*100) : 0, C = 2*Math.PI*27;
  $('ringFg').setAttribute('stroke-dasharray', C);
  $('ringFg').setAttribute('stroke-dashoffset', C * (1 - pct/100));
  $('ringTxt').textContent = pct + '%';
}

$('habitAdd').addEventListener('click', addHabit);
$('habitInput').addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });
function addHabit() {
  const v = $('habitInput').value.trim();
  if (!v) return;
  config.habits.push({id: uid('h_'), name: v});
  saveConfig(); $('habitInput').value = ''; renderHabits();
}

// ===== REMINDERS =====
let reminders = LS.get('msn_reminders', []);
const saveRem = () => LS.set('msn_reminders', reminders);

function fmtWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
}

function renderReminders() {
  reminders.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.when) return 1; if (!b.when) return -1;
    return new Date(a.when) - new Date(b.when);
  });
  const list = $('remList'); list.innerHTML = '';
  if (reminders.length === 0) list.innerHTML = '<div class="empty">Nothing yet. Add a reminder above.</div>';
  const now = Date.now();
  reminders.forEach(r => {
    const wrap = document.createElement('div'); wrap.className = 'rem' + (r.done ? ' done' : '');
    const btn = document.createElement('button'); btn.className = 'check' + (r.done ? ' on' : '');
    btn.setAttribute('aria-label', (r.done ? 'Mark active: ' : 'Mark done: ') + r.text);
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>';
    btn.addEventListener('click', () => { r.done = !r.done; saveRem(); renderReminders(); scheduleAllNotifs(); });

    const bd = document.createElement('div'); bd.className = 'rem-body';
    const tx = document.createElement('div'); tx.className = 'rem-text'; tx.textContent = r.text; bd.appendChild(tx);
    if (r.when) {
      const wn = document.createElement('div'); wn.className = 'rem-when';
      if (!r.done && new Date(r.when).getTime() < now) {
        wn.classList.add('due'); wn.textContent = 'Overdue · ' + fmtWhen(r.when);
      } else {
        wn.textContent = fmtWhen(r.when);
      }
      bd.appendChild(wn);
    }
    const del = document.createElement('button'); del.className = 'habit-del'; del.textContent = '×'; del.title = 'Delete'; del.style.marginTop = '2px';
    del.addEventListener('click', () => { reminders = reminders.filter(x => x.id !== r.id); saveRem(); renderReminders(); scheduleAllNotifs(); });
    wrap.append(btn, bd, del); list.appendChild(wrap);
  });
  const active = reminders.filter(r => !r.done).length;
  $('remNote').textContent = active + ' active';
}

$('remAdd').addEventListener('click', addRem);
$('remText').addEventListener('keydown', e => { if (e.key === 'Enter') addRem(); });
function addRem() {
  const t = $('remText').value.trim();
  if (!t) return;
  const when = $('remWhen').value || '';
  reminders.push({id: uid('r_'), text: t, when, done: false});
  saveRem(); $('remText').value = ''; $('remWhen').value = ''; renderReminders();
  if (when) {
    if (notifCanAsk()) requestNotifPermission();
    else if (notifGranted()) scheduleAllNotifs();
  }
}

// ===== NOTIFICATIONS =====
// On Android the WebView JS bridge (AndroidNotif) is used.
// In a desktop browser the standard Web Notifications API is used as fallback.
const _android = (typeof window.AndroidNotif !== 'undefined') ? window.AndroidNotif : null;

function notifGranted() {
  if (_android) return _android.hasPermission();
  return ('Notification' in window) && Notification.permission === 'granted';
}

function notifCanAsk() {
  if (_android) return !_android.hasPermission();
  return ('Notification' in window) && Notification.permission === 'default';
}

function updateNotifPrompt() {
  $('notifPrompt').style.display = notifCanAsk() ? '' : 'none';
}

function requestNotifPermission() {
  if (_android) {
    _android.requestPermission();
    // Android permission dialog is async — poll result after a delay
    setTimeout(() => { updateNotifPrompt(); if (notifGranted()) scheduleAllNotifs(); }, 1500);
    setTimeout(() => { updateNotifPrompt(); if (notifGranted()) scheduleAllNotifs(); }, 3000);
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      updateNotifPrompt();
      if (p === 'granted') scheduleAllNotifs();
    });
  }
}

$('notifPromptBtn').addEventListener('click', requestNotifPermission);

// Two-tone beep via Web Audio API (desktop browser only)
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.28);
    });
  } catch(e) {}
}

function fireNotif(title, body, when) {
  if (!notifGranted()) return;
  const fullBody = when ? body + '\n📅 ' + fmtWhen(when) : body;
  if (_android) {
    _android.showNotification(title, fullBody);
  } else {
    try { new Notification(title, { body: fullBody }); } catch(e) {}
    playNotifSound();
  }
}

// Precise scheduling with setTimeout + 30s safety-net interval
const _notifTimers = {};

function scheduleAllNotifs() {
  if (!notifGranted()) return;

  // Cancel all existing timers before rescheduling
  Object.keys(_notifTimers).forEach(k => { clearTimeout(_notifTimers[k]); delete _notifTimers[k]; });

  const now = Date.now();
  const fired = LS.get('msn_notif_fired', {});
  let changed = false;

  reminders.forEach(r => {
    if (r.done || !r.when) return;
    const due = new Date(r.when).getTime();
    if (isNaN(due)) return;

    // 5-minute warning
    const w5Key = r.id + '_w5';
    const w5At  = due - 5 * 60 * 1000;
    if (!fired[w5Key]) {
      const delay = w5At - now;
      if (delay > 0) {
        _notifTimers[w5Key] = setTimeout(() => {
          const rem = reminders.find(x => x.id === r.id);
          if (rem && !rem.done) {
            fireNotif('Reminder in 5 minutes', rem.text, rem.when);
            const f = LS.get('msn_notif_fired', {}); f[w5Key] = true; LS.set('msn_notif_fired', f);
          }
        }, delay);
      } else if (delay > -60000) {
        fireNotif('Reminder in 5 minutes', r.text, r.when);
        fired[w5Key] = true; changed = true;
      }
    }

    // Due-time alert
    const dueKey = r.id + '_due';
    if (!fired[dueKey]) {
      const delay = due - now;
      if (delay > 0) {
        _notifTimers[dueKey] = setTimeout(() => {
          const rem = reminders.find(x => x.id === r.id);
          if (rem && !rem.done) {
            fireNotif('⏰ Reminder due now', rem.text, rem.when);
            const f = LS.get('msn_notif_fired', {}); f[dueKey] = true; LS.set('msn_notif_fired', f);
          }
        }, delay);
      } else if (delay > -120000) {
        fireNotif('⏰ Reminder due now', r.text, r.when);
        fired[dueKey] = true; changed = true;
      }
    }
  });

  if (changed) LS.set('msn_notif_fired', fired);

  // Clean up keys for reminders that are done or deleted
  const activeIds = new Set(reminders.filter(r => !r.done).map(r => r.id));
  const clean = {};
  Object.keys(fired).forEach(k => {
    if (activeIds.has(k.replace(/_w5$|_due$/, ''))) clean[k] = fired[k];
  });
  LS.set('msn_notif_fired', clean);
}

// Safety-net: re-check every 30 s in case app was in background
setInterval(() => { if (notifGranted()) scheduleAllNotifs(); }, 30000);

// ===== WEATHER UI STATE =====
function showWeatherControls() {
  $('wControls').style.display = '';
  $('wChange').style.display = 'none';
}

function hideWeatherControls() {
  $('wControls').style.display = 'none';
  $('wChange').style.display = '';
}

$('wChange').addEventListener('click', showWeatherControls);

// ===== WEATHER =====
const WMO = {
  0:['☀️','Clear sky'], 1:['🌤️','Mainly clear'], 2:['⛅','Partly cloudy'], 3:['☁️','Overcast'],
  45:['🌫️','Fog'], 48:['🌫️','Rime fog'],
  51:['🌦️','Light drizzle'], 53:['🌦️','Drizzle'], 55:['🌧️','Dense drizzle'],
  56:['🌧️','Freezing drizzle'], 57:['🌧️','Freezing drizzle'],
  61:['🌦️','Light rain'], 63:['🌧️','Rain'], 65:['🌧️','Heavy rain'],
  66:['🌧️','Freezing rain'], 67:['🌧️','Freezing rain'],
  71:['🌨️','Light snow'], 73:['🌨️','Snow'], 75:['❄️','Heavy snow'], 77:['🌨️','Snow grains'],
  80:['🌦️','Rain showers'], 81:['🌧️','Rain showers'], 82:['⛈️','Violent showers'],
  85:['🌨️','Snow showers'], 86:['🌨️','Snow showers'],
  95:['⛈️','Thunderstorm'], 96:['⛈️','Thunderstorm + hail'], 99:['⛈️','Thunderstorm + hail']
};

async function fetchWeather(lat, lon, label) {
  $('wCond').textContent = 'Loading…'; $('wNote').textContent = '';
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(url); if (!res.ok) throw 0;
    const c = (await res.json()).current; const w = WMO[c.weather_code] || ['🌡️','—'];
    $('wEmoji').textContent = w[0];
    $('wTemp').innerHTML = `${Math.round(c.temperature_2m)}<span>°C</span>`;
    $('wCond').textContent = w[1]; $('wLoc').textContent = label || '';
    $('wExtra').textContent = `Feels ${Math.round(c.apparent_temperature)}° · Humidity ${c.relative_humidity_2m}% · Wind ${Math.round(c.wind_speed_10m)} km/h`;
    $('wNote').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
  } catch(e) {
    $('wCond').textContent = 'Could not load weather';
    $('wExtra').textContent = 'Check your connection and try again.';
  }
}

async function setCity(name) {
  $('wCond').textContent = 'Searching…';
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (!data.results || !data.results.length) { $('wCond').textContent = 'City not found — try another spelling.'; return; }
    const r = data.results[0];
    const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(', ');
    config.city = {name: label, lat: r.latitude, lon: r.longitude}; saveConfig();
    fetchWeather(r.latitude, r.longitude, label);
  } catch(e) {
    $('wCond').textContent = 'Search failed — check your connection.';
  }
}

// ===== CITY AUTOCOMPLETE =====
let suggestTimer = null;

function hideSuggestions() {
  $('citySuggestions').style.display = 'none';
  $('citySuggestions').innerHTML = '';
}

function showSuggestions(results) {
  const list = $('citySuggestions');
  list.innerHTML = '';
  results.forEach(r => {
    const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(', ');
    const fullLabel = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
    const item = document.createElement('div');
    item.className = 'city-suggestion';
    item.innerHTML = `<div class="city-sug-name">${r.name}</div>` +
      `<div class="city-sug-detail">${[r.admin1, r.country].filter(Boolean).join(', ')}</div>`;
    item.addEventListener('mousedown', e => {
      e.preventDefault(); // prevent input blur before click fires
      $('cityInput').value = '';
      hideSuggestions();
      config.city = { name: fullLabel, lat: r.latitude, lon: r.longitude };
      saveConfig();
      fetchWeather(r.latitude, r.longitude, fullLabel);
    });
    list.appendChild(item);
  });
  list.style.display = '';
}

async function fetchSuggestions(name) {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=en&format=json`);
    const data = await res.json();
    if (!data.results || !data.results.length) { hideSuggestions(); return; }
    showSuggestions(data.results);
  } catch(e) { hideSuggestions(); }
}

$('cityInput').addEventListener('input', e => {
  clearTimeout(suggestTimer);
  const v = e.target.value.trim();
  if (v.length < 2) { hideSuggestions(); return; }
  suggestTimer = setTimeout(() => fetchSuggestions(v), 300);
});

$('cityInput').addEventListener('blur', () => setTimeout(hideSuggestions, 150));

$('cityGo').addEventListener('click', () => {
  const v = $('cityInput').value.trim();
  hideSuggestions();
  if (v) { setCity(v); $('cityInput').value = ''; }
});
$('cityInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const v = e.target.value.trim(); hideSuggestions(); if (v) { setCity(v); e.target.value = ''; } }
  if (e.key === 'Escape') hideSuggestions();
});
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const d = await res.json();
    const city = d.city || d.locality || d.principalSubdivision || '';
    const country = d.countryName || '';
    return [city, country].filter(Boolean).join(', ') || 'My location';
  } catch(e) { return 'My location'; }
}

async function fetchWeatherByCoords(lat, lon) {
  $('wCond').textContent = 'Loading…';
  const label = await reverseGeocode(lat, lon);
  config.city = { name: label, lat, lon }; saveConfig();
  await fetchWeather(lat, lon, label);
  hideWeatherControls();
}

function autoDetectLocation() {
  if (!navigator.geolocation) {
    $('wCond').textContent = 'Set your city below';
    showWeatherControls();
    if (config.city) fetchWeather(config.city.lat, config.city.lon, config.city.name);
    return;
  }
  $('wCond').textContent = 'Detecting your location…';
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
    () => {
      showWeatherControls();
      if (config.city) {
        fetchWeather(config.city.lat, config.city.lon, config.city.name);
      } else {
        $('wCond').textContent = 'Set your city below';
      }
    },
    { timeout: 8000 }
  );
}

$('geoBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { $('wCond').textContent = 'Location not supported on this device.'; return; }
  $('wCond').textContent = 'Locating…';
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
    () => { $('wCond').textContent = 'Location blocked — type a city instead.'; }
  );
});

// ===== CALENDAR =====
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

let calDate = new Date();
let selectedCalDay = null;

function renderCalendar() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  $('calMonthLabel').textContent = CAL_MONTHS[month] + ' ' + year;

  const grid = $('calGrid');
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell cal-blank';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(new Date(year, month, d));
    const dd = loadDay(key);
    const mins = dd.study.reduce((s, r) => s + (parseInt(r.minutes) || 0), 0);
    const habitsTotal = config.habits.length;
    const habitsDone = habitsTotal ? config.habits.filter(h => dd.habits[h.id]).length : 0;

    const cell = document.createElement('div');
    let cls = 'cal-cell';
    if (key === TODAY) cls += ' cal-today';
    if (key === selectedCalDay) cls += ' cal-selected';
    cell.className = cls;

    const numEl = document.createElement('span');
    numEl.className = 'cal-num';
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (mins > 0 || habitsDone > 0) {
      const dots = document.createElement('div');
      dots.className = 'cal-dots';
      if (mins > 0) {
        const dot = document.createElement('span');
        dot.className = 'cal-dot cal-dot-study';
        dots.appendChild(dot);
      }
      if (habitsDone > 0 && habitsTotal > 0) {
        const dot = document.createElement('span');
        dot.className = 'cal-dot cal-dot-habit';
        dot.style.opacity = String(Math.max(0.35, habitsDone / habitsTotal));
        dots.appendChild(dot);
      }
      cell.appendChild(dots);
    }

    cell.addEventListener('click', () => {
      selectedCalDay = selectedCalDay === key ? null : key;
      renderCalendar();
    });

    grid.appendChild(cell);
  }

  renderCalDetail(selectedCalDay);
}

function renderCalDetail(key) {
  const detail = $('calDetail');
  if (!key) { detail.style.display = 'none'; return; }

  const dd = loadDay(key);
  const [y, m, d] = key.split('-');
  const date = new Date(+y, +m-1, +d);

  let html = `<div class="cal-detail-date">${CAL_DAY_NAMES[date.getDay()]}, ${+d} ${CAL_MONTHS[+m-1]} ${y}</div>`;

  const studyRows = dd.study.filter(r => (r.topic || '').trim() || (parseInt(r.minutes) || 0) > 0);
  html += '<div class="cal-detail-section"><div class="cal-detail-label">Study';
  if (studyRows.length > 0) {
    const totalMins = studyRows.reduce((s, r) => s + (parseInt(r.minutes) || 0), 0);
    html += ' · ' + hm(totalMins);
  }
  html += '</div>';
  if (studyRows.length > 0) {
    studyRows.forEach(r => {
      html += `<div class="cal-detail-row"><span>${r.topic || '(no topic)'}</span><span class="cal-detail-mins">${parseInt(r.minutes) || 0}m</span></div>`;
    });
  } else {
    html += '<div class="cal-detail-none">No study logged.</div>';
  }
  html += '</div>';

  if (config.habits.length > 0) {
    html += '<div class="cal-detail-section"><div class="cal-detail-label">Habits</div>';
    config.habits.forEach(h => {
      const done = !!(dd.habits && dd.habits[h.id]);
      html += `<div class="cal-detail-row"><span>${done ? '✅' : '⬜'} ${h.name}</span></div>`;
    });
    html += '</div>';
  }

  detail.innerHTML = html;
  detail.style.display = '';
}

$('calPrev').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() - 1);
  selectedCalDay = null;
  renderCalendar();
});
$('calNext').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() + 1);
  selectedCalDay = null;
  renderCalendar();
});


// ===== INIT =====
updateDayNav();
renderStudy();
renderHabits();
renderReminders();
updateNotifPrompt();
if (notifGranted()) scheduleAllNotifs();
initCharts();
renderDashboard();
renderCalendar();
autoDetectLocation();
