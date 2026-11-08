-- ============================================================
-- Cuisto — schéma Supabase (commandes, réservations, messages, admin)
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».
-- Peut être relancé sans risque (aucune donnée n'est supprimée).
-- ============================================================

-- ---------- Plats (les prix font foi côté base ; gérés depuis admin.html > Menu) ----------
create table if not exists public.dishes (
    slug        text primary key,
    name        text    not null,
    price       integer not null check (price >= 0),
    available   boolean not null default true,
    sort_order  integer not null default 0
);
alter table public.dishes add column if not exists description text;
alter table public.dishes add column if not exists image_url   text;
alter table public.dishes add column if not exists tag         text;
alter table public.dishes add column if not exists game_clue   text;

alter table public.dishes drop constraint if exists dishes_text_lengths;
alter table public.dishes add constraint dishes_text_lengths check (
    char_length(name) between 1 and 60
    and (description is null or char_length(description) <= 300)
    and (tag is null or char_length(tag) <= 24)
    and (game_clue is null or char_length(game_clue) <= 200)
    and price <= 1000000
);

-- Menu de départ : n'écrase JAMAIS les modifications faites dans l'administration
insert into public.dishes (slug, name, price, sort_order, description, image_url, tag, game_clue) values
    ('riz-blanc', 'Riz blanc', 2500, 1, 'Riz blanc bien parfumé, servi avec sa sauce tomate relevée.', 'images/riz_blanc.jpg', null, 'Riz blanc bien parfumé, servi avec sa sauce tomate relevée'),
    ('koliko',    'Koliko',    2000, 2, 'Frites d’igname dorées et croustillantes, avec du piment frais.', 'images/koliko.jpg', '🌶 Épicé', 'Frites d’igname dorées et croustillantes, avec du piment frais'),
    ('brochette', 'Brochette', 2000, 3, 'Brochettes de viande marinées et grillées, sauce pimentée à part.', 'images/brochette.jpg', '🔥 Grillé', 'Viande marinée et grillée, avec une sauce pimentée à part'),
    ('spaghetti', 'Spaghetti', 2000, 4, 'Spaghetti sautés aux légumes croquants et morceaux de viande.', 'images/maca.jpg', null, 'Pâtes sautées aux légumes croquants et morceaux de viande'),
    ('botocoin',  'Botocoin',  2500, 5, 'Beignets dorés, croustillants dehors et moelleux dedans.', 'images/botocoin.jpg', 'Croustillant', 'Beignets dorés, croustillants dehors et moelleux dedans'),
    ('veyi',      'Veyi',      2000, 6, 'Un plat traditionnel savoureux, préparé frais chaque jour.', 'images/veyi.jpg', 'Frais du jour', null),
    ('attieke',   'Attiéké',   2500, 7, 'Attiéké fin et léger, accompagné de poisson braisé et d’oignons.', 'images/attieke.jpg', '🐟 Poisson braisé', 'Semoule de manioc fine et légère, avec poisson braisé et oignons'),
    ('akoume',    'Akoumè',    3000, 8, 'Pâte de maïs (akoumè) servie avec la sauce adémè bien onctueuse.', 'images/akoume.jpg', null, 'Pâte de maïs servie avec la sauce adémè bien onctueuse'),
    ('pokoume',   'Pokoumè',   3000, 9, 'Pâte moelleuse servie avec sa sauce et sa viande, façon togolaise.', 'images/pokoume.jpg', null, 'Pâte moelleuse servie avec sa sauce et sa viande, façon togolaise')
on conflict (slug) do nothing;

-- ---------- Administrateurs ----------
create table if not exists public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Commandes ----------
create table if not exists public.orders (
    id             uuid primary key default gen_random_uuid(),
    created_at     timestamptz not null default now(),
    user_id        uuid references auth.users (id) on delete set null default auth.uid(),
    customer_name  text not null check (char_length(btrim(customer_name))  between 2 and 80),
    customer_phone text not null check (char_length(btrim(customer_phone)) between 6 and 20),
    fulfillment    text not null check (fulfillment in ('emporter', 'livraison')),
    payment_method text not null check (payment_method in ('livraison', 'sur_place')),
    address        text check (char_length(address) <= 300),
    latitude       double precision check (latitude  between -90  and 90),
    longitude      double precision check (longitude between -180 and 180),
    note           text check (char_length(note) <= 500),
    total          integer not null default 0 check (total >= 0),
    status         text not null default 'Nouvelle'
                   check (status in ('Nouvelle', 'En préparation', 'Prête', 'Livrée', 'Annulée'))
);

create table if not exists public.order_items (
    id         bigint generated always as identity primary key,
    order_id   uuid    not null references public.orders (id) on delete cascade,
    dish_slug  text    not null references public.dishes (slug),
    name       text    not null,
    unit_price integer not null check (unit_price >= 0),
    quantity   integer not null check (quantity between 1 and 20)
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ---------- Réservations ----------
create table if not exists public.reservations (
    id               uuid primary key default gen_random_uuid(),
    created_at       timestamptz not null default now(),
    user_id          uuid references auth.users (id) on delete set null default auth.uid(),
    name             text not null check (char_length(btrim(name))  between 2 and 80),
    phone            text not null check (char_length(btrim(phone)) between 6 and 20),
    reservation_date date not null,
    reservation_time time not null,
    guests           integer not null check (guests between 1 and 50),
    note             text check (char_length(note) <= 500),
    status           text not null default 'En attente'
                     check (status in ('En attente', 'Confirmée', 'Annulée'))
);

-- ---------- Messages du formulaire de contact ----------
create table if not exists public.contact_messages (
    id         uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    name       text not null check (char_length(btrim(name)) between 1 and 80),
    email      text not null check (char_length(email) between 5 and 120 and email like '%_@_%._%'),
    message    text not null check (char_length(btrim(message)) between 2 and 2000),
    status     text not null default 'Nouveau' check (status in ('Nouveau', 'Traité'))
);

-- ---------- Mise à niveau d'une base existante (compte client) ----------
alter table public.orders       add column if not exists user_id uuid references auth.users (id) on delete set null default auth.uid();
alter table public.reservations add column if not exists user_id uuid references auth.users (id) on delete set null default auth.uid();
create index if not exists orders_user_id_idx       on public.orders (user_id);
create index if not exists reservations_user_id_idx on public.reservations (user_id);

-- ---------- Création d'une commande (le total est calculé ICI, pas par le navigateur) ----------
alter table public.orders add column if not exists reward_percent integer;

-- Récompenses du jeu (créées uniquement par claim_game_reward, lues par leur propriétaire)
create table if not exists public.game_rewards (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    percent       integer not null check (percent in (5, 10)),
    score         integer not null,
    created_at    timestamptz not null default now(),
    expires_at    timestamptz not null default now() + interval '24 hours',
    used_at       timestamptz,
    used_order_id uuid references public.orders(id) on delete set null
);
create index if not exists game_rewards_user_idx on public.game_rewards (user_id, created_at desc);

drop function if exists public.create_order(text, text, jsonb, text, text, text, double precision, double precision, text);

create or replace function public.create_order(
    p_name        text,
    p_phone       text,
    p_items       jsonb,
    p_fulfillment text,
    p_payment     text,
    p_address     text default null,
    p_lat         double precision default null,
    p_lng         double precision default null,
    p_note        text default null,
    p_reward      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id      uuid;
    v_total   integer := 0;
    v_item    jsonb;
    v_dish    public.dishes;
    v_qty     integer;
    v_reward  public.game_rewards;
    v_percent integer;
begin
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Panier vide';
    end if;
    if jsonb_array_length(p_items) > 20 then
        raise exception 'Panier trop grand';
    end if;
    if p_fulfillment = 'livraison'
       and coalesce(btrim(p_address), '') = ''
       and (p_lat is null or p_lng is null) then
        raise exception 'Adresse ou position requise';
    end if;

    insert into public.orders
        (user_id, customer_name, customer_phone, fulfillment, payment_method, address, latitude, longitude, note)
    values
        (auth.uid(), btrim(p_name), btrim(p_phone), p_fulfillment, p_payment,
         nullif(btrim(p_address), ''), p_lat, p_lng, nullif(btrim(p_note), ''))
    returning id into v_id;

    for v_item in select * from jsonb_array_elements(p_items) loop
        v_qty := (v_item ->> 'quantity')::integer;
        select * into v_dish from public.dishes where slug = v_item ->> 'slug' and available;
        if not found then
            raise exception 'Aucun plat valide';
        end if;
        insert into public.order_items (order_id, dish_slug, name, unit_price, quantity)
        values (v_id, v_dish.slug, v_dish.name, v_dish.price, v_qty);
        v_total := v_total + v_dish.price * v_qty;
    end loop;

    -- récompense du jeu : doit appartenir au client, être inutilisée et non expirée
    if p_reward is not null then
        select * into v_reward from public.game_rewards
         where id = p_reward and user_id = auth.uid() and used_at is null and expires_at > now()
         for update;
        if not found then
            raise exception 'Récompense invalide ou expirée';
        end if;
        v_percent := v_reward.percent;
        v_total := round(v_total * (100 - v_percent) / 100.0);
        update public.game_rewards set used_at = now(), used_order_id = v_id where id = p_reward;
    end if;

    update public.orders set total = v_total, reward_percent = v_percent where id = v_id;
    return v_id;
end;
$$;

-- Le client connecté obtient sa récompense du jour (100 pts = -5 %, 200 pts = -10 %)
create or replace function public.claim_game_reward(p_score integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_percent integer;
    v_row     public.game_rewards;
begin
    if auth.uid() is null then raise exception 'Connexion requise'; end if;
    if p_score is null or p_score < 0 or p_score > 500 then raise exception 'Score invalide'; end if;
    v_percent := case when p_score >= 200 then 10 when p_score >= 100 then 5 else null end;
    if v_percent is null then raise exception 'Score insuffisant'; end if;

    select * into v_row from public.game_rewards
     where user_id = auth.uid() and created_at > now() - interval '24 hours'
     order by created_at desc limit 1;
    if found then
        return jsonb_build_object('id', v_row.id, 'percent', v_row.percent, 'expires_at', v_row.expires_at,
                                  'used', v_row.used_at is not null, 'already', true);
    end if;

    insert into public.game_rewards (user_id, percent, score)
    values (auth.uid(), v_percent, p_score) returning * into v_row;
    return jsonb_build_object('id', v_row.id, 'percent', v_row.percent, 'expires_at', v_row.expires_at,
                              'used', false, 'already', false);
end;
$$;

-- ============================================================
-- Sécurité (RLS) : le public peut seulement ENVOYER ; l'admin lit et gère.
-- ============================================================
alter table public.dishes           enable row level security;
alter table public.admins           enable row level security;   -- aucune policy : illisible depuis le site
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.reservations     enable row level security;
alter table public.contact_messages enable row level security;

-- Plats : lisibles par tous
drop policy if exists dishes_read on public.dishes;
create policy dishes_read on public.dishes for select to anon, authenticated using (true);

-- Réservations et messages : le public peut créer (statut initial imposé), jamais lire
drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations
    for insert to anon, authenticated
    with check (status = 'En attente' and (user_id is null or user_id = auth.uid()));

drop policy if exists contact_insert on public.contact_messages;
create policy contact_insert on public.contact_messages
    for insert to anon, authenticated with check (status = 'Nouveau');

-- Administrateur : lecture + mise à jour des statuts
drop policy if exists orders_admin_select on public.orders;
create policy orders_admin_select on public.orders for select to authenticated using (public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_admin_select on public.order_items;
create policy order_items_admin_select on public.order_items for select to authenticated using (public.is_admin());

drop policy if exists reservations_admin_select on public.reservations;
create policy reservations_admin_select on public.reservations for select to authenticated using (public.is_admin());
drop policy if exists reservations_admin_update on public.reservations;
create policy reservations_admin_update on public.reservations for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

drop policy if exists contact_admin_select on public.contact_messages;
create policy contact_admin_select on public.contact_messages for select to authenticated using (public.is_admin());
drop policy if exists contact_admin_update on public.contact_messages;
create policy contact_admin_update on public.contact_messages for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- ---------- Droits d'accès (au plus juste) ----------
revoke all on public.dishes, public.admins, public.orders, public.order_items,
              public.reservations, public.contact_messages from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.dishes to anon, authenticated;
grant insert on public.reservations, public.contact_messages to anon, authenticated;
grant select, update on public.orders, public.reservations, public.contact_messages to authenticated;
grant select on public.order_items to authenticated;

revoke all on function public.create_order(text, text, jsonb, text, text, text, double precision, double precision, text, uuid) from public;
grant execute on function public.create_order(text, text, jsonb, text, text, text, double precision, double precision, text, uuid) to anon, authenticated;

alter table public.game_rewards enable row level security;
drop policy if exists game_rewards_own_select on public.game_rewards;
create policy game_rewards_own_select on public.game_rewards for select to authenticated using (user_id = auth.uid());
revoke all on public.game_rewards from anon, authenticated;
grant select on public.game_rewards to authenticated;
revoke all on function public.claim_game_reward(integer) from public, anon;
grant execute on function public.claim_game_reward(integer) to authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- Comptes clients (facultatifs) : chacun ne voit que SES commandes et réservations.
-- -- ============================================================

drop policy if exists orders_own_select on public.orders;
create policy orders_own_select on public.orders for select to authenticated using (user_id = auth.uid());

drop policy if exists order_items_own_select on public.order_items;
create policy order_items_own_select on public.order_items for select to authenticated
    using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists reservations_own_select on public.reservations;
create policy reservations_own_select on public.reservations for select to authenticated using (user_id = auth.uid());

-- la politique d'insertion doit aussi interdire d'écrire au nom d'un autre compte
drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations
    for insert to anon, authenticated
    with check (status = 'En attente' and (user_id is null or user_id = auth.uid()));

-- ============================================================
-- Messagerie directe : un client connecté discute avec le restaurant
-- (réponses depuis admin.html). Les visiteurs sans compte gardent WhatsApp.
-- ============================================================
create table if not exists public.chat_messages (
    id         bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    sender     text not null check (sender in ('client', 'admin')),
    user_name  text check (char_length(user_name) <= 80),
    body       text not null check (char_length(btrim(body)) between 1 and 1000)
);

create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at);
create index if not exists chat_messages_created_idx on public.chat_messages (created_at desc);

-- Anti-spam : 20 messages par minute et par client au maximum
create or replace function public.chat_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.sender = 'client' and (
        select count(*) from public.chat_messages
        where user_id = new.user_id and sender = 'client' and created_at > now() - interval '1 minute'
    ) >= 20 then
        raise exception 'Trop de messages, patientez un instant';
    end if;
    return new;
end;
$$;

drop trigger if exists chat_rate_limit_trg on public.chat_messages;
create trigger chat_rate_limit_trg before insert on public.chat_messages
    for each row execute function public.chat_rate_limit();

alter table public.chat_messages enable row level security;

drop policy if exists chat_own_select on public.chat_messages;
create policy chat_own_select on public.chat_messages for select to authenticated using (user_id = auth.uid());

drop policy if exists chat_own_insert on public.chat_messages;
create policy chat_own_insert on public.chat_messages for insert to authenticated
    with check (user_id = auth.uid() and sender = 'client');

drop policy if exists chat_admin_select on public.chat_messages;
create policy chat_admin_select on public.chat_messages for select to authenticated using (public.is_admin());

drop policy if exists chat_admin_insert on public.chat_messages;
create policy chat_admin_insert on public.chat_messages for insert to authenticated
    with check (public.is_admin() and sender = 'admin');

revoke all on public.chat_messages from anon, authenticated;
grant select, insert on public.chat_messages to authenticated;
revoke all on function public.chat_rate_limit() from public, anon, authenticated;

-- Temps réel : les nouveaux messages arrivent sans recharger la page
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables
                       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
        alter publication supabase_realtime add table public.chat_messages;
    end if;
end $$;

-- ============================================================
-- Durcissement et alertes
-- ============================================================
-- is_admin() : plus appelable par les visiteurs non connectés
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Alertes en direct pour le restaurant : commandes, réservations, messages de contact
do $$
declare t text;
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        foreach t in array array['orders', 'reservations', 'contact_messages'] loop
            if not exists (select 1 from pg_publication_tables
                           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
                execute format('alter publication supabase_realtime add table public.%I', t);
            end if;
        end loop;
    end if;
end $$;

-- ============================================================
-- Messages non lus : date du dernier message lu par chaque client
-- ============================================================
create table if not exists public.chat_reads (
    user_id      uuid primary key references auth.users (id) on delete cascade,
    last_read_at timestamptz not null default now()
);

alter table public.chat_reads enable row level security;

drop policy if exists chat_reads_own_select on public.chat_reads;
create policy chat_reads_own_select on public.chat_reads for select to authenticated using (user_id = auth.uid());
drop policy if exists chat_reads_own_insert on public.chat_reads;
create policy chat_reads_own_insert on public.chat_reads for insert to authenticated with check (user_id = auth.uid());
drop policy if exists chat_reads_own_update on public.chat_reads;
create policy chat_reads_own_update on public.chat_reads for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.chat_reads from anon, authenticated;
grant select, insert, update on public.chat_reads to authenticated;

-- Nombre de réponses du restaurant pas encore lues par le client connecté
create or replace function public.chat_unread_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
    select count(*)::int
    from public.chat_messages m
    where m.user_id = auth.uid()
      and m.sender = 'admin'
      and m.created_at > coalesce((select r.last_read_at from public.chat_reads r where r.user_id = auth.uid()), 'epoch'::timestamptz);
$$;

-- Marque toute la conversation comme lue
create or replace function public.chat_mark_read()
returns void
language sql
security invoker
set search_path = public
as $$
    insert into public.chat_reads (user_id, last_read_at) values (auth.uid(), clock_timestamp())
    on conflict (user_id) do update set last_read_at = excluded.last_read_at;
$$;

revoke all on function public.chat_unread_count() from public, anon;
revoke all on function public.chat_mark_read() from public, anon;
grant execute on function public.chat_unread_count() to authenticated;
grant execute on function public.chat_mark_read() to authenticated;

-- Horodatage à l'heure réelle d'insertion (et non au début de la transaction)
alter table public.chat_messages alter column created_at set default clock_timestamp();

-- ============================================================
-- Alertes e-mail (page admin fermée) : déclencheurs -> fonction Edge "notify-admin"
-- La fonction Edge se déploie depuis supabase/functions/notify-admin/index.ts
-- ============================================================
create extension if not exists pg_net with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
revoke all on private.settings from public, anon, authenticated;
insert into private.settings (key, value)
values ('notify_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

create or replace function public.check_notify_secret(s text)
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from private.settings where key = 'notify_secret' and value = s);
$$;
revoke all on function public.check_notify_secret(text) from public, anon, authenticated;
grant execute on function public.check_notify_secret(text) to service_role;

create or replace function private.notify_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare secret text; rec jsonb := to_jsonb(new);
begin
  if tg_table_name = 'chat_messages' and coalesce(rec ->> 'sender', '') <> 'client' then return new; end if;
  begin
    select value into secret from private.settings where key = 'notify_secret';
    perform net.http_post(
      url := 'https://jwqjeluysvidezzrsmsb.supabase.co/functions/v1/notify-admin',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
      body := jsonb_build_object('table', tg_table_name, 'record', rec),
      timeout_milliseconds := 5000);
  exception when others then null;
  end;
  return new;
end $$;
revoke all on function private.notify_admin() from public, anon, authenticated;

drop trigger if exists notify_admin_orders on public.orders;
create trigger notify_admin_orders after insert on public.orders for each row execute function private.notify_admin();
drop trigger if exists notify_admin_reservations on public.reservations;
create trigger notify_admin_reservations after insert on public.reservations for each row execute function private.notify_admin();
drop trigger if exists notify_admin_contact on public.contact_messages;
create trigger notify_admin_contact after insert on public.contact_messages for each row execute function private.notify_admin();
drop trigger if exists notify_admin_chat on public.chat_messages;
create trigger notify_admin_chat after insert on public.chat_messages for each row execute function private.notify_admin();

-- ============================================================
-- Menu modifiable par l'administrateur : droits + photos (Storage)
-- ============================================================
drop policy if exists dishes_admin_insert on public.dishes;
create policy dishes_admin_insert on public.dishes for insert to authenticated with check (public.is_admin());
drop policy if exists dishes_admin_update on public.dishes;
create policy dishes_admin_update on public.dishes for update to authenticated
    using (public.is_admin()) with check (public.is_admin());
drop policy if exists dishes_admin_delete on public.dishes;
create policy dishes_admin_delete on public.dishes for delete to authenticated using (public.is_admin());
grant insert, update, delete on public.dishes to authenticated;

-- Photos des plats : lecture publique, envoi / remplacement / suppression réservés à l'administrateur
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-images', 'dish-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
    set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists dish_images_admin_insert on storage.objects;
create policy dish_images_admin_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'dish-images' and public.is_admin());
drop policy if exists dish_images_admin_update on storage.objects;
create policy dish_images_admin_update on storage.objects for update to authenticated
    using (bucket_id = 'dish-images' and public.is_admin()) with check (bucket_id = 'dish-images' and public.is_admin());
drop policy if exists dish_images_admin_delete on storage.objects;
create policy dish_images_admin_delete on storage.objects for delete to authenticated
    using (bucket_id = 'dish-images' and public.is_admin());
