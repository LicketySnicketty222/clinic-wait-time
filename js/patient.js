let clinicConfig  = null;
let pollInterval  = null;
let hoursInterval = null;

const els = {
  card:        document.getElementById('wait-card'),
  waitMinutes: document.getElementById('wait-minutes'),
  waitLabel:   document.getElementById('wait-label'),
  noWait:      document.getElementById('no-wait'),
  loading:     document.getElementById('wait-loading'),
  closedBanner:document.getElementById('closed-banner'),
  closedMsg:   document.getElementById('closed-msg'),
  lastUpdated: document.getElementById('last-updated'),
  clinicName:  document.getElementById('clinic-name'),
};

async function init() {
  const { data } = await db.from('clinic_config').select('*').single();

  if (data) {
    clinicConfig = data;
    if (els.clinicName && data.clinic_name) {
      els.clinicName.textContent = data.clinic_name;
      document.title = data.clinic_name + ' — Wait Time';
    }
  }

  applyHoursCheck();
  hoursInterval = setInterval(applyHoursCheck, 60_000);
}

async function applyHoursCheck() {
  // Fetch latest status to check is_open_override
  const { data: status } = await db
    .from('clinic_status')
    .select('*')
    .order('last_updated', { ascending: false })
    .limit(1)
    .single();

  // Determine open/closed: override takes priority over schedule
  let isOpen;
  if (status?.is_open_override === true) {
    isOpen = true;
  } else if (status?.is_open_override === false) {
    isOpen = false;
  } else {
    isOpen = isClinicOpen(clinicConfig);
  }

  if (!isOpen) {
    const next = nextOpenTime(clinicConfig);
    showClosed(next);
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    return;
  }

  hideClosed();
  showWaitTime(status);

  if (!pollInterval) {
    pollInterval = setInterval(fetchAndShow, 30_000);
  }
}

async function fetchAndShow() {
  const { data } = await db
    .from('clinic_status')
    .select('*')
    .order('last_updated', { ascending: false })
    .limit(1)
    .single();
  showWaitTime(data);
}

function showWaitTime(row) {
  if (els.loading) els.loading.style.display = 'none';

  const minutes = row?.current_wait_minutes ?? 0;

  if (minutes <= 0) {
    els.waitMinutes.style.display = 'none';
    els.waitLabel.style.display   = 'none';
    els.noWait.style.display      = 'block';
  } else {
    els.waitMinutes.textContent   = minutes;
    els.waitMinutes.style.display = 'block';
    els.waitLabel.style.display   = 'block';
    els.noWait.style.display      = 'none';
  }

  if (row?.last_updated && els.lastUpdated) {
    const d = new Date(row.last_updated);
    els.lastUpdated.textContent = 'Updated ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

function showClosed(nextOpen) {
  els.card.style.display         = 'none';
  els.closedBanner.style.display = 'flex';
  els.closedMsg.textContent      = nextOpen
    ? `Clinic is currently closed. Opens at ${nextOpen}.`
    : 'Clinic is currently closed.';
}

function hideClosed() {
  els.card.style.display         = 'flex';
  els.closedBanner.style.display = 'none';
}

init();
