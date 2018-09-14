/*
 * @Author: icezeros
 * @Date: 2018-09-11 14:21:50
 * @Last Modified by: icezeros
 * @Last Modified time: 2018-09-11 17:35:34
 */
'use strict';

module.exports = app => {
  app.cache = {
    blockNumber: 0,
  };

  // app.beforeStart(async () => {
  //   // 应用会等待这个函数执行完成才启动
  //   app.cities = await app.curl('http://example.com/city.json', {
  //     method: 'GET',
  //     dataType: 'json',
  //   });
  //   // 也可以通过以下方式来调用 Service
  //   // const ctx = app.createAnonymousContext();
  //   // app.cities = await ctx.service.cities.load();
  // });
};
