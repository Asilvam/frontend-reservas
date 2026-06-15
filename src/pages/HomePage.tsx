import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import '../styles/home-page.css';

export function HomePage() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(localStorage.getItem('accessToken'));

  return (
    <Box className="home-layout">
      <Paper elevation={2} className="home-card">
        <Stack spacing={2}>
          <Typography variant="h4" className="home-title">
            Sistema de Reservas
          </Typography>
          <Typography color="text.secondary" className="home-copy">
            Revisa los bloques disponibles y confirma tu asistencia de forma segura.
          </Typography>

          {isLoggedIn ? (
            <Button variant="contained" onClick={() => navigate('/dashboard')} className="home-primary-btn">
              Ir al dashboard
            </Button>
          ) : (
            <Typography className="home-register-hint">
              Si no estas registrado, completa el formulario de inscripcion de apoderado y cargas.
            </Typography>
          )}

          <Button variant="outlined" color="inherit" onClick={() => navigate('/register')} className="home-secondary-btn">
            Formulario de inscripcion
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default HomePage;
