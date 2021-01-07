/*
 * @Author: icezeros
 * @Date: 2018-09-11 17:00:03
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-26 20:14:50
 */
'use strict'

const Web3 = require('web3')

const urls = process.env.WEB3_HTTP_URLS.split(',')
const n = urls.length
const web3s = urls.map(url => new Web3(url))

module.exports = {
  get web3 () {
    return web3s[Math.floor(Math.random() * n)]
  },
  async sleep (duration = 500) {
    return new Promise(resolve => setTimeout(resolve, duration))
  }
}
