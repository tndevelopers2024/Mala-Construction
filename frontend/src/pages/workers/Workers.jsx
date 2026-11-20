import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users, UserCheck, UserX, RotateCcw, ChevronLeft, ChevronRight, Inbox, Phone, MapPin, LayoutGrid, List, ArrowUpRight, Wallet } from 'lucide-react';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/modals/ConfirmDialog';
import WorkerFormModal from './WorkerFormModal';
import FilterToolbar from '../../components/common/FilterToolbar';
import { useWorkers, useDeleteWorker, useRestoreWorker } from '../../hooks/useWorkers';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSiteScope } from '../../hooks/useSiteScope';
import { useLookups } from '../../hooks/useLookups';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/format';
import Card from '../../components/ui/Card';
import { motion } from 'framer-motion';
import '../../styles/operational-page.css';
import '../sites/Sites.css';
import './WorkerProfile.css';
import './Workers.css';

import { GridCardSkeleton } from '../../components/ui/Skeleton';

export default function Workers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [siteFilter, setSiteFilter] = useState('');
  const [professionFilter, setProfessionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: 'delete' | 'restore', worker }

  const { isSuperAdmin, siteId } = useSiteScope(siteFilter || undefined);
  const activeSiteId = isSuperAdmin ? siteFilter || undefined : siteId;
  const debouncedSearch = useDebouncedValue(search);
  const { professions, activeSites } = useLookups(activeSiteId);
  const selectedSite = activeSites.data?.find((s) => s._id === activeSiteId);

  const [view, setView] = useState(() => {
    try { return localStorage.getItem('workers-view') || 'grid'; } catch { return 'grid'; }
  });
  useEffect(() => {
    try { localStorage.setItem('workers-view', view); } catch { /* storage unavailable */ }
  }, [view]);

  const totalWorkersQuery = useWorkers({
    siteId: activeSiteId,
    limit: 1,
  });
  const totalWorkersCount = totalWorkersQuery.data?.total ?? 0;

  const activeWorkersCount = useWorkers({ siteId: activeSiteId, status: 'active', limit: 1 }).data?.total ?? 0;
  const inactiveWorkersCount = Math.max(0, totalWorkersCount - activeWorkersCount);

  const { data, isLoading, isError, isFetching } = useWorkers({
    page,
    limit: 9,
    search: debouncedSearch || undefined,
    siteId: activeSiteId,
    profession: professionFilter || undefined,
    status: statusFilter || undefined,
    showDeleted,
  });
  const deleteWorker = useDeleteWorker();
  const restoreWorker = useRestoreWorker();
  const toast = useToast();

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    try {
      if (confirmTarget.type === 'restore') {
        await restoreWorker.mutateAsync(confirmTarget.worker._id);
        toast.success('Worker restored.');
      } else {
        await deleteWorker.mutateAsync(confirmTarget.worker._id);
        toast.success('Worker deleted.');
      }
      setConfirmTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed.');
    }
  };

  const filterConfig = [
    ...(isSuperAdmin ? [{
      key: 'siteId',
      label: 'Site',
      type: 'select',
      value: siteFilter,
      onChange: (val) => { setSiteFilter(val); setPage(1); },
      options: activeSites.data?.map((s) => ({ value: s._id, label: s.name })) || [],
    }] : []),
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      value: statusFilter,
      onChange: (val) => { setStatusFilter(val); setPage(1); },
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    {
      key: 'profession',
      label: 'Profession',
      type: 'select',
      value: professionFilter,
      onChange: (val) => { setProfessionFilter(val); setPage(1); },
      options: professions.data?.map((p) => ({ value: p._id, label: p.name })) || [],
    },
  ];

  const handleReset = () => {
    setSearch('');
    setSiteFilter('');
    setProfessionFilter('');
    setStatusFilter('');
    setShowDeleted(false);
    setPage(1);
  };

  const items = data?.items ?? [];
  const sitesOf = (w) => (w.sites?.length ? w.sites : [w.site]).filter(Boolean);
  const crewCost = (w) => (Number(w.workerCount) || 1) * (Number(w.dailyWage) || 0);

  const renderActions = (w) =>
    w.isDeleted ? (
      <button type="button" className="wk-btn wk-btn--ghost" onClick={() => setConfirmTarget({ type: 'restore', worker: w })}>
        <RotateCcw size={15} /> Restore
      </button>
    ) : (
      <>
        <Link to={`/workers/${w._id}`} className="wk-btn wk-btn--ghost" title="View profile">
          Profile <ArrowUpRight size={14} />
        </Link>
        <button type="button" className="wk-icon" onClick={() => { setEditing(w); setIsFormOpen(true); }} title="Edit" aria-label={`Edit ${w.name}`}>
          <Pencil size={16} />
        </button>
        <button type="button" className="wk-icon wk-icon--danger" onClick={() => setConfirmTarget({ type: 'delete', worker: w })} title="Delete" aria-label={`Delete ${w.name}`}>
          <Trash2 size={16} />
        </button>
      </>
    );

  const renderAvatar = (w, size = 56) =>
    w.photo?.url ? (
      <img src={w.photo.url} alt={w.name} className="wk-avatar" style={{ width: size, height: size }} />
    ) : (
      <div className="wk-avatar wk-avatar--initial" style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {w.name?.[0]?.toUpperCase()}
      </div>
    );

  const renderStatus = (w) =>
    w.isDeleted ? (
      <span className="wk-pill wk-pill--deleted">Deleted</span>
    ) : (
      <span className={`wk-pill wk-pill--${w.status === 'active' ? 'active' : 'inactive'}`}>
        <i /> {w.status === 'active' ? 'Active' : 'Inactive'}
      </span>
    );

  return (
    <div className="module-page">
      <div className="module-page__header">
        <div>
          <h1>Worker Leaders</h1>
          <p>Manage leaders, their crew size, trade and daily wage.</p>
        </div>
        <Button onClick={() => { setEditing(null); setIsFormOpen(true); }}>
          <Plus size={18} /> Add Worker Leader
        </Button>
      </div>

      <div className="wk-stats">
        <div className="wk-stat wk-stat--blue">
          <span className="wk-stat__icon"><Users size={22} /></span>
          <div><small>{selectedSite ? selectedSite.name : 'All sites'}</small><strong>{totalWorkersQuery.isLoading ? '…' : totalWorkersCount}</strong><span>Total leaders</span></div>
        </div>
        <div className="wk-stat wk-stat--green">
          <span className="wk-stat__icon"><UserCheck size={22} /></span>
          <div><strong>{activeWorkersCount}</strong><span>Active</span></div>
        </div>
        <div className="wk-stat wk-stat--slate">
          <span className="wk-stat__icon"><UserX size={22} /></span>
          <div><strong>{inactiveWorkersCount}</strong><span>Inactive</span></div>
        </div>
      </div>

      {/* Trade quick filters */}
      {professions.data?.length > 0 && (
        <div className="wk-chips" role="tablist" aria-label="Filter by trade">
          <button type="button" className={`wk-chip ${!professionFilter ? 'is-on' : ''}`} onClick={() => { setProfessionFilter(''); setPage(1); }}>All trades</button>
          {professions.data.map((p) => (
            <button key={p._id} type="button" className={`wk-chip ${professionFilter === p._id ? 'is-on' : ''}`} onClick={() => { setProfessionFilter(p._id); setPage(1); }}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="wk-toolbar">
        <div className="wk-toolbar__filters">
          <FilterToolbar
            search={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search leaders by name…"
            filters={filterConfig.filter((f) => f.key !== 'profession')}
            onReset={handleReset}
          />
        </div>
        <div className="wk-view" role="group" aria-label="Layout">
          <button type="button" className={view === 'grid' ? 'is-on' : ''} onClick={() => setView('grid')} aria-label="Card view" title="Card view"><LayoutGrid size={18} /></button>
          <button type="button" className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')} aria-label="List view" title="List view"><List size={18} /></button>
        </div>
      </div>

      {isError && (
        <div className="sites-page__state sites-page__state--error" role="alert">
          Failed to load worker leaders. Please try reloading.
        </div>
      )}

      {!isError && (isLoading || (isFetching && !items.length)) && (
        <div className="sites-page__grid"><GridCardSkeleton count={6} /></div>
      )}

      {!isError && !isLoading && items.length === 0 && (
        <div className="wk-empty">
          <Inbox size={36} />
          <strong>No worker leaders found</strong>
          <span>Try clearing the filters, or add your first leader.</span>
          <Button onClick={() => { setEditing(null); setIsFormOpen(true); }}><Plus size={18} /> Add Worker Leader</Button>
        </div>
      )}

      {!isError && !isLoading && items.length > 0 && (
        <>
          {view === 'grid' ? (
            <div className="wk-grid">
              {items.map((w, i) => (
                <motion.article
                  key={w._id}
                  className={`wk-card ${w.isDeleted ? 'is-deleted' : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03 }}
                >
                  <div className="wk-card__banner" />
                  <div className="wk-card__top">
                    {renderAvatar(w)}
                    {renderStatus(w)}
                  </div>
                  <div className="wk-card__id">
                    <h3>{w.name}</h3>
                    <div className="wk-card__sub">
                      <span className="wk-trade">{w.profession?.name || 'General'}</span>
                      {w.workerId && <code>{w.workerId}</code>}
                    </div>
                  </div>

                  <div className="wk-metrics">
                    <div><small>Labours</small><strong>{w.workerCount ?? 1}</strong></div>
                    <div><small>Wage / day</small><strong>{formatCurrency(w.dailyWage)}</strong></div>
                    <div><small>Crew / day</small><strong className="wk-metrics__hl">{formatCurrency(crewCost(w))}</strong></div>
                  </div>

                  <div className="wk-card__meta">
                    {(w.phone || w.emergencyContact?.phone) && (
                      <a href={`tel:${w.phone || w.emergencyContact?.phone}`} className="wk-meta"><Phone size={14} /> {w.phone || w.emergencyContact?.phone}</a>
                    )}
                    <div className="wk-meta wk-meta--sites">
                      <MapPin size={14} />
                      {sitesOf(w).length ? sitesOf(w).map((s) => <span key={s?._id ?? s} className="wk-site">{s?.name ?? 'Assigned site'}</span>) : <span className="wk-muted">No site assigned</span>}
                    </div>
                  </div>

                  <div className="wk-card__actions">{renderActions(w)}</div>
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="wk-table-wrap">
              <table className="wk-table">
                <thead>
                  <tr>
                    <th>Leader</th><th>Trade</th><th>Site</th><th className="r">Labours</th><th className="r">Wage / day</th><th className="r">Crew / day</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => (
                    <tr key={w._id} className={w.isDeleted ? 'is-deleted' : ''}>
                      <td>
                        <div className="wk-cell">
                          {renderAvatar(w, 36)}
                          <div><Link to={`/workers/${w._id}`} className="wk-link">{w.name}</Link>{w.workerId && <small>{w.workerId}</small>}</div>
                        </div>
                      </td>
                      <td><span className="wk-trade">{w.profession?.name || 'General'}</span></td>
                      <td>{sitesOf(w).map((s) => s?.name).filter(Boolean).join(', ') || '—'}</td>
                      <td className="r">{w.workerCount ?? 1}</td>
                      <td className="r">{formatCurrency(w.dailyWage)}</td>
                      <td className="r"><strong>{formatCurrency(crewCost(w))}</strong></td>
                      <td>{renderStatus(w)}</td>
                      <td><div className="wk-row-actions">{renderActions(w)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="sites-page__pagination">
              <button type="button" className="pagination-btn touch-target" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-label">Page {page} of {data.totalPages}</span>
              <button type="button" className="pagination-btn touch-target" onClick={() => setPage(page + 1)} disabled={page >= data.totalPages} aria-label="Next page">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      <WorkerFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} worker={editing} defaultSiteId={siteId} />
      <ConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirm}
        isLoading={deleteWorker.isPending || restoreWorker.isPending}
        title={confirmTarget?.type === 'restore' ? 'Restore worker account?' : 'Delete worker account?'}
        message={
          confirmTarget?.type === 'restore'
            ? `Are you sure you want to restore ${confirmTarget?.worker?.name}?`
            : `Are you sure you want to delete ${confirmTarget?.worker?.name}?`
        }
        confirmLabel={confirmTarget?.type === 'restore' ? 'Restore' : 'Delete'}
        isDestructive={confirmTarget?.type === 'delete'}
      />
    </div>
  );
}
