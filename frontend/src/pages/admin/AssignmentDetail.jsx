import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, ErrorBox, PageHeader, ProgressBar, Spinner, fmtDate } from '../../components/ui.jsx';

export default function AssignmentDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('groups');

  useEffect(() => {
    api.assignment(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;
  const { assignment: a, groups, students } = data;
  const done = groups.filter((g) => g.submitted).length;
  const pct = groups.length ? Math.round((done / groups.length) * 100) : 0;

  return (
    <>
      <PageHeader title={a.title} subtitle={`Due ${fmtDate(a.dueDate)}`}>
        <a href={a.onedriveLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">OneDrive ↗</a>
        <Link to={`/admin/assignments/${a.id}/edit`} className="btn-primary">Edit</Link>
      </PageHeader>

      <div className="card mb-6">
        {a.description && <p className="mb-4 whitespace-pre-line text-sm text-slate-600">{a.description}</p>}
        <ProgressBar percent={pct} label={`${done} of ${groups.length} groups confirmed`} />
      </div>

      <div className="mb-4 flex gap-2" role="tablist">
        {[['groups', 'Group-wise'], ['students', 'Student-wise']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto !p-0">
        {tab === 'groups' ? (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-3">Group</th><th className="p-3">Members</th><th className="p-3">Status</th><th className="p-3">Confirmed by</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No groups targeted.</td></tr>}
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="p-3 font-medium">{g.name}</td>
                  <td className="p-3 text-slate-600">{g.members.map((m) => m.name).join(', ')}</td>
                  <td className="p-3">
                    {g.submitted ? <Badge tone={g.late ? 'amber' : 'green'}>{g.late ? 'Submitted late' : 'Submitted'}</Badge> : <Badge tone="red">Pending</Badge>}
                  </td>
                  <td className="p-3 text-slate-600">{g.submitted ? `${g.confirmedBy} · ${fmtDate(g.confirmedAt)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-3">Student</th><th className="p-3">Group</th><th className="p-3">Status</th><th className="p-3">Confirmed by</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No students.</td></tr>}
              {students.map((s) => (
                <tr key={`${s.groupId}-${s.id}`}>
                  <td className="p-3"><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{s.email}</p></td>
                  <td className="p-3 text-slate-600">{s.groupName}</td>
                  <td className="p-3">{s.submitted ? <Badge tone="green">Submitted</Badge> : <Badge tone="red">Pending</Badge>}</td>
                  <td className="p-3 text-slate-600">{s.submitted ? s.confirmedBy : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
