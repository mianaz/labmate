// Test environment: jsdom + miniprogram-simulate (which defines Component /
// Behavior and renders WXML compiled by WeChat's own wcc) + our wx mock.
const simulate = require('miniprogram-simulate');
const wxMock = require('./wx-mock.cjs');

global.wx = Object.assign(global.wx || {}, wxMock);
global.__pages = [];
global.getCurrentPages = () => global.__pages;
global.getApp = () => ({ globalData: {} });

module.exports = { simulate, wxMock };
