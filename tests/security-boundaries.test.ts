import { test, expect } from 'bun:test';
import postgres from 'postgres';

const sql = postgres(process.env.SUPABASE_DB_URL ?? '', { max: 1 });
const tables = ['orders', 'order_items', 'order_sellers'] as const;
for (const table of tables) {
  test(`authenticated cannot insert directly into ${table}`, async () => {
    await sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      await expect(tx`insert into ${tx('public.' + table)} default values`).rejects.toMatchObject({ code: '42501' });
    }).catch((e) => { if (e.code !== '25P02') throw e; });
  });
}
test('anonymous and authenticated cannot read reservation identity', async () => {
  for (const role of ['anon', 'authenticated']) {
    await sql.begin(async (tx) => {
      await tx.unsafe(`set local role ${role}`);
      await expect(tx`select reserved_by from public.products limit 1`).rejects.toMatchObject({ code: '42501' });
    }).catch((e) => { if (e.code !== '25P02') throw e; });
  }
});
test('public projection excludes all three private columns', async () => {
  const rows = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='public_products'`;
  const columns = rows.map(r => r.column_name);
  expect(columns).toContain('base_price');
  for (const name of ['reserved_by', 'rejection_reason', 'stock_alert']) expect(columns).not.toContain(name);
});
test('secure checkout works with server prices and reads back for owner (rolled back)', async () => {
  const rollback = new Error('TEST_ROLLBACK');
  await expect(sql.begin(async (tx) => {
    const [user] = await tx`select id from auth.users where id = '5e91bf6f-d517-460d-a7c5-f22d84b6d2a4'::uuid`;
    expect(user).toBeDefined();
    const [product] = await tx`select id,base_price,shipping_fee from public.products where approval_status='approved' and status='available' and is_unique=false and stock>1 order by id limit 1 for update`;
    expect(product).toBeDefined();
    await tx`select set_config('request.jwt.claim.sub', ${user.id}, true),set_config('request.jwt.claims', ${JSON.stringify({sub:user.id,role:'authenticated'})},true)`;
    await tx`set local role authenticated`;
    const [result] = await tx`select public.create_order_secure(${JSON.stringify([{product_id:product.id,quantity:1,price:0,seller_id:null}])}::jsonb,'Security verification','+258840000000','{"city":"Maputo"}'::jsonb,'entrega') as data`;
    expect(result.data.order_id).toBeString();
    const [order] = await tx`select subtotal,shipping,total,status,payment_status from public.orders where id=${result.data.order_id}`;
    expect(Number(order.subtotal)).toBe(Number(product.base_price));
    expect(Number(order.total)).toBe(Number(product.base_price)+Number(product.shipping_fee));
    expect(order.status).toBe('pending');
    expect(order.payment_status).toBe('pending');
    const [items] = await tx`select count(*)::int as n from public.order_items where order_id=${result.data.order_id}`;
    expect(items.n).toBe(1);
    throw rollback;
  })).rejects.toBe(rollback);
});
test('ordinary buyer cannot obtain full managed product rows', async () => {
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true)`;
    await tx`set local role authenticated`;
    const rows = await tx`select * from public.get_managed_products(null)`;
    expect(rows).toHaveLength(0);
  });
});
test('admin retains full product records', async () => {
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub','5e91bf6f-d517-460d-a7c5-f22d84b6d2a4',true)`;
    await tx`set local role authenticated`;
    const rows = await tx`select * from public.get_managed_products(null) limit 1`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('rejection_reason');
  });
});
test('seller receives own moderation data only', async () => {
  const [seller] = await sql`select id,user_id from public.sellers where user_id is not null and status='approved' order by id limit 1`;
  expect(seller).toBeDefined();
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${seller.user_id},true)`;
    await tx`set local role authenticated`;
    const rows = await tx`select * from public.get_managed_products(${seller.id})`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r=>r.seller_id===seller.id)).toBe(true);
    expect(rows[0]).toHaveProperty('rejection_reason');
  });
});
test('reservation RPC discloses only a boolean for current user', async () => {
  const [p] = await sql`select id from public.public_products limit 1`;
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub','5e91bf6f-d517-460d-a7c5-f22d84b6d2a4',true)`;
    await tx`set local role authenticated`;
    const [row] = await tx`select * from public.get_my_product_reservations(array[${p.id}::uuid])`;
    expect(Object.keys(row).sort()).toEqual(['product_id','reserved_by_me']);
    expect(typeof row.reserved_by_me).toBe('boolean');
  });
});
