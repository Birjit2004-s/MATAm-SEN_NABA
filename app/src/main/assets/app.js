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
let day = loadDay(TODAY);
const saveDay = () => LS.set('msn_day_' + TODAY, day);

// ===== DATE DISPLAY =====
(function() {
  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  $('dayName').textContent = days[now.getDay()];
  $('dateSub').textContent = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
})();

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
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-6); cutoff.setHours(0,0,0,0);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || k.indexOf('msn_day_') !== 0) continue;
    if (range === '7' && dayKeyToDate(k) < cutoff) continue;
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
  const bars = $('bars');
  if (a.topics.length === 0) {
    bars.innerHTML = '<div class="dash-empty">Add topics in the table below — your time per topic will build up here automatically.</div>';
    return;
  }
  const max = a.topics[0].mins || 1;
  bars.innerHTML = '';
  a.topics.slice(0, 12).forEach((t, i) => {
    const item = document.createElement('div'); item.className = 'bar-item';
    const top = document.createElement('div'); top.className = 'bar-top';
    const nm = document.createElement('span'); nm.className = 'bar-name'; nm.textContent = t.name;
    const tm = document.createElement('span'); tm.className = 'bar-time'; tm.textContent = hm(t.mins);
    top.append(nm, tm);
    const track = document.createElement('div'); track.className = 'bar-track';
    const fill = document.createElement('div'); fill.className = 'bar-fill' + (i === 0 ? ' lead' : '');
    track.appendChild(fill);
    item.append(top, track); bars.appendChild(item);
    requestAnimationFrame(() => { fill.style.width = Math.max(4, Math.round(t.mins/max*100)) + '%'; });
  });
}

$('dashSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  $('dashSeg').querySelectorAll('button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); dashRange = b.dataset.range; renderDashboard();
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
    btn.addEventListener('click', () => { r.done = !r.done; saveRem(); renderReminders(); });

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
    del.addEventListener('click', () => { reminders = reminders.filter(x => x.id !== r.id); saveRem(); renderReminders(); });
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
  reminders.push({id: uid('r_'), text: t, when: $('remWhen').value || '', done: false});
  saveRem(); $('remText').value = ''; $('remWhen').value = ''; renderReminders();
}

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

$('cityGo').addEventListener('click', () => { const v = $('cityInput').value.trim(); if (v) { setCity(v); $('cityInput').value = ''; } });
$('cityInput').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) { setCity(v); e.target.value = ''; } } });
$('geoBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { $('wCond').textContent = 'Location not supported on this device.'; return; }
  $('wCond').textContent = 'Locating…';
  navigator.geolocation.getCurrentPosition(
    pos => {
      const {latitude, longitude} = pos.coords;
      config.city = {name: 'My location', lat: latitude, lon: longitude}; saveConfig();
      fetchWeather(latitude, longitude, 'My location');
    },
    () => { $('wCond').textContent = 'Location blocked — type a city instead.'; }
  );
});

// ===== INIT =====
renderStudy();
renderHabits();
renderReminders();
renderDashboard();
if (config.city) { fetchWeather(config.city.lat, config.city.lon, config.city.name); }
