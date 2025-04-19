// src/layouts/AppLayout.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  useMediaQuery,
  createTheme,
  ThemeProvider,
  PaletteMode
} from '@mui/material';

// --- Constants ---

// Define props for AppLayout - it needs to render children components
interface AppLayoutProps {
  children: React.ReactNode; // To render content passed into it
}

function AppLayout({ children }: AppLayoutProps) {
  // --- Theme Mode Detection & State ---
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<PaletteMode>(prefersDarkMode ? 'dark' : 'light');

  useEffect(() => {
    setMode(prefersDarkMode ? 'dark' : 'light');
  }, [prefersDarkMode]);

  // --- Theme Creation (Memoized) ---
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
        },
      }),
    [mode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              Medical Entity Extraction
            </Typography>
            {/* Optional: Theme toggle button */}
          </Toolbar>
        </AppBar>

        {/* The Drawer (Sidebar) will be rendered by the parent (App.tsx) */}
        {/* Or potentially passed as a prop if you prefer */}

        {/* Main Content Area Wrapper */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            // p: 3, // Padding might be applied by children or here
            height: '100vh',
            overflow: 'auto', // Allow content to scroll independently
          }}
        >
          <Toolbar /> {/* Spacer to push content below AppBar */}
          {/* Render the children components passed from App.tsx */}
          <Box sx={{ p: 3 }}> {/* Add padding around the main content */}
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default AppLayout;