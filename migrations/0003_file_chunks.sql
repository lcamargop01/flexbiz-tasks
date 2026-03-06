-- File chunks table for storing large files in D1
-- D1 has ~1MB row limit, so we split base64 file data into chunks
CREATE TABLE IF NOT EXISTS file_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attachment_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_chunks_attachment ON file_chunks(attachment_id, chunk_index);

-- Add storage_type column to attachments to track how data is stored
-- 'inline' = file_data column (legacy, small files)
-- 'chunked' = file_chunks table (large files)
ALTER TABLE attachments ADD COLUMN storage_type TEXT DEFAULT 'inline';
