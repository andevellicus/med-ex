// src/components/DisplayStateIndicator.tsx
import { Box, Paper, Typography, Alert, CircularProgress } from '@mui/material';

interface DisplayStateIndicatorProps {
    isExtracting: boolean;
    extractionError: string | null;
    hasResultText: boolean; // Indicates if there's text to display
}

function DisplayStateIndicator({ isExtracting, extractionError, hasResultText }: DisplayStateIndicatorProps) {
    const containerStyles = {
         display: 'flex',
         justifyContent: 'center',
         alignItems: 'center',
         height: '300px', // Give it some height
         p: 3, // Add padding
         mt: 2, // Add margin top like original Paper
    };

    if (isExtracting) {
        return (
            <Box sx={containerStyles}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Processing...</Typography>
            </Box>
        );
    }

    if (extractionError) {
        // Wrap Alert in Box for consistent spacing if needed
        return <Box sx={{p: 2}}><Alert severity="error" sx={{ width: '100%' }}>{extractionError}</Alert></Box>;
    }

    if (!hasResultText) {
        // Use Paper for consistent styling with results view
        return (
             <Paper variant="outlined" sx={{ ...containerStyles, minHeight: '300px' }}>
                <Typography sx={{ color: 'text.secondary' }}>
                    No results to display. Upload a file and click Extract.
                </Typography>
             </Paper>
        );
    }

    // If none of the above, it means results should be displayed by the parent
    return null;
}

export default DisplayStateIndicator;