-- Esquema base heredado (foto del proyecto Supabase real, previo a T-03)
--
-- Las tablas de este proyecto (categories, products, profiles, stock_movements,
-- clients, …) vienen del proyecto Vue hermano y nunca tuvieron migración en este
-- repo: las migraciones siguientes solo son deltas sobre ellas. Este archivo existe
-- para que una base vacía (el Supabase local de Docker, `npm run db:reset`) pueda
-- reconstruir el esquema completo aplicando todas las migraciones en orden.
--
-- Se generó con `supabase db dump` contra el proyecto real (solo esquema, sin datos)
-- y se le quitó a mano lo que agregan las migraciones 20261025000000–000003
-- (columnas de fraccionado en products, vendor_stock, holder_profile_id, el índice
-- products_name_lower_key y fraction_out/fraction_in del check de tipos).
--
-- NO aplicar contra el proyecto real: ahí este esquema ya existe.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";


CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

-- `supabase db dump` no incluye event triggers. En el proyecto real este dispara
-- rls_auto_enable al crear cualquier tabla en public (por eso vendor_stock tiene RLS
-- sin que su migración lo active); se recrea aquí para que local se comporte igual.
CREATE EVENT TRIGGER "ensure_rls" ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    EXECUTE FUNCTION "public"."rls_auto_enable"();

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


ALTER TABLE "public"."categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "contact_name" "text",
    "phone" "text",
    "address" "text",
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


ALTER TABLE "public"."clients" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."clients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."consignment_items" (
    "id" bigint NOT NULL,
    "client_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "delivered_qty" integer DEFAULT 0 NOT NULL,
    "sold_qty" integer DEFAULT 0 NOT NULL,
    "returned_qty" integer DEFAULT 0 NOT NULL,
    "shrinkage_qty" integer DEFAULT 0 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "unit_cost" numeric(10,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "consignment_items_delivered_qty_check" CHECK (("delivered_qty" >= 0)),
    CONSTRAINT "consignment_items_returned_qty_check" CHECK (("returned_qty" >= 0)),
    CONSTRAINT "consignment_items_shrinkage_qty_check" CHECK (("shrinkage_qty" >= 0)),
    CONSTRAINT "consignment_items_sold_qty_check" CHECK (("sold_qty" >= 0)),
    CONSTRAINT "consignment_items_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric)),
    CONSTRAINT "consignment_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."consignment_items" OWNER TO "postgres";


ALTER TABLE "public"."consignment_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."consignment_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."credit_payments" (
    "id" bigint NOT NULL,
    "sale_id" bigint,
    "direct_sale_id" bigint,
    "amount" numeric(10,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "received_by" "uuid" NOT NULL,
    "paid_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "credit_payments_one_target" CHECK ((("sale_id" IS NULL) <> ("direct_sale_id" IS NULL))),
    CONSTRAINT "credit_payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'transfer'::"text"])))
);


ALTER TABLE "public"."credit_payments" OWNER TO "postgres";


ALTER TABLE "public"."credit_payments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."credit_payments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."cut_items" (
    "id" bigint NOT NULL,
    "cut_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "product_name" "text" NOT NULL,
    "qty" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "unit_cost" numeric(10,4) NOT NULL,
    "total_sold" numeric(10,2) NOT NULL,
    "restock_amount" numeric(10,2) NOT NULL,
    "profit" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cut_items_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."cut_items" OWNER TO "postgres";


ALTER TABLE "public"."cut_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."cut_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."cuts" (
    "id" bigint NOT NULL,
    "client_id" bigint NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "total_qty" integer NOT NULL,
    "total_sold" numeric(10,2) NOT NULL,
    "cash_total" numeric(10,2) NOT NULL,
    "transfer_total" numeric(10,2) NOT NULL,
    "restock_amount" numeric(10,2) NOT NULL,
    "profit" numeric(10,2) NOT NULL,
    "created_by" "uuid" NOT NULL,
    "paid_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cuts" OWNER TO "postgres";


ALTER TABLE "public"."cuts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."cuts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."debtors" (
    "id" bigint NOT NULL,
    "client_id" bigint,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."debtors" OWNER TO "postgres";


ALTER TABLE "public"."debtors" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."debtors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."direct_sale_items" (
    "id" bigint NOT NULL,
    "direct_sale_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "qty" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "unit_cost" numeric(10,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "direct_sale_items_qty_check" CHECK (("qty" > 0)),
    CONSTRAINT "direct_sale_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."direct_sale_items" OWNER TO "postgres";


ALTER TABLE "public"."direct_sale_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."direct_sale_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."direct_sales" (
    "id" bigint NOT NULL,
    "buyer_note" "text",
    "on_credit" boolean DEFAULT false NOT NULL,
    "debtor_id" bigint,
    "payment_status" "text" DEFAULT 'paid'::"text" NOT NULL,
    "payment_method" "text",
    "paid_at" timestamp with time zone,
    "uncollectible_at" timestamp with time zone,
    "uncollectible_by" "uuid",
    "sold_by" "uuid" NOT NULL,
    "sold_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "direct_sales_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'transfer'::"text"]))),
    CONSTRAINT "direct_sales_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'uncollectible'::"text"])))
);


ALTER TABLE "public"."direct_sales" OWNER TO "postgres";


ALTER TABLE "public"."direct_sales" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."direct_sales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" bigint NOT NULL,
    "category_id" bigint,
    "name" "text" NOT NULL,
    "brand" "text" DEFAULT ''::"text" NOT NULL,
    "size" "text" DEFAULT ''::"text" NOT NULL,
    "flavor" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "benefits" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "usage" "text" DEFAULT ''::"text" NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "unit_cost" numeric(10,4) DEFAULT 0 NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "products_stock_check" CHECK (("stock" >= 0)),
    CONSTRAINT "products_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


ALTER TABLE "public"."products" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "client_id" bigint,
    "full_name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_client_id_matches_role" CHECK ((("role" = 'client'::"text") = ("client_id" IS NOT NULL))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'client'::"text", 'vendedor'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" bigint NOT NULL,
    "consignment_item_id" bigint NOT NULL,
    "client_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "qty" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "unit_cost" numeric(10,4) NOT NULL,
    "on_credit" boolean DEFAULT false NOT NULL,
    "debtor_id" bigint,
    "payment_status" "text" DEFAULT 'paid'::"text" NOT NULL,
    "payment_method" "text",
    "paid_at" timestamp with time zone,
    "uncollectible_at" timestamp with time zone,
    "uncollectible_by" "uuid",
    "transferred_to_admin_at" timestamp with time zone,
    "sold_by" "uuid" NOT NULL,
    "sold_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cut_id" bigint,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'transfer'::"text"]))),
    CONSTRAINT "sales_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'uncollectible'::"text"]))),
    CONSTRAINT "sales_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


ALTER TABLE "public"."sales" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."sales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."shrinkage" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "consignment_item_id" bigint,
    "client_id" bigint,
    "qty" integer NOT NULL,
    "unit_cost" numeric(10,4) NOT NULL,
    "reason" "text" NOT NULL,
    "notes" "text",
    "reported_by" "uuid" NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shrinkage_item_and_client_together" CHECK ((("consignment_item_id" IS NULL) = ("client_id" IS NULL))),
    CONSTRAINT "shrinkage_qty_check" CHECK (("qty" > 0)),
    CONSTRAINT "shrinkage_reason_check" CHECK (("reason" = ANY (ARRAY['lost'::"text", 'damaged'::"text", 'expired'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."shrinkage" OWNER TO "postgres";


ALTER TABLE "public"."shrinkage" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."shrinkage_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "client_id" bigint,
    "type" "text" NOT NULL,
    "qty" integer NOT NULL,
    "unit_price" numeric(10,2),
    "reason" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_movements_qty_check" CHECK (("qty" <> 0)),
    CONSTRAINT "stock_movements_type_check" CHECK (("type" = ANY (ARRAY['initial'::"text", 'purchase'::"text", 'adjustment'::"text", 'delivery'::"text", 'return'::"text", 'direct_sale'::"text", 'direct_sale_void'::"text", 'shrinkage'::"text", 'shrinkage_void'::"text"])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


ALTER TABLE "public"."stock_movements" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stock_movements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");


ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");


ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_name_key" UNIQUE ("name");


ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."consignment_items"
    ADD CONSTRAINT "consignment_items_client_product_key" UNIQUE ("client_id", "product_id");


ALTER TABLE ONLY "public"."consignment_items"
    ADD CONSTRAINT "consignment_items_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."credit_payments"
    ADD CONSTRAINT "credit_payments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."cut_items"
    ADD CONSTRAINT "cut_items_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."cuts"
    ADD CONSTRAINT "cuts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."debtors"
    ADD CONSTRAINT "debtors_client_phone_key" UNIQUE NULLS NOT DISTINCT ("client_id", "phone");


ALTER TABLE ONLY "public"."debtors"
    ADD CONSTRAINT "debtors_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."direct_sale_items"
    ADD CONSTRAINT "direct_sale_items_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."direct_sales"
    ADD CONSTRAINT "direct_sales_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."shrinkage"
    ADD CONSTRAINT "shrinkage_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");


CREATE INDEX "consignment_items_client_id_idx" ON "public"."consignment_items" USING "btree" ("client_id");


CREATE INDEX "credit_payments_direct_sale_id_idx" ON "public"."credit_payments" USING "btree" ("direct_sale_id");


CREATE INDEX "credit_payments_sale_id_idx" ON "public"."credit_payments" USING "btree" ("sale_id");


CREATE INDEX "cut_items_cut_id_idx" ON "public"."cut_items" USING "btree" ("cut_id");


CREATE INDEX "cuts_client_period_end_idx" ON "public"."cuts" USING "btree" ("client_id", "period_end" DESC);


CREATE INDEX "debtors_client_name_idx" ON "public"."debtors" USING "btree" ("client_id", "name");


CREATE INDEX "direct_sale_items_direct_sale_id_idx" ON "public"."direct_sale_items" USING "btree" ("direct_sale_id");


CREATE INDEX "direct_sale_items_product_id_idx" ON "public"."direct_sale_items" USING "btree" ("product_id");


CREATE INDEX "direct_sales_debtor_id_idx" ON "public"."direct_sales" USING "btree" ("debtor_id");


CREATE INDEX "direct_sales_payment_status_idx" ON "public"."direct_sales" USING "btree" ("payment_status") WHERE ("voided_at" IS NULL);


CREATE INDEX "direct_sales_sold_at_idx" ON "public"."direct_sales" USING "btree" ("sold_at" DESC);


CREATE INDEX "products_active_idx" ON "public"."products" USING "btree" ("active") WHERE ("archived_at" IS NULL);


CREATE INDEX "products_category_id_idx" ON "public"."products" USING "btree" ("category_id");


CREATE INDEX "sales_client_pending_idx" ON "public"."sales" USING "btree" ("client_id", "payment_status") WHERE (("cut_id" IS NULL) AND ("voided_at" IS NULL));


CREATE INDEX "sales_cut_id_idx" ON "public"."sales" USING "btree" ("cut_id");


CREATE INDEX "sales_debtor_id_idx" ON "public"."sales" USING "btree" ("debtor_id");


CREATE INDEX "sales_sold_at_idx" ON "public"."sales" USING "btree" ("sold_at" DESC);


CREATE INDEX "shrinkage_client_created_idx" ON "public"."shrinkage" USING "btree" ("client_id", "created_at" DESC);


CREATE INDEX "shrinkage_product_id_idx" ON "public"."shrinkage" USING "btree" ("product_id");


CREATE INDEX "stock_movements_product_created_idx" ON "public"."stock_movements" USING "btree" ("product_id", "created_at" DESC);


ALTER TABLE ONLY "public"."consignment_items"
    ADD CONSTRAINT "consignment_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."consignment_items"
    ADD CONSTRAINT "consignment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."credit_payments"
    ADD CONSTRAINT "credit_payments_direct_sale_id_fkey" FOREIGN KEY ("direct_sale_id") REFERENCES "public"."direct_sales"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."credit_payments"
    ADD CONSTRAINT "credit_payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."credit_payments"
    ADD CONSTRAINT "credit_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."credit_payments"
    ADD CONSTRAINT "credit_payments_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."cut_items"
    ADD CONSTRAINT "cut_items_cut_id_fkey" FOREIGN KEY ("cut_id") REFERENCES "public"."cuts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."cut_items"
    ADD CONSTRAINT "cut_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."cuts"
    ADD CONSTRAINT "cuts_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."cuts"
    ADD CONSTRAINT "cuts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."cuts"
    ADD CONSTRAINT "cuts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."debtors"
    ADD CONSTRAINT "debtors_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."debtors"
    ADD CONSTRAINT "debtors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."direct_sale_items"
    ADD CONSTRAINT "direct_sale_items_direct_sale_id_fkey" FOREIGN KEY ("direct_sale_id") REFERENCES "public"."direct_sales"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."direct_sale_items"
    ADD CONSTRAINT "direct_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."direct_sales"
    ADD CONSTRAINT "direct_sales_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "public"."debtors"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."direct_sales"
    ADD CONSTRAINT "direct_sales_sold_by_fkey" FOREIGN KEY ("sold_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."direct_sales"
    ADD CONSTRAINT "direct_sales_uncollectible_by_fkey" FOREIGN KEY ("uncollectible_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."direct_sales"
    ADD CONSTRAINT "direct_sales_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_consignment_item_id_fkey" FOREIGN KEY ("consignment_item_id") REFERENCES "public"."consignment_items"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_cut_id_fkey" FOREIGN KEY ("cut_id") REFERENCES "public"."cuts"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "public"."debtors"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_sold_by_fkey" FOREIGN KEY ("sold_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_uncollectible_by_fkey" FOREIGN KEY ("uncollectible_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."shrinkage"
    ADD CONSTRAINT "shrinkage_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."shrinkage"
    ADD CONSTRAINT "shrinkage_consignment_item_id_fkey" FOREIGN KEY ("consignment_item_id") REFERENCES "public"."consignment_items"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."shrinkage"
    ADD CONSTRAINT "shrinkage_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."shrinkage"
    ADD CONSTRAINT "shrinkage_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."shrinkage"
    ADD CONSTRAINT "shrinkage_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consignment_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cut_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cuts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debtors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_sale_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shrinkage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";


GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";


GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."consignment_items" TO "anon";
GRANT ALL ON TABLE "public"."consignment_items" TO "authenticated";
GRANT ALL ON TABLE "public"."consignment_items" TO "service_role";


GRANT ALL ON SEQUENCE "public"."consignment_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."consignment_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."consignment_items_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."credit_payments" TO "anon";
GRANT ALL ON TABLE "public"."credit_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_payments" TO "service_role";


GRANT ALL ON SEQUENCE "public"."credit_payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."credit_payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credit_payments_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."cut_items" TO "anon";
GRANT ALL ON TABLE "public"."cut_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cut_items" TO "service_role";


GRANT ALL ON SEQUENCE "public"."cut_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cut_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cut_items_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."cuts" TO "anon";
GRANT ALL ON TABLE "public"."cuts" TO "authenticated";
GRANT ALL ON TABLE "public"."cuts" TO "service_role";


GRANT ALL ON SEQUENCE "public"."cuts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cuts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cuts_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."debtors" TO "anon";
GRANT ALL ON TABLE "public"."debtors" TO "authenticated";
GRANT ALL ON TABLE "public"."debtors" TO "service_role";


GRANT ALL ON SEQUENCE "public"."debtors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."debtors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."debtors_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."direct_sale_items" TO "anon";
GRANT ALL ON TABLE "public"."direct_sale_items" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_sale_items" TO "service_role";


GRANT ALL ON SEQUENCE "public"."direct_sale_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."direct_sale_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."direct_sale_items_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."direct_sales" TO "anon";
GRANT ALL ON TABLE "public"."direct_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_sales" TO "service_role";


GRANT ALL ON SEQUENCE "public"."direct_sales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."direct_sales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."direct_sales_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";


GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";


GRANT ALL ON SEQUENCE "public"."sales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sales_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."shrinkage" TO "anon";
GRANT ALL ON TABLE "public"."shrinkage" TO "authenticated";
GRANT ALL ON TABLE "public"."shrinkage" TO "service_role";


GRANT ALL ON SEQUENCE "public"."shrinkage_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shrinkage_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shrinkage_id_seq" TO "service_role";


GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";


GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


