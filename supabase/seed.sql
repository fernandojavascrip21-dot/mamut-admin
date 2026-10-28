-- Datos de prueba para el Supabase local (Docker). Todo es inventado.
-- Corre automáticamente después de las migraciones en `npm run db:start` (primera vez)
-- y en cada `npm run db:reset`. Nunca se aplica al proyecto real.
--
-- Cuentas (todas con email confirmado):
--   admin@mammut.local        Admin-123456!     admin
--   vendedor1@mammut.local    Vendedor-123456!  vendedor
--   vendedor2@mammut.local    Vendedor-123456!  vendedor
--   inactivo@mammut.local     Vendedor-123456!  vendedor (desactivado: el login debe rechazarlo)

-- 1. Cuentas de Auth + perfiles ------------------------------------------------
-- GoTrue falla al leer usuarios con estos tokens en NULL, por eso van como ''.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt(u.password, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@mammut.local', 'Admin-123456!'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'vendedor1@mammut.local', 'Vendedor-123456!'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'vendedor2@mammut.local', 'Vendedor-123456!'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'inactivo@mammut.local', 'Vendedor-123456!')
) as u(id, email, password);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now(), now()
from auth.users
where email like '%@mammut.local';

insert into public.profiles (id, role, full_name, active) values
  ('a0000000-0000-4000-8000-000000000001', 'admin', 'Ana Administradora', true),
  ('a0000000-0000-4000-8000-000000000002', 'vendedor', 'Víctor Vendedor', true),
  ('a0000000-0000-4000-8000-000000000003', 'vendedor', 'Valeria Vendedora', true),
  ('a0000000-0000-4000-8000-000000000004', 'vendedor', 'Iván Inactivo', false);

-- 2. Catálogo -----------------------------------------------------------------

insert into public.categories (name, slug, sort_order) values
  ('Proteínas', 'proteinas', 1),
  ('Creatinas', 'creatinas', 2),
  ('Pre-entrenos', 'pre-entrenos', 3),
  ('Vitaminas', 'vitaminas', 4),
  ('Aminoácidos', 'aminoacidos', 5);

insert into public.products (category_id, name, brand, size, flavor, description, price, unit_cost, stock, fractionable, portion_size)
select c.id, p.name, p.brand, p.size, p.flavor, p.description, p.price, p.unit_cost, p.stock, p.fractionable, p.portion_size
from (values
  ('proteinas',    'Proteína Demo Whey 2 lb',      'MarcaPrueba', '2 lb',     'Chocolate', 'Proteína de suero ficticia para pruebas.', 899.00, 520.0000, 12, true,  '30 g'),
  ('proteinas',    'Proteína Demo Whey 5 lb',      'MarcaPrueba', '5 lb',     'Vainilla',  'Presentación grande de prueba.',           1799.00, 1100.0000, 6, false, null),
  ('proteinas',    'Proteína Vegetal Demo',        'VerdeTest',   '1 kg',     'Natural',   'Proteína de chícharo de prueba.',          749.00, 430.0000, 4, false, null),
  ('creatinas',    'Creatina Monohidratada Demo',  'MarcaPrueba', '300 g',    'Sin sabor', 'Creatina ficticia.',                       499.00, 260.0000, 20, true, '5 g'),
  ('creatinas',    'Creatina HCL Demo',            'FuerzaLab',   '120 caps', '',          'Cápsulas de prueba.',                      649.00, 350.0000, 8, false, null),
  ('pre-entrenos', 'Pre-entreno Explosivo Demo',   'FuerzaLab',   '30 serv',  'Frutos rojos', 'Pre-entreno de prueba.',                599.00, 310.0000, 10, false, null),
  ('pre-entrenos', 'Pre-entreno Sin Cafeína Demo', 'FuerzaLab',   '30 serv',  'Limón',     'Versión sin estimulantes.',                579.00, 300.0000, 0, false, null),
  ('vitaminas',    'Multivitamínico Demo',         'VitaTest',    '60 tabs',  '',          'Multivitamínico ficticio.',                299.00, 120.0000, 25, false, null),
  ('vitaminas',    'Omega 3 Demo',                 'VitaTest',    '90 softgels', '',       'Omega 3 de prueba.',                       349.00, 150.0000, 15, false, null),
  ('aminoacidos',  'BCAA Demo 2:1:1',              'MarcaPrueba', '250 g',    'Mango',     'Aminoácidos ramificados de prueba.',       459.00, 230.0000, 9, false, null),
  ('aminoacidos',  'Glutamina Demo',               'MarcaPrueba', '300 g',    'Sin sabor', 'Glutamina ficticia.',                      399.00, 190.0000, 3, false, null),
  ('aminoacidos',  'L-Carnitina Descontinuada Demo', 'VitaTest',  '60 caps',  '',          'Producto archivado para probar filtros.',  279.00, 140.0000, 0, false, null)
) as p(category_slug, name, brand, size, flavor, description, price, unit_cost, stock, fractionable, portion_size)
join public.categories c on c.slug = p.category_slug;

update public.products set active = false, archived_at = now()
where name = 'L-Carnitina Descontinuada Demo';

-- Bolsitas de los productos que se fraccionan (parent_product_id → el producto de origen).
insert into public.products (category_id, name, brand, size, flavor, price, unit_cost, stock, parent_product_id)
select parent.category_id, parent.name || ' (bolsita ' || parent.portion_size || ')', parent.brand,
  parent.portion_size, parent.flavor, b.price, b.unit_cost, b.stock, parent.id
from (values
  ('Proteína Demo Whey 2 lb', 45.00, 17.3333, 10),
  ('Creatina Monohidratada Demo', 15.00, 4.3333, 12)
) as b(parent_name, price, unit_cost, stock)
join public.products parent on parent.name = b.parent_name;

-- 3. Movimientos que respaldan el stock de bodega -------------------------------
-- Regla del repo: el stock nunca se escribe sin su movimiento. Cada producto con
-- stock arranca con un movimiento 'initial' (bodega: holder_profile_id = null).

insert into public.stock_movements (product_id, type, qty, reason, created_by, holder_profile_id)
select id, 'initial', stock, 'Inventario inicial (seed local)', 'a0000000-0000-4000-8000-000000000001', null
from public.products
where stock > 0;
