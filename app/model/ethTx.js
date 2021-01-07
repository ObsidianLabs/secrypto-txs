module.exports = app => {
  const mongoose = app.mongoose

  const EthTxSchema = new mongoose.Schema(
    {
      _id: String,
      from: String,
      to: String,
      value: String,
      symbol: String,
      decimals: Number,
      token: String,
      tokenValue: String,
      relevant: Array,
      raw: Object
    },
    {
      typeKey: '$type',
      timestamps: {
        createdAt: 'created',
        updatedAt: 'updated'
      }
    }
  )
  // EthTxSchema.index({ relevant: 1, timestamp: -1 })
  const model = mongoose.model('eth_txs', EthTxSchema)
  model.at = ts => {
    return mongoose.model('eth_txs_' + ts, EthTxSchema)
  }
  return model
}
