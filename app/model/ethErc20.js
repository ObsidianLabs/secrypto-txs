module.exports = app => {
  const mongoose = app.mongoose

  const EthErc20Schema = new mongoose.Schema(
    {
      _id: String,
      address: String,
      name: String,
      symbol: String,
      decimals: Number,
      icon: String
    },
    {
      typeKey: '$type',
      timestamps: {
        createdAt: 'created',
        updatedAt: 'updated'
      }
    }
  )
  return mongoose.model('eth_erc20', EthErc20Schema)
}
