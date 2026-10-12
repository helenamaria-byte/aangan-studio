ALTER TABLE "calls" ADD COLUMN "assigned_designer_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calls" ADD CONSTRAINT "calls_assigned_designer_id_designers_id_fk" FOREIGN KEY ("assigned_designer_id") REFERENCES "public"."designers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
