import {
    Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges,
    ViewChild, ElementRef, Renderer2, ChangeDetectorRef, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms'; // For Dialog ngModel
import { Subscription } from 'rxjs';

// Import Annotation Service and Types
import { AnnotationService } from '../../core/services/annotation.service';
import { UserAnnotation, ScrollTarget, SchemaDefinition } from '../../core/models/types'; // Adjusted imports

// Import the dialog component
import { AnnotationDialogComponent, AnnotationDialogData } from './annotation-dialog/annotation-dialog.component';

// Define structure for processed segments to render
interface HighlightedSegment {
    text: string;
    isAnnotation: boolean;
    isContext: boolean; // Added flag
    annotation?: UserAnnotation;
    contextForAnnotationId?: string; // Added optional ID link
}

@Component({
    selector: 'app-results-display',
    standalone: true,
    imports: [
        CommonModule,
        MatProgressSpinnerModule,
        MatCardModule,
        MatExpansionModule,
        MatIconModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        FormsModule,
    ],
    templateUrl: './results-display.component.html',
    styleUrls: ['./results-display.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsDisplayComponent implements OnChanges, OnDestroy {

    @Input() isExtracting: boolean = false;
    @Input() extractionError: string | null = null;
    @Input() annotations: UserAnnotation[] | null = null;
    @Input() originalText: string | null = null;
    @Input() entityTypes: string[] = [];
    @Input() scrollToTarget: ScrollTarget | null = null;

    @ViewChild('highlightedTextContainer') highlightedTextContainerRef!: ElementRef<HTMLDivElement>;

    highlightedSegments: HighlightedSegment[] = [];

    private activeHighlightId: string | null = null;
    private highlightTimeout: any = null;
    // private annotationSub: Subscription | null = null; // Not strictly needed if relying on @Input changes

    constructor(
        private renderer: Renderer2,
        private annotationService: AnnotationService,
        private dialog: MatDialog,
        private changeDetectorRef: ChangeDetectorRef
    ) { }

    ngOnChanges(changes: SimpleChanges): void {
        // Re-process highlights whenever annotations or original text changes
        if (changes['annotations'] || changes['originalText']) {
            this.processHighlights();
        }

        // Handle Scrolling
        if (changes['scrollToTarget'] && this.scrollToTarget && this.originalText) {
            console.log("ResultsDisplay: scrollToTarget changed:", this.scrollToTarget);
            setTimeout(() => {
                if (this.highlightedTextContainerRef?.nativeElement) {
                    this.executeScroll(this.scrollToTarget!.id);
                } else {
                    console.warn("Container ref not ready for scrolling yet.");
                }
            }, 150); // Adjusted timeout slightly
        } else if (changes['scrollToTarget'] && !this.scrollToTarget) {
            this.clearTemporaryHighlight();
        }
    }

    ngOnDestroy(): void {
        clearTimeout(this.highlightTimeout);
    }

    handleTextSelection(event: MouseEvent): void {
        if (this.isExtracting || !this.originalText) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return;
        }

        const range = selection.getRangeAt(0);
        const containerElement = this.highlightedTextContainerRef.nativeElement;

        // Basic check if selection happened within the container
        // Note: Even if outside, range.toString() might capture intended text,
        // so we proceed but the indexOf result might be less certain to be the "intended" one.
        if (!containerElement.contains(range.commonAncestorContainer)) {
            console.warn("Selection occurred potentially outside the target container.");
        }

        const valueText = range.toString();
        if (!valueText) { // Ignore empty selections
            window.getSelection()?.removeAllRanges();
            return;
        }

        let startOffset = -1;
        let endOffset = -1;

        try {
            // --- Step 1: Search for the selected text in originalText ---
            // This finds the FIRST occurrence of the selected text string.
            startOffset = this.originalText.indexOf(valueText);

            // --- Step 2: Validate Search Result ---
            if (startOffset === -1) {
                console.error("Selected text could not be found within the original text. Check for subtle differences like whitespace or ensure the text exists.", { valueText });
                // Provide more specific feedback to the user
                alert(`Error: Could not locate the exact text "${valueText}" in the document. Please ensure you selected the complete text accurately.`);
                window.getSelection()?.removeAllRanges();
                return; // Stop if not found
            }

            // Calculate end offset based on the found start and the length of the selected text
            endOffset = startOffset + valueText.length;

            // --- Step 3: VERIFY Match ---
            // This check ensures the calculated offsets correctly extract the selected text string
            // from the originalText. It should always pass if indexOf found the exact string.
            const extractedSlice = this.originalText.substring(startOffset, endOffset);

            if (valueText !== extractedSlice) {
                // If this fails, it indicates a very unusual issue, potentially with
                // non-standard characters or a bug in how selection/substring works.
                console.error("OFFSET MISMATCH (indexOf Method): Substring result doesn't match selection. This is unexpected.");
                alert("Internal Error: Offset mismatch after finding text (Code: IDX). Annotation not added.");
                window.getSelection()?.removeAllRanges();
                return;
            }

            // --- Step 4: Overlap Check ---
            // Checks if the calculated span overlaps with any existing annotations
            const overlaps = this.annotations?.some(ann =>
                (startOffset < ann.end && endOffset > ann.start)
            );
            if (overlaps) {
                alert("Selection overlaps with an existing annotation.");
                window.getSelection()?.removeAllRanges();
                return;
            }

            // --- Step 5: Context Generation (Simplified for this approach) ---
            // Generate context based on the found offsets. Remember this context
            // will correspond to the FIRST occurrence found by indexOf.
            let contextStart = Math.max(0, startOffset - 30); // Approx 30 chars before
            let contextEnd = Math.min(this.originalText.length, endOffset + 30); // Approx 30 chars after
            let contextText = this.originalText.substring(contextStart, contextEnd);

            console.log(`Found Match: Value [${startOffset}-${endOffset}], Approx Context [${contextStart}-${contextEnd}]`);

            // --- Step 6: Open Dialog ---
            // Pass the calculated (and verified) offsets and the simplified context
            this.openAnnotationDialog(
                startOffset,
                endOffset,
                valueText,
                contextText,
                contextStart,
                contextEnd
            );

        } catch (e) {
            console.error("Error processing text selection:", e);
            // Optional: Provide user feedback about the error
            alert("An unexpected error occurred while processing the text selection.");
        } finally {
            // Ensure browser selection is cleared regardless of success or failure
            window.getSelection()?.removeAllRanges();
        }
    }

    // --- Annotation Click Handler ---
    handleAnnotationClick(annotation: UserAnnotation, event: MouseEvent): void {
        event.stopPropagation(); // Prevent triggering text selection handler
        console.log('Clicked annotation:', annotation);

        // Simple confirm dialog for deletion
        // Consider using MatDialog for a more consistent UI
        if (confirm(`Delete annotation "${annotation.text}" (${annotation.type})?`)) {
            this.annotationService.deleteAnnotation(annotation.id);
        }
    }


    // --- Dialog Opener ---
    openAnnotationDialog(
        valueStart: number,
        valueEnd: number,
        valueText: string,
        // Context details needed after dialog closes
        contextText: string,
        contextStart: number,
        contextEnd: number
     ): void {
        const dialogRef = this.dialog.open<AnnotationDialogComponent, AnnotationDialogData, string | undefined>(AnnotationDialogComponent, {
            width: '350px',
            disableClose: true, // Prevent closing by clicking outside or pressing Esc
            data: {
                selectedText: valueText, // Dialog only needs value text to display
                entityTypes: this.entityTypes
            }
        });

        dialogRef.afterClosed().subscribe(selectedType => {
            if (selectedType) { // Check if a type was actually selected (user didn't cancel)
                console.log('Dialog closed, selected type:', selectedType);
                // Call addAnnotation with ALL details (value + context)
                this.annotationService.addAnnotation(
                    selectedType,
                    valueStart,
                    valueEnd,
                    valueText,
                    contextText,  // Pass generated context
                    contextStart, // Pass generated context start
                    contextEnd    // Pass generated context end
                 );
            } else {
                console.log('Annotation dialog cancelled.');
            }
        });
    }

    // --- Highlight Processing ---
private processHighlights(): void {
    console.log('--- Running processHighlights ---'); // Log start

    if (!this.originalText) {
        this.highlightedSegments = [];
        this.changeDetectorRef.markForCheck();
        console.log('processHighlights: No original text.');
        return;
    }
     if (!this.annotations) {
          this.highlightedSegments = [{ text: this.originalText, isAnnotation: false, isContext: false }];
          this.changeDetectorRef.markForCheck();
          console.log('processHighlights: No annotations.');
          return;
      }

    // Log the inputs it's working with *at this moment*
    console.log('processHighlights: Annotations count:', this.annotations.length);
    // console.log('processHighlights: Annotations data:', JSON.stringify(this.annotations)); // Careful, can be large

    const text = this.originalText;
    const segments: HighlightedSegment[] = [];

    // 1. Log the points being considered
    const points = new Set<number>([0, text.length]);
    this.annotations.forEach(a => {
        points.add(a.start);
        points.add(a.end);
        if (typeof a.contextStart === 'number') points.add(a.contextStart);
        if (typeof a.contextEnd === 'number') points.add(a.contextEnd);
    });
    const sortedPoints = Array.from(points).sort((a, b) => a - b);
    console.log('processHighlights: Sorted Points:', sortedPoints);

    // 3. Log inside the loop
    for (let i = 0; i < sortedPoints.length; i++) {
        const p1 = sortedPoints[i];
        const p2 = (i + 1 < sortedPoints.length) ? sortedPoints[i + 1] : text.length;

        if (p1 >= p2 || p1 < 0 || p2 > text.length) continue;

        const segmentText = text.substring(p1, p2);
        const checkPoint = p1; // Check containment based on start point

        console.log(`--- Iteration ${i}: p1=${p1}, p2=${p2}, checkPoint=${checkPoint}, segmentText="${segmentText}"`);

        let isAnnotationSegment = false;
        let isContextSegment = false;
        let segmentAnnotation: UserAnnotation | undefined = undefined;
        let contextForId: string | undefined = undefined;

        // Log annotation checks
        for (const annotation of this.annotations) {
            const isAnno = checkPoint >= annotation.start && checkPoint < annotation.end;
            // Log check for the specific annotation if needed
            // if (annotation.id === 'YOUR_PROBLEM_ANNOTATION_ID') {
            //    console.log(`Checking PROBLEM annotation (${annotation.id}): checkPoint=${checkPoint}, start=${annotation.start}, end=${annotation.end} -> isAnno=${isAnno}`);
            // }
            if (isAnno) {
                console.log(`   Segment [${p1}-${p2}] IS Annotation: ${annotation.id} ("${annotation.text}")`);
                isAnnotationSegment = true;
                segmentAnnotation = annotation;
                // Check context containment as well
                const isCtx = typeof annotation.contextStart === 'number' && typeof annotation.contextEnd === 'number' &&
                              checkPoint >= annotation.contextStart && checkPoint < annotation.contextEnd;
                 if (isCtx) {
                      console.log(`   Segment [${p1}-${p2}] IS ALSO Context for: ${annotation.id}`);
                      isContextSegment = true;
                      contextForId = annotation.id;
                 }
                break;
            }
        }

        // Log context-only checks
        if (!isAnnotationSegment) {
            for (const annotation of this.annotations) {
                 const isCtx = typeof annotation.contextStart === 'number' && typeof annotation.contextEnd === 'number' &&
                               checkPoint >= annotation.contextStart && checkPoint < annotation.contextEnd;
                 if (isCtx) {
                      console.log(`   Segment [${p1}-${p2}] IS Context ONLY for: ${annotation.id}`);
                      isContextSegment = true;
                      contextForId = annotation.id;
                      break;
                 }
            }
        }

        if (!isAnnotationSegment && !isContextSegment) {
             console.log(`   Segment [${p1}-${p2}] is PLAIN text.`);
        }

            segments.push({
                text: segmentText,
                isAnnotation: isAnnotationSegment,
                isContext: isContextSegment,
                annotation: segmentAnnotation,
                contextForAnnotationId: contextForId,
            });
        }

        this.highlightedSegments = segments.filter(s => s.text.length > 0);
        // Log the final result before render
        // console.log('processHighlights: Final Segments:', JSON.stringify(this.highlightedSegments)); // Careful, can be large
        console.log('--- Finished processHighlights ---');
        this.changeDetectorRef.markForCheck();
    } // End processHighlights

    // --- Scrolling Logic ---
    private executeScroll(targetId: string): void {
        const element = document.getElementById(targetId);
        if (element) {
            console.log(`Scrolling to element ID: ${targetId}`);
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.clearTemporaryHighlight(); // Clear previous immediately
            this.activeHighlightId = targetId;
            this.renderer.addClass(element, 'active-highlight');
            this.highlightTimeout = setTimeout(() => {
                this.clearTemporaryHighlight();
            }, 1500);
        } else {
            console.warn(`Element with ID "${targetId}" not found for scrolling.`);
            this.clearTemporaryHighlight();
        }
    }

    private clearTemporaryHighlight(): void {
        if (this.highlightTimeout) {
            clearTimeout(this.highlightTimeout);
            this.highlightTimeout = null;
        }
        if (this.activeHighlightId) {
            const previousElement = document.getElementById(this.activeHighlightId);
            if (previousElement) {
                this.renderer.removeClass(previousElement, 'active-highlight');
            }
            this.activeHighlightId = null;
        }
    }

    // Helper to prevent default context menu on highlighted text
    preventContextMenu(event: MouseEvent): void {
        event.preventDefault();
    }

} // --- End of ResultsDisplayComponent Class ---