// src/App.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    CssBaseline,
    Paper,
    SelectChangeEvent,
    useMediaQuery,
    createTheme,
    ThemeProvider,
    PaletteMode,
    IconButton, // For collapse buttons
    Tooltip
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { useSchemas } from './hooks/useSchemas';
import ControlsSidebar from './components/ControlsSidebar';
import ResultsDisplay from './components/ResultsDisplay';
import EntitiesSidebar from './components/EntitiesSidebar'; // Import the new component
import { ExtractionResult, ScrollTarget } from './types';

// --- Constants ---
const controlsSidebarWidth = 280;
const entitiesSidebarWidth = 320; // Adjust as needed

function App() {
    // --- Schema State (Existing) ---
    const { schemas, isLoadingSchemas, schemaError } = useSchemas();
    const [selectedSchema, setSelectedSchema] = useState<string>('');

    // --- Extraction State (Existing) ---
    const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);

    // --- Sidebar State ---
    const [isControlsOpen, setIsControlsOpen] = useState(true);
    const [isEntitiesOpen, setIsEntitiesOpen] = useState(true);

    // --- Scrolling State ---
    const [scrollToTarget, setScrollToTarget] = useState<ScrollTarget | null>(null);

    // --- Theme State & Logic (Existing) ---
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const [mode, setMode] = useState<PaletteMode>(() => prefersDarkMode ? 'dark' : 'light');
    useEffect(() => { setMode(prefersDarkMode ? 'dark' : 'light'); }, [prefersDarkMode]);
    const theme = useMemo(() => createTheme({
        palette: { mode },
        transitions: { // Add transitions for smooth sidebar collapse
            easing: {
                sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
            },
            duration: {
                enteringScreen: 225,
                leavingScreen: 195,
            },
        },
    }), [mode]);


    // --- Effect for default schema (Existing) ---
    useEffect(() => {
        if (!isLoadingSchemas && schemas.length > 0 && !selectedSchema) { setSelectedSchema(schemas[0]); }
        if (!isLoadingSchemas && schemas.length === 0) { setSelectedSchema(''); }
    }, [schemas, isLoadingSchemas, selectedSchema]);

    // --- Handlers (Existing + New Scroll Handler) ---
    const handleSchemaChange = (event: SelectChangeEvent<string>) => {
        setSelectedSchema(event.target.value as string);
        setExtractionResult(null);
        setExtractionError(null);
    };

    const handleExtractStart = () => {
        setIsExtracting(true);
        setExtractionResult(null);
        setExtractionError(null);
        setScrollToTarget(null); // Reset scroll target on new extraction
    };

    const handleExtractComplete = (result: ExtractionResult) => {
        setIsExtracting(false);
        setExtractionResult(result);
         // Automatically open entities sidebar on successful extraction if it was closed
        if (!isEntitiesOpen && Object.keys(result.entities).length > 0) {
            setIsEntitiesOpen(true);
        }
    };

    const handleExtractError = (error: string) => {
        setIsExtracting(false);
        setExtractionError(error);
    };

    // Callback for entity list item click
    const handleScrollToEntity = useCallback((entityId: string) => {
         console.log("App: Scrolling to", entityId);
         setScrollToTarget({ id: entityId, timestamp: Date.now() }); // Update target
         // Ensure entities sidebar doesn't close when clicking an item
         // (optional, depends on desired UX)
         if (!isEntitiesOpen) setIsEntitiesOpen(true);
    }, []);

     // Reset scroll target after it's been processed by ResultsDisplay
    const handleScrollComplete = useCallback(() => {
        // console.log("App: Resetting scroll target");
        setScrollToTarget(null); // Can cause issues if effect runs multiple times
    }, []);


    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {/* Main Flex Container */}
            <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>

                {/* --- Controls Sidebar --- */}
                <Paper
                    elevation={2}
                    square
                    sx={{
                        width: isControlsOpen ? controlsSidebarWidth : 0,
                        flexShrink: 0,
                        overflowX: 'hidden', // Hide content when collapsed
                        overflowY: 'auto',
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        transition: theme.transitions.create('width', { // Smooth transition
                            easing: theme.transitions.easing.sharp,
                            duration: isControlsOpen ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
                        }),
                    }}
                >
                    {/* Pass toggle state down */}
                    <ControlsSidebar
                        schemas={schemas}
                        selectedSchema={selectedSchema}
                        isLoadingSchemas={isLoadingSchemas}
                        schemaError={schemaError}
                        onSchemaChange={handleSchemaChange}
                        isExtracting={isExtracting}
                        onExtractStart={handleExtractStart}
                        onExtractComplete={handleExtractComplete}
                        onExtractError={handleExtractError}
                    />
                </Paper>

                {/* Toggle Button - Placed absolutely within the Paper */}
                <Tooltip title={isControlsOpen ? "Collapse Controls" : "Expand Controls"} placement="right">
                    <IconButton
                        onClick={() => setIsControlsOpen(!isControlsOpen)}
                        sx={{
                            position: 'absolute', // Position relative to the main flex Box
                            top: 8,
                            left: isControlsOpen ? controlsSidebarWidth - 16 : 8, // Adjust left based on state
                            zIndex: theme.zIndex.drawer + 1, // Ensure it's above sidebars
                            backgroundColor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                            transition: theme.transitions.create('right', { // Animate position
                                easing: theme.transitions.easing.sharp,
                                duration: theme.transitions.duration.enteringScreen, // Use entering duration for consistency
                            }),
                            '&:hover': { backgroundColor: 'action.selected' }
                        }}
                        size="small"
                    >
                        {isControlsOpen ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>

                {/* --- Main Content Area (Highlighted Text) --- */}
                <Box
                    component="main"
                    sx={{
                        flexGrow: 1,
                        p: 3,
                        overflowY: 'auto', // Allow text area to scroll
                        height: '100vh', // Ensure it takes full height
                        bgcolor: 'background.default',
                        position: 'relative', // For entity toggle button positioning
                    }}
                >
                    {/* ResultsDisplay now primarily handles the highlighted text */}
                    <ResultsDisplay
                        extractionResult={extractionResult}
                        isExtracting={isExtracting}
                        extractionError={extractionError}
                        scrollToTarget={scrollToTarget} // Pass down scroll target
                        onScrollComplete={handleScrollComplete} // Pass down callback
                    />
                </Box>

                {/* --- Entities Sidebar --- */}
                <Paper
                    elevation={2}
                    square
                    sx={{
                        width: isEntitiesOpen ? entitiesSidebarWidth : 0,
                        flexShrink: 0,
                        overflowX: 'hidden', // Hide content when collapsed
                        overflowY: 'auto',
                        borderLeft: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        // position: 'relative', // For positioning the toggle button
                        transition: theme.transitions.create('width', { // Smooth transition
                            easing: theme.transitions.easing.sharp,
                            duration: isEntitiesOpen ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
                        }),
                    }}
                >
                    {isEntitiesOpen && (
                         <EntitiesSidebar
                             extractionResult={extractionResult}
                             isExtracting={isExtracting} // Pass loading state
                             onEntityClick={handleScrollToEntity} // Pass down callback
                         />
                    )}
                </Paper>

                {/* Toggle Button - Placed absolutely */}
                <Tooltip title={isEntitiesOpen ? "Collapse Entities" : "Expand Entities"} placement="left">
                    <IconButton
                        onClick={() => setIsEntitiesOpen(!isEntitiesOpen)}
                        sx={{
                            position: 'absolute',
                            top: 8,
                            right: isEntitiesOpen ? entitiesSidebarWidth - 16 : 8, // Adjust right based on state
                            zIndex: theme.zIndex.drawer + 1, // Ensure it's above sidebars
                            backgroundColor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                            transition: theme.transitions.create('right', { // Animate position
                                easing: theme.transitions.easing.sharp,
                                duration: theme.transitions.duration.enteringScreen, // Use entering duration for consistency
                            }),
                            '&:hover': { backgroundColor: 'action.selected' }
                        }}
                        size="small"
                    >
                        {isEntitiesOpen ? <MenuOpenIcon fontSize="small" sx={{ transform: 'scaleX(-1)' }} /> : <MenuIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
            </Box>
        </ThemeProvider>
    );
}

export default App;