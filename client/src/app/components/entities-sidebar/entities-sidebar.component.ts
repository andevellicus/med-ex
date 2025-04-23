// src/app/components/entities-sidebar/entities-sidebar.component.ts
import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core'; // Added OnChanges, SimpleChanges, ChangeDetectionStrategy, Output, EventEmitter
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip'; // Added for tooltips

// Import necessary types
import { ExtractionResult, EntityOccurrence } from '../../core/models/types';

// Interface matching the React NestedEntity (can be moved to types.ts)
export interface NestedEntity {
  name: string;
  fullName: string; // Keep track of the full path, e.g., 'PatientInfo.Name'
  occurrences?: (EntityOccurrence & { id: string })[]; // Add ID here
  children?: Record<string, NestedEntity>;
  isExpanded?: boolean; // State for expand/collapse
}


@Component({
  selector: 'app-entities-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule // Added
  ],
  templateUrl: './entities-sidebar.component.html',
  styleUrls: ['./entities-sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntitiesSidebarComponent implements OnChanges {

  @Input() extractionResult: ExtractionResult | null = null;
  @Input() isExtracting: boolean = false;

  // Output event for when an occurrence is clicked
  @Output() entityClicked = new EventEmitter<string>();

  // Processed nested structure for rendering
  nestedEntities: Record<string, NestedEntity> = {};
  hasEntities = false;

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['extractionResult'] && this.extractionResult?.entities) {
        console.log("EntitiesSidebar: extractionResult changed, processing entities.");
        this.nestedEntities = this.buildNestedStructure(this.extractionResult.entities);
        this.hasEntities = Object.keys(this.nestedEntities).length > 0;
        console.log("Built structure:", this.nestedEntities);
    } else if (changes['extractionResult'] && !this.extractionResult) {
        // Clear if result is cleared
        this.nestedEntities = {};
        this.hasEntities = false;
    }
  }

  // --- Structure Building Logic (Adapted from React) ---
  private buildNestedStructure(entities: Record<string, EntityOccurrence[]>): Record<string, NestedEntity> {
    const structure: Record<string, NestedEntity> = {};

    Object.entries(entities).forEach(([fullName, occurrences]) => {
      const parts = fullName.split('.');
      let currentLevel = structure;
      let currentPath = '';

      // Ensure ID is added to each occurrence *before* assigning to structure
      const occurrencesWithId = occurrences.map((occ, index) => ({
        ...occ,
        id: `entity-${fullName}-${index}` // Consistent ID format
      }));

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}.${part}` : part;
        if (!currentLevel[part]) {
          // Initialize with potential children obj only if not the last part
          currentLevel[part] = {
             name: part,
             fullName: currentPath, // Store full path
             children: (index === parts.length - 1) ? undefined : {},
             isExpanded: true // Default to expanded
           };
        }

        if (index === parts.length - 1) {
          // Final entity name part: Assign occurrences
          currentLevel[part].occurrences = occurrencesWithId;
          // Ensure children is defined if it was already treated as parent
          if (!currentLevel[part].children) {
             currentLevel[part].children = {}; // Keep potentially expandable
          }
        } else {
           // Ensure children object exists for nesting
           if (!currentLevel[part].children) {
             currentLevel[part].children = {};
           }
           currentLevel = currentLevel[part].children!;
        }
      });
    });
    return structure;
  }

  // --- Template Helpers ---

   // Helper to get children as an array for *ngFor
   objectValues(obj: Record<string, NestedEntity> | undefined): NestedEntity[] {
       return obj ? Object.values(obj) : [];
   }

   // Toggle expand/collapse state
   toggleNode(node: NestedEntity): void {
       node.isExpanded = !node.isExpanded;
   }

   // Emit event when an occurrence is clicked
   onOccurrenceClick(occurrenceId: string): void {
       console.log("Entity occurrence clicked:", occurrenceId);
       this.entityClicked.emit(occurrenceId);
   }

   // Helper to check if a node can be expanded/collapsed
   canExpand(node: NestedEntity): boolean {
        const hasRealChildren = node.children && Object.keys(node.children).length > 0;
        const hasOccurrences = node.occurrences && node.occurrences.length > 0;
        return !!(hasRealChildren || hasOccurrences);
   }

    // Helper to determine if a node is purely structural (only contains other nodes)
   isStructuralOnly(node: NestedEntity): boolean {
       const hasRealChildren = node.children && Object.keys(node.children).length > 0;
       const hasOccurrences = node.occurrences && node.occurrences.length > 0;
       return !hasOccurrences && !!hasRealChildren;
   }

   // Render the value from an occurrence
   renderValue(value: any): string {
       if (Array.isArray(value)) { return value.join(', '); }
       if (typeof value === 'boolean') { return value ? 'Yes' : 'No'; }
       if (value === null || typeof value === 'undefined') { return 'N/A'; }
       return String(value);
   }

}