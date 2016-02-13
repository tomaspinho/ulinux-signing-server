'use strict';

const Boom = require('boom');
const Path = require('path');
const fs = require('fs');
const _ = require('underscore');

const openpgp = require('openpgp');
const rp = require('request-promise');

module.exports = function (config, db) {

  require('ssl-root-cas/latest')
    .inject()
    .addFile(Path.join(__dirname, '..', config.update_server_cert));

  const updateServerOptions = {
    cert: fs.readFileSync(Path.join(__dirname, '..', config.cert_path)),
    key: fs.readFileSync(Path.join(__dirname, '..', config.key_path)),
    rejectUnauthorized: true,
  };

  const postImage = {
    method: 'POST',
    path: '/updates/',
    handler: (request, reply) => {
      let data = request.payload;
      if (data.file) {
        let name = Date.now() + '_' + data.file.hapi.filename;
        let path_unsigned = Path.join(__dirname, '..', 'device_images/unsigned/', name);
        //let path_signed = Path.join(__dirname, '..', 'device_images/signed/', name);
        let path_signed = path_unsigned;
        let file_unsigned = fs.createWriteStream(path_unsigned);
        file_unsigned.on('error', function (err) {
          console.error(err);
          return reply(Boom.badImplementation('Something wrong happened ' +
            'while writing the image file disk'));
        });

        data.file.pipe(file_unsigned);

        data.file.on('end', function (err) {
          // Sign the image
          // Post to update server
          let options = _.extend({
            url: `https://${config.update_server}/updates/`,
            formData: {
              file: fs.createReadStream(path_signed),
            },
          }, updateServerOptions);

          rp.post(options)
            .then(function (response) {
              console.log(`Succesfully uploded image: ${path_signed}`);
              return reply({ success: true });
            })
            .catch(function (err) {
              console.log(`Error happened while uploading image: ${path_signed}`,
                err);
              return reply({ success: false });
            });

        });
      } else {
        return reply(Boom.badRequest('Required file missing from request.'));
      }
    },
    config: {
      auth: {
        strategy: 'bearer',
        scope: 'dev',
      },
      payload: {
        output: 'stream',
      },
    },
  };

  return [].concat(postImage);
};
