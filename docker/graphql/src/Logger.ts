import * as Logger from 'ansi-logger';
import * as clc from 'cli-color';

export const logger = Logger.createLoggerFromEnvironment({
    group: 'gql',
    groupColor: clc.yellow,
    logLevel: Logger.Level.DEBUG,
});
