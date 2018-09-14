const bull = require('./lib/bull')

module.exports = app => {
  if (app.config.bull.app) bull(app)
}
