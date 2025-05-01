// src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels"; // Use imperative handle
import { Box, SelectChangeEvent, Paper } from '@mui/material';
import { useSchemas } from './hooks/useSchemas';
import ControlsSidebar from './components/ControlsSidebar';
import ResultsDisplay from './components/ResultsDisplay';
import EntitiesSidebar from './components/EntitiesSidebar';
import { ExtractionResult, ScrollTarget } from './types';
import AppLayout from './layouts/AppLayout';

// Default sizes can be percentages for react-resizable-panels
const defaultControlsSizePercentage = 20;
const defaultEntitiesSizePercentage = 25;
// Define min sizes for EXPANDED state (percentage)
const minControlsSizePercentage = 10;
const minEntitiesSizePercentage = 15;
const minResultsSizePercentage = 20; // Min size for the middle panel

function App() {
    // --- State ---
    const { schemas, isLoadingSchemas, schemaError } = useSchemas();
    const [selectedSchema, setSelectedSchema] = useState<string>('');
    const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [scrollToTarget, setScrollToTarget] = useState<ScrollTarget | null>(null);
    const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
    const [isEntitiesCollapsed, setIsEntitiesCollapsed] = useState(false);
    const [_isDragging, setIsDragging] = useState(false);

    // --- Refs for Imperative API ---
    const controlsPanelRef = useRef<ImperativePanelHandle>(null);
    const entitiesPanelRef = useRef<ImperativePanelHandle>(null);

    // --- Effects to Sync Panel State with React State using Imperative API ---
    useEffect(() => {
        const panelRef = controlsPanelRef.current;
        if (!panelRef) return; // Ref might not be ready initially
        const panelIsCollapsed = panelRef.isCollapsed(); // Check panel's actual state

        // Sync panel to React state
        if (isControlsCollapsed && !panelIsCollapsed) {
            panelRef.collapse();
        } else if (!isControlsCollapsed && panelIsCollapsed) {
            panelRef.expand();
        }
    }, [isControlsCollapsed]); // Dependency: Run when React state changes

    useEffect(() => {
        const panelRef = entitiesPanelRef.current;
        if (!panelRef) return;
        const panelIsCollapsed = panelRef.isCollapsed();

        if (isEntitiesCollapsed && !panelIsCollapsed) {
            panelRef.collapse();
        } else if (!isEntitiesCollapsed && panelIsCollapsed) {
            panelRef.expand();
        }
    }, [isEntitiesCollapsed]);

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
        // Auto-expand entities if collapsed and results found
        // Use ref to check panel state before changing React state
        if (entitiesPanelRef.current?.isCollapsed() && Object.keys(result.entities).length > 0) {
            setIsEntitiesCollapsed(false); // Trigger effect to expand panel
        }
    };

    const handleExtractError = (error: string) => {
        setIsExtracting(false);
        setExtractionError(error);
    };

    // --- Toggle Functions (Update React State) ---
    const toggleControlsCollapse = () => {
        setIsControlsCollapsed(c => !c); // Just toggle state, effect handles panel
    };

    const toggleEntitiesCollapse = () => {
        setIsEntitiesCollapsed(e => !e); // Just toggle state, effect handles panel
    };
    
    const handleDraggingStateChange = (isDraggingUpdate: boolean) => {
        setIsDragging(isDraggingUpdate);
    };


    // --- Scroll Handler ---
     const handleScrollToEntity = useCallback((entityId: string) => {
        const panelRef = entitiesPanelRef.current;
        // Check panel state via ref
        if (panelRef?.isCollapsed()) {
             setIsEntitiesCollapsed(false); // Trigger expansion via state/effect
            // Wait for effect and potential animation
            setTimeout(() => {
                setScrollToTarget({ id: entityId, timestamp: Date.now() });
            }, 200); // Adjust delay if panel animation exists/is slow
        } else {
            // Panel already expanded, scroll immediately
            setScrollToTarget({ id: entityId, timestamp: Date.now() });
        }
    }, []); // No state dependencies needed if checking ref

    // --- Effect for default schema ---
    useEffect(() => {
        if (!isLoadingSchemas && schemas.length > 0 && !selectedSchema) { setSelectedSchema(schemas[0]); }
        if (!isLoadingSchemas && schemas.length === 0) { setSelectedSchema(''); }
    }, [schemas, isLoadingSchemas, selectedSchema]);

    // --- Optional: Persistence Handlers (Example) ---
    // const handleOuterLayout = (sizes: number[]) => {
    //     localStorage.setItem('panelSizeControls', JSON.stringify(sizes[0]));
    // };
    // const handleInnerLayout = (sizes: number[]) => {
    //      localStorage.setItem('panelSizeMain', JSON.stringify(sizes));
    // };

    return (
        <AppLayout
            isControlsCollapsed={isControlsCollapsed}
            toggleControlsCollapse={toggleControlsCollapse}
            isEntitiesCollapsed={isEntitiesCollapsed}
            toggleEntitiesCollapse={toggleEntitiesCollapse}
        >
            <PanelGroup
                direction="horizontal"
                style={{ height: '100%' }}
                // onLayout={handleOuterLayout} // Optional
                // autoSaveId="app-layout-outer" // Optional & Easier Persistence
            >
                {/* Controls Panel */}
                <Panel
                    ref={controlsPanelRef} // Assign ref
                    order={1}
                    collapsible={true}
                    // Removed collapsed and onCollapse props
                    defaultSize={defaultControlsSizePercentage} // Initial size
                    minSize={minControlsSizePercentage} // Min size when expanded
                >
                    {/* Use Box for consistent padding/styling */}
                    <Box className="pane-content-wrapper" sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Conditionally render based on React state */}
                        {!isControlsCollapsed && (
                            <Paper
                                elevation={0}
                                square
                                sx={(theme) => ({
                                    bgcolor: 'background.paper',
                                    borderRight: `1px solid ${theme.palette.divider}`,
                                    height: '100%',
                                    display: 'flex', flexDirection: 'column',
                                    flexGrow: 1,
                                })}
                            >
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
                        )}
                    </Box>
                </Panel>

                <PanelResizeHandle 
                    className="resize-handle-outer"
                    onDragging={handleDraggingStateChange} />

                {/* Main Content Area (Nested PanelGroup) */}
                <Panel order={2} minSize={minResultsSizePercentage + minEntitiesSizePercentage}>
                    {/* Ensure outer panel minSize accommodates inner panel minSizes */}
                    <PanelGroup
                        direction="horizontal"
                        style={{ height: '100%' }}
                        // onLayout={handleInnerLayout} // Optional
                        // autoSaveId="app-layout-inner" // Optional
                    >
                        {/* Results Panel */}
                        <Panel order={1} minSize={minResultsSizePercentage}>
                            <Box className="pane-content-wrapper ResultsDisplayWrapper" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>
                                <ResultsDisplay
                                    extractionResult={extractionResult}
                                    isExtracting={isExtracting}
                                    extractionError={extractionError}
                                    scrollToTarget={scrollToTarget}
                                />
                            </Box>
                        </Panel>

                        <PanelResizeHandle 
                            className="resize-handle-inner"
                            onDragging={handleDraggingStateChange} />

                        {/* Entities Panel */}
                        <Panel
                            ref={entitiesPanelRef} // Assign ref
                            order={2}
                            collapsible={true}
                            // Removed collapsed and onCollapse props
                            defaultSize={defaultEntitiesSizePercentage}
                            minSize={minEntitiesSizePercentage}
                        >
                            <Box className="pane-content-wrapper" sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                {/* Conditionally render based on React state */}
                                {!isEntitiesCollapsed && (
                                    <Paper
                                        elevation={0}
                                        square
                                        sx={(theme) => ({
                                            bgcolor: 'background.paper',
                                            borderLeft: `1px solid ${theme.palette.divider}`,
                                            height: '100%',
                                            display: 'flex', flexDirection: 'column',
                                            flexGrow: 1,
                                        })}
                                    >
                                        <EntitiesSidebar
                                            extractionResult={extractionResult}
                                            isExtracting={isExtracting}
                                            onEntityClick={handleScrollToEntity}
                                        />
                                    </Paper>
                                )}
                            </Box>
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </AppLayout>
    );
}

export default App;