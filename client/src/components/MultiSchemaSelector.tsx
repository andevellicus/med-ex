// src/components/MultiSchemaSelector.tsx
import {
    Box,
    Typography,
    FormGroup,
    FormControlLabel,
    Checkbox,
    CircularProgress,
    Alert,
    FormControl,
    FormLabel
} from '@mui/material';

interface MultiSchemaSelectorProps {
    schemas: string[]; // All available schema names
    selectedSchemas: string[]; // Currently selected schema names
    isLoadingSchemas: boolean;
    schemaError: string | null;
    onSchemaSelectionChange: (selected: string[]) => void; // Callback with the new array
}

function MultiSchemaSelector({
    schemas,
    selectedSchemas,
    isLoadingSchemas,
    schemaError,
    onSchemaSelectionChange
}: MultiSchemaSelectorProps) {

    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;
        let newSelectedSchemas: string[];

        if (checked) {
            // Add schema to the list if checked
            newSelectedSchemas = [...selectedSchemas, name];
        } else {
            // Remove schema from the list if unchecked
            newSelectedSchemas = selectedSchemas.filter(schemaName => schemaName !== name);
        }
        onSchemaSelectionChange(newSelectedSchemas); // Notify parent component
    };

    return (
        <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.9rem' }}>Select Schemas</FormLabel>
            {isLoadingSchemas && <Box sx={{ display: 'flex', alignItems: 'center' }}><CircularProgress size={20} sx={{ mr: 1 }} /> <Typography variant="body2">Loading schemas...</Typography></Box>}
            {schemaError && !isLoadingSchemas && <Alert severity="error" sx={{ fontSize: '0.8rem', mb: 1 }}>{schemaError}</Alert>}
            {!isLoadingSchemas && schemas.length === 0 && !schemaError && <Typography variant="body2" color="text.secondary">No schemas found.</Typography>}

            {!isLoadingSchemas && schemas.length > 0 && (
                <FormGroup sx={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    {schemas.map((schemaName) => (
                        <FormControlLabel
                            key={schemaName}
                            control={
                                <Checkbox
                                    checked={selectedSchemas.includes(schemaName)}
                                    onChange={handleCheckboxChange}
                                    name={schemaName}
                                    size="small"
                                />
                            }
                            label={<Typography variant="body2">{schemaName}</Typography>}
                            sx={{ height: '30px' }} // Adjust height for density
                        />
                    ))}
                </FormGroup>
            )}
        </FormControl>
    );
}

export default MultiSchemaSelector;