// src/components/EntitiesSidebar.tsx
import React, { useState, useMemo } from 'react'; // Added useMemo
import {
    Box,
    Typography,
    List,
    ListItemText,
    Collapse,
    IconButton,
    Divider,
    CircularProgress,
    ListItem,
    ListItemButton,
    Stack,
    Tooltip
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import { ExtractionResult, EntityOccurrence, NestedEntity } from '../types';

interface EntitiesSidebarProps {
    extractionResult: ExtractionResult | null;
    isExtracting: boolean;
    onEntityClick: (entityId: string) => void;
    onDeleteAnnotation: (entityName: string, occurrenceId: string) => void;
}

interface NestedEntityItemProps {
    entityName: string; // Pass down full entity name for deletion
    entityData: NestedEntity;
    level: number;
    onEntityClick: (entityId: string) => void;
    onDeleteAnnotation: (entityName: string, occurrenceId: string) => void; // <-- Add delete handler prop
}

const renderValue = (value: any): string => {
    if (Array.isArray(value)) { return value.join(', '); }
    if (typeof value === 'boolean') { return value ? 'Yes' : 'No'; }
    if (value === null || typeof value === 'undefined') { return 'N/A'; }
    return String(value);
};

const buildNestedStructure = (entities: Record<string, EntityOccurrence[]>): Record<string, NestedEntity> => {
    const structure: Record<string, NestedEntity> = {};

    Object.entries(entities).forEach(([fullName, occurrences]) => {
        const parts = fullName.split('.');
        let currentLevel = structure;
        let currentPath = '';

        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}.${part}` : part;
            if (!currentLevel[part]) {
                // Initialize with potential children obj only if not the last part
                currentLevel[part] = { name: part, children: (index === parts.length - 1) ? undefined : {} };
            }

            if (index === parts.length - 1) {
                // Final entity name part: Assign occurrences
                currentLevel[part].occurrences = occurrences;
                 // Ensure children is defined if it was already treated as parent
                 if (!currentLevel[part].children) {
                    currentLevel[part].children = {}; // Keep expandable for consistency if needed
                 }
            } else {
                 // Ensure children object exists for nesting
                 if (!currentLevel[part].children) {
                    currentLevel[part].children = {};
                 }
                currentLevel = currentLevel[part].children!;
            }
        });
    });
    return structure;
};

    // Recursive component to render nested entities
const NestedEntityItem: React.FC<NestedEntityItemProps> = ({
        entityName, // Full name like "Lab.WBC" or "Age"
        entityData,
        level,
        onEntityClick,
        onDeleteAnnotation
    }) => {
        const [open, setOpen] = useState(true);
        const hasRealChildren = entityData.children && Object.values(entityData.children).some(child => child.name);
        const hasOccurrences = entityData.occurrences && entityData.occurrences.length > 0;
        const canExpand = hasRealChildren || hasOccurrences;
        const isStructuralOnly = !hasOccurrences && hasRealChildren;

        const handleClick = () => { if (canExpand) setOpen(!open); };

        const handleDeleteClick = (event: React.MouseEvent, occurrenceId: string) => {
            event.stopPropagation(); // Prevent ListItem click event
            onDeleteAnnotation(entityName, occurrenceId); // Call handler with full name and ID
        };

    return (
        <>
             {/* Use ListItemButton for the main clickable/expandable item */}
            <ListItemButton
                onClick={handleClick}
                sx={{ pl: level * 2, py: 0.3 }} // Indentation + padding
                disabled={!canExpand} // Disable click if nothing to show/hide
            >
                <ListItemText
                    primary={
                        <Typography variant="body2" sx={{ fontWeight: isStructuralOnly ? 'normal' : 'bold' }}>
                            {entityData.name}
                             {/* Show count only if it has direct occurrences and IS NOT purely structural */}
                             {hasOccurrences && !isStructuralOnly && ` (${entityData.occurrences!.length})`}
                        </Typography>
                    }
                    disableTypography
                    sx={{ my: 0, mr: 1 }} // Add margin if there's an icon
                />
                {/* Show expand icon only if it has something to expand */}
                 {canExpand ? (
                     <IconButton size="small" edge="end" aria-label="expand">
                        {open ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                 ) : <Box sx={{ width: 34 }}/> /* Placeholder to keep alignment */}
            </ListItemButton>

            {/* Collapsible section for children AND occurrences */}
            <Collapse in={open} timeout={500} unmountOnExit>
                <List component="div" disablePadding>
                    {/* Render direct occurrences */}
                    {hasOccurrences && entityData.occurrences!.map((occ) => (
                        // Use ListItem instead of ListItemButton to contain the button easily
                        <ListItem
                            key={occ.id}
                            disablePadding
                            secondaryAction={ // Add delete button as secondary action
                                <Tooltip title="Delete Annotation">
                                    <IconButton
                                        edge="end"
                                        aria-label="delete"
                                        size="small"
                                        onClick={(e) => handleDeleteClick(e, occ.id)}
                                    >
                                        <DeleteIcon fontSize="inherit" />
                                    </IconButton>
                                </Tooltip>
                            }
                            sx={{ pl: (level + 1) * 2, py: 0.1 }} // Indent occurrences
                        >
                           {/* Make the text clickable for scrolling */}
                           <ListItemButton
                                dense // Make item take less vertical space
                                onClick={() => onEntityClick(occ.id)} // Click text scrolls
                                sx={{ py: 0.1, mr: 4 }} // Add margin right to avoid overlap with button
                           >
                                <ListItemText
                                    primary={
                                        <Typography component="span" variant="caption">
                                            {renderValue(occ.value)}
                                        </Typography>
                                    }
                                    disableTypography
                                    sx={{ my: 0 }}
                                />
                           </ListItemButton>
                        </ListItem>
                    ))}

                    {/* Recursively render children */}
                    {hasRealChildren && Object.entries(entityData.children!).map(([childKey, childData]) => (
                         // Ensure we only render children that have a name (aren't just placeholders)
                         childData.name ? (
                             <NestedEntityItem
                                key={childKey}
                                entityName={`${entityName}.${childData.name}`} // Pass down full name for deletion
                                entityData={childData}
                                level={level + 1}
                                onEntityClick={onEntityClick}
                                onDeleteAnnotation={onDeleteAnnotation} // Pass down delete handler
                            />
                         ) : null
                    ))}
                 </List>
            </Collapse>
        </>
    );
};

function EntitiesSidebar({ extractionResult, isExtracting, onEntityClick, onDeleteAnnotation }: EntitiesSidebarProps) {

    const nestedEntities = useMemo(() => {
        if (!extractionResult || !extractionResult.entities) return {};
        return buildNestedStructure(extractionResult.entities);
    }, [extractionResult]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             {/* --- Simplified Header --- */}
             <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0, pb: 0, flexShrink: 0 }}>
                 <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                     Extracted Entities
                 </Typography>
                 {/* --- Removed Button From Here --- */}
             </Stack>
            <Divider sx={{ mb: 1, flexShrink: 0 }} />
            {/* --- End Header --- */}

            {/* --- Content is no longer conditional based on isCollapsed here --- */}
            {/* Loading / Empty States */}
             {isExtracting && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ ml: 2 }}>Loading Entities...</Typography>
                </Box>
            )}

            {!isExtracting && (!extractionResult || Object.keys(extractionResult.entities).length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    No entities extracted yet.
                </Typography>
            )}

             {/* Scrollable List Area */}
            <Box className="hide-scrollbar" sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
                {!isExtracting && extractionResult && Object.keys(nestedEntities).length > 0 && (
                    <List dense disablePadding sx={{ px: 0 }}>
                        {Object.entries(nestedEntities).map(([key, data]) => (
                            <NestedEntityItem
                                key={key}
                                entityName={key} // Pass down full name for deletion
                                entityData={data}
                                level={0}
                                onEntityClick={onEntityClick}
                                onDeleteAnnotation={onDeleteAnnotation}
                            />
                        ))}
                    </List>
                )}
            </Box>
            {/* --- End Content --- */}
        </Box>
    );
}

export default EntitiesSidebar;