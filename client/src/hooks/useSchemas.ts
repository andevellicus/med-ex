import { useState, useEffect } from 'react';

interface SchemasApiResponse {
  schemas: string[];
}

export function useSchemas() {
  const [schemas, setSchemas] = useState<string[]>([]);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState<boolean>(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchemas = async () => {
      setIsLoadingSchemas(true);
      setSchemaError(null);
      try {
        const response = await fetch('/api/schemas');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: SchemasApiResponse = await response.json();

        if (data.schemas && data.schemas.length > 0) {
          setSchemas(data.schemas);
        } else {
          setSchemas([]);
          setSchemaError('No schemas available from server.');
        }
      } catch (error) {
        console.error('Error fetching schemas:', error);
        setSchemaError('Failed to load schemas. Please check the console.');
        setSchemas([]);
      } finally {
        setIsLoadingSchemas(false);
      }
    };

    fetchSchemas();
  }, []);

  return { schemas, isLoadingSchemas, schemaError };
}