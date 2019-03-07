import http from 'http';
import redis from 'redis';
import pg from 'pg';
import fs from 'fs';
import amqp from 'amqplib';

const redisClient = redis.createClient({
    host: 'redis',
});

const POSTGRES_PASSWORD = fs.readFileSync(process.env.POSTGRES_PASSWORD_FILE).toString();
const RABBITMQ_DEFAULT_PASS = fs.readFileSync(process.env.RABBITMQ_DEFAULT_PASS_FILE).toString();

/**
 *
 * @param {TemplateStringsArray} parts
 * @param {...(string | number | null | undefined)} vars
 */
const URI = (parts, ...vars) =>
    parts.reduce((carry, part, idx) => {
        const v = vars[idx];
        if (typeof v === 'string' && v.length > 0) {
            return carry + part + encodeURIComponent(v);
        } else if (typeof v === 'number') {
            return carry + part + v;
        } else {
            return carry + part;
        }
    }, '');

const amqpConnStr = URI`amqp://${process.env.RABBITMQ_DEFAULT_USER}:${RABBITMQ_DEFAULT_PASS}@${
    process.env.RABBITMQ_DEFAULT_HOST
}/${process.env.RABBITMQ_DEFAULT_VHOST}`;

const pool = new pg.Pool({
    application_name: 'docker-app-graphql',
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST,
    password: POSTGRES_PASSWORD,
    user: process.env.POSTGRES_USER,
});

const r = {
    /**
     * @param {redis.RedisClient} client
     * @param {string} key
     * @return {Promise<number>}
     */
    incr: (client, key) =>
        new Promise((resolve, reject) =>
            client.incr(key, (err, result) => (err == null ? resolve(result) : reject(err))),
        ),
};

const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    /**
     * @type {pg.PoolClient}
     */
    let client = null;
    let rabbitmq = null;
    let channel = null;
    try {
        rabbitmq = await amqp.connect(amqpConnStr);
        client = await pool.connect();

        channel = await rabbitmq.createChannel();

        const requests = await r.incr(redisClient, 'requests');
        console.info('Incremented request count: ' + requests);

        await channel.assertQueue('docker', {
            autoDelete: false,
            durable: true,
        });

        await channel.publish(
            '',
            'docker',
            Buffer.from(
                JSON.stringify({
                    application: 'GraphQL',
                    requests,
                }),
            ),
            {
                deliveryMode: 2,
                persistent: true,
            },
        );

        const dbResult = await client.query('SELECT CURRENT_TIMESTAMP as "date"');
        console.info('Queried database: ' + dbResult.rows[0].date);

        res.writeHead(200, 'OK');
        res.write(
            JSON.stringify({
                application: 'GrahQL',
                requests: requests,
                date: dbResult.rows[0].date,
            }),
        );
    } catch (err) {
        console.error(err.message);
        res.writeHead(503, 'Service Temporarily Unavailbable');
        res.write(JSON.stringify({ application: 'GraphQL', error: err.message }));
    } finally {
        if (client != null) {
            client.release();
        }
        if (channel != null) {
            channel.close();
        }
        if (!rabbitmq != null) {
            rabbitmq.close();
        }
        res.end();
    }
});

['SIGINT', 'SIGTERM'].forEach(
    /** @param {NodeJS.Signals} signal */
    signal => {
        process.on(signal, () => {
            console.info(`Shutting down due to ${signal}`);
            if (server.listening) {
                server.close();
                console.debug(`Server closed`);
            }
        });
    },
);

server.listen(3000);
console.info('GraphQL: listening on 3000');
