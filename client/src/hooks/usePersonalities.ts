import { useState, useEffect, useCallback } from "react";

export interface Personality {
  id: string;
  name: string;
  description: string;
  embedding: string;
  textTemperature: number;
  textTopk: number;
  audioTemperature: number;
  audioTopk: number;
}

export function usePersonalities() {
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPersonalities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/personalities");
      if (res.ok) {
        const data: Personality[] = await res.json();
        setPersonalities(data);
      }
    } catch (err) {
      console.error("Error fetching personalities:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersonalities();
  }, [fetchPersonalities]);

  const savePersonality = useCallback(async (personality: Personality) => {
    try {
      const res = await fetch("/api/personalities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(personality),
      });
      if (!res.ok) {
        console.error("Failed to save personality:", await res.text());
      }
    } catch (err) {
      console.error("Error saving personality:", err);
    }
  }, []);

  const deletePersonality = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/personalities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        console.error("Failed to delete personality:", await res.text());
      }
    } catch (err) {
      console.error("Error deleting personality:", err);
    }
  }, []);

  return { personalities, setPersonalities, loading, savePersonality, deletePersonality, refresh: fetchPersonalities };
}
