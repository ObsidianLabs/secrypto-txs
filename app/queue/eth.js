/*
 * @Author: icezeros 
 * @Date: 2018-09-12 11:51:10 
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-13 19:33:32
 */
'use strict';
const Web3 = require('web3');
const web3Https = new Web3('https://mainnet.infura.io/wqMAgibGq1rDtBdmJ4TU');

class EthQueue {
  async cacheTransaction(data, app, job) {
    const { txHash } = data;
    const { redis, config } = app;
    const txHashRedis = `tx:eth:${txHash}`;
    if (!txHash) {
      job.finished().then(() => {
        job.remove();
      });
      return;
    }
    const txExists = await redis.exists(txHashRedis);
    if (txExists) {
      // const tx1 = await web3Https.eth.getTransaction(txHash);
      // const tx2 = await redis.get(txHashRedis);
      // let tx22;
      // try {
      //   tx22 = JSON.parse(tx2).blockNumber;
      // } catch (error) {
      //   tx22 = tx2;
      // }
      // console.log('----------- txExists ---------------', txHash);
      // console.log('----------- tx1 ---------------', tx1.blockNumber);
      // console.log('----------- tx2 ---------------', tx22);
      return;
    }
    const transaction = await web3Https.eth.getTransaction(txHash);
    if (!transaction) {
      // job.finished().then(() => {
      //   job.remove();
      // });
      console.log('----------- transaction ---------------', transaction);
    }
    await redis.set(txHashRedis, JSON.stringify(transaction), 'EX', config.redisTxExpire);
    job.finished().then(() => {
      job.remove();
    });
    return;
  }

  async redisToMongo(data, app, job) {
    const { txHashs, blockNumber, blockHash, timestamp } = data;
    const { redis, config } = app;
    if (txHashs.length === 0) {
      job.finished().then(() => {
        job.remove();
      });
      return;
    }

    const txs = await redis.mget(txHashs);
  }
}

module.exports = EthQueue;
