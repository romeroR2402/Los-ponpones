-- =====================================================================
-- MOSTRADOR — Operaciones en lote (ya aplicadas en Supabase). Todo o nada: si algo falla no se guarda nada.
-- =====================================================================

-- Sacar varios lotes (vencidos o dañados) como merma.
create or replace function mos_mermar_lotes(ids uuid[], nota text default 'Merma por caducidad') returns int
language plpgsql security definer set search_path = public as $$
declare l mos_lotes; n int := 0;
begin
  for l in select * from mos_lotes where id = any(ids) for update loop
    if coalesce(mos_rol(l.negocio_id),'') not in ('dueno','encargado') then raise exception 'Sin permiso'; end if;
    if l.cantidad > 0 then
      insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, nota)
      values (l.negocio_id, l.producto_id, l.id, 'merma', -l.cantidad, left(coalesce(nullif(nota,''),'Merma por caducidad'),120));
      n := n + 1;
    end if;
    update mos_lotes set cambio_proveedor = case when cambio_proveedor = 'pendiente' then 'perdido' else cambio_proveedor end where id = l.id;
  end loop;
  return n;
end $$;

-- El proveedor cambió producto vencido por nuevo: sale lo viejo y entra lo nuevo con su nueva fecha (costo 0).
-- items: [{lote_id, cantidad_nueva?, caducidad_nueva?}]  (cantidad_nueva por defecto = lo que había)
create or replace function mos_cambio_proveedor(p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; l mos_lotes; nuevo uuid; cant numeric; cad date; n int := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p->'items','[]')) loop
    select * into l from mos_lotes where id = (it->>'lote_id')::uuid for update;
    if not found then raise exception 'Lote no encontrado'; end if;
    if coalesce(mos_rol(l.negocio_id),'') not in ('dueno','encargado') then raise exception 'Sin permiso'; end if;
    cant := coalesce(nullif(it->>'cantidad_nueva','')::numeric, l.cantidad);
    cad := nullif(it->>'caducidad_nueva','')::date;
    if cant < 0 then raise exception 'Cantidad inválida'; end if;
    if l.cantidad > 0 then
      insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, nota)
      values (l.negocio_id, l.producto_id, l.id, 'merma', -l.cantidad, 'Cambiado por el proveedor');
    end if;
    update mos_lotes set cambio_proveedor = 'cambiado' where id = l.id;
    if cant > 0 then
      if cad is not null then
        insert into mos_lotes(negocio_id, producto_id, caducidad, proveedor_id) values (l.negocio_id, l.producto_id, cad, l.proveedor_id) returning id into nuevo;
      else nuevo := null; end if;
      insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, costo, nota)
      values (l.negocio_id, l.producto_id, nuevo, 'entrada', cant, 0, 'Cambio del proveedor');
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Editar varios productos a la vez.
-- p: {precio?, precio_pct?, costo?, categoria?, minimo?, maneja_caducidad?, activo?}
--    precio = fija el mismo precio; precio_pct = sube (+) o baja (-) un porcentaje, redondeado a 50 centavos.
create or replace function mos_productos_lote(n uuid, ids uuid[], p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if coalesce(mos_rol(n),'') not in ('dueno','encargado') then raise exception 'Sin permiso'; end if;
  update mos_productos set
    precio = case when p ? 'precio' then greatest((p->>'precio')::numeric, 0)
                  when p ? 'precio_pct' then greatest(round(precio * (1 + (p->>'precio_pct')::numeric / 100) * 2) / 2, 0)
                  else precio end,
    costo = case when p ? 'costo' then greatest((p->>'costo')::numeric, 0) else costo end,
    categoria = coalesce(nullif(trim(p->>'categoria'), ''), categoria),
    minimo = case when p ? 'minimo' then greatest((p->>'minimo')::numeric, 0) else minimo end,
    maneja_caducidad = coalesce((p->>'maneja_caducidad')::boolean, maneja_caducidad),
    activo = coalesce((p->>'activo')::boolean, activo)
  where negocio_id = n and id = any(ids);
  get diagnostics c = row_count; return c;
end $$;

revoke execute on function mos_mermar_lotes(uuid[], text), mos_cambio_proveedor(jsonb), mos_productos_lote(uuid, uuid[], jsonb) from anon, public;
grant execute on function mos_mermar_lotes(uuid[], text), mos_cambio_proveedor(jsonb), mos_productos_lote(uuid, uuid[], jsonb) to authenticated;
