// 优惠券（对接 ERP）
const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    activeTab: 'valid',
    validCoupons: [],
    usedCoupons: [],
    expiredCoupons: [],
    loading: false
  },

  onShow() {
    this.loadCoupons()
  },

  async loadCoupons() {
    this.setData({ loading: true })
    try {
      const phone = (wx.getStorageSync('yxzx_user') || {}).phone
      if (!phone) {
        this.setData({ loading: false, validCoupons: [], usedCoupons: [], expiredCoupons: [] })
        return
      }

      const profileRes = await API.getCustomerProfile(phone)
      const customer = profileRes.customer
      const availableList = customer?.availableCoupons || []

      const formatCoupon = (c, extra = {}) => ({
        id: c.id,
        title: c.name,
        type: c.type,
        value: c.value,
        amount: c.type === 'FIXED_AMOUNT' ? c.value : 0,
        condition: c.minOrderAmount > 0 ? `满${c.minOrderAmount}元可用` : '无门槛',
        range: c.scope === 'ALL_PRODUCTS' ? '全部商品' : (c.scope || '指定商品'),
        expireDate: c.expiresAt ? c.expiresAt.split('T')[0] : '长期有效',
        status: 'valid',
        ...extra
      })

      const now = new Date()
      const validCoupons = []
      const expiredCoupons = []

      availableList.forEach(c => {
        const isExpired = c.expiresAt && new Date(c.expiresAt) < now
        if (isExpired) {
          expiredCoupons.push(formatCoupon(c, { status: 'expired' }))
        } else {
          validCoupons.push(formatCoupon(c))
        }
      })

      this.setData({ validCoupons, usedCoupons: [], expiredCoupons, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 选中优惠券并返回订单页（保留兼容）
  selectCoupon(e) {
    const coupon = e.currentTarget.dataset.coupon
    wx.setStorageSync(app.accountKey('yxzx_selected_coupon'), coupon)
    wx.navigateBack()
  }
})
