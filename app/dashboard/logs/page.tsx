'use client'

import { useState, useEffect } from 'react'
import type { Business, Location, AlertCheckResult } from '@/types'

interface LogRow {
  id: string
  triggered_at: string
  temperature_f: number | null
  status: string
  message_body: string | null
  skip_reason: string | null
  businesses: { business_name: string } | null
  locations: { location_name: string } | null
  contacts: { phone_number: string } | null
  utility_rate_rules: { program_name: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  sent:        'bg-green-100 text-green-700',
  test_logged: 'bg-yellow-100 text-yellow-700',
  failed:      'bg-red-100 text-red-700',
  skipped:     'bg-gray-100 text-gray-700',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBiz, setFilterBiz] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  // Run-now state
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<AlertCheckResult | null>(null)

  // Test alert modal
  const [showTestModal, setShowTestModal] = useState(false)
  const [testLocationId, setTestLocationId] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AlertCheckResult | null>(null)

  async function loadLogs() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (filterBiz) params.set('business_id', filterBiz)
    if (filterStart) params.set('start_date', filterStart)
    if (filterEnd) params.set('end_date', filterEnd)
    const res = await fetch(`/api/alerts/logs?${params}`)
    setLogs(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/businesses').then(r => r.json()).then(setBusinesses)
    fetch('/api/locations').then(r => r.json()).then(setLocations)
    loadLogs()
  }, [])

  async function runNow() {
    setRunning(true)
    setRunResult(null)
    const res = await fetch('/api/alerts/run-now', { method: 'POST' })
    const data = await res.json()
    setRunResult(data)
    setRunning(false)
    loadLogs()
  }

  async function sendTestAlert() {
    if (!testLocationId) return
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: testLocationId }),
    })
    const data = await res.json()
    setTestResult(data)
    setTesting(false)
    loadLogs()
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">Alert Logs</h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowTestModal(true); setTestResult(null) }}
            className="border px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Send Test Alert
          </button>
          <button onClick={runNow} disabled={running}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {running ? 'Running…' : 'Run Alert Check Now'}
          </button>
        </div>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm text-blue-800 flex justify-between items-center">
          <span>
            Alert check complete — processed: {runResult.processed}, sent: {runResult.sent}, skipped: {runResult.skipped}, failed: {runResult.failed}
          </span>
          <button onClick={() => setRunResult(null)} className="text-blue-500 hover:text-blue-700 ml-4">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm text-gray-600">
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="test_logged">Test logged</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <select value={filterBiz} onChange={e => setFilterBiz(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm text-gray-600">
          <option value="">All businesses</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.business_name}</option>)}
        </select>
        <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm text-gray-600" placeholder="Start date" />
        <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm text-gray-600" placeholder="End date" />
        <button onClick={loadLogs} className="bg-gray-700 text-white px-3 py-1.5 rounded-md text-sm hover:bg-gray-800">
          Apply
        </button>
        <button onClick={() => { setFilterStatus('all'); setFilterBiz(''); setFilterStart(''); setFilterEnd('') }}
          className="text-sm text-gray-700 hover:text-gray-700 px-2">
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? <p className="text-sm text-gray-700">Loading…</p> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Triggered</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Business</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rule</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Temp</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Message / Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {new Date(log.triggered_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.businesses?.business_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{log.locations?.location_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">{log.contacts?.phone_number ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{log.utility_rate_rules?.program_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{log.temperature_f != null ? `${log.temperature_f}°F` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[log.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs max-w-xs">
                    <span className="line-clamp-2">{log.message_body ?? log.skip_reason ?? '—'}</span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600 text-sm">No logs yet. Run an alert check to see results.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Test alert modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-1">Send Test Alert</h3>
            <p className="text-sm text-gray-700 mb-4">
              Runs the alert engine for one location in test mode. No real SMS will be sent.
              Logs will appear with status <span className="font-mono bg-yellow-100 text-yellow-700 px-1 rounded text-xs">test_logged</span>.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select value={testLocationId} onChange={e => setTestLocationId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">Select a location…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.location_name} ({l.city}, {l.state})</option>)}
              </select>
            </div>
            {testResult && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded px-3 py-2 text-sm text-green-800">
                Done — processed: {testResult.processed}, test_logged: {testResult.sent}, skipped: {testResult.skipped}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={sendTestAlert} disabled={testing || !testLocationId}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {testing ? 'Running…' : 'Run Test'}
              </button>
              <button onClick={() => { setShowTestModal(false); setTestResult(null) }}
                className="border px-4 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
