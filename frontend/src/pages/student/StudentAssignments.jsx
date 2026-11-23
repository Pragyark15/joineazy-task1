import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, ErrorBox, Modal, PageHeader, ProgressBar, Spinner, fmtDate } from '../../components/ui.jsx';

function statusOf(a) {
  if (a.submitted) return { tone: 'green', label: 'Submitted' };
  const ms = new Date(a.dueDate) - Date.now();
  if (ms < 0) return { tone: 'red', label: 'Overdue' };
  if (ms < 2 * 864e5) return { tone: 'amber', label: 'Due soon' };
  return { tone: 'slate', label: 'Pending' };
}

// Two-step verification: (1) "Yes, I have submitted" -> (2) final confirm.
function ConfirmModal({ assignment, onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      await api.confirm(assignment.id);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal open title={step === 1 ? 'Have you submitted?' : 'Please confirm'} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        {step === 1
          ? <>Did you upload your group's work for <b>{assignment.title}</b> to the OneDrive link?</>
          : <>This tells your professor that your whole group has submitted <b>{assignment.title}</b>. It cannot be undone.</>}
      </p>
      <ErrorBox message={error} />
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>{step === 1 ? 'Not yet' : 'Cancel'}</button>
        {step === 1 ? (
          <button className="btn-primary" onClick={() => setStep(2)}>Yes, I have submitted</button>
        ) : (
          <button className="btn-primary" onClick={finish} disabled={busy}>{busy ? 'Confirming…' : 'Confirm submission'}</button>
        )}
      </div>
    </Modal>
  );
}

export default function StudentAssignments() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);

  const load = useCallback(() => {
    api.assignments().then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;
  const { assignments, progress, hasGroup } = data;

  return (
    <>
      <PageHeader title="Assignments" subtitle="Submit on OneDrive, then confirm for your group." />

      {!hasGroup && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You are not in a group yet — you need one to confirm submissions.{' '}
          <Link to="/student/group" className="font-semibold underline">Create or join a group</Link>
        </div>
      )}

      <div className="card mb-6">
        <ProgressBar percent={progress.percent} label={`Group progress · ${progress.submitted} of ${progress.total} confirmed`} />
        {progress.total > 0 && progress.submitted === progress.total && (
          <p className="mt-3"><Badge tone="green">🎉 All assignments submitted</Badge></p>
        )}
      </div>

      {assignments.length === 0 ? (
        <p className="py-12 text-center text-slate-500">No assignments yet. Check back later.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map((a) => {
            const st = statusOf(a);
            return (
              <article key={a.id} className="card flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{a.title}</h3>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="mt-2 flex-1 whitespace-pre-line text-sm text-slate-600">{a.description || 'No description.'}</p>
                <p className="mt-3 text-xs text-slate-500">Due {fmtDate(a.dueDate)}</p>
                {a.submitted && (
                  <p className="mt-1 text-xs text-emerald-700">
                    ✓ Confirmed by {a.confirmedBy} on {fmtDate(a.confirmedAt)}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={a.onedriveLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                    Open OneDrive link ↗
                  </a>
                  {!a.submitted && (
                    <button className="btn-primary" disabled={!hasGroup} onClick={() => setTarget(a)}
                      title={hasGroup ? '' : 'Join a group first'}>
                      Mark as submitted
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {target && (
        <ConfirmModal
          assignment={target}
          onClose={() => setTarget(null)}
          onDone={() => { setTarget(null); load(); }}
        />
      )}
    </>
  );
}
