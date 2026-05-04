ALTER TABLE "api_key" ADD COLUMN "owner_user_id" varchar(255);
--> statement-breakpoint
UPDATE "api_key"
SET
    "owner_user_id" = "created_by_user_id"
WHERE
    "owner_user_id" IS NULL
    AND "created_by_user_id" IS NOT NULL;
--> statement-breakpoint
DELETE FROM "api_key" WHERE "owner_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "api_key" ALTER COLUMN "owner_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;
