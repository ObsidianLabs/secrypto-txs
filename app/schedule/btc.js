const { Subscription } = require('egg')

class Btc extends Subscription {
  static get schedule () {
    return {
      interval: '10s', // 10s 间隔
      type: 'worker', // 每台机器上只有一个 worker 会执行这个定时任务
      immediate: true
      // disable: true,
    }
  }

  async subscribe () {
    const blockSummary = await this.ctx.service.btc.getLatestBlock()
    this.backtrack(blockSummary.hash)
    // this.confirmBacktrack(newBlockNumber - 20)
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
    const block = await this.getBlock(hash)
    if (!block) {
      return
    }

    await redis.set(`btc:block:${hash}`, JSON.stringify(block), 'EX', config.redisBlockExpire)
    this.cacheTransaction(block.tx)
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

  async cacheTransaction (taransactions) {
    taransactions.forEach(tx => {
      this.app.queue.btc.cacheTransaction({ raw: tx })
    })
  }

  async confirmBacktrack (blockNumber, hash, iteration = 0) {
    const { redis, config } = this.app
    if (iteration >= config.confirmBacktrackIteration) {
      return
    }

    let block
    if (blockNumber) {
      block = await this.getBlock(blockNumber)
    }
    const blockJson = await redis.get(`btc:block:${block ? block.hash : hash}`)
    if (blockJson) {
      block = JSON.parse(blockJson)
    }

    if (!block) {
      return
    }

    if (!block.confirmed) {
      console.log(`Confirming block ${block.number} ${block.hash}`)
      block.confirmed = true
      await redis.set(`eth:block:${block.hash}`, JSON.stringify(block), 'EX', config.redisBlockExpire)

      if (!Array.isArray(block.transactions)) {
        console.warn(`Block ${hash || blockNumber} has empty transactions.`)
      } else {
        this.app.queue.btc.filterTxs({ hash: block.hash, txs: block.transactions })
      }
      await this.confirmBacktrack(null, block.parentHash, iteration + 1)
    }
  }
}

module.exports = Btc
