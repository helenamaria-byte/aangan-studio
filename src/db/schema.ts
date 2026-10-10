import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const designers = pgTable("designers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  calcomUserId: text("calcom_user_id"),
  active: boolean("active").notNull().default(true),
});

export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  vaaniCallId: text("vaani_call_id").notNull().unique(),
  // Input source. Only "phone" for now; "whatsapp" and "webform" are added later without a migration.
  channel: text("channel").notNull().default("phone"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSec: integer("duration_sec"),
  isAfterHours: boolean("is_after_hours").notNull().default(false),
  callerPhone: text("caller_phone"),
  // qualified_booked | qualified_no_booking | declined | complaint | dropped | spam_or_wrong_number
  outcome: text("outcome"),
  declineReason: text("decline_reason"),
  extractedFields: jsonb("extracted_fields"),
  summary: text("summary"),
  transcriptUrl: text("transcript_url"),
  recordingUrl: text("recording_url"),
  rawPayload: jsonb("raw_payload").notNull(),
  costVoiceInr: numeric("cost_voice_inr", { precision: 12, scale: 2 }).default("0"),
  costTelephonyInr: numeric("cost_telephony_inr", { precision: 12, scale: 2 }).default("0"),
  costLlmInr: numeric("cost_llm_inr", { precision: 12, scale: 2 }).default("0"),
  costEmailInr: numeric("cost_email_inr", { precision: 12, scale: 2 }).default("0"),
  costTotalInr: numeric("cost_total_inr", { precision: 12, scale: 2 }).default("0"),
  hubspotContactId: text("hubspot_contact_id"),
  hubspotDealId: text("hubspot_deal_id"),
  handoffSentAt: timestamp("handoff_sent_at", { withTimezone: true }),
  needsAttention: boolean("needs_attention").notNull().default(false),
  errorText: text("error_text"),
  // Set when a human has dealt with a complaint, callback, or failure shown on the dashboard.
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  calcomBookingId: text("calcom_booking_id").notNull().unique(),
  callId: integer("call_id").references(() => calls.id),
  designerId: integer("designer_id").references(() => designers.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  // Cal.com's webhook arrives during the call, before Vaani's end-of-call webhook, so the
  // booking is matched to its call later by this phone number.
  attendeePhone: text("attendee_phone"),
  attendeeName: text("attendee_name"),
  locationType: text("location_type"), // site | studio
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // booked | rescheduled | cancelled | completed
  status: text("status").notNull().default("booked"),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
