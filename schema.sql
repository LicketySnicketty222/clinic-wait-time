-- ═══════════════════════════════════════════════════════════
--  Clinic Wait Time — Supabase Database Setup
--  Run this entire file once in:
--  Supabase Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

-- ── Tables ────────────────────────────────────────────────

create table if not exists clinic_status (
  id                    uuid primary key default gen_random_uuid(),
  current_wait_minutes  integer not null default 0,
  patients_in_queue     integer not null default 0,
  last_updated          timestamptz not null default now(),
  is_open_override      boolean default null  -- null = use hours; true/false = force
);

create table if not exists clinic_config (
  id                       uuid primary key default gen_random_uuid(),
  clinic_name              text not null default 'Our Clinic',
  operating_hours          jsonb not null default '{
    "monday":    {"open": "09:00", "close": "17:00"},
    "tuesday":   {"open": "09:00", "close": "17:00"},
    "wednesday": {"open": "09:00", "close": "17:00"},
    "thursday":  {"open": "09:00", "close": "17:00"},
    "friday":    {"open": "09:00", "close": "17:00"},
    "saturday":  {"open": null, "close": null},
    "sunday":    {"open": null, "close": null}
  }'::jsonb,
  timezone                 text not null default 'America/Chicago',
  avg_minutes_per_patient  integer not null default 10,
  brand_color_primary      text default '#0d7a6e',
  brand_color_secondary    text default '#0a3d54'
);

-- ── Seed initial rows (run once) ──────────────────────────

insert into clinic_status (current_wait_minutes, patients_in_queue)
values (0, 0)
on conflict do nothing;

insert into clinic_config (clinic_name)
values ('Our Clinic')
on conflict do nothing;

-- ── Row-Level Security ────────────────────────────────────

alter table clinic_status enable row level security;
alter table clinic_config  enable row level security;

-- Anyone (patients) can read current status and config
create policy "public read status"
  on clinic_status for select
  using (true);

create policy "public read config"
  on clinic_config for select
  using (true);

-- Only authenticated staff can write to status
create policy "staff write status"
  on clinic_status for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Only authenticated staff can write config (settings)
create policy "staff write config"
  on clinic_config for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── Enable Realtime ───────────────────────────────────────
-- In Supabase Dashboard → Database → Replication
-- toggle clinic_status to ON for real-time patient updates.
-- (Can't be done via SQL — requires the dashboard toggle.)
