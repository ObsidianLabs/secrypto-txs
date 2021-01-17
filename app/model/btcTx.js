module.exports = app => {
  const mongoose = app.mongoose

  const BtcTxSchema = new mongoose.Schema(
    {
      _id: String,
      to: String,
      value: String,
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
  const model = mongoose.model('btc_txs', BtcTxSchema)
  return model
}
