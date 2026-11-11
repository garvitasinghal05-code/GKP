-- ================================================================
-- GKP (GharKePaas v2) — Supabase Postgres schema
-- Safe to re-run: tables are never dropped, so existing data is
-- never lost. Only functions/triggers/policies (pure logic, no
-- data) are replaced each run.
-- ================================================================
create extension if not exists postgis;
create extension if not exists pg_trgm;   -- fuzzy product/shop search

-- ----------------------------------------------------------------
-- ENUM TYPES  (Postgres has no "CREATE TYPE IF NOT EXISTS", so we
-- check manually — this block is safe to re-run)
-- ----------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('customer', 'shop_owner', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'shop_status') then
    create type shop_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'location_source') then
    create type location_source as enum ('pin', 'geocoded', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'fulfillment_type') then
    create type fulfillment_type as enum ('delivery', 'pickup');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum (
      'placed', 'confirmed', 'modified', 'awaiting_approval',
      'out_for_delivery', 'ready_for_pickup', 'completed',
      'rejected', 'cancelled', 'expired'
    );
  end if;
end $$;

-- ----------------------------------------------------------------
-- PROFILES  (extends auth.users)
-- ----------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'customer',
  created_at timestamptz default now()
);

-- auto-create a profile row whenever someone signs up
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ----------------------------------------------------------------
-- SHOPS
-- ----------------------------------------------------------------
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  shop_name text not null,
  category text not null,
  description text,
  address text not null,
  city text not null,
  pincode text not null,
  location geography(point, 4326) not null,
  location_source location_source not null default 'pin',
  shop_photo_url text,
  id_proof_url text,
  id_proof_name text,
  is_open boolean not null default true,          -- manual override
  opens_at time,
  closes_at time,
  status shop_status not null default 'pending',
  rejection_note text,
  submission_count int not null default 1,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists shops_location_gix on shops using gist (location);
create index if not exists shops_status_ix on shops (status);
create index if not exists shops_name_trgm on shops using gin (shop_name gin_trgm_ops);

-- ----------------------------------------------------------------
-- PRODUCTS  (per-shop inventory)
-- ----------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  unit text not null,
  stock_qty int not null default 0 check (stock_qty >= 0),
  is_available boolean not null default true,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists products_shop_ix on products (shop_id);
create index if not exists products_name_trgm on products using gin (name gin_trgm_ops);

-- ----------------------------------------------------------------
-- ADDRESSES  (customer saved delivery addresses)
-- ----------------------------------------------------------------
create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  label text default 'Home',            -- Home / Work / Other
  full_address text not null,
  location geography(point, 4326) not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

create index if not exists addresses_customer_ix on addresses (customer_id);

-- ----------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  fulfillment_type fulfillment_type not null,
  delivery_address_id uuid references addresses(id),
  total_amount numeric(10,2) not null,
  status order_status not null default 'placed',
  payment_status payment_status not null default 'pending',
  payment_ref text,                      -- gateway transaction id
  shop_note text,
  reservation_expires_at timestamptz,     -- only for pickup, now() + 15 min
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists orders_customer_ix on orders (customer_id);
create index if not exists orders_shop_ix on orders (shop_id);
create index if not exists orders_status_ix on orders (status);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,           -- snapshot at time of order
  unit_price numeric(10,2) not null,
  quantity int not null,
  modified_quantity int,
  is_removed boolean default false
);

-- ----------------------------------------------------------------
-- REVIEWS
-- ----------------------------------------------------------------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique (reviewer_id, shop_id)
);

-- ----------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- notify a customer automatically whenever their order's status changes
create or replace function notify_on_order_status_change() returns trigger as $$
begin
  if new.status is distinct from old.status then
    insert into notifications (user_id, message)
    values (new.customer_id, 'Your order #' || new.id || ' is now ' || new.status);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists order_status_notify on orders;
create trigger order_status_notify
  after update on orders
  for each row execute procedure notify_on_order_status_change();

-- ================================================================
-- RPC: get_nearby_shops — PostGIS radius search
-- ================================================================
create or replace function get_nearby_shops(
  lat double precision,
  lng double precision,
  radius_km double precision default 5,
  search_term text default null
)
returns table (
  shop_id uuid,
  shop_name text,
  category text,
  distance_km double precision,
  is_open boolean,
  rating numeric,
  latitude double precision,
  longitude double precision
)
language sql stable as $$
  select
    s.id,
    s.shop_name,
    s.category,
    round((st_distance(s.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) / 1000)::numeric, 2)::double precision,
    s.is_open,
    coalesce((select avg(r.rating) from reviews r where r.shop_id = s.id), 0)::numeric,
    st_y(s.location::geometry),
    st_x(s.location::geometry)
  from shops s
  where s.status = 'approved'
    and st_dwithin(s.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_km * 1000)
    and (search_term is null or s.shop_name ilike '%' || search_term || '%'
         or exists (select 1 from products p where p.shop_id = s.id and p.name ilike '%' || search_term || '%'))
  order by st_distance(s.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) asc;
$$;

-- ================================================================
-- ROW LEVEL SECURITY
-- (enabling RLS is safe to re-run — it's a flag, not a data operation)
-- ================================================================
alter table profiles enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;

-- Policies hold no data, so drop-and-recreate is safe here too.

drop policy if exists "profiles_self_select" on profiles;
create policy "profiles_self_select" on profiles for select using (true);

drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles for update using (auth.uid() = id);

drop policy if exists "shops_public_read_approved" on shops;
create policy "shops_public_read_approved" on shops for select
  using (status = 'approved' or owner_id = auth.uid()
         or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "shops_owner_insert" on shops;
create policy "shops_owner_insert" on shops for insert
  with check (owner_id = auth.uid());

drop policy if exists "shops_owner_update" on shops;
create policy "shops_owner_update" on shops for update
  using (owner_id = auth.uid()
         or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "products_public_read" on products;
create policy "products_public_read" on products for select
  using (exists (select 1 from shops s where s.id = shop_id and s.status = 'approved')
         or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists "products_owner_write" on products;
create policy "products_owner_write" on products for all
  using (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists "addresses_own" on addresses;
create policy "addresses_own" on addresses for all using (customer_id = auth.uid());

drop policy if exists "orders_customer_read" on orders;
create policy "orders_customer_read" on orders for select using (customer_id = auth.uid());

drop policy if exists "orders_shop_owner_read" on orders;
create policy "orders_shop_owner_read" on orders for select
  using (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists "orders_customer_insert" on orders;
create policy "orders_customer_insert" on orders for insert with check (customer_id = auth.uid());

drop policy if exists "orders_shop_owner_update" on orders;
create policy "orders_shop_owner_update" on orders for update
  using (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists "orders_customer_update_own" on orders;
create policy "orders_customer_update_own" on orders for update using (customer_id = auth.uid());

drop policy if exists "order_items_visible" on order_items;
create policy "order_items_visible" on order_items for select
  using (exists (
    select 1 from orders o where o.id = order_id
    and (o.customer_id = auth.uid()
         or exists (select 1 from shops s where s.id = o.shop_id and s.owner_id = auth.uid()))
  ));

drop policy if exists "reviews_public_read" on reviews;
create policy "reviews_public_read" on reviews for select using (true);

drop policy if exists "reviews_own_write" on reviews;
create policy "reviews_own_write" on reviews for insert with check (reviewer_id = auth.uid());

drop policy if exists "reviews_own_update" on reviews;
create policy "reviews_own_update" on reviews for update using (reviewer_id = auth.uid());

drop policy if exists "notifications_own" on notifications;
create policy "notifications_own" on notifications for select using (user_id = auth.uid());

drop policy if exists "notifications_own_update" on notifications;
create policy "notifications_own_update" on notifications for update using (user_id = auth.uid());
