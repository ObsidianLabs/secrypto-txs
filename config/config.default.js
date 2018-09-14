'use strict';
require('dotenv').config();

module.exports = appInfo => {
  const config = (exports = {});

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1536645724532_5076';
  config.web3HttpUrl = 'https://mainnet.infura.io/wqMAgibGq1rDtBdmJ4TU';
  // redis缓存block过期时长
  config.redisBlockExpire = 3600;
  // 区块回溯次数
  config.backtrackIteration = 20;
  // 通过web3获取区块失败重试次数
  config.getBlockIterationTimes = 3;
  // 确认交易回溯次数
  config.confirmBacktrackIteration = 5;

  config.redisTxExpire = 3600;

  // add your config here
  config.middleware = [];
  config.bull = {
    client: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_QUEUE_DB,
      // host: '127.0.0.1',
      // port: 6379,
      // password: '',
      // db: 4,
    },
  };

  config.redis = {
    // instanceName. See below
    client: {
      port: 6379, // Redis port
      host: '127.0.0.1', // Redis host
      password: '',
      db: 1,
    },
  };

  config.mongoose = {
    client: {
      url: process.env.MONGO_URL,
      options: {
        replicaSet: false,
        user: process.env.MONGO_USER,
        pass: process.env.MONGO_PASSWORD,
      },
    },
  };

  return config;
};
