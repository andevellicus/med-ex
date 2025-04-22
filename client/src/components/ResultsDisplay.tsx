// src/components/ResultsDisplay.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Box, Paper, Typography, Alert, CircularProgress } from '@mui/material';
import { ExtractionResult, EntityOccurrence, ScrollTarget } from '../types';

// --- Define Props ---
interface ResultsDisplayProps {
    extractionResult: ExtractionResult | null;
    isExtracting: boolean;
    extractionError: string | null;
    scrollToTarget: ScrollTarget | null; // Receive scroll target
    onScrollComplete: () => void; // Callback when scroll is done
}

// Define structure for combined highlights (value + context)
interface HighlightInfo {
    valueStart: number;
    valueEnd: number;
    contextStart: number;
    contextEnd: number;
    type: string;
    color: string;
    id: string;
}

// --- HighlightedText Component ---
const HighlightedText: React.FC<{
    text: string;
    entities: Record<string, EntityOccurrence[]>;
    scrollToTarget: ScrollTarget | null;
    onScrollComplete: () => void;
}> = ({ text, entities, scrollToTarget, onScrollComplete }) => {
    const containerRef = useRef<HTMLDivElement>(null);
     // State to briefly highlight the scrolled-to element's context
    const [activeContextId, setActiveContextId] = useState<string | null>(null);

    // --- Effect to handle scrolling ---
    useEffect(() => {
        if (scrollToTarget && containerRef.current) {
            // console.log("Effect: Scrolling to", scrollToTarget.id);
            const element = document.getElementById(scrollToTarget.id); // Find the <mark> element
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

                // Briefly highlight the context
                const contextElementId = `context-${scrollToTarget.id}`;
                setActiveContextId(contextElementId); // Set state to apply class/style

                // Optional: Flash the main entity highlight as well
                 element.style.transition = 'outline 0.1s ease-in-out';
                 element.style.outline = '2px solid red'; // Temporary outline

                // Remove highlights after a delay
                const timer = setTimeout(() => {
                    setActiveContextId(null);
                    if(element) element.style.outline = 'none'; // Remove outline
                    // onScrollComplete(); // Signal scroll attempt finished - might cause loop if state reset triggers effect again
                }, 1500); // Increased duration for visibility

                 return () => clearTimeout(timer); // Cleanup timer on unmount or re-run
            } else {
                console.warn(`Element with ID "${scrollToTarget.id}" not found for scrolling.`);
                // onScrollComplete(); // Signal even if not found
            }
        }
    }, [scrollToTarget, onScrollComplete]); // Depend on scrollToTarget

    // 1. Collect highlight details (value, context, color, id)
    const highlights: HighlightInfo[] = [];
    const colors = ['#a2d2ff', '#ffafcc', '#bde0fe', '#ffc8dd', '#cdb4db', '#ffddd2', '#fde4cf', '#fbf8cc', '#b9fbc0', '#98f5e1'];
    let colorIndex = 0;

    Object.entries(entities).forEach(([entityName, occurrences]) => {
        const color = colors[colorIndex % colors.length];
        colorIndex++;
        occurrences.forEach((occ, occIndex) => {
            const uniqueId = `entity-${entityName}-${occIndex}`;
            highlights.push({
                valueStart: occ.position.start,
                valueEnd: occ.position.end,
                contextStart: occ.context.position.start,
                contextEnd: occ.context.position.end,
                type: entityName,
                color,
                id: uniqueId,
            });
        });
    });

    // 2. Create a sorted list of all unique start/end points (value & context)
    const points = new Set<number>();
    highlights.forEach(h => {
        points.add(h.valueStart);
        points.add(h.valueEnd);
        points.add(h.contextStart);
        points.add(h.contextEnd);
    });
    const sortedPoints = Array.from(points).sort((a, b) => a - b);

    // 3. Build the output by iterating through segments
    const output: React.ReactNode[] = [];
    let currentPos = 0;

    sortedPoints.forEach(point => {
        if (point > currentPos) {
            // Process the segment before this point
            const segmentText = text.substring(currentPos, point);
            const segmentMid = currentPos + segmentText.length / 2;

            let isValue = false;
            let isContext = false;
            let valueColor = '';
            let contextColor = '';
            let valueId = ''; // ID belongs to the value span

            // Check which highlights cover this segment
            for (const h of highlights) {
                 if (segmentMid >= h.contextStart && segmentMid < h.contextEnd) {
                    isContext = true;
                    contextColor = h.color;
                    // If context is active, add its ID for styling
                    if (`context-entity-${h.type}-${highlights.findIndex(x => x.id === h.id)}` === activeContextId) {
                       // This logic needs refinement if activeContextId uses valueId
                    }
                }
                if (segmentMid >= h.valueStart && segmentMid < h.valueEnd) {
                    isValue = true;
                    valueColor = h.color;
                    valueId = h.id; // Assign ID if it's the value segment
                    break; // Prioritize value styling if overlapping
                }
            }

            let style: React.CSSProperties = { padding: '0px 1px', margin: '0', borderRadius: '3px' };
            const elementKey = `seg-${currentPos}-${point}`;
             let elementId: string | undefined = undefined;
             let contextElementId = `context-${valueId}`; // ID for the context span

            if (isValue) {
                style.backgroundColor = valueColor;
                style.cursor = 'pointer'; // Indicate value is clickable via list
                elementId = valueId; // Set the ID on the mark element
            }
            if (isContext) {
                // Assign context ID for potential styling
                // elementId = contextElementId; // No, ID should be on the value mark

                style.border = `1.5px dashed ${contextColor}`;
                // Add active style if this context should be highlighted
                if (activeContextId === contextElementId) {
                    style.border = `2px solid red`; // Example: change border if active
                    style.fontWeight = 'bold'; // Make text bold
                }
                 if (isValue) style.padding = '0px 1px'; // Keep padding minimal if also a value
                 else style.padding = '0px 1px'; // Padding for context-only span
            }


            if (isValue || isContext) {
                // Use 'mark' for value, 'span' otherwise
                 const Tag = isValue ? 'mark' : 'span';
                output.push(
                     <Tag key={elementKey} id={isValue ? elementId : contextElementId} style={style} title={isValue ? highlights.find(h=>h.id === valueId)?.type : undefined}>
                        {segmentText}
                    </Tag>
                );
            } else {
                output.push(<span key={elementKey}>{segmentText}</span>); // Plain text
            }
        }
        currentPos = point;
    });

    // Add any remaining text after the last point
    if (currentPos < text.length) {
        output.push(<span key="text-end">{text.substring(currentPos)}</span>);
    }

    // Wrap output in the ref'd container
    return (
        <div ref={containerRef}>
            <Typography component="div" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.8 }}>
                {output}
            </Typography>
        </div>
    );
};


// --- Main ResultsDisplay Component ---
function ResultsDisplay({ extractionResult, isExtracting, extractionError, scrollToTarget, onScrollComplete }: ResultsDisplayProps) {

    const renderContent = () => {
        if (isExtracting) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }}>Processing...</Typography>
                </Box>
            );
        }
        if (extractionError) {
            return <Alert severity="error" sx={{ m: 2 }}>{extractionError}</Alert>;
        }
        if (!extractionResult || !extractionResult.text) { // Check for text specifically
            return (
                 <Paper variant="outlined" sx={{ p: 3, mt: 2, minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <Typography sx={{ color: 'text.secondary' }}>
                         {isExtracting ? 'Loading...' : 'No results to display. Upload a file and click Extract.'}
                    </Typography>
                 </Paper>
            );
        }

        // Render only the HighlightedText component directly
        return (
             <Paper variant="outlined" sx={{ p: 3, mt: 2, /* Removed maxHeight, App controls scroll */ position: 'relative' /* For potential future absolute elements */ }}>
                 <HighlightedText
                    text={extractionResult.text}
                    entities={extractionResult.entities}
                    scrollToTarget={scrollToTarget}
                    onScrollComplete={onScrollComplete}
                 />
             </Paper>
        );
    };

    return (
        <>
            {/* Title can remain or be moved */}
            {/* <Typography variant="h5" gutterBottom> Results </Typography> */}
            {renderContent()}
        </>
    );
}

export default ResultsDisplay;