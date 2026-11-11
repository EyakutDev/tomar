CREATE TABLE IF NOT EXISTS passages (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 80 AND 1600),
  book_title VARCHAR(160) NOT NULL,
  author VARCHAR(120) NOT NULL,
  translator VARCHAR(120),
  source_url TEXT,
  curated BOOLEAN NOT NULL DEFAULT false,
  contributor_name VARCHAR(60) NOT NULL DEFAULT 'Okur',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ
);

ALTER TABLE passages ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE passages ADD COLUMN IF NOT EXISTS curated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE passages DROP CONSTRAINT IF EXISTS passages_text_check;
ALTER TABLE passages ADD CONSTRAINT passages_text_check CHECK (char_length(text) BETWEEN 80 AND 1600);

CREATE INDEX IF NOT EXISTS passages_public_feed_idx
  ON passages (id DESC) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  passage_id BIGINT NOT NULL REFERENCES passages(id),
  reason VARCHAR(32) NOT NULL CHECK (reason IN ('copyright', 'spam', 'incorrect_source', 'other')),
  details VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reports_open_idx
  ON reports (created_at DESC) WHERE resolved_at IS NULL;
