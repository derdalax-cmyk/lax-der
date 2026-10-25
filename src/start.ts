import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Headers de segurança em todas as respostas HTTP.
// frame-ancestors inclui os domínios Lovable para o preview do editor continuar a funcionar.
const securityHeaders = createMiddleware().server(async ({ next }) => {
  const res = await next();
  const h = new Headers(res.headers);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://*.lovable.dev https://*.lovableproject.com https://*.lovableproject-dev.com",
      "frame-src 'self' https://*.lovable.app https://*.lovable.dev https://accounts.google.com",
      "worker-src 'self'",
      "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev https://*.lovableproject.com https://*.lovableproject-dev.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
