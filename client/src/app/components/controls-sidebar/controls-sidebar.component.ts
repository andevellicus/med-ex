import { Component, OnInit, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core'; // Added Input, Output, EventEmitter
import { AsyncPipe, CommonModule, NgFor, NgIf } from '@angular/common';
import { Observable } from 'rxjs';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

// Import Angular Material Modules needed
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button'; // Added Button
import { MatIconModule } from '@angular/material/icon';     // Added Icon
import { MatCardModule } from '@angular/material/card';     // Added Card (optional for styling)

// Import the service (will be used by parent)
import { SchemaService } from '../../core/services/schema.service';
// Import ExtractionService (will be used by parent)
// import { ExtractionService } from '../../core/services/extraction.service'; // Parent will handle this

@Component({
  selector: 'app-controls-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatButtonModule, // Added
    MatIconModule,   // Added
    MatCardModule,   // Added (optional)
  ],
  templateUrl: './controls-sidebar.component.html',
  styleUrls: ['./controls-sidebar.component.scss'], // We'll need to add styles
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControlsSidebarComponent implements OnInit {

  // Inputs from parent component
  @Input() isExtracting: boolean = false; // To disable button during processing

  // Outputs to parent component
  @Output() extractRequested = new EventEmitter<{ file: File, schema: string }>();

  // Schema Observables (Existing)
  schemas$: Observable<string[]>;
  isLoadingSchemas$: Observable<boolean>;
  schemaError$: Observable<string | null>;
  selectedSchemaControl = new FormControl<string>('', { nonNullable: true });
  private firstLoad = true;

  // File State
  selectedFile: File | null = null;
  fileError: string | null = null;
  isDraggingOver = false;
  dropzoneText = 'Drag and drop or click';

  constructor(private schemaService: SchemaService) {
    this.schemas$ = this.schemaService.schemas$;
    this.isLoadingSchemas$ = this.schemaService.isLoading$;
    this.schemaError$ = this.schemaService.error$;
  }

  ngOnInit(): void {
    // Auto-select schema logic (Existing)
    this.schemas$.subscribe(schemas => {
      if (this.firstLoad && schemas.length > 0 && !this.selectedSchemaControl.value) {
        this.selectedSchemaControl.setValue(schemas[0]);
        this.firstLoad = false;
      } else if (schemas.length === 0) {
         this.selectedSchemaControl.setValue('');
         this.firstLoad = false;
      }
    });

    // Optional: Log schema changes (Existing)
    this.selectedSchemaControl.valueChanges.subscribe(value => {
      console.log('Schema selected:', value);
    });
  }

  // --- File Handling Methods ---

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      this.processFile(fileList[0]);
    }
     // Reset the input value to allow selecting the same file again
    element.value = '';
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation(); // Prevent parent elements from handling drop
    this.isDraggingOver = false;
    this.dropzoneText = 'Drag and drop or click';

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
       // Only allow one file
       if (files.length > 1) {
           this.fileError = 'Please upload only one file.';
           this.selectedFile = null;
           return;
       }
       this.processFile(files[0]);
    } else {
        console.warn('No files found in drop event dataTransfer.');
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = true;
    this.dropzoneText = 'Drop the file here...'; // Update text while dragging over
     if (event.dataTransfer) {
       event.dataTransfer.dropEffect = 'copy'; // Indicate it's a copy operation
     }
  }

  onDragLeave(event: DragEvent): void {
     // Check if the leave event target is actually outside the dropzone bounds
     const relatedTarget = event.relatedTarget as Node;
     const currentTarget = event.currentTarget as Node;
     if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
         event.preventDefault();
         event.stopPropagation();
         this.isDraggingOver = false;
         this.dropzoneText = 'Drag and drop or click'; // Reset text
     }
  }

  processFile(file: File): void {
    this.fileError = null; // Clear previous errors
    // Basic validation (example: check type)
    if (!file.type.startsWith('text/plain')) {
      this.fileError = 'Invalid file type. Please upload a .txt file.';
      this.selectedFile = null;
      return;
    }
    // Add size validation if needed
    // if (file.size > MAX_SIZE) { ... }

    this.selectedFile = file;
  }

  clearFile(event?: MouseEvent): void {
     if(event) {
         event.stopPropagation(); // Prevent click from triggering file input open
     }
    this.selectedFile = null;
    this.fileError = null;
  }

  // --- Submit Method ---

  submitExtraction(): void {
    if (!this.selectedFile || !this.selectedSchemaControl.value || this.isExtracting) {
      return; // Should be disabled, but double-check
    }
    console.log(`Requesting extraction for file: ${this.selectedFile.name}, schema: ${this.selectedSchemaControl.value}`);

    // Emit event to the parent component
    this.extractRequested.emit({
        file: this.selectedFile,
        schema: this.selectedSchemaControl.value
    });
  }
}