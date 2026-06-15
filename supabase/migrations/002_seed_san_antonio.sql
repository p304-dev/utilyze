-- Seed: default alert templates
insert into alert_templates (template_name, severity, message_body) values
('Watch Alert', 'watch', 'Energy heads-up: It''s {{temperature_f}}°F in {{city}} and a peak window is active until {{end_time}}. A good time to reduce nonessential energy use.'),
('High Alert', 'high', 'Energy savings alert: It''s {{temperature_f}}°F in {{city}} and peak demand hours are active until {{end_time}}. Consider raising your thermostat a few degrees.'),
('Critical Alert', 'critical', 'URGENT energy alert: It''s {{temperature_f}}°F in {{city}}. Peak demand is critical until {{end_time}}. Reducing AC load now could result in significant savings. Reply STOP to opt out.');

-- Seed: San Antonio CPS Energy peak window rule
insert into utility_rate_rules (
  utility_name, city, state, program_name, customer_class,
  season_start_month, season_start_day, season_end_month, season_end_day,
  active_days_of_week, start_time_local, end_time_local,
  min_temperature_f, severity, price_label, demand_charge_note, source_notes, active
) values (
  'CPS Energy', 'San Antonio', 'TX',
  'Manual CPS Heat Conservation Window', 'small commercial',
  6, 1, 9, 30,
  array[1,2,3,4,5],
  '15:00', '19:00',
  95, 'high', 'peak demand / conservation window',
  'CPS Energy summer peak demand period. Weekdays June–September, typically 3–7 PM during high heat.',
  'Manually entered based on CPS Energy Power Player and demand-response program guidelines. Admin should verify before promising savings to customers.',
  true
);

-- Seed: sample San Antonio business
insert into businesses (business_name, website, notes, active)
values ('Demo Business SA', 'https://demobusiness.com', 'Sample San Antonio client for testing', true);

-- Seed: sample location (uses the business above — grab the ID dynamically)
insert into locations (business_id, location_name, city, state, timezone, utility_name, latitude, longitude, active)
select id, 'Main Location', 'San Antonio', 'TX', 'America/Chicago', 'CPS Energy', 29.4241, -98.4936, true
from businesses where business_name = 'Demo Business SA' limit 1;

-- Seed: two sample contacts
insert into contacts (business_id, location_id, first_name, last_name, phone_number, role, receive_alerts)
select b.id, l.id, 'Test', 'Owner', '+12105550001', 'owner', true
from businesses b join locations l on l.business_id = b.id
where b.business_name = 'Demo Business SA' limit 1;

insert into contacts (business_id, location_id, first_name, last_name, phone_number, role, receive_alerts)
select b.id, l.id, 'Test', 'Manager', '+12105550002', 'manager', true
from businesses b join locations l on l.business_id = b.id
where b.business_name = 'Demo Business SA' limit 1;
