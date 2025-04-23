// src/app/components/results-display/results-display.component.ts
import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges, ViewChild, ElementRef, Renderer2, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';

// Import necessary types
import { ExtractionResult, EntityOccurrence, ScrollTarget } from '../../core/models/types';

// Define structure for processed segments to render
interface HighlightedSegment {
  text: string;
  isEntityValue: boolean;
  isEntityContext: boolean;
  entityType?: string; // e.g., 'PatientName', 'Medication'
  entityId?: string; // Unique ID for scrolling, e.g., "entity-PatientName-0"
  backgroundColor?: string; // For entity value
  borderColor?: string; // For entity context
}

@Component({
  selector: 'app-results-display',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatExpansionModule,
    MatIconModule
  ],
  templateUrl: './results-display.component.html',
  styleUrls: ['./results-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsDisplayComponent implements OnChanges, AfterViewInit { // Implement OnChanges

  @Input() extractionResult: ExtractionResult | null = null;
  @Input() isExtracting: boolean = false;
  @Input() extractionError: string | null = null;
  @Input() scrollToTarget: ScrollTarget | null = null; // For scroll handling

  @ViewChild('highlightedTextContainer') highlightedTextContainerRef!: ElementRef<HTMLDivElement>; // Reference to the container for scrolling

  // Property to hold the processed segments for rendering
  highlightedSegments: HighlightedSegment[] = [];

  // Define colors for highlighting
  private highlightColors = ['#a2d2ff', '#ffafcc', '#bde0fe', '#ffc8dd', '#cdb4db', '#ff9573', '#f7b57e', '#bfb636', '#076912', '#98f5e1'];
  private activeHighlightId: string | null = null;
  private highlightTimeout: any = null; // For managing scroll timeout

  constructor(private renderer: Renderer2) { }

  ngAfterViewInit(): void {
    if (this.scrollToTarget) {
      this.executeScroll(this.scrollToTarget.id);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    let processNeeded = false;
    // Check if extractionResult input has changed and has a valid value
    if (changes['extractionResult']) {
      processNeeded = true;
      if (!this.extractionResult) {
        this.highlightedSegments = [];
        processNeeded = false;
      }
    }

    if (processNeeded && this.extractionResult?.text) {
      this.processHighlights(this.extractionResult);
    }

    // --- Handle Scrolling ---
    if (changes['scrollToTarget'] && this.scrollToTarget) {
      console.log("ResultsDisplay: scrollToTarget changed:", this.scrollToTarget);
      // Ensure the container is ready before attempting to find the element
      // Use setTimeout to allow the DOM to update after ngOnChanges completes
      setTimeout(() => {
        if (this.highlightedTextContainerRef?.nativeElement) { // Check if container exists
          this.executeScroll(this.scrollToTarget!.id);
        } else {
          console.warn("Container ref not ready for scrolling yet.");
          // ngAfterViewInit will handle scrolling if target was set early
        }
      }, 0);
    }
  }

  private executeScroll(targetId: string): void {
    const element = document.getElementById(targetId); // Find the <mark> element by ID
    if (element) {
        console.log(`Scrolling to element ID: ${targetId}`);
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

        // --- Temporary Highlighting ---
        // Clear previous timeout and styles if any
        if (this.highlightTimeout) {
            clearTimeout(this.highlightTimeout);
        }
        // Remove previous active class if applicable
        if (this.activeHighlightId) {
           const previousElement = document.getElementById(this.activeHighlightId);
           if (previousElement) {
             this.renderer.removeClass(previousElement, 'active-highlight');
           }
        }

        // Apply new active class and set timeout to remove it
        this.activeHighlightId = targetId;
        this.renderer.addClass(element, 'active-highlight');

        this.highlightTimeout = setTimeout(() => {
            this.renderer.removeClass(element, 'active-highlight');
            this.activeHighlightId = null;
            this.highlightTimeout = null;
             // Optional: Emit scrollComplete event here if needed
        }, 1500); // Highlight duration

    } else {
        console.warn(`Element with ID "${targetId}" not found for scrolling.`);
        // Optional: Emit scrollComplete event here even if not found
    }
  }

  private processHighlights(result: ExtractionResult): void {
    const text = result.text;
    const entities = result.entities;
    const segments: HighlightedSegment[] = [];

    if (!text || !entities) {
        this.highlightedSegments = [{ text: text || '', isEntityValue: false, isEntityContext: false }];
        return;
    }

    // 1. Collect all highlight details (value, context, color, id)
    // This structure helps manage overlapping regions later
     interface HighlightInfo {
       valueStart: number; valueEnd: number;
       contextStart: number; contextEnd: number;
       type: string; color: string; id: string;
     }
     const highlights: HighlightInfo[] = [];
     let colorIndex = 0;

     Object.entries(entities).forEach(([entityName, occurrences]) => {
       const color = this.highlightColors[colorIndex % this.highlightColors.length];
       colorIndex++;
       occurrences.forEach((occ, occIndex) => {
         // Basic validation of positions
         if (occ.position && typeof occ.position.start === 'number' && typeof occ.position.end === 'number' &&
             occ.context?.position && typeof occ.context.position.start === 'number' && typeof occ.context.position.end === 'number')
         {
             const uniqueId = `entity-${entityName}-${occIndex}`; // Consistent ID format
             highlights.push({
               valueStart: occ.position.start,
               valueEnd: occ.position.end,
               contextStart: occ.context.position.start,
               contextEnd: occ.context.position.end,
               type: entityName,
               color,
               id: uniqueId,
             });
         } else {
             console.warn(`Invalid position/context data for entity ${entityName} occurrence ${occIndex}:`, occ);
         }
       });
     });

    // 2. Create sorted list of unique start/end points
    const points = new Set<number>([0]); // Start with 0
    highlights.forEach(h => {
      points.add(h.valueStart); points.add(h.valueEnd);
      points.add(h.contextStart); points.add(h.contextEnd);
    });
    points.add(text.length); // Ensure the end of the text is included
    const sortedPoints = Array.from(points).sort((a, b) => a - b).filter((p, i, arr) => i === 0 || p > arr[i - 1]); // Ensure points are unique and sorted

    // 3. Build segments by iterating through points
    for (let i = 0; i < sortedPoints.length - 1; i++) {
        const start = sortedPoints[i];
        const end = sortedPoints[i + 1];

        if (start >= end) continue; // Skip zero-length or invalid segments

        const segmentText = text.substring(start, end);
        if (!segmentText) continue; // Skip empty segments

        const segmentMid = start + (end - start) / 2;

        let isValue = false;
        let isContext = false;
        let valueColor = '';
        let contextColor = '';
        let entityId = '';
        let entityType = '';

        // Check which highlights cover the *middle* of this segment
        // Prioritize value highlights over context if they overlap exactly
        let bestMatch: HighlightInfo | null = null;
        for (const h of highlights) {
             if (segmentMid > h.valueStart && segmentMid < h.valueEnd) {
                 isValue = true;
                 valueColor = h.color;
                 entityId = h.id; // ID belongs to the value
                 entityType = h.type;
                 bestMatch = h; // Found a value match, store it
                 break; // Prioritize value
             }
        }

        // If not a value segment, check for context
         if (!isValue) {
             for (const h of highlights) {
                  // Check if segmentMid falls within a context range
                 if (segmentMid > h.contextStart && segmentMid < h.contextEnd) {
                      // Only consider this context if it doesn't contain the value highlight we might have found earlier
                      // (This handles cases where context fully contains the value)
                      if (!bestMatch || !(h.contextStart <= bestMatch.valueStart && h.contextEnd >= bestMatch.valueEnd)) {
                         isContext = true;
                         contextColor = h.color;
                         // Note: context doesn't get the primary ID in this model
                         entityType = h.type; // Still useful to know the type
                         break; // Found the first context match
                      }
                 }
             }
         }

        segments.push({
            text: segmentText,
            isEntityValue: isValue,
            isEntityContext: isContext && !isValue, // Only context if NOT also value
            entityId: isValue ? entityId : undefined, // ID only on the value segment
            entityType: entityType || undefined,
            backgroundColor: isValue ? valueColor : undefined,
            borderColor: isContext && !isValue ? contextColor : undefined
        });
    }

    this.highlightedSegments = segments;
  }
}