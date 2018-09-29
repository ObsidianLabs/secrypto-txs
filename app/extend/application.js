/*
 * @Author: icezeros
 * @Date: 2018-09-11 17:00:03
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-26 20:14:50
 */
'use strict';
// const BAR = Symbol('Application#bar');
const Web3 = require('web3');
const moment = require('moment');
const _ = require('lodash');
const BigNumber = require('bignumber.js');
const OneSignal = require('onesignal-node');
const web3 = new Web3(process.env.WEB3HTTPURL);
const Notification = OneSignal.Notification;

const oneSignalClient = new OneSignal.Client({
  app: {
    appId: process.env.ONESIGNAL_APPID,
    appAuthKey: process.env.ONESIGNAL_APP_AUTH_KEY,
  },
});

module.exports = {
  get _() {
    // this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    if (!this[_]) {
      // 实际情况肯定更复杂
      this[_] = _;
    }
    return this[_];
  },
  get web3() {
    // this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    if (!this[web3]) {
      // 实际情况肯定更复杂
      this[web3] = new Web3(this.config.web3HttpUrl);
    }
    return this[web3];
  },
  get moment() {
    if (!this[moment]) {
      // 实际情况肯定更复杂
      this[moment] = moment;
    }
    return this[moment];
  },
  get BigNumber() {
    // this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    if (!this[BigNumber]) {
      // 实际情况肯定更复杂
      this[BigNumber] = BigNumber;
    }
    return this[BigNumber];
  },
  get oneSignalClient() {
    if (!this[oneSignalClient]) {
      // 实际情况肯定更复杂
      this[oneSignalClient] = oneSignalClient;
    }
    return this[oneSignalClient];
  },
  get Notification() {
    if (!this[Notification]) {
      // 实际情况肯定更复杂
      this[Notification] = Notification;
    }
    return this[Notification];
  },
  async sleep(duration = 500) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, duration);
    });
  },
};
