import { relations } from "drizzle-orm/relations";
import { clients, profiles, usersInAuth, consignmentItems, products, debtors, directSales, cuts, sales, cutItems, directSaleItems, creditPayments, shrinkage, categories, vendorStock, stockMovements } from "./schema";

export const profilesRelations = relations(profiles, ({one, many}) => ({
	client: one(clients, {
		fields: [profiles.clientId],
		references: [clients.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
	debtors: many(debtors),
	directSales_soldBy: many(directSales, {
		relationName: "directSales_soldBy_profiles_id"
	}),
	directSales_uncollectibleBy: many(directSales, {
		relationName: "directSales_uncollectibleBy_profiles_id"
	}),
	directSales_voidedBy: many(directSales, {
		relationName: "directSales_voidedBy_profiles_id"
	}),
	cuts_cancelledBy: many(cuts, {
		relationName: "cuts_cancelledBy_profiles_id"
	}),
	cuts_createdBy: many(cuts, {
		relationName: "cuts_createdBy_profiles_id"
	}),
	sales_soldBy: many(sales, {
		relationName: "sales_soldBy_profiles_id"
	}),
	sales_uncollectibleBy: many(sales, {
		relationName: "sales_uncollectibleBy_profiles_id"
	}),
	sales_voidedBy: many(sales, {
		relationName: "sales_voidedBy_profiles_id"
	}),
	creditPayments_receivedBy: many(creditPayments, {
		relationName: "creditPayments_receivedBy_profiles_id"
	}),
	creditPayments_voidedBy: many(creditPayments, {
		relationName: "creditPayments_voidedBy_profiles_id"
	}),
	shrinkages_reportedBy: many(shrinkage, {
		relationName: "shrinkage_reportedBy_profiles_id"
	}),
	shrinkages_voidedBy: many(shrinkage, {
		relationName: "shrinkage_voidedBy_profiles_id"
	}),
	vendorStocks: many(vendorStock),
	stockMovements_createdBy: many(stockMovements, {
		relationName: "stockMovements_createdBy_profiles_id"
	}),
	stockMovements_holderProfileId: many(stockMovements, {
		relationName: "stockMovements_holderProfileId_profiles_id"
	}),
}));

export const clientsRelations = relations(clients, ({many}) => ({
	profiles: many(profiles),
	consignmentItems: many(consignmentItems),
	debtors: many(debtors),
	cuts: many(cuts),
	sales: many(sales),
	shrinkages: many(shrinkage),
	stockMovements: many(stockMovements),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profiles),
}));

export const consignmentItemsRelations = relations(consignmentItems, ({one, many}) => ({
	client: one(clients, {
		fields: [consignmentItems.clientId],
		references: [clients.id]
	}),
	product: one(products, {
		fields: [consignmentItems.productId],
		references: [products.id]
	}),
	sales: many(sales),
	shrinkages: many(shrinkage),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	consignmentItems: many(consignmentItems),
	sales: many(sales),
	cutItems: many(cutItems),
	directSaleItems: many(directSaleItems),
	shrinkages: many(shrinkage),
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id]
	}),
	product: one(products, {
		fields: [products.parentProductId],
		references: [products.id],
		relationName: "products_parentProductId_products_id"
	}),
	products: many(products, {
		relationName: "products_parentProductId_products_id"
	}),
	vendorStocks: many(vendorStock),
	stockMovements: many(stockMovements),
}));

export const debtorsRelations = relations(debtors, ({one, many}) => ({
	client: one(clients, {
		fields: [debtors.clientId],
		references: [clients.id]
	}),
	profile: one(profiles, {
		fields: [debtors.createdBy],
		references: [profiles.id]
	}),
	directSales: many(directSales),
	sales: many(sales),
}));

export const directSalesRelations = relations(directSales, ({one, many}) => ({
	debtor: one(debtors, {
		fields: [directSales.debtorId],
		references: [debtors.id]
	}),
	profile_soldBy: one(profiles, {
		fields: [directSales.soldBy],
		references: [profiles.id],
		relationName: "directSales_soldBy_profiles_id"
	}),
	profile_uncollectibleBy: one(profiles, {
		fields: [directSales.uncollectibleBy],
		references: [profiles.id],
		relationName: "directSales_uncollectibleBy_profiles_id"
	}),
	profile_voidedBy: one(profiles, {
		fields: [directSales.voidedBy],
		references: [profiles.id],
		relationName: "directSales_voidedBy_profiles_id"
	}),
	directSaleItems: many(directSaleItems),
	creditPayments: many(creditPayments),
}));

export const cutsRelations = relations(cuts, ({one, many}) => ({
	profile_cancelledBy: one(profiles, {
		fields: [cuts.cancelledBy],
		references: [profiles.id],
		relationName: "cuts_cancelledBy_profiles_id"
	}),
	client: one(clients, {
		fields: [cuts.clientId],
		references: [clients.id]
	}),
	profile_createdBy: one(profiles, {
		fields: [cuts.createdBy],
		references: [profiles.id],
		relationName: "cuts_createdBy_profiles_id"
	}),
	sales: many(sales),
	cutItems: many(cutItems),
}));

export const salesRelations = relations(sales, ({one, many}) => ({
	client: one(clients, {
		fields: [sales.clientId],
		references: [clients.id]
	}),
	consignmentItem: one(consignmentItems, {
		fields: [sales.consignmentItemId],
		references: [consignmentItems.id]
	}),
	cut: one(cuts, {
		fields: [sales.cutId],
		references: [cuts.id]
	}),
	debtor: one(debtors, {
		fields: [sales.debtorId],
		references: [debtors.id]
	}),
	product: one(products, {
		fields: [sales.productId],
		references: [products.id]
	}),
	profile_soldBy: one(profiles, {
		fields: [sales.soldBy],
		references: [profiles.id],
		relationName: "sales_soldBy_profiles_id"
	}),
	profile_uncollectibleBy: one(profiles, {
		fields: [sales.uncollectibleBy],
		references: [profiles.id],
		relationName: "sales_uncollectibleBy_profiles_id"
	}),
	profile_voidedBy: one(profiles, {
		fields: [sales.voidedBy],
		references: [profiles.id],
		relationName: "sales_voidedBy_profiles_id"
	}),
	creditPayments: many(creditPayments),
}));

export const cutItemsRelations = relations(cutItems, ({one}) => ({
	cut: one(cuts, {
		fields: [cutItems.cutId],
		references: [cuts.id]
	}),
	product: one(products, {
		fields: [cutItems.productId],
		references: [products.id]
	}),
}));

export const directSaleItemsRelations = relations(directSaleItems, ({one}) => ({
	directSale: one(directSales, {
		fields: [directSaleItems.directSaleId],
		references: [directSales.id]
	}),
	product: one(products, {
		fields: [directSaleItems.productId],
		references: [products.id]
	}),
}));

export const creditPaymentsRelations = relations(creditPayments, ({one}) => ({
	directSale: one(directSales, {
		fields: [creditPayments.directSaleId],
		references: [directSales.id]
	}),
	profile_receivedBy: one(profiles, {
		fields: [creditPayments.receivedBy],
		references: [profiles.id],
		relationName: "creditPayments_receivedBy_profiles_id"
	}),
	sale: one(sales, {
		fields: [creditPayments.saleId],
		references: [sales.id]
	}),
	profile_voidedBy: one(profiles, {
		fields: [creditPayments.voidedBy],
		references: [profiles.id],
		relationName: "creditPayments_voidedBy_profiles_id"
	}),
}));

export const shrinkageRelations = relations(shrinkage, ({one}) => ({
	client: one(clients, {
		fields: [shrinkage.clientId],
		references: [clients.id]
	}),
	consignmentItem: one(consignmentItems, {
		fields: [shrinkage.consignmentItemId],
		references: [consignmentItems.id]
	}),
	product: one(products, {
		fields: [shrinkage.productId],
		references: [products.id]
	}),
	profile_reportedBy: one(profiles, {
		fields: [shrinkage.reportedBy],
		references: [profiles.id],
		relationName: "shrinkage_reportedBy_profiles_id"
	}),
	profile_voidedBy: one(profiles, {
		fields: [shrinkage.voidedBy],
		references: [profiles.id],
		relationName: "shrinkage_voidedBy_profiles_id"
	}),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	products: many(products),
}));

export const vendorStockRelations = relations(vendorStock, ({one}) => ({
	product: one(products, {
		fields: [vendorStock.productId],
		references: [products.id]
	}),
	profile: one(profiles, {
		fields: [vendorStock.profileId],
		references: [profiles.id]
	}),
}));

export const stockMovementsRelations = relations(stockMovements, ({one}) => ({
	client: one(clients, {
		fields: [stockMovements.clientId],
		references: [clients.id]
	}),
	profile_createdBy: one(profiles, {
		fields: [stockMovements.createdBy],
		references: [profiles.id],
		relationName: "stockMovements_createdBy_profiles_id"
	}),
	profile_holderProfileId: one(profiles, {
		fields: [stockMovements.holderProfileId],
		references: [profiles.id],
		relationName: "stockMovements_holderProfileId_profiles_id"
	}),
	product: one(products, {
		fields: [stockMovements.productId],
		references: [products.id]
	}),
}));