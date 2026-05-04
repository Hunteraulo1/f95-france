CREATE TABLE "login_throttle" (
	"client_key" varchar(128) PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp DEFAULT now() NOT NULL,
	"locked_until" timestamp
);
