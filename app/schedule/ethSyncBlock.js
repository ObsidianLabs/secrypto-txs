/*
 * @Author: icezeros
 * @Date: 2018-09-11 16:50:45
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-13 19:32:33
 */
'use strict';

const Web3 = require('web3');
const web3Https = new Web3('https://mainnet.infura.io/wqMAgibGq1rDtBdmJ4TU');

const Subscription = require('egg').Subscription;

class EthSycnBlockCache extends Subscription {
  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      interval: '5s', // 1 分钟间隔
      type: 'worker', // 指定所有的 worker 都需要执行
      immediate: true,
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {
    // const test = await this.app.model.TxEth.at('111').findOne();
    // const tx = await web3Https.eth.getTransaction('0x059b3993afe447893c2be6d41c3bf5ed130e6ccdf1e367bce7025a8967a98044');
    // const txRe = await web3Https.eth.getTransactionReceipt('0x059b3993afe447893c2be6d41c3bf5ed130e6ccdf1e367bce7025a8967a98044');
    // console.log('====== tx =====', tx);
    // console.log('====== tx =====', txRe);

    const newBlockNumber = await web3Https.eth.getBlockNumber();
    this.backtrack(newBlockNumber);
    // this.confirmBacktrack(newBlockNumber - 20);
  }

  async backtrack(blockNumber, hash, iteration = 0) {
    const { redis, config } = this.app;
    // const redisEthBlock = redis.get('ethBlock');
    console.log('--------blockNumber-------', blockNumber, hash);
    if (iteration > config.backtrackIteration) {
      return;
    }
    const block = await this.getBlock(blockNumber || hash);
    if (!block) {
      return;
    }
    if (blockNumber) {
      const blockExist = await redis.exists(`block:eth:${block.hash}`);
      if (blockExist) {
        return;
      }
    }
    await redis.set(`block:eth:${block.hash}`, JSON.stringify(block), 'EX', config.redisBlockExpire);
    //TODO:Queue Task eth.cacheTransaction
    this.cacheTransaction(block.transactions);
    const parentBlockExist = await redis.exists(`block:eth:${block.parentHash}`);
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
      const block = await web3Https.eth.getBlock(blockNumberOrHash);
      if (!block) {
        iteration++;
        console.log('--------------- getBlock --------------', block);
        continue;
      }
      action = false;
      return block;
    }
    return null;
  }

  async cacheTransaction(taransactions) {
    // console.log('====== taransactions  =======', taransactions);
    // TODO:执行cacheTransaction task
    taransactions.forEach(txHash => {
      this.app.queue.eth.cacheTransaction({ txHash });
    });
  }
  async confirmBacktrack(blockNumber, hash, iteration = 0) {
    const { redis, config } = this.app;
    if (iteration < config.confirmBacktrackIteration) {
      return;
    }
    let block;
    if (blockNumber) {
      block = await this.getBlock(blockNumber);
      if (!block) {
        return;
      }
    }
    hash = hash || block.hash;
    const blockString = await redis.get(`block:eth:${hash}`);
    if (!blockString) {
      return;
    }
    const block = JSON.parse(blockString);
    if (!block.confirmed) {
      // TODO:执行交易确认task
      block.confirmed = true;
      await redis.set(`block:eth:${hash}`, JSON.stringify(block));
      confirmBacktrack(block.parentHash, iteration + 1);
    }
    return;
  }
}

module.exports = EthSycnBlockCache;
