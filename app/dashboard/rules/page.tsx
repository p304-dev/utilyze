'use client'

import { useState, useEffect } from 'react'
import type { UtilityRateRule } from '@/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const EMPTY_FORM = {
  utility_name: '', city: '', state: '', program_name: '', customer_class: 'small commercial',
  season_start_month: 6, season_start_day: 1, season_end_month: 9, season_end_day: 30,
  active_days_of_week: [1, 2, 3, 4, 5] as number[],
  start_time_local: '15:00', end_time_local: '19:00',
  min_temperature_f: 95, severity: 'high', price_label: '',
  demand_charge_note: '', source_url: '', source_notes: '', active: true,
}

const SEVERITY_COLORS: Record<string, string> = {
  watch: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export default function RulesPage() {
  const [items, setItems] = useState<UtilityRateRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<UtilityRateRule | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/rules')
    setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(item: UtilityRateRule) {
    setEditItem(item)
    setForm({
      utility_name: item.utility_name, city: item.city, state: item.state,
      program_name: item.program_name, customer_class: item.customer_class,
      season_start_month: item.season_start_month, season_start_day: item.season_start_day,
      season_end_month: item.season_end_month, season_end_day: item.season_end_day,
      active_days_of_week: item.active_days_of_week,
      start_time_local: item.start_time_local.slice(0, 5),
      end_time_local: item.end_time_local.slice(0, 5),
      min_temperature_f: item.min_temperature_f, severity: item.severity,
      price_label: item.price_label ?? '', demand_charge_note: item.demand_charge_note ?? '',
      source_url: item.source_url ?? '', source_notes: item.source_notes ?? '',
      active: item.active,
    })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const url = editItem ? `/api/rules/${editItem.id}` : '/api/rules'
    await fetch(url, {
      method: editItem ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this rule?')) return
    await fetch(`/api/rules/${id}`, { method: 'DELETE' })
    load()
  }

  function toggleDay(day: number) {
    setForm(p => ({
      ...p,
      active_days_of_week: p.active_days_of_week.includes(day)
        ? p.active_days_of_week.filter(d => d !== day)
        : [...p.active_days_of_week, day].sort(),
    }))
  }

  function f(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">Utility Rate Rules</h2>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          Add Rule
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-700">Loading…</p> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Program</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Utility / City</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Season</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Window</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Min °F</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Severity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map(rule => (
                <tr key={rule.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{rule.program_name}</td>
                  <td className="px-4 py-3 text-gray-700">{rule.utility_name}<br /><span className="text-xs">{rule.city}, {rule.state}</span></td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {MONTHS[rule.season_start_month - 1]} {rule.season_start_day} –<br />
                    {MONTHS[rule.season_end_month - 1]} {rule.season_end_day}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-mono">
                    {rule.start_time_local.slice(0,5)} – {rule.end_time_local.slice(0,5)}<br />
                    <span className="text-gray-600">{rule.active_days_of_week.map(d => DAYS[d]).join(', ')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono">{rule.min_temperature_f}°</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[rule.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(rule)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600 text-sm">No rules yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4">{editItem ? 'Edit Rule' : 'Add Rule'}</h3>
            <div className="space-y-4">

              {/* Identity */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Utility Name *</label>
                  <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.utility_name} onChange={f('utility_name')} placeholder="CPS Energy" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">City *</label>
                  <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.city} onChange={f('city')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">State *</label>
                  <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.state} onChange={f('state')} maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Program Name *</label>
                  <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.program_name} onChange={f('program_name')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Customer Class</label>
                  <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.customer_class} onChange={f('customer_class')} />
                </div>
              </div>

              {/* Season */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Season Window</label>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div>
                    <label className="text-xs text-gray-700">Start month</label>
                    <input type="number" min={1} max={12} className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.season_start_month} onChange={f('season_start_month')} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700">Start day</label>
                    <input type="number" min={1} max={31} className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.season_start_day} onChange={f('season_start_day')} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700">End month</label>
                    <input type="number" min={1} max={12} className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.season_end_month} onChange={f('season_end_month')} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700">End day</label>
                    <input type="number" min={1} max={31} className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.season_end_day} onChange={f('season_end_day')} />
                  </div>
                </div>
              </div>

              {/* Days of week */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Active Days of Week</label>
                <div className="flex gap-2">
                  {DAYS.map((day, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${form.active_days_of_week.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time window + temp */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Time (local)</label>
                  <input type="time" className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.start_time_local} onChange={f('start_time_local')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Time (local)</label>
                  <input type="time" className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.end_time_local} onChange={f('end_time_local')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Min Temp (°F)</label>
                  <input type="number" className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.min_temperature_f} onChange={f('min_temperature_f')} />
                </div>
              </div>

              {/* Severity + price label */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Severity *</label>
                  <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.severity} onChange={f('severity')}>
                    <option value="watch">watch</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Price Label</label>
                  <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.price_label} onChange={f('price_label')} placeholder="peak demand / conservation window" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Demand Charge Note</label>
                <textarea className="w-full border rounded-md px-2 py-1.5 text-sm" rows={2} value={form.demand_charge_note} onChange={f('demand_charge_note')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Source URL</label>
                <input className="w-full border rounded-md px-2 py-1.5 text-sm" value={form.source_url} onChange={f('source_url')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Source Notes</label>
                <textarea className="w-full border rounded-md px-2 py-1.5 text-sm" rows={2} value={form.source_notes} onChange={f('source_notes')} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                Active
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={handleSave}
                disabled={saving || !form.utility_name || !form.city || !form.program_name}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowModal(false)} className="border px-4 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
