import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  DollarSign,
  Calendar,
  Layers,
  Copy,
  Save,
  Building2,
  CheckCircle2,
  UserCheck,
  UserX,
  Trash2,
  RotateCcw,
  Filter,
  AlertCircle,
  Inbox,
  Download,
  Printer,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  Search,
  Plus,
  Minus,
  StickyNote,
} from 'lucide-react';
import Button from '../../components/common/Button';
import DatePickerInput from '../../components/ui/DatePickerInput';
import Card from '../../components/ui/Card';
import Drawer from '../../components/drawers/Drawer';
import FilterToolbar from '../../components/common/FilterToolbar';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useSiteScope } from '../../hooks/useSiteScope';
import { useLookups } from '../../hooks/useLookups';
import {
  useDailyAttendance,
  useSaveDailyAttendance,
  usePreviousDayWorkers,
  useAttendanceHistory,
} from '../../hooks/useAttendance';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/format';
import '../../styles/operational-page.css';
import '../../styles/glass.css';
import '../sites/Sites.css';
import './Attendance.css';

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Attendance() {
  const toast = useToast();
  // Active Navigation Tab: 'daily' | 'history'
  const [activeTab, setActiveTab] = useState('daily');

  // Live / selected attendance date for Tab 1 (Daily View)
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);

  // Main Page Table Filters for Tab 1 (Daily View)
  const [siteFilter, setSiteFilter] = useState(''); // '' means All Sites for Super Admin
  const [search, setSearch] = useState('');
  const [professionFilter, setProfessionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // 'present', 'absent', ''

  // Site scope resolution
  const { isSuperAdmin, siteId } = useSiteScope(siteFilter || undefined);
  const activeSiteId = isSuperAdmin ? (siteFilter || undefined) : siteId;

  const { activeSites, professions } = useLookups(activeSiteId);
  const selectedSite = activeSites.data?.find((s) => s._id === activeSiteId);

  // Main Page Daily Attendance Query
  const mainAttendanceQuery = useDailyAttendance({ siteId: activeSiteId, date: selectedDate });
  const saveDailyMutation = useSaveDailyAttendance();

  // Drawer / Popup Modal State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [drawerSiteId, setDrawerSiteId] = useState('');
  const [selectedLeaderToAdd, setSelectedLeaderToAdd] = useState('');

  // Target date for attendance operations
  const targetDate = selectedDate || getLocalDateString();

  // Effective site ID for the Mark Attendance drawer popup
  const drawerTargetSiteId = isSuperAdmin ? (drawerSiteId || undefined) : siteId;
  const drawerAttendanceQuery = useDailyAttendance(
    { siteId: drawerTargetSiteId, date: targetDate },
    { enabled: isSuperAdmin ? !!drawerSiteId : !!siteId }
  );

  // Local state for drawer attendance rows
  const [drawerRows, setDrawerRows] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [openNotes, setOpenNotes] = useState(() => new Set());

  // Previous Day Copy Query for Drawer
  const [copyFetchEnabled, setCopyFetchEnabled] = useState(false);
  const prevDayQuery = usePreviousDayWorkers(
    { siteId: drawerTargetSiteId, date: targetDate },
    copyFetchEnabled && (isSuperAdmin ? !!drawerSiteId : !!siteId)
  );

  // Tab 2 ("All Records") State
  const [historyPeriod, setHistoryPeriod] = useState('month'); // 'today' | 'week' | 'month' | 'custom'
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historySiteFilter, setHistorySiteFilter] = useState('');
  const [historyProfessionFilter, setHistoryProfessionFilter] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historySortBy, setHistorySortBy] = useState('date');
  const [historySortOrder, setHistorySortOrder] = useState('desc');
  const [historyPage, setHistoryPage] = useState(1);
  const historyLimit = 20;

  // Query hook for Tab 2 ("All Records")
  const historyParams = useMemo(() => {
    const params = {
      siteId: isSuperAdmin ? (historySiteFilter || undefined) : siteId,
      period: historyPeriod,
      professionId: historyProfessionFilter || undefined,
      status: historyStatusFilter || undefined,
      search: historySearch || undefined,
      sortBy: historySortBy,
      sortOrder: historySortOrder,
      page: historyPage,
      limit: historyLimit,
    };
    if (historyPeriod === 'custom') {
      if (historyStartDate) params.startDate = historyStartDate;
      if (historyEndDate) params.endDate = historyEndDate;
    }
    return params;
  }, [
    isSuperAdmin,
    historySiteFilter,
    siteId,
    historyPeriod,
    historyProfessionFilter,
    historyStatusFilter,
    historySearch,
    historySortBy,
    historySortOrder,
    historyPage,
    historyLimit,
    historyStartDate,
    historyEndDate,
  ]);

  const historyQuery = useAttendanceHistory(historyParams);

  // Synchronize drawer site selection when drawer opens
  useEffect(() => {
    if (isPanelOpen) {
      if (!drawerSiteId) {
        if (isSuperAdmin) {
          const defaultSite = siteFilter || activeSites.data?.[0]?._id || '';
          if (defaultSite) setDrawerSiteId(defaultSite);
        } else {
          setDrawerSiteId(siteId || '');
        }
      }
    } else {
      setDrawerSiteId('');
    }
  }, [isPanelOpen, isSuperAdmin, siteFilter, siteId, activeSites.data, drawerSiteId]);

  // Populate drawer rows whenever drawer query loads or site changes
  useEffect(() => {
    if (drawerAttendanceQuery.data?.leaders) {
      setDrawerRows(
        drawerAttendanceQuery.data.leaders.map((l) => {
          const count = l.workerCount ?? l.defaultWorkerCount ?? 1;
          const isPresent = l.isMarked ? (l.status === 'present' || (l.status !== 'absent' && count > 0)) : true;
          return {
            worker: l.worker || l._id,
            name: l.name,
            profession: l.profession,
            site: l.site,
            photo: l.photo,
            dailyWage: l.dailyWage,
            defaultWorkerCount: l.defaultWorkerCount ?? 1,
            workerCount: count,
            isPresent,
            isMarked: l.isMarked,
            attendanceId: l.attendanceId,
            remarks: l.remarks || '',
            inList: true,
          };
        })
      );
      setIsDirty(false);
    } else if (!drawerAttendanceQuery.isLoading && !drawerAttendanceQuery.isFetching) {
      setDrawerRows([]);
    }
  }, [drawerAttendanceQuery.data, drawerAttendanceQuery.isLoading, drawerAttendanceQuery.isFetching, drawerTargetSiteId]);

  // Main table active rows derived from mainAttendanceQuery
  const mainTableRows = useMemo(() => {
    if (!mainAttendanceQuery.data?.leaders) return [];

    const queryDateStr = mainAttendanceQuery.data.date;
    if (selectedDate && queryDateStr && queryDateStr !== selectedDate) {
      return [];
    }

    return mainAttendanceQuery.data.leaders;
  }, [mainAttendanceQuery.data, selectedDate]);

  // Client-side filtering on main table rows
  const filteredTableRows = useMemo(() => {
    return mainTableRows.filter((row) => {
      if (search) {
        const term = search.toLowerCase();
        const nameMatch = row.name?.toLowerCase().includes(term);
        const profMatch = row.profession?.name?.toLowerCase().includes(term);
        const siteMatch = row.site?.name?.toLowerCase().includes(term);
        if (!nameMatch && !profMatch && !siteMatch) return false;
      }

      if (professionFilter && row.profession?._id !== professionFilter) {
        return false;
      }

        if (statusFilter) {
          if (statusFilter === 'not_marked') {
            if (row.isMarked) return false;
          } else if (statusFilter === 'present') {
            if (!row.isMarked || (row.status !== 'present' && (row.workerCount || 0) <= 0)) return false;
          } else if (statusFilter === 'absent') {
            if (!row.isMarked || (row.status !== 'absent' && (row.workerCount || 0) > 0)) return false;
          }
        }

        return true;
      });
  }, [mainTableRows, search, professionFilter, statusFilter]);

  // Calculated summary stats for Daily View
  const summaryTotals = useMemo(() => {
    if (mainAttendanceQuery.data?.summary) {
      return {
        totalLeaders: mainAttendanceQuery.data.summary.totalLeaders ?? 0,
        presentLeaders: mainAttendanceQuery.data.summary.presentLeaders ?? 0,
        totalWorkers: mainAttendanceQuery.data.summary.totalWorkers ?? 0,
        totalLabourExpense: mainAttendanceQuery.data.summary.totalLabourExpense ?? 0,
        isRecorded: (mainAttendanceQuery.data.summary.markedCount ?? 0) > 0,
      };
    }

    const isRecorded = (mainAttendanceQuery.data?.leaders || []).some((l) => l.isMarked);
    let presentLeaders = 0;
    let totalWorkers = 0;
    let totalLabourExpense = 0;

    (mainAttendanceQuery.data?.leaders || []).forEach((r) => {
      if (r.isMarked && (r.status === 'present' || r.workerCount > 0)) {
        presentLeaders += 1;
        totalWorkers += r.workerCount;
        totalLabourExpense += r.totalAmount;
      }
    });

    return {
      totalLeaders: mainAttendanceQuery.data?.leaders?.length || 0,
      presentLeaders,
      totalWorkers,
      totalLabourExpense,
      isRecorded,
    };
  }, [mainAttendanceQuery.data]);

  const markedCount = useMemo(() => mainTableRows.filter((r) => r.isMarked).length, [mainTableRows]);

  // Reset filters handlers
  const handleResetFilters = () => {
    setSearch('');
    setSiteFilter('');
    setProfessionFilter('');
    setStatusFilter('');
    setSelectedDate(getLocalDateString());
  };

  const handleResetHistoryFilters = () => {
    setHistoryPeriod('month');
    setHistoryStartDate('');
    setHistoryEndDate('');
    setHistorySiteFilter('');
    setHistoryProfessionFilter('');
    setHistoryStatusFilter('');
    setHistorySearch('');
    setHistorySortBy('date');
    setHistorySortOrder('desc');
    setHistoryPage(1);
  };

  // Sorting handler for Tab 2 Table
  const handleHistorySort = (field) => {
    if (historySortBy === field) {
      setHistorySortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setHistorySortBy(field);
      setHistorySortOrder('desc');
    }
  };

  const renderSortIcon = (field) => {
    if (historySortBy !== field) return <ArrowUpDown size={13} style={{ opacity: 0.4 }} />;
    return historySortOrder === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const records = historyQuery.data?.items || [];
    if (records.length === 0) {
      toast.error('No attendance records available to export.');
      return;
    }

    const headers = ['Date', 'Project Site', 'Worker Leader', 'Profession / Trade', 'Status', 'Labour Count', 'Daily Wage', 'Total Amount', 'Remarks'];
    const rows = records.map((r) => [
      `"${formatDate(r.date)}"`,
      `"${r.site?.name || 'N/A'}"`,
      `"${r.workerName || r.worker?.name || 'Unknown'}"`,
      `"${r.profession?.name || r.professionName || 'General Trade'}"`,
      `"${r.status || 'present'}"`,
      r.workerCount ?? 1,
      r.dailyWage ?? 0,
      r.totalAmount ?? 0,
      `"${(r.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Records_History_${getLocalDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV export generated successfully.');
  };

  // PDF Export Handler
  const handleExportPDF = () => {
    const records = historyQuery.data?.items || [];
    if (records.length === 0) {
      toast.error('No attendance records available to export.');
      return;
    }

    const printContent = `
      <html>
        <head>
          <title>Attendance Records History Report</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; color: #1e293b; }
            h1 { margin-bottom: 4px; font-size: 20px; }
            p { color: #64748b; font-size: 13px; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: 700; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>Attendance Records History Report</h1>
          <p>Exported on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Worker Leader</th>
                <th>Trade</th>
                <th>Status</th>
                <th>Labours</th>
                <th>Wage</th>
                <th class="text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${records
        .map(
          (r) => `
                <tr>
                  <td>${formatDate(r.date)}</td>
                  <td>${r.site?.name || 'N/A'}</td>
                  <td>${r.workerName || r.worker?.name || 'Unknown'}</td>
                  <td>${r.profession?.name || r.professionName || 'General'}</td>
                  <td>${r.status || 'present'}</td>
                  <td>${r.workerCount ?? 1}</td>
                  <td>₹${r.dailyWage ?? 0}</td>
                  <td class="text-right">₹${r.totalAmount ?? 0}</td>
                </tr>`
        )
        .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
      toast.success('PDF report window opened.');
    }
  };

  // Filter toolbar configuration for Tab 1 (Daily View)
  const filterConfig = useMemo(() => {
    const filters = [];

    filters.push({
      key: 'date',
      label: 'Attendance Date',
      type: 'date',
      value: selectedDate,
      onChange: (val) => setSelectedDate(val || getLocalDateString()),
    });

    if (isSuperAdmin) {
      filters.push({
        key: 'site',
        label: 'Project Site',
        type: 'select',
        value: siteFilter,
        onChange: (val) => setSiteFilter(val),
        options: [
          { value: '', label: 'All Sites Combined' },
          ...(activeSites.data?.map((s) => ({
            value: s._id,
            label: `${s.name} (${s.code})`,
          })) || []),
        ],
      });
    }

    filters.push({
      key: 'profession',
      label: 'Profession / Trade',
      type: 'select',
      value: professionFilter,
      onChange: (val) => setProfessionFilter(val),
      options: [
        { value: '', label: 'All Professions' },
        ...(professions.data?.map((p) => ({
          value: p._id,
          label: p.name,
        })) || []),
      ],
    });

    filters.push({
      key: 'status',
      label: 'Attendance Status',
      type: 'select',
      value: statusFilter,
      onChange: (val) => setStatusFilter(val),
      options: [
        { value: '', label: 'All Statuses' },
        { value: 'present', label: 'Present Only' },
        { value: 'absent', label: 'Absent Only' },
        { value: 'not_marked', label: 'Not Marked / Draft' },
      ],
    });

    return filters;
  }, [selectedDate, isSuperAdmin, siteFilter, activeSites.data, professionFilter, professions.data, statusFilter]);

  // Filter toolbar configuration for Tab 2 (All Records)
  const historyFilterConfig = useMemo(() => {
    const filters = [];

    if (isSuperAdmin) {
      filters.push({
        key: 'site',
        label: 'Project Site',
        type: 'select',
        value: historySiteFilter,
        onChange: (val) => {
          setHistorySiteFilter(val);
          setHistoryPage(1);
        },
        options: [
          { value: '', label: 'All Sites Combined' },
          ...(activeSites.data?.map((s) => ({
            value: s._id,
            label: `${s.name} (${s.code})`,
          })) || []),
        ],
      });
    }

    filters.push({
      key: 'profession',
      label: 'Profession / Trade',
      type: 'select',
      value: historyProfessionFilter,
      onChange: (val) => {
        setHistoryProfessionFilter(val);
        setHistoryPage(1);
      },
      options: [
        { value: '', label: 'All Professions' },
        ...(professions.data?.map((p) => ({
          value: p._id,
          label: p.name,
        })) || []),
      ],
    });

    filters.push({
      key: 'status',
      label: 'Attendance Status',
      type: 'select',
      value: historyStatusFilter,
      onChange: (val) => {
        setHistoryStatusFilter(val);
        setHistoryPage(1);
      },
      options: [
        { value: '', label: 'All Statuses' },
        { value: 'present', label: 'Present Only' },
        { value: 'absent', label: 'Absent Only' },
        { value: 'halfDay', label: 'Half Day Only' },
      ],
    });

    return filters;
  }, [isSuperAdmin, historySiteFilter, activeSites.data, historyProfessionFilter, professions.data, historyStatusFilter]);

  // Drawer handlers
  const handleTogglePresence = (workerId) => {
    setDrawerRows((prev) =>
      prev.map((r) => {
        if (r.worker === workerId) {
          const nextPresent = !r.isPresent;
          return {
            ...r,
            isPresent: nextPresent,
            workerCount: nextPresent ? (r.workerCount > 0 ? r.workerCount : (r.defaultWorkerCount ?? 1)) : 0,
          };
        }
        return r;
      })
    );
    setIsDirty(true);
  };

  const handleCountChange = (workerId, val) => {
    const countVal = val === '' ? '' : Math.max(0, Number(val));
    setDrawerRows((prev) =>
      prev.map((r) =>
        r.worker === workerId
          ? {
              ...r,
              workerCount: countVal,
              isPresent: countVal === '' ? r.isPresent : countVal > 0,
            }
          : r
      )
    );
    setIsDirty(true);
  };

  // Stepper: reaching 0 marks absent; any positive number marks present.
  const handleStep = (workerId, next) => {
    const n = Math.max(0, next);
    setDrawerRows((prev) =>
      prev.map((r) => (r.worker === workerId ? { ...r, workerCount: n, isPresent: n > 0 } : r))
    );
    setIsDirty(true);
  };

  const handleMarkAll = (present) => {
    setDrawerRows((prev) =>
      prev.map((r) =>
        r.inList
          ? {
              ...r,
              isPresent: present,
              workerCount: present ? (r.workerCount > 0 ? r.workerCount : (r.defaultWorkerCount ?? 1)) : 0,
            }
          : r
      )
    );
    setIsDirty(true);
  };

  const toggleNote = (workerId) => {
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const handleRemarksChange = (workerId, val) => {
    setDrawerRows((prev) =>
      prev.map((r) => (r.worker === workerId ? { ...r, remarks: val } : r))
    );
    setIsDirty(true);
  };

  const handleRemoveLeaderFromList = (workerId) => {
    setDrawerRows((prev) =>
      prev.map((r) => (r.worker === workerId ? { ...r, inList: false, isPresent: false, workerCount: 0 } : r))
    );
    setIsDirty(true);
  };

  const handleAddLeaderToList = (workerId) => {
    if (!workerId) return;
    setDrawerRows((prev) =>
      prev.map((r) => {
        if (r.worker === workerId) {
          return {
            ...r,
            inList: true,
            isPresent: true,
            workerCount: r.defaultWorkerCount ?? 1,
          };
        }
        return r;
      })
    );
    setSelectedLeaderToAdd('');
    setIsDirty(true);
  };

  const handleCopyPreviousDay = () => {
    const targetSite = isSuperAdmin ? drawerSiteId : siteId;
    if (!targetSite) {
      toast.error('Please select a project site first.');
      return;
    }
    setCopyFetchEnabled(true);
  };

  useEffect(() => {
    if (copyFetchEnabled && prevDayQuery.data && !prevDayQuery.isFetching) {
      const prevLeaders = prevDayQuery.data.leaders || [];
      if (prevLeaders.length === 0) {
        toast.info('No previous day attendance records found to import.');
      } else {
        const prevMap = new Map();
        prevLeaders.forEach((pl) => {
          prevMap.set(pl.worker?.toString() || pl._id?.toString(), pl);
        });

        setDrawerRows((prev) =>
          prev.map((r) => {
            const pEntry = prevMap.get(r.worker.toString());
            if (pEntry) {
              const cnt = pEntry.workerCount ?? r.defaultWorkerCount ?? 1;
              return {
                ...r,
                inList: true,
                isPresent: cnt > 0,
                workerCount: cnt,
                remarks: pEntry.remarks || r.remarks,
              };
            }
            return r;
          })
        );
        setIsDirty(true);
        toast.success(`Imported attendance counts from previous day for ${prevLeaders.length} leader(s).`);
      }
      setCopyFetchEnabled(false);
    }
  }, [copyFetchEnabled, prevDayQuery.data, prevDayQuery.isFetching, toast]);

  const drawerActiveRows = useMemo(() => {
    return drawerRows.filter((r) => r.inList);
  }, [drawerRows]);

  const visibleDrawerRows = useMemo(() => {
    const term = drawerSearch.trim().toLowerCase();
    if (!term) return drawerActiveRows;
    return drawerActiveRows.filter(
      (r) => r.name?.toLowerCase().includes(term) || r.profession?.name?.toLowerCase().includes(term)
    );
  }, [drawerActiveRows, drawerSearch]);

  const drawerUnaddedLeaders = useMemo(() => {
    return drawerRows.filter((r) => !r.inList);
  }, [drawerRows]);

  const drawerTotals = useMemo(() => {
    let totalWorkers = 0;
    let totalLabourExpense = 0;
    let presentLeaders = 0;

    drawerActiveRows.forEach((r) => {
      if (r.isPresent) {
        presentLeaders += 1;
        const cnt = Math.max(0, Number(r.workerCount) || 0);
        const wage = Math.max(0, Number(r.dailyWage) || 0);
        totalWorkers += cnt;
        totalLabourExpense += cnt * wage;
      }
    });

    return { totalWorkers, totalLabourExpense, presentLeaders };
  }, [drawerActiveRows]);

  const handleSaveAll = async () => {
    const targetSite = isSuperAdmin ? drawerSiteId : siteId;
    if (!targetSite) {
      toast.error('Please select a project site in the popup modal.');
      return;
    }

    try {
      const targetDate = selectedDate || getLocalDateString();
      const payload = {
        site: targetSite,
        date: targetDate,
        records: drawerRows.map((r) => ({
          worker: r.worker,
          workerCount: r.inList && r.isPresent ? Math.max(0, Number(r.workerCount) || 0) : 0,
          dailyWage: Math.max(0, Number(r.dailyWage) || 0),
          remarks: r.remarks,
        })),
      };

      await saveDailyMutation.mutateAsync(payload);
      setIsDirty(false);
      setIsPanelOpen(false);
      toast.success(`Daily attendance saved for (${formatDate(targetDate)}).`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save attendance.');
    }
  };

  return (
    <div className="module-page glass-page">
      {/* Hero */}
      <header className="glass-hero">
        <div>
          <span className="glass-hero__eyebrow">
            <Building2 size={12} style={{ verticalAlign: '-1px' }} /> {selectedSite?.name || (isSuperAdmin ? 'All project sites' : 'Assigned site')}
          </span>
          <h1>Attendance Records</h1>
          <p>
            {isSuperAdmin && !siteFilter
              ? 'Daily labour attendance and cost across all project sites.'
              : `Daily labour attendance and cost for ${selectedSite?.name || 'your site'}.`}
          </p>
        </div>
        <div className="glass-hero__side">
          <div className="glass-hero__chip"><small>Leaders present</small><strong>{summaryTotals.presentLeaders}<span style={{ opacity: 0.7, fontSize: 15 }}> / {summaryTotals.totalLeaders}</span></strong></div>
          <div className="glass-hero__chip"><small>Labours</small><strong>{summaryTotals.totalWorkers}</strong></div>
          <div className="glass-hero__chip"><small>Labour cost</small><strong>{formatCurrency(summaryTotals.totalLabourExpense)}</strong></div>
          <button type="button" className="glass-hero__cta" onClick={() => setIsPanelOpen(true)}>
            <Layers size={18} /> Mark Attendance
          </button>
        </div>
      </header>

      <div className="glass-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === 'daily'} className={activeTab === 'daily' ? 'is-on' : ''} onClick={() => setActiveTab('daily')}>
          <Calendar size={16} /> Daily View
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'is-on' : ''} onClick={() => setActiveTab('history')}>
          <Layers size={16} /> All Records
        </button>
      </div>

      {/* TAB 1: DAILY VIEW */}
      {activeTab === 'daily' && (
        <>
          {/* Status banner: shows what's left to do for this date */}
          {mainTableRows.length > 0 && (
            <div className={`att-banner ${markedCount === mainTableRows.length ? 'att-banner--done' : ''}`}>
              <div className="att-banner__text">
                <strong>
                  {markedCount === mainTableRows.length
                    ? `All ${mainTableRows.length} leaders marked for ${formatDate(selectedDate)}`
                    : markedCount === 0
                    ? `Attendance not marked yet for ${formatDate(selectedDate)}`
                    : `${markedCount} of ${mainTableRows.length} leaders marked`}
                </strong>
                <div className="att-banner__bar" aria-hidden="true">
                  <span style={{ width: `${(markedCount / mainTableRows.length) * 100}%` }} />
                </div>
              </div>
              {markedCount < mainTableRows.length ? (
                <Button onClick={() => setIsPanelOpen(true)}><Layers size={18} /> Mark now</Button>
              ) : (
                <Button variant="secondary" onClick={() => setIsPanelOpen(true)}>Edit</Button>
              )}
            </div>
          )}

          {/* KPI Summary Cards Grid */}
          <div className="attendance-kpi-grid">
            <div className="attendance-kpi-card glass-tile">
              <div className="attendance-kpi-card__top">
                <span className="attendance-kpi-card__label">Active Leaders</span>
                <div className="attendance-kpi-card__icon-wrap kpi-icon-green">
                  <Users size={20} />
                </div>
              </div>
              <div className="attendance-kpi-card__body">
                <div className="attendance-kpi-card__value">
                  {summaryTotals.presentLeaders} <span className="attendance-kpi-card__unit">/ {summaryTotals.totalLeaders}</span>
                </div>
                <span className="attendance-kpi-card__sub">
                  {summaryTotals.presentLeaders} Leaders Present Today
                </span>
              </div>
            </div>

            <div className="attendance-kpi-card glass-tile">
              <div className="attendance-kpi-card__top">
                <span className="attendance-kpi-card__label">Total Labours</span>
                <div className="attendance-kpi-card__icon-wrap kpi-icon-amber">
                  <UserCheck size={20} />
                </div>
              </div>
              <div className="attendance-kpi-card__body">
                <div className="attendance-kpi-card__value">
                  {summaryTotals.totalWorkers} <span className="attendance-kpi-card__unit">Workers</span>
                </div>
                <span className="attendance-kpi-card__sub">
                  Working on site today
                </span>
              </div>
            </div>

            <div className="attendance-kpi-card glass-tile">
              <div className="attendance-kpi-card__top">
                <span className="attendance-kpi-card__label">Daily Labour Cost</span>
                <div className="attendance-kpi-card__icon-wrap kpi-icon-purple">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="attendance-kpi-card__body">
                <div className="attendance-kpi-card__value attendance-kpi-card__value--cost">
                  {formatCurrency(summaryTotals.totalLabourExpense)}
                </div>
                <span className="attendance-kpi-card__sub">
                  {summaryTotals.isRecorded ? '● Attendance Recorded' : '● Draft / Not Recorded'}
                </span>
              </div>
            </div>
          </div>

          {/* Native Filter Toolbar Component */}
          <FilterToolbar
            search={search}
            onSearchChange={(v) => setSearch(v)}
            searchPlaceholder="Search worker, trade, or site..."
            filters={filterConfig}
            onReset={handleResetFilters}
            showChips={false}
          />

          {/* Main Roster Table */}
          <Card className="glass-panel" style={{ padding: 0 }}>
            {/* Table Header Bar */}
            <div style={{ padding: '14px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Attendance Roster ({formatDate(selectedDate)})
                </h3>
                {summaryTotals.isRecorded ? (
                  <span className="attendance-status-pill attendance-status-pill--marked">
                    <CheckCircle2 size={13} /> Attendance Recorded
                  </span>
                ) : (
                  <span className="attendance-status-pill attendance-status-pill--draft">
                    <AlertCircle size={13} /> Draft / Not Recorded
                  </span>
                )}
              </div>

              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Showing {filteredTableRows.length} of {mainTableRows.length} Worker Leader(s)
              </div>
            </div>

            {mainAttendanceQuery.isLoading ? (
              <TableSkeleton rows={6} columns={isSuperAdmin ? 9 : 8} />
            ) : mainTableRows.length === 0 ? (
              <div className="sites-page__state sites-page__state--empty" style={{ padding: '48px 24px' }}>
                <Inbox size={40} />
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  No worker leaders assigned to {selectedSite ? selectedSite.name : 'this project site'}.
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Assign worker leaders to this project site from the Workers section to manage daily attendance.
                </p>
              </div>
            ) : filteredTableRows.length === 0 ? (
              <div className="sites-page__state sites-page__state--empty" style={{ padding: '40px 24px' }}>
                <Inbox size={36} />
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  No records match your selected filters.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    marginTop: 8,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary-600)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="worker-payments-card__table-wrapper">
                <table className="worker-payments-card__table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>#</th>
                      <th>Worker Leader</th>
                      <th>Profession / Trade</th>
                      {isSuperAdmin && <th>Project Site</th>}
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Labours Working</th>
                      <th style={{ textAlign: 'right' }}>Daily Wage Rate</th>
                      <th style={{ textAlign: 'right' }}>Total Expense</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTableRows.map((row, idx) => {
                      const isMarked = !!row.isMarked;
                      const cnt = isMarked && (row.status === 'present' || row.workerCount > 0) ? row.workerCount : 0;
                      const wage = row.dailyWage ?? 0;
                      const cost = isMarked ? cnt * wage : 0;

                      return (
                        <tr key={row._id} className="attendance-table__row">
                          <td style={{ fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {row.photo?.url ? (
                                <img
                                  src={row.photo.url}
                                  alt={row.name}
                                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: 'var(--color-primary-100)',
                                    color: 'var(--color-primary-700)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: 13,
                                  }}
                                >
                                  {row.name[0]}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.name}</div>
                                {row.workerId && (
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{row.workerId}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                              {row.profession?.name || 'General Trade'}
                            </span>
                          </td>
                          {isSuperAdmin && (
                            <td>
                              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {row.site?.name || 'Assigned Site'}
                              </span>
                            </td>
                          )}
                          <td>
                            <span
                              className={`attendance-status-badge ${
                                !isMarked
                                  ? 'attendance-status-badge--draft'
                                  : row.status === 'present' || cnt > 0
                                  ? 'attendance-status-badge--present'
                                  : 'attendance-status-badge--absent'
                              }`}
                            >
                              {!isMarked ? (
                                <>
                                  <AlertCircle size={12} />
                                  <span>Not Marked</span>
                                </>
                              ) : row.status === 'present' || cnt > 0 ? (
                                <>
                                  <UserCheck size={12} />
                                  <span>Present</span>
                                </>
                              ) : (
                                <>
                                  <UserX size={12} />
                                  <span>Absent</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: isMarked && cnt > 0 ? 'var(--color-primary-700)' : 'var(--color-text-tertiary)' }}>
                            {isMarked ? (
                              <span className={cnt > 0 ? 'cnt-active' : 'cnt-zero'}>{cnt} Workers</span>
                            ) : (
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {formatCurrency(wage)} / day
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isMarked && cnt > 0 ? 'var(--color-primary-800)' : 'var(--color-text-tertiary)' }}>
                            {isMarked ? formatCurrency(cost) : '—'}
                          </td>
                          <td>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontStyle: row.remarks ? 'normal' : 'italic' }}>
                              {row.remarks || (isMarked ? 'No remarks' : '—')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Summary Footer */}
            {filteredTableRows.length > 0 && (
              <div className="attendance-table__footer">
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  Date: <strong>{formatDate(selectedDate)}</strong> · Site: <strong>{selectedSite?.name || 'All Sites'}</strong>
                </span>
                <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  <span>Total Labours: <strong style={{ color: 'var(--color-primary-700)' }}>{summaryTotals.totalWorkers}</strong></span>
                  <span>Total Labour Cost: <strong style={{ color: 'var(--color-primary-700)' }}>{formatCurrency(summaryTotals.totalLabourExpense)}</strong></span>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* TAB 2: ALL RECORDS (HISTORY) */}
      {activeTab === 'history' && (
        <>
          {/* History KPI Summary Cards Grid */}
          <div className="attendance-kpi-grid">
            <div className="attendance-kpi-card glass-tile">
              <div className="attendance-kpi-card__top">
                <span className="attendance-kpi-card__label">Total Days Recorded</span>
                <div className="attendance-kpi-card__icon-wrap kpi-icon-blue">
                  <Calendar size={20} />
                </div>
              </div>
              <div className="attendance-kpi-card__body">
                <div className="attendance-kpi-card__value">
                  {historyQuery.data?.summary?.totalDaysRecorded || 0} <span className="attendance-kpi-card__unit">Days</span>
                </div>
                <span className="attendance-kpi-card__sub">Unique Days Recorded</span>
              </div>
            </div>

            <div className="attendance-kpi-card glass-tile">
              <div className="attendance-kpi-card__top">
                <span className="attendance-kpi-card__label">All-Time Labour Cost</span>
                <div className="attendance-kpi-card__icon-wrap kpi-icon-purple">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="attendance-kpi-card__body">
                <div className="attendance-kpi-card__value attendance-kpi-card__value--cost">
                  {formatCurrency(historyQuery.data?.summary?.allTimeTotalLabourCost || 0)}
                </div>
                <span className="attendance-kpi-card__sub">Cumulative Labour Expense</span>
              </div>
            </div>

            <div className="attendance-kpi-card glass-tile">
              <div className="attendance-kpi-card__top">
                <span className="attendance-kpi-card__label">Avg Daily Cost</span>
                <div className="attendance-kpi-card__icon-wrap kpi-icon-green">
                  <TrendingUp size={20} />
                </div>
              </div>
              <div className="attendance-kpi-card__body">
                <div className="attendance-kpi-card__value">
                  {formatCurrency(historyQuery.data?.summary?.averageDailyLabourCost || 0)}
                </div>
                <span className="attendance-kpi-card__sub">Average Per Recorded Day</span>
              </div>
            </div>

            <div className="attendance-kpi-card glass-tile">
              <div className="attendance-kpi-card__top">
                <span className="attendance-kpi-card__label">Total Unique Workers</span>
                <div className="attendance-kpi-card__icon-wrap kpi-icon-amber">
                  <Users size={20} />
                </div>
              </div>
              <div className="attendance-kpi-card__body">
                <div className="attendance-kpi-card__value">
                  {historyQuery.data?.summary?.totalUniqueWorkers || 0} <span className="attendance-kpi-card__unit">Workers</span>
                </div>
                <span className="attendance-kpi-card__sub">Workers Logged</span>
              </div>
            </div>
          </div>

          {/* Date Range Presets Bar */}
          <div className="attendance-range-presets">
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4 }}>
              Date Range:
            </span>
            <button
              type="button"
              className={`attendance-preset-btn ${historyPeriod === 'today' ? 'attendance-preset-btn--active' : ''}`}
              onClick={() => { setHistoryPeriod('today'); setHistoryPage(1); }}
            >
              Today
            </button>
            <button
              type="button"
              className={`attendance-preset-btn ${historyPeriod === 'week' ? 'attendance-preset-btn--active' : ''}`}
              onClick={() => { setHistoryPeriod('week'); setHistoryPage(1); }}
            >
              This Week
            </button>
            <button
              type="button"
              className={`attendance-preset-btn ${historyPeriod === 'month' ? 'attendance-preset-btn--active' : ''}`}
              onClick={() => { setHistoryPeriod('month'); setHistoryPage(1); }}
            >
              This Month
            </button>
            <button
              type="button"
              className={`attendance-preset-btn ${historyPeriod === 'custom' ? 'attendance-preset-btn--active' : ''}`}
              onClick={() => { setHistoryPeriod('custom'); setHistoryPage(1); }}
            >
              Custom Range
            </button>

            {historyPeriod === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>From:</span>
                  <DatePickerInput
                    value={historyStartDate}
                    onChange={(val) => { setHistoryStartDate(val); setHistoryPage(1); }}
                    style={{ width: 140, height: 34 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>To:</span>
                  <DatePickerInput
                    value={historyEndDate}
                    onChange={(val) => { setHistoryEndDate(val); setHistoryPage(1); }}
                    style={{ width: 140, height: 34 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* History Filter Toolbar */}
          <FilterToolbar
            search={historySearch}
            onSearchChange={(v) => { setHistorySearch(v); setHistoryPage(1); }}
            searchPlaceholder="Search worker, trade, or site..."
            filters={historyFilterConfig}
            onReset={handleResetHistoryFilters}
            showChips={false}
            extraActions={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', alignSelf: 'flex-end' }}>
                <Button
                  variant="secondary"
                  onClick={handleExportCSV}
                  style={{ height: 42, whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)' }}
                >
                  <Download size={14} /> Export CSV
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExportPDF}
                  style={{ height: 42, whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)' }}
                >
                  <Printer size={14} /> Print PDF
                </Button>
              </div>
            }
          />

          {/* All Records Table */}
          <Card className="glass-panel" style={{ padding: 0 }}>
            {/* Table Header Bar */}
            <div style={{ padding: '14px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  All Attendance History ({historyQuery.data?.total || 0} Records)
                </h3>
              </div>

              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Page {historyQuery.data?.page || 1} of {historyQuery.data?.totalPages || 1}
              </div>
            </div>

            {historyQuery.isLoading ? (
              <TableSkeleton rows={8} columns={isSuperAdmin ? 9 : 8} />
            ) : !historyQuery.data?.items || historyQuery.data.items.length === 0 ? (
              <div className="sites-page__state sites-page__state--empty" style={{ padding: '48px 24px' }}>
                <Inbox size={40} />
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  No historical attendance records found for this period.
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Try adjusting your date range, search query, or selected site filters.
                </p>
              </div>
            ) : (
              <div className="worker-payments-card__table-wrapper">
                <table className="worker-payments-card__table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th className="sortable-th" onClick={() => handleHistorySort('date')}>
                        <span className="sortable-th__content">
                          Date {renderSortIcon('date')}
                        </span>
                      </th>
                      {isSuperAdmin && <th>Project Site</th>}
                      <th className="sortable-th" onClick={() => handleHistorySort('workerName')}>
                        <span className="sortable-th__content">
                          Worker Leader {renderSortIcon('workerName')}
                        </span>
                      </th>
                      <th>Profession / Trade</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Labours Working</th>
                      <th style={{ textAlign: 'right' }}>Daily Wage Rate</th>
                      <th className="sortable-th" style={{ textAlign: 'right' }} onClick={() => handleHistorySort('totalAmount')}>
                        <span className="sortable-th__content">
                          Total Cost {renderSortIcon('totalAmount')}
                        </span>
                      </th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyQuery.data.items.map((row, idx) => {
                      const cnt = row.status === 'present' || row.workerCount > 0 ? row.workerCount : 0;
                      const wage = row.dailyWage ?? 0;
                      const cost = row.totalAmount ?? cnt * wage;
                      const rowNum = (historyQuery.data.page - 1) * historyQuery.data.limit + idx + 1;

                      return (
                        <tr key={row._id} className="attendance-table__row">
                          <td style={{ fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{rowNum}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {formatDate(row.date)}
                          </td>
                          {isSuperAdmin && (
                            <td>
                              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {row.site?.name || 'Assigned Site'}
                              </span>
                            </td>
                          )}
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {row.workerName || row.worker?.name || 'Worker'}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                              {row.profession?.name || row.professionName || 'General Trade'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`attendance-status-badge ${row.status === 'present' || cnt > 0
                                  ? 'attendance-status-badge--present'
                                  : 'attendance-status-badge--absent'
                                }`}
                            >
                              {row.status === 'present' || cnt > 0 ? <UserCheck size={12} /> : <UserX size={12} />}
                              <span>{row.status === 'present' || cnt > 0 ? 'Present' : 'Absent'}</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: cnt > 0 ? 'var(--color-primary-700)' : 'var(--color-text-tertiary)' }}>
                            <span className={cnt > 0 ? 'cnt-active' : 'cnt-zero'}>{cnt} Workers</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {formatCurrency(wage)} / day
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: cnt > 0 ? 'var(--color-primary-800)' : 'var(--color-text-tertiary)' }}>
                            {formatCurrency(cost)}
                          </td>
                          <td>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontStyle: row.remarks ? 'normal' : 'italic' }}>
                              {row.remarks || 'No remarks'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls for Tab 2 */}
            {historyQuery.data?.totalPages > 1 && (
              <div className="attendance-table__footer">
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Page <strong>{historyQuery.data.page}</strong> of <strong>{historyQuery.data.totalPages}</strong> ({historyQuery.data.total} Total Records)
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={historyQuery.data.page <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={historyQuery.data.page >= historyQuery.data.totalPages}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* MARK ATTENDANCE POPUP DRAWER MODAL */}
      <Drawer
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title="Mark Daily Labour Attendance"
        size="lg"
        footer={
          <div className="att2-footer">
            <div className="att2-summary">
              <div><span>Present</span><strong>{drawerTotals.presentLeaders}/{drawerActiveRows.length}</strong></div>
              <div><span>Labours</span><strong>{drawerTotals.totalWorkers}</strong></div>
              <div className="att2-summary-total"><span>Total cost</span><strong>{formatCurrency(drawerTotals.totalLabourExpense)}</strong></div>
            </div>
            <div className="att2-footer-btns">
              <Button variant="secondary" onClick={() => setIsPanelOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAll} isLoading={saveDailyMutation.isPending}>
                <Save size={18} /> Save
              </Button>
            </div>
          </div>
        }
      >
        <div className="att2">
          {/* Context bar: site, date, import */}
          <div className="att2-context">
            {isSuperAdmin ? (
              <label className="att2-field">
                <span className="att2-label">Project site</span>
                <select
                  className="form-select att2-select"
                  value={drawerSiteId}
                  onChange={(e) => setDrawerSiteId(e.target.value)}
                >
                  <option value="">Select project site…</option>
                  {activeSites.data?.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="att2-field">
                <span className="att2-label">Project site</span>
                <div className="att2-chip"><Building2 size={16} /> {selectedSite?.name || 'Assigned Site'}</div>
              </div>
            )}
            <div className="att2-field">
              <span className="att2-label">Date</span>
              <div className="att2-chip"><Calendar size={16} /> {formatDate(targetDate)}</div>
            </div>
            <Button variant="secondary" onClick={handleCopyPreviousDay} isLoading={prevDayQuery.isFetching} className="att2-import">
              <Copy size={15} /> Copy yesterday
            </Button>
          </div>

          {isSuperAdmin && !drawerSiteId ? (
            <div className="att2-empty">
              <Building2 size={32} />
              <strong>Select a project site</strong>
              <span>Pick a site above to load its worker leaders.</span>
            </div>
          ) : drawerAttendanceQuery.isLoading || drawerAttendanceQuery.isFetching ? (
            <div className="att2-list" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="att2-row att2-row--skeleton" />)}
            </div>
          ) : drawerAttendanceQuery.isError ? (
            <div className="att2-empty att2-empty--error">
              <AlertCircle size={32} />
              <strong>Unable to load site workers</strong>
              <span>{drawerAttendanceQuery.error?.response?.data?.message || drawerAttendanceQuery.error?.message || 'Error occurred while fetching workers.'}</span>
              <Button variant="secondary" size="sm" onClick={() => drawerAttendanceQuery.refetch()}>Retry</Button>
            </div>
          ) : (
            <>
              {/* Quick tools */}
              <div className="att2-tools">
                <div className="att2-search">
                  <Search size={16} />
                  <input
                    type="search"
                    placeholder="Find a leader…"
                    value={drawerSearch}
                    onChange={(e) => setDrawerSearch(e.target.value)}
                  />
                </div>
                <div className="att2-bulk">
                  <button type="button" className="att2-bulk-btn att2-bulk-btn--ok" onClick={() => handleMarkAll(true)}>
                    <UserCheck size={15} /> All present
                  </button>
                  <button type="button" className="att2-bulk-btn" onClick={() => handleMarkAll(false)}>
                    <UserX size={15} /> All absent
                  </button>
                </div>
              </div>

              {drawerUnaddedLeaders.length > 0 && (
                <div className="att2-addbar">
                  <Plus size={16} />
                  <select
                    className="att2-addselect"
                    value={selectedLeaderToAdd}
                    onChange={(e) => handleAddLeaderToList(e.target.value)}
                  >
                    <option value="">Add a leader not in today's list ({drawerUnaddedLeaders.length})…</option>
                    {drawerUnaddedLeaders.map((l) => (
                      <option key={l.worker} value={l.worker}>
                        {l.name} · {l.profession?.name || 'Trade'} · ₹{l.dailyWage}/day
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {drawerActiveRows.length === 0 ? (
                <div className="att2-empty">
                  <Inbox size={32} />
                  <strong>No worker leaders for this site</strong>
                  <span>New active workers added to this site will appear here automatically.</span>
                </div>
              ) : visibleDrawerRows.length === 0 ? (
                <div className="att2-empty"><Search size={28} /><strong>No leader matches “{drawerSearch}”</strong></div>
              ) : (
                <div className="att2-list">
                  {visibleDrawerRows.map((row) => {
                    const cnt = row.isPresent ? Math.max(0, Number(row.workerCount) || 0) : 0;
                    const wage = Math.max(0, Number(row.dailyWage) || 0);
                    const noteOpen = openNotes.has(row.worker) || !!row.remarks;
                    return (
                      <div key={row.worker} className={`att2-row ${row.isPresent ? 'is-present' : 'is-absent'}`}>
                        <div className="att2-person">
                          {row.photo?.url ? (
                            <img src={row.photo.url} alt={row.name} className="att2-avatar" />
                          ) : (
                            <div className="att2-avatar att2-avatar--initial">{row.name?.[0]?.toUpperCase()}</div>
                          )}
                          <div className="att2-person-text">
                            <div className="att2-name">{row.name}</div>
                            <div className="att2-meta">{row.profession?.name || 'General Helper'} · {formatCurrency(wage)}/day</div>
                          </div>
                        </div>

                        <div className="att2-stepper" role="group" aria-label={`Labours for ${row.name}`}>
                          <button type="button" onClick={() => handleStep(row.worker, cnt - 1)} disabled={cnt <= 0} aria-label="Decrease">
                            <Minus size={18} />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={row.isPresent ? row.workerCount : 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleCountChange(row.worker, e.target.value)}
                            aria-label="Number of labours"
                          />
                          <button type="button" onClick={() => handleStep(row.worker, cnt + 1)} aria-label="Increase">
                            <Plus size={18} />
                          </button>
                        </div>

                        <div className="att2-total">{formatCurrency(cnt * wage)}</div>

                        <div className="att2-actions">
                          <button
                            type="button"
                            onClick={() => handleTogglePresence(row.worker)}
                            className={`att2-toggle ${row.isPresent ? 'on' : 'off'}`}
                            aria-pressed={row.isPresent}
                          >
                            {row.isPresent ? 'Present' : 'Absent'}
                          </button>
                          <button
                            type="button"
                            className={`att2-icon-btn ${noteOpen ? 'active' : ''}`}
                            onClick={() => toggleNote(row.worker)}
                            title="Add note"
                            aria-label="Add note"
                          >
                            <StickyNote size={16} />
                          </button>
                          <button
                            type="button"
                            className="att2-icon-btn att2-icon-btn--danger"
                            onClick={() => handleRemoveLeaderFromList(row.worker)}
                            title="Remove from today's list"
                            aria-label="Remove from today's list"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {noteOpen && (
                          <input
                            type="text"
                            className="att2-note"
                            placeholder="Note (optional)…"
                            value={row.remarks || ''}
                            onChange={(e) => handleRemarksChange(row.worker, e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}
