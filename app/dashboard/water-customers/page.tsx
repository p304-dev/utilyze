'use client'

import { useState, useEffect } from 'react'
import type { Business, WaterCustomer } from '@/types'

type CustomerRow = WaterCustomer & {
  latest_scrape: {
    status: string
    started_at: string
    finished_at: string | null
    error_message: string | null
  } | null
}

const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
]

const EMPTY_FORM = {
  business_id: '',
  business_name: '',
  city: '',
  state: 'TX',
  utility_provider: 'SAWS',
  utility_username: '',
  password: '',
  meter_id: '',
  move_in_date: '',
  phone_number: '',
  timezone: 'America/Chicago',
  check_time: '12:00',
  active: true,
}

const SCRAPE_STATUS: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  error:   'bg-red-100 text-red-700',
  running: 'bg-yellow-100 text-yellow-700',
}

export default function WaterCustomersPage() {
  const [items, setItems] = useState<CustomerRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<CustomerRow | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Test scrape modal
  const [testCustomer, setTestCustomer] = useState<CustomerRow | null>(null)
  const [testRunning, setTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; processed?: number; alertsSent?: number; error?: string } | null>(null)

  async function load() {
    const res = await fetch('/api/water/customers')
    setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(setBusinesses)
    load()
  }, [])

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(item: CustomerRow) {
    setEditItem(item)
    setForm({
      business_id: item.business_id ?? '',
      business_name: item.business_name,
      city: item.city,
      state: item.state,
      utility_provider: item.utility_provider,
      utility_username: item.utility_username,
      password: '',   // blank — only send if updating
      meter_id: item.meter_id ?? '',
      move_in_date: item.move_in_date ?? '',
      phone_number: item.phone_number,
      timezone: item.timezone,
      check_time: item.check_time,
      active: item.active,
    })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload: Record<string, unknown> = {
      business_id: form.business_id || null,
      business_name: form.business_name,
      city: form.city,
      state: form.state,
      utility_provider: form.utility_provider,
      utility_username: form.utility_username,
      meter_id: form.meter_id || null,
      move_in_date: form.move_in_date || null,
      phone_number: form.phone_number,
      timezone: form.timezone,
      check_time: form.check_time,
      active: form.active,
    }
    // Only include password if provided (create always requires it; edit only if changing)
    if (form.password) payload.password = form.password

    const url = editItem ? `/api/water/customers/${editItem.id}` : '/api/water/customers'
    await fetch(url, {
      method: editItem ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this water customer and all their data?')) return
    await fetch(`/api/water/customers/${id}`, { method: 'DELETE' })
    load()
  }

  async function runTestScrape() {
    if (!testCustomer) return
    setTestRunning(true)
    setTestResult(null)
    const res = await fetch(`/api/water/customers/${testCustomer.id}/test-scrape`, { method: 'POST' })
    setTestResult(await res.json())
    setTestRunning(false)
    load()
  }

  function f(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">Water Customers</h2>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          Add Customer
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-700">Loading…</p> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Business</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">City</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Utility</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Meter ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Last Scrape</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.business_name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.city}, {c.state}</td>
                  <td className="px-4 py-3 text-gray-700">{c.utility_provider}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">{c.phone_number}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-mono">{c.meter_id ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.latest_scrape ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SCRAPE_STATUS[c.latest_scrape.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {c.latest_scrape.status}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-700">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <a href={`/dashboard/water-customers/${c.id}`} className="text-blue-600 hover:underline text-xs">Detail</a>
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => { setTestCustomer(c); setTestResult(null) }} className="text-green-600 hover:underline text-xs">Test Scrape</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-700 text-sm">No water customers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4">{editItem ? 'Edit Water Customer' : 'Add Water Customer'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.business_name} onChange={f('business_name')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link to existing business (optional)</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.business_id} onChange={f('business_id')}>
                  <option value="">— none —</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.business_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.city} onChange={f('city')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.state} onChange={f('state')} maxLength={2} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Utility Provider</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.utility_provider} onChange={f('utility_provider')}>
                  <option value="SAWS">SAWS (San Antonio Water System)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portal Username *</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.utility_username} onChange={f('utility_username')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portal Password {editItem ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  className="w-full border rounded-md px-3 py-2 text-sm text-gray-900"
                  value={form.password}
                  onChange={f('password')}
                  placeholder={editItem ? '••••••' : ''}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meter ID</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.meter_id} onChange={f('meter_id')} placeholder="Auto-captured on first scrape" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Move-in Date</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.move_in_date} onChange={f('move_in_date')} placeholder="MM/DD/YYYY" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Phone Number * (E.164: +12105550001)</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm text-gray-900 font-mono" value={form.phone_number} onChange={f('phone_number')} placeholder="+12105550001" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone *</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.timezone} onChange={f('timezone')}>
                    {US_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Check Time</label>
                  <input type="time" className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={form.check_time} onChange={f('check_time')} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                Active
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSave}
                disabled={saving || !form.business_name || !form.city || !form.utility_username || (!editItem && !form.password) || !form.phone_number}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowModal(false)} className="border px-4 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Scrape modal */}
      {testCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-1">Test Scrape</h3>
            <p className="text-sm text-gray-700 mb-4">
              Logs into <strong>{testCustomer.business_name}</strong>'s SAWS account, pulls usage data, and
              runs leak detection in test mode. No real SMS will be sent.
            </p>
            {testResult && (
              testResult.success
                ? <div className="mb-4 bg-green-50 border border-green-200 rounded px-3 py-2 text-sm text-green-800">
                    Scrape complete — processed: {testResult.processed}, test alerts logged: {testResult.alertsSent}
                  </div>
                : <div className="mb-4 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-800">
                    Error: {testResult.error}
                  </div>
            )}
            <div className="flex gap-2">
              <button onClick={runTestScrape} disabled={testRunning}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {testRunning ? 'Running…' : 'Run Test Scrape'}
              </button>
              <button onClick={() => { setTestCustomer(null); setTestResult(null) }}
                className="border px-4 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
