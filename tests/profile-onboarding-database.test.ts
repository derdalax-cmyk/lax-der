import { test, expect, afterAll } from "bun:test";
import postgres from "postgres";
const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
afterAll(() => sql.end());
test("onboarding database: owner dismissal, 30-minute schedule, one cycle, completion cancels and private queue", async () => {
  const rollback = new Error("rollback-test");
  try {
    await sql.begin(async (tx) => {
      const uid = "5e91bf6f-d517-460d-a7c5-f22d84b6d2a4";
      await tx`update public.profiles set city='',profile_completion_dismissed_at=null,profile_completion_reminder_sent_at=null where id=${uid}`;
      await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
      await tx`set local role authenticated`;
      await tx`update public.profiles set profile_completion_reminder_sent_at=now() where id=${uid}`;
      const [forged] = await tx`select profile_completion_reminder_sent_at from public.profiles where id=${uid}`;
      expect(forged.profile_completion_reminder_sent_at).toBeNull();
      const [first] = await tx`select public.dismiss_profile_completion() as at`;
      const [second] = await tx`select public.dismiss_profile_completion() as at`;
      expect(first.at.getTime()).toBe(second.at.getTime());
      await tx`reset role`;
      const rows = await tx`select channel,extract(epoch from due_at-${first.at}::timestamptz) as delay from public.profile_completion_reminders where user_id=${uid} and status='pending'`;
      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.channel).sort()).toEqual(["email", "push"]);
      for (const row of rows) expect(Number(row.delay)).toBe(1800);
      await tx`set local role authenticated`;
      await tx`update public.profiles set city='Beira' where id=${uid}`;
      const [done] = await tx`select profile_completion_dismissed_at from public.profiles where id=${uid}`;
      expect(done.profile_completion_dismissed_at).toBeNull();
      await tx`reset role`;
      const [pending] = await tx`select count(*)::int as n from public.profile_completion_reminders where user_id=${uid} and status='pending'`;
      expect(pending.n).toBe(0);
      for (const role of ["anon", "authenticated"]) {
        const [r] = await tx`select has_table_privilege(${role},'public.profile_completion_reminders','SELECT') as allowed`;
        expect(r.allowed).toBe(false);
      }
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
});