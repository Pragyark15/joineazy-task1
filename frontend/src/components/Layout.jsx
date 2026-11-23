import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = {
  student: [
    { to: '/student', label: 'Assignments', end: true },
    { to: '/student/group', label: 'My Group' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/assignments', label: 'Assignments' },
  ],
};

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-brand-600">Joineazy</span>
            <nav className="hidden gap-1 md:flex">
              {links[user.role].map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>
              ))}
            </nav>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <div className="text-right text-sm leading-tight">
              <p className="font-medium text-slate-800">{user.name}</p>
              <p className="text-xs capitalize text-slate-500">{user.role === 'admin' ? 'Professor' : 'Student'}</p>
            </div>
            <button onClick={onLogout} className="btn-secondary">Log out</button>
          </div>
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d={open ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
        {open && (
          <div className="space-y-1 border-t border-slate-200 px-4 py-3 md:hidden">
            {links[user.role].map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            <p className="px-3 pt-2 text-xs text-slate-500">{user.name} · {user.email}</p>
            <button onClick={onLogout} className="btn-secondary w-full">Log out</button>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
