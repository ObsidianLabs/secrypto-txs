'use strict';
const _ = require('lodash');
const moment = require('moment');
// _.moment = moment;
module.exports = {
  get _() {
    // this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    if (!this[_]) {
      // 实际情况肯定更复杂
      this[_] = _;
    }
    return this[_];
  },

  get moment() {
    if (!this[moment]) {
      // 实际情况肯定更复杂
      this[moment] = moment;
    }
    return this[moment];
  },
};
