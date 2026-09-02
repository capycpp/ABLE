-- Seed data derived from original data/db.json
BEGIN TRANSACTION;

INSERT INTO problems (id, title, topic, difficulty, source, status, created_at) VALUES
('p1','Find all functions f : R → R satisfying a functional equation','Functional Equations','Olympiad','ABLE Sample','published', datetime('now')),
('p2','A divisibility problem with hidden valuation structure','Number Theory','Hard','ABLE Sample','published', datetime('now')),
('p3','The circle configuration that collapses under inversion','Geometry','Hard','ABLE Sample','published', datetime('now'));

INSERT INTO articles (id, title, excerpt, body, status, created_at) VALUES
('a1','Lambda Substitution','A recurring technique for functional equations on R+ and beyond.','Lambda substitution is one of the techniques ABLE wants students to recognise and reuse. This article is a starter note for the full handout.','published', datetime('now')),
('a2','Limits in Functional Equations','When a limit exists, turn it into information about the function.','Study continuity-like consequences, monotonicity, boundedness and carefully chosen substitutions.','published', datetime('now')),
('a3','How to Read an Olympiad Problem','A compact framework for extracting structure before calculating.','Identify the objects, the invariants, the quantifiers and the likely transformations before committing to a route.','published', datetime('now'));

INSERT INTO contests (id, title, year, type, description, status, created_at) VALUES
('c1','Balkan MO Training','2026','Training Set','A focused collection for Balkan-level preparation.','published', datetime('now')),
('c2','IMO Training Archive','2026','Archive','Curated IMO-style problems and solutions.','published', datetime('now'));

COMMIT;
