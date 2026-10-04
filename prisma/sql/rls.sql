-- Row Level Security for Supabase-hosted Postgres.
-- Apply after Prisma migrations when using Supabase.
-- Prisma (service role / direct DATABASE_URL) bypasses RLS.

alter table users enable row level security;
alter table profiles enable row level security;
alter table people enable row level security;
alter table conversation_sources enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table threads enable row level security;
alter table commitments enable row level security;
alter table commitment_evidence enable row level security;
alter table thread_events enable row level security;
alter table resolutions enable row level security;
alter table reminders enable row level security;
alter table notifications enable row level security;
alter table user_preferences enable row level security;
alter table integrations enable row level security;
alter table audit_logs enable row level security;
alter table push_subscriptions enable row level security;
alter table agent_runs enable row level security;
alter table interventions enable row level security;
alter table action_proposals enable row level security;
alter table action_approvals enable row level security;
alter table integration_accounts enable row level security;
alter table source_permissions enable row level security;
alter table source_conversations enable row level security;
alter table source_messages enable row level security;
alter table memory_candidates enable row level security;
alter table provider_events enable row level security;
alter table consent_events enable row level security;
alter table ingestion_events enable row level security;
alter table calendar_events enable row level security;

drop policy if exists "users_self" on users;
create policy "users_self" on users
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_self" on profiles;
create policy "profiles_self" on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "people_self" on people;
create policy "people_self" on people
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "conversation_sources_self" on conversation_sources;
create policy "conversation_sources_self" on conversation_sources
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "conversations_self" on conversations;
create policy "conversations_self" on conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "messages_self" on messages;
create policy "messages_self" on messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "threads_self" on threads;
create policy "threads_self" on threads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "commitments_self" on commitments;
create policy "commitments_self" on commitments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "commitment_evidence_self" on commitment_evidence;
create policy "commitment_evidence_self" on commitment_evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "thread_events_self" on thread_events;
create policy "thread_events_self" on thread_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "resolutions_self" on resolutions;
create policy "resolutions_self" on resolutions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "reminders_self" on reminders;
create policy "reminders_self" on reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_self" on notifications;
create policy "notifications_self" on notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_preferences_self" on user_preferences;
create policy "user_preferences_self" on user_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "integrations_self" on integrations;
create policy "integrations_self" on integrations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "audit_logs_self_read" on audit_logs;
create policy "audit_logs_self_read" on audit_logs
  for select using (user_id = auth.uid());

drop policy if exists "push_subscriptions_self" on push_subscriptions;
create policy "push_subscriptions_self" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agent_runs_self" on agent_runs;
create policy "agent_runs_self" on agent_runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "interventions_self" on interventions;
create policy "interventions_self" on interventions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "action_proposals_self" on action_proposals;
create policy "action_proposals_self" on action_proposals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "action_approvals_self" on action_approvals;
create policy "action_approvals_self" on action_approvals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "integration_accounts_self" on integration_accounts;
create policy "integration_accounts_self" on integration_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "source_permissions_self" on source_permissions;
create policy "source_permissions_self" on source_permissions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "source_conversations_self" on source_conversations;
create policy "source_conversations_self" on source_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "source_messages_self" on source_messages;
create policy "source_messages_self" on source_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "memory_candidates_self" on memory_candidates;
create policy "memory_candidates_self" on memory_candidates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "provider_events_self" on provider_events;
create policy "provider_events_self" on provider_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "consent_events_self" on consent_events;
create policy "consent_events_self" on consent_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table threads replica identity full;
alter table notifications replica identity full;
alter table people replica identity full;
alter table reminders replica identity full;
alter table interventions replica identity full;
alter table memory_candidates replica identity full;

drop policy if exists "ingestion_events_self" on ingestion_events;
create policy "ingestion_events_self" on ingestion_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "calendar_events_self" on calendar_events;
create policy "calendar_events_self" on calendar_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table source_messages replica identity full;
alter table ingestion_events replica identity full;
alter table calendar_events replica identity full;
