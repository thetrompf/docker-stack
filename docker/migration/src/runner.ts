import { readdir, createReadStream } from 'fs';
import { pool } from './db';
import { Helper } from './helper';
import { promisify } from 'util';
import { createHash } from 'crypto';

const sql = String.raw;

const readdirAsync = promisify(readdir);

const sha1 = async (filePath: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const hash = createHash('sha1');
        const stream = createReadStream(filePath);
        stream.on('error', reject);
        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });
        stream.pipe(hash);
    });

const findMigrationsOnFilesystem = () =>
    readdirAsync('/data').then(files =>
        Promise.all(
            files.map(async file => ({
                migrationPath: file,
                sha1: await sha1('/data/' + file),
            })),
        ),
    );

async function runInTransaction(fn: (helper: Helper) => Promise<void>): Promise<void> {
    let helper: Helper | null = null;
    let errorOccured = false;
    try {
        const conn = await pool.connect();
        helper = new Helper(conn);
        await helper.begin();
        await fn(helper);
    } catch (e) {
        console.error(e);
        errorOccured = true;
        if (helper != null) {
            try {
                console.info('Rolling back transaction');
                await helper.rollback();
            } catch (e) {
                console.error('Could not rollback transaction');
                console.error(e);
            }
        }
    } finally {
        if (helper != null) {
            if (!errorOccured) {
                try {
                    await helper.commit();
                } catch (e) {
                    console.error('Couold not commit transaction');
                    console.error(e);
                }
            }
            helper.release();
        }
    }
}

async function run(migrationPath: string) {
    const migration = (await import('/data/' + migrationPath)) as Migration;
    return runInTransaction(helper => migration.up(helper));
}

const runAll = async (migrations: string[]): Promise<void> => Promise.all(migrations.map(run)).then(_ => void 0);

async function main() {
    let helper: Helper | null = null;
    let errorOccured = false;
    try {
        const conn = await pool.connect();
        helper = new Helper(conn);
        await helper.begin();
        const result = await helper.executeQuery(sql`
            SELECT
                1
            FROM
                pg_catalog.pg_tables t
            WHERE
                t.schemaname = 'migration' AND
                t.tablename = 'migrations'
        `);
        if (result.rowCount !== 1) {
            await helper.executeUpdate(sql`
                CREATE SCHEMA migration
            `);

            await helper.executeUpdate(sql`
                CREATE TABLE
                    migration.migrations (
                        id SERIAL PRIMARY KEY,
                        area_type text NOT NULL,
                        area_name text NOT NULL,
                        migration_name text NOT NULL,
                        sha1 text NOT NULL,
                        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        modified_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
            `);

            await helper.executeUpdate(sql`
                CREATE INDEX ON
                    migration.migrations (
                        area_type,
                        area_name,
                        migration_name,
                        created_at
                    )
            `);

            await helper.executeUpdate(sql`
                CREATE INDEX ON
                    migration.migrations (
                        migration_name,
                        created_at
                    )
            `);

            await helper.executeUpdate(sql`
                CREATE INDEX ON
                    migration.migrations (
                        created_at,
                        migration_name
                    )
            `);
        }
    } catch (e) {
        console.error(e);
        errorOccured = true;
        if (helper != null) {
            try {
                console.info('Rolling back transaction');
                await helper.rollback();
            } catch (e) {
                console.error('Could not rollback transaction');
                console.error(e);
            }
        }
    } finally {
        if (helper != null) {
            if (!errorOccured) {
                try {
                    await helper.commit();
                } catch (e) {
                    console.error('Couold not commit transaction');
                    console.error(e);
                }
            }
            helper.release();
        }
    }

    const migrations = await findMigrationsOnFilesystem();
    console.dir(migrations);
    await runAll(migrations.map(m => m.migrationPath));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
