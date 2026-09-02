-- Create core tables for D1
BEGIN TRANSACTION;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE problems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  difficulty TEXT,
  source TEXT,
  status TEXT,
  category_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE solutions (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL,
  body TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  is_official INTEGER DEFAULT 0
);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  category_id TEXT,
  status TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE contests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  year TEXT,
  type TEXT,
  description TEXT,
  status TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE formulas (
  id TEXT PRIMARY KEY,
  title TEXT,
  latex TEXT,
  description TEXT,
  created_at TEXT
);

CREATE TABLE problem_tags (
  problem_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (problem_id, tag_id)
);

CREATE TABLE problem_topics (
  problem_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  PRIMARY KEY (problem_id, topic_id)
);

CREATE INDEX idx_problems_title ON problems(title);
CREATE INDEX idx_problems_category ON problems(category_id);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_topics_name ON topics(name);

COMMIT;
