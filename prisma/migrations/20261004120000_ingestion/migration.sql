-- Real-time ingestion records and authorized calendar events.
-- Demo seed data is not part of this migration.

alter table "user_preferences"
  add column if not exists "notify_commitment" boolean not null default true,
  add column if not exists "notify_deadline" boolean not null default true,
  add column if not exists "notify_blocked" boolean not null default true,
  add column if not exists "notify_deadline_change" boolean not null default true,
  add column if not exists "notify_resolved" boolean not null default true,
  add column if not exists "notify_minor_context" boolean not null default false,
  add column if not exists "notify_in_app" boolean not null default true;

create table if not exists "ingestion_events" (
  "id" text not null,
  "user_id" uuid not null,
  "connector_id" text not null,
  "provider" text not null,
  "external_event_id" text not null,
  "event_type" text not null,
  "payload_hash" text not null,
  "occurred_at" timestamp(3) not null,
  "received_at" timestamp(3) not null default current_timestamp,
  "processing_status" text not null default 'RECEIVED',
  "processed_at" timestamp(3),
  "error" text,
  "route" text,
  "summary" text,
  "created_at" timestamp(3) not null default current_timestamp,
  constraint "ingestion_events_pkey" primary key ("id")
);

create unique index if not exists "ingestion_events_connector_id_external_event_id_key"
  on "ingestion_events"("connector_id", "external_event_id");
create index if not exists "ingestion_events_user_id_received_at_idx"
  on "ingestion_events"("user_id", "received_at");

alter table "ingestion_events"
  drop constraint if exists "ingestion_events_user_id_fkey";
alter table "ingestion_events"
  add constraint "ingestion_events_user_id_fkey"
  foreign key ("user_id") references "users"("id") on delete cascade on update cascade;

alter table "ingestion_events"
  drop constraint if exists "ingestion_events_connector_id_fkey";
alter table "ingestion_events"
  add constraint "ingestion_events_connector_id_fkey"
  foreign key ("connector_id") references "integration_accounts"("id") on delete cascade on update cascade;

create table if not exists "calendar_events" (
  "id" text not null,
  "user_id" uuid not null,
  "account_id" text not null,
  "calendar_id" text not null,
  "external_id" text not null,
  "title" text not null,
  "status" text not null,
  "starts_at" timestamp(3),
  "ends_at" timestamp(3),
  "time_zone" text,
  "html_link" text,
  "updated_remote" text,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "calendar_events_pkey" primary key ("id")
);

create unique index if not exists "calendar_events_account_id_external_id_key"
  on "calendar_events"("account_id", "external_id");
create index if not exists "calendar_events_user_id_starts_at_idx"
  on "calendar_events"("user_id", "starts_at");

alter table "calendar_events"
  drop constraint if exists "calendar_events_user_id_fkey";
alter table "calendar_events"
  add constraint "calendar_events_user_id_fkey"
  foreign key ("user_id") references "users"("id") on delete cascade on update cascade;

alter table "calendar_events"
  drop constraint if exists "calendar_events_account_id_fkey";
alter table "calendar_events"
  add constraint "calendar_events_account_id_fkey"
  foreign key ("account_id") references "integration_accounts"("id") on delete cascade on update cascade;
