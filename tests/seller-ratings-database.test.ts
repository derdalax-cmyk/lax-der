import { test, expect, afterAll } from "bun:test";
import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
afterAll(() => sql.end());

test("public seller aggregate tracks zero, three, insert, edit and removal without stored counters", async () => {
  // All fixtures and trigger effects are rolled back; no test reviews persist.
  await sql.begin(async tx => {
    const [seller] = await tx`select id from public.sellers where status='approved' limit 1`;
    expect(seller).toBeDefined();
    const users = await tx`select id from public.profiles order by id limit 4`;
    expect(users.length).toBe(4);
    await tx`delete from public.seller_reviews where seller_id=${seller.id}`;
    const summary = async () => (await tx`select public.get_public_seller(${seller.id}::uuid) as summary`)[0].summary;
    expect((await summary()).rating).toBe(0);
    expect((await summary()).total_reviews).toBe(0);
    for (const [i, rating] of [5, 5, 4].entries()) {
      await tx`insert into public.seller_reviews(seller_id,user_id,rating) values(${seller.id},${users[i].id},${rating})`;
    }
    expect((await summary()).rating).toBeCloseTo(14 / 3, 10);
    expect((await summary()).total_reviews).toBe(3);
    await tx`insert into public.seller_reviews(seller_id,user_id,rating_quality,rating_delivery,rating_service,rating) values(${seller.id},${users[3].id},3,3,3,5)`;
    expect((await summary()).rating).toBe(4.25);
    expect((await summary()).total_reviews).toBe(4);
    await tx`update public.seller_reviews set rating_quality=5,rating_delivery=5,rating_service=5 where seller_id=${seller.id} and user_id=${users[3].id}`;
    expect((await summary()).rating).toBe(4.75);
    await tx`delete from public.seller_reviews where seller_id=${seller.id} and user_id=${users[3].id}`;
    expect((await summary()).rating).toBeCloseTo(14 / 3, 10);
    expect((await summary()).total_reviews).toBe(3);
    // Deliberately stale legacy counters cannot affect the public result.
    await tx`update public.sellers set rating=0,total_reviews=0 where id=${seller.id}`;
    expect((await summary()).rating).toBeCloseTo(14 / 3, 10);
    expect((await summary()).total_reviews).toBe(3);
    await tx.rollback();
  });
});

test("customer without a purchase cannot create a seller review", async () => {
  await sql.begin(async tx => {
    const [seller] = await tx`select id from public.sellers where status='approved' limit 1`;
    const [user] = await tx`select id from public.profiles order by id limit 1`;
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: user.id, role: "authenticated" })},true)`;
    await tx`set local role authenticated`;
    await expect(tx.savepoint(async sp => {
      await sp`insert into public.seller_reviews(seller_id,user_id,rating,order_id) values(${seller.id},${user.id},5,null)`;
    })).rejects.toMatchObject({ code: "42501" });
    await tx.rollback();
  });
});