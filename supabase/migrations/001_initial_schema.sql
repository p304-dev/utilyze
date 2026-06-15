create extension if not exists "uuid-ossp";

create table businesses (
  id uuid primary key default uuid_generate_v4(),
  business_name text not null,
  website text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  location_name text not null,
  street_address text,
  city text not null,
  state text not null,
  zip text,
  latitude numeric,
  longitude numeric,
  timezone text not null default 'America/Chicago',
  utility_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  first_name text,
  last_name text,
  phone_number text not null,
  role text,
  receive_alerts boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  opt_out_status text not null default 'subscribed',
  notes text,
  created_at timestamptz not null default now()
);

create table utility_rate_rules (
  id uuid primary key default uuid_generate_v4(),
  utility_name text not null,
  city text not null,
  state text not null,
  program_name text not null,
  customer_class text not null default 'unknown',
  season_start_month int not null,
  season_start_day int not null,
  season_end_month int not null,
  season_end_day int not null,
  active_days_of_week int[] not null,
  start_time_local time not null,
  end_time_local time not null,
  min_temperature_f numeric not null,
  severity text not null,
  price_label text,
  estimated_price_per_kwh numeric,
  baseline_price_per_kwh numeric,
  peak_price_per_kwh numeric,
  demand_charge_note text,
  source_url text,
  source_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table alert_templates (
  id uuid primary key default uuid_generate_v4(),
  template_name text not null,
  severity text not null,
  message_body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table weather_observations (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid not null references locations(id) on delete cascade,
  provider text not null,
  temperature_f numeric not null,
  observed_at timestamptz not null,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table alert_logs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id),
  location_id uuid not null references locations(id),
  contact_id uuid references contacts(id),
  rule_id uuid references utility_rate_rules(id),
  temperature_f numeric,
  triggered_at timestamptz not null default now(),
  sent_at timestamptz,
  message_body text,
  provider text,
  provider_message_id text,
  status text not null,
  skip_reason text,
  error_message text,
  idempotency_key text unique
);

create table provider_settings (
  id uuid primary key default uuid_generate_v4(),
  provider_name text not null,
  setting_key text not null,
  setting_value text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(provider_name, setting_key)
);
