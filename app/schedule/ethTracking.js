const { Subscription } = require('egg')

class EthTracking extends Subscription {
  static get schedule () {
    return {
      interval: '30s',
      type: 'worker',
      immediate: true
      // disable: true,
    }
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe () {
    const trackings = await this.ctx.app.model.EthTracking.find()
    await Promise.all(trackings.forEach(async item => {
      const key = `eth:trackings:${item.token || 'eth'}`
      if (item.track) {
        await this.ctx.app.redis.sadd(key, item.address)
      } else {
        await this.ctx.app.redis.srem(key, item.address)
      }
    }))
  }
}

module.exports = EthTracking
