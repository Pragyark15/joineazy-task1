import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import StudentAssignments from './pages/student/StudentAssignments.jsx';
import StudentGroup from './pages/student/StudentGroup.jsx';
import AdminAssignments from './pages/admin/AdminAssignments.jsx';
import AssignmentForm from './pages/admin/AssignmentForm.jsx';
import AssignmentDetail from './pages/admin/AssignmentDetail.jsx';

// Recharts is heavy; only professors need it, so load the dashboard on demand.
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));

const home = (user) => (user.role === 'admin' ? '/admin' : '/student');

// Gate a route by auth state and (optionally) role.
function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={home(user)} replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to={home(user)} replace /> : children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

      <Route path="/student" element={<Protected role="student"><StudentAssignments /></Protected>} />
      <Route path="/student/group" element={<Protected role="student"><StudentGroup /></Protected>} />

      <Route path="/admin" element={<Protected role="admin"><Suspense fallback={<Spinner />}><AdminDashboard /></Suspense></Protected>} />
      <Route path="/admin/assignments" element={<Protected role="admin"><AdminAssignments /></Protected>} />
      <Route path="/admin/assignments/new" element={<Protected role="admin"><AssignmentForm /></Protected>} />
      <Route path="/admin/assignments/:id" element={<Protected role="admin"><AssignmentDetail /></Protected>} />
      <Route path="/admin/assignments/:id/edit" element={<Protected role="admin"><AssignmentForm /></Protected>} />

      <Route path="*" element={<Navigate to={user ? home(user) : '/login'} replace />} />
    </Routes>
  );
}
