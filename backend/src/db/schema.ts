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
	check("profiles_role_check", sql`role = ANY (ARRAY['admin'::text, 'client'::text, 'vendedor'::text])`),
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
}, (table) => [
	index("direct_sales_debtor_id_idx").using("btree", table.debtorId.asc().nullsLast().op("int8_ops")),
	index("direct_sales_payment_status_idx").using("btree", table.paymentStatus.asc().nullsLast().op("text_ops")).where(sql`(voided_at IS NULL)`),
	index("direct_sales_sold_at_idx").using("btree", table.soldAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.debtorId],
			foreignColumns: [debtors.id],
			name: "direct_sales_debtor_id_fkey"
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
	check("direct_sale_items_qty_check", sql`qty > 0`),
	check("direct_sale_items_unit_price_check", sql`unit_price >= (0)::numeric`),
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
}, (table) => [
	index("stock_movements_product_created_idx").using("btree", table.productId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
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
			columns: [table.holderProfileId],
			foreignColumns: [profiles.id],
			name: "stock_movements_holder_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_movements_product_id_fkey"
		}).onDelete("restrict"),
	check("stock_movements_qty_check", sql`qty <> 0`),
	check("stock_movements_type_check", sql`type = ANY (ARRAY['initial'::text, 'purchase'::text, 'adjustment'::text, 'delivery'::text, 'return'::text, 'direct_sale'::text, 'direct_sale_void'::text, 'shrinkage'::text, 'shrinkage_void'::text, 'fraction_out'::text, 'fraction_in'::text])`),
]);
