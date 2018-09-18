module.exports = app => {
  const mongoose = app.mongoose;

  const TxEthSchema = new mongoose.Schema(
    {
      _id: String,
      blockHash: String,
      blockNumber: Number,
      from: String,
      to: String,
      relevant: Array,
      timestamp: Date,
      gas: Number,
      gasPrice: Number,
      input: String,
      nonce: Number,
      r: String,
      s: String,
      transactionIndex: Number,
      v: String,
      value: Number,
    },
    {
      typeKey: '$type',
      timestamps: {
        createdAt: 'created',
        updatedAt: 'updated',
      },
    }
  );
  TxEthSchema.index({ relevant: 1, timestamp: -1 });
  const model = mongoose.model('tx_eth_', TxEthSchema);
  model.at = ts => {
    return mongoose.model('tx_eth_' + ts, TxEthSchema);
  };
  return model;
};
