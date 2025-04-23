// FILE: client/src/app/components/entities-sidebar/entities-sidebar.component.ts

import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { UserAnnotation } from '../../core/models/types';

export interface TypeTreeNode {
  name: string;
  fullName: string;
  occurrences: UserAnnotation[];
  children?: Record<string, TypeTreeNode>;
  isExpanded: boolean;
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
    MatTooltipModule
  ],
  templateUrl: './entities-sidebar.component.html',
  styleUrls: ['./entities-sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntitiesSidebarComponent implements OnChanges {

  @Input() annotations: UserAnnotation[] | null = null;
  @Input() isExtracting: boolean = false;

  @Output() entityClicked = new EventEmitter<string>();

  typeTree: Record<string, TypeTreeNode> = {};
  hasAnnotations = false;

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['annotations']) {
        this.typeTree = this.buildStructureFromAnnotations(this.annotations);
        this.hasAnnotations = this.annotations ? this.annotations.length > 0 : false;
    }
     if (changes['isExtracting'] && this.isExtracting) {
        this.typeTree = {};
        this.hasAnnotations = false;
     }
  }

  // --- Structure Building Logic (Keep previous robust version) ---
  private buildStructureFromAnnotations(annotations: UserAnnotation[] | null): Record<string, TypeTreeNode> {
    const structure: Record<string, TypeTreeNode> = {};
    if (!annotations) return structure;

    annotations.forEach(annotation => {
      const parts = annotation.type.split('.');
      let currentLevel = structure;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}.${part}` : part;

        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            fullName: currentPath,
            occurrences: [],
            children: (index === parts.length - 1) ? undefined : {},
            isExpanded: true
          };
        } else {
          const existingNode = currentLevel[part];
           if (index < parts.length - 1 && !existingNode.children) {
              existingNode.children = {};
          }
           if (!existingNode.occurrences) {
              existingNode.occurrences = [];
          }
           if (typeof existingNode.isExpanded !== 'boolean') {
               existingNode.isExpanded = true;
           }
        }

        if (index === parts.length - 1) {
          currentLevel[part].occurrences.push(annotation);
           if (!currentLevel[part].children) currentLevel[part].children = {};
        } else {
          currentLevel = currentLevel[part].children!;
        }
      });
    });
    return structure;
  }


  // --- Template Helpers ---

    objectValues(obj: Record<string, TypeTreeNode> | undefined): TypeTreeNode[] {
        return obj ? Object.values(obj).sort((a, b) => a.name.localeCompare(b.name)) : [];
    }

    toggleNode(node: TypeTreeNode): void {
        node.isExpanded = !(node.isExpanded ?? true);
    }

    onOccurrenceClick(annotationId: string): void {
        this.entityClicked.emit(annotationId);
    }

    // FIX for Line 135: Add explicit boolean return type
    canExpand(node: TypeTreeNode): boolean {
         // The logic itself should be fine, adding explicit return type
         const hasOccurrences = node.occurrences && node.occurrences.length > 0;
         const hasChildNodes = node.children && Object.keys(node.children).length > 0;
         // Ensure the final result is explicitly boolean, e.g. using !!
         return !!(hasOccurrences || hasChildNodes);
    }

    // FIX for Line 141: Add explicit boolean return type and handle undefined defensively
    isStructuralOnly(node: TypeTreeNode): boolean {
       const hasChildren = !!(node.children && Object.keys(node.children).length > 0);
       // Use ?? false to treat undefined from ?. as false before negating
       const hasDirectOccurrences = node.occurrences?.some(occ => occ.type === node.fullName) ?? false;
       return hasChildren && !hasDirectOccurrences; // This should now be boolean && boolean
    }

    renderValue(value: any): string {
        // Keep previous logic
        if (Array.isArray(value)) { return value.join(', '); }
        if (typeof value === 'boolean') { return value ? 'Yes' : 'No'; }
        if (value === null || typeof value === 'undefined') { return 'N/A'; }
        if (typeof value === 'number') { return String(value); }
        return String(value);
    }
}