import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import App from './App.tsx'

const theme = createTheme({
  palette: {
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    primary: {
      main: '#1E3A8A',
      light: '#3B82F6',
      dark: '#172554',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#93C5FD',
      light: '#DBEAFE',
      contrastText: '#1E3A8A',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 700,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
