/*
 * @Author: icezeros
 * @Date: 2018-09-11 17:00:03
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-11 17:29:21
 */
'use strict';
// const BAR = Symbol('Application#bar');
const Web3 = require('web3');
const web3Https = new Web3('https://mainnet.infura.io/wqMAgibGq1rDtBdmJ4TU');

module.exports = {
  get web3Https() {
    // this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    if (!this[web3Https]) {
      // 实际情况肯定更复杂
      this[web3Https] = new Web3(this.config.web3HttpUrl);
    }
    return this[web3Https];
  },
};
