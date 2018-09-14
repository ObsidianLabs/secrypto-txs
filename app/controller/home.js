'use strict';

const Controller = require('egg').Controller;

class HomeController extends Controller {
  async index() {
    console.log(this.app.model.TxEth['1111']);
    this.ctx.body = 'hi, egg';
  }
}

module.exports = HomeController;
