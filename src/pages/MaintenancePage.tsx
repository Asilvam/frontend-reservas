import { HourglassEmpty } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fondoImage from '../assets/Fondo.jpg';
import institutionalLogos from '../assets/logos.png';
import mainLogo from '../assets/logo.png';
import superiorAlcaldia from '../assets/superioralcaldia.png';
import '../styles/home-page.css';
import '../styles/maintenance-page.css';

const RETRY_DELAY_SEQUENCE_SECONDS = [10, 30, 60, 90, 120];
const RETRY_DELAY_INDEX_KEY = 'iceMaintenanceRetryDelayIndex';

function getRetryDelayIndex() {
  const savedIndex = Number(window.sessionStorage.getItem(RETRY_DELAY_INDEX_KEY) ?? 0);
  if (!Number.isFinite(savedIndex) || savedIndex < 0) return 0;
  return Math.min(savedIndex, RETRY_DELAY_SEQUENCE_SECONDS.length - 1);
}

function advanceRetryDelayIndex(currentIndex: number) {
  const nextIndex = Math.min(currentIndex + 1, RETRY_DELAY_SEQUENCE_SECONDS.length - 1);
  window.sessionStorage.setItem(RETRY_DELAY_INDEX_KEY, String(nextIndex));
}

export function MaintenancePage() {
  const navigate = useNavigate();
  const [retryDelayIndex] = useState(getRetryDelayIndex);
  const [remainingSeconds, setRemainingSeconds] = useState(
    RETRY_DELAY_SEQUENCE_SECONDS[retryDelayIndex],
  );

  useEffect(() => {
    advanceRetryDelayIndex(retryDelayIndex);
  }, [retryDelayIndex]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const canRetry = remainingSeconds === 0;

  return (
    <Box
      className="home-layout"
      style={{
        backgroundImage: `url(${fondoImage})`,
      }}
    >
      <Box className="home-header-wrap">
        <Box component="img" src={superiorAlcaldia} alt="Superior Alcaldia" className="home-header-image" />
        <Box component="img" src={mainLogo} alt="Llueve en Quilicura" className="home-main-logo" />
      </Box>

      <Box className="maintenance-react-wrap">
        <Box className="maintenance-react-card" role="status" aria-live="polite">
          <HourglassEmpty className="maintenance-react-icon" />
          <Typography component="h1" className="maintenance-react-title">
            Tenemos una alta demanda de cupos
          </Typography>
          <Typography className="maintenance-react-copy">
            Podrás volver a intentar ingresar a la inscripción en unos segundos.
          </Typography>
          <Box className="maintenance-react-countdown">
            {canRetry ? 'Listo para intentar nuevamente' : `${remainingSeconds}s`}
          </Box>
          <Button
            variant="contained"
            className="maintenance-react-button"
            disabled={!canRetry}
            onClick={() => navigate('/hielo', { replace: true })}
          >
            Volver a intentar inscripción
          </Button>
          <Button
            variant="text"
            className="maintenance-react-home-button"
            onClick={() => {
              window.sessionStorage.removeItem(RETRY_DELAY_INDEX_KEY);
              navigate('/home', { replace: true });
            }}
          >
            Ir al inicio
          </Button>
        </Box>
      </Box>

      <Box className="home-footer-logos-wrap">
        <Box component="img" src={institutionalLogos} alt="Logos institucionales" className="home-footer-logos" />
      </Box>
    </Box>
  );
}

export default MaintenancePage;
