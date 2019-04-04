import * as pg from 'pg';
import { Helper } from '../../../src/helper';
type primitive = boolean | number | string | symbol | null;

declare global {
    interface MigrationHelper extends Helper {}
    interface Migration {
        down(helper: MigrationHelper): Promise<void>;
        up(helper: MigrationHelper): Promise<void>;
        test(helper: MigrationHelper): Promise<void>;
        verify(helper: MigrationHelper): Promise<void>;
    }
}

export {};
