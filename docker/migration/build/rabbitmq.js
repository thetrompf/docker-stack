"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const amqp = require("amqplib");
const fs = require("fs");
const RABBITMQ_USER = process.env.RABBITMQ_DEFAULT_USER;
const RABBITMQ_HOST = process.env.RABBITMQ_DEFAULT_HOST;
const RABBITMQ_VHOST = process.env.RABBITMQ_DEFAULT_VHOST;
const RABBITMQ_PASS = fs.readFileSync(process.env.RABBITMQ_DEFAULT_PASS_FILE).toString();
const URI = (parts, ...vars) => parts
    .reduce((res, part, idx) => {
    res.push(part);
    if (vars[idx] != null) {
        res.push(encodeURIComponent(vars[idx]));
    }
    return res;
}, [])
    .join('');
const connectionStr = URI `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}/${RABBITMQ_VHOST}`;
exports.connect = (uri = connectionStr) => amqp.connect(uri);
//# sourceMappingURL=rabbitmq.js.map