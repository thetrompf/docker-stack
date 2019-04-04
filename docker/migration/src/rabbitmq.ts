import * as amqp from 'amqplib';
import * as fs from 'fs';

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            RABBITMQ_DEFAULT_HOST: string;
            RABBITMQ_DEFAULT_PASS_FILE: string;
            RABBITMQ_DEFAULT_PASS: string;
            RABBITMQ_DEFAULT_USER: string;
            RABBITMQ_DEFAULT_VHOST: string;
        }
    }
}

const RABBITMQ_USER = process.env.RABBITMQ_DEFAULT_USER;
const RABBITMQ_HOST = process.env.RABBITMQ_DEFAULT_HOST;
const RABBITMQ_VHOST = process.env.RABBITMQ_DEFAULT_VHOST;
const RABBITMQ_PASS = fs.readFileSync(process.env.RABBITMQ_DEFAULT_PASS_FILE).toString();

const URI = (parts: TemplateStringsArray, ...vars: string[]): string =>
    parts
        .reduce(
            (res, part, idx) => {
                res.push(part);
                if (vars[idx] != null) {
                    res.push(encodeURIComponent(vars[idx]));
                }
                return res;
            },
            [] as string[],
        )
        .join('');

const connectionStr = URI`amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}/${RABBITMQ_VHOST}`;

export const connect = (uri: string = connectionStr) => amqp.connect(uri);
