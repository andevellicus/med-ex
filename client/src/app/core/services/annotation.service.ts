// client/src/app/core/services/annotation.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EntityOccurrence, ExtractionResult, UserAnnotation } from '../models/types';
import { v4 as uuidv4 } from 'uuid'; // Need to install uuid: npm install uuid @types/uuid

@Injectable({
  providedIn: 'root'
})
export class AnnotationService {
  private annotationsSubject = new BehaviorSubject<UserAnnotation[]>([]);
  private colors = ['#a2d2ff', '#ffafcc', '#bde0fe', '#ffc8dd', '#cdb4db', '#ff9573', '#f7b57e', '#bfb636', '#076912', '#98f5e1']; // Reuse colors
  private typeColorMap = new Map<string, string>();
  private nextColorIndex = 0;

  annotations$: Observable<UserAnnotation[]> = this.annotationsSubject.asObservable();

  constructor() { }

  private assignColor(type: string): string {
      if (!this.typeColorMap.has(type)) {
          this.typeColorMap.set(type, this.colors[this.nextColorIndex % this.colors.length]);
          this.nextColorIndex++;
      }
      return this.typeColorMap.get(type)!;
  }

  // Load initial annotations from LLM result
  loadInitialAnnotations(result: ExtractionResult | null): void {
    this.typeColorMap.clear(); // Reset colors for new text
    this.nextColorIndex = 0;
    if (!result || !result.entities) {
      this.annotationsSubject.next([]);
      return;
    }

    const initialAnnotations: UserAnnotation[] = [];
    Object.entries(result.entities).forEach(([type, occurrences]) => {
      const color = this.assignColor(type);
      occurrences.forEach(occ => {
        // Ensure positions are valid numbers
        if (occ.position && typeof occ.position.start === 'number' && typeof occ.position.end === 'number') {
            const text = result.text.substring(occ.position.start, occ.position.end); // Extract text based on rune indices

            let contextText: string | undefined = undefined;
            let contextStart: number | undefined = undefined;
            let contextEnd: number | undefined = undefined;

            if (occ.context && occ.context.text && occ.context.position &&
                typeof occ.context.position.start === 'number' &&
                typeof occ.context.position.end === 'number')
            {
                contextText = occ.context.text; // Use context text from LLM
                // Note: Backend already converts context positions to RUNE indices
                contextStart = occ.context.position.start;
                contextEnd = occ.context.position.end;
            } else {
                  console.warn(`Missing or invalid context data for occurrence of type ${type}:`, occ);
                  // Optionally generate a default context here if needed, but likely okay to leave undefined
            }

            initialAnnotations.push({
                id: uuidv4(), // Generate unique ID
                type: type,
                start: occ.position.start,
                end: occ.position.end,
                text: text,
                color: color,
                contextText: contextText,
                contextStart: contextStart, // Context start (rune)
                contextEnd: contextEnd,     // Context end (rune)
            });
        } else {
            console.warn(`Skipping occurrence for type ${type} due to invalid position:`, occ);
        }
      });
    });

    // Sort by start position for easier processing later
    initialAnnotations.sort((a, b) => a.start - b.start);
    this.annotationsSubject.next(initialAnnotations);
  }

  // Add a new annotation created by the user
addAnnotation(
    type: string,
    start: number, // value start
    end: number,   // value end
    text: string,  // value text
    contextText: string,
    contextStart: number,
    contextEnd: number
): void {
    const newAnnotation: UserAnnotation = {
        id: uuidv4(),
        type,
        start,
        end,
        text,
        color: this.assignColor(type),
        contextText: contextText,
        contextStart: contextStart,
        contextEnd: contextEnd,
    };
    const currentAnnotations = [...this.annotationsSubject.getValue(), newAnnotation];
    currentAnnotations.sort((a, b) => a.start - b.start); // Re-sort
    this.annotationsSubject.next(currentAnnotations);
    console.log("Added annotation with context:", newAnnotation); // Log for debugging
}

  // Delete an annotation by its ID
  deleteAnnotation(id: string): void {
    const currentAnnotations = this.annotationsSubject.getValue().filter(a => a.id !== id);
    // No need to re-sort if just deleting
    this.annotationsSubject.next(currentAnnotations);
  }

   // Clear all annotations
   clearAnnotations(): void {
       this.typeColorMap.clear();
       this.nextColorIndex = 0;
       this.annotationsSubject.next([]);
   }

  // (Future methods: updateAnnotationType, updateAnnotationBoundaries)
}