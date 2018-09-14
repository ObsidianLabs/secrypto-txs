module.exports = app => {
  const mongoose = app.mongoose;

  const UserSchema = new mongoose.Schema(
    {
      userId: { $type: String, unique: true },
      username: String,
      avatar: String,
      admin: Boolean,
      intercom: Boolean,
      hxPwd: String,
      mainWallet: String,
      created: { $type: Date, default: Date.now },
      ip: String,
      country: String,
      lastSeen: Date,
      sessions: { $type: Number, default: 0 },
    },
    { typeKey: '$type' }
  );

  return mongoose.model('user', UserSchema);
};
