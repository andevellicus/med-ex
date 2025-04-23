// src/app/core/services/extraction.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, Subject } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { ExtractionResult } from '../models/types'; // Ensure this path is correct

@Injectable({
  providedIn: 'root'
})
export class ExtractionService {

  // State management within the service
  private extractionResultSubject = new BehaviorSubject<ExtractionResult | null>(null);
  private isExtractingSubject = new BehaviorSubject<boolean>(false);
  private extractionErrorSubject = new BehaviorSubject<string | null>(null);
  // Optional: Subject for progress if needed for large files
  private uploadProgressSubject = new Subject<number | null>();

  // Public observables for components to subscribe to
  extractionResult$: Observable<ExtractionResult | null> = this.extractionResultSubject.asObservable();
  isExtracting$: Observable<boolean> = this.isExtractingSubject.asObservable();
  extractionError$: Observable<string | null> = this.extractionErrorSubject.asObservable();
  uploadProgress$: Observable<number | null> = this.uploadProgressSubject.asObservable();


  constructor(private http: HttpClient) { }

  /**
   * Initiates the entity extraction process by sending the file and schema to the backend.
   * @param file The text file to process.
   * @param schema The name of the schema to use for extraction.
   */
  extractEntities(file: File, schema: string): void {
    if (!file || !schema) {
      this.extractionErrorSubject.next('File and schema are required.');
      return; // Or return throwError(() => new Error('File and schema are required.'));
    }

    this.isExtractingSubject.next(true);
    this.extractionErrorSubject.next(null);
    this.extractionResultSubject.next(null); // Clear previous results
    this.uploadProgressSubject.next(0); // Reset progress

    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('schema', schema);

    // Make the POST request with progress reporting
    this.http.post<ExtractionResult>('/api/extract', formData, {
      reportProgress: true, // Enable progress events
      observe: 'events'     // Observe all HttpEvents, not just the body
    }).pipe(
      map(event => this.getEventMessage(event, file)), // Process different event types
      tap(message => {
        // Side-effect: log progress or handle final result
        // console.log(message); // You can log progress messages here
        // The final result is pushed to extractionResultSubject within getEventMessage
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error during extraction:', error);
        let errorMsg = `Server error: ${error.status} ${error.statusText}`;
        // Try to get more specific error from backend response body
        if (error.error && typeof error.error === 'object' && error.error.error) {
             errorMsg = error.error.error; // Assuming backend returns { "error": "message" }
        } else if (typeof error.error === 'string') {
             errorMsg = error.error; // If the error body is just a string
        } else {
            errorMsg = `Extraction failed (Status ${error.status}). Please check the backend server.`;
        }

        this.extractionErrorSubject.next(errorMsg);
        this.extractionResultSubject.next(null); // Ensure result is cleared on error
        return throwError(() => new Error(errorMsg)); // Propagate error
      }),
      finalize(() => {
        this.isExtractingSubject.next(false); // Ensure loading state is turned off
        this.uploadProgressSubject.next(null); // Clear progress
      })
    ).subscribe(); // Subscribe to trigger the request
  }

  /**
   * Processes HttpEvent to update progress and handle the final response.
   */
   private getEventMessage(event: HttpEvent<any>, file: File) {
    switch (event.type) {
      case HttpEventType.Sent:
        // Request sent
        return `Uploading file "${file.name}" of size ${file.size}.`;

      case HttpEventType.UploadProgress:
        // Compute and show the percentage uploaded
        if (event.total) {
            const percentDone = Math.round(100 * event.loaded / event.total);
            this.uploadProgressSubject.next(percentDone); // Update progress observable
            return `File "${file.name}" is ${percentDone}% uploaded.`;
        } else {
            // If total size is unknown, just indicate progress without percentage
             this.uploadProgressSubject.next(null); // Or a specific value like -1
             return `Uploading file "${file.name}"...`;
        }


      case HttpEventType.Response:
        // Full response received, includes body
        // We expect ExtractionResult here based on post<ExtractionResult>
        const result = event.body as ExtractionResult;
        this.extractionResultSubject.next(result); // Update result observable
        this.extractionErrorSubject.next(null);    // Clear any previous error
        return `File "${file.name}" was completely uploaded and processed!`;

      default:
        // Other event types like DownloadProgress, ResponseHeader etc.
        // console.log(`Unhandled event type: ${event.type}`);
        return `File "${file.name}" surprising upload event: ${event.type}.`;
    }
  }

  // Optional: Method to clear results/errors manually if needed
  clearResults(): void {
      this.extractionResultSubject.next(null);
      this.extractionErrorSubject.next(null);
      this.isExtractingSubject.next(false);
      this.uploadProgressSubject.next(null);
  }
}