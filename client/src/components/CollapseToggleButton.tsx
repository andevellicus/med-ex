// src/components/CollapseToggleButton.tsx
import { IconButton, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';

interface CollapseToggleButtonProps {
    isCollapsed: boolean;
    onClick: () => void;
    ariaLabel: string;
    tooltipPlacement: 'left' | 'right' | 'top' | 'bottom';
    sideBarSide: 'left' | 'right';
    sx?: object; // Allow passing custom styles
}

function CollapseToggleButton({
    isCollapsed,
    onClick,
    ariaLabel,
    tooltipPlacement,
    sideBarSide,
    sx = {}
}: CollapseToggleButtonProps) {
    const tooltipTitle = isCollapsed ? `Expand` : `Collapse`;
    const transformStyle = sideBarSide === 'right' ? { transform: 'scale(-1)' } : {};
    const icon = isCollapsed ? <MenuIcon fontSize="small" /> : 
        <MenuOpenIcon fontSize="small" sx={transformStyle} />;

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