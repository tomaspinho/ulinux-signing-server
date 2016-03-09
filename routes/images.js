'use strict';

const Boom = require('boom');
const Path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const tar = require('tar-stream');
const _ = require('underscore');

const rp = require('request-promise');

module.exports = function (config, db) {

  const updateServerOptions = {
    ca: fs.readFileSync(Path.join(__dirname, '..', config.update_server_ca_cert)),
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
        let path_signed = Path.join(__dirname, '..', 'device_images/signed/', name + '.tar');
        let file_unsigned = fs.createWriteStream(path_unsigned);
        file_unsigned.on('error', function (err) {
          console.error(err);
          return reply(Boom.badImplementation('Something wrong happened ' +
            'while writing the image file to disk'));
        });

        data.file.pipe(file_unsigned);

        data.file.on('end', function () {
          let fileOnDisk = fs.readFileSync(path_unsigned);
          const sign = crypto.createSign('RSA-SHA512');
          sign.write(fileOnDisk);
          sign.end();
          const privkey = fs.readFileSync(Path.join(__dirname, '..', config.image.signing_privkey), 'UTF-8');
          const signedHash = sign.sign(privkey, 'base64');

          let signedFile = fs.createWriteStream(path_signed);
          var pack = tar.pack();
          pack.entry({ name: 'signature.txt' }, signedHash);
          pack.entry({ name: 'image.img' }, fileOnDisk);
          pack.finalize();
          pack.pipe(signedFile);

          signedFile.on('finish', () => {
            let options = _.extend({
              url: `https://${config.update_server}/updates/`,
              headers: {
                Authorization: `Bearer ${config.update_server_ss_token}`,
              },
              formData: {
                file: fs.createReadStream(path_signed),
              },
            }, updateServerOptions);

            console.log(updateServerOptions);

            rp.post(options)
              .then(function (response) {
                console.log(`Succesfully uploded image: ${path_signed}`);
                return reply({ success: true });
              })
              .catch(function (err) {
                console.log(`Error happened while uploading image: ${path_signed}`,
                  err);
                  console.log(err.cause)
                  return reply({ success: false });
                });
          });

          signedFile.on('error', (err) => {
            console.error(err);
            return reply(Boom.badImplementation('Something wrong happened ' +
              'while writing the signed image file to disk'));
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
        maxBytes: config.image_maxsize,
      },
    },
  };

  return [].concat(postImage);
};
