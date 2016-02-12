'use strict';

const Boom = require('boom');
const Path = require('path');
const fs = require('fs');
const openpgp = require('openpgp');

module.exports = function (config, db) {

  const postImage = {
    method: 'POST',
    path: '/updates/',
    handler: (request, reply) => {
      var data = request.payload;
      if (data.file) {
        var name = Date.now() + '_' + data.file.hapi.filename;
        var path = Path.join(__dirname, '..', 'device_images/', name);
        var file = fs.createWriteStream(path);

        file.on('error', function (err) {
          console.error(err);
          return reply(Boom.badImplementation('Something wrong happened ' +
            'while writing the image file disk'));
        });

        data.file.pipe(file);

        data.file.on('end', function (err) {
          // Sign the image
          // Post to update server
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
