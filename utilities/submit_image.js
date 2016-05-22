// This little script allows you to upload any image to the update server.
// Use with caution!

const _ = require('underscore');
const rp = require('request-promise');
const config = require(__dirname + '/../config');
const fs = require('fs');
const Path = require('path');

const updateServerOptions = {
  ca: fs.readFileSync(Path.join(__dirname, '..', config.update_server_ca_cert)),
  cert: fs.readFileSync(Path.join(__dirname, '..', config.cert_path)),
  key: fs.readFileSync(Path.join(__dirname, '..', config.key_path)),
  rejectUnauthorized: true,
};

let path_signed = process.argv[2];
let options = _.extend({
  url: `https://${config.update_server}/updates/`,
  headers: {
    Authorization: `Bearer ${config.update_server_ss_token}`,
  },
  formData: {
    file: fs.createReadStream(path_signed),
  },
}, updateServerOptions);

rp.post(options)
  .then(function (response) {
    return reply({ success: true });
  })
  .catch(function (err) {
    });
