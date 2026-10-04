-- Which reader decided an agent run: "heuristic", "heuristic:fallback", or "openai:<model>".
alter table "agent_runs" add column if not exists "provider" text not null default 'heuristic';
