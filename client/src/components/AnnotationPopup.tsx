// src/components/AnnotationPopup.tsx
import { useState, useEffect } from 'react'; // Removed React import
import {
    Popover,
    Box,
    Typography,
    Select,
    MenuItem,
    Button,
    FormControl,
    InputLabel,
    SelectChangeEvent,
    IconButton,
    Tooltip,
    PopoverVirtualElement // Import the type for casting/typing
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AnnotationPopupProps {
    open: boolean;
    anchorPosition?: { top: number; left: number };
    selectedText: string;
    entityNames: string[];
    onAnnotate: (entityName: string) => void;
    onClose: () => void;
}

function AnnotationPopup({
    open,
    anchorPosition,
    selectedText,
    entityNames,
    onAnnotate,
    onClose,
}: AnnotationPopupProps) {
    const [selectedEntity, setSelectedEntity] = useState<string>('');

    useEffect(() => {
        if (open) {
            setSelectedEntity('');
        }
    }, [open, selectedText]);

    const handleEntityChange = (event: SelectChangeEvent<string>) => {
        setSelectedEntity(event.target.value as string);
    };

    const handleAnnotateClick = () => {
        if (selectedEntity) {
            onAnnotate(selectedEntity);
        }
    };

    // Create an object satisfying PopoverVirtualElement
    // Explicitly type or cast the constant
    const virtualAnchorEl = anchorPosition ? ({
         nodeType: 1, // Node.ELEMENT_NODE
         getBoundingClientRect: () => ({
            width: 0,
            height: 0,
            top: anchorPosition.top,
            right: anchorPosition.left,
            bottom: anchorPosition.top,
            left: anchorPosition.left,
            x: anchorPosition.left,
            y: anchorPosition.top,
         }),
     } as PopoverVirtualElement) 
     : undefined;

    // --- Alternative: Explicit Typing (instead of casting) ---
    // const virtualAnchorElTyped: PopoverVirtualElement | undefined = anchorPosition ? {
    //      nodeType: 1,
    //      getBoundingClientRect: () => ({ /* ...rect properties... */ }),
    //  } : undefined;

    return (
        <Popover
            open={open && !!virtualAnchorEl}
            anchorEl={virtualAnchorEl} // Pass the typed/casted virtual element
            onClose={onClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            disableRestoreFocus
            PaperProps={{ sx: { width: '300px', p: 0, mt: '2px' } }}
        >
            {virtualAnchorEl && (
                 <Box sx={{ p: 2, position: 'relative' }}>
                      <Tooltip title="Close">
                         <IconButton aria-label="close" onClick={onClose} size="small" sx={{ position: 'absolute', top: 4, right: 4 }} >
                             <CloseIcon fontSize="small" />
                         </IconButton>
                     </Tooltip>
                    <Typography variant="subtitle2" gutterBottom sx={{ pr: 4 }}> Annotate Selection: </Typography>
                    <Box sx={{ my: 1, p: 1, background: theme => theme.palette.action.hover, borderRadius: 1, maxHeight: '80px', overflowY: 'auto' }}>
                         <Typography variant="body2" sx={{ fontStyle: 'italic' }}> "{selectedText}" </Typography>
                    </Box>
                    <FormControl fullWidth size="small" sx={{ my: 2 }}>
                        <InputLabel id="entity-type-select-label">Entity Type</InputLabel>
                        <Select
                            labelId="entity-type-select-label" id="entity-type-select"
                            value={selectedEntity} label="Entity Type"
                            onChange={handleEntityChange}
                            disabled={!entityNames || entityNames.length === 0}
                        >
                            {entityNames?.length > 0 ? (
                                 entityNames.map((name) => ( <MenuItem key={name} value={name}>{name}</MenuItem> ))
                             ) : ( <MenuItem disabled>No types available for schema</MenuItem> )}
                        </Select>
                    </FormControl>
                    <Button variant="contained" color="primary" fullWidth onClick={handleAnnotateClick} disabled={!selectedEntity} > Annotate </Button>
                 </Box>
             )}
        </Popover>
    );
}

export default AnnotationPopup;