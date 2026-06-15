import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/app-navbar.css';

export function AppNavbar() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isLoggedIn = Boolean(localStorage.getItem('accessToken'));

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    handleCloseMenu();
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    handleCloseMenu();
    navigate('/login', { replace: true });
  };

  return (
    <AppBar position="sticky" elevation={0} className="app-navbar">
      <Toolbar className="app-navbar-toolbar">
        <Typography variant="h6" className="app-navbar-title">
          Reservas
        </Typography>

        <Box>
          <IconButton color="inherit" onClick={handleOpenMenu} aria-label="Abrir menu">
            <MenuIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
            {isLoggedIn ? <MenuItem onClick={handleLogout}>Cerrar sesion</MenuItem> : null}
            {!isLoggedIn ? <MenuItem onClick={() => handleNavigate('/login')}>Login</MenuItem> : null}
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default AppNavbar;
