const { Service } = require('egg')

class BtcService extends Service {
  async getLatestBlock () {
    const result = await this.ctx.curl('https://blockchain.info/latestblock', { dataType: 'json' })
    return result.data
  }

  async getBlockByHash (blockHash) {
    console.log(blockHash)
    const result = await this.ctx.curl(`https://blockchain.info/rawblock/${blockHash}`, {
      dataType: 'json',
      timeout: 30000
    })
    return result.data
  }
}

module.exports = BtcService
