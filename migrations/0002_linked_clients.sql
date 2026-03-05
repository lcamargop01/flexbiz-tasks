-- Linked clients: allows one client login to see tasks/projects from multiple companies
-- primary_client_id = the client who logs in
-- linked_client_id = the additional company they can also see
CREATE TABLE IF NOT EXISTS linked_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  primary_client_id INTEGER NOT NULL,
  linked_client_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (primary_client_id) REFERENCES clients(id),
  FOREIGN KEY (linked_client_id) REFERENCES clients(id),
  UNIQUE(primary_client_id, linked_client_id)
);

CREATE INDEX IF NOT EXISTS idx_linked_clients_primary ON linked_clients(primary_client_id);
CREATE INDEX IF NOT EXISTS idx_linked_clients_linked ON linked_clients(linked_client_id);
