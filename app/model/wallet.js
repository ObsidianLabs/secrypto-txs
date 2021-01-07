module.exports = app => {
  const mongoose = app.mongoose

  const WalletSchema = new mongoose.Schema(
    {
      userId: String,
      name: String,
      address: { $type: String, unique: true },
      chain: String,
      type: String,
      balance: Number,
      notScrp: { $type: Boolean, default: false },
      backup: { $type: Boolean, default: false },
      tokens: { $type: Array, default: [] },
      deleted: { $type: Boolean, default: false }
    },
    {
      typeKey: '$type',
      timestamps: {
        createdAt: 'created',
        updatedAt: 'updated'
      }
    }
  )

  return mongoose.model('wallet', WalletSchema)
}
