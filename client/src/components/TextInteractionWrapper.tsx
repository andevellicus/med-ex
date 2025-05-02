// src/components/TextInteractionWrapper.tsx
import { useState, useRef, useCallback, ReactNode } from 'react';
import { Box } from '@mui/material';
import AnnotationPopup from './AnnotationPopup';

interface TextInteractionWrapperProps {
    children: ReactNode; // To render HighlightedText
    fullText: string | undefined | null; // The complete text for offset calculation
    availableEntityNames: string[];
    onAddAnnotation: (value: string, start: number, end: number, entityName: string) => void;
    disabled?: boolean; // Optionally disable selection/annotation
}

interface SelectionInfo {
    text: string;
    start: number;
    end: number;
    position: { top: number; left: number };
}

export function TextInteractionWrapper({
    children,
    fullText,
    availableEntityNames,
    onAddAnnotation,
    disabled = false,
}: TextInteractionWrapperProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
    const [showPopup, setShowPopup] = useState<boolean>(false);

    const handleTextSelection = useCallback(() => {
        if (disabled || !fullText) { // Check if disabled or text not available
             if (showPopup) setShowPopup(false); // Hide popup if disabled
             return;
         };

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !containerRef.current || !selection.rangeCount) {
            if (showPopup) setShowPopup(false);
             return;
        }

        const range = selection.getRangeAt(0);
        const selectedText = range.toString().trim();

        if (selectedText === '' || !containerRef.current.contains(range.commonAncestorContainer)) {
             if (showPopup) setShowPopup(false);
            return;
        }

        // --- Calculate Offsets (Simplified - Needs Robustness Check) ---
        let charStart = -1;
        let charEnd = -1;
        try {
            const containerElement = containerRef.current;
            const documentRange = document.createRange();
             documentRange.selectNodeContents(containerElement);
            const startRange = document.createRange();
             startRange.setStart(documentRange.startContainer, documentRange.startOffset);
             startRange.setEnd(range.startContainer, range.startOffset);
            charStart = startRange.toString().length;
            const endRange = document.createRange();
             endRange.setStart(documentRange.startContainer, documentRange.startOffset);
             endRange.setEnd(range.endContainer, range.endOffset);
             charEnd = endRange.toString().length;
            if (charEnd - charStart !== range.toString().length) {
                console.warn("Offset length mismatch, adjusting");
                charEnd = charStart + selectedText.length;
                const textSlice = fullText.substring(charStart, charEnd);
                  if (textSlice !== selectedText) {
                      console.error("CRITICAL: Offset validation failed.", { selectedText, textSlice, charStart, charEnd });
                      setShowPopup(false); return;
                  }
            }
            console.log("Selection calculation:", { selectedText, charStart, charEnd });
        } catch (error) {
            console.error("Error calculating selection offsets:", error);
            setShowPopup(false); return;
        }
        // --- End Offset Calculation ---

        const rect = range.getBoundingClientRect();
        setSelectionInfo({
            text: selectedText, start: charStart, end: charEnd,
            position: { top: rect.bottom + window.scrollY + 5, left: rect.left + window.scrollX + rect.width / 2 }
        });
        setShowPopup(true);

    }, [fullText, disabled, showPopup]); // Added showPopup dependency

    const closePopup = useCallback(() => {
        setShowPopup(false);
        // Optionally clear selection: window.getSelection()?.empty();
    }, []);

    const handleAnnotate = useCallback((entityName: string) => {
        if (selectionInfo && selectionInfo.start !== -1) {
            onAddAnnotation(selectionInfo.text, selectionInfo.start, selectionInfo.end, entityName);
        }
        closePopup();
    }, [selectionInfo, onAddAnnotation, closePopup]);

    return (
        <Box
            ref={containerRef}
            onMouseUp={handleTextSelection}
            sx={{ flexGrow: 1, overflow: 'auto', userSelect: 'text', p: 2, position: 'relative' }} // Styles moved from ResultsDisplay's inner Box
            className="hide-scrollbar" // Keep scrollbar hidden if desired
        >
            {children} {/* Render HighlightedText here */}

            {/* Render Annotation Popup */}
            {showPopup && selectionInfo && (
                <AnnotationPopup
                    open={showPopup}
                    anchorPosition={selectionInfo.position}
                    selectedText={selectionInfo.text}
                    entityNames={availableEntityNames}
                    onAnnotate={handleAnnotate}
                    onClose={closePopup}
                />
            )}
        </Box>
    );
}