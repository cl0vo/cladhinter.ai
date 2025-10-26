declare module 'pg' {
  import type { EventEmitter } from 'node:events';

  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<R = QueryResultRow> {
    command: string;
    rowCount: number;
    oid: number;
    rows: R[];
    fields: Array<{ name: string }>;
  }

  export interface PoolClient {
    query<R = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    release(err?: Error): void;
  }

  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    ssl?: unknown;
  }

  export class Pool extends EventEmitter {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    query<R = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }
}
