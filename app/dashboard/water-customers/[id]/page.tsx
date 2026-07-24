'use client'

import { useState, useEffect } from 'react'
import type { WaterBusinessHours, WaterAlertSettings, WaterUsageRecord, WaterCustomer } from '@/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function defaultHours(customerId: string): WaterBusinessHours[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: '',
    water_customer_id: customerId,
    day_of_week: i,
    is_open: i >= 1 && i <= 5,
    open_time: i >= 1 && i <= 5 ? '08:00:00' : null,
    close_time: i >= 1 && i <= 5 ? '17:00:00' : null,
  }))
}

export default function WaterCustomerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params

  const [customer, setCustomer] = useState<WaterCustomer | null>(null)
  const [hours, setHours] = useState<WaterBusinessHours[]>([])
  const [settings, setSettings] = useState<WaterAlertSettings | null>(null)
  const [usage, setUsage] = useState<WaterUsageRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [savingHours, setSavingHours] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/water/customers/${id}`).then(r => r.json()),
      fetch(`/api/water/customers/${id}/hours`).then(r => r.json()),
      fetch(`/api/water/customers/${id}/settings`).then(r => r.json()),
      fetch(`/api/water/customers/${id}/usage?days=3`).then(r => r.json()),
    ]).then(([cust, hrs, sets, use]) => {
      setCustomer(cust)
      setHours(hrs.length >= 7 ? hrs : defaultHours(id))
      setSettings(sets)
      setUsage(use)
      setLoading(false)
    })
  }, [id])

  function updateHour(dow: number, field: keyof WaterBusinessHours, value: unknown) {
    setHours(prev => prev.map(h => h.day_of_week === dow ? { ...h, [field]: value } : h))
  }

  async function saveHours() {
    setSavingHours(true)
    await fetch(`/api/water/customers/${id}/hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hours.map(h => ({
        day_of_week: h.day_of_week,
        is_open: h.is_open,
        open_time: h.open_time || null,
        close_time: h.close_time || null,
      }))),
    })
    setSavingHours(false)
    setHoursSaved(true)
    setTimeout(() => setHoursSaved(false), 2000)
  }

  async function saveSettings() {
    if (!settings) return
    setSavingSettings(true)
    await fetch(`/api/water/customers/${id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  // Group usage by date for display
  const usageByDate = usage.reduce<Record<string, WaterUsageRecord[]>>((acc, row) => {
    if (!acc[row.usage_date]) acc[row.usage_date] = []
    acc[row.usage_date].push(row)
    return acc
  }, {})

  if (loading) return <p className="text-sm text-gray-700">Loading…</p>
  if (!customer) return <p className="text-sm text-red-600">Customer not found.</p>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/dashboard/water-customers" className="text-sm text-blue-600 hover:underline">← Water Customers</a>
        <span className="text-gray-300">/</span>
        <h2 className="text-xl font-semibold text-gray-900">{customer.business_name}</h2>
      </div>

      {/* ── Business Hours ── */}
      <section className="bg-white rounded-lg border p-5 mb-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Business Hours</h3>
        <p className="text-xs text-gray-700 mb-4">After-hours gallons outside this window trigger leak alerts.</p>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr>
              <th className="text-left py-2 font-medium text-gray-700 w-32">Day</th>
              <th className="text-left py-2 font-medium text-gray-700 w-20">Open?</th>
              <th className="text-left py-2 font-medium text-gray-700">Open Time</th>
              <th className="text-left py-2 font-medium text-gray-700">Close Time</th>
            </tr>
          </thead>
          <tbody>
            {hours.map(h => (
              <tr key={h.day_of_week} className="border-t">
                <td className="py-2 text-gray-700">{DAYS[h.day_of_week]}</td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={h.is_open}
                    onChange={e => updateHour(h.day_of_week, 'is_open', e.target.checked)}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="time"
                    disabled={!h.is_open}
                    value={h.open_time?.slice(0, 5) ?? ''}
                    onChange={e => updateHour(h.day_of_week, 'open_time', e.target.value ? e.target.value + ':00' : null)}
                    className="border rounded px-2 py-1 text-sm text-gray-900 disabled:opacity-40"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="time"
                    disabled={!h.is_open}
                    value={h.close_time?.slice(0, 5) ?? ''}
                    onChange={e => updateHour(h.day_of_week, 'close_time', e.target.value ? e.target.value + ':00' : null)}
                    className="border rounded px-2 py-1 text-sm text-gray-900 disabled:opacity-40"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={saveHours} disabled={savingHours}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {savingHours ? 'Saving…' : hoursSaved ? 'Saved ✓' : 'Save Hours'}
        </button>
      </section>

      {/* ── Alert Settings ── */}
      {settings && (
        <section className="bg-white rounded-lg border p-5 mb-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Alert Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-medium text-gray-800">After-hours usage alert</p>
                <p className="text-xs text-gray-700">Alert if gallons outside business hours exceeds threshold</p>
              </div>
              <input type="checkbox" checked={settings.after_hours_enabled}
                onChange={e => setSettings(s => s ? { ...s, after_hours_enabled: e.target.checked } : s)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700 w-48">Min after-hours gallons</label>
              <input type="number" min={0} step={1}
                className="border rounded-md px-3 py-1.5 text-sm text-gray-900 w-28"
                value={settings.min_after_hours_gallons}
                onChange={e => setSettings(s => s ? { ...s, min_after_hours_gallons: Number(e.target.value) } : s)}
                disabled={!settings.after_hours_enabled}
              />
            </div>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Continuous 24h flow alert</p>
                <p className="text-xs text-gray-700">Alert if every hour in the last 24h shows water usage (no idle hours)</p>
              </div>
              <input type="checkbox" checked={settings.continuous_flow_enabled}
                onChange={e => setSettings(s => s ? { ...s, continuous_flow_enabled: e.target.checked } : s)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700 w-48">Min hourly gallons (flow threshold)</label>
              <input type="number" min={0} step={0.01}
                className="border rounded-md px-3 py-1.5 text-sm text-gray-900 w-28"
                value={settings.continuous_flow_min_hourly_gallons}
                onChange={e => setSettings(s => s ? { ...s, continuous_flow_min_hourly_gallons: Number(e.target.value) } : s)}
                disabled={!settings.continuous_flow_enabled}
              />
            </div>
          </div>
          <button onClick={saveSettings} disabled={savingSettings}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {savingSettings ? 'Saving…' : settingsSaved ? 'Saved ✓' : 'Save Settings'}
          </button>
        </section>
      )}

      {/* ── Recent Usage ── */}
      <section className="bg-white rounded-lg border p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Usage</h3>
        {usage.length === 0 ? (
          <p className="text-sm text-gray-700">No usage data yet. Run a test scrape to populate.</p>
        ) : (
          Object.entries(usageByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, rows]) => {
              const total = rows.reduce((sum, r) => sum + Number(r.gallons), 0)
              return (
                <div key={date} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">{date}</span>
                    <span className="text-xs text-gray-700">Total: {total.toFixed(1)} gal</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700">Hour</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700">Gallons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.hour} className="border-t">
                          <td className="px-3 py-1 text-gray-700 font-mono">
                            {String(r.hour).padStart(2, '0')}:00
                          </td>
                          <td className="px-3 py-1 text-gray-700">{Number(r.gallons).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })
        )}
      </section>
    </div>
  )
}
