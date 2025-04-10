
CREATE TABLE "assistant_training" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "command" text NOT NULL,
  "explanation" text NOT NULL,
  "learned" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Index pentru îmbunătățirea performanței căutării full text
CREATE INDEX idx_assistant_training_command ON "assistant_training" USING GIN (to_tsvector('romanian', command));

-- Funcție pentru căutare în baza de date de antrenare
CREATE OR REPLACE FUNCTION search_assistant_training(search_term text)
RETURNS SETOF assistant_training AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM assistant_training
  WHERE command ILIKE '%' || search_term || '%'
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funcție pentru adăugarea unei noi intrări de antrenare
CREATE OR REPLACE FUNCTION add_assistant_training(p_command text, p_explanation text)
RETURNS uuid AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO assistant_training (command, explanation, learned)
  VALUES (p_command, p_explanation, false)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitem acces public pentru acum (puteți adăuga politici RLS mai târziu)
ALTER TABLE "assistant_training" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for everyone" ON "assistant_training"
  FOR SELECT TO public USING (true);
  
CREATE POLICY "Allow insert for everyone" ON "assistant_training"
  FOR INSERT TO public WITH CHECK (true);
