'use client'

import { useState, useEffect } from 'react'
import type { Business, Location } from '@/types'

type LocationWithBusiness = Location & { businesses: { business_name: string } | null }

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
  business_id: '', location_name: '', street_address: '', city: '', state: '',
  zip: '', latitude: '', longitude: '', timezone: 'America/Chicago',
  utility_name: '', active: true,
}

export default function LocationsPage() {
  const [items, setItems] = useState<LocationWithBusiness[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [filterBiz, setFilterBiz] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<LocationWithBusiness | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  async function load(bizId = filterBiz) {
    const qs = bizId ? `?business_id=${bizId}` : ''
    const res = await fetch(`/api/locations${qs}`)
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

  function openEdit(item: LocationWithBusiness) {
    setEditItem(item)
    setForm({
      business_id: item.business_id, location_name: item.location_name,
      street_address: item.street_address ?? '', city: item.city, state: item.state,
      zip: item.zip ?? '', latitude: item.latitude?.toString() ?? '',
      longitude: item.longitude?.toString() ?? '', timezone: item.timezone,
      utility_name: item.utility_name, active: item.active,
    })
    setShowModal(true)
  }

  async function geocode() {
    if (!form.city) return
    setGeocoding(true)
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(form.city)}&country=US&count=1`)
      const data = await res.json()
      const result = data.results?.[0]
      if (result) {
        setForm(p => ({ ...p, latitude: result.latitude.toString(), longitude: result.longitude.toString() }))
      }
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    // Auto-geocode if lat/lon are blank
    let lat = parseFloat(form.latitude)
    let lon = parseFloat(form.longitude)
    if ((!form.latitude || !form.longitude) && form.city) {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(form.city)}&country=US&count=1`)
      const data = await res.json()
      const result = data.results?.[0]
      if (result) { lat = result.latitude; lon = result.longitude }
    }

    const payload = {
      ...form,
      latitude: isNaN(lat) ? null : lat,
      longitude: isNaN(lon) ? null : lon,
    }

    const url = editItem ? `/api/locations/${editItem.id}` : '/api/locations'
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
    if (!confirm('Delete this location and all its contacts?')) return
    await fetch(`/api/locations/${id}`, { method: 'DELETE' })
    load()
  }

  function f(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Locations</h2>
          <select value={filterBiz} onChange={e => { setFilterBiz(e.target.value); load(e.target.value) }}
            className="border rounded-md px-2 py-1.5 text-sm text-gray-600">
            <option value="">All businesses</option>
            {businesses.map(b => <option key={b.id} value={b.id}>{b.business_name}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          Add Location
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Business</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">City, State</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Utility</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map(loc => (
                <tr key={loc.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{loc.location_name}</td>
                  <td className="px-4 py-3 text-gray-500">{loc.businesses?.business_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{loc.city}, {loc.state}</td>
                  <td className="px-4 py-3 text-gray-500">{loc.utility_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${loc.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {loc.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(loc)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(loc.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No locations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4">{editItem ? 'Edit Location' : 'Add Location'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.business_id} onChange={f('business_id')}>
                  <option value="">Select business…</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.business_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name *</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.location_name} onChange={f('location_name')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.street_address} onChange={f('street_address')} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.city} onChange={f('city')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.state} onChange={f('state')} maxLength={2} placeholder="TX" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.zip} onChange={f('zip')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Utility Name *</label>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.utility_name} onChange={f('utility_name')} placeholder="CPS Energy" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.timezone} onChange={f('timezone')}>
                  {US_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Coordinates (auto-filled if blank)</label>
                  <button type="button" onClick={geocode} disabled={geocoding || !form.city}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-40">
                    {geocoding ? 'Geocoding…' : 'Geocode from city'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Latitude" value={form.latitude} onChange={f('latitude')} />
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Longitude" value={form.longitude} onChange={f('longitude')} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                Active
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} disabled={saving || !form.business_id || !form.location_name || !form.city}
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
