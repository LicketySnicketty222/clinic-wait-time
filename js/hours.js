const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function localTimeInZone(timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'long',
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const [h, m] = get('hour').split(':').map(Number);
  return { dayName: get('weekday').toLowerCase(), hour: h, minute: m };
}

function minutesSinceMidnight(h, m) {
  return h * 60 + m;
}

function parseTime(str) {
  const [h, m] = str.split(':').map(Number);
  return minutesSinceMidnight(h, m);
}

function formatTime(str) {
  const [h, m] = str.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isClinicOpen(config) {
  if (!config?.operating_hours || !config?.timezone) return false;
  const { dayName, hour, minute } = localTimeInZone(config.timezone);
  const hours = config.operating_hours[dayName];
  if (!hours?.open || !hours?.close) return false;
  const now = minutesSinceMidnight(hour, minute);
  return now >= parseTime(hours.open) && now < parseTime(hours.close);
}

function nextOpenTime(config) {
  if (!config?.operating_hours || !config?.timezone) return null;
  const { dayName, hour, minute } = localTimeInZone(config.timezone);
  const now = minutesSinceMidnight(hour, minute);
  const todayIdx = DAYS.indexOf(dayName);

  for (let offset = 0; offset <= 7; offset++) {
    const idx = (todayIdx + offset) % 7;
    const name = DAYS[idx];
    const hours = config.operating_hours[name];
    if (!hours?.open || !hours?.close) continue;

    const openMin = parseTime(hours.open);
    if (offset === 0 && now >= openMin) continue; // already past today's open

    const label = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : capitalize(name);
    return `${formatTime(hours.open)} ${label}`;
  }
  return null;
}
