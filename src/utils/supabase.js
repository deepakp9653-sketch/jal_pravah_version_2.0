// Neon PostgreSQL Adapter (Replacing deprecated Supabase client)
import { db, sql } from './neon';

// Export db as supabase for complete drop-in backwards compatibility
export const supabase = db;
export { db, sql };
export default db;
