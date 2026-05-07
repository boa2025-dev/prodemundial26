import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08090f' }}>
        <div className="spinner-lg" />
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
