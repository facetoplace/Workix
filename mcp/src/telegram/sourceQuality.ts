import { db } from "../db.js";

export interface TelegramSourceQuality {
  source: string;
  searches: number;
  hits: number;
  errors: number;
  last_at?: string;
  last_query?: string;
  score: number;
}

export function listTelegramSourceQuality(): TelegramSourceQuality[] {
  return db().prepare("SELECT source, searches, hits, errors, last_at, last_query, score FROM source_quality WHERE source LIKE 'telegram:%' ORDER BY last_at ASC NULLS FIRST, score DESC").all() as unknown as TelegramSourceQuality[];
}

export function recordTelegramSourceQuality(input: { source: string; hits: number; errors: number; query: string; at?: string }): void {
  const at = input.at || new Date().toISOString();
  db().prepare(`
    INSERT INTO source_quality (source, searches, hits, errors, last_at, last_query, score)
    VALUES (?, 1, ?, ?, ?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET
      searches = source_quality.searches + 1,
      hits = source_quality.hits + excluded.hits,
      errors = source_quality.errors + excluded.errors,
      last_at = excluded.last_at,
      last_query = excluded.last_query,
      score = ((source_quality.hits + excluded.hits + 1.0) / (source_quality.searches + 2.0)) * CASE WHEN excluded.errors > 0 THEN 0.7 ELSE 1.0 END
  `).run(input.source, input.hits, input.errors, at, input.query || "(recent)", (input.hits + 1) / 2);
}
