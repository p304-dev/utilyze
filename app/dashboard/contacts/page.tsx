'use client'

import { useState, useEffect } from 'react'
import type { Business, Contact, Location } from '@/types'

type ContactEnriched = Contact & {
  businesses: { business_name: string } | null
  locations: { location_name: string } | null
}

const EMPTY_FORM = {
  business_id: '', location_id: '', first_name: '', last_name: '',
  phone_number: '', role: '', receive_alerts: true,
  quiet_hours_start: '', quiet_hours_end: '', notes: '',
}

export default function ContactsPage() {
  const [items, setItems] = useState<ContactEnriched[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [filterBiz, setFilterBiz] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<ContactEnriched | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function load(bizId = filterBiz) {
    const qs = bizId ? `?business_id=${bizId}` : ''
    const res = await fetch(`/api/contacts${qs}`)
    setItems(await res.json())
    setLoading(false)
  }

  async function loadLocations(bizId: string) {
    if (!bizId) { setLocations([]); return }
    const res = await fetch(`/api/locations?business_id=${bizId}`)
    setLocations(await res.json())
  }

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(setBusinesses)
    load()
  }, [])

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setLocations([])
    setShowModal(true)
  }

  function openEdit(item: ContactEnriched) {
    setEditItem(item)
    setForm({
      business_id: item.business_id, location_id: item.location_id ?? '',
      first_name: item.first_name ?? '', last_name: item.last_name ?? '',
      phone_number: item.phone_number, role: item.role ?? '',
      receive_alerts: item.receive_alerts,
      quiet_hours_start: item.quiet_hours_start ?? '', quiet_hours_end: item.quiet_hours_end ?? '',
      notes: item.notes ?? '',
    })
    loadLocations(item.business_id)
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      ...form,
      location_id: form.location_id || null,
      quiet_hours_start: form.quiet_hours_start || null,
      quiet_hours_end: form.quiet_hours_end || null,
    }
    const url = editItem ? `/api/contacts/${editItem.id}` : '/api/contacts'
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
    if (!confirm('Delete this contact?')) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    load()
  }

  function f(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Contacts</h2>
          <select value={filterBiz} onChange={e => { setFilterBiz(e.target.value); load(e.target.value) }}
            className="border rounded-md px-2 py-1.5 text-sm text-gray-600">
            <option value="">All businesses</option>
            {businesses.map(b => <option key={b.id} value={b.id}>{b.business_name}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          Add Contact
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-700">Loading…</p> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Business</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Alerts</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Opt-out</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono">{c.phone_number}</td>
                  <td className="px-4 py-3 text-gray-700">{c.role ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{c.businesses?.business_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{c.locations?.location_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.receive_alerts ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {c.receive_alerts ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.opt_out_status === 'subscribed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {c.opt_out_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600 text-sm">No contacts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4">{editItem ? 'Edit Contact' : 'Add Contact'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.business_id}
                  onChange={e => { f('business_id')(e); loadLocations(e.target.value); setForm(p => ({ ...p, business_id: e.target.value, location_id: '' })) }}>
                  <option value="">Select business…</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.business_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.location_id} onChange={f('location_id')} disabled={!form.business_id}>
                  <option value="">No specific location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.first_name} onChange={f('first_name')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.last_name} onChange={f('last_name')} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number * (E.164 format: +12105550001)</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm font-mono" value={form.phone_number} onChange={f('phone_number')} placeholder="+12105550001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.role} onChange={f('role')} placeholder="owner, manager…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours (local time — no alerts sent during this window)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Start</label>
                    <input type="time" className="w-full border rounded-md px-3 py-2 text-sm" value={form.quiet_hours_start} onChange={f('quiet_hours_start')} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">End</label>
                    <input type="time" className="w-full border rounded-md px-3 py-2 text-sm" value={form.quiet_hours_end} onChange={f('quiet_hours_end')} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} value={form.notes} onChange={f('notes')} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.receive_alerts} onChange={e => setForm(p => ({ ...p, receive_alerts: e.target.checked }))} />
                Receive alerts
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} disabled={saving || !form.business_id || !form.phone_number}
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
