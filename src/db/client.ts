import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = ReturnType<typeof createDbClient>;

/**
 * Initializes Drizzle ORM client with the D1 Database binding
 * and full typed relational schema
 */
export function createDbClient(d1: D1Database) {
  return drizzle(d1, { schema });
}
