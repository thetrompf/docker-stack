import pg from 'pg';
import fs from 'fs';

const POSTGRES_PASSWORD = fs.readFileSync(process.env.POSTGRES_PASSWORD_FILE).toString();

export const pool = new pg.Pool({
    application_name: 'docker-app-migration',
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST,
    password: POSTGRES_PASSWORD,
    user: process.env.POSTGRES_USER,
});
