const { Subscription } = require('egg')

class BtcTracking extends Subscription {
  static get schedule () {
    return {
      interval: '30s',
      type: 'worker',
      immediate: true
      // disable: true
    }
  }

  async subscribe () {
    const trackings = await this.ctx.app.model.BtcTracking.find()
    await Promise.all(trackings.forEach(async item => {
      const key = 'btc:trackings'
      if (item.track) {
        await this.ctx.app.redis.sadd(key, item.address)
      } else {
        await this.ctx.app.redis.srem(key, item.address)
      }
    }))
  }
}

module.exports = BtcTracking
