'use client';

import { useState, useEffect } from 'react';

interface Call {
  id: string;
  targetNumber: string;
  amdStrategy: string;
  status: string;
  amdResult: string | null;
  amdConfidence: number | null;
  duration: number | null;
  createdAt: string;
  _count: { amdEvents: number };
}

export default function CallHistory() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    strategy: '',
    status: '',
    amdResult: '',
  });

  useEffect(() => {
    fetchCalls();
  }, [page, filters]);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (filters.strategy) params.append('strategy', filters.strategy);
      if (filters.status) params.append('status', filters.status);
      if (filters.amdResult) params.append('amdResult', filters.amdResult);

      const response = await fetch(`/api/calls?${params}`);
      const data = await response.json();

      if (data.calls) {
        setCalls(data.calls);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Target Number', 'Strategy', 'Status', 'AMD Result', 'Confidence', 'Duration', 'Created At'];
    const rows = calls.map((call) => [
      call.id,
      call.targetNumber,
      call.amdStrategy,
      call.status,
      call.amdResult || 'N/A',
      call.amdConfidence ? (call.amdConfidence * 100).toFixed(1) + '%' : 'N/A',
      call.duration ? `${call.duration}s` : 'N/A',
      new Date(call.createdAt).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calls_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'FAILED':
      case 'BUSY':
      case 'NO_ANSWER':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'IN_PROGRESS':
      case 'ANSWERED':
        return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300';
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getAmdResultColor = (result: string | null) => {
    switch (result) {
      case 'HUMAN':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'MACHINE':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
      case 'TIMEOUT':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white dark:bg-slate-800/90 backdrop-blur-sm shadow-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 md:p-8 transition-colors duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-700 to-cyan-600 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">
            Call History
          </h2>
          <button
            onClick={exportToCSV}
            disabled={calls.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-slate-700 to-cyan-500 dark:from-slate-600 dark:to-teal-500 text-white rounded-lg hover:from-slate-800 hover:to-cyan-600 dark:hover:from-slate-700 dark:hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all duration-200 shadow-lg shadow-cyan-500/25 dark:shadow-teal-500/25"
          >
            Export to CSV
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Strategy</label>
            <select
              value={filters.strategy}
              onChange={(e) => setFilters({ ...filters, strategy: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white transition-colors duration-200"
            >
              <option value="">All</option>
              <option value="twilio_native">Twilio Native</option>
              <option value="jambonz">Jambonz</option>
              <option value="huggingface">Hugging Face</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white transition-colors duration-200"
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="RINGING">Ringing</option>
              <option value="ANSWERED">Answered</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">AMD Result</label>
            <select
              value={filters.amdResult}
              onChange={(e) => setFilters({ ...filters, amdResult: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white transition-colors duration-200"
            >
              <option value="">All</option>
              <option value="HUMAN">Human</option>
              <option value="MACHINE">Machine</option>
              <option value="UNDECIDED">Undecided</option>
              <option value="TIMEOUT">Timeout</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">No calls found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Target Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Strategy
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      AMD Result
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                  {calls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors duration-150">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {call.targetNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {call.amdStrategy}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)}`}>
                          {call.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {call.amdResult ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAmdResultColor(call.amdResult)}`}>
                            {call.amdResult}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {call.amdConfidence ? `${(call.amdConfidence * 100).toFixed(1)}%` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(call.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700/50 transition-colors duration-200"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700/50 transition-colors duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

