-- =====================================================================
-- TIENDA DE SERIGRAFÍA — Estructura de base de datos (Supabase)
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Se puede correr varias veces sin romper nada.
-- =====================================================================

-- ---------- 1. Administradores (solo estos correos pueden publicar) ----------
create table if not exists tienda_admins (
  email text primary key
);
-- CAMBIA este correo por el de tu usuario en Supabase > Authentication > Users
insert into tienda_admins(email) values ('dueno@ponpones.com') on conflict do nothing;

create or replace function tienda_es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from tienda_admins where email = (auth.jwt() ->> 'email'));
$$;

-- ---------- 2. Productos ----------
create table if not exists tienda_productos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  categoria    text not null default 'Playeras',   -- Playeras, Sudaderas, Suéteres, Pantalones, Bolsas
  descripcion  text default '',
  precio       numeric(10,2) not null check (precio >= 0),
  precio_antes numeric(10,2),                      -- precio tachado (opcional)
  tallas       text[] default '{}',                -- ej. {S,M,L,XL}
  colores      jsonb  default '[]',                -- ej. [{"nombre":"Negro","hex":"#111"}]
  imagenes     text[] default '{}',                -- URLs públicas
  detalle      text default '',                    -- ej. "Algodón 100% · Serigrafía 1 tinta"
  destacado    boolean default false,              -- aparece en "Más vendidos"
  activo       boolean default true,               -- visible en la tienda
  orden        int default 0,
  creado       timestamptz default now()
);

-- ---------- 3. Ajustes (datos bancarios, WhatsApp, textos) ----------
create table if not exists tienda_ajustes (
  id         int primary key default 1 check (id = 1),
  nombre     text default 'SERIGRAFÍA',
  lema       text default 'Estampados',
  banco      text default 'BBVA',
  titular    text default 'Tu nombre completo',
  clabe      text default '000000000000000000',
  cuenta     text default '',
  tarjeta    text default '',
  whatsapp   text default '',                       -- 10 dígitos con lada, ej. 5215512345678
  envio      numeric(10,2) default 0,               -- costo de envío fijo
  nota_pago  text default 'Haz tu transferencia y sube la foto de tu comprobante. Confirmamos tu pedido en menos de 24 h.'
);
insert into tienda_ajustes(id) values (1) on conflict do nothing;

-- ---------- 4. Pedidos ----------
create table if not exists tienda_pedidos (
  id            uuid primary key default gen_random_uuid(),
  folio         text unique not null,
  cliente       text not null,
  telefono      text not null,
  direccion     text default '',
  notas         text default '',
  items         jsonb not null,                     -- [{id,nombre,talla,color,cant,precio}]
  subtotal      numeric(10,2) not null,
  envio         numeric(10,2) not null default 0,
  total         numeric(10,2) not null,
  comprobante   text,                               -- ruta en Storage (bucket comprobantes)
  drive_url     text,                               -- enlace al archivo en tu Google Drive
  estado        text not null default 'pendiente',  -- pendiente, pagado, enviado, entregado, cancelado
  creado        timestamptz default now()
);

-- ---------- 5. Seguridad (RLS) ----------
alter table tienda_admins    enable row level security;
alter table tienda_productos enable row level security;
alter table tienda_ajustes   enable row level security;
alter table tienda_pedidos   enable row level security;

drop policy if exists "ver productos activos" on tienda_productos;
create policy "ver productos activos" on tienda_productos for select using (activo or tienda_es_admin());
drop policy if exists "admin productos" on tienda_productos;
create policy "admin productos" on tienda_productos for all using (tienda_es_admin()) with check (tienda_es_admin());

drop policy if exists "ver ajustes" on tienda_ajustes;
create policy "ver ajustes" on tienda_ajustes for select using (true);
drop policy if exists "admin ajustes" on tienda_ajustes;
create policy "admin ajustes" on tienda_ajustes for update using (tienda_es_admin()) with check (tienda_es_admin());

-- Los clientes NO leen la tabla de pedidos directamente (solo con folio + teléfono, ver abajo)
drop policy if exists "admin pedidos" on tienda_pedidos;
create policy "admin pedidos" on tienda_pedidos for all using (tienda_es_admin()) with check (tienda_es_admin());

drop policy if exists "admin ve admins" on tienda_admins;
create policy "admin ve admins" on tienda_admins for select using (tienda_es_admin());

-- ---------- 6. Crear pedido (el precio se calcula AQUÍ, no en el celular del cliente) ----------
create or replace function tienda_crear_pedido(
  p_cliente text, p_telefono text, p_direccion text, p_notas text,
  p_items jsonb, p_comprobante text, p_drive_url text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; prod tienda_productos; cant int;
  limpios jsonb := '[]'; sub numeric := 0; env numeric; fol text;
begin
  if coalesce(trim(p_cliente),'') = '' or coalesce(trim(p_telefono),'') = '' then
    raise exception 'Falta nombre o teléfono';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from tienda_productos where id = (it->>'id')::uuid and activo;
    if not found then raise exception 'Un producto ya no está disponible'; end if;
    cant := greatest(1, least(99, coalesce((it->>'cant')::int, 1)));
    sub := sub + prod.precio * cant;
    limpios := limpios || jsonb_build_object(
      'id', prod.id, 'nombre', prod.nombre, 'precio', prod.precio, 'cant', cant,
      'talla', left(coalesce(it->>'talla',''), 10), 'color', left(coalesce(it->>'color',''), 30),
      'imagen', prod.imagenes[1]);
  end loop;
  select coalesce(envio,0) into env from tienda_ajustes where id = 1;
  fol := 'P-' || to_char(now() at time zone 'America/Mexico_City','YYMMDD') || '-' ||
         upper(substr(md5(random()::text), 1, 4));
  insert into tienda_pedidos(folio, cliente, telefono, direccion, notas, items, subtotal, envio, total, comprobante, drive_url)
  values (fol, left(p_cliente,80), left(p_telefono,20), left(coalesce(p_direccion,''),300), left(coalesce(p_notas,''),300),
          limpios, sub, env, sub + env, p_comprobante, p_drive_url);
  return fol;
end $$;
grant execute on function tienda_crear_pedido(text,text,text,text,jsonb,text,text) to anon, authenticated;

-- El cliente consulta el estado de SU pedido con folio + teléfono
create or replace function tienda_ver_pedido(p_folio text, p_telefono text)
returns table(folio text, estado text, total numeric, items jsonb, creado timestamptz)
language sql security definer set search_path = public as $$
  select folio, estado, total, items, creado from tienda_pedidos
  where folio = upper(trim(p_folio))
    and right(regexp_replace(telefono,'\D','','g'),10) = right(regexp_replace(p_telefono,'\D','','g'),10);
$$;
grant execute on function tienda_ver_pedido(text,text) to anon, authenticated;

-- ---------- 7. Almacenamiento de imágenes ----------
insert into storage.buckets (id, name, public) values ('productos', 'productos', true)  on conflict do nothing;
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false) on conflict do nothing;

drop policy if exists "fotos productos publicas" on storage.objects;
create policy "fotos productos publicas" on storage.objects for select using (bucket_id = 'productos');
drop policy if exists "admin sube fotos" on storage.objects;
create policy "admin sube fotos" on storage.objects for insert with check (bucket_id = 'productos' and tienda_es_admin());
drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin borra fotos" on storage.objects for delete using (bucket_id = 'productos' and tienda_es_admin());

-- Cualquier cliente puede SUBIR un comprobante, pero solo tú puedes VERLOS
drop policy if exists "cliente sube comprobante" on storage.objects;
create policy "cliente sube comprobante" on storage.objects for insert with check (bucket_id = 'comprobantes');
drop policy if exists "admin ve comprobantes" on storage.objects;
create policy "admin ve comprobantes" on storage.objects for select using (bucket_id = 'comprobantes' and tienda_es_admin());

-- ---------- 8. Tus primeros productos (se cargan solo si la tabla está vacía) ----------
insert into tienda_productos(nombre, categoria, descripcion, precio, precio_antes, tallas, colores, imagenes, detalle, destacado, orden)
select * from (values
  ('Playera Huntrix','Playeras','Playera rosa con diseño de Huntrix, estampado a todo color. Tallas para niña, niño y adulto.',199,null::numeric,array['2','4','6','8','10','12','14','CH','M','G','XG'],'[{"nombre":"Rosa","hex":"#e8318a"}]'::jsonb,array['img/huntrix-rosa.jpg'],'Algodón · Estampado a todo color',true,1),
  ('Playera Bluey Catrín','Playeras','Playera verde con Bluey vestido de catrín y su guitarra. Edición especial Día de Muertos.',199,null,array['2','4','6','8','10','12','14','CH','M','G','XG'],'[{"nombre":"Verde limón","hex":"#7ed321"}]'::jsonb,array['img/bluey-verde.jpg'],'Algodón · Edición Día de Muertos',true,2),
  ('Playera Xolo Papel Picado','Playeras','Xoloitzcuintle estilo papel picado en serigrafía naranja. Disponible en negro y morado.',199,null,array['2','4','6','8','10','12','14','CH','M','G','XG'],'[{"nombre":"Negro","hex":"#1d1d1f"},{"nombre":"Morado","hex":"#6a2bc4"}]'::jsonb,array['img/xolo-negra.jpg','img/xolo-morada.jpg'],'Algodón · Serigrafía naranja',true,3)
) v
where not exists (select 1 from tienda_productos);
