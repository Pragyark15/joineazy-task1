import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBox } from '../components/ui.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', adminCode: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = { ...form };
      if (form.role !== 'admin') delete payload.adminCode;
      const user = await register(payload);
      navigate(user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-brand-600">Create your account</h1>
        <ErrorBox message={error} />
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
          {['student', 'admin'].map((r) => (
            <button key={r} type="button" role="radio" aria-checked={form.role === r}
              onClick={() => setForm({ ...form, role: r })}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${form.role === r ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'}`}>
              {r === 'admin' ? 'Professor' : 'Student'}
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" required minLength={2} className="input" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password (min 6 characters)</label>
          <input id="password" type="password" required minLength={6} className="input" value={form.password} onChange={set('password')} />
        </div>
        {form.role === 'admin' && (
          <div>
            <label className="label" htmlFor="code">Professor signup code</label>
            <input id="code" required className="input" value={form.adminCode} onChange={set('adminCode')} placeholder="Provided by your institution" />
          </div>
        )}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Register'}</button>
        <p className="text-center text-sm text-slate-500">
          Already registered? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
