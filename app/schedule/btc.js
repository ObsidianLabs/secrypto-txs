const { Subscription } = require('egg')

class Btc extends Subscription {
  static get schedule () {
    return {
      interval: '60s', // 60s 间隔
      type: 'worker', // 每台机器上只有一个 worker 会执行这个定时任务
      immediate: true
      // disable: true,
    }
  }

  async subscribe () {
    const blockSummary = await this.ctx.service.btc.getLatestBlock()
    this.backtrack(blockSummary.hash)
    this.backtrackAndConfirmBlock(blockSummary.hash, 6)
  }

  async backtrack (hash, iteration = 0) {
    const { redis, config } = this.app
    if (iteration >= config.backtrackIteration) {
      return
    }
    const blockExist = await redis.exists(`btc:block:${hash}`)
    if (blockExist) {
      return
    }
    const { tx, ...block } = await this.getBlock(hash)
    if (!block) {
      return
    }

    await redis.set(`btc:block:${hash}`, JSON.stringify(block), 'EX', config.redisBlockExpire)
    this.cacheTransaction(tx, hash)
    const parentBlockExist = await redis.exists(`btc:block:${block.prev_block}`)
    if (parentBlockExist) {
      return
    }
    await this.backtrack(block.prev_block, iteration + 1)
  }

  async getBlock (blockHash) {
    const { config } = this.app
    let iteration = 0
    while (iteration < config.getBlockIterationTimes) {
      const block = await this.ctx.service.btc.getBlockByHash(blockHash)
      if (!block) {
        iteration++
        continue
      }
      return block
    }
    return null
  }

  async cacheTransaction (taransactions, blockHash) {
    taransactions.forEach(raw => {
      this.app.queue.btc.cacheTransaction({ blockHash, raw })
    })
  }

  async backtrackAndConfirmBlock (hash, step) {
    if (step <= 0) {
      await this.confirmBlock(hash)
      return
    }

    const blockJson = await this.app.redis.get(`btc:block:${hash}`)
    if (!blockJson) {
      return
    }
    const block = JSON.parse(blockJson)
    if (block && block.prev_block) {
      await this.backtrackAndConfirmBlock(block.prev_block, step - 1)
    }
  }

  async confirmBlock (hash, iteration = 0) {
    const { redis, config } = this.app
    if (iteration >= config.confirmBacktrackIteration) {
      return
    }

    const blockJson = await redis.get(`btc:block:${hash}`)
    if (!blockJson) {
      return
    }
    const block = JSON.parse(blockJson)
    if (!block) {
      return
    }

    if (!block.confirmed) {
      console.log(`Confirming block ${block.height} ${hash}`)
      block.confirmed = true
      await redis.set(`btc:block:${hash}`, JSON.stringify(block), 'EX', config.redisBlockExpire)

      this.app.queue.btc.filterTxs({ blockHash: hash })
      await this.confirmBlock(block.prev_block, iteration + 1)
    }
  }
}

module.exports = Btc
