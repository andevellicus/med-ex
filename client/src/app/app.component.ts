import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common'; // Needed for basic directives

// Import Material modules needed for the layout & buttons/icons
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip'; // For toggle button tooltips
import { AngularSplitModule} from 'angular-split'; 
import { Observable, timestamp } from 'rxjs';

// Import child components used in the template
import { ControlsSidebarComponent } from './components/controls-sidebar/controls-sidebar.component';
import { ResultsDisplayComponent } from './components/results-display/results-display.component'; // Import new component
import { EntitiesSidebarComponent } from './components/entities-sidebar/entities-sidebar.component'; // Import new component

import { ExtractionService } from './core/services/extraction.service';
import { AnnotationService } from './core/services/annotation.service'; // Import AnnotationService
import { SchemaService } from './core/services/schema.service'; // Import SchemaService

import { ExtractionResult, ScrollTarget, UserAnnotation, SchemaDefinition } from './core/models/types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    // Angular Modules
    CommonModule,

    // Material Layout Modules
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule, 

    // Child Components
    ControlsSidebarComponent,
    ResultsDisplayComponent, 
    EntitiesSidebarComponent, 
    AngularSplitModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {

  // State for sidebar visibility
  isControlsSidebarOpen = true;
  isEntitiesSidebarOpen = true;

  extractionResult$: Observable<ExtractionResult | null>;
  isExtracting$: Observable<boolean>;
  extractionError$: Observable<string | null>;
  uploadProgress$: Observable<number | null>; // For potential progress bar

  currentAnnotations$: Observable<UserAnnotation[]>;
  currentSchemaDefinition: SchemaDefinition | null = null; // Store the fetched definition
  currentSchemaEntityTypes: string[] = []; // Store the flat list of types

  scrollToTarget: ScrollTarget | null = null; // For scroll handling

  isDarkMode = false; // Keep theme logic if desired

  // Inject services and ChangeDetectorRef
  constructor(
    private extractionService: ExtractionService,
    private annotationService: AnnotationService, // Inject AnnotationService
    private schemaService: SchemaService,       // Inject SchemaService
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // Assign observables from the service
    this.extractionResult$ = this.extractionService.extractionResult$;
    this.isExtracting$ = this.extractionService.isExtracting$;
    this.extractionError$ = this.extractionService.extractionError$;
    this.uploadProgress$ = this.extractionService.uploadProgress$;
    this.currentAnnotations$ = this.annotationService.annotations$; // Get annotations state

    // Theme detection (Existing)
    this.isDarkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  ngOnInit(): void {
    document.body.classList.toggle('dark-theme', this.isDarkMode);

    // Subscribe to result changes to load initial annotations
    this.extractionResult$.subscribe(result => {
      this.annotationService.loadInitialAnnotations(result); // Load into AnnotationService
      if (result && Object.keys(result.entities).length > 0 && !this.isEntitiesSidebarOpen) {
         this.isEntitiesSidebarOpen = true;
         this.changeDetectorRef.markForCheck();
      }
    });
  }

  // Handler for Extraction Request
  handleExtractionRequest(event: { file: File, schema: string }): void {
    console.log('AppComponent received extraction request:', event);
    this.extractionService.extractEntities(event.file, event.schema);
    this.scrollToTarget = null; // Reset scroll target

    // Fetch schema definition and entity types
    this.schemaService.getSchemaDefinition(event.schema).subscribe(definition => {
        this.currentSchemaDefinition = definition;
        this.currentSchemaEntityTypes = this.schemaService.getFlatEntityTypes(definition);
        console.log("Loaded entity types for schema:", this.currentSchemaEntityTypes);
        this.changeDetectorRef.markForCheck(); // Update view with new types
    });


    if (!this.isEntitiesSidebarOpen) {
         this.isEntitiesSidebarOpen = true;
    }
  }

  // Methods to toggle sidebars
  toggleControlsSidebar(): void {
    this.isControlsSidebarOpen = !this.isControlsSidebarOpen;
  }

  toggleEntitiesSidebar(): void {
    this.isEntitiesSidebarOpen = !this.isEntitiesSidebarOpen;
  }

  handleScrollToEntity(entityId: string): void {
      console.log("AppComponent: Scroll to entity requested:", entityId);
      this.scrollToTarget = { id: entityId, timestamp: Date.now() };
      this.changeDetectorRef.markForCheck();
  }

  // --- NEW: Handle Export Request (placeholder) ---
  handleExportRequest(): void {
      // 1. Get current annotations (potentially subscribe to annotationService.annotations$ once)
      // 2. Format them (e.g., JSONL)
      // 3. Trigger download
      alert("Export functionality not yet implemented.");
      // Example:
      // this.annotationService.annotations$.pipe(take(1)).subscribe(annotations => {
      //     const formatted = JSON.stringify(annotations, null, 2); // Basic JSON example
      //     const blob = new Blob([formatted], { type: 'application/json' });
      //     const url = window.URL.createObjectURL(blob);
      //     const a = document.createElement('a');
      //     a.href = url;
      //     a.download = 'annotations.json';
      //     a.click();
      //     window.URL.revokeObjectURL(url);
      // });
  }
  
}