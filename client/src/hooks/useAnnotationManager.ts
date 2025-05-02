// src/hooks/useAnnotationManager.ts
import { useState, useCallback } from 'react';
import { ExtractionResult, EntityOccurrence } from '../types';

// Define the return type of the hook
interface AnnotationManager {
    currentResult: ExtractionResult | null;
    setResult: (result: ExtractionResult | null) => void; // To set initial/new results
    addAnnotation: (value: string, start: number, end: number, entityName: string) => void;
    deleteAnnotation: (entityNameToDelete: string, occurrenceIdToDelete: string) => void;
}

export function useAnnotationManager(
    initialResult: ExtractionResult | null = null
): AnnotationManager {
    const [currentResult, setCurrentResult] = useState<ExtractionResult | null>(initialResult);

    // Function to set/reset the result (e.g., after extraction)
    const setResult = useCallback((result: ExtractionResult | null) => {
        setCurrentResult(result);
    }, []);

    // Function to add a new annotation
    const addAnnotation = useCallback((
        value: string,
        start: number,
        end: number,
        entityName: string
    ) => {
        setCurrentResult(prevResult => {
            if (!prevResult) return null; // Cannot add if no base text

            // Context Generation
            const contextWindow = 30;
            const contextStart = Math.max(0, start - contextWindow);
            const contextEnd = Math.min(prevResult.text.length, end + contextWindow);
            const contextText = prevResult.text.substring(contextStart, contextEnd);

            const newOccurrence: EntityOccurrence = {
                value: value,
                position: { start, end },
                context: {
                    text: contextText,
                    position: { start: contextStart, end: contextEnd }
                 },
                id: `manual-${entityName}-${Date.now()}` // Unique ID
            };

            console.log("Adding new annotation:", newOccurrence);
            const newEntities = { ...prevResult.entities };
            const currentList = newEntities[entityName] ? [...newEntities[entityName]] : [];
            currentList.push(newOccurrence);
            newEntities[entityName] = currentList;

            return { ...prevResult, entities: newEntities }; // Return new state
        });
    }, []); // No external dependencies needed for the update logic itself

    // Function to delete an existing annotation
    const deleteAnnotation = useCallback((entityNameToDelete: string, occurrenceIdToDelete: string) => {
        console.log(`Attempting to delete: ${entityNameToDelete} - ID: ${occurrenceIdToDelete}`);
        setCurrentResult(prevResult => {
            if (!prevResult?.entities?.[entityNameToDelete]) {
                console.warn(`Entity type "${entityNameToDelete}" not found during deletion.`);
                return prevResult; // Return previous state reference - NO re-render
            }

            const originalOccurrences = prevResult.entities[entityNameToDelete];
            const updatedOccurrences = originalOccurrences.filter(
                occ => occ.id !== occurrenceIdToDelete
            );

            if (updatedOccurrences.length === originalOccurrences.length) {
                 console.warn(`Occurrence ID "${occurrenceIdToDelete}" not found for entity "${entityNameToDelete}". No change.`);
                 return prevResult; // Return previous state reference - NO re-render
            }

            const newEntities = { ...prevResult.entities };
            if (updatedOccurrences.length === 0) {
                delete newEntities[entityNameToDelete];
            } else {
                newEntities[entityNameToDelete] = updatedOccurrences;
            }

            const newState = { ...prevResult, entities: newEntities };
            console.log("Delete successful. New state:", newState);
            return newState; // Return the new state object reference
        });
    }, []); // No external dependencies needed

    // Return the state and the manipulator functions
    return {
        currentResult,
        setResult,
        addAnnotation,
        deleteAnnotation,
    };
}