// src/components/CollapseToggleButton.tsx
import { IconButton, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';

interface CollapseToggleButtonProps {
    isCollapsed: boolean;
    onClick: () => void;
    ariaLabel: string;
    tooltipPlacement: 'left' | 'right' | 'top' | 'bottom';
    sx?: object; // Allow passing custom styles
}

function CollapseToggleButton({
    isCollapsed,
    onClick,
    ariaLabel,
    tooltipPlacement,
    sx = {}
}: CollapseToggleButtonProps) {
    const tooltipTitle = isCollapsed ? `Expand` : `Collapse`;
    // Flip MenuOpenIcon for collapsing right sidebar
    const icon = isCollapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" sx={tooltipPlacement === 'left' ? { transform: 'scaleX(-1)' } : {}} />;

    return (
        <Tooltip title={tooltipTitle} placement={tooltipPlacement}>
            <IconButton
                aria-label={ariaLabel}
                onClick={onClick}
                size="small"
                sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'action.hover',
                    '&:hover': { backgroundColor: 'action.selected' },
                    ...sx // Merge custom styles
                }}
            >
                {icon}
            </IconButton>
        </Tooltip>
    );
}

export default CollapseToggleButton;