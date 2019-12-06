"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg = require("pg");
const fs = require("fs");
const POSTGRES_PASSWORD = fs.readFileSync(process.env.POSTGRES_PASSWORD_FILE).toString();
exports.pool = new pg.Pool({
    application_name: 'docker-app-migration',
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST,
    password: POSTGRES_PASSWORD,
    user: process.env.POSTGRES_USER,
});
class SQLError extends Error {
}
exports.SQLError = SQLError;
class NonUniqueResult extends SQLError {
}
exports.NonUniqueResult = NonUniqueResult;
class EmptyResult extends SQLError {
}
exports.EmptyResult = EmptyResult;
class SQLQuery {
    constructor(sql, params) {
        this.sql = sql;
        this.params = params;
    }
    async execute(client) {
        const result = await client.query(this.sql, this.params.map(p => p.value));
        return result.rows;
    }
    async executeUpdate(client, expectedRows) {
        const result = await client.query(this.sql, this.params.map(p => p.value));
        if (expectedRows == null || expectedRows === result.rowCount) {
            return result.rowCount;
        }
        else {
            throw new SQLError(`Expected ${expectedRows}, got ${result.rowCount}`);
        }
    }
    async getOneOrNull(client) {
        const result = await client.query(this.sql, this.params.map(p => p.value));
        if (result.rowCount === 0) {
            return null;
        }
        else if (result.rowCount === 1) {
            return result.rows[0];
        }
        else {
            throw new NonUniqueResult('');
        }
    }
    async singleResult(client) {
        const result = await this.getOneOrNull(client);
        if (result == null) {
            throw new EmptyResult('');
        }
        else {
            return result;
        }
    }
}
class RawInterpolation {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
    toString() {
        return this.value;
    }
}
exports.RawInterpolation = RawInterpolation;
function sql(sqlParts, ...params) {
    return new SQLQuery(sqlParts.reduce((res, p, idx) => {
        res.push(p);
        if (idx < params.length) {
            res.push('$' + (idx + 1));
        }
        return res;
    }, []).join(''), params);
}
exports.sql = sql;
function param(name, value) {
    return new RawInterpolation(name, value);
}
exports.param = param;
//# sourceMappingURL=db.js.map