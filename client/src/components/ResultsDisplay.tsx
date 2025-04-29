// src/components/ResultsDisplay.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ExtractionResult, EntityOccurrence, ScrollTarget } from '../types';
import DisplayStateIndicator from './DisplayStateIndicator'; // Import new component

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

// --- HighlightedText Component (No structural changes needed here) ---
const HighlightedText: React.FC<{
    text: string;
    entities: Record<string, EntityOccurrence[]>;
    scrollToTarget: ScrollTarget | null;
    onScrollComplete: () => void;
}> = ({ text, entities, scrollToTarget }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeContextId, setActiveContextId] = useState<string | null>(null);

    useEffect(() => {
        if (scrollToTarget && containerRef.current) {
            const element = document.getElementById(scrollToTarget.id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

                const contextElementId = `context-${scrollToTarget.id}`;
                setActiveContextId(contextElementId);

                element.style.transition = 'outline 0.1s ease-in-out, box-shadow 0.1s ease-in-out';
                element.style.outline = '2px solid red'; // Keep outline for direct target
                element.style.boxShadow = '0 0 5px red'; // Add glow

                const timer = setTimeout(() => {
                    setActiveContextId(null);
                    if(element) {
                        element.style.outline = 'none';
                        element.style.boxShadow = 'none';
                    }
                    // Consider if onScrollComplete is needed here or if effect dependency is enough
                    // onScrollComplete();
                }, 1500);

                return () => clearTimeout(timer);
            } else {
                console.warn(`Element with ID "${scrollToTarget.id}" not found for scrolling.`);
                // Consider if onScrollComplete is needed here too
                // onScrollComplete();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollToTarget]); // Removed onScrollComplete from dependencies

    const highlights: HighlightInfo[] = [];
    const colors = ['#a2d2ff', '#ffafcc', '#bde0fe', '#ffc8dd', '#cdb4db', '#ffddd2', '#fde4cf', '#fbf8cc', '#b9fbc0', '#98f5e1'];
    let colorIndex = 0;

    Object.entries(entities).forEach(([entityName, occurrences]) => {
        const color = colors[colorIndex % colors.length];
        colorIndex++;
        occurrences.forEach((occ) => {
            const uniqueId = occ.id || `entity-<span class="math-inline">\{entityName\}\-</span>{occIndex}`;
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

    const points = new Set<number>();
    highlights.forEach(h => {
        points.add(h.valueStart);
        points.add(h.valueEnd);
        points.add(h.contextStart);
        points.add(h.contextEnd);
    });
    const sortedPoints = Array.from(points).sort((a, b) => a - b);

    const output: React.ReactNode[] = [];
    let currentPos = 0;

    sortedPoints.forEach(point => {
        if (point > currentPos) {
            const segmentText = text.substring(currentPos, point);
            if (!segmentText) {
                 currentPos = point;
                 return;
            }
            const segmentMid = currentPos + (point - currentPos) / 2;

            let isValue = false;
            let isContext = false;
            let valueColor = '';
            let valueId = '';
            let valueType = '';
            let bestMatch: HighlightInfo | null = null;

            for (const h of highlights) {
                 if (segmentMid >= h.valueStart && segmentMid < h.valueEnd) {
                     isValue = true;
                     valueColor = h.color;
                     valueId = h.id;
                     valueType = h.type;
                     bestMatch = h;
                     break;
                 }
                 if (!isValue && segmentMid >= h.contextStart && segmentMid < h.contextEnd) {
                     if (!bestMatch || (h.contextEnd - h.contextStart < bestMatch.contextEnd - bestMatch.contextStart)) {
                        isContext = true;
                        bestMatch = h;
                     }
                 }
            }

            if (bestMatch) {
                const style: React.CSSProperties = { padding: '1px 2px', margin: '0', borderRadius: '3px', display: 'inline', transition: 'all 0.15s ease-in-out' };
                const elementKey = `seg-<span class="math-inline">\{currentPos\}\-</span>{point}`;
                let elementId: string | undefined = undefined;
                const contextElementId = `context-${bestMatch.id}`;

                const segmentIsValue = isValue && bestMatch.id === valueId;
                const segmentIsContext = (isContext || segmentIsValue) && segmentMid >= bestMatch.contextStart && segmentMid < bestMatch.contextEnd;

                if (segmentIsValue) {
                    style.backgroundColor = valueColor;
                    style.cursor = 'pointer';
                    elementId = valueId;
                }

                if (segmentIsContext) {
                    const currentContextColor = bestMatch.color;
                    style.border = `1.5px dashed ${currentContextColor}`;

                    if (activeContextId === contextElementId) {
                        style.border = `1.5px solid ${currentContextColor}`; // Make border solid for active context
                        style.backgroundColor = segmentIsValue ? valueColor : `${currentContextColor}40`; // Add light background to active context spans
                        style.boxShadow = `0 0 3px ${currentContextColor}`;
                    }
                }

                const Tag = segmentIsValue ? 'mark' : 'span';
                const finalId = segmentIsValue ? elementId : undefined;

                output.push(
                    <Tag key={elementKey} id={finalId} style={style} title={segmentIsValue ? valueType : undefined}>
                        {segmentText}
                    </Tag>
                );
             } else {
                output.push(<span key={`seg-<span class="math-inline">\{currentPos\}\-</span>{point}`}>{segmentText}</span>);
            }
        }
        currentPos = point;
    });

    if (currentPos < text.length) {
        output.push(<span key="text-end">{text.substring(currentPos)}</span>);
    }

    return (
        // This div doesn't need specific styling anymore, parent handles padding/scroll
        <div ref={containerRef}>
            <Typography component="div" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.8 }}>
                {output}
            </Typography>
        </div>
    );
};


// --- Main ResultsDisplay Component ---
function ResultsDisplay({ extractionResult, isExtracting, extractionError, scrollToTarget, onScrollComplete }: ResultsDisplayProps) {

    const hasResultText = !!extractionResult?.text;

    return (
        // This Box is now the direct child of a Pane, let SplitPane handle height/scroll
         <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Render placeholder/loading/error states */}
            <DisplayStateIndicator
                 isExtracting={isExtracting}
                 extractionError={extractionError}
                 hasResultText={hasResultText}
             />

            {/* Render results only if not loading, no error, and result text exists */}
            {/* Wrap HighlightedText in a Box that can grow/scroll */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' /* Allow scroll if content overflows */ }}>
                {!isExtracting && !extractionError && hasResultText && extractionResult && (
                     <HighlightedText
                        text={extractionResult.text}
                        entities={extractionResult.entities}
                        scrollToTarget={scrollToTarget}
                        onScrollComplete={onScrollComplete}
                     />
                )}
             </Box>
        </Box>
    );
}

export default ResultsDisplay;