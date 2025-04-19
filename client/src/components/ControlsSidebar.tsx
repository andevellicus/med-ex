// src/components/ControlsSidebar.tsx
//import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Typography,
  //CircularProgress,
  Alert,
  //List,       // Optional for structure
  //ListItem,   // Optional for structure
  Divider     // Optional separator
} from '@mui/material';

// Define ONLY the props needed for the current simplified sidebar
interface ControlsSidebarProps {
  schemas: string[];
  selectedSchema: string;
  isLoadingSchemas: boolean;
  schemaError: string | null;
  onSchemaChange: (event: SelectChangeEvent<string>) => void;
  // We don't need inputText, isExtracting, onSubmit etc. *yet*
}

function ControlsSidebar({
  schemas,
  selectedSchema,
  isLoadingSchemas,
  schemaError,
  onSchemaChange,
}: ControlsSidebarProps) {

  return (
    // Box provides padding and structure within the Drawer
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" gutterBottom component="div" sx={{ p: 2, pb: 0 }}>
            Controls
        </Typography>
        <Divider sx={{ mb: 1 }}/>
        <Box sx={{ px: 2, flexGrow: 1, overflowY: 'auto' }}> {/* Allow controls area to scroll if needed */}
            <FormControl fullWidth margin="normal" size="small">
                <InputLabel id="schema-select-label">Schema</InputLabel>
                <Select
                    labelId="schema-select-label"
                    id="schema-select"
                    value={selectedSchema}
                    label="Schema"
                    onChange={onSchemaChange}
                    disabled={isLoadingSchemas || schemas.length === 0}
                >
                    {isLoadingSchemas && <MenuItem disabled><em>Loading...</em></MenuItem>}
                    {!isLoadingSchemas && schemas.length === 0 && <MenuItem disabled><em>No schemas found</em></MenuItem>}
                    {schemas.map((schemaName) => (
                    <MenuItem key={schemaName} value={schemaName}>
                        {schemaName}
                    </MenuItem>
                    ))}
                </Select>
                {schemaError && <Alert severity="error" sx={{ mt: 1, fontSize: '0.8rem' }}>{schemaError}</Alert>}
            </FormControl>

            {/* --- Placeholder for future controls --- */}
            <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                    (Text input area will go here)
                </Typography>
            </Box>
             <Box sx={{ my: 2 }}>
                 <Typography variant="body2" color="text.secondary">(Extract Button will go here)</Typography>
             </Box>
        </Box>
    </Box>
  );
}

export default ControlsSidebar;