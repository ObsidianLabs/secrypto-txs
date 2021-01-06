/*
 * @Author: icezeros
 * @Date: 2018-09-11 17:00:03
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-26 20:14:50
 */
'use strict'

const Web3 = require('web3')

const web3 = new Web3(process.env.WEB3_HTTP_URL)

module.exports = {
  get web3 () {
    return web3
  },
  async sleep (duration = 500) {
    return new Promise(resolve => setTimeout(resolve, duration))
  }
}
