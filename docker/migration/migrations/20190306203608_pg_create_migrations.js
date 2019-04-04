const sql = String.raw;

module.exports = {
    async up(helper) {
        await helper.executeUpdate(sql`
            CREATE SCHEMA migration;
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
    },
    async down(helper) {
        await helper.executeUpdate(sql`
            DROP TABLE migration.migrations
        `);

        await helper.executeUpdate(sql`
            DROP SCHEMA migration
        `);
    },
    async test() {},
    async verify() {},
};
