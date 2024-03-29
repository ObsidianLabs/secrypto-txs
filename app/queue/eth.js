// const lodash = require('lodash')
// const moment = require('moment')
// const BigNumber = require('bignumber.js')

const InputDataDecoder = require('ethereum-input-data-decoder')

const erc20AbiJson = require('../data/erc20Abi.json')
const decoder = new InputDataDecoder(erc20AbiJson)

// const OneSignal = require('onesignal-node')
// const Notification = OneSignal.Notification
// const oneSignalClient = new OneSignal.Client({
//   app: {
//     appId: process.env.ONESIGNAL_APPID,
//     appAuthKey: process.env.ONESIGNAL_APP_AUTH_KEY
//   }
// })

class EthQueue {
  async cacheTransaction (data, app, job) {
    const { txHash } = data
    const { redis, config, model } = app

    let web3
    while (!web3) {
      const tmpWeb3 = app.web3
      const exceeded = await redis.get(`web3:${tmpWeb3._url}`)
      if (!exceeded) {
        web3 = tmpWeb3
      }
    }

    if (!txHash) {
      job.finished().then(() => {
        job.remove()
      })
      return
    }
    const redisKey = `eth:tx:${txHash}`
    if (await redis.exists(redisKey)) {
      job.finished().then(() => {
        job.remove()
      })
      return
    }

    let rawTx
    if (data.raw) {
      rawTx = data.raw
    } else {
      if (data.wait) {
        await app.sleep(data.wait)
      }
      try {
        rawTx = await web3.eth.getTransaction(txHash)
      } catch (e) {
        if (e.message.indexOf('daily request count exceeded') > -1) {
          await redis.set(`web3:${web3._url}`, 'exceeded', 'EX', 3600)
          await job.update({ ...data, index: web3._index, url: web3._url })
        }
        throw e
      }
    }
    await job.update({ ...data, raw: rawTx })

    if (!rawTx) {
      // await job.retry()
      await job.update({
        ...data,
        time: new Date(),
        wait: data.wait ? (data.wait + 10000) : 10000
      })
      throw new Error(`web3.eth.getTransaction(txHash) error ${txHash} ${new Date()}`)
    }

    // 过滤出 to=null   to=null为新创建的合约
    if (!rawTx.from || !rawTx.to) {
      job.finished().then(() => {
        job.remove()
      })
      return
    }

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

    if (rawTx.input && rawTx.input.startsWith('0xa9059cbb')) {
      let erc20 = await model.EthErc20.findById(to)
      if (!erc20) {
        let name, symbol, decimals
        try {
          const contract = new web3.eth.Contract(erc20AbiJson, to)
          name = await contract.methods.name().call()
          symbol = await contract.methods.symbol().call()
          decimals = await contract.methods.decimals().call()
        } catch (e) {
          console.warn(txHash)
          console.warn(e)
        }

        if (name || symbol) {
          try {
            erc20 = await model.EthErc20.findById(to)
            if (!erc20) {
              erc20 = await model.EthErc20.create({
                _id: to,
                name,
                symbol,
                decimals,
                icon: ''
              })
            }
          } catch (e) {
            console.warn(txHash)
            console.warn(e)
            await job.update({ ...data, raw: rawTx, error: e.message })
            throw e
          }
        }
      }

      if (erc20) {
        let decodedData
        try {
          decodedData = decoder.decodeData(rawTx.input)
        } catch (e) {
          console.warn(`Decode data error: ${txHash}`)
          console.warn(e)
          await job.update({ ...data, raw: rawTx, error: e.message })
          throw e
        }
        if (decodedData.method === 'transfer') {
          const erc20Receiver = `0x${decodedData.inputs[0].toLowerCase()}`
          const tokenValue = decodedData.inputs[1].toString()
          tx.token = to
          tx.to = erc20Receiver
          tx.symbol = erc20.symbol
          tx.decimals = erc20.decimals
          tx.relevant = [from, erc20Receiver]
          tx.tokenValue = tokenValue
        }
      }
    }

    if (tx.value !== '0' || (tx.tokenValue && tx.tokenValue !== '0')) {
      await redis.set(redisKey, JSON.stringify(tx), 'EX', config.redisTxExpire)
    }

    // app.queue.eth.filterTxs({
    //   txs: [tx],
    //   type: 'pending'
    // })

    job.finished().then(() => {
      job.remove()
    })
  }

  async filterTxs (data, app, job) {
    const hashs = data.txs.map(txHash => `eth:tx:${txHash}`)
    const cachedTxs = await app.redis.mget(hashs)

    await Promise.all(cachedTxs.map(async txJson => {
      if (!txJson) {
        return
      }
      const tx = JSON.parse(txJson)

      const key = `eth:trackings:${tx.token || 'eth'}`
      const isRelavent = await Promise.all(tx.relevant.map(addr => app.redis.sismember(key, addr)))
      if (!isRelavent.every(x => !x)) {
        app.queue.eth.redisToMongo(tx)
      }
    }))

    job.finished().then(() => {
      job.remove()
    })
  }

  async redisToMongo (data, app, job) {
    data._id = data.raw.hash
    const existed = await app.model.EthTx.findById(data._id)
    if (existed) {
      const { blockNumber, blockHash } = data.raw || {}
      const { blockNumber: rawNumber, blockHash: rawHash } = existed.raw || {}
      console.warn(`dup tx: ${data._id}\n${blockNumber} ${blockHash}\n${rawNumber} ${rawHash}\n`)
    } else {
      // const startWeek = moment().startOf('w').unix()
      await app.model.EthTx.create(data)
    }
    // job.finished().then(() => {
    //   job.remove()
    // })
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
