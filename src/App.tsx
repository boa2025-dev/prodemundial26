import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Predictions from './pages/Predictions';
import Admin from './pages/Admin';
import Acerca from './pages/Acerca';
import Contacto from './pages/Contacto';
import Privacidad from './pages/Privacidad';
import AvisoLegal from './pages/AvisoLegal';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/acerca" element={<Acerca />} />
      <Route path="/contacto" element={<Contacto />} />
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="/aviso-legal" element={<AvisoLegal />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/predictions" element={<ProtectedRoute><Predictions /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
