import * as pg from 'pg';

function isPoolClient(obj: any): obj is pg.PoolClient {
    if (typeof obj.release === 'function') {
        return true;
    }
    return false;
}

const sql = String.raw;

enum QuotedIdentifierBrand {}
type QuotedIdentifier = string & { '': QuotedIdentifierBrand };

export function quoteIdentifier(str: string | IdentifierParts): QuotedIdentifier {
    if (str.length === 0) {
        throw new TypeError('Idenitifier must a length above 0');
    }
    if (typeof str === 'string' && str.indexOf('.') === -1) {
        return `"${str}"` as QuotedIdentifier;
    } else {
        return (Array.isArray(str) ? str : str.split('.'))
            .reduce(
                (carry, item) => {
                    carry.push(quoteIdentifier(item));
                    return carry;
                },
                [] as QuotedIdentifier[],
            )
            .join('') as QuotedIdentifier;
    }
}

type IdentifierParts = string | [string, string] | [string, string, string];
type QuotedIdentifierParts =
    | QuotedIdentifier
    | [QuotedIdentifier, QuotedIdentifier]
    | [QuotedIdentifier, QuotedIdentifier, QuotedIdentifier];
export function identifierParts(identifier: string): IdentifierParts;
export function identifierParts(identifier: QuotedIdentifier): QuotedIdentifierParts;
export function identifierParts(identifier: string | QuotedIdentifier): IdentifierParts | QuotedIdentifierParts {
    return identifier.split('.') as IdentifierParts | QuotedIdentifierParts;
}

export class Helper {
    public readonly db: pg.Client | pg.PoolClient;

    public constructor(db: pg.Client | pg.PoolClient) {
        this.db = db;
    }

    public executeQuery(sql: string, params?: any[]) {
        console.debug(sql);
        return this.db.query(sql, params);
    }

    public async executeUpdate(sql: string, expectedAffectedRows?: number): Promise<void>;
    public async executeUpdate(sql: string, params?: any[], expectedAffectedRows?: number): Promise<void>;
    public async executeUpdate(sql: string, params?: any[] | number, expectedAffectedRows?: number): Promise<void> {
        const queryParams: any[] | undefined = typeof params === 'number' ? undefined : params;
        const affectedRows: number | undefined = typeof params === 'number' ? params : expectedAffectedRows;

        const result = await this.executeQuery(sql, queryParams);
        if (affectedRows != null) {
            if ((result.rowCount || 0) !== affectedRows) {
                throw new Error(`Expected ${affectedRows}, got: ${result.rowCount}`);
            }
        }
    }

    public async getOneOrNullResult(sql: string, params?: any[]) {
        const result = await this.executeQuery(sql, params);
        if (result.rowCount === 0) {
            return null;
        } else if (result.rowCount === 1) {
            return result.rows[0];
        } else {
            throw new Error(`Non-unique result - ${result.rowCount} rows returned`);
        }
    }

    public async executeSingle(sql: string, params?: any[]) {
        const result = await this.getOneOrNullResult(sql, params);
        if (result == null) {
            throw new Error('No rows returned');
        } else {
            return result;
        }
    }

    public async schemaExists(schema: QuotedIdentifier): Promise<boolean> {
        return (
            (await this.getOneOrNullResult(sql`SELECT 1 FROM pg_catalog.pg_tables t WHERE t.schemaname = ?`, [
                schema,
            ])) != null
        );
    }

    public async tableExists(_table: QuotedIdentifier | IdentifierParts | QuotedIdentifierParts) {}

    public begin(): Promise<void> {
        return this.executeUpdate('BEGIN', 0);
    }
    public commit(): Promise<void> {
        return this.executeUpdate('COMMIT', 0);
    }
    public rollback(): Promise<void> {
        return this.executeUpdate('ROLLBACK', 0);
    }
    public release(err?: Error): void {
        if (isPoolClient(this.db)) {
            this.db.release(err);
        }
    }
    public end(): Promise<void>;
    public end(callback: (err?: Error) => void): void;
    public end(callback?: any): any {
        if (!isPoolClient(this.db)) {
            if (callback == null) {
                return this.db.end();
            } else {
                return this.db.end(callback);
            }
        }
    }
}
