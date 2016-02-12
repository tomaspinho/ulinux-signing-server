'use strict';

const Hapi = require('hapi');
const config = require(__dirname + '/config.js');
const fs = require('fs');
const Path = require('path');

const routes = require('./routes');

const mysql = require('mysql');
const db  = mysql.createPool({
  connectionLimit : 10,
  host            : config.db_host,
  database        : config.db_database,
  user            : config.db_user,
  password        : config.db_pass,
});

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
  let userCredentials = {}
  if (token === config.ss_token) {
    userCredentials.scope = 'ss';
    callback(null, true, userCredentials);
  } else {
    callback(null, false, userCredentials);
  }
};
server.register(require('hapi-auth-bearer-simple'));
server.auth.strategy('bearer', 'bearerAuth', {
  validateFunction: validateFunction
});

server.route(routes(config, db));

server.start((err) => {
  console.log('uLinux Signing Server running at:', server.info.uri);
  if (err) throw err;
});
