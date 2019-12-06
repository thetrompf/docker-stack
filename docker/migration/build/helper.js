"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isPoolClient(obj) {
    if (typeof obj.release === 'function') {
        return true;
    }
    return false;
}
const sql = String.raw;
var QuotedIdentifierBrand;
(function (QuotedIdentifierBrand) {
})(QuotedIdentifierBrand || (QuotedIdentifierBrand = {}));
function quoteIdentifier(str) {
    if (str.length === 0) {
        throw new TypeError('Idenitifier must a length above 0');
    }
    if (typeof str === 'string' && str.indexOf('.') === -1) {
        return `"${str}"`;
    }
    else {
        return (Array.isArray(str) ? str : str.split('.'))
            .reduce((carry, item) => {
            carry.push(quoteIdentifier(item));
            return carry;
        }, [])
            .join('');
    }
}
exports.quoteIdentifier = quoteIdentifier;
function identifierParts(identifier) {
    return identifier.split('.');
}
exports.identifierParts = identifierParts;
class Helper {
    constructor(db) {
        this.db = db;
    }
    executeQuery(sql, params) {
        console.debug(sql);
        return this.db.query(sql, params);
    }
    async executeUpdate(sql, params, expectedAffectedRows) {
        const queryParams = typeof params === 'number' ? undefined : params;
        const affectedRows = typeof params === 'number' ? params : expectedAffectedRows;
        const result = await this.executeQuery(sql, queryParams);
        if (affectedRows != null) {
            if ((result.rowCount || 0) !== affectedRows) {
                throw new Error(`Expected ${affectedRows}, got: ${result.rowCount}`);
            }
        }
    }
    async getOneOrNullResult(sql, params) {
        const result = await this.executeQuery(sql, params);
        if (result.rowCount === 0) {
            return null;
        }
        else if (result.rowCount === 1) {
            return result.rows[0];
        }
        else {
            throw new Error(`Non-unique result - ${result.rowCount} rows returned`);
        }
    }
    async executeSingle(sql, params) {
        const result = await this.getOneOrNullResult(sql, params);
        if (result == null) {
            throw new Error('No rows returned');
        }
        else {
            return result;
        }
    }
    async schemaExists(schema) {
        return ((await this.getOneOrNullResult(sql `SELECT 1 FROM pg_catalog.pg_tables t WHERE t.schemaname = ?`, [
            schema,
        ])) != null);
    }
    async tableExists(_table) { }
    begin() {
        return this.executeUpdate('BEGIN', 0);
    }
    commit() {
        return this.executeUpdate('COMMIT', 0);
    }
    rollback() {
        return this.executeUpdate('ROLLBACK', 0);
    }
    release(err) {
        if (isPoolClient(this.db)) {
            this.db.release(err);
        }
    }
    end(callback) {
        if (!isPoolClient(this.db)) {
            if (callback == null) {
                return this.db.end();
            }
            else {
                return this.db.end(callback);
            }
        }
    }
}
exports.Helper = Helper;
//# sourceMappingURL=helper.js.map