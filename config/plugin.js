'use strict'
const path = require('path')

exports.bull = {
  enable: true,
  path: path.join(__dirname, '../app/lib/plugin/egg-bull'),
}

exports.redis = {
  enable: true,
  package: 'egg-redis',
}

exports.mongoose = {
  enable: true,
  package: 'egg-mongoose',
}
