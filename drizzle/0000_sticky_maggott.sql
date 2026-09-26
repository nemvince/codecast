CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"updated_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casts" (
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"slug" text NOT NULL,
	"stdin" text DEFAULT '' NOT NULL,
	"user_id" uuid NOT NULL,
	"version" text NOT NULL,
	CONSTRAINT "casts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"cast_id" uuid NOT NULL,
	"compile_exit_code" integer,
	"compile_signal" text,
	"compile_stderr" text DEFAULT '' NOT NULL,
	"compile_stdout" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer NOT NULL,
	"exit_code" integer,
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"signal" text,
	"stderr" text DEFAULT '' NOT NULL,
	"stdin" text DEFAULT '' NOT NULL,
	"stdout" text DEFAULT '' NOT NULL,
	"version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"impersonated_by" text,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"ban_expires" timestamp with time zone,
	"ban_reason" text,
	"banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casts" ADD CONSTRAINT "casts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_cast_id_casts_id_fk" FOREIGN KEY ("cast_id") REFERENCES "public"."casts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "casts_expiresAt_idx" ON "casts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "casts_userId_idx" ON "casts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "runs_castId_idx" ON "runs" USING btree ("cast_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");