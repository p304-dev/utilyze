'use client'

import { useState, useEffect } from 'react'
import type { WaterAlert, WaterCheckResult } from '@/types'
import type { WaterCustomer } from '@/types'

type WaterAlertRow = WaterAlert & {
  water_customers: { business_name: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  sent:        'bg-green-100 text-green-700',
  test_logged: 'bg-yellow-100 text-yellow-700',
  failed:      'bg-red-100 text-red-700',
  skipped:     'bg-gray-100 text-gray-700',
}

const ALERT_TYPE_LABEL: Record<string, string> = {
  after_hours:      'After Hours',
  continuous_flow:  'Continuous Flow',
}

export default function WaterAlertsPage() {
  const [alerts, setAlerts] = useState<WaterAlertRow[]>([])
  const [customers, setCustomers] = useState<WaterCustomer[]>([])
  const [loading, setLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<WaterCheckResult | null>(null)

  async function loadAlerts() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (filterCustomer) params.set('customer_id', filterCustomer)
    if (filterStart) params.set('start_date', filterStart)
    if (filterEnd) params.set('end_date', filterEnd)
    const res = await fetch(`/api/water/alerts?${params}`)
    setAlerts(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/water/customers').then(r => r.json()).then(setCustomers)
    loadAlerts()
  }, [])

  async function runNow() {
    setRunning(true)
    setRunResult(null)
    const res = await fetch('/api/water/run-now', { method: 'POST' })
    setRunResult(await res.json())
    setRunning(false)
    loadAlerts()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">Water Alerts</h2>
        <button onClick={runNow} disabled={running}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {running ? 'Running…' : 'Run Water Check Now'}
        </button>
      </div>

      {runResult && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm text-blue-800 flex justify-between items-center">
          <span>
            Water check complete — processed: {runResult.processed}, alerts sent: {runResult.alertsSent}, skipped: {runResult.skipped}, failed: {runResult.failed}
          </span>
          <button onClick={() => setRunResult(null)} className="text-blue-500 hover:text-blue-700 ml-4">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm text-gray-700">
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="test_logged">Test logged</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm text-gray-700">
          <option value="">All customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
        <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm text-gray-700" />
        <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm text-gray-700" />
        <button onClick={loadAlerts} className="bg-gray-700 text-white px-3 py-1.5 rounded-md text-sm hover:bg-gray-800">
          Apply
        </button>
        <button onClick={() => { setFilterStatus('all'); setFilterCustomer(''); setFilterStart(''); setFilterEnd('') }}
          className="text-sm text-gray-700 hover:text-gray-900 px-2">
          Clear
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-700">Loading…</p> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Created</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Business</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Detection Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Message</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id} className="border-t hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.water_customers?.business_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{ALERT_TYPE_LABEL[a.alert_type] ?? a.alert_type}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-mono">{String(a.detection_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs max-w-xs">
                    <span className="whitespace-pre-line">{a.message}</span>
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-700 text-sm">No water alerts yet. Run a water check to see results.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
