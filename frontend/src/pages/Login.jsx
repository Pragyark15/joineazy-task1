import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBox } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form);
      navigate(user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fill = (email) => setForm({ email, password: 'password123' });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-3xl font-bold text-brand-600">Joineazy</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Group assignment management</p>
        <form onSubmit={submit} className="card space-y-4">
          <h2 className="text-lg font-semibold">Sign in</h2>
          <ErrorBox message={error} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required className="input" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="text-center text-sm text-slate-500">
            New here? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link>
          </p>
        </form>
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/60 p-3 text-xs text-slate-500">
          <p className="mb-2 font-medium text-slate-600">Demo accounts (password: password123)</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => fill('professor@joineazy.com')}>Professor</button>
            <button type="button" className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => fill('aarav@student.com')}>Student (Aarav)</button>
            <button type="button" className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => fill('isha@student.com')}>Student (no group)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
