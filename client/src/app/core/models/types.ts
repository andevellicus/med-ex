// src/app/core/models/types.ts
export interface Position {
  start: number;
  end: number;
}

export interface Context {
  text: string;
  position: Position;
}

export interface EntityOccurrence {
  value: any; // Can be string, number, boolean, string[], etc.
  position: Position;
  context: Context;
  // id?: string; // Optional ID if needed later
}

export interface ExtractionResult {
  text: string;
  entities: Record<string, EntityOccurrence[]>;
}

// Add this if not already present from previous conversion
export interface SchemasApiResponse {
  schemas: string[];
}

export interface ScrollTarget {
  id: string;
  timestamp: number; // To ensure change detection even if ID is the same
}

// Other types like ScrollTarget, NestedEntity if used elsewhere