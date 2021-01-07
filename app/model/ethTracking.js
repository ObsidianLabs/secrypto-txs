module.exports = app => {
  const mongoose = app.mongoose

  const EthTrackingSchema = new mongoose.Schema(
    {
      _id: String,
      address: String,
      token: String,
      track: Boolean
    },
    {
      typeKey: '$type',
      timestamps: {
        createdAt: 'created',
        updatedAt: 'updated'
      }
    }
  )
  return mongoose.model('eth_tracking', EthTrackingSchema)
}
