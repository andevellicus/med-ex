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

import { ExtractionService } from './core/services/extraction.service'; // Import the service for extraction

import { ExtractionResult, ScrollTarget } from './core/models/types'; // Import the type for extraction results

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

  scrollToTarget: ScrollTarget | null = null; // For scroll handling

  isDarkMode = false; // Keep theme logic if desired

  // Inject services and ChangeDetectorRef
  constructor(
    private extractionService: ExtractionService,
    private changeDetectorRef: ChangeDetectorRef // Needed for OnPush if async updates occur outside Angular zone (less likely here)
  ) {
    // Assign observables from the service
    this.extractionResult$ = this.extractionService.extractionResult$;
    this.isExtracting$ = this.extractionService.isExtracting$;
    this.extractionError$ = this.extractionService.extractionError$;
    this.uploadProgress$ = this.extractionService.uploadProgress$;

    // Theme detection (Existing)
    this.isDarkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  ngOnInit(): void {
    document.body.classList.toggle('dark-theme', this.isDarkMode);
    // Optional: Listen for OS theme changes (same as before)
    this.extractionResult$.subscribe(result => {
      if (result && result.entities && Object.keys(result.entities).length > 0 && !this.isEntitiesSidebarOpen) {
        this.isEntitiesSidebarOpen = true;
        this.changeDetectorRef.markForCheck(); // Trigger change detection
      }
      this.scrollToTarget = null; // Reset scroll target after processing
    });
  }

  // --- Handler for Extraction Request ---
  handleExtractionRequest(event: { file: File, schema: string }): void {
    console.log('AppComponent received extraction request:', event);
    this.extractionService.extractEntities(event.file, event.schema);
  }

  // Methods to toggle sidebars
  toggleControlsSidebar(): void {
    this.isControlsSidebarOpen = !this.isControlsSidebarOpen;
  }

  toggleEntitiesSidebar(): void {
    this.isEntitiesSidebarOpen = !this.isEntitiesSidebarOpen;
  }

  // --- TODO: Implement Scroll Handling ---
  // This will require Output events from EntitiesSidebar and Input properties on ResultsDisplay
  handleScrollToEntity(entityId: string): void {
    console.log("AppComponent: Scroll to entity requested:", entityId);
    // Need to pass this down to ResultsDisplay, perhaps via a Subject/Observable or simple @Input
    // For simplicity, we might add a property like:
    // public scrollToTargetId: string | null = null;
    this.scrollToTarget = { id: entityId, timestamp: Date.now() }; // Create a scroll target
    // And pass `[scrollToTargetId]="scrollToTargetId"` to ResultsDisplay
    // ResultsDisplay would need an @Input() scrollToTargetId and an ngOnChanges handler.
  }
}