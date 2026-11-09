import { test, expect, afterAll } from "bun:test";
import postgres from "postgres";
const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
afterAll(() => sql.end());
test("onboarding queue is not readable by visitors or ordinary accounts", async () => {
  for (const role of ["anon", "authenticated"]) {
    const [r] = await sql`select has_table_privilege(${role},'public.profile_completion_reminders','SELECT') as allowed`;
    expect(r.allowed).toBe(false);
  }
});
test("dismissal is authenticated-only; claim and pause are service-only", async () => {
  const [anon] = await sql`select has_function_privilege('anon','public.dismiss_profile_completion()','EXECUTE') as allowed`;
  expect(anon.allowed).toBe(false);
  const [user] = await sql`select has_function_privilege('authenticated','public.dismiss_profile_completion()','EXECUTE') as allowed`;
  expect(user.allowed).toBe(true);
  for (const name of ["profile_reminder_claim()", "profile_reminder_pause_if_drained()"]) {
    const [r] = await sql`select has_function_privilege('authenticated',${'public.' + name},'EXECUTE') as allowed`;
    expect(r.allowed).toBe(false);
  }
});
test("database completion predicate matches all four fields", async () => {
  const [r] = await sql`select public.profile_is_complete('Maria','+258841234567','Sofala','Beira') as complete, public.profile_is_complete('Maria','+258841234567',null,'Beira') as missing_province, public.profile_is_complete('Maria','+258811234567','Sofala','Beira') as bad_phone`;
  expect(r.complete).toBe(true); expect(r.missing_province).toBe(false); expect(r.bad_phone).toBe(false);
});