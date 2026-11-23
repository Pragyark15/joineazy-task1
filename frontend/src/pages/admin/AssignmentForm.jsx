import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { ErrorBox, PageHeader, Spinner, toLocalInput } from '../../components/ui.jsx';

const blank = { title: '', description: '', dueDate: '', onedriveLink: '', assignToAll: true, groupIds: [] };

export default function AssignmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const jobs = [api.allGroups().then((r) => setGroups(r.groups))];
    if (id) {
      jobs.push(
        api.assignment(id).then(({ assignment: a }) =>
          setForm({
            title: a.title, description: a.description, dueDate: toLocalInput(a.dueDate),
            onedriveLink: a.onedriveLink, assignToAll: a.assignToAll, groupIds: a.groupIds,
          })
        )
      );
    }
    Promise.all(jobs).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleGroup = (gid) =>
    setForm({
      ...form,
      groupIds: form.groupIds.includes(gid) ? form.groupIds.filter((x) => x !== gid) : [...form.groupIds, gid],
    });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { ...form, dueDate: new Date(form.dueDate).toISOString() };
      if (id) await api.updateAssignment(id, body);
      else await api.createAssignment(body);
      navigate('/admin/assignments');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title={id ? 'Edit assignment' : 'New assignment'} />
      <form onSubmit={submit} className="card max-w-2xl space-y-4">
        <ErrorBox message={error} />
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" required minLength={2} className="input" value={form.title} onChange={set('title')} />
        </div>
        <div>
          <label className="label" htmlFor="desc">Description</label>
          <textarea id="desc" rows={4} className="input" value={form.description} onChange={set('description')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="due">Due date</label>
            <input id="due" type="datetime-local" required className="input" value={form.dueDate} onChange={set('dueDate')} />
          </div>
          <div>
            <label className="label" htmlFor="link">OneDrive submission link</label>
            <input id="link" type="url" required className="input" placeholder="https://onedrive.live.com/..." value={form.onedriveLink} onChange={set('onedriveLink')} />
          </div>
        </div>

        <fieldset>
          <legend className="label">Assign to</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={form.assignToAll} onChange={() => setForm({ ...form, assignToAll: true })} /> All students
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!form.assignToAll} onChange={() => setForm({ ...form, assignToAll: false })} /> Specific groups
            </label>
          </div>
          {!form.assignToAll && (
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {groups.length === 0 && <p className="text-sm text-slate-500">No groups exist yet.</p>}
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  {g.name} <span className="text-xs text-slate-400">({g.members.length} members)</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create assignment'}</button>
          <Link to="/admin/assignments" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </>
  );
}
