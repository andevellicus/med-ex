// src/App.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
// Make sure you are importing from the correct package you installed
import { SplitPane } from '@rexxars/react-split-pane';
import {
    Box,
    CssBaseline,
    SelectChangeEvent,
    useMediaQuery,
    createTheme,
    ThemeProvider,
    PaletteMode,
    Paper,
} from '@mui/material';
import { useSchemas } from './hooks/useSchemas';
import ControlsSidebar from './components/ControlsSidebar';
import ResultsDisplay from './components/ResultsDisplay';
import EntitiesSidebar from './components/EntitiesSidebar';
import { ExtractionResult, ScrollTarget } from './types';

// Default sizes for panes (pixels)
const defaultControlsWidth = 280;
const defaultEntitiesWidth = 320; // Used for calculating default results width
const defaultResultsWidth = 600; // Fallback default width for results pane
const minPaneWidth = 150; // Minimum width for any pane

function App() {
    // --- State ---
    const { schemas, isLoadingSchemas, schemaError } = useSchemas();
    const [selectedSchema, setSelectedSchema] = useState<string>('');
    const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [scrollToTarget, setScrollToTarget] = useState<ScrollTarget | null>(null);
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const [mode, setMode] = useState<PaletteMode>(() => prefersDarkMode ? 'dark' : 'light');

    // --- Theme ---
    useEffect(() => { setMode(prefersDarkMode ? 'dark' : 'light'); }, [prefersDarkMode]);
    const theme = useMemo(() => createTheme({ palette: { mode } }), [mode]);

    // --- Effect for default schema ---
    useEffect(() => {
        if (!isLoadingSchemas && schemas.length > 0 && !selectedSchema) { setSelectedSchema(schemas[0]); }
        if (!isLoadingSchemas && schemas.length === 0) { setSelectedSchema(''); }
    }, [schemas, isLoadingSchemas, selectedSchema]);

    // --- Handlers ---
    const handleSchemaChange = (event: SelectChangeEvent<string>) => {
        setSelectedSchema(event.target.value as string);
        setExtractionResult(null);
        setExtractionError(null);
    };

    const handleExtractStart = () => {
        setIsExtracting(true);
        setExtractionResult(null);
        setExtractionError(null);
        setScrollToTarget(null);
    };

    const handleExtractComplete = (result: ExtractionResult) => {
        setIsExtracting(false);
        setExtractionResult(result);
    };

    const handleExtractError = (error: string) => {
        setIsExtracting(false);
        setExtractionError(error);
    };

    const handleScrollToEntity = useCallback((entityId: string) => {
        setScrollToTarget({ id: entityId, timestamp: Date.now() });
    }, []);

    const handleScrollComplete = useCallback(() => {
        // Optional: Reset scroll target if needed
        // setScrollToTarget(null);
    }, []);

    // --- Pane Size State & Persistence ---
    // Initialize state with number type, parsing from localStorage
    const [controlsSize, setControlsSize] = useState<number>(() => {
        const saved = localStorage.getItem('splitPosControls');
        // Parse the stored string (base 10), provide default number if null or invalid (NaN)
        const parsed = saved ? parseInt(saved, 10) : NaN;
        return isNaN(parsed) ? defaultControlsWidth : parsed;
    });

    // Initialize resultsSize state with number type (pixels)
    const [resultsSize, setResultsSize] = useState<number>(() => {
        const saved = localStorage.getItem('splitPosResults'); // Store/retrieve pixel value
        const parsed = saved ? parseInt(saved, 10) : NaN;

        // Try to calculate a sensible default based on other panes if needed
        // Note: window.innerWidth might not be fully accurate on initial render in some setups
        const initialControls = localStorage.getItem('splitPosControls')
                                ? parseInt(localStorage.getItem('splitPosControls')!, 10)
                                : defaultControlsWidth;
        // Ensure initialControls is a valid number before using it
        const validInitialControls = isNaN(initialControls) ? defaultControlsWidth : initialControls;

        const calculatedDefault = window.innerWidth - validInitialControls - defaultEntitiesWidth - 22; // Estimate needed space, 22px for 2 resizers
        // Use the calculated default if reasonable, otherwise fallback to a fixed default or min width
        const finalDefault = calculatedDefault > minPaneWidth ? calculatedDefault : defaultResultsWidth;

        return isNaN(parsed) ? finalDefault : parsed; // Use parsed value if valid, otherwise the calculated/fixed default
    });


    // Update state (which is number) and localStorage (as string) on resize
    const handleControlsResize = useCallback((newSize: number) => {
        // Ensure newSize is a valid number before saving
        if (!isNaN(newSize)) {
            localStorage.setItem('splitPosControls', newSize.toString());
            setControlsSize(newSize);
        }
    }, []);

     const handleResultsResize = useCallback((newSize: number) => {
        // Ensure newSize is a valid number before saving
         if (!isNaN(newSize)) {
             localStorage.setItem('splitPosResults', newSize.toString()); // Store pixel value
             setResultsSize(newSize);
         }
     }, []);


    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
                {/* Outer split: Controls | (Results + Entities) */}
                <SplitPane
                    split="vertical"
                    minSize={minPaneWidth}
                    size={controlsSize} // Pass number state directly
                    onChange={handleControlsResize}
                    style={{ position: 'relative', height: '100%' }}
                    pane1Style={{ overflow: 'hidden' }}
                    pane2Style={{ overflow: 'hidden' }}
                >
                    {/* Pane 1: Controls Sidebar */}
                    <Box className="pane-content-wrapper">
                         <Paper elevation={0} square sx={{ bgcolor: 'background.paper', borderRight: `1px solid ${theme.palette.divider}` }}>
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
                    </Box>

                    {/* Pane 2: Inner split for Results | Entities */}
                    <SplitPane
                        split="vertical"
                        minSize={minPaneWidth} // Min size for Results pane
                        size={resultsSize} // Pass number state directly
                        onChange={handleResultsResize}
                        style={{ position: 'relative', height: '100%' }}
                        pane1Style={{ overflow: 'hidden' }}
                        pane2Style={{ overflow: 'hidden' }}
                    >
                        {/* Inner Pane 1: Main Content (Results) */}
                         <Box className="pane-content-wrapper ResultsDisplayWrapper" sx={{ bgcolor: 'background.default' }}>
                            <ResultsDisplay
                                extractionResult={extractionResult}
                                isExtracting={isExtracting}
                                extractionError={extractionError}
                                scrollToTarget={scrollToTarget}
                                onScrollComplete={handleScrollComplete}
                            />
                         </Box>

                        {/* Inner Pane 2: Entities Sidebar */}
                         <Box className="pane-content-wrapper">
                             <Paper elevation={0} square sx={{ bgcolor: 'background.paper', borderLeft: `1px solid ${theme.palette.divider}` }}>
                                 <EntitiesSidebar
                                    extractionResult={extractionResult}
                                    isExtracting={isExtracting}
                                    onEntityClick={handleScrollToEntity}
                                />
                             </Paper>
                         </Box>

                    </SplitPane> {/* End Inner SplitPane */}
                </SplitPane> {/* End Outer SplitPane */}
             </Box> {/* End Viewport Box */}
        </ThemeProvider>
    );
}

export default App;