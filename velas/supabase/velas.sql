-- =====================================================================
-- TIENDA DE VELAS — Estructura de base de datos (Supabase)
-- Ya está aplicada en el proyecto de Los Ponpones (tablas con prefijo velas_).
-- Se puede volver a correr sin romper nada (SQL Editor > New query > Run).
-- =====================================================================

-- ---------- 1. Administradores ----------
create table if not exists velas_admins (email text primary key);
insert into velas_admins(email) values ('tu-correo@ejemplo.com') on conflict do nothing;

create or replace function velas_es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from velas_admins where email = lower(auth.jwt() ->> 'email'));
$$;

-- ---------- 2. Ajustes de la tienda (nombre, logo, banco, WhatsApp) ----------
create table if not exists velas_ajustes (
  id         int primary key default 1 check (id = 1),
  nombre     text default 'Tu Tienda',
  lema       text default 'Velas aromáticas hechas a mano',
  logo_url   text default '',
  hero_titulo text default 'Llena tu casa de aromas que abrazan',
  banco      text default 'BBVA',
  titular    text default 'Nombre del titular',
  clabe      text default '',
  cuenta     text default '',
  tarjeta    text default '',
  whatsapp   text default '',              -- con lada de país, ej. 5215512345678
  envio      numeric(10,2) default 0,
  envio_gratis_desde numeric(10,2) default 0, -- 0 = nunca gratis
  nota_pago  text default 'Haz tu transferencia y sube la foto de tu comprobante. Confirmamos tu pedido en menos de 24 h.',
  instagram  text default ''
);
insert into velas_ajustes(id) values (1) on conflict do nothing;

-- ---------- 3. Productos ----------
create table if not exists velas_productos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  categoria    text not null default 'Velas en vaso',
  descripcion  text default '',
  precio       numeric(10,2) not null check (precio >= 0),
  precio_antes numeric(10,2),
  presentacion text default '',            -- ej. 200 g / 7 oz
  aromas       text[] default '{}',
  imagenes     text[] default '{}',
  stock        int default 0,              -- 0 = sin control de existencias
  destacado    boolean default false,
  activo       boolean default true,
  agotado      boolean default false,
  orden        int default 0,
  creado       timestamptz default now()
);

-- ---------- 4. Clientes (cuenta de comprador) ----------
create table if not exists velas_clientes (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text default '',
  telefono  text default '',
  email     text default '',
  direccion text default '',
  creado    timestamptz default now()
);

-- ---------- 5. Pedidos ----------
create table if not exists velas_pedidos (
  id          uuid primary key default gen_random_uuid(),
  folio       text unique not null,
  user_id     uuid references auth.users(id) on delete set null,
  cliente     text not null,
  telefono    text not null,
  email       text default '',
  direccion   text default '',
  notas       text default '',
  items       jsonb not null,
  subtotal    numeric(10,2) not null,
  envio       numeric(10,2) not null default 0,
  total       numeric(10,2) not null,
  comprobante text,
  estado      text not null default 'pendiente', -- pendiente, por_revisar, pagado, enviado, entregado, cancelado
  visto       boolean default false,              -- ya lo vio el administrador
  creado      timestamptz default now()
);
create index if not exists velas_pedidos_user on velas_pedidos(user_id);

-- ---------- 6. Reseñas ----------
create table if not exists velas_resenas (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references velas_productos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null default '',
  estrellas   int not null check (estrellas between 1 and 5),
  comentario  text default '',
  visible     boolean default true,
  visto       boolean default false,
  creado      timestamptz default now(),
  unique (producto_id, user_id)
);

-- ---------- 7. Seguridad (RLS) ----------
alter table velas_admins    enable row level security;
alter table velas_ajustes   enable row level security;
alter table velas_productos enable row level security;
alter table velas_clientes  enable row level security;
alter table velas_pedidos   enable row level security;
alter table velas_resenas   enable row level security;

drop policy if exists "admin ve admins" on velas_admins;
create policy "admin ve admins" on velas_admins for select using (velas_es_admin());

drop policy if exists "ver ajustes" on velas_ajustes;
create policy "ver ajustes" on velas_ajustes for select using (true);
drop policy if exists "admin ajustes" on velas_ajustes;
create policy "admin ajustes" on velas_ajustes for update using (velas_es_admin()) with check (velas_es_admin());

drop policy if exists "ver productos" on velas_productos;
create policy "ver productos" on velas_productos for select using (activo or velas_es_admin());
drop policy if exists "admin productos" on velas_productos;
create policy "admin productos" on velas_productos for all using (velas_es_admin()) with check (velas_es_admin());

drop policy if exists "cliente su perfil" on velas_clientes;
create policy "cliente su perfil" on velas_clientes for all using (id = auth.uid() or velas_es_admin()) with check (id = auth.uid() or velas_es_admin());

drop policy if exists "cliente ve sus pedidos" on velas_pedidos;
create policy "cliente ve sus pedidos" on velas_pedidos for select using (user_id = auth.uid() or velas_es_admin());
drop policy if exists "admin pedidos" on velas_pedidos;
create policy "admin pedidos" on velas_pedidos for all using (velas_es_admin()) with check (velas_es_admin());

drop policy if exists "ver resenas" on velas_resenas;
create policy "ver resenas" on velas_resenas for select using (visible or user_id = auth.uid() or velas_es_admin());
drop policy if exists "cliente escribe resena" on velas_resenas;
create policy "cliente escribe resena" on velas_resenas for insert with check (user_id = auth.uid());
drop policy if exists "cliente edita resena" on velas_resenas;
create policy "cliente edita resena" on velas_resenas for update using (user_id = auth.uid() or velas_es_admin()) with check (user_id = auth.uid() or velas_es_admin());
drop policy if exists "borrar resena" on velas_resenas;
create policy "borrar resena" on velas_resenas for delete using (user_id = auth.uid() or velas_es_admin());

-- Al crear una cuenta se crea su ficha de cliente (solo si se registró desde la tienda de velas)
create or replace function velas_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'app','') = 'velas' then
    insert into velas_clientes(id, nombre, telefono, email)
    values (new.id, coalesce(new.raw_user_meta_data->>'nombre',''), coalesce(new.raw_user_meta_data->>'telefono',''), lower(new.email))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists velas_nuevo_usuario on auth.users;
create trigger velas_nuevo_usuario after insert on auth.users for each row execute function velas_nuevo_usuario();

-- ---------- 8. Crear pedido (el precio se calcula AQUÍ, no en el celular) ----------
create or replace function velas_crear_pedido(
  p_cliente text, p_telefono text, p_email text, p_direccion text, p_notas text, p_items jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; prod velas_productos; cant int;
  limpios jsonb := '[]'; sub numeric := 0; env numeric; gratis numeric; fol text;
begin
  if coalesce(trim(p_cliente),'') = '' or length(regexp_replace(coalesce(p_telefono,''),'\D','','g')) < 10 then
    raise exception 'Escribe tu nombre y un teléfono de 10 dígitos';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'El carrito está vacío'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from velas_productos where id = (it->>'id')::uuid and activo and not coalesce(agotado,false);
    if not found then raise exception 'Un producto ya no está disponible'; end if;
    cant := greatest(1, least(50, coalesce((it->>'cant')::int, 1)));
    sub := sub + prod.precio * cant;
    limpios := limpios || jsonb_build_object('id', prod.id, 'nombre', prod.nombre, 'precio', prod.precio, 'cant', cant,
      'aroma', left(coalesce(it->>'aroma',''), 40), 'imagen', prod.imagenes[1]);
  end loop;
  select coalesce(envio,0), coalesce(envio_gratis_desde,0) into env, gratis from velas_ajustes where id = 1;
  if gratis > 0 and sub >= gratis then env := 0; end if;
  fol := 'V-' || to_char(now() at time zone 'America/Mexico_City','YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
  insert into velas_pedidos(folio, user_id, cliente, telefono, email, direccion, notas, items, subtotal, envio, total)
  values (fol, auth.uid(), left(trim(p_cliente),80), left(p_telefono,20), left(lower(coalesce(p_email,'')),120),
          left(coalesce(p_direccion,''),300), left(coalesce(p_notas,''),300), limpios, sub, env, sub + env);
  if auth.uid() is not null then
    update velas_clientes set
      nombre = case when nombre = '' then left(trim(p_cliente),80) else nombre end,
      telefono = left(p_telefono,20),
      direccion = case when coalesce(p_direccion,'') <> '' then left(p_direccion,300) else direccion end
    where id = auth.uid();
  end if;
  return fol;
end $$;
grant execute on function velas_crear_pedido(text,text,text,text,text,jsonb) to anon, authenticated;

-- Consultar un pedido con folio + teléfono (sin cuenta)
create or replace function velas_ver_pedido(p_folio text, p_telefono text)
returns table(folio text, estado text, subtotal numeric, envio numeric, total numeric, items jsonb, comprobante boolean, creado timestamptz)
language sql security definer set search_path = public as $$
  select folio, estado, subtotal, envio, total, items, comprobante is not null, creado from velas_pedidos
  where folio = upper(trim(p_folio))
    and right(regexp_replace(telefono,'\D','','g'),10) = right(regexp_replace(p_telefono,'\D','','g'),10);
$$;
grant execute on function velas_ver_pedido(text,text) to anon, authenticated;

-- Adjuntar comprobante (el archivo ya se subió al bucket)
create or replace function velas_adjuntar_comprobante(p_folio text, p_telefono text, p_ruta text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_ruta is null or p_ruta not like 'pedidos/%' then raise exception 'Archivo no válido'; end if;
  update velas_pedidos set comprobante = p_ruta, estado = 'por_revisar', visto = false
  where folio = upper(trim(p_folio))
    and right(regexp_replace(telefono,'\D','','g'),10) = right(regexp_replace(p_telefono,'\D','','g'),10)
    and estado in ('pendiente','por_revisar');
  return found;
end $$;
grant execute on function velas_adjuntar_comprobante(text,text,text) to anon, authenticated;

-- Reseña solo de quien compró (pedido pagado o posterior)
create or replace function velas_puede_resenar(p_producto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from velas_pedidos p, jsonb_array_elements(p.items) i
    where p.user_id = auth.uid() and p.estado in ('pagado','enviado','entregado') and (i->>'id')::uuid = p_producto);
$$;
grant execute on function velas_puede_resenar(uuid) to authenticated;
drop policy if exists "cliente escribe resena" on velas_resenas;
create policy "cliente escribe resena" on velas_resenas for insert with check (user_id = auth.uid() and velas_puede_resenar(producto_id));

-- Resumen de reseñas por producto (público)
create or replace view velas_calificaciones with (security_invoker = true) as
  select producto_id, round(avg(estrellas)::numeric,1) as promedio, count(*) as total
  from velas_resenas where visible group by producto_id;
grant select on velas_calificaciones to anon, authenticated;

-- ---------- 9. Avisos en tiempo real para el administrador ----------
do $$ begin
  begin alter publication supabase_realtime add table velas_pedidos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table velas_resenas; exception when duplicate_object then null; end;
end $$;

-- ---------- 10. Fotos (productos y logo públicos; comprobantes privados) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('velas-fotos', 'velas-fotos', true, 10485760, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('velas-comprobantes', 'velas-comprobantes', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "velas fotos publicas" on storage.objects;
create policy "velas fotos publicas" on storage.objects for select using (bucket_id = 'velas-fotos');
drop policy if exists "velas admin sube fotos" on storage.objects;
create policy "velas admin sube fotos" on storage.objects for insert with check (bucket_id = 'velas-fotos' and velas_es_admin());
drop policy if exists "velas admin borra fotos" on storage.objects;
create policy "velas admin borra fotos" on storage.objects for delete using (bucket_id = 'velas-fotos' and velas_es_admin());
drop policy if exists "velas cliente sube comprobante" on storage.objects;
create policy "velas cliente sube comprobante" on storage.objects for insert
  with check (bucket_id = 'velas-comprobantes' and (storage.foldername(name))[1] = 'pedidos');
drop policy if exists "velas admin ve comprobantes" on storage.objects;
create policy "velas admin ve comprobantes" on storage.objects for select using (bucket_id = 'velas-comprobantes' and velas_es_admin());

-- ---------- 11. Productos de ejemplo (solo si está vacío) ----------
insert into velas_productos(nombre, categoria, descripcion, precio, precio_antes, presentacion, aromas, imagenes, destacado, orden)
select * from (values
  ('Vela Vainilla Cálida','Velas en vaso','Cera de soya en vaso ámbar con mecha de algodón. Notas de vainilla de Madagascar y un toque de haba tonka.',189::numeric,229::numeric,'200 g · 40 h','{Vainilla,Vainilla y canela}'::text[],'{img/p-vainilla.svg}'::text[],true,1),
  ('Bergamota & Cedro','Velas en vaso','Fresca y cítrica para trabajar o leer. Vaso de vidrio reutilizable.',219,null,'220 g · 45 h','{Bergamota}','{img/p-bergamota.svg}',true,2),
  ('Vela Cuerpo Escultura','Velas de figura','Vela decorativa con forma de silueta, hecha a mano en cera de soya blanca.',249,289,'180 g','{Sin aroma,Vainilla}','{img/p-cuerpo.svg}',true,3),
  ('Burbuja Cubo','Velas de figura','La vela de burbujas que se ve en todos lados. Ideal para regalar.',149,null,'120 g','{Sin aroma,Lavanda}','{img/p-burbuja.svg}',false,4),
  ('Lavanda Relax','Aromaterapia','Mezcla de aceites esenciales de lavanda y eucalipto para dormir mejor.',199,null,'200 g · 40 h','{Lavanda,Eucalipto}','{img/p-lavanda.svg}',false,5),
  ('Set Mini Velas x3','Regalos','Tres mini velas de 60 g en caja de regalo: vainilla, frutos rojos y coco.',259,299,'3 × 60 g','{}','{img/p-set.svg}',true,6)
) v where not exists (select 1 from velas_productos);

-- ---------- 12. Administradores con usuario (sin correo) ----------
alter table velas_admins add column if not exists usuario text unique;
alter table velas_admins add column if not exists rol text not null default 'admin';   -- super | admin
alter table velas_admins add column if not exists debe_cambiar boolean not null default false;
alter table velas_admins add column if not exists user_id uuid;
alter table velas_admins add column if not exists creado timestamptz default now();
create or replace function velas_es_super() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from velas_admins where email = lower(auth.jwt() ->> 'email') and rol = 'super'); $$;
create or replace function velas_mi_admin() returns json language sql stable security definer set search_path = public as $$
  select json_build_object('usuario', usuario, 'rol', rol, 'debe_cambiar', debe_cambiar) from velas_admins where email = lower(auth.jwt() ->> 'email'); $$;
create or replace function velas_password_cambiada() returns void language sql security definer set search_path = public as $$
  update velas_admins set debe_cambiar = false where email = lower(auth.jwt() ->> 'email'); $$;
grant execute on function velas_es_super(), velas_mi_admin(), velas_password_cambiada() to authenticated;
-- Crear, restablecer y quitar usuarios lo hace la función supabase/functions/velas-usuarios.
