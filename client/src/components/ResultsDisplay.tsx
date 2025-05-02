// src/components/ResultsDisplay.tsx
import React, { useRef, useState, useEffect } from 'react'; // Keep necessary React imports for HighlightedText
import { Box, Typography } from '@mui/material';
import { ExtractionResult, EntityOccurrence, ScrollTarget } from '../types'; // Import needed types
import DisplayStateIndicator from './DisplayStateIndicator';
// Import the wrapper component
import { TextInteractionWrapper } from './TextInteractionWrapper';
// Assuming AnnotationPopup is used internally by TextInteractionWrapper now

// --- Define Props ---
interface ResultsDisplayProps {
    extractionResult: ExtractionResult | null;
    isExtracting: boolean;
    extractionError: string | null;
    scrollToTarget: ScrollTarget | null;
    availableEntityNames: string[]; // <-- Accept entity names
    onAddAnnotation: (value: string, start: number, end: number, entityName: string) => void; // <-- Accept handler
}

// --- Define HighlightedText Component Props ---
// (Moved interface definition closer to component)
interface HighlightedTextProps {
    text: string;
    entities: Record<string, EntityOccurrence[]>;
    scrollToTarget: ScrollTarget | null;
}

// --- HighlightedText Component (Implementation Detail) ---
// This component now focuses solely on rendering the text with highlights
const HighlightedText: React.FC<HighlightedTextProps> = React.memo(({
    text,
    entities,
    scrollToTarget
}) => {
    const containerRef = useRef<HTMLDivElement>(null); // Ref for the scroll container DIV
    const [activeContextId, setActiveContextId] = useState<string | null>(null); // For temporary context highlight

    // --- Effect for scrolling to entity ---
    useEffect(() => {
        if (scrollToTarget?.id && containerRef.current) {
            // Use timeout to ensure element exists after potential re-render
            setTimeout(() => {
                const element = document.getElementById(scrollToTarget.id);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Highlight context temporarily
                    const contextElementId = `context-${scrollToTarget.id}`;
                    setActiveContextId(contextElementId);

                    // Highlight the element itself temporarily
                    element.style.transition = 'outline 0.1s ease-in-out, box-shadow 0.1s ease-in-out';
                    element.style.outline = '2px solid red';
                    element.style.boxShadow = '0 0 5px red';

                    const timer = setTimeout(() => {
                        setActiveContextId(null); // Clear context highlight state
                        if(element) { // Check if element still exists
                           element.style.outline = 'none';
                           element.style.boxShadow = 'none';
                        }
                    }, 1500); // Duration of element highlight

                    // Cleanup timeout on unmount or if target changes
                    return () => clearTimeout(timer);
                } else {
                     console.warn(`Element with ID "${scrollToTarget.id}" not found for scrolling.`);
                }
            }, 0); // Timeout 0 allows DOM to update first
        }
    }, [scrollToTarget]); // Re-run if scrollToTarget changes


    // --- Generate Highlighted Output (Memoize if complex) ---
    // This calculation can be memoized using useMemo if performance becomes an issue
    const output: React.ReactNode[] = (() => {
        // Interface for internal highlight processing
        interface HighlightInfo {
            valueStart: number; valueEnd: number;
            contextStart: number; contextEnd: number;
            type: string; color: string; id: string;
        }

        const highlights: HighlightInfo[] = [];
        // Consistent color palette
        const colors = ['#a2d2ff', '#ffafcc', '#bde0fe', '#ffc8dd', '#cdb4db', '#ffddd2', '#fde4cf', '#fbf8cc', '#b9fbc0', '#98f5e1'];
        let colorIndex = 0;

        // Flatten entities into highlight list
        Object.entries(entities || {}).forEach(([entityName, occurrences]) => {
            const color = colors[colorIndex % colors.length];
            colorIndex++;
            occurrences.forEach((occ) => { // No index needed if ID comes from backend/hook
                // Ensure ID exists (should come from backend or addAnnotation)
                if (!occ.id) {
                    console.warn("Occurrence missing ID:", occ);
                    return; // Skip occurrences without IDs
                }
                highlights.push({
                    valueStart: occ.position.start, valueEnd: occ.position.end,
                    contextStart: occ.context.position.start, contextEnd: occ.context.position.end,
                    type: entityName, color, id: occ.id,
                });
            });
        });

        // Get all unique boundary points
        const points = new Set<number>([0, text.length]); // Include start and end of text
        highlights.forEach(h => {
            points.add(h.valueStart); points.add(h.valueEnd);
            points.add(h.contextStart); points.add(h.contextEnd);
        });
        const sortedPoints = Array.from(points).sort((a, b) => a - b);

        // Build segments
        const segments: React.ReactNode[] = [];
        let currentPos = 0;
        sortedPoints.forEach((point) => {
            if (point > currentPos && point <= text.length) { // Ensure point is within bounds
                const segmentText = text.substring(currentPos, point);
                if (!segmentText) { // Skip empty segments
                    currentPos = point;
                    return;
                }

                const segmentMid = currentPos + (segmentText.length / 2);
                let bestMatch: HighlightInfo | null = null;
                let isValue = false;

                // Find the most specific highlight covering this segment's midpoint
                for (const h of highlights) {
                    if (segmentMid > h.valueStart && segmentMid <= h.valueEnd) {
                        bestMatch = h;
                        isValue = true;
                        break; // Value match takes precedence
                    }
                    if (!isValue && segmentMid > h.contextStart && segmentMid <= h.contextEnd) {
                         // Smallest context wins if multiple contexts overlap
                        if (!bestMatch || (h.contextEnd - h.contextStart < bestMatch.contextEnd - bestMatch.contextStart)) {
                            bestMatch = h;
                        }
                    }
                }

                const elementKey = `seg-${currentPos}-${point}`;
                if (bestMatch) {
                    const style: React.CSSProperties = { padding: '1px 0px', margin: '0', borderRadius: '3px', display: 'inline' };
                    const Tag = isValue ? 'mark' : 'span';
                    const finalId = isValue ? bestMatch.id : undefined;
                    const contextElementId = `context-${bestMatch.id}`;
                    const segmentIsContext = (bestMatch && segmentMid > bestMatch.contextStart && segmentMid <= bestMatch.contextEnd);

                    if (isValue) {
                        style.backgroundColor = bestMatch.color;
                        style.cursor = 'pointer'; // Indicate clickability (for scrolling)
                    }
                    if (segmentIsContext) {
                        style.border = `1.5px dashed ${bestMatch.color}80`; // Dashed border for context (with transparency)
                        if (activeContextId === contextElementId) {
                            style.border = `1.5px solid ${bestMatch.color}`; // Solid border when active
                            style.boxShadow = `0 0 3px ${bestMatch.color}`;
                             // Slightly enhance background when context is active
                            style.backgroundColor = isValue ? bestMatch.color : `${bestMatch.color}40`; // Keep value color or add context bg tint
                        }
                    }
                     // Add transition for smoother context highlighting
                    style.transition = 'border 0.2s ease-in-out, background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out';

                    segments.push(
                        <Tag key={elementKey} id={finalId} style={style} title={isValue ? bestMatch.type : undefined}>
                            {segmentText}
                        </Tag>
                    );
                } else {
                    // Non-highlighted text
                    segments.push(<span key={elementKey}>{segmentText}</span>);
                }
            }
            currentPos = point;
        });

        return segments;
    })(); // Immediately invoke the function to get the result

    // The outer div has the ref for scrollIntoView calculations
    return (
        <div ref={containerRef}>
            <Typography component="div" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.8 }}>
                {output}
            </Typography>
        </div>
    );
});
// Add display name for React DevTools
HighlightedText.displayName = 'HighlightedText';


// --- Main ResultsDisplay Component ---
function ResultsDisplay({
    extractionResult,
    isExtracting,
    extractionError,
    scrollToTarget,
    availableEntityNames, // Accept props
    onAddAnnotation     // Accept props
}: ResultsDisplayProps) {

    return (
        // Outer container Box
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Shows Loading/Error/No Results states */}
            <DisplayStateIndicator
                isExtracting={isExtracting}
                extractionError={extractionError}
                hasResultText={!!extractionResult?.text}
            />

            {/* Wrapper handles text interaction (selection, popup) */}
            <TextInteractionWrapper
                 fullText={extractionResult?.text}
                 availableEntityNames={availableEntityNames}
                 onAddAnnotation={onAddAnnotation}
                 disabled={isExtracting || !!extractionError} // Disable interaction when busy/error
            >
                {/* Render HighlightedText only when there's text */}
                {extractionResult?.text && (
                     <HighlightedText
                         text={extractionResult.text}
                         // Ensure entities is passed, default to empty object if null/undefined
                         entities={extractionResult.entities || {}}
                         scrollToTarget={scrollToTarget}
                    />
                 )}
                 {/* Show placeholder if no text but not extracting/error */}
                 {!isExtracting && !extractionError && !extractionResult?.text && (
                     <Typography sx={{ p: 2, color: 'text.secondary', textAlign: 'center', mt: 4 }}>
                         Upload a file and extract entities to see results.
                     </Typography>
                 )}
            </TextInteractionWrapper>
        </Box>
    );
}

export default ResultsDisplay;