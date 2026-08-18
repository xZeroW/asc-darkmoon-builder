create table public.builds (
  id text primary key check (id ~ '^[A-Za-z0-9]{12}$'),
  name text not null check (char_length(trim(name)) between 1 and 100),
  card_ids jsonb not null check (jsonb_typeof(card_ids) = 'array' and jsonb_array_length(card_ids) = 16),
  created_at timestamptz not null default now()
);

alter table public.builds enable row level security;

create policy "Anyone can view builds"
  on public.builds for select
  using (true);

create policy "Anyone can create builds"
  on public.builds for insert
  with check (true);

create index builds_created_at_idx on public.builds (created_at desc);
