// client/src/app/components/results-display/annotation-dialog/annotation-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Need FormsModule for ngModel
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';

// Data structure for the dialog
export interface AnnotationDialogData {
  selectedText: string;
  entityTypes: string[];
}

@Component({
  selector: 'app-annotation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, // Import FormsModule
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatDividerModule,
  ],
  templateUrl: './annotation-dialog.component.html',
  styleUrls: ['./annotation-dialog.component.scss']
})
export class AnnotationDialogComponent {
  selectedEntityType: string = ''; // To hold the selection

  constructor(
    public dialogRef: MatDialogRef<AnnotationDialogComponent, string | undefined>, // Return selected type or undefined
    @Inject(MAT_DIALOG_DATA) public data: AnnotationDialogData
  ) {
      // Pre-select if only one type is available? Maybe not needed.
      // if (data.entityTypes && data.entityTypes.length === 1) {
      //     this.selectedEntityType = data.entityTypes[0];
      // }
  }

  onCancel(): void {
    this.dialogRef.close(); // Close without returning data
  }

  onConfirm(): void {
    // Only close with data if a type was selected
    if (this.selectedEntityType) {
       this.dialogRef.close(this.selectedEntityType);
    }
  }
}