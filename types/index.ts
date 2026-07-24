// ─── Database entity types ────────────────────────────────────────────────────
// Each type maps 1:1 to a Postgres table. Nullable columns are typed as T | null.
// Timestamps come back from Supabase as ISO-8601 strings.

export interface Business {
  id: string
  business_name: string
  website: string | null
  notes: string | null
  active: boolean
  created_at: string
}

export interface Location {
  id: string
  business_id: string
  location_name: string
  street_address: string | null
  city: string
  state: string
  zip: string | null
  latitude: number | null
  longitude: number | null
  timezone: string
  utility_name: string
  active: boolean
  created_at: string
}

export interface Contact {
  id: string
  business_id: string
  location_id: string | null
  first_name: string | null
  last_name: string | null
  phone_number: string
  role: string | null
  receive_alerts: boolean
  // Postgres `time` columns come back as "HH:MM:SS" strings
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  opt_out_status: string
  notes: string | null
  created_at: string
}

export interface UtilityRateRule {
  id: string
  utility_name: string
  city: string
  state: string
  program_name: string
  customer_class: string
  season_start_month: number
  season_start_day: number
  season_end_month: number
  season_end_day: number
  // Array of ints: 0 = Sunday … 6 = Saturday (matches JS Date.getDay())
  active_days_of_week: number[]
  start_time_local: string  // "HH:MM:SS"
  end_time_local: string    // "HH:MM:SS"
  min_temperature_f: number
  severity: string          // 'watch' | 'high' | 'critical'
  price_label: string | null
  estimated_price_per_kwh: number | null
  baseline_price_per_kwh: number | null
  peak_price_per_kwh: number | null
  demand_charge_note: string | null
  source_url: string | null
  source_notes: string | null
  active: boolean
  created_at: string
}

export interface AlertTemplate {
  id: string
  template_name: string
  severity: string    // 'watch' | 'high' | 'critical'
  message_body: string
  active: boolean
  created_at: string
}

export interface WeatherObservation {
  id: string
  location_id: string
  provider: string
  temperature_f: number
  observed_at: string
  raw_payload: Record<string, unknown> | null
  created_at: string
}

export interface AlertLog {
  id: string
  business_id: string
  location_id: string
  contact_id: string | null
  rule_id: string | null
  temperature_f: number | null
  triggered_at: string
  sent_at: string | null
  message_body: string | null
  provider: string | null
  provider_message_id: string | null
  status: string  // 'sent' | 'failed' | 'skipped' | 'test_logged'
  skip_reason: string | null
  error_message: string | null
  idempotency_key: string | null
}

export interface ProviderSetting {
  id: string
  provider_name: string
  setting_key: string
  setting_value: string | null
  active: boolean
  created_at: string
}

// ─── Joined / enriched types used in API responses ───────────────────────────

export interface AlertLogEnriched extends AlertLog {
  business_name?: string
  location_name?: string
  contact_phone?: string
  rule_program_name?: string
}

// ─── Utility types for lib functions ─────────────────────────────────────────

export interface AlertCheckResult {
  processed: number
  sent: number
  skipped: number
  failed: number
}

export interface SmsSendResult {
  success: boolean
  messageId?: string
  error?: string
}

// ─── Water Leak Alert module types ───────────────────────────────────────────

export interface WaterCustomer {
  id: string
  business_id: string | null
  business_name: string
  city: string
  state: string
  utility_provider: string
  utility_username: string
  // utility_password_encrypted is never returned to the client
  meter_id: string | null
  move_in_date: string | null
  phone_number: string
  timezone: string
  check_time: string   // "HH:MM"
  active: boolean
  created_at: string
}

export interface WaterBusinessHours {
  id: string
  water_customer_id: string
  day_of_week: number  // 0=Sunday … 6=Saturday
  is_open: boolean
  open_time: string | null   // "HH:MM:SS"
  close_time: string | null  // "HH:MM:SS"
}

export interface WaterAlertSettings {
  id: string
  water_customer_id: string
  after_hours_enabled: boolean
  min_after_hours_gallons: number
  continuous_flow_enabled: boolean
  continuous_flow_min_hourly_gallons: number
}

export interface WaterUsageRecord {
  id: string
  water_customer_id: string
  usage_date: string  // "YYYY-MM-DD"
  hour: number        // 0..23
  gallons: number
  retrieved_at: string
}

export interface WaterAlert {
  id: string
  water_customer_id: string
  alert_type: string   // 'after_hours' | 'continuous_flow'
  message: string
  detection_date: string  // "YYYY-MM-DD"
  status: string          // 'sent' | 'failed' | 'skipped' | 'test_logged'
  provider: string | null
  provider_message_id: string | null
  error_message: string | null
  skip_reason: string | null
  idempotency_key: string | null
  created_at: string
}

export interface WaterScrapeRun {
  id: string
  water_customer_id: string
  started_at: string
  finished_at: string | null
  status: string  // 'running' | 'success' | 'error'
  rows_retrieved: number | null
  error_message: string | null
}

export interface WaterCheckResult {
  processed: number
  alertsSent: number
  skipped: number
  failed: number
}
