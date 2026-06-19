-- Public shared Supabase schema for "ש.פ.ר ניקיון ואחזקה"
-- Run this in Supabase SQL Editor.
-- Warning: this resets these app tables in Supabase.

create extension if not exists "pgcrypto";

drop table if exists public.reminder_notes cascade;
drop table if exists public.special_services cascade;
drop table if exists public.expenses cascade;
drop table if exists public.service_tasks cascade;
drop table if exists public.clients cascade;

drop type if exists public.frequency_type cascade;
drop type if exists public.task_status cascade;
drop type if exists public.payment_method cascade;
drop type if exists public.expense_category cascade;

create type public.frequency_type as enum ('weekly', 'biweekly', 'monthly', 'once');
create type public.task_status as enum ('pending', 'done');
create type public.payment_method as enum ('cash', 'transfer', 'debt');
create type public.expense_category as enum ('fuel', 'supplies', 'parking', 'other');

create table public.clients (
  id text primary key,
  store_name text not null,
  address text not null,
  contact_name text not null,
  phone text not null,
  price numeric(10, 2) not null check (price >= 0),
  frequency public.frequency_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_tasks (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  scheduled_date date not null,
  status public.task_status not null default 'pending',
  payment_method public.payment_method,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_required_when_done check (
    (status = 'pending' and payment_method is null and completed_at is null)
    or
    (status = 'done' and payment_method is not null and completed_at is not null)
  )
);

create table public.special_services (
  id text primary key,
  task_id text not null references public.service_tasks (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id text primary key,
  expense_date date not null default current_date,
  category public.expense_category not null,
  amount numeric(10, 2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminder_notes (
  id text primary key,
  client_id text references public.clients (id) on delete set null,
  reminder_date date not null default current_date,
  text text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_store_name_idx on public.clients (store_name);
create index service_tasks_date_idx on public.service_tasks (scheduled_date);
create index service_tasks_client_date_idx on public.service_tasks (client_id, scheduled_date);
create index service_tasks_status_payment_idx on public.service_tasks (status, payment_method);
create index special_services_task_idx on public.special_services (task_id);
create index expenses_date_idx on public.expenses (expense_date);
create index reminder_notes_date_idx on public.reminder_notes (reminder_date);
create index reminder_notes_client_idx on public.reminder_notes (client_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_service_tasks_updated_at
before update on public.service_tasks
for each row execute function public.set_updated_at();

create trigger set_special_services_updated_at
before update on public.special_services
for each row execute function public.set_updated_at();

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create trigger set_reminder_notes_updated_at
before update on public.reminder_notes
for each row execute function public.set_updated_at();

alter table public.clients disable row level security;
alter table public.service_tasks disable row level security;
alter table public.special_services disable row level security;
alter table public.expenses disable row level security;
alter table public.reminder_notes disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.clients to anon, authenticated;
grant select, insert, update, delete on public.service_tasks to anon, authenticated;
grant select, insert, update, delete on public.special_services to anon, authenticated;
grant select, insert, update, delete on public.expenses to anon, authenticated;
grant select, insert, update, delete on public.reminder_notes to anon, authenticated;
