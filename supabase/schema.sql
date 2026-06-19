-- Supabase schema for "ש.פ.ר ניקיון ואחזקה"
-- Run this file in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.frequency_type as enum ('weekly', 'biweekly', 'monthly');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_status as enum ('pending', 'done');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'transfer', 'debt');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.expense_category as enum ('fuel', 'supplies', 'parking', 'other');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_name text not null,
  address text not null,
  contact_name text not null,
  phone text not null,
  price numeric(10, 2) not null check (price >= 0),
  frequency public.frequency_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
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

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expense_date date not null default current_date,
  category public.expense_category not null,
  amount numeric(10, 2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on public.clients (user_id);
create index if not exists clients_is_active_idx on public.clients (is_active);
create index if not exists service_tasks_user_date_idx on public.service_tasks (user_id, scheduled_date);
create index if not exists service_tasks_client_date_idx on public.service_tasks (client_id, scheduled_date);
create index if not exists service_tasks_status_payment_idx on public.service_tasks (status, payment_method);
create index if not exists expenses_user_date_idx on public.expenses (user_id, expense_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists set_service_tasks_updated_at on public.service_tasks;
create trigger set_service_tasks_updated_at
before update on public.service_tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.service_tasks enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Users can read their clients" on public.clients;
create policy "Users can read their clients"
on public.clients for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their clients" on public.clients;
create policy "Users can insert their clients"
on public.clients for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their clients" on public.clients;
create policy "Users can update their clients"
on public.clients for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their clients" on public.clients;
create policy "Users can delete their clients"
on public.clients for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their service tasks" on public.service_tasks;
create policy "Users can read their service tasks"
on public.service_tasks for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their service tasks" on public.service_tasks;
create policy "Users can insert their service tasks"
on public.service_tasks for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their service tasks" on public.service_tasks;
create policy "Users can update their service tasks"
on public.service_tasks for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their service tasks" on public.service_tasks;
create policy "Users can delete their service tasks"
on public.service_tasks for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their expenses" on public.expenses;
create policy "Users can read their expenses"
on public.expenses for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their expenses" on public.expenses;
create policy "Users can insert their expenses"
on public.expenses for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their expenses" on public.expenses;
create policy "Users can update their expenses"
on public.expenses for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their expenses" on public.expenses;
create policy "Users can delete their expenses"
on public.expenses for delete
to authenticated
using (auth.uid() = user_id);
