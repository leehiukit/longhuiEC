// 优惠券
const app = getApp()

// 模拟优惠券数据
const MOCK_COUPONS = [
  {
    id: 'cp1',
    title: '新人专享券',
    amount: 20,
    condition: '满200元可用',
    range: '全部商品',
    expireDate: '2026-12-31',
    status: 'valid'
  },
  {
    id: 'cp2',
    title: '笔记本品类券',
    amount: 100,
    condition: '满2000元可用',
    range: '笔记本类目',
    expireDate: '2026-09-30',
    status: 'valid'
  },
  {
    id: 'cp3',
    title: '618大促券',
    amount: 50,
    condition: '满500元可用',
    range: '全部商品',
    expireDate: '2026-06-18',
    status: 'used',
    usedDate: '2026-06-09'
  },
  {
    id: 'cp4',
    title: '五一专项券',
    amount: 30,
    condition: '无门槛',
    range: '全部商品',
    expireDate: '2026-05-05',
    status: 'expired'
  }
]

Page({
  data: {
    activeTab: 'valid',
    validCoupons: [],
    usedCoupons: [],
    expiredCoupons: []
  },

  onShow() {
    this.loadCoupons()
  },

  loadCoupons() {
    // 合并本地已使用的券与模拟数据
    const localUsed = wx.getStorageSync('yxzx_used_coupons') || []
    const allCoupons = MOCK_COUPONS.map(c => {
      if (localUsed.includes(c.id)) return { ...c, status: 'used', usedDate: '已使用' }
      return c
    })

    this.setData({
      validCoupons: allCoupons.filter(c => c.status === 'valid'),
      usedCoupons: allCoupons.filter(c => c.status === 'used'),
      expiredCoupons: allCoupons.filter(c => c.status === 'expired')
    })
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 选中优惠券并返回订单页
  selectCoupon(e) {
    const coupon = e.currentTarget.dataset.coupon
    wx.setStorageSync('yxzx_selected_coupon', coupon)
    wx.navigateBack()
  }
})
