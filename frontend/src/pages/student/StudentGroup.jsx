import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, ErrorBox, PageHeader, Spinner } from '../../components/ui.jsx';

function CreateGroup({ onCreated }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Accept emails or IDs separated by commas / spaces / newlines.
      const list = members.split(/[\s,;]+/).filter(Boolean);
      await api.createGroup({ name, members: list });
      onCreated();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card max-w-xl space-y-4">
      <h2 className="font-semibold">Create a group</h2>
      <ErrorBox message={error} />
      <div>
        <label className="label" htmlFor="gname">Group name</label>
        <input id="gname" required minLength={2} className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="gmembers">Add members (student email or ID, optional)</label>
        <textarea id="gmembers" rows={3} className="input" value={members} onChange={(e) => setMembers(e.target.value)}
          placeholder="diya@student.com, 4" />
        <p className="mt-1 text-xs text-slate-500">Separate with commas. You can also add members later.</p>
      </div>
      <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button>
    </form>
  );
}

export default function StudentGroup() {
  const { user } = useAuth();
  const [group, setGroup] = useState(undefined);
  const [ident, setIdent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.myGroup().then((r) => setGroup(r.group)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try { await fn(); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (group === undefined && !error) return <Spinner />;
  if (!group) {
    return (
      <>
        <PageHeader title="My Group" subtitle="You're not in a group yet." />
        <ErrorBox message={error} />
        <div className="mt-4"><CreateGroup onCreated={load} /></div>
      </>
    );
  }

  const isOwner = group.ownerId === user.id;
  const add = (e) => {
    e.preventDefault();
    run(async () => { await api.addMember(group.id, ident); setIdent(''); });
  };

  return (
    <>
      <PageHeader title={group.name} subtitle={`${group.members.length} member${group.members.length === 1 ? '' : 's'}`}>
        {isOwner ? (
          <button className="btn-danger" disabled={busy}
            onClick={() => window.confirm('Delete this group? Its submission history will be removed.') && run(() => api.deleteGroup(group.id))}>
            Delete group
          </button>
        ) : (
          <button className="btn-secondary" disabled={busy}
            onClick={() => window.confirm('Leave this group?') && run(() => api.removeMember(group.id, user.id))}>
            Leave group
          </button>
        )}
      </PageHeader>
      <ErrorBox message={error} />

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Members</h2>
          <ul className="divide-y divide-slate-100">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.name} {m.id === user.id && <span className="text-slate-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{m.email} · ID {m.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.isOwner && <Badge tone="blue">Owner</Badge>}
                  {isOwner && !m.isOwner && (
                    <button className="text-xs font-medium text-red-600 hover:underline" disabled={busy}
                      onClick={() => run(() => api.removeMember(group.id, m.id))}>Remove</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {isOwner && (
          <form onSubmit={add} className="card h-fit space-y-3">
            <h2 className="font-semibold">Add a member</h2>
            <label className="label" htmlFor="ident">Student email or ID</label>
            <input id="ident" required className="input" value={ident} onChange={(e) => setIdent(e.target.value)}
              placeholder="isha@student.com" />
            <button className="btn-primary" disabled={busy}>Add to group</button>
            <p className="text-xs text-slate-500">The student must already be registered and not in another group.</p>
          </form>
        )}
      </div>
    </>
  );
}
