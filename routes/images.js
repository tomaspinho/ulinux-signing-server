'use strict';

const Boom = require('boom');
const Path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const tar = require('tar-stream');
const _ = require('underscore');

const Docker = require('dockerode');
const docker = new Docker();

const rp = require('request-promise');

module.exports = function (config, db, logger) {

  const updateServerOptions = {
    ca: fs.readFileSync(Path.join(__dirname, '..', config.update_server_ca_cert)),
    cert: fs.readFileSync(Path.join(__dirname, '..', config.cert_path)),
    key: fs.readFileSync(Path.join(__dirname, '..', config.key_path)),
    rejectUnauthorized: true,
  };

  const postImage = {
    method: 'POST',
    path: '/updates/',
    handler: (request, reply) => {
      let data = request.payload;
      logger.info('Client (%s) is uploading a new update.',
        request.info.remoteAddress);
      if (data.file) {
        let name = Date.now() + '_' + data.file.hapi.filename;
        let path_unsigned = Path.join(__dirname, '..', 'device_images/unsigned/', name);
        let path_signed = Path.join(__dirname, '..', 'device_images/signed/', name + '.tar');
        let file_unsigned = fs.createWriteStream(path_unsigned);
        file_unsigned.on('error', function (err) {
          logger.error('Something wrong happened while writing the image file' +
          ' to disk', err);
          return reply(Boom.badImplementation('Something wrong happened ' +
            'while writing the image file to disk'));
        });

        data.file.pipe(file_unsigned);

        data.file.on('end', function () {
          logger.info('Server is signing a new update.');

          let fileOnDisk = fs.readFileSync(path_unsigned);

          let signAndReply = () => {
            const sign = crypto.createSign('RSA-SHA512');
            sign.write(fileOnDisk);
            sign.end();
            const privkey = fs.readFileSync(Path.join(__dirname, '..', config.image.signing_privkey), 'UTF-8');
            const signedHash = sign.sign(privkey, 'base64');

            logger.info('Server signed a new update, packing into tar.');

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

              logger.info('Uploading tar to update server.');

              rp.post(options)
                .then(function (response) {
                  logger.info(`Succesfully uploded image: ${path_signed}`);
                  return reply({ success: true });
                })
                .catch(function (err) {
                  logger.error('Error happened while uploading image \'%s\'',
                    path_signed,
                    err);
                    return reply({ success: false });
                  });
            });

            signedFile.on('error', (err) => {
              logger.error('Something wrong happened while writing the signed ' +
                'image file to disk', err);
              return reply(Boom.badImplementation('Something wrong happened ' +
                'while writing the signed image file to disk'));
            });
          }

          /* Spawn docker container to take care of key management */
          /* docker run --privileged=true -t -i -v $PWD/files:/opt/files/:ro
                -v $IMAGE_PATH:/opt/image.img keymgmt
          */
          docker.run(config.image.container, [], process.stdout, null,
            {
              'Binds': [
                `${config.image.container_files}:/opt/files/:ro`,
                `${path_unsigned}:/opt/image.img`
              ],
              'Privileged': true
            }, function (err, data, container) {
              if (err) {
                logger.error('Got an error while running the keymgmt container',
                  err);
                return;
              }
              logger.debug(data);
              signAndReply();
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
