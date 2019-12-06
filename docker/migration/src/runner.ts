import { readdir, createReadStream } from 'fs';
import { pool, sql, param } from './db';
import { Helper } from './helper';
import { promisify } from 'util';
import { createHash } from 'crypto';

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

interface MigrationFile {
    migrationPath: string;
    sha1: string;
}

const findMigrationsOnFilesystem = () =>
    readdirAsync('/data').then(files =>
        Promise.all(
            files.map(async file => ({
                migrationPath: file,
                sha1: await sha1('/data/' + file),
            })),
        ),
    );

const findMigrationsInDatabase = async (helper: Helper) => {
    interface MigrationData {
        area_name: string;
        area_type: string;
        migration_name: string;
        run_at: string;
        sha1: string;
    }

    const migrations = await sql`
        SELECT
            mm.area_type,
            mm.area_name,
            mm.migration_name,
            mm.sha1,
            mm.run_at
        FROM
            migration.migrations mm
        ORDER BY
            mm.run_at DESC,
            mm.migration_name DESC
    `.execute<MigrationData>(helper.db);

    return migrations.map(row => ({
        areaName: row.area_name,
        areaType: row.area_type,
        migrationName: row.migration_name,
        runAt: row.run_at,
        sha1: row.sha1,
    }));
}

async function runInTransaction(helper: Helper, fn: () => Promise<void>): Promise<void> {
    try {
        console.debug('Begin transaction')
        await helper.begin();
        console.debug('Run');
        await fn();
        console.debug('Commiting');
        await helper.commit();
    } catch (e) {
        console.error(e);
        try {
            console.info('Rolling back transaction');
            await helper.rollback();
            helper.release(e);
        } catch (err) {
            console.error('Could not rollback transaction');
            console.error(err);
            helper.release(err);
        }
        process.exit(1);
    }
}

async function runUp(file: MigrationFile, helper: Helper): Promise<void> {
    const migration = (await import('/data/' + file.migrationPath)) as Migration;
    console.log(`    ${file.migrationPath}`);
    return runInTransaction(helper, async () => {
        await migration.up(helper);

        const migrationNameParam = param('migration_name', file.migrationPath);
        const sha1Param = param('sha1', file.sha1);

        await sql`
            INSERT INTO
                migration.migrations (
                    area_type,
                    area_name,
                    migration_name,
                    sha1
                )
            VALUES
                (
                    'system',
                    'pg',
                    ${migrationNameParam},
                    ${sha1Param}
                )
        `.executeUpdate(helper.db, 1);
    });
}

async function runDown(file: MigrationFile, helper: Helper): Promise<void> {
    const migration = (await import('/data/' + file.migrationPath)) as Migration;
    console.log(`    ${file.migrationPath}`);
    return runInTransaction(helper, async () => {
        await migration.down(helper);

        const migrationNameParam = param('migration_name', file.migrationPath);
        const sha1Param = param('sha1', file.sha1);

        await sql`
            DELETE FROM
                migration.migrations mm
            WHERE
                mm.area_type = 'system' AND
                mm.area_name = 'pg' AND
                mm.migration_name = ${migrationNameParam} AND
                mm.sha1 = ${sha1Param}
        `.executeUpdate(helper.db, 1);
    })
}

const runAll = async (
    migrations: MigrationFile[],
    fn: (file: MigrationFile) => Promise<void>,
): Promise<void> =>
    Promise.all(migrations.map(fn))
        .then(_ => void 0);

async function ensureMigrationSchemaExist(helper: Helper) {
    const schemaExists = await sql`
        SELECT
            1
        FROM
            pg_catalog.pg_tables t
        WHERE
            t.schemaname = 'migration'
    `.getOneOrNull(helper.db) != null;

    if (schemaExists) {
        return;
    }

    await sql`CREATE SCHEMA migration`.executeUpdate(helper.db);
}

async function ensureMigrationsTableExist(helper: Helper) {
    const tableExists = await sql`
        SELECT
            1
        FROM
            pg_catalog.pg_tables t
        WHERE
            t.tablename = 'migrations'
    `.getOneOrNull(helper.db) != null;

    if (tableExists) {
        return;
    }

    await sql`
        CREATE TABLE
            migration.migrations (
                id SERIAL PRIMARY KEY,
                area_type text NOT NULL,
                area_name text NOT NULL,
                migration_name text NOT NULL,
                sha1 text NOT NULL,
                run_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
    `.executeUpdate(helper.db);

    await sql`
        CREATE INDEX ON
            migration.migrations (
                area_type,
                area_name,
                migration_name,
                run_at
            )
    `.executeUpdate(helper.db);

    await sql`
        CREATE INDEX ON
            migration.migrations (
                migration_name,
                run_at
            )
    `.executeUpdate(helper.db);

    await sql`
        CREATE INDEX ON
            migration.migrations (
                run_at,
                migration_name
            )
    `.executeUpdate(helper.db);
}

async function main() {
    let internHelper: Helper | null = null;
    try {
        const client = await pool.connect();
        internHelper = new Helper(client);
        await internHelper.begin();
        await ensureMigrationSchemaExist(internHelper);
        await ensureMigrationsTableExist(internHelper);
        await internHelper.commit();
    } catch (e) {
        console.error(e);
        if (internHelper != null) {
            internHelper.release(e);
        }
        return process.exit(1);
    }

    const helper = internHelper;

    const action = process.argv[2] === 'down' ? 'down' : 'up';

    const filesystemMigrations = await findMigrationsOnFilesystem();
    const databaseMigrations = await findMigrationsInDatabase(helper);

    const migrationsToRun =
        action === 'down'
            ? databaseMigrations.reduce((fms, dm) => {
                const fm = filesystemMigrations.find(f => f.sha1 === dm.sha1);
                if (fm != null) {
                    fms.push(fm);
                }
                return fms;
            }, [] as MigrationFile[])
            : filesystemMigrations.filter(fm => databaseMigrations.find(dm => dm.sha1 === fm.sha1) == null);

    if (migrationsToRun.length === 0) {
        console.info('Already up-to-date.');
        // helper.release();
        console.log(pool.totalCount);
        console.log(pool.idleCount);
        console.log(pool.waitingCount);
        await helper.end();
        process.exit(0);
        return;
    }

    console.info(`${action === 'up' ? 'Running' : 'Undoing'} ${migrationsToRun.length} migration${migrationsToRun.length === 1 ? '' : 's'}`);

    await runAll(migrationsToRun, (file) => action === 'down' ? runDown(file, helper) : runUp(file, helper));

    // helper.release();
    // console.log(pool.totalCount);
    // console.log(pool.idleCount);
    // console.log(pool.waitingCount);
    return helper.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
