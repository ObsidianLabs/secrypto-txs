// const lodash = require('lodash')
const moment = require('moment')
// const BigNumber = require('bignumber.js')

const InputDataDecoder = require('ethereum-input-data-decoder')
const OneSignal = require('onesignal-node')

const erc20AbiJson = require('../data/erc20Abi.json')

const decoder = new InputDataDecoder(erc20AbiJson)

// const Notification = OneSignal.Notification
// const oneSignalClient = new OneSignal.Client({
//   app: {
//     appId: process.env.ONESIGNAL_APPID,
//     appAuthKey: process.env.ONESIGNAL_APP_AUTH_KEY
//   }
// })

class EthQueue {
  async cacheTransaction (data, app, job) {
    console.log('cacheTransaction')
    const { txHash } = data
    const { redis, config, web3, model } = app
    // const { fromWei, hexToNumberString, BN, isAddress, isBigNumber, isBN } = web3.utils;
    const redisKey = `eth:tx:${txHash}`
    if (!txHash) {
      job.finished().then(() => {
        job.remove()
      })
      return
    }
    // const txExists = await redis.exists(redisKey)
    // if (txExists) {
    //   job.finished().then(() => {
    //     job.remove()
    //   })
    //   return
    // }
    job.finished().then(() => {
      job.remove()
    })
    return

    const rawTx = await web3.eth.getTransaction(txHash)
    if (!rawTx) {
      // await job.retry()
      await job.update({
        ...data,
        time: new Date(),
        iteration: data.iteration ? (data.iteration += 3000) : 1000
      })
      await app.sleep(data.iteration || 1000)
      throw new Error(`web3.eth.getTransaction(txHash) error ${txHash} ${new Date()}`)
    }
    // 过滤出 to=null   to=null为新创建的合约
    if (!rawTx.from || !rawTx.to) {
      job.finished().then(() => {
        job.remove()
      })
      return
    }
    try {
      const from = rawTx.from.toLowerCase()
      const to = rawTx.to.toLowerCase()
      const tx = {
        from,
        to,
        value: rawTx.value,
        symbol: 'ETH',
        decimals: 18,
        relevant: [from, to],
        raw: rawTx
      }

      console.log(tx)
      // const from =
      // const to = rawTx.to.toLowerCase()
      // transaction.from = addrFrom
      // transaction.to = addrTo
      // transaction.symbol = 'ETH'
      // transaction.relevant = [addrFrom, addrTo]
      // transaction.decimals = 18
      // console.log('=========transaction.input.indexOf()============ ', transaction.input.indexOf('0xa9059cbb'))
      if (rawTx.input && rawTx.input.startsWith('0xa9059cbb')) {
        // let erc20 = await model.EthErc20.findOne({ _id: to }).lean()
        // // let ercDecodeFlag = true
        // if (!erc20) {
        //   try {
        //     const contract = new web3.eth.Contract(erc20AbiJson, to)
        //     const symbol = await contract.methods.symbol().call()
        //     const name = await contract.methods.name().call()
        //     const decimals = await contract.methods.decimals().call()
        //     const EthErc20Data = {
        //       _id: to,
        //       name,
        //       decimals,
        //       symbol,
        //       icon: ''
        //     }
        //     erc20 = EthErc20Data
        //     // ethErc20[addrTo] = EthErc20Data
        //     erc20 = await model.EthErc20.create(EthErc20Data)
        //   } catch (error) {
        //     // ercDecodeFlag = false;
        //     await redis.sadd('eth:address:ttt', `${to}:${error.message}`)
        //   }
        // }

        // if (erc20) {
        //   const decodedData = decoder.decodeData(rawTx.input)
        //   if (decodedData.name === 'transfer') {
        //     const erc20RecieveAddr = `0x${decodedData.inputs[0].toLowerCase()}`
        //     const erc20RecValue = BigNumber(decodedData.inputs[1]).toFixed(0)
        //     tx.symbol = erc20.symbol
        //     tx.decimals = erc20.decimals
        //     tx.relevant.push(erc20RecieveAddr)
        //     tx.tokenValue = erc20RecValue
        //   }
        // }
      }

      await redis.set(redisKey, JSON.stringify(tx), 'EX', config.redisTxExpire)
      // TODO:这里之过滤出了ETH转账，合约交易 TO为null

      // app.queue.eth.filterTxs({
      //   txs: [tx],
      //   type: 'pending'
      // })

      job.finished().then(() => {
        job.remove()
      })
    } catch (e) {
      console.warn(e)
      throw e
    }
  }

  async redisToMongo (data, app, job) {
    const { transactions, blockNumber, blockHash, timestamp } = data
    const { redis, config } = app
    if (transactions.length === 0) {
      job.finished().then(() => {
        job.remove()
      })
      return
    }
    const txHashs = transactions.map(txHash => `eth:tx:${txHash}`)
    const txs = await redis.mget(txHashs)
    const txArr = []
    const txPushArr = []
    // const txErr = [];
    txs.forEach((tx, k) => {
      if (tx) {
        const tmpTx = JSON.parse(tx)

        // TODO:这里之过滤出了ETH转账，合约交易 TO为null
        if (tmpTx.from && tmpTx.to) {
          txPushArr.push(tmpTx)
        }
        tmpTx._id = tmpTx.hash
        tmpTx.blockNumber = blockNumber
        tmpTx.blockHash = blockHash
        tmpTx.timestamp = new Date(timestamp * 1000)
        delete tmpTx.txHash

        txArr.push(tmpTx)

        // return tmpTx;
      } else {
        // return null;
        // txErr.push({
        //   tx,
        //   k,
        //   txHash: txHashs[k],
        // });
      }
    })

    // if (txErr.length !== 0) {
    //   await app.model.Test.create({
    //     blockNumber,
    //     blockHash,
    //     timestamp,
    //     txErr,
    //     txArr,
    //   });
    // }
    const startWeek = moment().startOf('w').unix()
    try {
      await app.model.TxEth.at(startWeek).create(txArr)
      job.finished().then(() => {
        job.remove()
      })
      app.queue.eth.filterTxs({
        txs: txPushArr,
        type: 'confirmed'
      })

      return
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  async filterTxs (data, app, job) {
    const { txs, type } = data
    const { redis } = app
    const txsFilter = []
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i]
      const task = tx.relevant.map(addr => {
        return redis.sismember('eth:address:set', (addr && addr.toLowerCase()) || null)
      })
      const addrExistses = await Promise.all(task)

      if (addrExistses.indexOf(1) >= 0) {
        tx.addrExistses = addrExistses
        txsFilter.push(tx)
      }
    }

    txsFilter.forEach(tx => {
      // app.queue.eth.appPush({ tx, type })
    })

    job.finished().then(() => {
      job.remove()
    })
  }

  // async appPush (data, app, job) {
  //   const { tx, type, pushRetryArr = [] } = data
  //   const { model } = app
  //   const { symbol, decimals = 18, relevant, value, tokenValue } = tx
  //   const sentAddr = lodash.head(relevant)
  //   const receiveAddr = lodash.last(relevant)
  //   const pushValue = BigNumber(value !== '0' ? value : tokenValue)
  //     .dividedBy(10 ** (decimals || 0))
  //     .toString()
  //   if (pushValue === 'NaN') {
  //     await job.finished()
  //     await job.remove()
  //     return
  //   }
  //   // console.log('------------tx---------------', tx);
  //   // 判断任务是否是失败重试的任务
  //   if (pushRetryArr.length > 0) {
  //     const task = pushRetryArr.map(nf => oneSignalClient.sendNotification(nf))
  //     const taskResult = await Promise.all(task)

  //     // 过滤出还是失败的请求
  //     const resultArr = taskResult.map(re => {
  //       if (re.httpResponse.statusCode !== 200) {
  //         return 1
  //       }
  //       return 0
  //     })
  //     const pushRetryFilter = lodash.filter(pushRetryArr, (v, k) => {
  //       if (resultArr[k]) {
  //         return v
  //       }
  //     })
  //     if (pushRetryFilter.length > 0) {
  //       await job.update({
  //         ...data,
  //         pushRetryArr: pushRetryFilter
  //       })
  //       throw new Error()
  //     }
  //     job.finished().then(() => {
  //       job.remove()
  //     })
  //     return
  //   }

  //   const wallets = await model.Wallet.find({ address: tx.relevant }).lean()
  //   const userIds = wallets.map(wallet => wallet.userId)
  //   if (userIds.length === 0) {
  //     job.finished().then(() => {
  //       job.remove()
  //     })
  //     return
  //   }
  //   const users = await model.User.find({ userId: userIds }).lean()
  //   const pushObj = {
  //     sent: null,
  //     recieve: null
  //   }
  //   wallets.forEach(wallet => {
  //     // 过滤出有oneSignalId的用户
  //     const user = lodash.find(users, user => {
  //       if (wallet.userId === user.userId && user.oneSignalId) {
  //         return user
  //       }
  //     })

  //     if (user) {
  //       if (wallet.address === sentAddr) {
  //         pushObj.sent = {
  //           user,
  //           wallet
  //         }
  //       }
  //       if (wallet.address === receiveAddr) {
  //         pushObj.recieve = {
  //           user,
  //           wallet
  //         }
  //       }
  //     }
  //   })
  //   if (!pushObj.sent && !pushObj.recieve) {
  //     job.finished().then(() => {
  //       job.remove()
  //     })
  //     return
  //   }
  //   let notificationSent
  //   let notificationRecieve

  //   if (type === 'pending' && pushObj.recieve) {
  //     notificationRecieve = new Notification({
  //       headings: {
  //         en: `${pushObj.recieve.wallet.name}`,
  //         'zh-Hans': `${pushObj.recieve.wallet.name}`
  //       },
  //       contents: {
  //         en: `An income of ${pushValue} ${symbol} to your wallet is on the way...`,
  //         'zh-Hans': `一笔${pushValue} ${symbol}的入账正在处理中……`
  //       },
  //       include_player_ids: [pushObj.recieve.user.oneSignalId],
  //       android_channel_id: ['751896e6-fcb5-4acf-97d9-2d652df16632']
  //     })
  //   }

  //   if (type === 'confirmed') {
  //     if (pushObj.sent) {
  //       notificationSent = new Notification({
  //         headings: {
  //           en: `${pushObj.sent.wallet.name}`,
  //           'zh-Hans': `${pushObj.sent.wallet.name}`
  //         },
  //         contents: {
  //           en: `Your transfer of ${pushValue} ${symbol} has been confirmed.`,
  //           'zh-Hans': `您的转账${pushValue} ${symbol}已确认完成。`
  //         },
  //         include_player_ids: [pushObj.sent.user.oneSignalId],
  //         android_channel_id: ['751896e6-fcb5-4acf-97d9-2d652df16632']
  //       })
  //     }
  //     if (pushObj.recieve) {
  //       notificationRecieve = new Notification({
  //         headings: {
  //           en: `${pushObj.recieve.wallet.name}`,
  //           'zh-Hans': `${pushObj.recieve.wallet.name}`
  //         },
  //         contents: {
  //           en: `Your wallet just received ${pushValue} ${symbol}.`,
  //           'zh-Hans': `您的钱包已确认收到${pushValue} ${symbol}。`
  //         },
  //         include_player_ids: [pushObj.recieve.user.oneSignalId],
  //         android_channel_id: ['751896e6-fcb5-4acf-97d9-2d652df16632']
  //       })
  //     }
  //   }
  //   if (notificationSent) {
  //     const result = await oneSignalClient.sendNotification(notificationSent)
  //     if (result.httpResponse.statusCode !== 200) {
  //       pushRetryArr.push(notificationSent)
  //     }
  //   }
  //   if (notificationRecieve) {
  //     const result = await oneSignalClient.sendNotification(notificationRecieve)
  //     if (result.httpResponse.statusCode !== 200) {
  //       pushRetryArr.push(notificationRecieve)
  //     }
  //   }
  //   if (pushRetryArr.length > 0) {
  //     await job.update({
  //       ...data,
  //       pushRetryArr
  //     })
  //     throw new Error(JSON.stringify(pushRetryArr))
  //   }

  //   job.finished().then(() => {
  //     job.remove()
  //   })
  // }
}

module.exports = EthQueue
