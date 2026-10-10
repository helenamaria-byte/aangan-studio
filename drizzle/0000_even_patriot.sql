CREATE TABLE IF NOT EXISTS "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"calcom_booking_id" text NOT NULL,
	"call_id" integer,
	"designer_id" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	CONSTRAINT "bookings_calcom_booking_id_unique" UNIQUE("calcom_booking_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"vaani_call_id" text NOT NULL,
	"channel" text DEFAULT 'phone' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_sec" integer,
	"is_after_hours" boolean DEFAULT false NOT NULL,
	"caller_phone" text,
	"outcome" text,
	"decline_reason" text,
	"extracted_fields" jsonb,
	"summary" text,
	"transcript_url" text,
	"recording_url" text,
	"raw_payload" jsonb NOT NULL,
	"cost_voice_inr" numeric(12, 2) DEFAULT '0',
	"cost_telephony_inr" numeric(12, 2) DEFAULT '0',
	"cost_llm_inr" numeric(12, 2) DEFAULT '0',
	"cost_email_inr" numeric(12, 2) DEFAULT '0',
	"cost_total_inr" numeric(12, 2) DEFAULT '0',
	"hubspot_contact_id" text,
	"hubspot_deal_id" text,
	"handoff_sent_at" timestamp with time zone,
	"needs_attention" boolean DEFAULT false NOT NULL,
	"error_text" text,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calls_vaani_call_id_unique" UNIQUE("vaani_call_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "designers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"calcom_user_id" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_designer_id_designers_id_fk" FOREIGN KEY ("designer_id") REFERENCES "public"."designers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
