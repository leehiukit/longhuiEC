// 协议详情页
Page({
  data: {
    type: 'service' // service | privacy
  },

  onLoad(options) {
    const type = options.type || 'service'
    const titles = { service: '服务协议', privacy: '隐私政策' }
    wx.setNavigationBarTitle({ title: titles[type] || '协议详情' })
    this.setData({ type })
  }
})
