// src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels"; // Use imperative handle
import { Box, SelectChangeEvent, Paper } from '@mui/material';
import { ExtractionResult, ScrollTarget } from './types';
import { useSchemas } from './hooks/useSchemas';
import { useAnnotationManager } from './hooks/useAnnotationManager';
import ControlsSidebar from './components/ControlsSidebar';
import ResultsDisplay from './components/ResultsDisplay';
import EntitiesSidebar from './components/EntitiesSidebar';

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
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [scrollToTarget, setScrollToTarget] = useState<ScrollTarget | null>(null);
    const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
    const [isEntitiesCollapsed, setIsEntitiesCollapsed] = useState(false);
    const [_isDragging, setIsDragging] = useState(false);
    const [availableEntityNames, setAvailableEntityNames] = useState<string[]>([]);
    const [schemaLoadingError, setSchemaLoadingError] = useState<string | null>(null);

    const {
        currentResult,    // Renamed from extractionResult for clarity within App
        setResult: setAnnotationResult, // Renamed setter for clarity
        addAnnotation,
        deleteAnnotation
    } = useAnnotationManager(null);

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

    // --- Effect for default schema ---
    useEffect(() => {
        if (!isLoadingSchemas && schemas.length > 0 && !selectedSchema) { setSelectedSchema(schemas[0]); }
        if (!isLoadingSchemas && schemas.length === 0) { setSelectedSchema(''); }
    }, [schemas, isLoadingSchemas, selectedSchema]);

    useEffect(() => {
        if (!selectedSchema) {
            setAvailableEntityNames([]);
            setSchemaLoadingError(null);
            return;
        }

        const fetchSchemaDetails = async () => {
            setSchemaLoadingError(null);
            console.log(`Workspaceing schema details for: ${selectedSchema}`);
            try {
                const response = await fetch(`/api/schemas/${selectedSchema}/details`); // Call backend endpoint
                if (!response.ok) {
                     let errorMsg = `Failed to fetch schema details: ${response.status} ${response.statusText}`;
                     try {
                         const errData = await response.json();
                         if (errData?.error) errorMsg += ` - ${errData.error}`;
                     } catch (_) { /* Ignore if error body is not JSON */ }
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                if (!data.entityNames || !Array.isArray(data.entityNames)) {
                     throw new Error("Invalid response format from schema details endpoint.");
                }
                setAvailableEntityNames(data.entityNames);
                console.log(`Loaded entity names for "${selectedSchema}":`, data.entityNames);

            } catch (error: any) {
                console.error(`Error fetching schema details for "${selectedSchema}":`, error);
                setAvailableEntityNames([]);
                setSchemaLoadingError(`Failed to load entity names for "${selectedSchema}". ${error.message || ''}`);
            }
        };

        fetchSchemaDetails();
    }, [selectedSchema]);

    // --- Handlers ---
    const handleSchemaChange = (event: SelectChangeEvent<string>) => {
        setSelectedSchema(event.target.value as string);
        setAnnotationResult(null);
        setExtractionError(null);
        setSchemaLoadingError(null); // Clear schema error on change
    };

    const handleExtractStart = () => {
        setIsExtracting(true);
        setAnnotationResult(null); 
        setExtractionError(null);
        setScrollToTarget(null);
    };

    const handleExtractComplete = (result: ExtractionResult) => {
        setIsExtracting(false);
        setAnnotationResult(result); 
        // Auto-expand logic remains the same
        if (entitiesPanelRef.current?.isCollapsed() && result?.entities && Object.keys(result.entities).length > 0) {
             setIsEntitiesCollapsed(false);
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
            <PanelGroup direction="horizontal" style={{ height: '100%' }}>
                {/* Controls Panel */}
                <Panel ref={controlsPanelRef} order={1} collapsible={true} defaultSize={defaultControlsSizePercentage} minSize={minControlsSizePercentage} >
                     <Box className="pane-content-wrapper" sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                         {!isControlsCollapsed && (
                                <Paper
                                elevation={0}
                                square
                                sx={(theme) => ({
                                    bgcolor: 'background.paper', 
                                    borderRight: `1px solid ${theme.palette.divider}`, // If using borders
                                    height: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1,
                                })}
                                >
                                <ControlsSidebar
                                    // Pass props...
                                    schemas={schemas} selectedSchema={selectedSchema} isLoadingSchemas={isLoadingSchemas} schemaError={schemaError}
                                    onSchemaChange={handleSchemaChange} isExtracting={isExtracting} onExtractStart={handleExtractStart}
                                    onExtractComplete={handleExtractComplete} onExtractError={handleExtractError}
                                    schemaLoadingError={schemaLoadingError}
                                 />
                            </Paper>
                         )}
                     </Box>
                </Panel>

                <PanelResizeHandle className="resize-handle-outer" onDragging={handleDraggingStateChange} />

                {/* Main Content Area */}
                <Panel order={2} minSize={minResultsSizePercentage + minEntitiesSizePercentage}>
                    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
                        {/* Results Panel */}
                        <Panel order={1} minSize={minResultsSizePercentage}>
                             <Box className="pane-content-wrapper ResultsDisplayWrapper" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>
                                 <ResultsDisplay
                                     extractionResult={currentResult} // <-- Pass result from hook
                                     isExtracting={isExtracting}
                                     extractionError={extractionError}
                                     scrollToTarget={scrollToTarget}
                                     availableEntityNames={availableEntityNames}
                                     onAddAnnotation={addAnnotation}   // <-- Pass handler from hook
                                 />
                             </Box>
                        </Panel>

                        <PanelResizeHandle className="resize-handle-inner" onDragging={handleDraggingStateChange} />

                        {/* Entities Panel */}
                        <Panel ref={entitiesPanelRef} order={2} collapsible={true} defaultSize={defaultEntitiesSizePercentage} minSize={minEntitiesSizePercentage} >
                            <Box className="pane-content-wrapper" sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                {!isEntitiesCollapsed && (
                                        <Paper
                                            elevation={0}
                                            square
                                            sx={(theme) => ({
                                                bgcolor: 'background.paper', // <-- IS THIS STILL HERE?
                                                borderLeft: `1px solid ${theme.palette.divider}`, // If using borders
                                                height: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1,
                                            })}
                                        >
                                        <EntitiesSidebar
                                            extractionResult={currentResult} // <-- Pass result from hook
                                            isExtracting={isExtracting}
                                            onEntityClick={handleScrollToEntity}
                                            onDeleteAnnotation={deleteAnnotation} // <-- Pass handler from hook
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