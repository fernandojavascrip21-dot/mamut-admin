-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_key" UNIQUE("name"),
	CONSTRAINT "categories_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clients" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"address" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_name_key" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"client_id" bigint,
	"full_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone" text,
	CONSTRAINT "profiles_client_id_matches_role" CHECK ((role = 'client'::text) = (client_id IS NOT NULL)),
	CONSTRAINT "profiles_phone_format_check" CHECK ((phone IS NULL) OR (phone ~ '^[0-9]{10}$'::text)),
	CONSTRAINT "profiles_role_check" CHECK (role = ANY (ARRAY['admin'::text, 'client'::text, 'vendedor'::text])),
	CONSTRAINT "profiles_seller_phone_required_check" CHECK ((role <> 'vendedor'::text) OR (phone IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sales" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"consignment_item_id" bigint NOT NULL,
	"client_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 4) NOT NULL,
	"on_credit" boolean DEFAULT false NOT NULL,
	"debtor_id" bigint,
	"payment_status" text DEFAULT 'paid' NOT NULL,
	"payment_method" text,
	"paid_at" timestamp with time zone,
	"uncollectible_at" timestamp with time zone,
	"uncollectible_by" uuid,
	"transferred_to_admin_at" timestamp with time zone,
	"sold_by" uuid NOT NULL,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cut_id" bigint,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_payment_method_check" CHECK (payment_method = ANY (ARRAY['cash'::text, 'transfer'::text])),
	CONSTRAINT "sales_payment_status_check" CHECK (payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'uncollectible'::text])),
	CONSTRAINT "sales_qty_check" CHECK (qty > 0)
);
--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "direct_sale_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "direct_sale_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"direct_sale_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"factory_unit_cost" numeric(10, 4) NOT NULL,
	CONSTRAINT "direct_sale_items_sale_product_key" UNIQUE("direct_sale_id","product_id"),
	CONSTRAINT "direct_sale_items_factory_unit_cost_check" CHECK (factory_unit_cost >= (0)::numeric),
	CONSTRAINT "direct_sale_items_qty_check" CHECK (qty > 0),
	CONSTRAINT "direct_sale_items_unit_price_check" CHECK (unit_price >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "direct_sale_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "direct_sales" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "direct_sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"buyer_note" text,
	"on_credit" boolean DEFAULT false NOT NULL,
	"debtor_id" bigint,
	"payment_status" text DEFAULT 'paid' NOT NULL,
	"payment_method" text,
	"paid_at" timestamp with time zone,
	"uncollectible_at" timestamp with time zone,
	"uncollectible_by" uuid,
	"sold_by" uuid NOT NULL,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"holder_profile_id" uuid,
	"request_id" uuid,
	CONSTRAINT "direct_sales_payment_method_check" CHECK (payment_method = ANY (ARRAY['cash'::text, 'transfer'::text])),
	CONSTRAINT "direct_sales_payment_status_check" CHECK (payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'uncollectible'::text]))
);
--> statement-breakpoint
ALTER TABLE "direct_sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "debtors" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "debtors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"client_id" bigint,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debtors_client_phone_key" UNIQUE("client_id","phone")
);
--> statement-breakpoint
ALTER TABLE "debtors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cuts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cuts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"client_id" bigint NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"total_qty" integer NOT NULL,
	"total_sold" numeric(10, 2) NOT NULL,
	"cash_total" numeric(10, 2) NOT NULL,
	"transfer_total" numeric(10, 2) NOT NULL,
	"restock_amount" numeric(10, 2) NOT NULL,
	"profit" numeric(10, 2) NOT NULL,
	"created_by" uuid NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cut_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cut_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cut_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"product_name" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 4) NOT NULL,
	"total_sold" numeric(10, 2) NOT NULL,
	"restock_amount" numeric(10, 2) NOT NULL,
	"profit" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cut_items_qty_check" CHECK (qty > 0)
);
--> statement-breakpoint
ALTER TABLE "cut_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_payments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sale_id" bigint,
	"direct_sale_id" bigint,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"received_by" uuid NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_payments_amount_check" CHECK (amount > (0)::numeric),
	CONSTRAINT "credit_payments_one_target" CHECK ((sale_id IS NULL) <> (direct_sale_id IS NULL)),
	CONSTRAINT "credit_payments_payment_method_check" CHECK (payment_method = ANY (ARRAY['cash'::text, 'transfer'::text]))
);
--> statement-breakpoint
ALTER TABLE "credit_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shrinkage" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shrinkage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"product_id" bigint NOT NULL,
	"consignment_item_id" bigint,
	"client_id" bigint,
	"qty" integer NOT NULL,
	"unit_cost" numeric(10, 4) NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"reported_by" uuid NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shrinkage_item_and_client_together" CHECK ((consignment_item_id IS NULL) = (client_id IS NULL)),
	CONSTRAINT "shrinkage_qty_check" CHECK (qty > 0),
	CONSTRAINT "shrinkage_reason_check" CHECK (reason = ANY (ARRAY['lost'::text, 'damaged'::text, 'expired'::text, 'other'::text]))
);
--> statement-breakpoint
ALTER TABLE "shrinkage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"category_id" bigint,
	"name" text NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"flavor" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"benefits" text[] DEFAULT '{""}' NOT NULL,
	"usage" text DEFAULT '' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 4) DEFAULT '0' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fractionable" boolean DEFAULT false NOT NULL,
	"portion_size" text,
	"parent_product_id" bigint,
	CONSTRAINT "products_parent_product_id_key" UNIQUE("parent_product_id"),
	CONSTRAINT "products_parent_not_self" CHECK ((parent_product_id IS NULL) OR (parent_product_id <> id)),
	CONSTRAINT "products_price_check" CHECK (price >= (0)::numeric),
	CONSTRAINT "products_stock_check" CHECK (stock >= 0),
	CONSTRAINT "products_unit_cost_check" CHECK (unit_cost >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fractions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fractions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"request_id" uuid NOT NULL,
	"product_id" bigint NOT NULL,
	"portion_product_id" bigint NOT NULL,
	"portions" integer NOT NULL,
	"whole_unit_cost" numeric(10, 4) NOT NULL,
	"portion_unit_cost" numeric(10, 4) NOT NULL,
	"portion_price" numeric(10, 2) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fractions_request_id_key" UNIQUE("request_id"),
	CONSTRAINT "fractions_distinct_products" CHECK (product_id <> portion_product_id),
	CONSTRAINT "fractions_portion_price_check" CHECK (portion_price > (0)::numeric),
	CONSTRAINT "fractions_portion_unit_cost_check" CHECK (portion_unit_cost > (0)::numeric),
	CONSTRAINT "fractions_portions_check" CHECK ((portions >= 2) AND (portions <= 1000))
);
--> statement-breakpoint
ALTER TABLE "fractions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consignment_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consignment_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"client_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"delivered_qty" integer DEFAULT 0 NOT NULL,
	"sold_qty" integer DEFAULT 0 NOT NULL,
	"returned_qty" integer DEFAULT 0 NOT NULL,
	"shrinkage_qty" integer DEFAULT 0 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consignment_items_client_product_key" UNIQUE("client_id","product_id"),
	CONSTRAINT "consignment_items_delivered_qty_check" CHECK (delivered_qty >= 0),
	CONSTRAINT "consignment_items_returned_qty_check" CHECK (returned_qty >= 0),
	CONSTRAINT "consignment_items_shrinkage_qty_check" CHECK (shrinkage_qty >= 0),
	CONSTRAINT "consignment_items_sold_qty_check" CHECK (sold_qty >= 0),
	CONSTRAINT "consignment_items_unit_cost_check" CHECK (unit_cost >= (0)::numeric),
	CONSTRAINT "consignment_items_unit_price_check" CHECK (unit_price >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "consignment_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_stock" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_stock_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"profile_id" uuid NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"unit_price" numeric(10, 2),
	"unit_cost_with_shipping" numeric(10, 4),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_stock_profile_product_key" UNIQUE("profile_id","product_id"),
	CONSTRAINT "vendor_stock_qty_check" CHECK (qty >= 0),
	CONSTRAINT "vendor_stock_unit_cost_with_shipping_check" CHECK ((unit_cost_with_shipping IS NULL) OR (unit_cost_with_shipping > (0)::numeric)),
	CONSTRAINT "vendor_stock_unit_price_check" CHECK ((unit_price IS NULL) OR (unit_price > (0)::numeric))
);
--> statement-breakpoint
ALTER TABLE "vendor_stock" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"product_id" bigint NOT NULL,
	"client_id" bigint,
	"type" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" numeric(10, 2),
	"reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"holder_profile_id" uuid,
	"direct_sale_id" bigint,
	"request_id" uuid,
	"fraction_id" bigint,
	CONSTRAINT "stock_movements_direct_sale_type_check" CHECK ((direct_sale_id IS NULL) OR (type = ANY (ARRAY['direct_sale'::text, 'direct_sale_void'::text]))),
	CONSTRAINT "stock_movements_fraction_type_check" CHECK ((fraction_id IS NULL) OR (type = ANY (ARRAY['fraction_out'::text, 'fraction_in'::text]))),
	CONSTRAINT "stock_movements_qty_check" CHECK (qty <> 0),
	CONSTRAINT "stock_movements_qty_sign_check" CHECK (CHECK (
CASE
    WHEN (type = ANY (ARRAY['initial'::text, 'purchase'::text])) THEN ((holder_profile_id IS NULL) AND (qty > 0))
    WHEN (type = 'delivery'::text) THEN (((holder_profile_id IS NULL) AND (qty < 0)) OR ((holder_profile_id IS NOT NULL) AND (qty > 0)))
    WHEN (type = 'return'::text) THEN (((holder_profile_id IS NULL) AND (qty > 0)) OR ((holder_profile_id IS NOT NULL) AND (qty < 0)))
    WHEN (type = ANY (ARRAY['direct_sale'::text, 'shrinkage'::text, 'fraction_out'::text])) THEN (qty < 0)
    WHEN (type = ANY (ARRAY['direct_sale_void'::text, 'shrinkage_void'::text, 'fraction_in'::text])) THEN (qty > 0)
    WHEN (type = 'adjustment'::text) THEN (qty <> 0)
    ELSE false
END)),
	CONSTRAINT "stock_movements_shrinkage_reason_check" CHECK ((type <> 'shrinkage'::text) OR (reason IS NULL) OR (reason = ANY (ARRAY['lost'::text, 'damaged'::text, 'expired'::text, 'other'::text]))),
	CONSTRAINT "stock_movements_type_check" CHECK (type = ANY (ARRAY['initial'::text, 'purchase'::text, 'adjustment'::text, 'delivery'::text, 'return'::text, 'direct_sale'::text, 'direct_sale_void'::text, 'shrinkage'::text, 'shrinkage_void'::text, 'fraction_out'::text, 'fraction_in'::text]))
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "restock_orders" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "restock_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"request_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "restock_orders_request_id_key" UNIQUE("request_id"),
	CONSTRAINT "restock_orders_closed_at_check" CHECK ((status = 'closed'::text) = (closed_at IS NOT NULL)),
	CONSTRAINT "restock_orders_note_check" CHECK ((note IS NULL) OR ((char_length(note) >= 1) AND (char_length(note) <= 500))),
	CONSTRAINT "restock_orders_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'closed'::text]))
);
--> statement-breakpoint
ALTER TABLE "restock_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "restock_order_lines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "restock_order_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"order_id" bigint NOT NULL,
	"product_id" bigint,
	"qty" integer NOT NULL,
	"unit_cost" numeric(10, 4),
	"custom_name" text,
	CONSTRAINT "restock_order_lines_product_key" UNIQUE("order_id","product_id"),
	CONSTRAINT "restock_order_lines_custom_name_check" CHECK ((custom_name IS NULL) OR ((char_length(custom_name) >= 1) AND (char_length(custom_name) <= 120))),
	CONSTRAINT "restock_order_lines_kind_check" CHECK (((product_id IS NOT NULL) AND (custom_name IS NULL) AND (unit_cost IS NOT NULL)) OR ((product_id IS NULL) AND (custom_name IS NOT NULL))),
	CONSTRAINT "restock_order_lines_qty_check" CHECK (qty > 0),
	CONSTRAINT "restock_order_lines_unit_cost_check" CHECK (unit_cost >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "restock_order_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_consignment_item_id_fkey" FOREIGN KEY ("consignment_item_id") REFERENCES "public"."consignment_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cut_id_fkey" FOREIGN KEY ("cut_id") REFERENCES "public"."cuts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "public"."debtors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sold_by_fkey" FOREIGN KEY ("sold_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_uncollectible_by_fkey" FOREIGN KEY ("uncollectible_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_sale_items" ADD CONSTRAINT "direct_sale_items_direct_sale_id_fkey" FOREIGN KEY ("direct_sale_id") REFERENCES "public"."direct_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_sale_items" ADD CONSTRAINT "direct_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_sales" ADD CONSTRAINT "direct_sales_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "public"."debtors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_sales" ADD CONSTRAINT "direct_sales_holder_profile_id_fkey" FOREIGN KEY ("holder_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_sales" ADD CONSTRAINT "direct_sales_sold_by_fkey" FOREIGN KEY ("sold_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_sales" ADD CONSTRAINT "direct_sales_uncollectible_by_fkey" FOREIGN KEY ("uncollectible_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_sales" ADD CONSTRAINT "direct_sales_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtors" ADD CONSTRAINT "debtors_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtors" ADD CONSTRAINT "debtors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuts" ADD CONSTRAINT "cuts_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuts" ADD CONSTRAINT "cuts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuts" ADD CONSTRAINT "cuts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cut_items" ADD CONSTRAINT "cut_items_cut_id_fkey" FOREIGN KEY ("cut_id") REFERENCES "public"."cuts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cut_items" ADD CONSTRAINT "cut_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_direct_sale_id_fkey" FOREIGN KEY ("direct_sale_id") REFERENCES "public"."direct_sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shrinkage" ADD CONSTRAINT "shrinkage_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shrinkage" ADD CONSTRAINT "shrinkage_consignment_item_id_fkey" FOREIGN KEY ("consignment_item_id") REFERENCES "public"."consignment_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shrinkage" ADD CONSTRAINT "shrinkage_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shrinkage" ADD CONSTRAINT "shrinkage_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shrinkage" ADD CONSTRAINT "shrinkage_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_parent_product_id_fkey" FOREIGN KEY ("parent_product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fractions" ADD CONSTRAINT "fractions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fractions" ADD CONSTRAINT "fractions_portion_product_id_fkey" FOREIGN KEY ("portion_product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fractions" ADD CONSTRAINT "fractions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignment_items" ADD CONSTRAINT "consignment_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignment_items" ADD CONSTRAINT "consignment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_stock" ADD CONSTRAINT "vendor_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_stock" ADD CONSTRAINT "vendor_stock_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_direct_sale_id_fkey" FOREIGN KEY ("direct_sale_id") REFERENCES "public"."direct_sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fraction_id_fkey" FOREIGN KEY ("fraction_id") REFERENCES "public"."fractions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_holder_profile_id_fkey" FOREIGN KEY ("holder_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_orders" ADD CONSTRAINT "restock_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_order_lines" ADD CONSTRAINT "restock_order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."restock_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_order_lines" ADD CONSTRAINT "restock_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_client_pending_idx" ON "sales" USING btree ("client_id" int8_ops,"payment_status" int8_ops) WHERE ((cut_id IS NULL) AND (voided_at IS NULL));--> statement-breakpoint
CREATE INDEX "sales_cut_id_idx" ON "sales" USING btree ("cut_id" int8_ops);--> statement-breakpoint
CREATE INDEX "sales_debtor_id_idx" ON "sales" USING btree ("debtor_id" int8_ops);--> statement-breakpoint
CREATE INDEX "sales_sold_at_idx" ON "sales" USING btree ("sold_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "direct_sale_items_direct_sale_id_idx" ON "direct_sale_items" USING btree ("direct_sale_id" int8_ops);--> statement-breakpoint
CREATE INDEX "direct_sale_items_product_id_idx" ON "direct_sale_items" USING btree ("product_id" int8_ops);--> statement-breakpoint
CREATE INDEX "direct_sales_debtor_id_idx" ON "direct_sales" USING btree ("debtor_id" int8_ops);--> statement-breakpoint
CREATE INDEX "direct_sales_holder_sold_at_idx" ON "direct_sales" USING btree ("holder_profile_id" uuid_ops,"sold_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "direct_sales_payment_status_idx" ON "direct_sales" USING btree ("payment_status" text_ops) WHERE (voided_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "direct_sales_request_id_key" ON "direct_sales" USING btree ("request_id" uuid_ops) WHERE (request_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "direct_sales_sold_at_idx" ON "direct_sales" USING btree ("sold_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "debtors_client_name_idx" ON "debtors" USING btree ("client_id" text_ops,"name" int8_ops);--> statement-breakpoint
CREATE INDEX "cuts_client_period_end_idx" ON "cuts" USING btree ("client_id" int8_ops,"period_end" int8_ops);--> statement-breakpoint
CREATE INDEX "cut_items_cut_id_idx" ON "cut_items" USING btree ("cut_id" int8_ops);--> statement-breakpoint
CREATE INDEX "credit_payments_direct_sale_id_idx" ON "credit_payments" USING btree ("direct_sale_id" int8_ops);--> statement-breakpoint
CREATE INDEX "credit_payments_sale_id_idx" ON "credit_payments" USING btree ("sale_id" int8_ops);--> statement-breakpoint
CREATE INDEX "shrinkage_client_created_idx" ON "shrinkage" USING btree ("client_id" int8_ops,"created_at" int8_ops);--> statement-breakpoint
CREATE INDEX "shrinkage_product_id_idx" ON "shrinkage" USING btree ("product_id" int8_ops);--> statement-breakpoint
CREATE INDEX "products_active_idx" ON "products" USING btree ("active" bool_ops) WHERE (archived_at IS NULL);--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "products_name_lower_key" ON "products" USING btree (lower(TRIM(BOTH FROM name)) text_ops);--> statement-breakpoint
CREATE INDEX "fractions_product_created_at_idx" ON "fractions" USING btree ("product_id" int8_ops,"created_at" int8_ops);--> statement-breakpoint
CREATE INDEX "consignment_items_client_id_idx" ON "consignment_items" USING btree ("client_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_direct_sale_product_key" ON "stock_movements" USING btree ("direct_sale_id" int8_ops,"product_id" int8_ops) WHERE (type = 'direct_sale'::text);--> statement-breakpoint
CREATE INDEX "stock_movements_product_created_idx" ON "stock_movements" USING btree ("product_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_request_holder_key" ON "stock_movements" USING btree ("request_id" uuid_ops,"holder_profile_id" uuid_ops) WHERE (request_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "restock_orders_created_at_idx" ON "restock_orders" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "restock_order_lines_custom_key" ON "restock_order_lines" USING btree (order_id int8_ops,lower(custom_name) text_ops) WHERE (custom_name IS NOT NULL);
*/