import { test, expect, afterAll } from "bun:test";
import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
afterAll(() => sql.end());

test("public seller aggregate tracks zero, three, insert, edit and removal without stored counters", async () => {
  // Execute the deployed SQL body against read-only CTE fixtures; no writes or RLS changes.
  const [fn] = await sql`select prosrc from pg_proc where oid='public.get_public_seller(uuid)'::regprocedure`;
  const id = "00000000-0000-0000-0000-000000000001";
  const body = String(fn.prosrc).replaceAll("public.sellers", "fixture_sellers").replaceAll("public.seller_reviews", "fixture_reviews").replaceAll("public.products", "fixture_products").replace(/\b_id\b/g, `'${id}'::uuid`);
  for (const [ratings, average, total] of [
    [[], 0, 0], [[5, 5, 4], 14 / 3, 3], [[5, 5, 4, 3], 4.25, 4], [[5, 5, 4, 5], 4.75, 4], [[5, 5, 4], 14 / 3, 3], [[5, 5, 4, 0, 6], 14 / 3, 3],
  ] as [number[], number, number][]) {
    const rows = await sql.unsafe(`WITH fixture_sellers AS (select '${id}'::uuid id, 'Loja'::text store_name, null::text logo_url, null::text city, null::text province, null::text description, now() created_at, 'approved'::text status, 0 rating, 0 total_reviews), fixture_reviews AS (select '${id}'::uuid seller_id, unnest($1::int[]) rating), fixture_products AS (select '${id}'::uuid seller_id, 'approved'::text approval_status, 'sold'::text status where false) select (${body.trim().replace(/;$/, "")}) summary`, [ratings]);
    expect(rows[0].summary.rating).toBeCloseTo(average, 10);
    expect(rows[0].summary.total_reviews).toBe(total);
  }
});

test("real public seller summary matches valid review rows", async () => {
  const rows = await sql`select public.get_public_seller(s.id) summary, (select coalesce(avg(rating),0) from public.seller_reviews where seller_id=s.id and rating between 1 and 5) actual, (select count(*) from public.seller_reviews where seller_id=s.id and rating between 1 and 5) total from public.sellers s where status='approved'`;
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.summary.rating).toBeCloseTo(Number(row.actual), 10);
    expect(row.summary.total_reviews).toBe(Number(row.total));
  }
});