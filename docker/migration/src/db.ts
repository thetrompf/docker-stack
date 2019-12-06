import * as pg from 'pg';
import * as fs from 'fs';

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            POSTGRES_DB: string;
            POSTGRES_HOST: string;
            POSTGRES_PASSWORD_FILE: string;
            POSTGRES_USER: string;
        }
    }
}

const POSTGRES_PASSWORD = fs.readFileSync(process.env.POSTGRES_PASSWORD_FILE).toString();

export const pool = new pg.Pool({
    application_name: 'docker-app-migration',
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST,
    password: POSTGRES_PASSWORD,
    user: process.env.POSTGRES_USER,
});

export class SQLError extends Error {}
export class NonUniqueResult extends SQLError {}
export class EmptyResult extends SQLError {}

class SQLQuery<T = any> {
    private readonly sql: string;
    private readonly params: RawInterpolation[];
    public constructor(sql: string, params: RawInterpolation[]) {
        this.sql = sql;
        this.params = params;
    }

    public async execute<E = void>(client: pg.PoolClient | pg.Client): Promise<(E extends void ? T : E)[]> {
        const result = await client.query(this.sql, this.params.map(p => p.value));
        return result.rows;
    }

    public async executeUpdate(client: pg.PoolClient | pg.Client, expectedRows?: number | null): Promise<number> {
        const result = await client.query(this.sql, this.params.map(p => p.value));
        if (expectedRows == null || expectedRows === result.rowCount) {
            return result.rowCount;
        } else {
            throw new SQLError(`Expected ${expectedRows}, got ${result.rowCount}`);
        }
    }

    public async getOneOrNull<E = void>(client: pg.PoolClient | pg.Client): Promise<(E extends void ? T : E) | null> {
        const result = await client.query(this.sql, this.params.map(p => p.value));
        if (result.rowCount === 0) {
            return null;
        } else if (result.rowCount === 1) {
            return result.rows[0];
        } else {
            throw new NonUniqueResult('');
        }
    }

    public async singleResult<E = void>(client: pg.PoolClient | pg.Client): Promise<E extends void ? T : E> {
        const result = await this.getOneOrNull<E>(client);
        if (result == null) {
            throw new EmptyResult('');
        } else {
            return result;
        }
    }
}

export class RawInterpolation {
    public constructor(
        public readonly name: string,
        public readonly value: any,
    ) { }

    public toString() {
        return this.value;
    }
}

export function sql<T = any>(sqlParts: TemplateStringsArray, ...params: RawInterpolation[]): SQLQuery<T> {
    return new SQLQuery(
        sqlParts.reduce((res, p, idx) => {
            res.push(p)
            if (idx < params.length) {
                res.push('$' + (idx + 1));
            }
            return res;
        }, [] as string[]).join(''),
        params,
    );
}

export function param(name: string, value: any) {
    return new RawInterpolation(name, value);
}
