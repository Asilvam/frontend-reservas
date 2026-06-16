import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { api } from '../services/api';
import type { Guardian, LoginResponse } from '../types';
import '../styles/login-page.css';
import { useEffect } from 'react';

function getTokenPayload(token: string) {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;

    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payloadJson) as {
      role?: string;
      guardianId?: string;
    };
  } catch {
    return null;
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((location.state as { reason?: string } | null)?.reason !== 'timeout') return;

    void Swal.fire({
      icon: 'info',
      title: 'Sesion cerrada',
      text: 'Tu sesion cerro por inactividad.',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#1E3A8A',
    });

    navigate('/login', { replace: true, state: null });
  }, [location.state, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.removeItem('guardianProfile');

      const tokenPayload = getTokenPayload(data.accessToken);
      if (tokenPayload?.role === 'admin') {
        await Swal.fire({
          icon: 'info',
          title: 'Acceso administrador',
          text: 'Tu usuario tiene rol admin. Pronto sera redirigido a su pagina exclusiva.',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#1E3A8A',
        });
      }

      if (tokenPayload?.role === 'guardian' && tokenPayload.guardianId) {
        try {
          const guardianResponse = await api.get<Guardian>(`/guardians/${tokenPayload.guardianId}`, {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          });

          localStorage.setItem('guardianProfile', JSON.stringify(guardianResponse.data));
        } catch {
          void Swal.fire({
            icon: 'info',
            title: 'Perfil pendiente',
            text: 'Iniciaste sesion, pero aun no tienes un perfil de apoderado asociado.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1E3A8A',
          });
        }
      } else if (tokenPayload?.role === 'guardian') {
        void Swal.fire({
          icon: 'info',
          title: 'Token sin guardianId',
          text: 'El token no incluye guardianId, no se pudo cargar el perfil.',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#1E3A8A',
        });
      }

      navigate(redirectTo || '/selva', { replace: true });
    } catch {
      void Swal.fire({
        icon: 'error',
        title: 'No se pudo iniciar sesion',
        text: 'Credenciales invalidas. Intenta nuevamente.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#1E3A8A',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="login-layout">
      <Paper elevation={3} className="login-card">
        <Typography variant="h5" className="login-title">
          Iniciar sesion
        </Typography>
        <Typography variant="body2" color="text.secondary" className="login-subtitle">
          Accede para reservar horarios.
        </Typography>

        <Stack component="form" spacing={2} onSubmit={handleLogin} className="login-form">
          <TextField
            type="email"
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
          <TextField
            type="password"
            label="Contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" variant="contained" disabled={loading} className="login-submit-btn">
            {loading ? 'Ingresando...' : 'Entrar'}
          </Button>

        </Stack>
      </Paper>
    </Box>
  );
}

export default LoginPage;
