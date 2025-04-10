
CREATE TABLE "assistant_training" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "command" text NOT NULL,
  "explanation" text NOT NULL,
  "learned" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Index to improve search performance
CREATE INDEX idx_assistant_training_command ON "assistant_training" USING GIN (to_tsvector('romanian', command));

-- Allow public access for now (you might want to add RLS policies later)
ALTER TABLE "assistant_training" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for everyone" ON "assistant_training"
  FOR SELECT TO public USING (true);
  
CREATE POLICY "Allow insert for everyone" ON "assistant_training"
  FOR INSERT TO public WITH CHECK (true);
