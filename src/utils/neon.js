import { neon } from '@neondatabase/serverless';

// Neon Serverless PostgreSQL Database Connection
const NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_2JeCvOQAk4bI@ep-broad-bar-ar67f79z-pooler.c-4.us-west-2.aws.neon.tech/neondb?sslmode=require';

export const sql = neon(NEON_DATABASE_URL, {
  disableWarningInBrowsers: true,
});

/**
 * Lightweight, fully compatible query builder over Neon Serverless Driver.
 * Provides drop-in compatibility for .from().select().eq().order().single().insert().update().delete()
 */
class NeonQueryBuilder {
  constructor(table) {
    this.table = table;
    this.operation = 'select';
    this.selectFields = '*';
    this.wheres = [];
    this.orders = [];
    this.limitCount = null;
    this.isSingle = false;
    this.insertPayload = null;
    this.updatePayload = null;
  }

  select(fields = '*') {
    this.operation = 'select';
    this.selectFields = fields;
    return this;
  }

  eq(col, val) {
    this.wheres.push({ col, val });
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.orders.push({ col, direction: ascending ? 'ASC' : 'DESC' });
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  insert(rows) {
    this.operation = 'insert';
    this.insertPayload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(values) {
    this.operation = 'update';
    this.updatePayload = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  async execute() {
    try {
      const params = [];
      let paramIdx = 1;

      if (this.operation === 'select') {
        let query = `SELECT ${this.selectFields} FROM ${this.table}`;
        
        if (this.wheres.length > 0) {
          const whereClauses = this.wheres.map(w => {
            params.push(w.val);
            return `"${w.col}" = $${paramIdx++}`;
          });
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        if (this.orders.length > 0) {
          const orderClauses = this.orders.map(o => `"${o.col}" ${o.direction}`);
          query += ` ORDER BY ${orderClauses.join(', ')}`;
        }

        if (this.limitCount) {
          query += ` LIMIT ${this.limitCount}`;
        }

        const rows = await sql.query(query, params);
        const data = this.isSingle ? (rows[0] || null) : rows;
        return { data, error: null };
      }

      if (this.operation === 'insert') {
        if (!this.insertPayload || this.insertPayload.length === 0) {
          return { data: [], error: null };
        }

        const columns = Object.keys(this.insertPayload[0]);
        const valueTuples = [];

        for (const row of this.insertPayload) {
          const rowPlaceholders = [];
          for (const col of columns) {
            params.push(row[col]);
            rowPlaceholders.push(`$${paramIdx++}`);
          }
          valueTuples.push(`(${rowPlaceholders.join(', ')})`);
        }

        const query = `INSERT INTO ${this.table} (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${valueTuples.join(', ')} RETURNING *`;
        const rows = await sql.query(query, params);
        return { data: rows, error: null };
      }

      if (this.operation === 'update') {
        const updateCols = Object.keys(this.updatePayload);
        const setClauses = updateCols.map(col => {
          params.push(this.updatePayload[col]);
          return `"${col}" = $${paramIdx++}`;
        });

        let query = `UPDATE ${this.table} SET ${setClauses.join(', ')}`;

        if (this.wheres.length > 0) {
          const whereClauses = this.wheres.map(w => {
            params.push(w.val);
            return `"${w.col}" = $${paramIdx++}`;
          });
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        query += ` RETURNING *`;
        const rows = await sql.query(query, params);
        return { data: rows, error: null };
      }

      if (this.operation === 'delete') {
        let query = `DELETE FROM ${this.table}`;

        if (this.wheres.length > 0) {
          const whereClauses = this.wheres.map(w => {
            params.push(w.val);
            return `"${w.col}" = $${paramIdx++}`;
          });
          query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        query += ` RETURNING *`;
        const rows = await sql.query(query, params);
        return { data: rows, error: null };
      }

      return { data: null, error: new Error(`Unsupported operation: ${this.operation}`) };
    } catch (err) {
      console.error(`[Neon DB Error] on ${this.table} (${this.operation}):`, err);
      return { data: null, error: err };
    }
  }

  // Makes this builder thenable so callers can `await supabase.from(...).select(...)`
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }
}

export const db = {
  from: (table) => new NeonQueryBuilder(table),
  sql,
};

export default db;
