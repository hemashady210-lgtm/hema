-- pgTAP: job queue retries, backoff, dead-letter and admin retry_job() (E1). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);

create temp table j (k text primary key, id bigint) on commit drop;
insert into j values ('a', public.enqueue_job('ai_reply', '{"message_id":"m1"}', null, 'ai', now(), 'job-test-a'));
insert into j values ('dup', public.enqueue_job('ai_reply', '{"message_id":"m1"}', null, 'ai', now(), 'job-test-a'));

select ok((select id from j where k = 'a') is not null, 'enqueue_job returns an id');
select ok((select id from j where k = 'dup') is null, 'same idempotency key is de-duplicated');

-- Retryable failure → queued again with backoff.
select is((select count(*)::int from public.claim_jobs('ai', 'w1', 5)), 1, 'claim_jobs claims the queued job');
select public.fail_job((select id from j where k = 'a'), 'timeout', true);
select is((select status::text from public.jobs where id = (select id from j where k = 'a')), 'queued',
  'retryable failure re-queues the job');
select ok((select run_at > now() from public.jobs where id = (select id from j where k = 'a')),
  'the retry is scheduled in the future (backoff)');

-- Non-retryable failure → dead.
update public.jobs set run_at = now() where id = (select id from j where k = 'a');
select is((select count(*)::int from public.claim_jobs('ai', 'w1', 5)), 1, 'claimed again');
select public.fail_job((select id from j where k = 'a'), 'provider rejected payload', false);
select is((select status::text from public.jobs where id = (select id from j where k = 'a')), 'dead',
  'non-retryable failure moves the job to dead');

-- retry_job (admin dead-letter retry).
select ok(public.retry_job((select id from j where k = 'a'), null, 'fixed upstream'), 'retry_job re-queues a dead job');
select results_eq(
  $$ select status::text, attempts, retry_count, finished_at is null, last_error
     from public.jobs where id = (select id from pg_temp.j where k = 'a') $$,
  $$ values ('queued'::text, 0, 1, true, 'provider rejected payload'::text) $$,
  'retried job: queued, fresh attempts, retry counted, last error kept');
select is(
  (select count(*)::int from public.audit_logs
   where action = 'job.retry' and entity_id = (select id from j where k = 'a')::text and actor_type = 'system'),
  1, 'every retry is audit-logged');
select ok(not public.retry_job((select id from j where k = 'a')), 'retry_job on a job that is not dead is a no-op');
select ok(not public.retry_job(-1), 'retry_job on an unknown job returns false');

-- Exhausting max_attempts also ends in dead.
insert into j values ('b', public.enqueue_job('deliver_message', '{}', null, 'ai', now(), 'job-test-b'));
update public.jobs set max_attempts = 1 where id = (select id from j where k = 'b');
select count(*) from public.claim_jobs('ai', 'w2', 5);
select public.fail_job((select id from j where k = 'b'), 'boom', true);
select is((select status::text from public.jobs where id = (select id from j where k = 'b')), 'dead',
  'a job that used all attempts is dead even when the error is retryable');

-- Stuck jobs (worker died) are re-queued by the sweep.
insert into j values ('c', public.enqueue_job('ai_reply', '{}', null, 'ai', now(), 'job-test-c'));
select count(*) from public.claim_jobs('ai', 'w3', 5);
update public.jobs set lock_expires_at = now() - interval '1 second' where id = (select id from j where k = 'c');
select is(public.requeue_stuck_jobs(), 1, 'requeue_stuck_jobs re-queues an expired lock');

-- A worker can only finish the job it holds (0013).
select count(*) from public.claim_jobs('ai', 'w4', 5);
select ok(not public.complete_job((select id from j where k = 'c'), 'someone-else'), 'another worker cannot complete the job');
select ok(public.complete_job((select id from j where k = 'c'), 'w4'), 'the holding worker completes it');

-- A stuck job on its last attempt is dead with a finish time; the note is added once.
insert into j values ('d', public.enqueue_job('ai_reply', '{}', null, 'ai', now(), 'job-test-d'));
update public.jobs set max_attempts = 1 where id = (select id from j where k = 'd');
select count(*) from public.claim_jobs('ai', 'w5', 5);
update public.jobs set lock_expires_at = now() - interval '1 second' where id = (select id from j where k = 'd');
select public.requeue_stuck_jobs();
select ok((select status = 'dead' and finished_at is not null from public.jobs where id = (select id from j where k = 'd')),
  'expired lock on the last attempt → dead with finished_at');
select is((select last_error from public.jobs where id = (select id from j where k = 'd')), '[lock expired]',
  'the lock-expired note is recorded once');

-- Queue RPCs are service-role only.
set local role authenticated;
select throws_ok($$ select public.retry_job(1) $$, '42501', null, 'clients cannot call retry_job');
reset role;
set local role anon;
select throws_ok($$ select public.retry_job(1) $$, '42501', null, 'anon cannot call retry_job');
reset role;

select * from finish();
rollback;
