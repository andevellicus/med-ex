// src/components/FileUploadZone.tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Box,
    Typography,
    Paper,
    Button,
    Alert
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ClearIcon from '@mui/icons-material/Clear';

interface FileUploadZoneProps {
    onFileSelect: (file: File | null) => void;
    currentFile: File | null;
}

function FileUploadZone({ onFileSelect, currentFile }: FileUploadZoneProps) {
    const [fileError, setFileError] = useState<string | null>(null);

    // Handle when files are dropped or selected
    const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
        setFileError(null); // Clear previous errors

        if (rejectedFiles && rejectedFiles.length > 0) {
             // Handle rejection (e.g., wrong file type)
             setFileError('File type not accepted. Only .txt files are allowed.');
             onFileSelect(null); // Ensure no file is selected
             return;
        }

        if (acceptedFiles.length === 0) {
             // This might happen if the selection is cancelled
             if (!currentFile) onFileSelect(null); // Only clear if no file was previously selected
             return;
         }

        const selectedFile = acceptedFiles[0];
        onFileSelect(selectedFile);
    }, [onFileSelect, currentFile]);

    // Clear the current file
    const handleClearFile = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation(); // Prevent dropzone click
        setFileError(null);
        onFileSelect(null);
    };

    // Configure dropzone
    const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
        onDrop,
        accept: { 'text/plain': ['.txt'] }, // Enforce file type
        maxFiles: 1,
        multiple: false,
    });

    // Dynamic style based on drag state
    const getDropzoneStyle = () => ({
        borderColor: isDragAccept ? 'success.main' : isDragReject ? 'error.main' : isDragActive ? 'primary.main' : currentFile ? 'primary.light' : 'divider',
        bgcolor: isDragAccept ? 'success.light' : isDragReject ? 'error.light' : isDragActive ? 'action.hover' : currentFile ? 'action.selected' : 'background.default',
        transition: 'border-color 0.2s ease-in-out, background-color 0.2s ease-in-out'
    });

    return (
        <Box sx={{ mt: 1 }}> {/* Adjusted margin */}
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
                {currentFile ? (
                    <Box sx={{ width: '100%', position: 'relative' }}>
                        <Typography variant="body1" fontWeight="medium" sx={{ wordBreak: 'break-all' }}>{currentFile.name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{(currentFile.size / 1024).toFixed(1)} KB</Typography>
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
    );
}

export default FileUploadZone;