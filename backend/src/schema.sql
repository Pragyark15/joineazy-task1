-- Idempotent schema; executed on every startup.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(10) NOT NULL CHECK (role IN ('student', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A student belongs to at most one group (UNIQUE user_id).
CREATE TABLE IF NOT EXISTS group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  due_date      TIMESTAMPTZ NOT NULL,
  onedrive_link TEXT NOT NULL,
  assign_to_all BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only used when assign_to_all = FALSE.
CREATE TABLE IF NOT EXISTS assignment_groups (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  group_id      INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, group_id)
);

-- One confirmation per (assignment, group); records which student confirmed.
CREATE TABLE IF NOT EXISTS submissions (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  group_id      INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  confirmed_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_group ON submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_assignment_groups_group ON assignment_groups(group_id);
