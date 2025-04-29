// src/components/ResultsDisplay.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ExtractionResult, EntityOccurrence, ScrollTarget } from '../types';
import DisplayStateIndicator from './DisplayStateIndicator';

// --- Define Props ---
interface ResultsDisplayProps {
    extractionResult: ExtractionResult | null;
    isExtracting: boolean;
    extractionError: string | null;
    scrollToTarget: ScrollTarget | null;
    onScrollComplete: () => void;
}

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
}> = ({ text, entities, scrollToTarget}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeContextId, setActiveContextId] = useState<string | null>(null);

    // Effect for scrolling (keep the log here)
    useEffect(() => {
        if (scrollToTarget && containerRef.current) {
            const element = document.getElementById(scrollToTarget.id);
            if (element) {
                // ... scroll and highlight logic ...
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                const contextElementId = `context-${scrollToTarget.id}`;
                setActiveContextId(contextElementId);
                element.style.transition = 'outline 0.1s ease-in-out, box-shadow 0.1s ease-in-out';
                element.style.outline = '2px solid red';
                element.style.boxShadow = '0 0 5px red';
                const timer = setTimeout(() => {
                    setActiveContextId(null);
                    if(element) {
                        element.style.outline = 'none';
                        element.style.boxShadow = 'none';
                    }
                }, 1500);
                return () => clearTimeout(timer);
            } else {
                console.warn(`Element with ID "${scrollToTarget.id}" not found for scrolling.`);
            }
        }
    }, [scrollToTarget]);

    // 1. Collect highlight details - Ensure uniqueId uses backticks correctly
    const highlights: HighlightInfo[] = [];
    const colors = ['#a2d2ff', '#ffafcc', '#bde0fe', '#ffc8dd', '#cdb4db', '#ffddd2', '#fde4cf', '#fbf8cc', '#b9fbc0', '#98f5e1'];
    let colorIndex = 0;

    Object.entries(entities).forEach(([entityName, occurrences]) => {
        const color = colors[colorIndex % colors.length];
        colorIndex++;
        occurrences.forEach((occ, occIndex) => {
            const uniqueId = occ.id || `entity-${entityName}-${occIndex}`;

            highlights.push({
                valueStart: occ.position.start,
                valueEnd: occ.position.end,
                contextStart: occ.context.position.start,
                contextEnd: occ.context.position.end,
                type: entityName,
                color,
                id: uniqueId, // Assign the evaluated string here
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
                     valueId = h.id; // Assign the correct ID string from HighlightInfo
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
                const elementKey = `seg-${currentPos}-${point}`;
                const contextElementId = `context-${bestMatch.id}`;

                const segmentIsValue = isValue && bestMatch.id === valueId;
                const segmentIsContext = (isContext || segmentIsValue) && segmentMid >= bestMatch.contextStart && segmentMid < bestMatch.contextEnd;

                const finalId = segmentIsValue ? valueId : undefined; // Use the valueId derived from bestMatch.id

                if (segmentIsValue) {
                    style.backgroundColor = valueColor;
                    style.cursor = 'pointer';
                }

                if (segmentIsContext) {
                    const currentContextColor = bestMatch.color;
                    style.border = `1.5px dashed ${currentContextColor}`;
                    if (activeContextId === contextElementId) {
                        style.border = `1.5px solid ${currentContextColor}`;
                        style.backgroundColor = segmentIsValue ? valueColor : `${currentContextColor}40`;
                        style.boxShadow = `0 0 3px ${currentContextColor}`;
                    }
                }

                const Tag = segmentIsValue ? 'mark' : 'span';

                output.push(
                    <Tag key={elementKey} id={finalId} style={style} title={segmentIsValue ? valueType : undefined}>
                        {segmentText}
                    </Tag>
                );
             } else {
                output.push(<span key={`seg-${currentPos}-${point}`}>{segmentText}</span>);
            }
        }
        currentPos = point;
    });

    if (currentPos < text.length) {
        output.push(<span key="text-end">{text.substring(currentPos)}</span>);
    }

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
    // ... same as before ...
     const hasResultText = !!extractionResult?.text;
        return (
             <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <DisplayStateIndicator
                     isExtracting={isExtracting}
                     extractionError={extractionError}
                     hasResultText={hasResultText}
                 />
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
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