import React, { useState, useEffect } from 'react';
import { School } from '../../../types';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Loader2, Search, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface PromotionLog {
  id: string;
  learner_id: string;
  learner_name: string;
  previous_class: string;
  new_class: string;
  previous_year: string;
  new_year: string;
  promoted_at: string;
  promoted_by: string;
  notes: string;
}

export default function PromotionHistory({ school }: { school: School }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<PromotionLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Dropdown options
  const [years, setYears] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    loadHistory();
  }, [school.id]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'schools', school.id, 'promotion_history'),
        // Firestore requires index if ordering, assuming standard natural order by date string is okay if fetching all
        // To be safe we will sort in client side if not indexed, or use orderBy if indexed.
        // let's try without orderBy first or order on client.
      );
      const snap = await getDocs(q);
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as PromotionLog));
      
      // sort client-side by date desc
      loaded.sort((a, b) => new Date(b.promoted_at).getTime() - new Date(a.promoted_at).getTime());
      setLogs(loaded);

      // Extract unique years and classes
      const uniqueYears = Array.from(new Set(loaded.flatMap(l => [l.previous_year, l.new_year]))).filter(Boolean).sort();
      const uniqueClasses = Array.from(new Set(loaded.flatMap(l => [l.previous_class, l.new_class]))).filter(Boolean).sort();
      
      setYears(uniqueYears);
      setClasses(uniqueClasses);

    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Failed to load promotion history');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.learner_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = yearFilter ? (log.previous_year === yearFilter || log.new_year === yearFilter) : true;
    const matchesClass = classFilter ? (log.previous_class === classFilter || log.new_class === classFilter) : true;
    return matchesSearch && matchesYear && matchesClass;
  });

  const handleExport = () => {
    const headers = ['Learner Name', 'Previous Class', 'Promoted To', 'Previous Year', 'New Year', 'Date', 'Promoted By'];
    const csvData = filteredLogs.map(log => [
      `"${log.learner_name}"`,
      `"${log.previous_class}"`,
      `"${log.new_class}"`,
      `"${log.previous_year}"`,
      `"${log.new_year}"`,
      `"${new Date(log.promoted_at).toLocaleString()}"`,
      `"${log.promoted_by}"`
    ].join(','));

    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `promotion_history_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-maroon" /></div>;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by learner name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-maroon outline-none"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-maroon"
          >
            <option value="">All Academic Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-maroon"
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button
            onClick={handleExport}
            className="px-6 py-3 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="h-5 w-5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-bold text-gray-700">Learner Name</th>
              <th className="px-6 py-4 font-bold text-gray-700">Previous Class</th>
              <th className="px-6 py-4 font-bold text-gray-700">Promoted To</th>
              <th className="px-6 py-4 font-bold text-gray-700">Previous Year</th>
              <th className="px-6 py-4 font-bold text-gray-700">New Year</th>
              <th className="px-6 py-4 font-bold text-gray-700">Date/Time</th>
              <th className="px-6 py-4 font-bold text-gray-700">Promoted By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredLogs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-4 font-bold text-gray-900">{log.learner_name}</td>
                <td className="px-6 py-4 text-gray-600">{log.previous_class}</td>
                <td className="px-6 py-4 font-bold text-maroon">{log.new_class}</td>
                <td className="px-6 py-4 text-gray-600">{log.previous_year}</td>
                <td className="px-6 py-4 font-bold text-maroon">{log.new_year}</td>
                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{new Date(log.promoted_at).toLocaleString()}</td>
                <td className="px-6 py-4 text-gray-500 truncate max-w-[150px]" title={log.promoted_by}>{log.promoted_by}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="h-8 w-8 text-gray-300" />
                    <p>No promotion records found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
