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
  id?: string; // Optional ID for the entity occurrence
}

// This interface should match the JSON structure returned by Go backend's /api/extract endpoint
export interface ExtractionResult {
  text: string; // Matches Go backend's Text field
  entities: Record<string, EntityOccurrence[]>; // Matches Go backend's Entities field
}

// Type for managing scrolling
export interface ScrollTarget {
    id: string;
    timestamp: number; // Add timestamp to trigger useEffect even if ID is the same
}

// Interface for nested entity structure
export interface NestedEntity {
    name: string;
    occurrences?: EntityOccurrence[];
    children?: Record<string, NestedEntity>;
}