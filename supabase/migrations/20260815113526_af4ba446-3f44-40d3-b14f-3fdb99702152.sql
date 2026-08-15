-- 1. Create app_operator enum
create type public.app_operator as enum ('GP', 'Robi', 'Airtel', 'Banglalink', 'Other');

-- 2. Create app_card_type enum
create type public.app_card_type as enum ('Minute', 'Internet');

-- 3. Create card_products table
create table public.card_products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    operator public.app_operator not null,
    card_type public.app_card_type not null,
    amount_label text not null, -- e.g. '100 Minute', '5GB'
    selling_price numeric not null default 0,
    image_url text,
    description text,
    validity text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 4. Create card_codes table
create table public.card_codes (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.card_products(id) on delete cascade,
    code text not null,
    is_used boolean not null default false,
    used_by uuid references auth.users(id),
    used_at timestamptz,
    created_at timestamptz not null default now()
);

-- 5. Enable RLS
alter table public.card_products enable row level security;
alter table public.card_codes enable row level security;

-- 6. Grant permissions
grant select on public.card_products to authenticated;
grant select on public.card_products to anon;
grant all on public.card_products to service_role;

grant select on public.card_codes to authenticated; -- Users might need to see their own purchased codes
grant all on public.card_codes to service_role;

-- 7. Policies
create policy "Admins can do everything on card_products"
on public.card_products
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Anyone can view active card_products"
on public.card_products
for select
to authenticated, anon
using (is_active = true);

create policy "Admins can do everything on card_codes"
on public.card_codes
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_card_products_updated_at
    before update on public.card_products
    for each row
    execute function public.handle_updated_at();
