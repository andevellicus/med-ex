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
  PaletteMode,
} from '@mui/material';
import CollapseToggleButton from '../components/CollapseToggleButton'; 

// --- Constants ---
// Define props for AppLayout - it needs to render children components
interface AppLayoutProps {
  children: React.ReactNode; // To render content passed into it
  isControlsCollapsed: boolean;
  toggleControlsCollapse: () => void;
  isEntitiesCollapsed: boolean;
  toggleEntitiesCollapse: () => void;
}

function AppLayout({ 
  children,
  isControlsCollapsed,
  toggleControlsCollapse,
  isEntitiesCollapsed,
  toggleEntitiesCollapse,
 }: AppLayoutProps) {
  // --- Theme Mode Detection & State ---
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<PaletteMode>(prefersDarkMode ? 'dark' : 'light');

  useEffect(() => {
    setMode(prefersDarkMode ? 'dark' : 'light');
  }, [prefersDarkMode]);

  // --- Theme Creation (Memoized) ---
  const theme = useMemo(
    () => createTheme({ palette: { mode }}),
    [mode],
  );

  const appBarHeight = theme.mixins.toolbar.minHeight || 64;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar
          position="fixed"
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Toolbar>
            {/* Collapse Button for Controls Sidebar */}
              <CollapseToggleButton
                isCollapsed={isControlsCollapsed}
                onClick={toggleControlsCollapse}
                ariaLabel={isControlsCollapsed ? "Expand controls sidebar" : "Collapse controls sidebar"}
                tooltipPlacement="bottom"
                sideBarSide='left'
                sx={{ mr: 1 }}
            />
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, textAlign: 'center' }}>
              Medical Entity Extraction
            </Typography>
                <CollapseToggleButton
                  isCollapsed={isEntitiesCollapsed}
                  onClick={toggleEntitiesCollapse}
                  ariaLabel={isEntitiesCollapsed ? "Expand entities sidebar" : "Collapse entities sidebar"}
                  tooltipPlacement="bottom"
                  sideBarSide='right'
                  sx={{ ml: 1 }}
              />
          </Toolbar>
        </AppBar>

        {/* Main Content Area Wrapper */}
        <Box
          component="main"
            sx={{
                height: `calc(100vh - ${appBarHeight}px)`, // Calculate remaining height
                mt: `${appBarHeight}px`, // Keep margin-top for spacing below fixed AppBar
                overflow: 'hidden', // Keep hiding overflow here
            }}
        >
          {/* Render the children components passed from App.tsx */}
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default AppLayout;