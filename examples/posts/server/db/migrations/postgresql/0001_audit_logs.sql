CREATE TABLE "autoadmin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"model_key" text NOT NULL,
	"lookup_value" text,
	"actor_id" text,
	"actor_role" text,
	"actor_label" text,
	"changes" jsonb,
	"meta" jsonb
);
