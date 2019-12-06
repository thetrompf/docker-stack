"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const db_1 = require("./db");
const helper_1 = require("./helper");
const util_1 = require("util");
const crypto_1 = require("crypto");
const readdirAsync = util_1.promisify(fs_1.readdir);
const sha1 = async (filePath) => new Promise((resolve, reject) => {
    const hash = crypto_1.createHash('sha1');
    const stream = fs_1.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('end', () => {
        resolve(hash.digest('hex'));
    });
    stream.pipe(hash);
});
const findMigrationsOnFilesystem = () => readdirAsync('/data').then(files => Promise.all(files.map(async (file) => ({
    migrationPath: file,
    sha1: await sha1('/data/' + file),
}))));
const findMigrationsInDatabase = async (helper) => {
    const migrations = await db_1.sql `
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
    `.execute(helper.db);
    return migrations.map(row => ({
        areaName: row.area_name,
        areaType: row.area_type,
        migrationName: row.migration_name,
        runAt: row.run_at,
        sha1: row.sha1,
    }));
};
async function runInTransaction(helper, fn) {
    try {
        console.debug('Begin transaction');
        await helper.begin();
        console.debug('Run');
        await fn();
        console.debug('Commiting');
        await helper.commit();
    }
    catch (e) {
        console.error(e);
        try {
            console.info('Rolling back transaction');
            await helper.rollback();
            helper.release(e);
        }
        catch (err) {
            console.error('Could not rollback transaction');
            console.error(err);
            helper.release(err);
        }
        process.exit(1);
    }
}
async function runUp(file, helper) {
    const migration = (await Promise.resolve().then(() => require('/data/' + file.migrationPath)));
    console.log(`    ${file.migrationPath}`);
    return runInTransaction(helper, async () => {
        await migration.up(helper);
        const migrationNameParam = db_1.param('migration_name', file.migrationPath);
        const sha1Param = db_1.param('sha1', file.sha1);
        await db_1.sql `
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
async function runDown(file, helper) {
    const migration = (await Promise.resolve().then(() => require('/data/' + file.migrationPath)));
    console.log(`    ${file.migrationPath}`);
    return runInTransaction(helper, async () => {
        await migration.down(helper);
        const migrationNameParam = db_1.param('migration_name', file.migrationPath);
        const sha1Param = db_1.param('sha1', file.sha1);
        await db_1.sql `
            DELETE FROM
                migration.migrations mm
            WHERE
                mm.area_type = 'system' AND
                mm.area_name = 'pg' AND
                mm.migration_name = ${migrationNameParam} AND
                mm.sha1 = ${sha1Param}
        `.executeUpdate(helper.db, 1);
    });
}
const runAll = async (migrations, fn) => Promise.all(migrations.map(fn))
    .then(_ => void 0);
async function ensureMigrationSchemaExist(helper) {
    const schemaExists = await db_1.sql `
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
    await db_1.sql `CREATE SCHEMA migration`.executeUpdate(helper.db);
}
async function ensureMigrationsTableExist(helper) {
    const tableExists = await db_1.sql `
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
    await db_1.sql `
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
    await db_1.sql `
        CREATE INDEX ON
            migration.migrations (
                area_type,
                area_name,
                migration_name,
                run_at
            )
    `.executeUpdate(helper.db);
    await db_1.sql `
        CREATE INDEX ON
            migration.migrations (
                migration_name,
                run_at
            )
    `.executeUpdate(helper.db);
    await db_1.sql `
        CREATE INDEX ON
            migration.migrations (
                run_at,
                migration_name
            )
    `.executeUpdate(helper.db);
}
async function main() {
    let helper1 = null;
    try {
        const client = await db_1.pool.connect();
        helper1 = new helper_1.Helper(client);
        await helper1.begin();
        await ensureMigrationSchemaExist(helper1);
        await ensureMigrationsTableExist(helper1);
        await helper1.commit();
    }
    catch (e) {
        console.error(e);
        if (helper1 != null) {
            helper1.release(e);
        }
        return process.exit(1);
    }
    const helper = helper1;
    const action = process.argv[2] === 'down' ? 'down' : 'up';
    const filesystemMigrations = await findMigrationsOnFilesystem();
    const databaseMigrations = await findMigrationsInDatabase(helper);
    const migrationsToRun = action === 'down'
        ? databaseMigrations.reduce((fms, dm) => {
            const fm = filesystemMigrations.find(f => f.sha1 === dm.sha1);
            if (fm != null) {
                fms.push(fm);
            }
            return fms;
        }, [])
        : filesystemMigrations.filter(fm => databaseMigrations.find(dm => dm.sha1 === fm.sha1) == null);
    if (migrationsToRun.length === 0) {
        console.info('Already up-to-date.');
        // helper.release();
        console.log(db_1.pool.totalCount);
        console.log(db_1.pool.idleCount);
        console.log(db_1.pool.waitingCount);
        await helper.end();
        process.exit(0);
        return;
    }
    console.info(`${action === 'up' ? 'Running' : 'Undoing'} ${migrationsToRun.length} migration${migrationsToRun.length === 1 ? '' : 's'}`);
    await runAll(migrationsToRun, (file) => action === 'down' ? runDown(file, helper) : runUp(file, helper));
    // helper.release();
    console.log(db_1.pool.totalCount);
    console.log(db_1.pool.idleCount);
    console.log(db_1.pool.waitingCount);
    return helper.end();
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=runner.js.map