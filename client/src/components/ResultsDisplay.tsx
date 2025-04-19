// src/components/ResultsDisplay.tsx
import React, { useState } from 'react'; // Add useState
import {
  Box,
  Paper,
  Typography,
  Tabs, // Import Tabs
  Tab,  // Import Tab
  Alert, // Keep for errors
  CircularProgress // Keep for loading state
} from '@mui/material';

// --- Helper Component: TabPanel (Keep or move to a utils file) ---
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`results-tabpanel-${index}`}
      aria-labelledby={`results-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>} {/* pt adds padding top */}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `results-tab-${index}`,
    'aria-controls': `results-tabpanel-${index}`,
  };
}

// --- Define Props for ResultsDisplay ---
// Define ExtractionResult type here or import
interface ExtractionResult {
  normalized_text: string;
  extracted_data: Record<string, any>;
  entity_positions: Record<string, [number, number][]>;
  context_positions: Record<string, [number, number][]>;
}

interface ResultsDisplayProps {
  // Props needed to display results (add back later)
  inputText?: string; // Optional for now
  extractionResult: ExtractionResult | null;
  isExtracting: boolean;
  extractionError: string | null;
}

function ResultsDisplay({
    // Destructure props when needed
    // inputText,
    extractionResult,
    isExtracting,
    extractionError
}: ResultsDisplayProps) {
  // --- State for Tabs (lives inside this component now) ---
  const [tabValue, setTabValue] = useState(0); // 0 = Entities, 1 = Highlighted Text

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // --- Conditional Rendering Logic ---
  const renderContent = () => {
      if (isExtracting) {
          return (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                  <CircularProgress />
              </Box>
          );
      }
      if (extractionError) {
          return <Alert severity="error" sx={{ m: 2 }}>{extractionError}</Alert>;
      }
      // When not loading and no error, show tabs
      return (
          <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="Results tabs">
                <Tab label="Entities" {...a11yProps(0)} />
                <Tab label="Highlighted Text" {...a11yProps(1)} />
              </Tabs>
            </Box>

            {/* Content for first tab */}
            <TabPanel value={tabValue} index={0}>
                 {/* TODO: Replace with EntityList component */}
                 <Paper variant="outlined" sx={{ p: 3 }}>
                     <Typography variant="subtitle1" color="text.secondary">Placeholder: Extracted Entities</Typography>
                      {extractionResult ?
                         <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 1, fontSize:'0.8rem' }}>
                            {JSON.stringify(extractionResult.extracted_data, null, 2)}
                         </Typography>
                         : <Typography variant="body2" color="text.secondary" sx={{mt:1}}>(Structured data display will render here)</Typography>
                     }
                 </Paper>
            </TabPanel>

            {/* Content for second tab */}
            <TabPanel value={tabValue} index={1}>
               {/* TODO: Replace with HighlightedText component */}
               <Paper variant="outlined" sx={{ p: 3 }}>
                   <Typography variant="subtitle1" color="text.secondary">Placeholder: Highlighted Text</Typography>
                   {extractionResult ?
                     <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 1 }}>
                       {extractionResult.normalized_text}
                     </Typography>
                     : <Typography variant="body2" color="text.secondary" sx={{mt:1}}>(Highlighting logic will render here)</Typography>
                   }
               </Paper>
            </TabPanel>
          </Box>
      );
  }

  // --- Render ResultsDisplay Component ---
  return (
    <>
      <Typography variant="h5" gutterBottom>
        Results
      </Typography>
      {renderContent()}
    </>
  );
}

export default ResultsDisplay;