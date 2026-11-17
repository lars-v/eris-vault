CREATE TABLE "character_portraits" (
	"character_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_portraits" ADD CONSTRAINT "character_portraits_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;