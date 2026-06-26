import { Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import fondoImage from '../assets/Fondo.jpg';
import institutionalLogos from '../assets/logos.png';
import mainLogo from '../assets/logo.png';
import hieloCard from '../assets/BotonPistadehielo.png';
import superiorAlcaldia from '../assets/superioralcaldia.png';
import '../styles/home-page.css';

export function HomePage() {
  const navigate = useNavigate();
  // const isLoggedIn = Boolean(localStorage.getItem('accessToken'));

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

      <Box className="home-campaigns-grid">
        <Box className="home-campaign-card home-campaign-card-active">
          <Box component="img" className="home-campaign-image" src={hieloCard} alt="Campana Pista de Hielo" />
          <Button
            variant="contained"
            className="home-campaign-btn"
            onClick={() => navigate('/hielo')}
          >
            Reservar Pista de Hielo
          </Button>
        </Box>

      </Box>

      <Box className="home-footer-logos-wrap">
        <Box component="img" src={institutionalLogos} alt="Logos institucionales" className="home-footer-logos" />
      </Box>

    </Box>
  );
}

export default HomePage;
