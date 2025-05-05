// src/components/ControlsSidebar.tsx
import { useState } from 'react';
import {
    Box,
    Typography,
    Divider,
    Button,
    CircularProgress,
    Alert,
    Snackbar
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save'
import { ExtractionResult } from '../types';
import MultiSchemaSelector from './MultiSchemaSelector';
import FileUploadZone from './FileUploadZone'; // Import new component

// Define props for ControlsSidebar
interface ControlsSidebarProps {
    schemas: string[];
    selectedSchemas: string[];
    isLoadingSchemas: boolean;
    schemaError: string | null;
    onSchemaSelectionChange: (event: string[]) => void;
    isExtracting: boolean;
    onExtractStart: () => void;
    onExtractComplete: (result: ExtractionResult) => void;
    onExtractError: (error: string) => void;
    schemaLoadingError: string | null;
    currentResult: ExtractionResult | null;
}

function ControlsSidebar({
    schemas,
    selectedSchemas,
    isLoadingSchemas,
    schemaError,
    onSchemaSelectionChange,
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
        // Check if file and *at least one* schema is selected
        if (!file || selectedSchemas.length === 0) {
             onExtractError("Please select a file and at least one schema."); // Provide user feedback
             return;
        }
        onExtractStart(); // Clear previous errors/results etc.

        try {
            const fileReader = new FileReader();
            fileReader.readAsText(file); // Read file as text

            fileReader.onload = async (e) => {
                const textContent = e.target?.result as string;
                if (!textContent) {
                    throw new Error("Failed to read file content.");
                }

                const payload = {
                    text: textContent,
                    schema_names: selectedSchemas // Send the array of names
                };

                const response = await fetch('/api/extract', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload) // Send JSON payload
                });

                if (!response.ok) {
                    let errorMsg = `Server error: ${response.status} ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        if (errorData && errorData.error) { errorMsg = errorData.error; }
                    } catch (parseErr) { console.warn("Could not parse error response as JSON", parseErr); }
                    throw new Error(errorMsg);
                }
                const result: ExtractionResult = await response.json();
                onExtractComplete(result);
            };

            fileReader.onerror = (e) => {
                 console.error('Error reading file:', e);
                 throw new Error("Error reading the uploaded file.");
            }

        } catch (error) {
            console.error('Error during extraction setup or fetch:', error);
            onExtractError(error instanceof Error ? error.message : 'Unknown error occurred during extraction');
        }
        // --- END JSON SEND ---
    };
    
    // --- Handle Save Button Click (SERVER-SIDE SAVE) ---
    const handleSave = async () => {
        // Update check for selectedSchemas length and file
        if (!currentResult || selectedSchemas.length === 0 || !file) {
            setSaveStatus({ open: true, message: 'Cannot save: No results, schema selection, or original file.', severity: 'error' });
            return;
        }
        const entitiesToSave = currentResult.entities ?? {};

        setIsSaving(true);
        setSaveStatus({ open: false, message: '', severity: 'info' });

        try {
            const payload = {
                schemaNames: selectedSchemas, 
                text: currentResult.text,
                entities: entitiesToSave,
                originalFilename: file.name
            };

            const response = await fetch('/api/save-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(payload),
            });
            const responseData = await response.json();
            if (!response.ok) { throw new Error(responseData.error || `Failed to save results: ${response.statusText}`); }
            setSaveStatus({ open: true, message: responseData.message || 'Results saved successfully!', severity: 'success' });
        } catch (error: any) {
            console.error("Error saving results:", error);
            setSaveStatus({ open: true, message: `Error saving results: ${error.message}`, severity: 'error' });
        } finally { setIsSaving(false); }
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
                <MultiSchemaSelector
                    schemas={schemas}
                    selectedSchemas={selectedSchemas}
                    isLoadingSchemas={isLoadingSchemas}
                    schemaError={schemaError}
                    onSchemaSelectionChange={onSchemaSelectionChange}
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
                        disabled={!file || !selectedSchemas || isExtracting}
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
                        disabled={!currentResult || !selectedSchemas || !file || isSaving || isExtracting}
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