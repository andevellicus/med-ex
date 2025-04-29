// src/components/SchemaSelector.tsx
import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    SelectChangeEvent,
    Alert,
    Box
} from '@mui/material';

interface SchemaSelectorProps {
    schemas: string[];
    selectedSchema: string;
    isLoadingSchemas: boolean;
    schemaError: string | null;
    onSchemaChange: (event: SelectChangeEvent<string>) => void;
}

function SchemaSelector({
    schemas,
    selectedSchema,
    isLoadingSchemas,
    schemaError,
    onSchemaChange
}: SchemaSelectorProps) {
    return (
        <Box sx={{ mb: 2 }}> {/* Add margin bottom */}
            <FormControl fullWidth size="small">
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
        </Box>
    );
}

export default SchemaSelector;