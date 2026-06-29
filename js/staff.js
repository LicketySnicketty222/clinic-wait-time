// ── Supabase guard ────────────────────────────────────────────────────────────
if (!db) {
  document.body.innerHTML = '<p style="padding:2rem;color:red;font-size:1.1rem;">Unable to connect to the database. Please check your internet connection and reload.</p>';
  throw new Error('Supabase failed to load');
}

// ── Auth (PIN-based, no Supabase Auth) ───────────────────────────────────────

const loginSection = document.getElementById('login-section');
const dashSection  = document.getElementById('dashboard-section');
const loginError   = document.getElementById('login-error');

function handleLogin() {
  const entered = document.getElementById('staff-pin').value;
  if (entered === STAFF_PIN) {
    sessionStorage.setItem('staff_auth', '1');
    showDashboard();
  } else {
    loginError.textContent = 'Incorrect PIN. Please try again.';
    document.getElementById('staff-pin').value = '';
    document.getElementById('staff-pin').focus();
  }
}

document.getElementById('staff-pin').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('staff_auth');
  dashSection.style.display = 'none';
  loginSection.style.display = 'flex';
});

function checkSession() {
  if (sessionStorage.getItem('staff_auth') === '1') {
    showDashboard();
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

let currentStatus = null;
let clinicConfig  = null;
let pollInterval  = null;

const els = {
  queue:          document.getElementById('queue-count'),
  waitMins:       document.getElementById('wait-mins'),
  lastUpdated:    document.getElementById('last-updated'),
  overrideInput:  document.getElementById('override-input'),
  settingsPanel:  document.getElementById('settings-panel'),
  avgInput:       document.getElementById('avg-minutes-input'),
  tzInput:        document.getElementById('tz-input'),
  clinicNameInput:document.getElementById('clinic-name-input'),
};

async function showDashboard() {
  loginSection.style.display = 'none';
  dashSection.style.display  = 'block';
  await loadConfig();
  await refreshStatus();
  buildHoursUI();
  pollInterval = setInterval(refreshStatus, 15_000);
}

async function loadConfig() {
  const { data } = await db.from('clinic_config').select('*').single();
  clinicConfig = data || {};
  if (els.avgInput)        els.avgInput.value        = clinicConfig.avg_minutes_per_patient ?? 10;
  if (els.tzInput)         els.tzInput.value         = clinicConfig.timezone ?? '';
  if (els.clinicNameInput) els.clinicNameInput.value = clinicConfig.clinic_name ?? '';
}

async function refreshStatus() {
  const { data } = await db
    .from('clinic_status')
    .select('*')
    .order('last_updated', { ascending: false })
    .limit(1)
    .single();
  currentStatus = data || { current_wait_minutes: 0, patients_in_queue: 0 };
  renderStatus();
}

function renderStatus() {
  const q = currentStatus?.patients_in_queue    ?? 0;
  const w = currentStatus?.current_wait_minutes ?? 0;
  if (els.queue)       els.queue.textContent    = q;
  if (els.waitMins)    els.waitMins.textContent = w;
  if (els.lastUpdated && currentStatus?.last_updated) {
    const d = new Date(currentStatus.last_updated);
    els.lastUpdated.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

// ── Tally buttons ─────────────────────────────────────────────────────────────

document.getElementById('add-patient-btn').addEventListener('click',    () => adjustQueue(+1));
document.getElementById('remove-patient-btn').addEventListener('click', () => adjustQueue(-1));

async function adjustQueue(delta) {
  const avg      = clinicConfig?.avg_minutes_per_patient ?? 10;
  const newQueue = Math.max(0, (currentStatus?.patients_in_queue ?? 0) + delta);
  const newWait  = newQueue * avg;
  await writeStatus({ patients_in_queue: newQueue, current_wait_minutes: newWait, is_open_override: null });
  await refreshStatus();
}

// ── Manual wait override ──────────────────────────────────────────────────────

document.getElementById('set-wait-btn').addEventListener('click', async () => {
  const val = parseInt(els.overrideInput?.value, 10);
  if (isNaN(val) || val < 0) return;
  await writeStatus({ current_wait_minutes: val });
  els.overrideInput.value = '';
  await refreshStatus();
});

// ── Open / Closed override ────────────────────────────────────────────────────

document.getElementById('open-override-btn').addEventListener('click',   () => writeStatus({ is_open_override: true }));
document.getElementById('closed-override-btn').addEventListener('click', () => writeStatus({ is_open_override: false }));
document.getElementById('clear-override-btn').addEventListener('click',  () => writeStatus({ is_open_override: null }));

// ── Shared write helper ───────────────────────────────────────────────────────

async function writeStatus(fields) {
  const { data: existing } = await db.from('clinic_status').select('id').limit(1).single();
  const payload = { ...fields, last_updated: new Date().toISOString() };
  if (existing?.id) {
    await db.from('clinic_status').update(payload).eq('id', existing.id);
  } else {
    await db.from('clinic_status').insert(payload);
  }
}

// ── Settings panel ────────────────────────────────────────────────────────────

document.getElementById('settings-toggle-btn').addEventListener('click', () => {
  const panel = els.settingsPanel;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

// ── Operating hours UI ────────────────────────────────────────────────────────

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

function buildHoursUI() {
  const container = document.getElementById('hours-grid');
  if (!container) return;
  container.innerHTML = '';

  DAYS.forEach((day) => {
    const existing = clinicConfig?.operating_hours?.[day];
    const row = document.createElement('div');
    row.className = 'hours-row';

    const label = document.createElement('label');
    label.textContent = day.charAt(0).toUpperCase() + day.slice(1);

    const openInput = document.createElement('input');
    openInput.type = 'time'; openInput.dataset.day = day; openInput.dataset.field = 'open';
    openInput.value = existing?.open ?? '';

    const closeInput = document.createElement('input');
    closeInput.type = 'time'; closeInput.dataset.day = day; closeInput.dataset.field = 'close';
    closeInput.value = existing?.close ?? '';

    const closedCheck = document.createElement('input');
    closedCheck.type = 'checkbox'; closedCheck.dataset.day = day;
    closedCheck.id = `closed-${day}`; closedCheck.checked = !existing?.open;

    const closedLabel = document.createElement('label');
    closedLabel.htmlFor = `closed-${day}`; closedLabel.textContent = 'Closed';

    const toggleDisabled = () => {
      openInput.disabled  = closedCheck.checked;
      closeInput.disabled = closedCheck.checked;
    };
    closedCheck.addEventListener('change', toggleDisabled);
    toggleDisabled();

    row.append(label, openInput, document.createTextNode('–'), closeInput, closedCheck, closedLabel);
    container.appendChild(row);
  });
}

document.getElementById('save-settings-btn').addEventListener('click', async () => {
  const hours = {};
  DAYS.forEach((day) => {
    const closed = document.querySelector(`input[data-day="${day}"][type="checkbox"]`)?.checked;
    hours[day] = closed
      ? { open: null, close: null }
      : {
          open:  document.querySelector(`input[data-day="${day}"][data-field="open"]`)?.value  || null,
          close: document.querySelector(`input[data-day="${day}"][data-field="close"]`)?.value || null,
        };
  });

  const payload = {
    operating_hours:         hours,
    timezone:                els.tzInput?.value.trim()             || 'America/Chicago',
    avg_minutes_per_patient: parseInt(els.avgInput?.value, 10)     || 10,
    clinic_name:             els.clinicNameInput?.value.trim()      || '',
  };

  const { data: existing } = await db.from('clinic_config').select('id').limit(1).single();
  if (existing?.id) {
    await db.from('clinic_config').update(payload).eq('id', existing.id);
  } else {
    await db.from('clinic_config').insert(payload);
  }

  clinicConfig = { ...clinicConfig, ...payload };
  const msg = document.getElementById('settings-saved-msg');
  msg.style.display = 'block';
  setTimeout(() => (msg.style.display = 'none'), 2500);
});

// ── Boot ──────────────────────────────────────────────────────────────────────

checkSession();
