import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AvailableCity = { city: string; product_count: number };

const STORAGE_KEY = "derdalax-city";

type CityContextValue = {
  city: string;
  setCity: (c: string) => void;
  clearCity: () => void;
  hasCity: boolean;
  ready: boolean;
  cities: AvailableCity[];
  loading: boolean;
};

const CityContext = createContext<CityContextValue | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState<string>("");
  const [ready, setReady] = useState(false);

  // Load persisted selection on mount (client only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCityState(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["available-cities"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_cities");
      if (error) throw error;
      return (data ?? []).map((r) => ({ city: r.city, product_count: Number(r.product_count) })) as AvailableCity[];
    },
    staleTime: 60_000,
  });

  const setCity = (c: string) => {
    setCityState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  };

  const clearCity = () => {
    setCityState("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const effectiveCity = ready ? city : "";

  const value = useMemo<CityContextValue>(
    () => ({
      city: effectiveCity,
      setCity,
      clearCity,
      hasCity: !!effectiveCity,
      ready,
      cities,
      loading: isLoading,
    }),
    [effectiveCity, ready, cities, isLoading],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used within CityProvider");
  return ctx;
}
