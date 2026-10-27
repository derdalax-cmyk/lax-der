# Project architecture
- Product discovery grids use measured shortest-column masonry with unchanged DOM/feed order; shared natural-image frames cache dimensions and contain photos within safe aspect limits, while horizontal carousels retain snap navigation and original files stay untouched.
- Complete catalogue feeds share a keyset cursor (created_at/id), filter-keyed incremental query and automatic viewport sentinel; deduplication prevents repeated products without visible pagination.
- Product lists keep session-lifetime Query caches and URL-based filters; router restoration keys list scroll by URL while product links mark internal origins for history-back, so returning preserves loaded batches and context.
- Product detail metadata and recommendations use a public-only server function with per-product Query keys; sharing reads the same primary image and falls back to the canonical URL, preventing cross-product previews without exposing private records.
- Product AI output passes the shared factual-content validator on the server before saving or returning; discard person/body claims and reject malformed or contradictory results without changing provider or ownership rules.
- Login destination uses safe explicit/pending redirects with home as the role-independent fallback; administrative step-up stays at the admin gate.
- Product image watermarks use the same-origin public brand icon and normalized final-canvas coordinates; preview and JPEG export share one composition so crop/rotation never displace the saved seal.
- Visitors get the full Navbar/BottomNav with a permanent Entrar/Criar conta CTA; private actions redirect to /login with safeRedirect, because the homepage must be public (Google OAuth).
- Product discount eligibility and percentage calculations use the shared `productPrice` helper so every storefront surface follows the same rule.
- Roleta DERDALAX: spins, code consumption, referral credit and order discounts are decided only by SECURITY DEFINER RPCs (roleta_*), and the reward lifecycle follows order_sellers status via trigger, because the browser must never choose or apply a discount.
- Roleta price estimates on cards/cart use `getRoletaLine`/`getRoletaCart` in `productPrice`, which mirror `roleta_apply_to_order`, so storefront previews match what the server charges.
- Roleta: each valid code grants exactly one spin (no per-user/campaign limit); referral progress = valid referrals − 5 × referral codes issued; an order uses only the single ACTIVE reward with the best real saving (chosen in `roleta_apply_to_order`), because rewards must never stack.
- Home hero headings and images come from each admin-managed `home_banners` row; images use the public `products` bucket under `banners/`, with the bundled hero and default heading as fallback so existing banners remain compatible.
- Profile phone is normalized/validated by the `normalize_profile_phone` trigger only when it changes, so legacy values stay intact.

- Storefront reads use the explicit public_products security-invoker projection; reservation ownership is a user-scoped boolean RPC and full moderation records use get_managed_products, because public clients must never read reservation owner IDs.
- Orders are created only through create_order_secure; direct client INSERT grants and policies remain revoked to prevent price and status bypasses.
- Admin panel requires a server-side step-up session (passkey or one-time recovery code, HttpOnly cookie, hash stored in admin_verified_sessions); admin management runs only in Super Admin server functions (SUPER_ADMIN_USER_IDS env), because a stolen Supabase session alone must not unlock critical admin actions.
