// src/components/ControlsSidebar.tsx
import { useState } from 'react';
import {
    Box,
    SelectChangeEvent,
    Typography,
    Divider,
    Button,
    CircularProgress
} from '@mui/material';
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
    onExtractError
}: ControlsSidebarProps) {
    const [file, setFile] = useState<File | null>(null);

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
                </Box>
            </Box> {/* End Scrollable content area */}
        </Box> // End Main Box
    );
}

export default ControlsSidebar;