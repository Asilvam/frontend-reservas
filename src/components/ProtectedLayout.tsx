import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

export function ProtectedLayout() {
  return (
    <Box>
      <Outlet />
    </Box>
  );
}

export default ProtectedLayout;
