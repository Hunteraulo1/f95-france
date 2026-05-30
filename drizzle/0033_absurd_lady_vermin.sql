CREATE TABLE "update_history" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"update_id" varchar(255) NOT NULL,
	"user_id" varchar(255),
	"action" varchar(32) NOT NULL,
	"changes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "update_history" ADD CONSTRAINT "update_history_update_id_update_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."update"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "update_history" ADD CONSTRAINT "update_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;