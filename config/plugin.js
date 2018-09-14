'use strict';
const path = require('path');
// had enabled by egg
// exports.static = true;

exports.bull = {
  enable: true,
  path: path.join(__dirname, '../app/lib/plugin/egg-bull'),
};

exports.redis = {
  enable: true,
  package: 'egg-redis',
};

exports.mongoose = {
  enable: true,
  package: 'egg-mongoose',
};
