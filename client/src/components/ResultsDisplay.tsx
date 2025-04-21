// src/components/ResultsDisplay.tsx
import React, { useState } from 'react'; // Add useState
import {
  Box,
  Paper,
  Typography,
  Tabs, // Import Tabs
  Tab,  // Import Tab
  Alert, // Keep for errors
  CircularProgress, // Keep for loading state
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { ExtractionResult, 
  //Position, 
  //Context, 
  EntityOccurrence } from '../types';


// --- Helper Component: TabPanel (Keep or move to a utils file) ---
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// --- Define Props for ResultsDisplay ---
interface ResultsDisplayProps {
  extractionResult: ExtractionResult | null;
  isExtracting: boolean;
  extractionError: string | null;
}

interface HighlightedTextProps {
  text: string;
  entities: Record<string, EntityOccurrence[]>;
}

const renderValue = (value: any): string => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === null || typeof value === 'undefined') {
    return 'N/A';
  }
  return String(value);
};

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

const HighlightedText: React.FC<HighlightedTextProps> = ({ text, entities }) => {
    // 1. Collect all positions and assign colors/types
    const highlights: { start: number; end: number; type: string; color: string }[] = [];
    const colors = ['#a2d2ff', '#ffafcc', '#bde0fe', '#ffc8dd', '#cdb4db']; // Example colors
    let colorIndex = 0;

    Object.entries(entities).forEach(([entityName, occurrences]) => {
        const color = colors[colorIndex % colors.length];
        colorIndex++;
        occurrences.forEach(occ => {
            highlights.push({ start: occ.position.start, end: occ.position.end, type: entityName, color });
            // Optionally add context highlights too, perhaps with a different style
            // highlights.push({ start: occ.context.position.start, end: occ.context.position.end, type: `Context: ${entityName}`, color: '#e0e0e0' }); // Example for context
        });
    });

    // 2. Sort highlights by start position
    highlights.sort((a, b) => a.start - b.start);

    // 3. Build the highlighted text output
    const output: React.ReactNode[] = [];
    let lastIndex = 0;

    highlights.forEach((highlight, i) => {
        // Add text before the current highlight
        if (highlight.start > lastIndex) {
            output.push(<span key={`text-${i}`}>{text.substring(lastIndex, highlight.start)}</span>);
        }

        // Add the highlighted span
        output.push(
            <mark
                key={`mark-${i}`}
                title={highlight.type} // Show entity type on hover
                style={{ backgroundColor: highlight.color, padding: '0.1em 0.2em', margin: '0 0.1em', borderRadius: '3px' }}
            >
                {text.substring(highlight.start, highlight.end)}
            </mark>
        );
        lastIndex = highlight.end;
    });

    // Add any remaining text after the last highlight
    if (lastIndex < text.length) {
        output.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    }

    return <Typography component="div" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.8' }}>{output}</Typography>;
};


function ResultsDisplay({ extractionResult, isExtracting, extractionError }: ResultsDisplayProps) {
  const [tabValue, setTabValue] = useState(0);
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => { setTabValue(newValue); };

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
    if (!extractionResult) { // Add check for null result when not loading/error
        return <Typography sx={{ m: 2, color: 'text.secondary' }}>No results to display. Upload a file and click Extract.</Typography>;
    }

    // Display results using Tabs
    return (
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="Results tabs">
            <Tab label="Entities" {...a11yProps(0)} />
            <Tab label="Highlighted Text" {...a11yProps(1)} />
          </Tabs>
        </Box>

        {/* --- Entities Tab --- */}
        <TabPanel value={tabValue} index={0}>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {Object.keys(extractionResult.entities).length === 0 ? (
                 <Typography variant="body2" color="text.secondary">(No entities extracted)</Typography>
            ) : (
              <List dense disablePadding>
                {Object.entries(extractionResult.entities).map(([entityName, occurrences], index) => (
                  <React.Fragment key={entityName}>
                    {index > 0 && <Divider component="li" sx={{ my: 1 }} />}
                    <ListItem sx={{ display: 'block', alignItems: 'flex-start', py: 1 }}> {/* Allow block display */}
                       <ListItemText
                          primary={<Typography variant="subtitle2" fontWeight="bold">{entityName}</Typography>}
                          disableTypography
                          sx={{ mb: 1 }} // Margin below title
                       />
                       {occurrences.length === 0 ? (
                           <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}> (None found)</Typography>
                       ) : (
                           <List dense disablePadding sx={{pl: 2}}>
                               {occurrences.map((occ, occIndex) => (
                                   <ListItem key={occIndex} sx={{ py: 0.5, alignItems: 'flex-start' }}>
                                       <ListItemText
                                           primary={
                                               <Typography component="span" variant="body2">
                                                  <Box component="strong" sx={{ mr: 1 }}>Value:</Box> {renderValue(occ.value)}
                                               </Typography>
                                           }
                                           secondary={
                                               <Typography component="span" variant="caption" color="text.secondary">
                                                   <Box component="strong" sx={{ mr: 1 }}>Context:</Box> "{occ.context.text}"
                                                   <Box component="span" sx={{ ml: 1 }}>(Pos: {occ.position.start}-{occ.position.end})</Box>
                                               </Typography>
                                           }
                                           sx={{ my: 0 }}
                                       />
                                   </ListItem>
                               ))}
                           </List>
                       )}
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </TabPanel>

        {/* --- Highlighted Text Tab --- */}
        <TabPanel value={tabValue} index={1}>
           <Paper variant="outlined" sx={{ p: 3, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {extractionResult.text ? (
                 <HighlightedText text={extractionResult.text} entities={extractionResult.entities} />
              ) : (
                 <Typography variant="body2" color="text.secondary">(No text available for highlighting)</Typography>
              )}
           </Paper>
        </TabPanel>
      </Box>
    );
  };

  return (
    <>
      <Typography variant="h5" gutterBottom> Results </Typography>
      {renderContent()}
    </>
  );
}


export default ResultsDisplay;