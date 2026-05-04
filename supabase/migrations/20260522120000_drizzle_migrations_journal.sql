-- Drizzle Kit journal table (schema `drizzle`). Parity across Dev/Main for drizzle-kit.
-- Idempotent: safe if the table already exists; journal rows use ON CONFLICT DO UPDATE.
-- Hosted projects may show this migration under an auto timestamp in `schema_migrations`
-- (e.g. apply_migration); this file uses `20260522120000` as the repo ordering key.

CREATE SCHEMA IF NOT EXISTS drizzle;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'drizzle'
      AND c.relname = '__drizzle_migrations'
      AND c.relkind = 'r'
  ) THEN
    CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq AS integer;
    CREATE TABLE drizzle.__drizzle_migrations (
      id integer NOT NULL DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass),
      hash text NOT NULL,
      created_at bigint
    );
    ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;
    ALTER TABLE ONLY drizzle.__drizzle_migrations
      ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);
  END IF;
END $$;

INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at) VALUES
  (1, 'b9d8a615bd1eb223c5a85d770251b6806a668c8e79fa0392cb0f560ad9d44456', 1775462960626),
  (2, '295c06c354a142de327a21a08c8a2f4ef9c2e2ec6be1feabb71ff7dbd3becfb6', 1775552990342),
  (3, '54f34d15437a252fa130437ce173614e939a3d86511c847b52d55b444c4f96f8', 1775647279670),
  (4, 'd91161310b6e4e6a6febee7b1f4d75667608a12e9f2ace914962ebe2a96ef5ef', 1775666470835),
  (5, '875843647b4184b4dc9469b722832beda90a4032e3191a9754a917f515b8ea38', 1775718953769),
  (6, 'fd441fcc7a646a88952ffb333e87d975b6f311a6c1359814a601e45136d9525d', 1775722594694),
  (7, '33ef54cff155ab0c5f4dc453f7771fb3810bcdbcd65a36cbdb8b820815887b17', 1775800000000),
  (8, '4fe4227dd75c2b7f404867e64ca2a0f56bcec256bb2263c0bdd0b4508233c2a1', 1775800200000),
  (9, '480da1fc03a49290a866c6bbecb470a2af180f65d53eb1bc4b853862e5509c4a', 1775800300000),
  (10, '8a33b472ee3a52c50eeaf42a3ec12f54a8a4c59e43640337a94534f669d86f1f', 1775800400000),
  (11, '0769d41e3f927050a9bf78dfc09d178d528551d536b817942effdaa834519421', 1775987082371),
  (12, '10b74a4781dde353aee2a01d92a62c2820ed165c49c3d02b449d813afc980a24', 1775988000000),
  (13, 'd25de106da31d3d3101161651ec30d8caa325a72c039627b97c69bd0df00621b', 1775988100000)
ON CONFLICT (id) DO UPDATE SET
  hash = EXCLUDED.hash,
  created_at = EXCLUDED.created_at;

SELECT setval(
  'drizzle.__drizzle_migrations_id_seq',
  (SELECT COALESCE(MAX(id), 1) FROM drizzle.__drizzle_migrations),
  true
);
