class BtcQueue {
  async cacheTransaction (data, app, job) {
    const { raw } = data
    const { redis, config } = app
    if (!raw) {
      job.finished().then(() => {
        job.remove()
      })
      return
    }
    const redisKey = `btc:tx:${raw.hash}`
    if (await redis.exists(redisKey)) {
      job.finished().then(() => {
        job.remove()
      })
      return
    }

    const tx = {
      relevant: raw.out.map(utxo => utxo.addr),
      raw
    }

    await redis.set(redisKey, JSON.stringify(tx), 'EX', config.redisTxExpire)

    // job.finished().then(() => {
    //   job.remove()
    // })
  }

  async filterTxs (data, app, job) {
    const hashs = data.txs.map(txHash => `btc:tx:${txHash}`)
    const cachedTxs = await app.redis.mget(hashs)

    await Promise.all(cachedTxs.map(async txJson => {
      if (!txJson) {
        return
      }
      const tx = JSON.parse(txJson)

      const key = 'btc:trackings'
      const isRelavent = await Promise.all(tx.relevant.map(addr => app.redis.sismember(key, addr)))
      if (!isRelavent.every(x => !x)) {
        app.queue.btc.redisToMongo(tx)
      }
    }))

    job.finished().then(() => {
      job.remove()
    })
  }

  async redisToMongo (data, app, job) {
    data._id = data.raw.hash
    const existed = await app.model.BtcTx.findById(data._id)
    if (existed) {
      const { blockNumber, blockHash } = data.raw || {}
      const { blockNumber: rawNumber, blockHash: rawHash } = existed.raw || {}
      console.warn(`dup tx: ${data._id}\n${blockNumber} ${blockHash}\n${rawNumber} ${rawHash}\n`)
    } else {
      // const startWeek = moment().startOf('w').unix()
      await app.model.BtcTx.create(data)
    }
    // job.finished().then(() => {
    //   job.remove()
    // })
  }
}

module.exports = BtcQueue
