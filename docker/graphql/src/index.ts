import * as http from 'http';
import { logger } from '@docker-stack/graphql/Logger';
import * as express from 'express';
import * as expressGraphql from 'express-graphql';
import * as bodyParser from 'body-parser';
import expressPlayground from 'graphql-playground-middleware-express';
import { schema } from '@docker-stack/graphql/Schema';
import { Context } from '@docker-stack/graphql/Context';
import { pool } from '@docker-stack/graphql/Postgres';
import graphqlHTTP = require('express-graphql');

const PORT = 3000;
const app = express();
const server = http.createServer(app);

app.use('/graphql', bodyParser.json(), expressGraphql(async (_req, res): Promise<graphqlHTTP.OptionsData> => {
    logger.info('req');
    const client = await pool.connect();
    client.on('error', (err) => client.release(err));
    res.on('finish', () => client.release());
    return {
        context: new Context(client),
        graphiql: true,
        pretty: true,
        schema: schema,

    };
}));

app.get('/playground', expressPlayground({ endpoint: '/graphql' }));

logger.info('Starting server');
server.listen(PORT, () => {
    logger.info(`Server started, listening on: ${PORT}`);
});
