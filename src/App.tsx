import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppNavbar from './components/AppNavbar';
import ProtectedLayout from './components/ProtectedLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SelvaPage from './pages/SelvaPage';
import IcePage from './pages/IcePage';

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
  const showNavbar =
    location.pathname !== '/home' &&
    location.pathname !== '/selva' &&
    location.pathname !== '/hielo' &&
    location.pathname !== '/selva/register' &&
    location.pathname !== '/register';

  return (
    <>
      {showNavbar ? <AppNavbar /> : null}
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Navigate to="/selva" replace />} />
        <Route path="/selva" element={<SelvaPage />} />
        <Route path="/hielo" element={<IcePage />} />
        {/*<Route path="/hielo" element={<Navigate to="/home" replace />} />*/}
        <Route path="/selva/register" element={<Navigate to="/selva" replace />} />
        <Route path="/register" element={<Navigate to="/selva" replace />} />
        <Route
          element={(
            <RequireAuth>
              <ProtectedLayout />
            </RequireAuth>
          )}
        >
          <Route
            path="/guardians/new"
            element={<Navigate to="/selva" replace />}
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
