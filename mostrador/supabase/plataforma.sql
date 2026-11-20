-- =====================================================================
-- MOSTRADOR — Administración de la plataforma (super admin), pruebas de 30 días, pagos y bloqueos
-- Ya aplicada en Supabase. Se puede volver a correr.
-- =====================================================================

-- ---------- 1. Super administradores (dueños de la plataforma) ----------
create table if not exists mos_superadmins (email text primary key);
alter table mos_superadmins enable row level security;            -- sin políticas: nadie la lee desde la app
insert into mos_superadmins values ('romerorayo2402@gmail.com') on conflict do nothing;

create or replace function mos_es_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from mos_superadmins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------- 2. Plan de cada tienda ----------
alter table mos_negocios add column if not exists prueba_hasta date default (current_date + 30);
alter table mos_negocios add column if not exists pagado_hasta date;
alter table mos_negocios add column if not exists bloqueado boolean not null default false;
alter table mos_negocios add column if not exists motivo_bloqueo text not null default '';
alter table mos_negocios add column if not exists notas_admin text not null default '';
alter table mos_negocios add column if not exists precio_mensual numeric(10,2);   -- null = precio general de la plataforma
update mos_negocios set prueba_hasta = (creado::date + 30) where prueba_hasta is null;
alter table mos_miembros add column if not exists activo boolean not null default true;

-- Tienda con acceso: no bloqueada y dentro de la prueba o del periodo pagado (la demo siempre).
create or replace function mos_negocio_activo(n uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from mos_negocios g where g.id = n and not g.bloqueado
    and (g.es_demo or current_date <= greatest(coalesce(g.prueba_hasta, date '1900-01-01'), coalesce(g.pagado_hasta, date '1900-01-01'))));
$$;
-- Pertenece a la tienda (aunque esté vencida): para ver su estado y pagar.
create or replace function mos_es_miembro_base(n uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from mos_miembros where negocio_id = n and user_id = auth.uid() and activo);
$$;
-- Acceso a los datos: miembro activo + tienda con acceso. Todas las políticas y funciones usan estas dos.
create or replace function mos_es_miembro(n uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select mos_es_miembro_base(n) and mos_negocio_activo(n);
$$;
create or replace function mos_rol(n uuid) returns text
language sql stable security definer set search_path = public as $$
  select rol from mos_miembros where negocio_id = n and user_id = auth.uid() and activo and mos_negocio_activo(n);
$$;

drop policy if exists mos_neg_ver on mos_negocios;
create policy mos_neg_ver on mos_negocios for select to authenticated using (mos_es_miembro_base(id) or mos_es_superadmin());
drop policy if exists mos_mie_ver on mos_miembros;
create policy mos_mie_ver on mos_miembros for select to authenticated using (mos_es_miembro_base(negocio_id) or mos_es_superadmin());

-- El dueño no puede cambiarse a sí mismo el plan ni desbloquearse.
create or replace function mos_proteger_plan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not mos_es_superadmin() and coalesce(current_setting('role', true), '') <> 'postgres' and auth.uid() is not null then
    new.prueba_hasta := old.prueba_hasta; new.pagado_hasta := old.pagado_hasta; new.bloqueado := old.bloqueado;
    new.motivo_bloqueo := old.motivo_bloqueo; new.notas_admin := old.notas_admin; new.precio_mensual := old.precio_mensual;
    new.es_demo := old.es_demo; new.creado_por := old.creado_por;
  end if;
  return new;
end $$;
drop trigger if exists mos_neg_proteger on mos_negocios;
create trigger mos_neg_proteger before update on mos_negocios for each row execute function mos_proteger_plan();

-- ---------- 3. Datos de cobro de la plataforma ----------
create table if not exists mos_plataforma (
  id int primary key default 1 check (id = 1),
  nombre text not null default 'Mostrador',
  precio_mensual numeric(10,2) not null default 299,
  dias_prueba int not null default 30,
  banco text not null default '', titular text not null default '', clabe text not null default '',
  whatsapp text not null default '', nota_pago text not null default 'Haz tu transferencia y avísanos con tu comprobante. Activamos tu tienda el mismo día.'
);
insert into mos_plataforma(id) values (1) on conflict do nothing;
alter table mos_plataforma enable row level security;
drop policy if exists mos_plat_ver on mos_plataforma;
create policy mos_plat_ver on mos_plataforma for select to authenticated using (true);

-- ---------- 4. Pagos ----------
create table if not exists mos_pagos (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references mos_negocios(id) on delete cascade,
  monto       numeric(10,2) not null check (monto >= 0),
  meses       int not null default 1 check (meses between 1 and 24),
  metodo      text not null default 'transferencia',
  referencia  text not null default '',
  nota        text not null default '',
  estado      text not null default 'pendiente' check (estado in ('pendiente','confirmado','rechazado')),
  creado_por  uuid default auth.uid(),
  creado      timestamptz not null default now(),
  revisado_en timestamptz,
  desde       date, hasta date
);
create index if not exists mos_pagos_neg on mos_pagos(negocio_id, creado desc);
alter table mos_pagos enable row level security;
drop policy if exists mos_pagos_ver on mos_pagos;
create policy mos_pagos_ver on mos_pagos for select to authenticated using (mos_es_miembro_base(negocio_id) or mos_es_superadmin());

-- La tienda avisa que pagó (queda pendiente hasta que el super admin lo confirme).
create or replace function mos_reportar_pago(n uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  if not exists(select 1 from mos_miembros where negocio_id = n and user_id = auth.uid() and activo and rol = 'dueno') then raise exception 'Sólo el dueño puede reportar pagos'; end if;
  if mos_es_cuenta_demo() then raise exception 'La demo no tiene pagos'; end if;
  if (select count(*) from mos_pagos where negocio_id = n and estado = 'pendiente') >= 3 then raise exception 'Ya tienes pagos esperando confirmación'; end if;
  insert into mos_pagos(negocio_id, monto, meses, metodo, referencia, nota)
  values (n, greatest(coalesce((p->>'monto')::numeric, 0), 0), least(greatest(coalesce((p->>'meses')::int, 1), 1), 24),
          left(coalesce(p->>'metodo', 'transferencia'), 30), left(coalesce(p->>'referencia', ''), 80), left(coalesce(p->>'nota', ''), 300))
  returning id into r;
  return r;
end $$;

-- ---------- 5. Funciones del super admin ----------
create or replace function mos_estado_plan(g mos_negocios) returns text
language sql stable as $$
  select case when g.es_demo then 'demo' when g.bloqueado then 'bloqueada'
    when g.pagado_hasta is not null and current_date <= g.pagado_hasta then 'activa'
    when current_date <= coalesce(g.prueba_hasta, date '1900-01-01') then 'prueba' else 'vencida' end;
$$;

create or replace function mos_admin_tiendas() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not mos_es_superadmin() then raise exception 'Sólo para administradores de la plataforma'; end if;
  return coalesce((select jsonb_agg(t order by t->>'creado' desc) from (
    select jsonb_build_object(
      'id', g.id, 'nombre', g.nombre, 'giro', g.giro, 'estado', g.estado, 'municipio', g.municipio, 'telefono', g.telefono,
      'creado', g.creado, 'prueba_hasta', g.prueba_hasta, 'pagado_hasta', g.pagado_hasta, 'bloqueado', g.bloqueado,
      'motivo_bloqueo', g.motivo_bloqueo, 'notas_admin', g.notas_admin, 'precio_mensual', g.precio_mensual, 'es_demo', g.es_demo,
      'plan', mos_estado_plan(g),
      'vence', case when g.pagado_hasta is not null and g.pagado_hasta >= current_date then g.pagado_hasta else g.prueba_hasta end,
      'dueno', (select u.email from auth.users u where u.id = g.creado_por),
      'dueno_nombre', (select m.nombre from mos_miembros m where m.negocio_id = g.id and m.user_id = g.creado_por),
      'usuarios', (select count(*) from mos_miembros m where m.negocio_id = g.id),
      'productos', (select count(*) from mos_productos p where p.negocio_id = g.id and p.activo),
      'ventas_30', (select count(*) from mos_ventas v where v.negocio_id = g.id and not v.cancelada and v.creado > now() - interval '30 days'),
      'total_30', (select coalesce(sum(total), 0) from mos_ventas v where v.negocio_id = g.id and not v.cancelada and v.creado > now() - interval '30 days'),
      'ultima_venta', (select max(creado) from mos_ventas v where v.negocio_id = g.id),
      'ultimo_acceso', (select max(u.last_sign_in_at) from mos_miembros m join auth.users u on u.id = m.user_id where m.negocio_id = g.id),
      'pagos_pendientes', (select count(*) from mos_pagos pg where pg.negocio_id = g.id and pg.estado = 'pendiente'),
      'pagado_total', (select coalesce(sum(monto), 0) from mos_pagos pg where pg.negocio_id = g.id and pg.estado = 'confirmado')
    ) t from mos_negocios g) x), '[]'::jsonb);
end $$;

create or replace function mos_admin_tienda(n uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not mos_es_superadmin() then raise exception 'Sólo para administradores de la plataforma'; end if;
  return jsonb_build_object(
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'nombre', m.nombre, 'rol', m.rol, 'activo', m.activo,
                  'ultimo_acceso', u.last_sign_in_at, 'creado', m.creado) order by m.creado) from mos_miembros m join auth.users u on u.id = m.user_id where m.negocio_id = n), '[]'),
    'pagos', coalesce((select jsonb_agg(to_jsonb(p) order by p.creado desc) from mos_pagos p where p.negocio_id = n), '[]'));
end $$;

create or replace function mos_admin_actualizar(n uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not mos_es_superadmin() then raise exception 'Sólo para administradores de la plataforma'; end if;
  update mos_negocios set
    prueba_hasta   = case when p ? 'prueba_hasta' then nullif(p->>'prueba_hasta','')::date else prueba_hasta end,
    pagado_hasta   = case when p ? 'pagado_hasta' then nullif(p->>'pagado_hasta','')::date else pagado_hasta end,
    bloqueado      = coalesce((p->>'bloqueado')::boolean, bloqueado),
    motivo_bloqueo = coalesce(p->>'motivo_bloqueo', motivo_bloqueo),
    notas_admin    = coalesce(p->>'notas_admin', notas_admin),
    precio_mensual = case when p ? 'precio_mensual' then nullif(p->>'precio_mensual','')::numeric else precio_mensual end
  where id = n;
end $$;

create or replace function mos_admin_usuario(n uuid, u uuid, activo boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not mos_es_superadmin() then raise exception 'Sólo para administradores de la plataforma'; end if;
  update mos_miembros set activo = mos_admin_usuario.activo where negocio_id = n and user_id = u;
end $$;

-- Confirma (o registra directo) un pago y extiende el periodo pagado desde donde termine la prueba o el último pago.
create or replace function mos_admin_pago(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pg mos_pagos; g mos_negocios; base date; v_hasta date;
begin
  if not mos_es_superadmin() then raise exception 'Sólo para administradores de la plataforma'; end if;
  if p ? 'pago_id' then
    select * into pg from mos_pagos where id = (p->>'pago_id')::uuid for update;
    if not found or pg.estado <> 'pendiente' then raise exception 'Ese pago ya se revisó'; end if;
    if (p->>'accion') = 'rechazar' then
      update mos_pagos set estado = 'rechazado', revisado_en = now(), nota = trim(nota || ' ' || coalesce(p->>'motivo','')) where id = pg.id; return;
    end if;
  else
    insert into mos_pagos(negocio_id, monto, meses, metodo, referencia, nota)
    values ((p->>'negocio_id')::uuid, coalesce((p->>'monto')::numeric, 0), least(greatest(coalesce((p->>'meses')::int, 1), 1), 24),
            coalesce(p->>'metodo', 'transferencia'), coalesce(p->>'referencia', ''), coalesce(p->>'nota', 'Registrado por el administrador'))
    returning * into pg;
  end if;
  select * into g from mos_negocios where id = pg.negocio_id for update;
  base := greatest(current_date, coalesce(g.pagado_hasta, current_date), coalesce(g.prueba_hasta, current_date));
  v_hasta := (base + make_interval(months => pg.meses))::date;
  update mos_pagos set estado = 'confirmado', revisado_en = now(), desde = base, hasta = v_hasta where id = pg.id;
  update mos_negocios set pagado_hasta = v_hasta, bloqueado = false, motivo_bloqueo = '' where id = g.id;
end $$;

create or replace function mos_admin_config(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not mos_es_superadmin() then raise exception 'Sólo para administradores de la plataforma'; end if;
  update mos_plataforma set
    precio_mensual = coalesce((p->>'precio_mensual')::numeric, precio_mensual), dias_prueba = coalesce((p->>'dias_prueba')::int, dias_prueba),
    banco = coalesce(p->>'banco', banco), titular = coalesce(p->>'titular', titular), clabe = coalesce(p->>'clabe', clabe),
    whatsapp = coalesce(p->>'whatsapp', whatsapp), nota_pago = coalesce(p->>'nota_pago', nota_pago)
  where id = 1;
end $$;

-- Las tiendas nuevas reciben los días de prueba configurados.
create or replace function mos_prueba_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.prueba_hasta := current_date + coalesce((select dias_prueba from mos_plataforma where id = 1), 30);
  return new;
end $$;
drop trigger if exists mos_neg_prueba on mos_negocios;
create trigger mos_neg_prueba before insert on mos_negocios for each row execute function mos_prueba_inicial();

do $$ declare f text; begin
  foreach f in array array['mos_es_superadmin()','mos_negocio_activo(uuid)','mos_es_miembro_base(uuid)','mos_reportar_pago(uuid,jsonb)',
    'mos_admin_tiendas()','mos_admin_tienda(uuid)','mos_admin_actualizar(uuid,jsonb)','mos_admin_usuario(uuid,uuid,boolean)','mos_admin_pago(jsonb)','mos_admin_config(jsonb)'] loop
    execute format('revoke execute on function %s from anon, public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke execute on function mos_proteger_plan() from anon, public, authenticated';
  execute 'revoke execute on function mos_prueba_inicial() from anon, public, authenticated';
end $$;

-- La tienda del dueño de la plataforma no vence.
update mos_negocios set pagado_hasta = date '2099-12-31', notas_admin = 'Tienda del dueño de la plataforma'
where creado_por = (select id from auth.users where email = 'romerorayo2402@gmail.com') and not es_demo;

-- ---------- 6. Registro y verificación de correo (funciones mos-registro y mos-admin-usuarios) ----------
create table if not exists mos_registros (id bigserial primary key, ip text not null default '', email text not null default '', creado timestamptz not null default now());
create index if not exists mos_registros_ip on mos_registros(ip, creado desc);
alter table mos_registros enable row level security;
create table if not exists mos_verificaciones (
  email text primary key, user_id uuid, codigo_hash text not null, expira timestamptz not null,
  intentos int not null default 0, enviados int not null default 1, ultimo_envio timestamptz not null default now(), creado timestamptz not null default now()
);
alter table mos_verificaciones enable row level security;   -- sin políticas: sólo las funciones del servidor
