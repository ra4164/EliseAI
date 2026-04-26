import { pgEnum, pgTable, text, jsonb } from "drizzle-orm/pg-core";

export const leadStatusEnum = pgEnum("lead_status", [
  "pending",
  "enriching",
  "enriched",
  "failed",
]);

export const leadsTable = pgTable("leads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  propertyAddress: text("property_address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  status: leadStatusEnum("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  enrichment: jsonb("enrichment"),
  errorMessage: text("error_message"),
  batchId: text("batch_id"),
  batchLabel: text("batch_label"),
  notes: text("notes"),
  outreachSentAt: text("outreach_sent_at"),
  additionalContacts: jsonb("additional_contacts").notNull().default([]),
});

export type DbLead = typeof leadsTable.$inferSelect;
export type DbLeadInsert = typeof leadsTable.$inferInsert;
