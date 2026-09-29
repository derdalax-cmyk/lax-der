import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const BASE = "https://derdalax.co.mz";

const STATIC_PATHS = [
  "/",
  "/explorar",
  "/categorias",
  "/tornar-se-vendedor",
  "/inicial",
  "/suporte",
  "/politica-privacidade",
];

export const Route = createFileRoute("/sitemap[.]xml")({
  server: {
    handlers: {
      GET: async () => {
        let productUrls = "";
        try {
          const { data } = await supabase
            .from("products")
            .select("id")
            .neq("status", "sold")
            .order("created_at", { ascending: false })
            .limit(5000);
          productUrls = (data ?? [])
            .map((p) => `  <url><loc>${BASE}/produto/${p.id}</loc></url>`)
            .join("\n");
        } catch (e) {
          console.error("[sitemap] product query failed", e);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_PATHS.map((p) => `  <url><loc>${BASE}${p}</loc></url>`).join("\n")}
${productUrls}
</urlset>`;

        return new Response(xml, {
          headers: { "Content-Type": "application/xml" },
        });
      },
    },
  },
});
