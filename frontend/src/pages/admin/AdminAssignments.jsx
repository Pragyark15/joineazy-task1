import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, ErrorBox, PageHeader, ProgressBar, Spinner, fmtDate } from '../../components/ui.jsx';

export default function AdminAssignments() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.assignments().then((r) => setList(r.assignments)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"? All confirmations for it will be lost.`)) return;
    try { await api.deleteAssignment(a.id); load(); } catch (e) { setError(e.message); }
  };

  if (!list && !error) return <Spinner />;

  return (
    <>
      <PageHeader title="Assignments" subtitle="Create, edit and monitor assignments">
        <Link to="/admin/assignments/new" className="btn-primary">+ New assignment</Link>
      </PageHeader>
      <ErrorBox message={error} />
      {list && list.length === 0 && <p className="py-12 text-center text-slate-500">No assignments yet. Create your first one.</p>}
      <div className="space-y-3">
        {list?.map((a) => {
          const pct = a.targetGroups ? Math.round((a.submittedGroups / a.targetGroups) * 100) : 0;
          return (
            <article key={a.id} className="card flex flex-col gap-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/assignments/${a.id}`} className="font-semibold text-slate-900 hover:text-brand-600">{a.title}</Link>
                  <Badge tone={a.assignToAll ? 'blue' : 'slate'}>{a.assignToAll ? 'All groups' : `${a.targetGroups} group(s)`}</Badge>
                  {new Date(a.dueDate) < new Date() && <Badge tone="red">Past due</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-500">Due {fmtDate(a.dueDate)}</p>
              </div>
              <div className="w-full md:w-56">
                <ProgressBar percent={pct} label={`${a.submittedGroups}/${a.targetGroups} groups`} />
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/assignments/${a.id}`} className="btn-secondary">View</Link>
                <Link to={`/admin/assignments/${a.id}/edit`} className="btn-secondary">Edit</Link>
                <button className="btn-secondary !text-red-600" onClick={() => remove(a)}>Delete</button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
