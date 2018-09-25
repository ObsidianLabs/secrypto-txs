/*
 * @Author: icezeros 
 * @Date: 2018-09-12 11:51:10 
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-25 12:02:46
 */
'use strict';
const OneSignal = require('onesignal-node');
const Notification = OneSignal.Notification;
const oneSignalClient = new OneSignal.Client({
  app: {
    appId: process.env.ONESIGNAL_APPID,
    appAuthKey: process.env.ONESIGNAL_APP_AUTH_KEY,
  },
});
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
    const addrFrom = transaction.from ? transaction.from.toLowerCase() : null;
    const addrTo = transaction.to ? transaction.to.toLowerCase() : null;
    transaction.from = addrFrom;
    transaction.to = addrTo;
    transaction.relevant = [addrFrom, addrTo];
    await redis.set(txHashRedis, JSON.stringify(transaction), 'EX', config.redisTxExpire);
    // TODO:这里之过滤出了ETH转账，合约交易 TO为null
    if (transaction.from && transaction.to) {
      app.queue.eth.filterTxs({
        txs: [
          {
            ...transaction,
          },
        ],
        type: 'pending',
      });
    }

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
    const txPushArr = [];
    // const txErr = [];
    txs.forEach((tx, k) => {
      if (tx) {
        const tmpTx = JSON.parse(tx);

        // TODO:这里之过滤出了ETH转账，合约交易 TO为null
        if (tmpTx.from && tmpTx.to) {
          txPushArr.push(tmpTx);
        }
        tmpTx._id = tmpTx.hash;
        tmpTx.blockNumber = blockNumber;
        tmpTx.blockHash = blockHash;
        tmpTx.timestamp = new Date(timestamp * 1000);
        tmpTx.relevant = [tmpTx.from.to, tmpTx.to];
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
      await app.queue.eth.filterTxs({
        txs: txPushArr,
        type: 'confirmed',
      });

      return;
    } catch (error) {
      console.log(error);
    }
  }

  async filterTxs(data, app, job) {
    const { txs, type } = data;
    const { redis } = app;
    const txsFilter = [];
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const task = tx.relevant.map(addr => {
        return redis.sismember('eth:address:set', (addr && addr.toLowerCase()) || null);
      });
      const addrExistses = await Promise.all(task);

      if (addrExistses.indexOf(1) >= 0) {
        tx.addrExistses = addrExistses;
        txsFilter.push(tx);
      }
    }

    txsFilter.forEach(tx => {
      app.queue.eth.appPush({
        tx,
        type,
      });
    });

    job.finished().then(() => {
      job.remove();
    });
    return;
  }

  async appPush(data, app, job) {
    try {
      const { tx, type, pushRetryArr = [] } = data;
      const { model, _, ethStandard } = app;
      const value = Number(tx.value) / ethStandard;

      // 判断任务是否是失败重试的任务
      if (pushRetryArr.length > 0) {
        const task = pushRetryArr.map(nf => oneSignalClient.sendNotification(nf));
        const taskResult = await Promise.all(task);

        // 过滤出还是失败的请求
        const resultArr = taskResult.map(re => {
          if (re.httpResponse.statusCode !== 200) {
            return 1;
          }
          return 0;
        });
        const pushRetryFilter = _.filter(pushRetryArr, (v, k) => {
          if (resultArr[k]) {
            return v;
          }
        });
        if (pushRetryFilter.length > 0) {
          await job.update({
            ...data,
            pushRetryArr: pushRetryFilter,
          });
          throw new Error();
        }
        job.finished().then(() => {
          job.remove();
        });
        return;
      }

      const wallets = await model.Wallet.find({ address: tx.relevant }).lean();
      const userIds = wallets.map(wallet => wallet.userId);
      if (userIds.length === 0) {
        return;
      }
      const users = await model.User.find({ userId: userIds }).lean();
      const pushObj = {
        sent: null,
        recieve: null,
      };

      wallets.forEach(wallet => {
        // 过滤出有oneSignalId的用户
        const user = _.find(users, user => {
          if (wallet.userId === user.userId && user.oneSignalId) {
            return user;
          }
        });

        if (user) {
          if (wallet.address === tx.from) {
            pushObj.sent = {
              user,
              wallet,
            };
          }
          if (wallet.address === tx.to) {
            pushObj.recieve = {
              user,
              wallet,
            };
          }
        }
      });

      console.log('========== type ===============', type);
      console.log('========== pushObj ===============', pushObj);

      if (!pushObj.sent && !pushObj.recieve) {
        return;
      }
      let notificationSent;
      let notificationRecieve;

      if (type === 'pending' && pushObj.recieve) {
        notificationRecieve = new Notification({
          headings: {
            en: `${pushObj.recieve.wallet.name}`,
            'zh-Hans': `${pushObj.recieve.wallet.name}`,
          },
          contents: {
            en: `An income of ${value} ETH to your wallet is on the way...`,
            'zh-Hans': `一笔${value} ETH的入账正在处理中……`,
          },
          include_player_ids: [pushObj.recieve.user.oneSignalId],
        });
      }

      if (type === 'confirmed') {
        if (pushObj.sent) {
          notificationSent = new Notification({
            headings: {
              en: `${pushObj.sent.wallet.name}`,
              'zh-Hans': `${pushObj.sent.wallet.name}`,
            },
            contents: {
              en: `Your transfer of ${value} ETH has been confirmed.`,
              'zh-Hans': `您的转账${value} ETH已确认完成。`,
            },
            include_player_ids: [pushObj.sent.user.oneSignalId],
          });
        }
        if (pushObj.recieve) {
          notificationRecieve = new Notification({
            headings: {
              en: `${pushObj.recieve.wallet.name}`,
              'zh-Hans': `${pushObj.recieve.wallet.name}`,
            },
            contents: {
              en: `Your wallet just received ${value} ETH.`,
              'zh-Hans': `您的钱包已确认收到${value} ETH。`,
            },
            include_player_ids: [pushObj.recieve.user.oneSignalId],
          });
        }
      }
      console.log('========== notificationSent ===============', notificationSent);
      console.log('========== notificationRecieve ===============', notificationRecieve);
      if (notificationSent) {
        const result = await oneSignalClient.sendNotification(notificationSent);
        if (result.httpResponse.statusCode !== 200) {
          pushRetryArr.push(notificationSent);
        }
      }
      if (notificationRecieve) {
        const result = await oneSignalClient.sendNotification(notificationRecieve);
        if (result.httpResponse.statusCode !== 200) {
          pushRetryArr.push(notificationRecieve);
        }
      }
      if (pushRetryArr.length > 0) {
        await job.update({
          ...data,
          pushRetryArr,
        });
        throw new Error(JSON.stringify(pushRetryArr));
      }

      job.finished().then(() => {
        job.remove();
      });
      return;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = EthQueue;
