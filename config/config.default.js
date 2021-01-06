if (process.env.NODE_ENV === 'development') {
  require('dotenv').config()
}

module.exports = appInfo => {
  const config = (exports = {})

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1536645724532_5076'

  // redis缓存block过期时长
  config.redisBlockExpire = process.env.REDIS_BLOCK_EXPIRE
  // 区块回溯次数
  config.backtrackIteration = Number(process.env.BACKTRACK_ITERATION)
  // 通过web3获取区块失败重试次数
  config.getBlockIterationTimes = process.env.GETBLOCK_ITERATION_TIMES
  // 确认交易回溯次数
  config.confirmBacktrackIteration = process.env.CONFIRM_BACKTRACK_ITERATION

  config.redisTxExpire = process.env.REDIS_TX_EXPIRE

  // add your config here
  config.middleware = []
  config.bull = {
    // admin: process.env.QUEUE_ADMIN,
    client: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_QUEUE_DB
    }
  }

  config.redis = {
    // instanceName. See below
    client: {
      host: process.env.REDIS_HOST, // Redis host
      port: process.env.REDIS_PORT, // Redis port
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB
    }
  }

  config.mongoose = {
    client: {
      url: process.env.MONGO_URL,
      options: {
        replicaSet: false,
        user: process.env.MONGO_USER,
        pass: process.env.MONGO_PASSWORD
      }
    }
  }

  return config
}
