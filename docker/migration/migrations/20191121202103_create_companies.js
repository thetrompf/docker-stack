const sql = String.raw;

module.exports = {
    async up(helper) {
        await helper.executeUpdate(sql`
            CREATE SCHEMA crm;
        `);

        await helper.executeUpdate(sql`
            CREATE TABLE
                crm.companies (
                    id SERIAL PRIMARY KEY,
                    name text,
                    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    modified_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
        `);
    },
    async down(helper) {
        await helper.executeUpdate(sql`
            DROP TABLE
                crm.companies
        `);

        await helper.executeUpdate(sql`
            DROP SCHEMA crm;
        `);
    },
    async test() {},
    async verify() {},
};
