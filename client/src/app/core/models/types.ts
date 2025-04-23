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

export interface UserAnnotation {
  id: string; // Unique ID for this annotation instance
  type: string; // Entity type from the schema (e.g., "PatientName", "Labs.WBC")
  start: number; // RUNE index (character offset)
  end: number;   // RUNE index (character offset)
  text: string; // The actual text span
  // Optional: Add color, confidence, source (llm/user) if needed later
  color?: string; // For consistent coloring
}

// Potentially define a Schema Definition type if needed client-side
export interface SchemaProperty {
    type: string;
    description?: string;
    items?: SchemaProperty; // For arrays
    properties?: Record<string, SchemaProperty>; // For objects
    enum?: any[];
}
export type SchemaDefinition = Record<string, SchemaProperty>;