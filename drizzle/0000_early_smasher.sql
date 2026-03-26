CREATE TYPE "public"."type" AS ENUM('renpy', 'rpgm', 'unity', 'unreal', 'flash', 'html', 'qsp', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('submission_status_changed', 'new_user_registered', 'submission_accepted', 'submission_rejected', 'api_error');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."submission_type" AS ENUM('game', 'translation', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."tname" AS ENUM('no_translation', 'integrated', 'translation', 'translation_with_mods');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."ttype" AS ENUM('auto', 'vf', 'manual', 'semi-auto', 'to_tested', 'hs');--> statement-breakpoint
CREATE TYPE "public"."website" AS ENUM('f95z', 'lc', 'other');--> statement-breakpoint
CREATE TABLE "api_log" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255),
	"method" varchar(16) NOT NULL,
	"route" varchar(255) NOT NULL,
	"status" integer NOT NULL,
	"ip_address" varchar(64),
	"payload" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" varchar(255) PRIMARY KEY DEFAULT 'main' NOT NULL,
	"app_name" varchar(255) DEFAULT 'F95 France' NOT NULL,
	"discord_webhook_updates" text,
	"discord_webhook_logs" text,
	"discord_webhook_translators" text,
	"discord_webhook_proofreaders" text,
	"google_spreadsheet_id" varchar(255),
	"google_api_key" text,
	"google_oauth_client_id" text,
	"google_oauth_client_secret" text,
	"google_oauth_access_token" text,
	"google_oauth_refresh_token" text,
	"google_oauth_token_expiry" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" varchar(255) NOT NULL,
	"tags" text NOT NULL,
	"type" "type" DEFAULT 'other' NOT NULL,
	"image" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"website" "website" DEFAULT 'f95z' NOT NULL,
	"thread_id" integer,
	"link" varchar(500) DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_translation" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"game_id" varchar(255) NOT NULL,
	"translation_name" varchar(255),
	"status" "status" NOT NULL,
	"version" varchar(100) NOT NULL,
	"tversion" varchar(100) NOT NULL,
	"tlink" text NOT NULL,
	"tname" "tname" DEFAULT 'no_translation' NOT NULL,
	"traductor_id" varchar(255),
	"proofreader_id" varchar(255),
	"ttype" "ttype" NOT NULL,
	"ac" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"link" varchar(500),
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"game_id" varchar(255),
	"translation_id" varchar(255),
	"type" "submission_type" NOT NULL,
	"data" text NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translator" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" varchar(255) NOT NULL,
	"user_id" varchar(255),
	"pages" text NOT NULL,
	"discord_id" varchar(255),
	"trad_count" integer DEFAULT 0 NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "translator_name_unique" UNIQUE("name"),
	CONSTRAINT "translator_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "update" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"game_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(32) NOT NULL,
	"avatar" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(255) DEFAULT 'user' NOT NULL,
	"theme" "theme" DEFAULT 'system',
	"direct_mode" boolean DEFAULT true NOT NULL,
	"dev_user_id" varchar(255),
	"game_add" integer DEFAULT 0 NOT NULL,
	"game_edit" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "api_log" ADD CONSTRAINT "api_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "game_translation" ADD CONSTRAINT "game_translation_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_translation_id_game_translation_id_fk" FOREIGN KEY ("translation_id") REFERENCES "public"."game_translation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translator" ADD CONSTRAINT "translator_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update" ADD CONSTRAINT "update_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE no action ON UPDATE no action;