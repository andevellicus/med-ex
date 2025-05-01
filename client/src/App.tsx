// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import { SplitPane } from '@rexxars/react-split-pane';
import { Box, SelectChangeEvent, Paper } from '@mui/material';
import { useSchemas } from './hooks/useSchemas';
import ControlsSidebar from './components/ControlsSidebar';
import ResultsDisplay from './components/ResultsDisplay';
import EntitiesSidebar from './components/EntitiesSidebar';
import { ExtractionResult, ScrollTarget } from './types';
import AppLayout from './layouts/AppLayout'; // Import AppLayout

// Default sizes for panes (pixels)
const defaultControlsWidth = 280;
const defaultEntitiesWidth = 320;
const defaultResultsWidth = 600;
const minPaneWidth = 50;
const collapsedSize = 0;

function App() {
    // --- Existing State ---
    const { schemas, isLoadingSchemas, schemaError } = useSchemas();
    const [selectedSchema, setSelectedSchema] = useState<string>('');
    const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [scrollToTarget, setScrollToTarget] = useState<ScrollTarget | null>(null);

    // --- Collapse State ---
    const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
    const [isEntitiesCollapsed, setIsEntitiesCollapsed] = useState(false);

    // --- Pane Size State & Persistence ---
    // Use state to hold the actual current size
    const [controlsSize, setControlsSize] = useState<number>(() => {
        const saved = localStorage.getItem('splitPosControls');
        const parsed = saved ? parseInt(saved, 10) : NaN;
        return isNaN(parsed) ? defaultControlsWidth : parsed;
    });
    // Store the size *before* collapse
    const [prevControlsSize, setPrevControlsSize] = useState<number>(controlsSize);

    const [resultsSize, setResultsSize] = useState<number>(() => {
        const saved = localStorage.getItem('splitPosResults');
        const parsed = saved ? parseInt(saved, 10) : NaN;
        const initialControls = localStorage.getItem('splitPosControls') ? parseInt(localStorage.getItem('splitPosControls')!, 10) : defaultControlsWidth;
        const validInitialControls = isNaN(initialControls) ? defaultControlsWidth : initialControls;
        const calculatedDefault = window.innerWidth - validInitialControls - defaultEntitiesWidth - 22;
        const finalDefault = calculatedDefault > minPaneWidth ? calculatedDefault : defaultResultsWidth;
        return isNaN(parsed) ? finalDefault : parsed;
    });
    // Store the size *before* collapse
     const [prevResultsSize, setPrevResultsSize] = useState<number>(resultsSize);

    // --- Effect for default schema ---
    useEffect(() => {
        if (!isLoadingSchemas && schemas.length > 0 && !selectedSchema) { setSelectedSchema(schemas[0]); }
        if (!isLoadingSchemas && schemas.length === 0) { setSelectedSchema(''); }
    }, [schemas, isLoadingSchemas, selectedSchema]);

    // --- Handlers ---
    // (Keep existing handlers: handleSchemaChange, handleExtractStart, etc.)
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
         // Automatically expand entities if collapsed and results found
         if (isEntitiesCollapsed && Object.keys(result.entities).length > 0) {
             toggleEntitiesCollapse();
         }
    };

    const handleExtractError = (error: string) => {
        setIsExtracting(false);
        setExtractionError(error);
    };

    const handleScrollToEntity = useCallback((entityId: string) => {
        // Automatically expand entities if collapsed when clicking an entity
        if (isEntitiesCollapsed) {
             toggleEntitiesCollapse();
             // Use timeout to allow pane to expand before scrolling
             setTimeout(() => {
                 setScrollToTarget({ id: entityId, timestamp: Date.now() });
             }, 250); // Adjust delay if needed
        } else {
             setScrollToTarget({ id: entityId, timestamp: Date.now() });
        }
    }, [isEntitiesCollapsed]); // Add dependency

    // Update stored previous size only when dragging, not during collapse/expand
    const handleControlsDrag = useCallback((newSize: number) => {
        if (!isControlsCollapsed) { // Only update stored size if not collapsed
            localStorage.setItem('splitPosControls', newSize.toString());
             setPrevControlsSize(newSize); // Store the dragged size
        }
        setControlsSize(newSize); // Always update the current size
    }, [isControlsCollapsed]); // Recreate handler if collapsed state changes

     const handleResultsDrag = useCallback((newSize: number) => {
         if (!isEntitiesCollapsed) { // Only update stored size if not collapsed
             localStorage.setItem('splitPosResults', newSize.toString());
             setPrevResultsSize(newSize); // Store the dragged size
         }
         setResultsSize(newSize); // Always update the current size
     }, [isEntitiesCollapsed]); // Recreate handler if collapsed state changes

    // --- Toggle Functions ---
    const toggleControlsCollapse = () => {
        const collapsing = !isControlsCollapsed;
        setIsControlsCollapsed(collapsing);
        if (collapsing) {
             // Store current size *before* collapsing (if it wasn't already collapsed)
             if (controlsSize > collapsedSize) {
                 setPrevControlsSize(controlsSize);
             }
            setControlsSize(collapsedSize); // Collapse
        } else {
            // Expand to previous size or default
            setControlsSize(prevControlsSize > collapsedSize ? prevControlsSize : defaultControlsWidth);
        }
    };

    const toggleEntitiesCollapse = () => {
         const collapsing = !isEntitiesCollapsed;
         setIsEntitiesCollapsed(collapsing);
         if (collapsing) {
             // Store current Results size *before* collapsing Entities
             if (resultsSize < Number.MAX_SAFE_INTEGER - 1) { // Avoid storing the MAX_VALUE hack
                 setPrevResultsSize(resultsSize);
             }
              // Hacky way for react-split-pane: make results pane huge to collapse entities pane
             setResultsSize(Number.MAX_SAFE_INTEGER); // Collapse (forces second pane to minSize or near zero)
         } else {
              // Expand Entities by restoring Results pane size
             setResultsSize(prevResultsSize < Number.MAX_SAFE_INTEGER - 1 ? prevResultsSize : defaultResultsWidth);
         }
    };

    return (
        // Wrap everything in AppLayout, pass props for buttons/state
        <AppLayout
            isControlsCollapsed={isControlsCollapsed}
            toggleControlsCollapse={toggleControlsCollapse}
            isEntitiesCollapsed={isEntitiesCollapsed}
            toggleEntitiesCollapse={toggleEntitiesCollapse}
        >
            {/* The direct child of AppLayout's main content area should be the SplitPane structure */}
            {/* Ensure SplitPane takes full height of its container */}
            <SplitPane
                split="vertical"
                minSize={isControlsCollapsed ? collapsedSize : minPaneWidth}
                size={controlsSize}
                onChange={handleControlsDrag}
                allowResize={!isControlsCollapsed}
                style={{ height: '100%', position: 'relative' }} // Take full height of parent main area

                resizerStyle={isControlsCollapsed ? { display: 'none' } : {}}
            >
                {/* Pane 1: Controls Sidebar */}
                <Box className="pane-content-wrapper">
                     {controlsSize > 0 && (
                        <Paper
                            elevation={0}
                            square
                            sx={(theme) => ({ // Pass theme to sx callback
                                bgcolor: 'background.paper',
                                borderRight: `1px solid ${theme.palette.divider}`, // Access theme here
                                height: '100%', // Ensure Paper fills wrapper
                                display: 'flex', flexDirection: 'column' // Added for consistency
                            })}
                        >
                            <ControlsSidebar /* ... pass only necessary props ... */
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
                      )}
                </Box>

                {/* Pane 2: Inner split */}
                <SplitPane
                    split="vertical"
                    minSize={minPaneWidth}
                    size={isEntitiesCollapsed ? Number.MAX_SAFE_INTEGER : resultsSize}
                    onChange={handleResultsDrag}
                    allowResize={!isEntitiesCollapsed}
                    style={{ height: '100%', position: 'relative' }}
                    pane1Style={{ overflow: 'hidden', transition: 'width 0.2s ease-in-out' }}
                    pane2Style={{ overflow: 'hidden', transition: 'width 0.2s ease-in-out' }}
                    resizerStyle={isEntitiesCollapsed ? { display: 'none' } : {}}
                >
                    {/* Inner Pane 1: Results */}
                     <Box className="pane-content-wrapper ResultsDisplayWrapper" sx={{ bgcolor: 'background.default' }}>
                        <ResultsDisplay /* ... pass only necessary props ... */
                            extractionResult={extractionResult}
                            isExtracting={isExtracting}
                            extractionError={extractionError}
                            scrollToTarget={scrollToTarget}
                        />
                     </Box>

                    {/* Inner Pane 2: Entities */}
                     <Box className="pane-content-wrapper">
                        {/* No need to conditionally render based on collapse here if pane size handles it */}
                         {/* But also no longer need to pass collapse state/toggle func */}
                         <Paper
                             elevation={0}
                             square
                             sx={(theme) => ({ // Pass theme to sx callback
                                 bgcolor: 'background.paper',
                                 borderLeft: `1px solid ${theme.palette.divider}`, // Access theme here
                                 height: '100%', // Ensure Paper fills wrapper
                                 display: 'flex', flexDirection: 'column' // Added for consistency
                             })}
                         >
                             <EntitiesSidebar /* ... pass only necessary props ... */
                                extractionResult={extractionResult}
                                isExtracting={isExtracting}
                                onEntityClick={handleScrollToEntity}
                                // Remove isCollapsed and toggleCollapse from here
                            />
                         </Paper>
                     </Box>
                </SplitPane> {/* End Inner SplitPane */}
            </SplitPane> {/* End Outer SplitPane */}
        </AppLayout>
    );
}

export default App;