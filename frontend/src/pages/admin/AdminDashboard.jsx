import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api/client.js';
import { ErrorBox, PageHeader, ProgressBar, Spinner, StatCard } from '../../components/ui.jsx';

const short = (s) => (s.length > 14 ? `${s.slice(0, 13)}…` : s);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.analytics().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;
  const { summary, assignments, groups } = data;
  const pie = [
    { name: 'Confirmed', value: summary.totalSubmitted, color: '#10b981' },
    { name: 'Pending', value: summary.totalExpected - summary.totalSubmitted, color: '#f59e0b' },
  ];
  const chartData = assignments.map((a) => ({ name: short(a.title), Submitted: a.submitted, Pending: a.pending }));
  const ranked = [...groups].sort((a, b) => b.percent - a.percent);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Submission progress across all groups">
        <Link to="/admin/assignments/new" className="btn-primary">+ New assignment</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assignments" value={summary.assignments} hint={`${summary.overdue} past due`} />
        <StatCard label="Groups" value={summary.groups} />
        <StatCard label="Students" value={summary.students} />
        <StatCard label="Completion" value={`${summary.completionRate}%`} hint={`${summary.totalSubmitted}/${summary.totalExpected} confirmations`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-4 font-semibold">Submissions per assignment</h2>
          {assignments.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No assignments yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Submitted" stackId="a" fill="#10b981" />
                  <Bar dataKey="Pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="mb-4 font-semibold">Overall status</h2>
          {summary.totalExpected === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nothing to track yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="mb-4 font-semibold">Group performance</h2>
        {ranked.length === 0 ? (
          <p className="text-sm text-slate-500">No groups have been formed yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ranked.map((g) => (
              <div key={g.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{g.name} <span className="text-xs text-slate-400">· {g.members} members</span></span>
                  <span className="text-xs text-slate-500">{g.submitted}/{g.targeted}</span>
                </div>
                <ProgressBar percent={g.percent} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
