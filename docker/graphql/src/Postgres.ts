import * as fs from 'fs';
import * as pg from 'pg';
import { logger } from '@docker-stack/graphql/Logger';

export const sql = String.raw;

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

    log: logger.debug.bind(logger),
    max: 10,
});
