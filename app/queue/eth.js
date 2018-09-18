/*
 * @Author: icezeros 
 * @Date: 2018-09-12 11:51:10 
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-18 13:42:39
 */
'use strict';
class EthQueue {
  async cacheTransaction(data, app, job) {
    const { txHash, block } = data;
    const { redis, config } = app;
    const txHashRedis = `eth:tx:${txHash}`;
    if (!txHash) {
      job.finished().then(() => {
        job.remove();
      });
      return;
    }
    const txExists = await redis.exists(txHashRedis);
    if (txExists) {
      job.finished().then(() => {
        job.remove();
      });
      return;
    }
    const transaction = await app.web3Https.eth.getTransaction(txHash);
    if (!transaction) {
      // await
      // await job.retry();
      await job.update({
        ...data,
        time: new Date(),
        iteration: data.iteration ? (data.iteration += 3000) : 1000,
      });
      await app.sleep(data.iteration || 1000);
      throw new Error(`web3Https.eth.getTransaction(txHash) error ${txHash} ${new Date()}`);
    }
    await redis.set(txHashRedis, JSON.stringify(transaction), 'EX', config.redisTxExpire);
    job.finished().then(() => {
      job.remove();
    });
    return;
  }

  async redisToMongo(data, app, job) {
    const { transactions, blockNumber, blockHash, timestamp } = data;
    const { redis, config } = app;
    if (transactions.length === 0) {
      job.finished().then(() => {
        job.remove();
      });
      return;
    }
    const txHashs = transactions.map(txHash => `eth:tx:${txHash}`);
    const txs = await redis.mget(txHashs);
    const txArr = [];
    // const txErr = [];
    txs.forEach((tx, k) => {
      if (tx) {
        const tmpTx = JSON.parse(tx);
        tmpTx._id = tmpTx.hash;
        tmpTx.blockNumber = blockNumber;
        tmpTx.blockHash = blockHash;
        tmpTx.timestamp = new Date(timestamp * 1000);
        tmpTx.relevant = [tmpTx.from, tmpTx.to];
        delete tmpTx.txHash;

        txArr.push(tmpTx);

        // return tmpTx;
      } else {
        // return null;
        // txErr.push({
        //   tx,
        //   k,
        //   txHash: txHashs[k],
        // });
      }
    });

    // if (txErr.length !== 0) {
    //   await app.model.Test.create({
    //     blockNumber,
    //     blockHash,
    //     timestamp,
    //     txErr,
    //     txArr,
    //   });
    // }
    const startWeek = app
      .moment()
      .startOf('w')
      .unix();
    try {
      await app.model.TxEth.at(startWeek).create(txArr);
      job.finished().then(() => {
        job.remove();
      });
      return;
    } catch (error) {
      console.log(error);
    }
  }

  async filterTxs(data, app, job) {
    const { txs, type } = data;
    const { redis, config } = app;
    const addresses = [];
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const task = tx.relevant.map(addr => {
        return redis.sismember('eth:address:set', addr.toLowerCase());
      });
      const existses = await Promise.all(task);
      if (existses.indexOf(1) >= 0) {
        addresses.push(tx);
      }
    }

    // txs.forEach(async tx => {
    //   let matching = false;
    //   tx.relevant.forEach(async addr => {
    //     const addrExist = await redis.sismember('eth:address:set', addr);

    //     if (addrExist) {
    //       matching = true;
    //       addresses.push(tx);
    //     }
    //   });
    //   if (matching) {
    //     addresses.push(tx);
    //   }
    // });
  }
}

module.exports = EthQueue;
