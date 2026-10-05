# Project architecture
- Visitors get the full Navbar/BottomNav with a permanent Entrar/Criar conta CTA; private actions redirect to /login with safeRedirect, because the homepage must be public (Google OAuth).
- Product discount eligibility and percentage calculations use the shared `productPrice` helper so every storefront surface follows the same rule.
- Roleta DERDALAX: spins, code consumption, referral credit and order discounts are decided only by SECURITY DEFINER RPCs (roleta_*), and the reward lifecycle follows order_sellers status via trigger, because the browser must never choose or apply a discount.
- Roleta price estimates on cards/cart use `getRoletaLine`/`getRoletaCart` in `productPrice`, which mirror `roleta_apply_to_order`, so storefront previews match what the server charges.
