import pg from 'pg';

export class Helper {
    private db: pg.Client;

    public constructor(db: pg.Client) {
        this.db = db;
    }

    public executeQuery(sql: string, params?: any[]) {
        return this.db.query(sql, params);
    }

    public async executeUpdate(sql: string, expectedAffectedRows?: number): Promise<void>;
    public async executeUpdate(sql: string, params?: any[], expectedAffectedRows?: number): Promise<void>;
    public async executeUpdate(sql: string, params?: any[] | number, expectedAffectedRows?: number): Promise<void> {
        const queryParams: any[] = typeof params === 'number' ? undefined : params;
        const affectedRows: number = typeof params === 'number' ? params : expectedAffectedRows;

        const result = await this.executeQuery(sql, queryParams);
        if (affectedRows != null) {
            if (result.rowCount !== affectedRows) {
                throw new Error(`Expected ${affectedRows}, got: ${result.rowCount}`);
            }
        }
    }

    public begin(): Promise<void> {
        return this.executeUpdate('BEGIN', 0);
    }
    public commit(): Promise<void> {
        return this.executeUpdate('COMMIT', 0);
    }
    public rollback(): Promise<void> {
        return this.executeUpdate('ROLLBACK', 0);
    }
}
