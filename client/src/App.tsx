// src/App.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  CssBaseline,
  Paper,
  SelectChangeEvent,
  useMediaQuery,
  createTheme,
  ThemeProvider,
  PaletteMode
} from '@mui/material';
import { useSchemas } from './hooks/useSchemas';
import ControlsSidebar from './components/ControlsSidebar';
import ResultsDisplay from './components/ResultsDisplay'; // Import the updated component

// --- Constants ---
const sidebarWidth = 280;

// --- Keep ExtractionResult interface ---
interface ExtractionResult {
  normalized_text: string;
  extracted_data: Record<string, any>;
  entity_positions: Record<string, [number, number][]>;
  context_positions: Record<string, [number, number][]>;
}

function App() {
  // --- State remains in App ---
  const { schemas, isLoadingSchemas, schemaError } = useSchemas();
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // --- Theme State & Logic (Keep as before) ---
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<PaletteMode>(() => prefersDarkMode ? 'dark' : 'light');
  useEffect(() => { setMode(prefersDarkMode ? 'dark' : 'light'); }, [prefersDarkMode]);
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode]);

  // --- Effect for default schema (Keep as before) ---
  useEffect(() => {
    if (!isLoadingSchemas && schemas.length > 0 && !selectedSchema) { setSelectedSchema(schemas[0]); }
    if (!isLoadingSchemas && schemas.length === 0) { setSelectedSchema(''); }
  }, [schemas, isLoadingSchemas, selectedSchema]);

  // --- Handlers remain in App ---
  const handleSchemaChange = (event: SelectChangeEvent<string>) => {
     setSelectedSchema(event.target.value as string);
     setExtractionResult(null);
     setExtractionError(null);
  };

  const handleExtractStart = () => {
    setIsExtracting(true);
    setExtractionResult(null);
    setExtractionError(null);
  };

  const handleExtractComplete = (result: ExtractionResult) => {
    setIsExtracting(false);
    setExtractionResult(result);
  };

  const handleExtractError = (error: string) => {
    setIsExtracting(false);
    setExtractionError(error);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', width: '100vw', bgcolor: 'background.default' }}>

        {/* --- Sidebar (Renders ControlsSidebar) --- */}
        <Paper elevation={2} square sx={{ width: sidebarWidth, flexShrink: 0, p: 2, overflowY: 'auto', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
           <ControlsSidebar
              schemas={schemas}
              selectedSchema={selectedSchema}
              isLoadingSchemas={isLoadingSchemas}
              schemaError={schemaError}
              onSchemaChange={handleSchemaChange}
              // Pass state and handlers for controls
              isExtracting={isExtracting}
              onExtractStart={handleExtractStart}
              onExtractComplete={handleExtractComplete}
              onExtractError={handleExtractError}
              //inputText={inputText}
              //onTextChange={handleTextChange}
              //onSubmit={handleExtractSubmit}
           />
        </Paper>

        {/* --- Main Content Area (Renders ResultsDisplay) --- */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, overflowY: 'auto' }}>
           {/* Pass state needed for displaying results */}
           <ResultsDisplay
                extractionResult={extractionResult}
                isExtracting={isExtracting}
                extractionError={extractionError}
           />
        </Box>

      </Box>
    </ThemeProvider>
  );
}

export default App;