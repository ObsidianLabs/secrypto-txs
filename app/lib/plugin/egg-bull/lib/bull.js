const assert = require('assert')
const path = require('path')

const Redis = require('ioredis')
const Queue = require('bull')

module.exports = app => {
  app.addSingleton('bull', createBull)

  app.bull.loadQueue = () => loadQueueToApp(app)

  app.beforeStart(() => {
    loadQueueToApp(app)
  })
}

function createBull (config, app) {
  assert(config.host && config.port && config.password && config.db)

  const redis = () => new Redis({
    port: config.port,
    host: config.host,
    password: config.password,
    db: config.db
  })
  const client = redis()
  const subscriber = redis()

  const options = {
    createClient (type) {
      switch (type) {
        case 'client':
          return client
        case 'subscriber':
          return subscriber
        default:
          return redis()
      }
    }
  }

  app.beforeStart(async () => {
    app.coreLogger.info('[egg-bull] starting...')
  })

  return { redis, options }
}

function loadQueueToApp (app) {
  const dir = path.join(app.config.baseDir, 'app/queue')
  app.loader.loadToApp(dir, 'queue', {
    inject: app,
    initializer (Processor, opt) {
      const queueName = opt.pathName.replace('queue.', '')

      app.coreLogger.info('[egg-bull] create queue: ', queueName)
      const queue = new Queue(queueName, app.bull.options)

      const obj = {}
      const processor = new Processor()
      Object.getOwnPropertyNames(Processor.prototype).forEach(key => {
        if (key === 'constructor') return
        queue.process(key, 10, job => processor[key](job.data, app, job))
        obj[key] = data => queue.add(key, data, {
          delay: data.delay ? data.delay * 1000 : 10,
          attempts: 3
        }).then(job => data.delay ? job : job.finished())
      })

      queue.process('cleanCompleted', job => {
        queue.clean(3 * 3600 * 1000, 'completed')
        job.finished().then(() => {
          job.remove()
        })
        return true
      })
      queue.process('cleanFailed', job => {
        queue.clean(1 * 3600 * 1000, 'failed')
        job.finished().then(() => {
          job.remove()
        })
        return true
      })
      queue.add('cleanCompleted', {}, { repeat: { cron: '0 * * * * *' } })
      queue.add('cleanFailed', {}, { repeat: { cron: '0 * * * * *' } })

      return obj
    }
  })
}
