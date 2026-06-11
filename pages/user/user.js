// 用户中心逻辑 - 有闲甄选
const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    stats: { orderCount: 0, pendingCount: 0, shippedCount: 0, completedCount: 0 },
    orderTabs: [
      { icon: '💰', label: '待付款', status: 'pending', count: 0 },
      { icon: '📦', label: '待发货', status: 'paid', count: 0 },
      { icon: '🚚', label: '待收货', status: 'shipped', count: 0 },
      { icon: '⭐', label: '待评价', status: 'received', count: 0 }
    ],
    menus: [
      { icon: '❤️', label: '我的收藏', desc: '', url: '/pages/favorites/favorites', color: '#E8952A' },
      { icon: '📍', label: '收货地址', desc: '', url: '/pages/address/address', color: '#52c41a' },
      { icon: '🎫', label: '优惠券', desc: '', url: '/pages/coupons/coupons', color: '#1890ff' },
      { icon: '⚙️', label: '设置', desc: '', url: '/pages/settings/settings', color: '#666' }
    ]
  },

  onShow() {
    this.checkLogin()
    this.refreshStats()
  },

  checkLogin() {
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: app.globalData.userInfo || {}
    })
  },

  // 从本地订单实时计算统计数据
  refreshStats() {
    const stats = app.getOrderStats()
    const tabs = [...this.data.orderTabs]
    tabs[0].count = stats.pendingCount
    tabs[1].count = stats.paidCount
    tabs[2].count = stats.shippedCount
    tabs[3].count = stats.completedCount  // received 也算评价

    // 计算收藏数 & 优惠券数
    const favs = wx.getStorageSync(app.accountKey('yxzx_favorites')) || []
    const validCoupons = (wx.getStorageSync(app.accountKey('yxzx_coupons')) || []).filter(c => c.status === 'valid')

    const menus = [...this.data.menus]
    const favMenu = menus.find(m => m.label === '我的收藏')
    if (favMenu) favMenu.desc = favs.length > 0 ? `${favs.length}件` : ''
    const couponMenu = menus.find(m => m.label === '优惠券')
    if (couponMenu) couponMenu.desc = validCoupons.length > 0 ? `${validCoupons.length}张可用` : ''

    this.setData({
      stats,
      orderTabs: tabs,
      menus
    })
  },

  goLogin() { wx.navigateTo({ url: '/pages/login/login' }) },

  // 获取微信头像/昵称（需用户点击授权）
  async goProfile() {
    try {
      const profile = await API.getUserProfile()
      const userInfo = {
        ...(app.globalData.userInfo || {}),
        nickName: profile.nickName,
        avatarUrl: profile.avatarUrl
      }
      app.globalData.userInfo = userInfo
      wx.setStorageSync('yxzx_user', userInfo)
      this.setData({ userInfo })
      wx.showToast({ title: '资料已更新', icon: 'success' })
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消', icon: 'none' })
      } else {
        wx.showToast({ title: '获取失败，请重试', icon: 'none' })
      }
    }
  },

  // 跳转订单列表（带状态筛选）
  goOrders(e) {
    if (!app.globalData.isLoggedIn) {
      return wx.showModal({
        title: '需要登录',
        content: '请先登录后查看订单',
        confirmText: '去登录',
        success: res => { if (res.confirm) wx.navigateTo({ url: '/pages/login/login' }) }
      })
    }
    const status = e.currentTarget.dataset.status || 'all'
    wx.navigateTo({ url: `/pages/orders/orders?tab=${status}` })
  },

  handleMenu(e) {
    const url = e.currentTarget.dataset.url
    if (!app.globalData.isLoggedIn) {
      return wx.showModal({
        title: '需要登录',
        content: '请先登录以享受完整服务',
        confirmText: '去登录',
        success: res => { if (res.confirm) wx.navigateTo({ url: '/pages/login/login' }) }
      })
    }
    if (url && url.startsWith('/pages/')) {
      wx.navigateTo({ url })
    } else {
      wx.showToast({ title: '功能开发中...', icon: 'none' })
    }
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          this.setData({ isLoggedIn: false, userInfo: {} })
          this.refreshStats()
        }
      }
    })
  }
})