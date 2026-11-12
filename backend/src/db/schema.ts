import { pgTable, pgSchema, unique, bigint, text, integer, timestamp, boolean, foreignKey, check, uuid, index, numeric, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

const authSchema = pgSchema("auth")
export const usersInAuth = authSchema.table("users", {
	id: uuid().primaryKey(),
})
const users = usersInAuth



export const categories = pgTable("categories", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "categories_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	name: text().notNull(),
	slug: text().notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("categories_name_key").on(table.name),
	unique("categories_slug_key").on(table.slug),
]);

export const clients = pgTable("clients", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "clients_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	name: text().notNull(),
	contactName: text("contact_name"),
	phone: text(),
	address: text(),
	notes: text(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("clients_name_key").on(table.name),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	role: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clientId: bigint("client_id", { mode: "number" }),
	fullName: text("full_name").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	phone: text(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "profiles_client_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	check("profiles_client_id_matches_role", sql`(role = 'client'::text) = (client_id IS NOT NULL)`),
	check("profiles_phone_format_check", sql`(phone IS NULL) OR (phone ~ '^[0-9]{10}$'::text)`),
	check("profiles_role_check", sql`role = ANY (ARRAY['admin'::text, 'client'::text, 'vendedor'::text])`),
	check("profiles_seller_phone_required_check", sql`(role <> 'vendedor'::text) OR (phone IS NOT NULL)`),
]);

export const sales = pgTable("sales", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "sales_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	consignmentItemId: bigint("consignment_item_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clientId: bigint("client_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	qty: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }).notNull(),
	onCredit: boolean("on_credit").default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	debtorId: bigint("debtor_id", { mode: "number" }),
	paymentStatus: text("payment_status").default('paid').notNull(),
	paymentMethod: text("payment_method"),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	uncollectibleAt: timestamp("uncollectible_at", { withTimezone: true, mode: 'string' }),
	uncollectibleBy: uuid("uncollectible_by"),
	transferredToAdminAt: timestamp("transferred_to_admin_at", { withTimezone: true, mode: 'string' }),
	soldBy: uuid("sold_by").notNull(),
	soldAt: timestamp("sold_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cutId: bigint("cut_id", { mode: "number" }),
	voidedAt: timestamp("voided_at", { withTimezone: true, mode: 'string' }),
	voidedBy: uuid("voided_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sales_client_pending_idx").using("btree", table.clientId.asc().nullsLast().op("int8_ops"), table.paymentStatus.asc().nullsLast().op("int8_ops")).where(sql`((cut_id IS NULL) AND (voided_at IS NULL))`),
	index("sales_cut_id_idx").using("btree", table.cutId.asc().nullsLast().op("int8_ops")),
	index("sales_debtor_id_idx").using("btree", table.debtorId.asc().nullsLast().op("int8_ops")),
	index("sales_sold_at_idx").using("btree", table.soldAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "sales_client_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.consignmentItemId],
			foreignColumns: [consignmentItems.id],
			name: "sales_consignment_item_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.cutId],
			foreignColumns: [cuts.id],
			name: "sales_cut_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.debtorId],
			foreignColumns: [debtors.id],
			name: "sales_debtor_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "sales_product_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.soldBy],
			foreignColumns: [profiles.id],
			name: "sales_sold_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.uncollectibleBy],
			foreignColumns: [profiles.id],
			name: "sales_uncollectible_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.voidedBy],
			foreignColumns: [profiles.id],
			name: "sales_voided_by_fkey"
		}).onDelete("restrict"),
	check("sales_payment_method_check", sql`payment_method = ANY (ARRAY['cash'::text, 'transfer'::text])`),
	check("sales_payment_status_check", sql`payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'uncollectible'::text])`),
	check("sales_qty_check", sql`qty > 0`),
]);

export const directSaleItems = pgTable("direct_sale_items", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "direct_sale_items_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	directSaleId: bigint("direct_sale_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	qty: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	factoryUnitCost: numeric("factory_unit_cost", { precision: 10, scale:  4 }).notNull(),
}, (table) => [
	index("direct_sale_items_direct_sale_id_idx").using("btree", table.directSaleId.asc().nullsLast().op("int8_ops")),
	index("direct_sale_items_product_id_idx").using("btree", table.productId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.directSaleId],
			foreignColumns: [directSales.id],
			name: "direct_sale_items_direct_sale_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "direct_sale_items_product_id_fkey"
		}).onDelete("restrict"),
	unique("direct_sale_items_sale_product_key").on(table.directSaleId, table.productId),
	check("direct_sale_items_factory_unit_cost_check", sql`factory_unit_cost >= (0)::numeric`),
	check("direct_sale_items_qty_check", sql`qty > 0`),
	check("direct_sale_items_unit_price_check", sql`unit_price >= (0)::numeric`),
]);

export const directSales = pgTable("direct_sales", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "direct_sales_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	buyerNote: text("buyer_note"),
	onCredit: boolean("on_credit").default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	debtorId: bigint("debtor_id", { mode: "number" }),
	paymentStatus: text("payment_status").default('paid').notNull(),
	paymentMethod: text("payment_method"),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	uncollectibleAt: timestamp("uncollectible_at", { withTimezone: true, mode: 'string' }),
	uncollectibleBy: uuid("uncollectible_by"),
	soldBy: uuid("sold_by").notNull(),
	soldAt: timestamp("sold_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	voidedAt: timestamp("voided_at", { withTimezone: true, mode: 'string' }),
	voidedBy: uuid("voided_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	holderProfileId: uuid("holder_profile_id"),
	requestId: uuid("request_id"),
}, (table) => [
	index("direct_sales_debtor_id_idx").using("btree", table.debtorId.asc().nullsLast().op("int8_ops")),
	index("direct_sales_holder_sold_at_idx").using("btree", table.holderProfileId.asc().nullsLast().op("uuid_ops"), table.soldAt.desc().nullsFirst().op("uuid_ops")),
	index("direct_sales_payment_status_idx").using("btree", table.paymentStatus.asc().nullsLast().op("text_ops")).where(sql`(voided_at IS NULL)`),
	uniqueIndex("direct_sales_request_id_key").using("btree", table.requestId.asc().nullsLast().op("uuid_ops")).where(sql`(request_id IS NOT NULL)`),
	index("direct_sales_sold_at_idx").using("btree", table.soldAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.debtorId],
			foreignColumns: [debtors.id],
			name: "direct_sales_debtor_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.holderProfileId],
			foreignColumns: [profiles.id],
			name: "direct_sales_holder_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.soldBy],
			foreignColumns: [profiles.id],
			name: "direct_sales_sold_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.uncollectibleBy],
			foreignColumns: [profiles.id],
			name: "direct_sales_uncollectible_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.voidedBy],
			foreignColumns: [profiles.id],
			name: "direct_sales_voided_by_fkey"
		}).onDelete("restrict"),
	check("direct_sales_payment_method_check", sql`payment_method = ANY (ARRAY['cash'::text, 'transfer'::text])`),
	check("direct_sales_payment_status_check", sql`payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'uncollectible'::text])`),
]);

export const debtors = pgTable("debtors", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "debtors_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clientId: bigint("client_id", { mode: "number" }),
	name: text().notNull(),
	phone: text().notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("debtors_client_name_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "debtors_client_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "debtors_created_by_fkey"
		}).onDelete("restrict"),
	unique("debtors_client_phone_key").on(table.clientId, table.phone),
]);

export const cuts = pgTable("cuts", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "cuts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clientId: bigint("client_id", { mode: "number" }).notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	totalQty: integer("total_qty").notNull(),
	totalSold: numeric("total_sold", { precision: 10, scale:  2 }).notNull(),
	cashTotal: numeric("cash_total", { precision: 10, scale:  2 }).notNull(),
	transferTotal: numeric("transfer_total", { precision: 10, scale:  2 }).notNull(),
	restockAmount: numeric("restock_amount", { precision: 10, scale:  2 }).notNull(),
	profit: numeric({ precision: 10, scale:  2 }).notNull(),
	createdBy: uuid("created_by").notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	cancelledBy: uuid("cancelled_by"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cuts_client_period_end_idx").using("btree", table.clientId.asc().nullsLast().op("int8_ops"), table.periodEnd.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.cancelledBy],
			foreignColumns: [profiles.id],
			name: "cuts_cancelled_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "cuts_client_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "cuts_created_by_fkey"
		}).onDelete("restrict"),
]);

export const cutItems = pgTable("cut_items", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "cut_items_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cutId: bigint("cut_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	productName: text("product_name").notNull(),
	qty: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }).notNull(),
	totalSold: numeric("total_sold", { precision: 10, scale:  2 }).notNull(),
	restockAmount: numeric("restock_amount", { precision: 10, scale:  2 }).notNull(),
	profit: numeric({ precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cut_items_cut_id_idx").using("btree", table.cutId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.cutId],
			foreignColumns: [cuts.id],
			name: "cut_items_cut_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "cut_items_product_id_fkey"
		}).onDelete("restrict"),
	check("cut_items_qty_check", sql`qty > 0`),
]);

export const creditPayments = pgTable("credit_payments", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "credit_payments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	saleId: bigint("sale_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	directSaleId: bigint("direct_sale_id", { mode: "number" }),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	paymentMethod: text("payment_method").notNull(),
	receivedBy: uuid("received_by").notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	voidedAt: timestamp("voided_at", { withTimezone: true, mode: 'string' }),
	voidedBy: uuid("voided_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("credit_payments_direct_sale_id_idx").using("btree", table.directSaleId.asc().nullsLast().op("int8_ops")),
	index("credit_payments_sale_id_idx").using("btree", table.saleId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.directSaleId],
			foreignColumns: [directSales.id],
			name: "credit_payments_direct_sale_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.receivedBy],
			foreignColumns: [profiles.id],
			name: "credit_payments_received_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.saleId],
			foreignColumns: [sales.id],
			name: "credit_payments_sale_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.voidedBy],
			foreignColumns: [profiles.id],
			name: "credit_payments_voided_by_fkey"
		}).onDelete("restrict"),
	check("credit_payments_amount_check", sql`amount > (0)::numeric`),
	check("credit_payments_one_target", sql`(sale_id IS NULL) <> (direct_sale_id IS NULL)`),
	check("credit_payments_payment_method_check", sql`payment_method = ANY (ARRAY['cash'::text, 'transfer'::text])`),
]);

export const shrinkage = pgTable("shrinkage", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "shrinkage_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	consignmentItemId: bigint("consignment_item_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clientId: bigint("client_id", { mode: "number" }),
	qty: integer().notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }).notNull(),
	reason: text().notNull(),
	notes: text(),
	reportedBy: uuid("reported_by").notNull(),
	voidedAt: timestamp("voided_at", { withTimezone: true, mode: 'string' }),
	voidedBy: uuid("voided_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("shrinkage_client_created_idx").using("btree", table.clientId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	index("shrinkage_product_id_idx").using("btree", table.productId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "shrinkage_client_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.consignmentItemId],
			foreignColumns: [consignmentItems.id],
			name: "shrinkage_consignment_item_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "shrinkage_product_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.reportedBy],
			foreignColumns: [profiles.id],
			name: "shrinkage_reported_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.voidedBy],
			foreignColumns: [profiles.id],
			name: "shrinkage_voided_by_fkey"
		}).onDelete("restrict"),
	check("shrinkage_item_and_client_together", sql`(consignment_item_id IS NULL) = (client_id IS NULL)`),
	check("shrinkage_qty_check", sql`qty > 0`),
	check("shrinkage_reason_check", sql`reason = ANY (ARRAY['lost'::text, 'damaged'::text, 'expired'::text, 'other'::text])`),
]);

export const products = pgTable("products", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "products_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	categoryId: bigint("category_id", { mode: "number" }),
	name: text().notNull(),
	brand: text().default('').notNull(),
	size: text().default('').notNull(),
	flavor: text().default('').notNull(),
	description: text().default('').notNull(),
	benefits: text().array().default([""]).notNull(),
	usage: text().default('').notNull(),
	image: text().default('').notNull(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }).default('0').notNull(),
	stock: integer().default(0).notNull(),
	active: boolean().default(true).notNull(),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	fractionable: boolean().default(false).notNull(),
	portionSize: text("portion_size"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	parentProductId: bigint("parent_product_id", { mode: "number" }),
}, (table) => [
	index("products_active_idx").using("btree", table.active.asc().nullsLast().op("bool_ops")).where(sql`(archived_at IS NULL)`),
	index("products_category_id_idx").using("btree", table.categoryId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("products_name_lower_key").using("btree", sql`lower(TRIM(BOTH FROM name))`),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "products_category_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.parentProductId],
			foreignColumns: [table.id],
			name: "products_parent_product_id_fkey"
		}).onDelete("restrict"),
	unique("products_parent_product_id_key").on(table.parentProductId),
	check("products_parent_not_self", sql`(parent_product_id IS NULL) OR (parent_product_id <> id)`),
	check("products_price_check", sql`price >= (0)::numeric`),
	check("products_stock_check", sql`stock >= 0`),
	check("products_unit_cost_check", sql`unit_cost >= (0)::numeric`),
]);

export const fractions = pgTable("fractions", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "fractions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	requestId: uuid("request_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	portionProductId: bigint("portion_product_id", { mode: "number" }).notNull(),
	portions: integer().notNull(),
	wholeUnitCost: numeric("whole_unit_cost", { precision: 10, scale:  4 }).notNull(),
	portionUnitCost: numeric("portion_unit_cost", { precision: 10, scale:  4 }).notNull(),
	portionPrice: numeric("portion_price", { precision: 10, scale:  2 }).notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fractions_product_created_at_idx").using("btree", table.productId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "fractions_created_by_fkey"
		}),
	foreignKey({
			columns: [table.portionProductId],
			foreignColumns: [products.id],
			name: "fractions_portion_product_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "fractions_product_id_fkey"
		}).onDelete("restrict"),
	unique("fractions_request_id_key").on(table.requestId),
	check("fractions_distinct_products", sql`product_id <> portion_product_id`),
	check("fractions_portion_price_check", sql`portion_price > (0)::numeric`),
	check("fractions_portion_unit_cost_check", sql`portion_unit_cost > (0)::numeric`),
	check("fractions_portions_check", sql`(portions >= 2) AND (portions <= 1000)`),
]);

export const consignmentItems = pgTable("consignment_items", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "consignment_items_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clientId: bigint("client_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	deliveredQty: integer("delivered_qty").default(0).notNull(),
	soldQty: integer("sold_qty").default(0).notNull(),
	returnedQty: integer("returned_qty").default(0).notNull(),
	shrinkageQty: integer("shrinkage_qty").default(0).notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("consignment_items_client_id_idx").using("btree", table.clientId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "consignment_items_client_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "consignment_items_product_id_fkey"
		}).onDelete("restrict"),
	unique("consignment_items_client_product_key").on(table.clientId, table.productId),
	check("consignment_items_delivered_qty_check", sql`delivered_qty >= 0`),
	check("consignment_items_returned_qty_check", sql`returned_qty >= 0`),
	check("consignment_items_shrinkage_qty_check", sql`shrinkage_qty >= 0`),
	check("consignment_items_sold_qty_check", sql`sold_qty >= 0`),
	check("consignment_items_unit_cost_check", sql`unit_cost >= (0)::numeric`),
	check("consignment_items_unit_price_check", sql`unit_price >= (0)::numeric`),
]);

export const vendorStock = pgTable("vendor_stock", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "vendor_stock_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	profileId: uuid("profile_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	qty: integer().default(0).notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }),
	unitCostWithShipping: numeric("unit_cost_with_shipping", { precision: 10, scale:  4 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "vendor_stock_product_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "vendor_stock_profile_id_fkey"
		}).onDelete("restrict"),
	unique("vendor_stock_profile_product_key").on(table.profileId, table.productId),
	check("vendor_stock_qty_check", sql`qty >= 0`),
	check("vendor_stock_unit_cost_with_shipping_check", sql`(unit_cost_with_shipping IS NULL) OR (unit_cost_with_shipping > (0)::numeric)`),
	check("vendor_stock_unit_price_check", sql`(unit_price IS NULL) OR (unit_price > (0)::numeric)`),
]);

export const stockMovements = pgTable("stock_movements", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "stock_movements_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clientId: bigint("client_id", { mode: "number" }),
	type: text().notNull(),
	qty: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }),
	reason: text(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	holderProfileId: uuid("holder_profile_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	directSaleId: bigint("direct_sale_id", { mode: "number" }),
	requestId: uuid("request_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fractionId: bigint("fraction_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	receiptLineId: bigint("receipt_line_id", { mode: "number" }),
}, (table) => [
	uniqueIndex("stock_movements_direct_sale_product_key").using("btree", table.directSaleId.asc().nullsLast().op("int8_ops"), table.productId.asc().nullsLast().op("int8_ops")).where(sql`(type = 'direct_sale'::text)`),
	index("stock_movements_product_created_idx").using("btree", table.productId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
	uniqueIndex("stock_movements_receipt_line_key").using("btree", table.receiptLineId.asc().nullsLast().op("int8_ops")).where(sql`(receipt_line_id IS NOT NULL)`),
	uniqueIndex("stock_movements_request_holder_key").using("btree", table.requestId.asc().nullsLast().op("uuid_ops"), table.holderProfileId.asc().nullsLast().op("uuid_ops")).where(sql`(request_id IS NOT NULL)`),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "stock_movements_client_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "stock_movements_created_by_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.directSaleId],
			foreignColumns: [directSales.id],
			name: "stock_movements_direct_sale_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.fractionId],
			foreignColumns: [fractions.id],
			name: "stock_movements_fraction_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.holderProfileId],
			foreignColumns: [profiles.id],
			name: "stock_movements_holder_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_movements_product_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.receiptLineId],
			foreignColumns: [supplierReceiptLines.id],
			name: "stock_movements_receipt_line_id_fkey"
		}).onDelete("restrict"),
	check("stock_movements_direct_sale_type_check", sql`(direct_sale_id IS NULL) OR (type = ANY (ARRAY['direct_sale'::text, 'direct_sale_void'::text]))`),
	check("stock_movements_fraction_type_check", sql`(fraction_id IS NULL) OR (type = ANY (ARRAY['fraction_out'::text, 'fraction_in'::text]))`),
	check("stock_movements_qty_check", sql`qty <> 0`),
	check("stock_movements_qty_sign_check", sql`CHECK (
CASE
    WHEN (type = ANY (ARRAY['initial'::text, 'purchase'::text])) THEN ((holder_profile_id IS NULL) AND (qty > 0))
    WHEN (type = 'delivery'::text) THEN (((holder_profile_id IS NULL) AND (qty < 0)) OR ((holder_profile_id IS NOT NULL) AND (qty > 0)))
    WHEN (type = 'return'::text) THEN (((holder_profile_id IS NULL) AND (qty > 0)) OR ((holder_profile_id IS NOT NULL) AND (qty < 0)))
    WHEN (type = ANY (ARRAY['direct_sale'::text, 'shrinkage'::text, 'fraction_out'::text])) THEN (qty < 0)
    WHEN (type = ANY (ARRAY['direct_sale_void'::text, 'shrinkage_void'::text, 'fraction_in'::text])) THEN (qty > 0)
    WHEN (type = 'adjustment'::text) THEN (qty <> 0)
    ELSE false
END)`),
	check("stock_movements_receipt_line_type_check", sql`(receipt_line_id IS NULL) OR (type = 'purchase'::text)`),
	check("stock_movements_shrinkage_reason_check", sql`(type <> 'shrinkage'::text) OR (reason IS NULL) OR (reason = ANY (ARRAY['lost'::text, 'damaged'::text, 'expired'::text, 'other'::text]))`),
	check("stock_movements_type_check", sql`type = ANY (ARRAY['initial'::text, 'purchase'::text, 'adjustment'::text, 'delivery'::text, 'return'::text, 'direct_sale'::text, 'direct_sale_void'::text, 'shrinkage'::text, 'shrinkage_void'::text, 'fraction_out'::text, 'fraction_in'::text])`),
]);

export const restockOrders = pgTable("restock_orders", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "restock_orders_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	requestId: uuid("request_id").notNull(),
	status: text().default('draft').notNull(),
	note: text(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	closedAt: timestamp("closed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("restock_orders_created_at_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "restock_orders_created_by_fkey"
		}),
	unique("restock_orders_request_id_key").on(table.requestId),
	check("restock_orders_closed_at_check", sql`(status = 'closed'::text) = (closed_at IS NOT NULL)`),
	check("restock_orders_note_check", sql`(note IS NULL) OR ((char_length(note) >= 1) AND (char_length(note) <= 500))`),
	check("restock_orders_status_check", sql`status = ANY (ARRAY['draft'::text, 'closed'::text])`),
]);

export const supplierReceiptLines = pgTable("supplier_receipt_lines", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "supplier_receipt_lines_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	receiptId: bigint("receipt_id", { mode: "number" }).notNull(),
	position: integer().notNull(),
	readName: text("read_name").notNull(),
	qty: integer().notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }),
	status: text().notNull(),
	costStatus: text("cost_status"),
	previousUnitCost: numeric("previous_unit_cost", { precision: 10, scale:  4 }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	resolvedBy: uuid("resolved_by"),
}, (table) => [
	index("supplier_receipt_lines_pending_idx").using("btree", table.receiptId.asc().nullsLast().op("int8_ops")).where(sql`((status = 'pending'::text) OR (cost_status = 'pending'::text))`),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "supplier_receipt_lines_product_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.receiptId],
			foreignColumns: [supplierReceipts.id],
			name: "supplier_receipt_lines_receipt_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "supplier_receipt_lines_resolved_by_fkey"
		}),
	unique("supplier_receipt_lines_position_key").on(table.receiptId, table.position),
	check("supplier_receipt_lines_cost_status_check", sql`(cost_status IS NULL) OR ((cost_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])) AND (status = 'received'::text) AND (unit_cost IS NOT NULL) AND (previous_unit_cost IS NOT NULL))`),
	check("supplier_receipt_lines_position_check", sql`"position" > 0`),
	check("supplier_receipt_lines_product_check", sql`(status = ANY (ARRAY['received'::text, 'created'::text])) = (product_id IS NOT NULL)`),
	check("supplier_receipt_lines_qty_check", sql`qty > 0`),
	check("supplier_receipt_lines_read_name_check", sql`(char_length(read_name) >= 1) AND (char_length(read_name) <= 200)`),
	check("supplier_receipt_lines_status_check", sql`status = ANY (ARRAY['received'::text, 'pending'::text, 'created'::text, 'discarded'::text])`),
	check("supplier_receipt_lines_unit_cost_check", sql`(unit_cost IS NULL) OR (unit_cost >= (0)::numeric)`),
]);

export const restockOrderLines = pgTable("restock_order_lines", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "restock_order_lines_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orderId: bigint("order_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }),
	qty: integer().notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }),
	customName: text("custom_name"),
}, (table) => [
	uniqueIndex("restock_order_lines_custom_key").using("btree", sql`order_id`, sql`lower(custom_name)`).where(sql`(custom_name IS NOT NULL)`),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [restockOrders.id],
			name: "restock_order_lines_order_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "restock_order_lines_product_id_fkey"
		}).onDelete("restrict"),
	unique("restock_order_lines_product_key").on(table.orderId, table.productId),
	check("restock_order_lines_custom_name_check", sql`(custom_name IS NULL) OR ((char_length(custom_name) >= 1) AND (char_length(custom_name) <= 120))`),
	check("restock_order_lines_kind_check", sql`((product_id IS NOT NULL) AND (custom_name IS NULL) AND (unit_cost IS NOT NULL)) OR ((product_id IS NULL) AND (custom_name IS NOT NULL))`),
	check("restock_order_lines_qty_check", sql`qty > 0`),
	check("restock_order_lines_unit_cost_check", sql`unit_cost >= (0)::numeric`),
]);

export const supplierReceipts = pgTable("supplier_receipts", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "supplier_receipts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	requestId: uuid("request_id").notNull(),
	source: text().notNull(),
	fileName: text("file_name"),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("supplier_receipts_created_at_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "supplier_receipts_created_by_fkey"
		}),
	unique("supplier_receipts_request_id_key").on(table.requestId),
	check("supplier_receipts_file_name_check", sql`(file_name IS NULL) OR ((char_length(file_name) >= 1) AND (char_length(file_name) <= 255))`),
	check("supplier_receipts_source_check", sql`source = ANY (ARRAY['excel'::text, 'pdf'::text, 'image'::text])`),
]);

export const supplierProductAliases = pgTable("supplier_product_aliases", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "supplier_product_aliases_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	normalizedName: text("normalized_name").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	productId: bigint("product_id", { mode: "number" }).notNull(),
	updatedBy: uuid("updated_by").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "supplier_product_aliases_product_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "supplier_product_aliases_updated_by_fkey"
		}),
	unique("supplier_product_aliases_name_key").on(table.normalizedName),
	check("supplier_product_aliases_normalized_name_check", sql`(char_length(normalized_name) >= 1) AND (char_length(normalized_name) <= 200)`),
]);
