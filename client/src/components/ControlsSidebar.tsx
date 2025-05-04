// src/components/ControlsSidebar.tsx
import { useState } from 'react';
import {
    Box,
    SelectChangeEvent,
    Typography,
    Divider,
    Button,
    CircularProgress,
    Alert,
    Snackbar
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save'
import { ExtractionResult } from '../types';
import SchemaSelector from './SchemaSelector'; // Import new component
import FileUploadZone from './FileUploadZone'; // Import new component

// Define props for ControlsSidebar
interface ControlsSidebarProps {
    schemas: string[];
    selectedSchema: string;
    isLoadingSchemas: boolean;
    schemaError: string | null;
    onSchemaChange: (event: SelectChangeEvent<string>) => void;
    isExtracting: boolean;
    onExtractStart: () => void;
    onExtractComplete: (result: ExtractionResult) => void;
    onExtractError: (error: string) => void;
    schemaLoadingError: string | null;
    currentResult: ExtractionResult | null;
}

function ControlsSidebar({
    schemas,
    selectedSchema,
    isLoadingSchemas,
    schemaError,
    onSchemaChange,
    isExtracting,
    onExtractStart,
    onExtractComplete,
    onExtractError,
    schemaLoadingError,
    currentResult
}: ControlsSidebarProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false); // State for save loading
    const [saveStatus, setSaveStatus] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
        { open: false, message: '', severity: 'info' } // Default severity info or success
    );

    // Handle file selection from FileUploadZone
    const handleFileSelect = (selectedFile: File | null) => {
        setFile(selectedFile);
    };

    // Handle form submission
    const handleSubmit = async () => {
        if (!file || !selectedSchema) { return; }
        onExtractStart();
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('schema', selectedSchema);
            const response = await fetch('/api/extract', { method: 'POST', body: formData });

            if (!response.ok) {
                let errorMsg = `Server error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.error) { errorMsg = errorData.error; }
                } catch (e) { console.warn("Could not parse error response as JSON", e); }
                throw new Error(errorMsg);
            }
            const result: ExtractionResult = await response.json();
            onExtractComplete(result);
        } catch (error) {
            console.error('Error during extraction:', error);
            onExtractError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
    };
    
    // --- Handle Save Button Click (SERVER-SIDE SAVE) ---
    const handleSave = async () => {
        if (!currentResult || !selectedSchema) {
            setSaveStatus({ open: true, message: 'Cannot save: No results available or no schema selected.', severity: 'error' });
            return;
        }
        // Ensure entities is at least an empty object if null/undefined in result
        const entitiesToSave = currentResult.entities ?? {};

        setIsSaving(true);
        setSaveStatus({ open: false, message: '', severity: 'info' }); // Clear previous status

        try {
            const payload = {
                schemaName: selectedSchema,
                text: currentResult.text,
                entities: entitiesToSave, // Send current entities
            };

            const response = await fetch('/api/save-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseData = await response.json(); // Assume backend sends JSON response

            if (!response.ok) {
                // Use error message from backend if available
                throw new Error(responseData.error || `Failed to save results: ${response.statusText}`);
            }

            // Use success message from backend if available
            setSaveStatus({ open: true, message: responseData.message || 'Results saved successfully!', severity: 'success' });

        } catch (error: any) {
            console.error("Error saving results:", error);
            setSaveStatus({ open: true, message: `Error saving results: ${error.message}`, severity: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

     const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSaveStatus({ ...saveStatus, open: false });
    };

    return (
        // This Box is now the direct child of a Pane, let SplitPane handle height/scroll
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%'}}>
            <Typography variant="h6" gutterBottom component="div" sx={{ px: 0, pb: 0, flexShrink: 0 }}> {/* Adjust padding if needed */}
                Controls
            </Typography>
            <Divider sx={{ mb: 1, flexShrink: 0 }} />
            {/* Scrollable content area within the sidebar */}
            <Box className="hide-scrollbar" sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 /* Add padding right for scrollbar */ }}>
                <br /> 
                {/* Use SchemaSelector Component */}
                <SchemaSelector
                    schemas={schemas}
                    selectedSchema={selectedSchema}
                    isLoadingSchemas={isLoadingSchemas}
                    schemaError={schemaError}
                    onSchemaChange={onSchemaChange}
                />
                {/* Display the schema content/details loading error */}
                {schemaLoadingError && (
                     <Alert severity="warning" sx={{ mt: 1, fontSize: '0.8rem' }}>
                         {schemaLoadingError}
                     </Alert>
                )}
                {/* Use FileUploadZone Component */}
                <FileUploadZone
                    onFileSelect={handleFileSelect}
                    currentFile={file}
                />

                {/* Submit Button */}
                <Box sx={{ mt: 'auto', pt: 2, pb: 1, flexShrink: 0 }}> {/* Push button towards bottom */}
                    <Button
                        variant="contained"
                        fullWidth
                        color="primary"
                        disabled={!file || !selectedSchema || isExtracting}
                        onClick={handleSubmit}
                        startIcon={isExtracting ? <CircularProgress size={20} color="inherit" /> : undefined}
                    >
                        {isExtracting ? 'Processing...' : 'Extract Entities'}
                    </Button>

                     {/* Save button */}
                     <Button
                        variant="outlined" 
                        fullWidth
                        color="secondary"
                        disabled={!currentResult || !selectedSchema || isSaving || isExtracting}
                        onClick={handleSave} // Calls the updated server-side save function
                        startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    >
                        {isSaving ? 'Saving...' : 'Save Results'}
                    </Button>
                    {/* Snackbar for Feedback */}
                    <Snackbar
                        open={saveStatus.open}
                        autoHideDuration={6000}
                        onClose={handleCloseSnackbar}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        <Alert onClose={handleCloseSnackbar} severity={saveStatus.severity} sx={{ width: '100%' }} variant="filled">
                            {saveStatus.message}
                        </Alert>
                    </Snackbar>                   
                </Box>
            </Box> {/* End Scrollable content area */}
        </Box> // End Main Box
    );
}

export default ControlsSidebar;