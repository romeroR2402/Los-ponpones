-- =====================================================================
-- MOSTRADOR — Sistema de gestión para comercios (abarrotes, tlapalería, farmacia, papelería…)
-- Mismo proyecto de Supabase que Los Ponpones, tablas con prefijo mos_.
-- Multi-negocio: cada fila lleva negocio_id y la seguridad por fila (RLS) impide ver
-- datos de otro negocio. Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- 1. Negocios y miembros ----------
create table if not exists mos_negocios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  giro         text not null,                       -- abarrotes, minisuper, tlapaleria, farmacia, papeleria, otro
  capacidades  jsonb not null default '{}',         -- {"caducidad":true,"granel":true,...}
  modulos      text[] not null default '{}',
  telefono     text default '',
  estado       text default 'Ciudad de México',
  municipio    text default '',
  zona_horaria text default 'America/Mexico_City',
  ultimo_folio int not null default 0,
  creado_por   uuid references auth.users(id) on delete set null,
  creado       timestamptz default now()
);

create table if not exists mos_miembros (
  negocio_id uuid references mos_negocios(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  rol        text not null default 'cajero' check (rol in ('dueno','encargado','cajero')),
  nombre     text default '',
  creado     timestamptz default now(),
  primary key (negocio_id, user_id)
);

create or replace function mos_es_miembro(n uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from mos_miembros where negocio_id = n and user_id = auth.uid());
$$;
create or replace function mos_rol(n uuid) returns text
language sql stable security definer set search_path = public as $$
  select rol from mos_miembros where negocio_id = n and user_id = auth.uid();
$$;

-- ---------- 2. Catálogo ----------
create table if not exists mos_proveedores (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references mos_negocios(id) on delete cascade,
  nombre     text not null,
  telefono   text default '',
  rfc        text default '',
  dia_visita text default '',
  creado     timestamptz default now()
);

create table if not exists mos_productos (
  id               uuid primary key default gen_random_uuid(),
  negocio_id       uuid not null references mos_negocios(id) on delete cascade,
  nombre           text not null,
  codigo           text,                              -- código de barras / clave
  categoria        text default 'General',
  unidad           text not null default 'pza',       -- pza, kg, g, l, ml, m, cm, caja, paquete…
  precio           numeric(12,2) not null default 0 check (precio >= 0),
  costo            numeric(12,2) not null default 0 check (costo >= 0),
  minimo           numeric(12,3) not null default 0,
  existencia       numeric(12,3) not null default 0,  -- se actualiza sola con los movimientos
  maneja_caducidad boolean not null default false,
  atributos        jsonb not null default '{}',       -- campos extra según el giro
  imagen           text default '',
  activo           boolean not null default true,
  creado           timestamptz default now()
);
create unique index if not exists mos_productos_codigo on mos_productos(negocio_id, codigo) where codigo is not null and codigo <> '';
create index if not exists mos_productos_negocio on mos_productos(negocio_id);

create table if not exists mos_lotes (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null references mos_negocios(id) on delete cascade,
  producto_id     uuid not null references mos_productos(id) on delete cascade,
  caducidad       date,
  lote            text default '',
  cantidad        numeric(12,3) not null default 0,
  proveedor_id    uuid references mos_proveedores(id) on delete set null,
  cambio_proveedor text check (cambio_proveedor in ('pendiente','cambiado','perdido')), -- el proveedor debe cambiarlo
  creado          timestamptz default now()
);
create index if not exists mos_lotes_cad on mos_lotes(negocio_id, caducidad) where cantidad > 0;

-- ---------- 3. Movimientos (libro de inventario: sólo se agregan) ----------
create table if not exists mos_movimientos (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references mos_negocios(id) on delete cascade,
  producto_id uuid not null references mos_productos(id) on delete cascade,
  lote_id     uuid references mos_lotes(id) on delete set null,
  tipo        text not null check (tipo in ('entrada','venta','ajuste','merma','devolucion','cancelacion')),
  cantidad    numeric(12,3) not null,                 -- positivo entra, negativo sale
  costo       numeric(12,2) default 0,
  referencia  uuid,                                   -- venta o compra que lo originó
  nota        text default '',
  user_id     uuid default auth.uid(),
  creado      timestamptz default now()
);
create index if not exists mos_mov_prod on mos_movimientos(producto_id, creado desc);

create or replace function mos_aplicar_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update mos_productos set existencia = existencia + new.cantidad where id = new.producto_id;
  if new.lote_id is not null then
    update mos_lotes set cantidad = greatest(cantidad + new.cantidad, 0) where id = new.lote_id;
  end if;
  return new;
end $$;
drop trigger if exists mos_mov_aplicar on mos_movimientos;
create trigger mos_mov_aplicar after insert on mos_movimientos for each row execute function mos_aplicar_movimiento();

-- ---------- 4. Ventas y compras ----------
create table if not exists mos_ventas (
  id         uuid primary key,                        -- lo genera el dispositivo (ventas sin internet sin duplicar)
  negocio_id uuid not null references mos_negocios(id) on delete cascade,
  folio      int not null,
  items      jsonb not null,                          -- [{producto_id,nombre,cantidad,unidad,precio,importe}]
  total      numeric(12,2) not null,
  pago       text not null default 'efectivo' check (pago in ('efectivo','tarjeta','transferencia','fiado')),
  recibido   numeric(12,2) default 0,
  cliente    text default '',
  cancelada  boolean not null default false,
  user_id    uuid default auth.uid(),
  creado     timestamptz default now()
);
create index if not exists mos_ventas_neg on mos_ventas(negocio_id, creado desc);

create table if not exists mos_compras (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references mos_negocios(id) on delete cascade,
  proveedor_id uuid references mos_proveedores(id) on delete set null,
  items        jsonb not null,
  total        numeric(12,2) not null default 0,
  origen       text not null default 'manual' check (origen in ('manual','escaner','xml','foto')),
  uuid_cfdi    text,
  user_id      uuid default auth.uid(),
  creado       timestamptz default now()
);
create unique index if not exists mos_compras_cfdi on mos_compras(negocio_id, uuid_cfdi) where uuid_cfdi is not null;

-- ---------- 5. Seguridad por fila ----------
alter table mos_negocios    enable row level security;
alter table mos_miembros    enable row level security;
alter table mos_proveedores enable row level security;
alter table mos_productos   enable row level security;
alter table mos_lotes       enable row level security;
alter table mos_movimientos enable row level security;
alter table mos_ventas      enable row level security;
alter table mos_compras     enable row level security;

drop policy if exists mos_neg_ver on mos_negocios;
create policy mos_neg_ver on mos_negocios for select to authenticated using (mos_es_miembro(id));
drop policy if exists mos_neg_editar on mos_negocios;
create policy mos_neg_editar on mos_negocios for update to authenticated
  using (mos_rol(id) = 'dueno') with check (mos_rol(id) = 'dueno');

drop policy if exists mos_mie_ver on mos_miembros;
create policy mos_mie_ver on mos_miembros for select to authenticated using (mos_es_miembro(negocio_id));

-- Catálogo: todos los miembros leen; dueño y encargado escriben.
do $$ declare t text; begin
  foreach t in array array['mos_proveedores','mos_productos','mos_lotes'] loop
    execute format('drop policy if exists %1$s_ver on %1$s', t);
    execute format('create policy %1$s_ver on %1$s for select to authenticated using (mos_es_miembro(negocio_id))', t);
    execute format('drop policy if exists %1$s_escribir on %1$s', t);
    execute format('create policy %1$s_escribir on %1$s for all to authenticated using (mos_rol(negocio_id) in (''dueno'',''encargado'')) with check (mos_rol(negocio_id) in (''dueno'',''encargado''))', t);
  end loop;
end $$;

-- Movimientos, ventas y compras: se leen; se escriben sólo con las funciones de abajo
-- (salvo ajustes y mermas, que dueño/encargado pueden registrar directo).
drop policy if exists mos_mov_ver on mos_movimientos;
create policy mos_mov_ver on mos_movimientos for select to authenticated using (mos_es_miembro(negocio_id));
drop policy if exists mos_mov_ajuste on mos_movimientos;
create policy mos_mov_ajuste on mos_movimientos for insert to authenticated
  with check (tipo in ('ajuste','merma') and mos_rol(negocio_id) in ('dueno','encargado'));
drop policy if exists mos_ven_ver on mos_ventas;
create policy mos_ven_ver on mos_ventas for select to authenticated using (mos_es_miembro(negocio_id));
drop policy if exists mos_com_ver on mos_compras;
create policy mos_com_ver on mos_compras for select to authenticated using (mos_es_miembro(negocio_id));

-- ---------- 6. Funciones ----------
-- Crear negocio: quien lo crea queda como dueño.
create or replace function mos_crear_negocio(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare n uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  insert into mos_negocios(nombre, giro, capacidades, modulos, telefono, estado, municipio, creado_por)
  values (coalesce(nullif(trim(p->>'nombre'),''),'Mi negocio'), coalesce(p->>'giro','otro'),
          coalesce(p->'capacidades','{}'), coalesce(array(select jsonb_array_elements_text(p->'modulos')),'{}'),
          coalesce(p->>'telefono',''), coalesce(p->>'estado','Ciudad de México'), coalesce(p->>'municipio',''), auth.uid())
  returning id into n;
  insert into mos_miembros(negocio_id, user_id, rol, nombre) values (n, auth.uid(), 'dueno', coalesce(p->>'persona',''));
  return n;
end $$;

-- Registrar venta. Idempotente por id (si se manda dos veces sin internet, no se duplica).
-- Descuenta primero de los lotes que caducan antes (FEFO).
create or replace function mos_vender(p jsonb) returns mos_ventas
language plpgsql security definer set search_path = public as $$
declare
  v mos_ventas; neg uuid := (p->>'negocio_id')::uuid; it jsonb; resta numeric; l record; toma numeric; f int; tot numeric := 0;
begin
  if not mos_es_miembro(neg) then raise exception 'Sin acceso a este negocio'; end if;
  select * into v from mos_ventas where id = (p->>'id')::uuid;
  if found then return v; end if;

  for it in select * from jsonb_array_elements(p->'items') loop
    if not exists(select 1 from mos_productos where id = (it->>'producto_id')::uuid and negocio_id = neg) then
      raise exception 'Producto no encontrado';
    end if;
    tot := tot + round((it->>'cantidad')::numeric * (it->>'precio')::numeric, 2);
  end loop;

  update mos_negocios set ultimo_folio = ultimo_folio + 1 where id = neg returning ultimo_folio into f;
  insert into mos_ventas(id, negocio_id, folio, items, total, pago, recibido, cliente, creado)
  values ((p->>'id')::uuid, neg, f, p->'items', tot, coalesce(p->>'pago','efectivo'),
          coalesce((p->>'recibido')::numeric,0), coalesce(p->>'cliente',''), coalesce((p->>'creado')::timestamptz, now()))
  returning * into v;

  for it in select * from jsonb_array_elements(p->'items') loop
    resta := (it->>'cantidad')::numeric;
    for l in select id, cantidad from mos_lotes
             where producto_id = (it->>'producto_id')::uuid and cantidad > 0
             order by caducidad asc nulls last, creado asc loop
      exit when resta <= 0;
      toma := least(resta, l.cantidad);
      insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, referencia)
      values (neg, (it->>'producto_id')::uuid, l.id, 'venta', -toma, v.id);
      resta := resta - toma;
    end loop;
    if resta > 0 then
      insert into mos_movimientos(negocio_id, producto_id, tipo, cantidad, referencia)
      values (neg, (it->>'producto_id')::uuid, 'venta', -resta, v.id);
    end if;
  end loop;
  return v;
end $$;

-- Cancelar venta: regresa existencias.
create or replace function mos_cancelar_venta(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v mos_ventas; m record;
begin
  select * into v from mos_ventas where id = p_id;
  if not found or v.cancelada then return; end if;
  if coalesce(mos_rol(v.negocio_id),'') not in ('dueno','encargado') then raise exception 'Sólo el dueño o encargado puede cancelar'; end if;
  for m in select * from mos_movimientos where referencia = p_id and tipo = 'venta' loop
    insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, referencia, nota)
    values (m.negocio_id, m.producto_id, m.lote_id, 'cancelacion', -m.cantidad, p_id, 'Venta cancelada');
  end loop;
  update mos_ventas set cancelada = true where id = p_id;
end $$;

-- Entrada de mercancía (manual, escáner o XML de factura).
-- items: [{producto_id, cantidad, costo, caducidad?, lote?, cambio?}]
create or replace function mos_entrada(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare neg uuid := (p->>'negocio_id')::uuid; c uuid; it jsonb; l uuid; tot numeric := 0; prov uuid := nullif(p->>'proveedor_id','')::uuid;
begin
  if coalesce(mos_rol(neg),'') not in ('dueno','encargado') then raise exception 'Sólo el dueño o encargado registra entradas'; end if;
  for it in select * from jsonb_array_elements(p->'items') loop
    tot := tot + round((it->>'cantidad')::numeric * coalesce((it->>'costo')::numeric,0), 2);
  end loop;
  insert into mos_compras(negocio_id, proveedor_id, items, total, origen, uuid_cfdi)
  values (neg, prov, p->'items', tot, coalesce(p->>'origen','manual'), nullif(p->>'uuid_cfdi',''))
  returning id into c;

  for it in select * from jsonb_array_elements(p->'items') loop
    if not exists(select 1 from mos_productos where id = (it->>'producto_id')::uuid and negocio_id = neg) then
      raise exception 'Producto no encontrado';
    end if;
    l := null;
    if nullif(it->>'caducidad','') is not null then
      insert into mos_lotes(negocio_id, producto_id, caducidad, lote, proveedor_id, cambio_proveedor)
      values (neg, (it->>'producto_id')::uuid, (it->>'caducidad')::date, coalesce(it->>'lote',''), prov,
              case when (it->>'cambio')::boolean then 'pendiente' end)
      returning id into l;
    end if;
    insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, costo, referencia)
    values (neg, (it->>'producto_id')::uuid, l, 'entrada', (it->>'cantidad')::numeric, coalesce((it->>'costo')::numeric,0), c);
    if coalesce((it->>'costo')::numeric,0) > 0 then
      update mos_productos set costo = (it->>'costo')::numeric where id = (it->>'producto_id')::uuid;
    end if;
  end loop;
  return c;
end $$;

-- Sacar un lote vencido (merma) o marcar que el proveedor ya lo cambió.
create or replace function mos_resolver_lote(p_lote uuid, p_accion text) returns void
language plpgsql security definer set search_path = public as $$
declare l mos_lotes;
begin
  select * into l from mos_lotes where id = p_lote;
  if not found then return; end if;
  if coalesce(mos_rol(l.negocio_id),'') not in ('dueno','encargado') then raise exception 'Sin permiso'; end if;
  if p_accion in ('merma','cambiado') and l.cantidad > 0 then
    insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, nota)
    values (l.negocio_id, l.producto_id, l.id, 'merma', -l.cantidad,
            case when p_accion = 'cambiado' then 'Cambiado por el proveedor' else 'Merma por caducidad' end);
  end if;
  update mos_lotes set cambio_proveedor = case
      when p_accion = 'cambiado' then 'cambiado'
      when p_accion = 'merma' and cambio_proveedor = 'pendiente' then 'perdido'
      else cambio_proveedor end
  where id = p_lote;
end $$;

revoke execute on function mos_crear_negocio(jsonb), mos_vender(jsonb), mos_cancelar_venta(uuid), mos_entrada(jsonb), mos_resolver_lote(uuid,text) from anon, public;
grant execute on function mos_crear_negocio(jsonb), mos_vender(jsonb), mos_cancelar_venta(uuid), mos_entrada(jsonb), mos_resolver_lote(uuid,text) to authenticated;
revoke execute on function mos_aplicar_movimiento() from anon, public, authenticated;
revoke execute on function mos_es_miembro(uuid), mos_rol(uuid) from anon, public;
grant execute on function mos_es_miembro(uuid), mos_rol(uuid) to authenticated;
