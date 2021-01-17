module.exports = app => {
  const mongoose = app.mongoose

  const BtcTrackingSchema = new mongoose.Schema(
    {
      _id: String,
      address: String,
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
  return mongoose.model('btc_tracking', BtcTrackingSchema)
}
