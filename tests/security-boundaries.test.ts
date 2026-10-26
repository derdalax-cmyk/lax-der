import { test, expect, afterAll } from 'bun:test';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const sql = postgres(process.env.SUPABASE_DB_URL ?? '', { max: 1 });
afterAll(() => sql.end());
for (const table of ['orders', 'order_items', 'order_sellers']) {
  test(`authenticated has no INSERT grant on ${table}`, async () => {
    const [row] = await sql`select has_table_privilege('authenticated',${'public.'+table},'INSERT') as allowed`;
    expect(row.allowed).toBe(false);
  });
  test(`${table} has no direct client INSERT policies`, async () => {
    const rows = await sql`select policyname from pg_policies where schemaname='public' and tablename=${table} and cmd in ('INSERT','ALL') and roles && array['authenticated','public']::name[]`;
    expect(rows).toHaveLength(0);
  });
}
for (const role of ['anon', 'authenticated']) {
  test(`${role} cannot select reservation identity or private moderation fields`, async () => {
    for (const column of ['reserved_by','rejection_reason','stock_alert']) {
      const [row] = await sql`select has_column_privilege(${role},'public.products',${column},'SELECT') as allowed`;
      expect(row.allowed).toBe(false);
    }
  });
}
test('public projection excludes private fields and preserves display prices', async () => {
  const rows = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='public_products'`;
  const columns = rows.map(r => r.column_name);
  for (const name of ['id','base_price','original_price','shipping_fee']) expect(columns).toContain(name);
  for (const name of ['reserved_by','rejection_reason','stock_alert']) expect(columns).not.toContain(name);
  const [view] = await sql`select reloptions from pg_class where oid='public.public_products'::regclass`;
  expect(view.reloptions).toContain('security_invoker=true');
});
test('secure checkout is authenticated-only SECURITY DEFINER with safe search path', async () => {
  const [fn] = await sql`select prosecdef,proconfig from pg_proc where oid='public.create_order_secure(jsonb,text,text,jsonb,text,text,text,text)'::regprocedure`;
  expect(fn.prosecdef).toBe(true);
  expect(fn.proconfig).toContain('search_path=public');
  for (const [role,allowed] of [['anon',false],['authenticated',true]] as const) {
    const [row] = await sql`select has_function_privilege(${role},'public.create_order_secure(jsonb,text,text,jsonb,text,text,text,text)','EXECUTE') as allowed`;
    expect(row.allowed).toBe(allowed);
  }
});
test('full product RPC requires identity and seller or admin permission', async () => {
  const [row] = await sql`select prosrc from pg_proc where oid='public.get_managed_products(uuid)'::regprocedure`;
  expect(row.prosrc).toContain('auth.uid() IS NOT NULL');
  expect(row.prosrc).toContain("public.has_role(auth.uid(), 'admin')");
  expect(row.prosrc).toContain('public.current_seller_id()');
  expect(row.prosrc).toContain("'products.view'");
  const [anon] = await sql`select has_function_privilege('anon','public.get_managed_products(uuid)','EXECUTE') as allowed`;
  expect(anon.allowed).toBe(false);
});
test('checkout browser uses secure RPC without direct inserts', () => {
  const code=readFileSync('src/routes/checkout.tsx','utf8');
  expect(code).toContain('supabase.rpc("create_order_secure"');
  for (const table of ['orders','order_items','order_sellers']) expect(code).not.toContain(`from("${table}")`);
});
