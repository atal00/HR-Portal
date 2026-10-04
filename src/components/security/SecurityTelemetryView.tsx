'use client';

import React, { useState, useMemo } from 'react';
import { SecurityLog } from '@/types/database';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Activity,
  Search,
  Filter,
  Eye,
  X,
  RefreshCw,
  Terminal,
} from 'lucide-react';

interface Props {
  logs: SecurityLog[];
}

export const SecurityTelemetryView: React.FC<Props> = ({ logs }) => {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);

  // Extract distinct event types
  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.event_type));
    return Array.from(set);
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();

    return logs.filter((log) => {
      if (severityFilter !== 'ALL' && log.severity !== severityFilter) {
        return false;
      }

      if (eventTypeFilter !== 'ALL' && log.event_type !== eventTypeFilter) {
        return false;
      }

      if (dateRangeFilter !== 'ALL') {
        const logTime = new Date(log.created_at).getTime();
        const diffHours = (now - logTime) / (1000 * 60 * 60);

        if (dateRangeFilter === '24H' && diffHours > 24) return false;
        if (dateRangeFilter === '7D' && diffHours > 24 * 7) return false;
        if (dateRangeFilter === '30D' && diffHours > 24 * 30) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = log.description?.toLowerCase().includes(q);
        const matchesType = log.event_type?.toLowerCase().includes(q);
        const matchesIp = log.ip_address?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesType && !matchesIp) return false;
      }

      return true;
    });
  }, [logs, severityFilter, eventTypeFilter, dateRangeFilter, searchQuery]);

  // Live security telemetry metric calculations
  const metrics = useMemo(() => {
    const total = logs.length;
    const highOrCritical = logs.filter((l) => l.severity === 'HIGH' || l.severity === 'CRITICAL').length;
    const blockedAttempts = logs.filter(
      (l) =>
        l.event_type === 'RATE_LIMIT_EXCEEDED' ||
        l.event_type === 'EXPIRED_OR_FORGED_DOWNLOAD_TOKEN' ||
        l.event_type === 'UNAUTHORIZED_ACCESS'
    ).length;
    const passRate = total > 0 ? Math.max(0, Math.round(((total - highOrCritical) / total) * 100)) : 100;
    const status = highOrCritical > 3 ? 'ALERT' : highOrCritical > 0 ? 'MONITORED' : 'OPTIMAL';
    return { total, highOrCritical, blockedAttempts, passRate, status };
  }, [logs]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusBadge = (log: SecurityLog) => {
    if (log.severity === 'CRITICAL' || log.severity === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          Monitored
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        Verified
      </span>
    );
  };

  const resetFilters = () => {
    setSeverityFilter('ALL');
    setEventTypeFilter('ALL');
    setDateRangeFilter('ALL');
    setSearchQuery('');
  };

  const hasActiveFilters =
    severityFilter !== 'ALL' ||
    eventTypeFilter !== 'ALL' ||
    dateRangeFilter !== 'ALL' ||
    searchQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Varsaka HR Portal
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Security Center
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time threat monitoring, identity telemetry, and tamper-evident event auditing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Telemetry Engine Live
          </span>
        </div>
      </div>

      {/* Security Overview - 4 KPI Cards */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Security Overview
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Security Status */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4.5 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Security Status</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl font-black tracking-tight ${
                metrics.status === 'OPTIMAL' ? 'text-slate-900' : metrics.status === 'MONITORED' ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {metrics.status}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                metrics.passRate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {metrics.passRate}% Safe
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Calculated from {metrics.total} live security events
            </p>
          </div>

          {/* Card 2: Active Sessions */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4.5 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Sessions</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200/70 flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">Stateless</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                JWT Guard
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              HttpOnly client token (no central session table)
            </p>
          </div>

          {/* Card 3: Failed Attempts */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4.5 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Security Blocks</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">{metrics.blockedAttempts} Blocked</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                metrics.highOrCritical === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {metrics.highOrCritical} Alerts
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Rate limits &amp; unauthorized access rejections
            </p>
          </div>

          {/* Card 4: Recent Security Events */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4.5 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Security Log Stream</span>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-200/70 flex items-center justify-center">
                <Activity className="h-4 w-4 text-indigo-600" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {metrics.total} Events
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                Live Log
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Audit Trail &amp; Security Logs retain the latest 7 days.
            </p>
          </div>
        </div>
      </div>

      {/* Security Incident & Threat Telemetry Section */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Security Incident &amp; Threat Telemetry
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter and analyze granular authentication, privilege assertion, and document revocation events
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search description, event, IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 font-semibold mr-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span>Filters:</span>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1">
            <label className="text-slate-500 text-[11px]">Severity:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="flex items-center gap-1">
            <label className="text-slate-500 text-[11px]">Event Type:</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Event Types</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1">
            <label className="text-slate-500 text-[11px]">Date Range:</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Recorded Dates</option>
              <option value="24H">Last 24 Hours</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Reset Filters
            </button>
          )}

          <div className="ml-auto text-[11px] text-slate-500 font-mono">
            Showing <strong>{filteredLogs.length}</strong> of {logs.length} events
          </div>
        </div>

        {/* Security Event Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Origin</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No security telemetry events match filter</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try clearing or adjusting your search filters</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition group">
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    {/* Event Type */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {log.event_type}
                      </span>
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadge(
                          log.severity
                        )}`}
                      >
                        {log.severity}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3.5 text-slate-800 text-xs font-medium max-w-md">
                      {log.description}
                    </td>

                    {/* Origin */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {log.ip_address || '127.0.0.1'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(log)}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
                        title="Inspect telemetry metadata payload"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnostic Metadata Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <Terminal className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Security Telemetry Diagnostic Payload
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Log ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-sans">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Event</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedLog.event_type}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Severity</span>
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadge(
                      selectedLog.severity
                    )}`}
                  >
                    {selectedLog.severity}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Origin IP</span>
                  <span className="font-mono text-slate-800">{selectedLog.ip_address || '127.0.0.1'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Timestamp</span>
                  <span className="font-mono text-[10.5px] text-slate-600">
                    {new Date(selectedLog.created_at).toLocaleTimeString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1">Incident Summary</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800">
                  {selectedLog.description}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1">
                  Cryptographic Diagnostic Metadata (JSON)
                </span>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto shadow-inner leading-relaxed">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs text-center"
              >
                Close Diagnostic View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
