'use strict';

const Hapi = require('hapi');
const config = require(__dirname + '/config.js');
const fs = require('fs');
const Path = require('path');
const _ = require('underscore');

const routes = require('./routes');

const mysql = require('mysql');
const db  = mysql.createPool({
  connectionLimit : 10,
  host            : config.db_host,
  database        : config.db_database,
  user            : config.db_user,
  password        : config.db_pass,
});

const logger = require('winston');
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
  level: config.logs.console_level ? config.logs.console_level: 'info',
  colorize: true,
  timestamp: true,
})

if (config.logs.file)
  logger.add(logger.transports.File, {
    level: config.logs.file_level ? config.logs.file_level : 'error',
    filename: config.logs.file,
  });

logger.info('Welcome to uLinux Signing Server, ' +
  'we hope you have a productive day! :) ');
if (config.logs.file) logger.info('Logging to file: %s', config.logs.file);

const options = {
  key: fs.readFileSync(config.key_path),
  cert: fs.readFileSync(config.cert_path),
};

const server = new Hapi.Server();
server.connection({
  port: config.port,
  tls: options,
});

const validateFunction = function (token, callback) {
  db.query(
    'select * from developers where token = ?',
    [token],
    (err, result) => {

      if (result.length > 0) {

        db.query(
          'insert into logins (developer_id) values (?)',
          [result[0].id],
          (err) => {
            if (err) logger.error(err);
            result[0].scope = 'dev';
            callback(null, true, result[0]);
          }
        );

      } else {
        callback(null, false, {});
      }
  });
};
server.register(require('hapi-auth-bearer-simple'));
server.auth.strategy('bearer', 'bearerAuth', {
  validateFunction: validateFunction
});

server.route(routes(config, db, logger));

server.start((err) => {
  logger.info('uLinux Signing Server is running at:', server.info.uri);
  if (err) throw err;
});
