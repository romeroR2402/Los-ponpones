-- =====================================================================
-- MOSTRADOR — Tienda demo "Abarrotes La Esperanza" (ya aplicada en Supabase)
-- Cuenta pública: demo@usuarios.mostrador.app / demo2026  (botón "Ver la demo" en la app)
-- La cuenta demo sólo ve su negocio (RLS), no crea negocios ni aporta al catálogo compartido.
-- Reiniciar a mano: select mos_demo_reiniciar();   (o el botón "Reiniciar demo" dentro de la app)
-- =====================================================================
alter table mos_negocios add column if not exists es_demo boolean not null default false;

create or replace function mos_es_cuenta_demo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email') = 'demo@usuarios.mostrador.app', false);
$$;
revoke execute on function mos_es_cuenta_demo() from anon, public;
grant execute on function mos_es_cuenta_demo() to authenticated;
-- Además: mos_catalogo_aportar() sale sin hacer nada si mos_es_cuenta_demo(),
-- y mos_crear_negocio() lanza 'La cuenta demo no puede crear negocios'.

-- Usuario demo (contraseña pública a propósito)
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
select '00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','demo@usuarios.mostrador.app',extensions.crypt('demo2026',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"nombre":"Lupe"}',now(),now(),'','','',''
where not exists(select 1 from auth.users where email='demo@usuarios.mostrador.app');
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),'email',now(),now(),now()
from auth.users u where u.email='demo@usuarios.mostrador.app' and not exists(select 1 from auth.identities i where i.user_id=u.id);

-- ---------- Borra y vuelve a llenar la tienda demo ----------
-- 53 productos (fotos del catálogo), 5 proveedores, ~750 ventas de 30 días, lotes con caducidad
-- (uno por cambiar con proveedor, uno vencido, varios por vencer), agotados y productos por acabarse.
create or replace function mos_demo_reiniciar() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid; neg uuid; tz text := 'America/Mexico_City'; hoy date := (now() at time zone 'America/Mexico_City')::date;
  p record; d int; n int; k int; it int; vid uuid; folio int := 0; items jsonb; tot numeric; cant numeric; pago text; rec numeric; t timestamptz;
  lt uuid; resto numeric; cli text;
  clientes text[] := array['Doña Mari','Don Chucho','Rosa (la del 4)','Señor Pepe','Lety','Don Beto'];
begin
  select id into uid from auth.users where email = 'demo@usuarios.mostrador.app';
  if uid is null then raise exception 'Falta crear el usuario demo'; end if;
  if auth.uid() is not null and auth.uid() <> uid then raise exception 'Sólo la cuenta demo puede reiniciar la demo'; end if;
  perform setseed(0.4242);
  delete from mos_negocios where es_demo and creado_por = uid;

  insert into mos_negocios(nombre, giro, capacidades, modulos, estado, municipio, creado_por, es_demo)
  values ('Abarrotes La Esperanza', 'abarrotes', '{"caducidad":true,"reclamoProveedor":true,"granel":true,"fiado":true,"diasAviso":7}',
          array['inicio','vender','productos','entradas','alertas','ventas','proveedores','lector','ajustes'], 'Ciudad de México', 'Coyoacán', uid, true)
  returning id into neg;
  insert into mos_miembros(negocio_id, user_id, rol, nombre) values (neg, uid, 'dueno', 'Lupe');

  create temp table if not exists demo_prov(k text, id uuid) on commit drop; truncate demo_prov;
  insert into mos_proveedores(negocio_id, nombre, rfc, dia_visita) values
    (neg,'Coca-Cola FEMSA','CFE980101AB1','lunes y jueves'), (neg,'Grupo Bimbo','GBI810101AB2','diario'),
    (neg,'Lala','LAL850101AB3','martes y viernes'), (neg,'Sabritas (PepsiCo)','SAB660101AB4','miércoles'),
    (neg,'Distribuidora La Central','DLC000101AB5','sábado');
  insert into demo_prov select case nombre when 'Coca-Cola FEMSA' then 'coca' when 'Grupo Bimbo' then 'bimbo' when 'Lala' then 'lala'
    when 'Sabritas (PepsiCo)' then 'sabritas' else 'central' end, id from mos_proveedores where negocio_id = neg;

  -- codigo, nombre, categoria, unidad, precio, minimo, existencia final, caduca, proveedor,
  -- días para caducar del primer lote, cantidad de ese lote, cambio pendiente, popularidad
  create temp table if not exists demo_p(codigo text, nombre text, cat text, u text, precio numeric, minimo numeric, fin numeric, cad bool, prov text,
    d1 int, c1 numeric, cambio bool, pop int, id uuid) on commit drop; truncate demo_p;
  insert into demo_p values
  ('7501055371655','Coca-Cola 2 L','Bebidas','pza',42,6,3,false,'coca',null,null,false,9,null),
  ('7501055300075','Coca-Cola 355 ml','Bebidas','pza',18,12,30,false,'coca',null,null,false,10,null),
  ('7501031310098','Pepsi 3 L','Bebidas','pza',38,4,8,false,'sabritas',null,null,false,4,null),
  ('0758104001972','Agua Bonafont 2 L','Bebidas','pza',18,6,14,false,'central',null,null,false,6,null),
  ('7501055310883','Agua Ciel 1 L','Bebidas','pza',12,8,20,false,'coca',null,null,false,7,null),
  ('7501013109702','Jugo Jumex Piña 1 L','Bebidas','pza',28,4,9,false,'central',null,null,false,3,null),
  ('7501055332489','Jugo Del Valle Durazno 1 L','Bebidas','pza',26,4,7,false,'coca',null,null,false,3,null),
  ('7501073831964','Agua mineral Peñafiel 600 ml','Bebidas','pza',16,6,12,false,'central',null,null,false,4,null),
  ('0036731323002','Gatorade Lima-Limón 1 L','Bebidas','pza',29,3,0,false,'sabritas',null,null,false,3,null),
  ('7503037746192','Zuko Piña sobre','Bebidas','pza',7,10,25,false,'central',null,null,false,4,null),
  ('7501020560688','Leche Lala Entera 1 L','Lácteos','pza',29,8,16,true,'lala',2,6,true,10,null),
  ('7501020573299','Yoghurt Lala Fresa 1 kg','Lácteos','pza',42,3,5,true,'lala',-1,2,false,4,null),
  ('7501020556964','Lala Yomi Fresa 250 ml','Lácteos','pza',14,6,12,true,'lala',5,6,false,5,null),
  ('7501055903931','Crema Alpura 450 ml','Lácteos','pza',36,3,6,true,'central',18,null,false,3,null),
  ('7501020511390','Flan Lala 100 g','Lácteos','pza',15,4,8,true,'lala',9,null,false,3,null),
  ('','Queso panela (granel)','Lácteos','kg',160,1,2.5,true,'central',6,null,false,5,null),
  ('7501040002366','Jamón de pavo FUD 290 g','Salchichonería','pza',58,3,5,true,'central',4,null,false,5,null),
  ('7501020569353','Jamón Nutri Leche 250 g','Salchichonería','pza',45,3,4,true,'lala',12,null,false,3,null),
  ('','Jamón de pavo (granel)','Salchichonería','kg',180,1,1.75,true,'central',5,null,false,7,null),
  ('7500478007622','Sabritas Original 45 g','Botanas','pza',20,8,18,false,'sabritas',null,null,false,9,null),
  ('7500478007967','Ruffles Queso 50 g','Botanas','pza',21,6,10,false,'sabritas',null,null,false,6,null),
  ('7501011163706','Doritos 3D 45 g','Botanas','pza',22,6,9,false,'sabritas',null,null,false,5,null),
  ('7500478025275','Cheetos Mix 52 g','Botanas','pza',20,6,11,false,'sabritas',null,null,false,4,null),
  ('7500810021064','Takis Fuego 70 g','Botanas','pza',22,6,0,false,'bimbo',null,null,false,7,null),
  ('7501024514236','Chocolate Hershey''s 30 g','Dulces','pza',15,6,14,false,'central',null,null,false,4,null),
  ('7500810004371','Panditas Ricolino 50 g','Dulces','pza',14,6,9,false,'bimbo',null,null,false,4,null),
  ('7500810028032','Polvorón Marinela','Dulces','pza',10,6,15,false,'bimbo',null,null,false,3,null),
  ('7500478002580','Chokis Gamesa 63 g','Galletas','pza',16,6,13,false,'sabritas',null,null,false,5,null),
  ('7500810027295','Príncipe Marinela 106 g','Galletas','pza',18,6,10,false,'bimbo',null,null,false,4,null),
  ('7501000606573','Cremax Gamesa 90 g','Galletas','pza',14,6,4,false,'sabritas',null,null,false,3,null),
  ('7500478015931','Fruts Gamesa 95 g','Galletas','pza',15,4,8,false,'sabritas',null,null,false,2,null),
  ('7501030418542','Canelitas Bimbo','Galletas','pza',19,4,7,false,'bimbo',null,null,false,2,null),
  ('7500810032978','Pan Blanco Bimbo chico','Pan','pza',38,3,4,true,'bimbo',3,null,false,8,null),
  ('7501000336319','Pan Integral Bimbo','Pan','pza',52,3,1,true,'bimbo',6,null,false,3,null),
  ('7501030409854','Nito Bimbo 62 g','Pan','pza',18,6,10,true,'bimbo',8,null,false,4,null),
  ('','Tortillas de maíz','Pan','kg',24,3,6,true,'central',1,null,false,9,null),
  ('7501008001424','All-Bran Kellogg''s 500 g','Cereales','pza',68,2,3,false,'central',null,null,false,1,null),
  ('7501058617446','Corn Flakes Nestlé 500 g','Cereales','pza',58,2,4,false,'central',null,null,false,2,null),
  ('7501001625160','Trix Nestlé 300 g','Cereales','pza',62,2,3,false,'central',null,null,false,1,null),
  ('7501039127056','Aceite Sabrosano 946 ml','Abarrotes','pza',42,4,7,false,'central',null,null,false,3,null),
  ('7501003303059','Mayonesa McCormick 390 g','Abarrotes','pza',48,3,5,false,'central',null,null,false,2,null),
  ('7506306322226','Consomé de pollo Knorr 330 g','Abarrotes','pza',52,2,4,false,'central',null,null,false,2,null),
  ('7501005129954','Sopa Knorr Fideo','Abarrotes','pza',14,6,16,false,'central',null,null,false,4,null),
  ('','Frijol negro (granel)','Granel','kg',38,3,12,false,'central',null,null,false,4,null),
  ('','Azúcar estándar (granel)','Granel','kg',32,3,15,false,'central',null,null,false,4,null),
  ('','Arroz súper extra (granel)','Granel','kg',30,3,10,false,'central',null,null,false,3,null),
  ('','Huevo blanco','Abarrotes','kg',52,3,1.5,true,'central',14,null,false,7,null),
  ('7501035905344','Fabuloso Lavanda 2 L','Limpieza','pza',48,2,4,false,'central',null,null,false,2,null),
  ('7501025403058','Pinol Multiusos 828 ml','Limpieza','pza',39,2,5,false,'central',null,null,false,2,null),
  ('7500459001571','Detergente 123 1 kg','Limpieza','pza',45,2,3,false,'central',null,null,false,2,null),
  ('7501026005671','Jabón Zote Rosa 400 g','Higiene','pza',24,4,9,false,'central',null,null,false,3,null),
  ('7509546669182','Jabón Palmolive Naturals 150 g','Higiene','pza',18,4,8,false,'central',null,null,false,2,null),
  ('7509546053776','Jabón líquido Palmolive 221 ml','Higiene','pza',42,2,3,false,'central',null,null,false,1,null);

  for p in select * from demo_p loop
    insert into mos_productos(negocio_id, nombre, codigo, categoria, unidad, precio, costo, minimo, maneja_caducidad, imagen)
    values (neg, p.nombre, nullif(p.codigo,''), p.cat, p.u, p.precio, round(p.precio * (0.70 + random() * 0.08)::numeric, 1), p.minimo, p.cad,
            coalesce((select imagen from mos_catalogo c where c.codigo = p.codigo), ''))
    returning id into lt;
    update demo_p set id = lt where nombre = p.nombre;
  end loop;

  create temp table if not exists demo_v(id uuid, s numeric) on commit drop; truncate demo_v;
  insert into demo_v select id, 0 from demo_p;

  -- Ventas de los últimos 30 días (más los fines de semana; hoy sólo hasta la hora actual)
  for d in reverse 29..0 loop
    n := 16 + floor(random() * 14)::int + case when extract(isodow from hoy - d) in (6,7) then 10 else 0 end;
    for k in 1..n loop
      t := ((hoy - d) + time '08:00' + (random() * interval '13 hours 30 minutes')) at time zone tz;
      continue when t > now() - interval '5 minutes';
      items := '[]'; tot := 0;
      for it in 1..(1 + floor(random() * random() * 5)::int) loop
        select * into p from demo_p order by random() * pop desc limit 1;
        cant := case when p.u = 'kg' then (1 + floor(random() * 6)) * 0.25 else 1 + floor(random() * random() * 3) end;
        continue when items @> jsonb_build_array(jsonb_build_object('producto_id', p.id));
        items := items || jsonb_build_object('producto_id', p.id, 'nombre', p.nombre, 'cantidad', cant, 'unidad', p.u, 'precio', p.precio,
                 'costo', (select costo from mos_productos where id = p.id), 'importe', round(cant * p.precio, 2));
        tot := tot + round(cant * p.precio, 2);
        update demo_v set s = s + cant where id = p.id;
      end loop;
      pago := case when random() < 0.70 then 'efectivo' when random() < 0.5 then 'tarjeta' when random() < 0.55 then 'transferencia' else 'fiado' end;
      rec := case when pago = 'efectivo' then (select min(b) from unnest(array[tot, 20, 50, 100, 200, 500, 1000]) b where b >= tot and (b = tot and random() < 0.3 or b > tot)) else tot end;
      cli := case when pago = 'fiado' then clientes[1 + floor(random() * array_length(clientes, 1))::int] else '' end;
      folio := folio + 1; vid := gen_random_uuid();
      insert into mos_ventas(id, negocio_id, folio, items, total, pago, recibido, cliente, user_id, creado)
      values (vid, neg, folio, items, tot, pago, coalesce(rec, tot), cli, uid, t);
      insert into mos_movimientos(negocio_id, producto_id, tipo, cantidad, referencia, user_id, creado)
      select neg, (x->>'producto_id')::uuid, 'venta', -(x->>'cantidad')::numeric, vid, uid, t from jsonb_array_elements(items) x;
    end loop;
  end loop;
  update mos_negocios set ultimo_folio = folio where id = neg;

  -- Entradas: lo vendido + lo que queda hoy. Lo que caduca queda en lotes con su fecha.
  for p in select dp.*, v.s, pr.id as prov_id from demo_p dp join demo_v v on v.id = dp.id join demo_prov pr on pr.k = dp.prov loop
    insert into mos_movimientos(negocio_id, producto_id, tipo, cantidad, costo, nota, user_id, creado)
    values (neg, p.id, 'entrada', p.s + case when p.cad then 0 else p.fin end, (select costo from mos_productos where id = p.id), 'Inventario inicial', uid, now() - interval '31 days');
    if p.cad and p.fin > 0 then
      resto := p.fin;
      if p.c1 is not null and p.c1 < p.fin then
        insert into mos_lotes(negocio_id, producto_id, caducidad, proveedor_id, cambio_proveedor) values (neg, p.id, hoy + p.d1, p.prov_id, case when p.cambio then 'pendiente' end) returning id into lt;
        insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, user_id, creado) values (neg, p.id, lt, 'entrada', p.c1, uid, now() - interval '6 days');
        resto := p.fin - p.c1;
        insert into mos_lotes(negocio_id, producto_id, caducidad, proveedor_id) values (neg, p.id, hoy + p.d1 + 14, p.prov_id) returning id into lt;
      else
        insert into mos_lotes(negocio_id, producto_id, caducidad, proveedor_id, cambio_proveedor) values (neg, p.id, hoy + coalesce(p.d1, 15), p.prov_id, case when p.cambio then 'pendiente' end) returning id into lt;
      end if;
      insert into mos_movimientos(negocio_id, producto_id, lote_id, tipo, cantidad, user_id, creado) values (neg, p.id, lt, 'entrada', resto, uid, now() - interval '2 days');
    end if;
  end loop;

  -- Algunas compras para el historial
  insert into mos_compras(negocio_id, proveedor_id, items, total, origen, user_id, creado)
  select neg, pr.id, jsonb_build_array(jsonb_build_object('nota','Pedido semanal')), round((800 + random() * 2500)::numeric, 2), case when random() < 0.5 then 'xml' else 'escaner' end, uid, now() - (g || ' days')::interval
  from demo_prov pr cross join generate_series(2, 26, 8) g;
  return neg;
end $$;
revoke execute on function mos_demo_reiniciar() from anon, public;
grant execute on function mos_demo_reiniciar() to authenticated;
