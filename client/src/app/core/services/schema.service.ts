// src/app/core/services/schema.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, finalize, tap, retry, map } from 'rxjs/operators';
import { SchemasApiResponse, SchemaDefinition, SchemaProperty} from '../models/types'; // Adjust the import path as necessary

@Injectable({
  providedIn: 'root' // Makes the service a singleton available app-wide
})
export class SchemaService {

  // Private BehaviorSubjects to hold the current state.
  // BehaviorSubject emits the current value immediately to new subscribers.
  private schemasSubject = new BehaviorSubject<string[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false); // Start not loading
  private errorSubject = new BehaviorSubject<string | null>(null);
  private schemaDefinitionsCache = new Map<string, SchemaDefinition | null>(); 

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

    getSchemaDefinition(schemaName: string): Observable<SchemaDefinition | null> {
        if (this.schemaDefinitionsCache.has(schemaName)) {
            return of(this.schemaDefinitionsCache.get(schemaName)!);
        }

        this.isLoadingSubject.next(true); // Set loading state
        return this.http.get<SchemaDefinition>(`/api/schema/${schemaName}`).pipe(
            tap(definition => {
                if (definition && Object.keys(definition).length > 0) {
                    this.schemaDefinitionsCache.set(schemaName, definition);
                } else {
                  this.schemaDefinitionsCache.set(schemaName, null);
                }
            }),
            catchError(error => {
                console.error(`Error fetching schema definition for ${schemaName}:`, error);
                this.errorSubject.next(`Failed to load schema definition for ${schemaName}.`); // Update error state
                return of(null); // Return null on error
            }),
            finalize(() => {
                this.isLoadingSubject.next(false); // Reset loading state
            })
        );
    }

   // --- NEW: Helper to get flat list of entity types from definition ---
   getFlatEntityTypes(schemaDefinition: SchemaDefinition | null): string[] {
        if (!schemaDefinition) return [];
        const types: string[] = [];

        // Define traverse function locally
        const traverse = (prefix: string, node: SchemaProperty | Record<string, SchemaProperty> | null) => { // Allow null for node param initially? No, check before call.
            if (!node) return; // Base case: stop if node is null

            // Check if it's a property map (like 'properties' or the root)
            // Needs refinement: Check if it has 'type' property first. If not, assume it's a map.
             const nodeAsProperty = node as SchemaProperty;
             const nodeAsMap = node as Record<string, SchemaProperty>;

             if (nodeAsProperty.type) {
                  // It's an entity definition node
                  if (prefix) { // Ensure prefix is not empty
                      types.push(prefix);
                  }
                  // If it's an object type with properties, recurse into its properties
                  if (nodeAsProperty.type === 'object' && nodeAsProperty.properties) {
                      traverse(prefix, nodeAsProperty.properties); // Recurse into the properties map
                  }
                  // If it's an array of objects with properties, recurse into item properties
                   else if (nodeAsProperty.type === 'array' && nodeAsProperty.items?.type === 'object' && nodeAsProperty.items.properties) {
                       // How to represent array items? Maybe prefix + '[]'? For now, just traverse into item properties.
                       traverse(prefix, nodeAsProperty.items.properties);
                   }
             } else if (typeof node === 'object') {
                 // It's likely a map of properties (like the root or a nested 'properties' map)
                 Object.entries(nodeAsMap).forEach(([key, value]) => {
                     const newPrefix = prefix ? `${prefix}.${key}` : key;
                     // --- ADD NULL CHECK HERE ---
                     if (value !== null) {
                         traverse(newPrefix, value); // Recursively call with the value
                     } else {
                         console.warn(`Schema contains null value at path: ${newPrefix}`);
                     }
                 });
             }
        };


        traverse('', schemaDefinition); // Start traversal from root

        // Deduplicate (necessary if traversal logic isn't perfect)
        const uniqueTypes = Array.from(new Set(types));
        return uniqueTypes.sort();
    }
  
}