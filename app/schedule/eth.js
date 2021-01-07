const { Subscription } = require('egg')

class Eth extends Subscription {
  static get schedule () {
    return {
      interval: '5s', // 5s 间隔
      type: 'worker', // 每台机器上只有一个 worker 会执行这个定时任务
      immediate: true
      // disable: true,
    }
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe () {
    const newBlockNumber = await this.ctx.app.web3.eth.getBlockNumber()
    this.backtrack(newBlockNumber)
    this.confirmBacktrack(newBlockNumber - 20)
  }

  async backtrack (blockNumber, hash, iteration = 0) {
    const { redis, config } = this.app
    if (iteration >= config.backtrackIteration) {
      return
    }
    const { transactions, ...block } = await this.getBlock(blockNumber || hash)
    if (!block) {
      return
    }
    if (blockNumber) {
      const blockExist = await redis.exists(`eth:block:${block.hash}`)
      if (blockExist) {
        return
      }
    }

    await redis.set(`eth:block:${block.hash}`, JSON.stringify(block), 'EX', config.redisBlockExpire)
    // TODO:Queue Task eth.cacheTransaction
    this.cacheTransaction(transactions, block)
    const parentBlockExist = await redis.exists(`eth:block:${block.parentHash}`)
    if (parentBlockExist) {
      return
    }
    await this.backtrack(null, block.parentHash, iteration + 1)
  }

  async getBlock (blockNumberOrHash) {
    const { config } = this.app
    let iteration = 0
    while (iteration < config.getBlockIterationTimes) {
      const block = await this.ctx.app.web3.eth.getBlock(blockNumberOrHash)
      if (!block) {
        iteration++
        continue
      }
      return block
    }
    return null
  }

  async cacheTransaction (taransactions, block) {
    // TODO:执行cacheTransaction task
    taransactions.forEach(txHash => {
      this.app.queue.eth.cacheTransaction({ txHash, block })
    })
  }

  async confirmBacktrack (blockNumber, hash, iteration = 0) {
    console.log(`Confirming block ${hash || blockNumber}`)
    const { redis, config } = this.app
    if (iteration >= config.confirmBacktrackIteration) {
      return
    }

    let block
    if (hash) {
      const blockJson = await redis.get(`eth:block:${hash}`)
      if (!blockJson) {
        return
      }
      block = JSON.parse(blockJson)
    } else if (blockNumber) {
      block = await this.getBlock(blockNumber)
    }

    if (!block) {
      return
    }

    if (!block.confirmed) {
      if (!Array.isArray(block.transactions)) {
        console.warn(`Block ${hash || blockNumber} has empty transactions.`)
        console.warn(typeof block.transactions)
      } else {
        this.app.queue.eth.redisToMongo({ transactions: block.transactions })
      }
      block.confirmed = true
      await redis.set(`eth:block:${block.hash}`, JSON.stringify(block), 'EX', config.redisBlockExpire)
      await this.confirmBacktrack(null, block.parentHash, iteration + 1)
    }
  }
}

module.exports = Eth
