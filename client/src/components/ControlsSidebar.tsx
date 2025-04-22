// src/components/ControlsSidebar.tsx
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    SelectChangeEvent,
    Typography,
    Alert,
    Divider,
    Button,
    Paper,
    CircularProgress
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ClearIcon from '@mui/icons-material/Clear';
import { ExtractionResult } from '../types';

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
    // No need for isControlsOpen prop if button is managed in App.tsx
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
    const [fileError, setFileError] = useState<string | null>(null);

    // Handle when files are dropped or selected
    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFileError(null);
        if (acceptedFiles.length === 0) { return; }
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
    }, []);

    // Clear the current file
    const handleClearFile = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setFile(null);
        setFileError(null);
    };

    // Configure dropzone
    const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
        onDrop,
        accept: { 'text/plain': ['.txt'] },
        maxFiles: 1,
        multiple: false
    });

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

    // Dynamic style based on drag state
     const getDropzoneStyle = () => ({ // Simplified slightly
        borderColor: isDragAccept ? 'success.main' : isDragReject ? 'error.main' : isDragActive ? 'primary.main' : file ? 'primary.light' : 'divider',
        bgcolor: isDragAccept ? 'success.light' : isDragReject ? 'error.light' : isDragActive ? 'action.hover' : file ? 'action.selected' : 'background.default',
        transition: 'border-color 0.2s ease-in-out, background-color 0.2s ease-in-out' // Added transition
    });

    return (
        // Use Box with explicit height and allow content scrolling
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 6 /* Add padding top for toggle button */ }}>
            <Typography variant="h6" gutterBottom component="div" sx={{ px: 2, pb: 0 }}>
                Controls
            </Typography>
            <Divider sx={{ mb: 1 }}/>
            {/* Scrollable content area */}
            <Box sx={{ px: 2, flexGrow: 1, overflowY: 'auto' }}>
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
                            <MenuItem key={schemaName} value={schemaName}>{schemaName}</MenuItem>
                        ))}
                    </Select>
                    {schemaError && <Alert severity="error" sx={{ mt: 1, fontSize: '0.8rem' }}>{schemaError}</Alert>}
                </FormControl>

                {/* File Upload Section */}
                <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>Upload Text File</Typography>
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2, mt: 1, border: '2px dashed', minHeight: '100px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', cursor: 'pointer', textAlign: 'center',
                            ...getDropzoneStyle()
                        }}
                        {...getRootProps()}
                    >
                        <input {...getInputProps()} />
                        {file ? (
                            <Box sx={{ width: '100%', position: 'relative' }}>
                                <Typography variant="body1" fontWeight="medium" sx={{ wordBreak: 'break-all' }}>{file.name}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{(file.size / 1024).toFixed(1)} KB</Typography>
                                <Button size="small" startIcon={<ClearIcon />} onClick={handleClearFile} sx={{ mt: 1 }}>Clear</Button>
                            </Box>
                        ) : (
                            <>
                                <UploadFileIcon color={isDragReject ? "error" : "primary"} sx={{ fontSize: 40, mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    {isDragReject ? "Only .txt files accepted" : isDragActive ? "Drop the file here..." : "Drag and drop or click"}
                                </Typography>
                            </>
                        )}
                    </Paper>
                    {fileError && <Alert severity="error" sx={{ mt: 1, fontSize: '0.8rem' }}>{fileError}</Alert>}
                </Box>

                {/* Submit Button */}
                <Box sx={{ mt: 2, mb: 1 }}> {/* Adjusted margin */}
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