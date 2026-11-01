import { fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

/** URL contract for /explorar. Lists are comma-separated strings so the URL stays readable. */
export const exploreSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  categoria: fallback(z.string(), "all").default("all"),
  genero: fallback(z.string(), "all").default("all"),
  min: fallback(z.string(), "").default(""),
  max: fallback(z.string(), "").default(""),
  desconto: fallback(z.boolean(), false).default(false),
  stock: fallback(z.boolean(), false).default(false),
  unica: fallback(z.boolean(), false).default(false),
  tamanhos: fallback(z.string(), "").default(""),
  cores: fallback(z.string(), "").default(""),
  loja: fallback(z.string(), "").default(""),
});
export type ExploreSearch = z.infer<typeof exploreSearchSchema>;

export const GENDERS = [
  { value: "all", label: "Todos" },
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "unissex", label: "Unissex" },
] as const;

export const EMPTY_ADVANCED: Omit<ExploreSearch, "q" | "categoria" | "genero"> = {
  min: "", max: "", desconto: false, stock: false, unica: false, tamanhos: "", cores: "", loja: "",
};

export const splitList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
export const joinList = (v: string[]) => Array.from(new Set(v)).join(",");
export const toggleInList = (v: string, item: string) => {
  const list = splitList(v);
  return joinList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
};

const num = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Advanced filters = everything behind the "Filtrar" button (categories count when multi-selected). */
export function countAdvanced(s: ExploreSearch): number {
  return (num(s.min) !== null || num(s.max) !== null ? 1 : 0) + (s.desconto ? 1 : 0) + (s.stock ? 1 : 0) + (s.unica ? 1 : 0)
    + splitList(s.tamanhos).length + splitList(s.cores).length + (UUID.test(s.loja) ? 1 : 0)
    + (splitList(s.categoria === "all" ? "" : s.categoria).length > 1 ? 1 : 0);
}

/** Server RPC arguments for explore_products / explore_products_count. */
export function exploreRpcArgs(s: Omit<ExploreSearch, "q"> & { q: string }, city: string | null | undefined) {
  const cats = s.categoria === "all" ? [] : splitList(s.categoria);
  return {
    _q: s.q.trim().slice(0, 100) || undefined,
    _categories: cats.length ? cats : undefined,
    _gender: s.genero !== "all" ? s.genero : undefined,
    _min: num(s.min) ?? undefined,
    _max: num(s.max) ?? undefined,
    _discount: s.desconto,
    _available: s.stock,
    _unique: s.unica,
    _sizes: splitList(s.tamanhos).length ? splitList(s.tamanhos).map((x) => x.toUpperCase()) : undefined,
    _colors: splitList(s.cores).length ? splitList(s.cores).map((x) => x.toLowerCase()) : undefined,
    _seller: UUID.test(s.loja) ? s.loja : undefined,
    _city: city || undefined,
  };
}

export const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
