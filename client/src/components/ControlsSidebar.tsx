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
import { ExtractionResult} from '../types';

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
  const [fileError, setFileError] = useState<string | null>(null);

  // Handle when files are dropped or selected
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFileError(null);
    
    if (acceptedFiles.length === 0) {
      return;
    }
    
    const selectedFile = acceptedFiles[0]; // Get the first file
    setFile(selectedFile);
  }, []);

  // Clear the current file
  const handleClearFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFile(null);
    setFileError(null);
  };
  
  // Configure dropzone
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    multiple: false
  });

  // Handle form submission
  const handleSubmit = async () => {
    if (!file || !selectedSchema) {
      return;
    }

    onExtractStart();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('schema', selectedSchema);

      // Send to backend
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
            // Try to parse potential JSON error response from backend
            const errorData = await response.json();
            if (errorData && errorData.error) {
                errorMsg = errorData.error; // Use specific error from backend if available
            }
        } catch (e) {
            // If response is not JSON, use the status text
            console.warn("Could not parse error response as JSON", e);
        }
        throw new Error(errorMsg); // Throw an error to be caught below
      }

      const result: ExtractionResult = await response.json();
      onExtractComplete(result);
    } catch (error) {
      console.error('Error during extraction:', error);
      onExtractError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  // Dynamic style based on drag state
  const getDropzoneStyle = () => {
    let style = {
      borderColor: 'divider',
      bgcolor: 'background.default'
    };
    
    if (isDragAccept) {
      style = {
        ...style,
        borderColor: 'success.main',
        bgcolor: 'success.light',
      };
    } else if (isDragReject) {
      style = {
        ...style,
        borderColor: 'error.main',
        bgcolor: 'error.light',
      };
    } else if (isDragActive) {
      style = {
        ...style,
        borderColor: 'primary.main',
        bgcolor: 'action.hover',
      };
    } else if (file) {
      style = {
        ...style,
        borderColor: 'primary.main',
        bgcolor: 'action.hover',
      };
    }
    
    return style;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" gutterBottom component="div" sx={{ p: 2, pb: 0 }}>
            Controls
        </Typography>
        <Divider sx={{ mb: 1 }}/>
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
                    <MenuItem key={schemaName} value={schemaName}>
                        {schemaName}
                    </MenuItem>
                    ))}
                </Select>
                {schemaError && <Alert severity="error" sx={{ mt: 1, fontSize: '0.8rem' }}>{schemaError}</Alert>}
            </FormControl>

            {/* File Upload Section */}
            <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Upload Text File
                </Typography>
                
                {/* React Dropzone for .txt files */}
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        mt: 1,
                        border: '2px dashed',
                        minHeight: '100px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        ...getDropzoneStyle()
                    }}
                    {...getRootProps()}
                >
                    <input {...getInputProps()} />
                    
                    {file ? (
                        <Box sx={{ width: '100%', position: 'relative', textAlign: 'center' }}>
                            <Typography variant="body1" fontWeight="medium" sx={{ maxWidth: '80%', margin: '0 auto' }}>
                                {file.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {(file.size / 1024).toFixed(1)} KB
                            </Typography>
                            <Button
                                size="small"
                                startIcon={<ClearIcon />}
                                onClick={handleClearFile}
                                //sx={{ position: 'absolute', top: -5, right: -5 }}
                                sx={{ position: 'relative'}}
                            >
                                Clear
                            </Button>
                        </Box>
                    ) : (
                        <>
                            <UploadFileIcon 
                                color={isDragReject ? "error" : "primary"} 
                                sx={{ fontSize: 40, mb: 1 }} 
                            />
                            <Typography variant="body2" color="text.secondary" align="center">
                                {isDragActive
                                    ? isDragReject
                                        ? "Only .txt files are accepted"
                                        : "Drop the file here..."
                                    : "Drag 'n' drop a .txt file here, or click to select"}
                            </Typography>
                        </>
                    )}
                </Paper>
                
                {fileError && (
                    <Alert severity="error" sx={{ mt: 1, fontSize: '0.8rem' }}>
                        {fileError}
                    </Alert>
                )}
            </Box>
            
            {/* Submit Button */}
            <Box sx={{ my: 2 }}>
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
        </Box>
    </Box>
  );
}

export default ControlsSidebar;