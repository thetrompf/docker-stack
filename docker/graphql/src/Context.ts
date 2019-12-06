import { logger } from '@docker-stack/graphql/Logger';
import { PoolClient } from 'pg';

export class Context {
    public readonly logger = logger;
    public readonly PostgresClient: PoolClient;

    public constructor(postgresClient: PoolClient) {
        this.PostgresClient = postgresClient;
    }

}
