-- Water Leak Alert Module — extends the existing Utilyze schema.
-- Run this in the Supabase SQL Editor after 002_seed_san_antonio.sql.
-- Server uses service_role key which bypasses RLS — no policies needed.

create table water_customers (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete set null,
  business_name text not null,
  city text not null,
  state text not null default 'TX',
  utility_provider text not null default 'SAWS',
  utility_username text not null,
  utility_password_encrypted text not null,
  meter_id text,
  move_in_date text,
  phone_number text not null,
  timezone text not null default 'America/Chicago',
  check_time text not null default '12:00',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table water_customers enable row level security;

create table water_business_hours (
  id uuid primary key default uuid_generate_v4(),
  water_customer_id uuid not null references water_customers(id) on delete cascade,
  day_of_week int not null,            -- 0=Sunday ... 6=Saturday
  is_open boolean not null default true,
  open_time time,
  close_time time,
  unique (water_customer_id, day_of_week)
);
alter table water_business_hours enable row level security;

create table water_alert_settings (
  id uuid primary key default uuid_generate_v4(),
  water_customer_id uuid not null references water_customers(id) on delete cascade,
  after_hours_enabled boolean not null default true,
  min_after_hours_gallons numeric not null default 50,
  continuous_flow_enabled boolean not null default true,
  continuous_flow_min_hourly_gallons numeric not null default 0.1,
  unique (water_customer_id)
);
alter table water_alert_settings enable row level security;

create table water_usage_records (
  id uuid primary key default uuid_generate_v4(),
  water_customer_id uuid not null references water_customers(id) on delete cascade,
  usage_date date not null,
  hour int not null,                   -- 0..23
  gallons numeric not null,
  retrieved_at timestamptz not null default now(),
  unique (water_customer_id, usage_date, hour)
);
alter table water_usage_records enable row level security;

create table water_alerts (
  id uuid primary key default uuid_generate_v4(),
  water_customer_id uuid not null references water_customers(id),
  alert_type text not null,            -- 'after_hours' | 'continuous_flow'
  message text not null,
  detection_date date not null,
  status text not null,                -- 'sent' | 'failed' | 'skipped' | 'test_logged'
  provider text,
  provider_message_id text,
  error_message text,
  skip_reason text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
alter table water_alerts enable row level security;

create table water_scrape_runs (
  id uuid primary key default uuid_generate_v4(),
  water_customer_id uuid not null references water_customers(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,                -- 'running' | 'success' | 'error'
  rows_retrieved int,
  error_message text
);
alter table water_scrape_runs enable row level security;
