import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppNavbar from './components/AppNavbar';
import DashboardPage from './pages/DashboardPage';
import ProtectedLayout from './components/ProtectedLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterGuardianPage from './pages/RegisterGuardianPage';
import SelvaPage from './pages/SelvaPage';

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

function RequireAuth({ children }: { children: ReactElement }) {
  const token = localStorage.getItem('accessToken');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!token) return;

    let timeoutId: number;
    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];

    const resetInactivityTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        localStorage.removeItem('accessToken');
        navigate('/login', { replace: true, state: { reason: 'timeout' } });
      }, INACTIVITY_TIMEOUT_MS);
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer));
    };
  }, [location.pathname, navigate, token]);

  const redirectTo = `${location.pathname}${location.search}`;

  return token ? children : <Navigate to="/login" replace state={{ redirectTo }} />;
}

function App() {
  const token = localStorage.getItem('accessToken');
  const location = useLocation();
  const showNavbar = location.pathname !== '/home' && location.pathname !== '/selva';

  return (
    <>
      {showNavbar ? <AppNavbar /> : null}
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/selva" element={<SelvaPage />} />
        <Route
          path="/register"
          element={
            token ? <Navigate to="/guardians/new" replace /> : <RegisterGuardianPage />
          }
        />
        <Route
          element={(
            <RequireAuth>
              <ProtectedLayout />
            </RequireAuth>
          )}
        >
          <Route
            path="/guardians/new"
            element={<RegisterGuardianPage />}
          />
        </Route>
        <Route
          path="*"
          element={
            token ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/home" replace />
            )
          }
        />
      </Routes>
    </>
  );
}

export default App;
