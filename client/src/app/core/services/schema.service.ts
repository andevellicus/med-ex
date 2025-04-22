// src/app/core/services/schema.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, tap, retry } from 'rxjs/operators';
import { SchemasApiResponse } from '../models/types';


@Injectable({
  providedIn: 'root' // Makes the service a singleton available app-wide
})
export class SchemaService {

  // Private BehaviorSubjects to hold the current state.
  // BehaviorSubject emits the current value immediately to new subscribers.
  private schemasSubject = new BehaviorSubject<string[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false); // Start not loading
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public Observables that components can subscribe to.
  // The '$' suffix is a common convention for Observables in Angular.
  schemas$: Observable<string[]> = this.schemasSubject.asObservable();
  isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  error$: Observable<string | null> = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {
    // Automatically fetch schemas when the service is first instantiated.
    // This is similar to the useEffect(() => { fetchSchemas() }, []) in your hook.
    this.fetchSchemas();
  }

  // Method to fetch or re-fetch schemas
  fetchSchemas(): void {
    this.isLoadingSubject.next(true); // Signal that loading has started
    this.errorSubject.next(null);      // Clear any previous errors

    this.http.get<SchemasApiResponse>('/api/schemas') // Make GET request to the backend
      .pipe(
        retry(1), // Optionally retry once on failure
        tap(data => {
          // This runs if the request is successful (status 2xx)
          if (data && data.schemas && data.schemas.length > 0) {
            this.schemasSubject.next(data.schemas); // Update schemas state
            this.errorSubject.next(null); // Ensure error is cleared on success
          } else {
            // Handle case where API returns success but no schemas
            this.schemasSubject.next([]); // Update state with empty array
            this.errorSubject.next('No schemas available from server.'); // Set specific message
            console.warn('API returned success but no schemas found.');
          }
        }),
        catchError((error: HttpErrorResponse) => {
          // This runs if the request fails (network error, 4xx, 5xx status)
          console.error('Error fetching schemas:', error);
          // Create a user-friendly error message
          const errorMessage = `Failed to load schemas. Status: ${error.status}. Please check backend connection.`;
          this.errorSubject.next(errorMessage); // Update error state
          this.schemasSubject.next([]); // Clear schemas on error
          // Propagate the error after handling it locally
          return throwError(() => new Error(errorMessage));
        }),
        finalize(() => {
          // This runs regardless of success or error (like 'finally' block)
          this.isLoadingSubject.next(false); // Signal that loading has finished
        })
      ).subscribe(); // IMPORTANT: Subscribe here to actually trigger the HTTP request.
                     // We don't need to do anything inside subscribe() because 'tap' and 'catchError' handle the state updates via Subjects.
  }
}