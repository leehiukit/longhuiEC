// app.js - 有闲甄选 入口文件
const API = require('./utils/api')

// 需要按账号隔离的数据 key（登录后会用 phone 做命名空间）
const SCOPED_KEYS = [
  'yxzx_addresses',
  'yxzx_orders',
  'yxzx_refunds',
  'yxzx_reviews',
  'yxzx_cart',
  'yxzx_search_history',
  'yxzx_favorites',
  'yxzx_coupons',
  'yxzx_selected_coupon'
]

App({
  onLaunch() {
    this.migrateStorageKeys()
    this.checkLoginStatus()
    this.initCart()

  // Storage Key 迁移（兼容旧版本数据）
  migrateStorageKeys() {
    const keyMap = [
      ['cart', 'yxzx_cart'],
      ['addresses', 'yxzx_addresses'],
      ['searchHistory', 'yxzx_search_history']
    ]
    keyMap.forEach(([oldKey, newKey]) => {
      try {
        const oldData = wx.getStorageSync(oldKey)
        if (oldData !== '' && oldData !== undefined) {
          const newData = wx.getStorageSync(newKey)
          if (newData === '' || newData === undefined) {
            wx.setStorageSync(newKey, oldData)
          }
        }
      } catch (e) { /* 忽略迁移错误 */ }
    })
  },

  // 获取当前账号标识（手机号），未登录返回 null
  getUserPhone() {
    try {
      const token = wx.getStorageSync('yxzx_token')
      if (token && token.phone) return token.phone
      const user = wx.getStorageSync('yxzx_user')
      if (user && user.phone) return user.phone
    } catch (_) { /* */ }
    return null
  },

  // 按账号隔离 storage key：未登录返回原 key，登录后返回 key_phone
  accountKey(baseKey) {
    const phone = this.getUserPhone()
    return phone ? `${baseKey}_${phone}` : baseKey
  },

  // 登录成功后：把旧全局数据迁移到当前账号名下
  onLoginSuccess(phone) {
    if (!phone) return
    SCOPED_KEYS.forEach(baseKey => {
      try {
        const scopedKey = `${baseKey}_${phone}`
        const scopedData = wx.getStorageSync(scopedKey)
        // 目标已存在则不覆盖
        if (scopedData !== '' && scopedData !== undefined) return
        // 尝试从旧全局 key 迁移
        const oldData = wx.getStorageSync(baseKey)
        if (oldData !== '' && oldData !== undefined) {
          wx.setStorageSync(scopedKey, oldData)
          // ★ 迁移后立即清除旧全局数据，防止后续其他账号误迁移
          wx.removeStorageSync(baseKey)
        }
      } catch (_) { /* */ }
    })
  },

  // 退出登录（不清除按账号隔离的数据，只清 token）
  logout() {
    wx.removeStorageSync('yxzx_token')
    wx.removeStorageSync('yxzx_user')
    this.globalData.isLoggedIn = false
    this.globalData.userInfo = null
    this.globalData.openid = ''
    this.globalData.cart = []
    wx.showToast({ title: '已退出登录', icon: 'none' })
  },

  // 检查登录状态（含 Token 过期检测 + openid 恢复）
  checkLoginStatus() {
    const tokenData = wx.getStorageSync('yxzx_token')
    if (!tokenData || !tokenData.token) return

    // 检查是否过期
    if (Date.now() > tokenData.expiresAt) {
      wx.removeStorageSync('yxzx_token')
      return
    }

    this.globalData.isLoggedIn = true
    this.globalData.userInfo = wx.getStorageSync('yxzx_user') || null
    this.globalData.openid = tokenData.openid || wx.getStorageSync('yxzx_user')?.openid || ''
  },

  // 获取用户订单列表
  getOrders() {
    return wx.getStorageSync(this.accountKey('yxzx_orders')) || []
  },

  // 保存订单
  saveOrders(orders) {
    wx.setStorageSync(this.accountKey('yxzx_orders'), orders)
  },

  // 添加订单
  addOrder(order) {
    const orders = this.getOrders()
    orders.unshift(order)
    this.saveOrders(orders)
    return order
  },

  // 更新订单状态
  updateOrderStatus(orderId, status, extra = {}) {
    const orders = this.getOrders()
    const order = orders.find(o => o.id === orderId)
    if (order) {
      Object.assign(order, { status, updateTime: new Date().toISOString() }, extra)
      // 状态变更触发物流时间
      if (status === 'paid') order.paidAt = new Date().toISOString()
      if (status === 'shipped') order.shippedAt = new Date().toISOString()
      if (status === 'completed') order.completedAt = new Date().toISOString()
      this.saveOrders(orders)
    }
    return order
  },

  // 获取订单统计数据
  getOrderStats() {
    const orders = this.getOrders()
    return {
      orderCount: orders.length,
      pendingCount: orders.filter(o => o.status === 'pending').length,
      paidCount: orders.filter(o => o.status === 'paid').length,
      shippedCount: orders.filter(o => o.status === 'shipped').length,
      completedCount: orders.filter(o => o.status === 'completed').length,
      cancelledCount: orders.filter(o => o.status === 'cancelled').length
    }
  },

  // ========== 售后/退款 ==========

  // 获取退款列表
  getRefunds() {
    return wx.getStorageSync(this.accountKey('yxzx_refunds')) || []
  },

  // 保存退款列表
  saveRefunds(refunds) {
    wx.setStorageSync(this.accountKey('yxzx_refunds'), refunds)
  },

  // 创建退款申请
  applyRefund(data) {
    const refund = {
      id: 'RF' + Date.now().toString(36).toUpperCase(),
      orderId: data.orderId,
      orderAmount: data.orderAmount,
      type: data.type,       // 'refund' 仅退款 | 'return' 退货退款
      reason: data.reason,
      description: data.description || '',
      images: data.images || [],
      amount: data.amount,
      status: 'pending',     // pending | approved | rejected | returning | refunded
      createdAt: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      timeline: [
        { time: new Date().toISOString(), text: '提交退款申请', done: true }
      ],
      logistics: null,       // 退货物流
      rejectReason: ''
    }
    const refunds = this.getRefunds()
    refunds.unshift(refund)
    this.saveRefunds(refunds)

    // 关联订单
    const orders = this.getOrders()
    const order = orders.find(o => o.id === data.orderId)
    if (order) {
      order.refundId = refund.id
      order.refundStatus = 'pending'
      this.saveOrders(orders)
    }
    return refund
  },

  // 更新退款状态
  updateRefundStatus(refundId, status, extra = {}) {
    const refunds = this.getRefunds()
    const refund = refunds.find(r => r.id === refundId)
    if (!refund) return null

    const now = new Date().toISOString()
    Object.assign(refund, { status, updateTime: now }, extra)

    // 添加时间线节点
    const textMap = {
      'approved':  '商家已同意退款申请',
      'rejected':  `商家已拒绝退款：${extra.rejectReason || '不符合退款条件'}`,
      'returning': '买家已寄回商品，等待商家收货',
      'refunded':  '退款已到账，售后完成'
    }
    if (textMap[status]) {
      refund.timeline.push({ time: now, text: textMap[status], done: true })
    }

    this.saveRefunds(refunds)

    // 同步订单状态
    const orders = this.getOrders()
    const order = orders.find(o => o.refundId === refundId)
    if (order) {
      order.refundStatus = status
      if (status === 'refunded') {
        order.status = 'afterSale'
      }
      this.saveOrders(orders)
    }
    return refund
  },

  // 填写退货物流
  submitReturnLogistics(refundId, logistics) {
    const refunds = this.getRefunds()
    const refund = refunds.find(r => r.id === refundId)
    if (!refund) return null
    refund.logistics = logistics
    refund.status = 'returning'
    refund.updateTime = new Date().toISOString()
    refund.timeline.push({
      time: new Date().toISOString(),
      text: `买家已寄回商品（${logistics.company}：${logistics.number}），等待商家收货`,
      done: true
    })
    this.saveRefunds(refunds)

    // 同步订单
    const orders = this.getOrders()
    const order = orders.find(o => o.refundId === refundId)
    if (order) {
      order.refundStatus = 'returning'
      this.saveOrders(orders)
    }

    // 同步到 ERP
    if (order && order.orderNo) {
      API.submitReturnTracking(
        order.orderNo,
        logistics.company,
        logistics.number
      ).catch(() => {})
    }

    return refund
  },

  // 获取某订单的退款记录
  getRefundByOrder(orderId) {
    const refunds = this.getRefunds()
    return refunds.find(r => r.orderId === orderId) || null
  },

  // ========== 评价系统 ==========

  // 获取评价列表
  getReviews() {
    return wx.getStorageSync(this.accountKey('yxzx_reviews')) || []
  },

  // 保存评价列表
  saveReviews(reviews) {
    wx.setStorageSync(this.accountKey('yxzx_reviews'), reviews)
  },

  // 添加评价
  addReview(data) {
    const review = {
      id: 'RV' + Date.now().toString(36).toUpperCase(),
      orderId: data.orderId,
      rating: data.rating,
      content: data.content || '',
      tags: data.tags || [],
      images: data.images || [],
      anonymous: data.anonymous || false,
      // 用户信息
      nickname: this.globalData.userInfo?.nickName || '用户',
      avatar: this.globalData.userInfo?.avatarUrl || '',
      // 商品信息（从订单获取）
      product: null,
      // 时间
      createdAt: new Date().toISOString(),
      createTimeText: this.formatTime(new Date())
    }

    // 从订单获取商品信息
    const orders = this.getOrders()
    const order = orders.find(o => o.id === data.orderId)
    if (order && order.items && order.items.length > 0) {
      const item = order.items[0]
      review.product = {
        id: item.id,
        title: item.title,
        image: item.image,
        price: item.price
      }
    }

    const reviews = this.getReviews()
    reviews.unshift(review)
    this.saveReviews(reviews)

    // 标记订单已评价
    if (order) {
      order.reviewed = true
      order.reviewId = review.id
      this.saveOrders(orders)
    }

    return review
  },

  // 根据ID获取评价
  getReviewById(reviewId) {
    const reviews = this.getReviews()
    return reviews.find(r => r.id === reviewId) || null
  },

  // 获取订单的评价
  getReviewByOrder(orderId) {
    const reviews = this.getReviews()
    return reviews.find(r => r.orderId === orderId) || null
  },

  // 格式化时间
  formatTime(date) {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  initCart() {
    const cartKey = this.accountKey('yxzx_cart')
    let cart = wx.getStorageSync(cartKey)
    // 缓存为空时写入默认购物车商品
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      cart = []
      wx.setStorageSync(cartKey, cart)
    }
    this.globalData.cart = cart
    this.updateCartBadge(cart.length)
  },

  updateCartBadge(count) {
    if (count > 0) {
      wx.setTabBarBadge({ index: 2, text: count.toString() })
    } else {
      wx.removeTabBarBadge({ index: 2 })
    }
  },

  globalData: {
    // 品牌信息
    brandName: '有闲甄选',
    brandSlogan: '品质好物 · 甄心严选',
    logoPath: '/images/logos/logo.jpg',
    appVersion: '1.0.1',    // 应用版本号

    userInfo: null,
    isLoggedIn: false,
    openid: '',             // 微信 openid（登录后写入）
    cart: []
  }
})