/*
 * @Author: icezeros
 * @Date: 2018-09-11 16:50:45
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-25 10:41:47
 */
'use strict';
const Subscription = require('egg').Subscription;

class EthSycnBlockCache extends Subscription {
  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      interval: '5s', // 1 分钟间隔
      type: 'worker', // 指定所有的 worker 都需要执行
      immediate: true,
      // disable: true,
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {
    // console.log(this.app.moment());
    const newBlockNumber = await this.ctx.app.web3Https.eth.getBlockNumber();
    this.backtrack(newBlockNumber);
    this.confirmBacktrack(newBlockNumber - 20);
  }

  async backtrack(blockNumber, hash, iteration = 0) {
    const { redis, config } = this.app;
    if (iteration >= config.backtrackIteration) {
      return;
    }
    const block = await this.getBlock(blockNumber || hash);
    if (!block) {
      return;
    }
    if (blockNumber) {
      const blockExist = await redis.exists(`eth:block:${block.hash}`);
      if (blockExist) {
        return;
      }
    }

    console.log('======= config.redisBlockExpire =========', config.redisBlockExpire);

    await redis.set(`eth:block:${block.hash}`, JSON.stringify(block), 'EX', config.redisBlockExpire);
    //TODO:Queue Task eth.cacheTransaction
    this.cacheTransaction(block.transactions, block);
    const parentBlockExist = await redis.exists(`eth:block:${block.parentHash}`);
    if (parentBlockExist) {
      return;
    }
    this.backtrack(null, block.parentHash, iteration + 1);
  }

  async getBlock(blockNumberOrHash) {
    const { config } = this.app;
    let iteration = 0;
    let action = true;
    while (action && iteration < config.getBlockIterationTimes) {
      const block = await this.ctx.app.web3Https.eth.getBlock(blockNumberOrHash);
      if (!block) {
        iteration++;
        continue;
      }
      action = false;
      return block;
    }
    return null;
  }

  async cacheTransaction(taransactions, block) {
    // TODO:执行cacheTransaction task
    taransactions.forEach(txHash => {
      this.app.queue.eth.cacheTransaction({
        txHash,
        block,
      });
    });
  }

  async confirmBacktrack(blockNumber, hash, iteration = 0) {
    const { redis, config } = this.app;
    if (iteration >= config.confirmBacktrackIteration) {
      return;
    }
    let blockWeb;
    if (blockNumber) {
      blockWeb = await this.getBlock(blockNumber);
      if (!blockWeb) {
        return;
      }
    }

    hash = hash || blockWeb.hash;
    const blockString = await redis.get(`eth:block:${hash}`);
    if (!blockString) {
      return;
    }

    const block = JSON.parse(blockString);
    if (!block.confirmed) {
      // TODO:执行交易确认task
      this.app.queue.eth.redisToMongo({
        transactions: block.transactions,
        blockNumber: block.number,
        blockHash: block.hash,
        timestamp: block.timestamp,
      });
      block.confirmed = true;
      await redis.set(`eth:block:${hash}`, JSON.stringify(block));
      // console.log('==========`eth:block:${hash}`===============', `eth:block:${hash}`);
      this.confirmBacktrack(null, block.parentHash, iteration + 1);
    }
    return;
  }
}

module.exports = EthSycnBlockCache;
