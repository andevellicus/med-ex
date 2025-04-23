// client/src/app/components/results-display/results-display.component.ts
// *** This requires significant refactoring ***

import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges, ViewChild, ElementRef, Renderer2, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog'; // For Add/Delete confirmation
import { MatButtonModule } from '@angular/material/button'; // For Dialog
import { MatFormFieldModule } from '@angular/material/form-field'; // For Dialog Dropdown
import { MatSelectModule } from '@angular/material/select'; // For Dialog Dropdown
import { FormsModule } from '@angular/forms'; // For Dialog ngModel

import { Subscription } from 'rxjs';

// Import Annotation Service and Types
import { AnnotationService } from '../../core/services/annotation.service';
import { UserAnnotation, ScrollTarget, SchemaDefinition } from '../../core/models/types'; // Adjusted imports

// Import the dialog component (create this next)
import { AnnotationDialogComponent, AnnotationDialogData } from './annotation-dialog/annotation-dialog.component';


// Define structure for processed segments to render
interface HighlightedSegment {
  text: string;
  isAnnotation: boolean;
  annotation?: UserAnnotation; // Include full annotation data
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
    MatDialogModule, // Add dialog module
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    AnnotationDialogComponent // Import the standalone dialog component
  ],
  templateUrl: './results-display.component.html',
  styleUrls: ['./results-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsDisplayComponent implements OnChanges, OnDestroy {

  @Input() isExtracting: boolean = false;
  @Input() extractionError: string | null = null;
  @Input() annotations: UserAnnotation[] | null = null; // Use UserAnnotation array
  @Input() originalText: string | null = null;       // Need the raw text
  @Input() entityTypes: string[] = [];               // List of types for dropdown
  @Input() scrollToTarget: ScrollTarget | null = null;

  @ViewChild('highlightedTextContainer') highlightedTextContainerRef!: ElementRef<HTMLDivElement>;

  highlightedSegments: HighlightedSegment[] = [];

  private activeHighlightId: string | null = null;
  private highlightTimeout: any = null;
  private annotationSub: Subscription | null = null; // To trigger updates

  constructor(
      private renderer: Renderer2,
      private annotationService: AnnotationService, // Inject service
      private dialog: MatDialog, // Inject MatDialog
      private changeDetectorRef: ChangeDetectorRef // Inject CDR
    ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Re-process highlights whenever annotations or original text changes
    if (changes['annotations'] || changes['originalText']) {
       this.processHighlights();
    }

    // Handle Scrolling (keep existing logic, but ensure element IDs match UserAnnotation IDs)
    if (changes['scrollToTarget'] && this.scrollToTarget && this.originalText) {
      console.log("ResultsDisplay: scrollToTarget changed:", this.scrollToTarget);
      // Use setTimeout to allow DOM update after ngOnChanges/highlight processing
      setTimeout(() => {
        if (this.highlightedTextContainerRef?.nativeElement) {
          this.executeScroll(this.scrollToTarget!.id);
        } else {
          console.warn("Container ref not ready for scrolling yet.");
        }
      }, 100); // Increased timeout slightly
    } else if (changes['scrollToTarget'] && !this.scrollToTarget) {
        // Clear highlight if scroll target is removed
        this.clearTemporaryHighlight();
    }
  }

  ngOnDestroy(): void {
      // Clean up subscription if needed (might not be necessary if using async pipe)
      // if (this.annotationSub) {
      //    this.annotationSub.unsubscribe();
      // }
      clearTimeout(this.highlightTimeout); // Clear any pending highlight removal
  }

  private processHighlights(): void {
    if (!this.originalText || !this.annotations) {
      this.highlightedSegments = this.originalText ? [{ text: this.originalText, isAnnotation: false }] : [];
      this.changeDetectorRef.markForCheck(); // Trigger update if text/annotations cleared
      return;
    }

    const text = this.originalText;
    // Ensure annotations are sorted by start position (AnnotationService should handle this)
    const sortedAnnotations = this.annotations; //.sort((a, b) => a.start - b.start);

    const segments: HighlightedSegment[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach(annotation => {
      // Add text segment before the current annotation (if any)
      if (annotation.start > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, annotation.start),
          isAnnotation: false,
        });
      }
      // Add the annotation segment itself
      segments.push({
        text: annotation.text, // Use text stored in annotation
        isAnnotation: true,
        annotation: annotation, // Pass the whole annotation object
      });
      lastIndex = annotation.end;
    });

    // Add any remaining text after the last annotation
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isAnnotation: false,
      });
    }

    this.highlightedSegments = segments;
     this.changeDetectorRef.markForCheck(); // Manually trigger change detection
     // console.log("Processed segments:", this.highlightedSegments);
  }

  // --- Text Selection Handling ---
  handleTextSelection(event: MouseEvent): void {
      if (this.isExtracting || !this.originalText) return; // Don't allow selection during extraction or without text

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          // console.log('No selection or collapsed selection');
          return;
      }

      const range = selection.getRangeAt(0);
      const containerElement = this.highlightedTextContainerRef.nativeElement;

      // --- Accurate Offset Calculation (CRITICAL & COMPLEX) ---
      // This is a simplified example. Robust calculation needs to handle
      // selections spanning multiple existing highlight nodes.
      // A common strategy is to iterate through text nodes within the container.
      let startOffset = -1;
      let endOffset = -1;

      try {
          // Check if selection is fully within our container
          if (!containerElement.contains(range.commonAncestorContainer)) {
              console.warn("Selection is outside the target container.");
              return;
          }

         // Create a temporary range covering the whole container content
          const containerRange = document.createRange();
          containerRange.selectNodeContents(containerElement);

          // Calculate start offset relative to container start
          const startRange = document.createRange();
          startRange.setStart(containerRange.startContainer, containerRange.startOffset);
          startRange.setEnd(range.startContainer, range.startOffset);
          // Use length of the text content of the range - handles nodes correctly
          startOffset = startRange.toString().length;


          // Calculate end offset relative to container start
          const endRange = document.createRange();
          endRange.setStart(containerRange.startContainer, containerRange.startOffset);
          endRange.setEnd(range.endContainer, range.endOffset);
          endOffset = endRange.toString().length;


          const selectedText = range.toString();

          if (startOffset < 0 || endOffset < 0 || startOffset >= endOffset) {
              console.error("Failed to calculate valid offsets.");
               window.getSelection()?.removeAllRanges(); // Clear selection
              return;
          }

           // --- Basic Overlap Check (can be improved) ---
          const overlaps = this.annotations?.some(ann =>
               (startOffset < ann.end && endOffset > ann.start) // Check for overlap
           );

          if (overlaps) {
               console.log("Selection overlaps existing annotation. Ignoring.");
               // Optional: Provide feedback to the user
               window.getSelection()?.removeAllRanges(); // Clear selection
               return; // Don't allow adding overlapping annotations easily
           }


          console.log(`Selection: "${selectedText}" | Start: ${startOffset} | End: ${endOffset}`);

          // Open Dialog to get entity type
          this.openAnnotationDialog(startOffset, endOffset, selectedText);


      } catch (e) {
            console.error("Error processing selection:", e);
      } finally {
           window.getSelection()?.removeAllRanges(); // Clear selection after processing
      }
  }

  // --- Annotation Click Handling ---
  handleAnnotationClick(annotation: UserAnnotation, event: MouseEvent): void {
    event.stopPropagation(); // Prevent triggering text selection handler
    console.log('Clicked annotation:', annotation);

    // Simple confirm dialog for deletion
    if (confirm(`Delete annotation "${annotation.text}" (${annotation.type})?`)) {
      this.annotationService.deleteAnnotation(annotation.id);
    }
  }

  // --- Dialog Opener ---
  openAnnotationDialog(start: number, end: number, text: string): void {
      const dialogRef = this.dialog.open<AnnotationDialogComponent, AnnotationDialogData, string | undefined>(AnnotationDialogComponent, { // Expect string | undefined result
          width: '350px',
          data: {
              selectedText: text,
              entityTypes: this.entityTypes // Pass available types
          }
      });

      dialogRef.afterClosed().subscribe(selectedType => {
          if (selectedType) { // Check if a type was actually selected
              console.log('Dialog closed, selected type:', selectedType);
              this.annotationService.addAnnotation(selectedType, start, end, text);
          } else {
              console.log('Annotation dialog cancelled.');
          }
      });
  }


  // --- Scrolling Logic (adapted for UserAnnotation IDs) ---
  private executeScroll(targetId: string): void {
    const element = document.getElementById(targetId); // Find the <mark> element by UserAnnotation ID
    if (element) {
        console.log(`Scrolling to element ID: ${targetId}`);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Removed 'inline' as it can conflict with block:center

        // Clear previous highlight immediately
        this.clearTemporaryHighlight();

        // Apply new active class and set timeout to remove it
        this.activeHighlightId = targetId;
        this.renderer.addClass(element, 'active-highlight');

        this.highlightTimeout = setTimeout(() => {
            this.clearTemporaryHighlight();
            // Optional: Emit scrollComplete event here if needed
        }, 1500); // Highlight duration

    } else {
        console.warn(`Element with ID "${targetId}" not found for scrolling.`);
        this.clearTemporaryHighlight(); // Ensure no stale highlight if element not found
        // Optional: Emit scrollComplete event here even if not found
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
}