class BtcQueue {
  async cacheTransaction (data, app, job) {
    const { blockHash, raw } = data
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

    const ins = {}
    const outs = {}
    data.raw.inputs.forEach(input => {
      if (input.prev_out && input.prev_out.addr) {
        if (!ins[input.prev_out.addr]) {
          ins[input.prev_out.addr] = 0
        }
        ins[input.prev_out.addr] += input.prev_out.value
      }
    })
    data.raw.out.forEach(out => {
      if (out.addr) {
        if (!outs[out.addr]) {
          outs[out.addr] = 0
        }
        outs[out.addr] += out.value
      }
    })
    const delta = { ...outs }
    Object.keys(outs).forEach(key => {
      if (ins[key]) {
        delta[key] -= ins[key]
      }
    })

    const tx = {
      relevant: raw.out.map(utxo => utxo.addr),
      raw,
      ins,
      outs,
      delta
    }

    await redis.set(redisKey, JSON.stringify(tx), 'EX', config.redisTxExpire)
    await redis.sadd(`btc:txs_by_hash:${blockHash}`, raw.hash)

    job.finished().then(() => {
      job.remove()
    })
  }

  async filterTxs (data, app, job) {
    const { blockHash } = data
    const { redis } = app

    const members = await redis.smembers(`btc:txs_by_hash:${blockHash}`)

    const hashs = members.map(txHash => `btc:tx:${txHash}`)
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
      const { block_height: blockHeight, hash } = data.raw || {}
      const { block_height: rawBlockHeight, hash: rawHash } = existed.raw || {}
      console.warn(`dup tx: ${data._id}\n${blockHeight} ${hash}\n${rawBlockHeight} ${rawHash}\n`)
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
