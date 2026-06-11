// 订单确认页逻辑 - 有闲甄选（已对接微信支付）
const app = getApp()
const API = require('../../utils/api')

// 模拟优惠券（与 coupons.js 保持同步）
const MOCK_COUPONS = [
  { id: 'cp1', title: '新人专享券',  amount: 20,  condition: '满200元可用',  range: '全部商品',  expireDate: '2026-12-31', status: 'valid' },
  { id: 'cp2', title: '笔记本品类券', amount: 100, condition: '满2000元可用', range: '笔记本类目', expireDate: '2026-09-30', status: 'valid' },
  { id: 'cp3', title: '618大促券',   amount: 50,  condition: '满500元可用',  range: '全部商品',  expireDate: '2026-06-18', status: 'used',   usedDate: '2026-06-09' },
  { id: 'cp4', title: '五一专项券',  amount: 30,  condition: '无门槛',      range: '全部商品',  expireDate: '2026-05-05', status: 'expired' }
]

Page({
  data: {
    address: null,
    orderItems: [],
    coupons: [],
    coupon: null,
    remark: '',
    totalAmount: 0,
    freight: 0,
    finalPrice: 0,
    submitting: false,
    // 支付弹层
    showPayment: false,
    paying: false,
    payMethod: 'wechat',
    paymentResult: null
  },

  onLoad(options) {
    // 从订单列表「去支付」进入 → 直接加载已有订单
    if (options.repayId) {
      this.loadExistingOrder(options.repayId)
      return
    }
    this.loadOrderData()
    this.loadAddress()
  },

  // 加载已存在订单（从订单列表去支付）
  loadExistingOrder(orderId) {
    const orders = app.getOrders()
    const order = orders.find(o => o.id === orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    if (order.status !== 'pending') {
      wx.showToast({ title: '该订单已处理', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }

    // 复现订单页数据结构
    const orderItems = (order.items || []).map(item => ({
      id: item.id,
      title: item.title,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      selected: true
    }))

    // 加载可用优惠券
    const totalAmount = order.totalAmount || 0
    const localUsed = wx.getStorageSync('yxzx_used_coupons') || []
    const coupons = MOCK_COUPONS.filter(c => {
      if (localUsed.includes(c.id)) return false
      if (c.status === 'used' || c.status === 'expired') return false
      const match = c.condition.match(/满(\d+)元可用/)
      if (match && totalAmount < parseFloat(match[1])) return false
      return true
    })

    this.currentOrderId = order.id
    this.currentOrderNo = order.orderNo || ''

    this.setData({
      orderItems,
      totalAmount: order.totalAmount.toFixed(2),
      finalPrice: order.finalPrice.toFixed(2),
      freight: order.freight || 0,
      coupons,
      showPayment: true  // 直接弹出支付弹层
    })

    this.loadAddress()
  },

  onShow() {
    // 从地址选择页返回时刷新地址
    if (this.data.address) this.loadAddress()
    // 从优惠券页返回时读取选中的券
    const selectedCoupon = wx.getStorageSync('yxzx_selected_coupon')
    if (selectedCoupon) {
      wx.removeStorageSync('yxzx_selected_coupon')
      this.applyCoupon(selectedCoupon)
    }
  },

  // 选择优惠券
  selectCoupon() {
    wx.navigateTo({ url: '/pages/coupons/coupons' })
  },

  // 应用优惠券
  applyCoupon(coupon) {
    const cart = (app.globalData.cart || []).filter(item => item.selected)
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const finalPrice = Math.max(this.data.freight + totalAmount - (coupon ? coupon.amount : 0), 0)
    this.setData({
      coupon,
      totalAmount: totalAmount.toFixed(2),
      finalPrice: finalPrice.toFixed(2)
    })
  },

  // 清除已选优惠券
  clearCoupon(e) {
    e.stopPropagation()
    const cart = (app.globalData.cart || []).filter(item => item.selected)
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    this.setData({
      coupon: null,
      totalAmount: totalAmount.toFixed(2),
      finalPrice: (this.data.freight + totalAmount).toFixed(2)
    })
  },

  loadOrderData() {
    const cart = (app.globalData.cart || []).filter(item => item.selected)

    if (cart.length === 0) {
      wx.showToast({ title: '没有选中商品', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const finalPrice = this.data.freight + totalAmount - (this.data.coupon?.amount || 0)

    // 加载可用优惠券（过滤已使用/已过期，根据订单金额判断是否满足条件）
    const localUsed = wx.getStorageSync('yxzx_used_coupons') || []
    const coupons = MOCK_COUPONS.filter(c => {
      if (localUsed.includes(c.id)) return false
      if (c.status === 'used' || c.status === 'expired') return false
      // 检查门槛条件
      const match = c.condition.match(/满(\d+)元可用/)
      if (match && totalAmount < parseFloat(match[1])) return false
      return true
    })

    this.setData({
      orderItems: cart,
      totalAmount: totalAmount.toFixed(2),
      finalPrice: Math.max(finalPrice, 0).toFixed(2),
      coupons
    })
  },

  loadAddress() {
    const addresses = wx.getStorageSync('yxzx_addresses') || []
    const defaultAddr = addresses.find(addr => addr.isDefault) || addresses[0]
    if (defaultAddr) {
      this.setData({ address: defaultAddr })
    }
  },

  selectAddress() {
    wx.navigateTo({ url: '/pages/address/address?selectMode=1' })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  // 第一步：提交订单（同步 ERP）
  async submitOrder() {
    if (!this.data.address) {
      return wx.showToast({ title: '请选择收货地址', icon: 'none' })
    }

    this.setData({ submitting: true })

    const { orderItems, address, remark, totalAmount, finalPrice } = this.data
    const userInfo = app.globalData.userInfo || {}

    // 本地订单 ID
    const orderId = 'YX' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()

    let erpOrderNo = ''

    // 同步到 ERP
    try {
      const addrJson = JSON.stringify({
        province: address.province || '',
        city: address.city || '',
        district: address.district || '',
        detail: address.detail || ''
      })
      const erpRes = await API.createEcommerceOrder({
        buyerName: address.name || '未填写',
        buyerPhone: address.phone || '',
        buyerAddress: addrJson,
        buyerNotes: remark || '',
        items: orderItems.map(item => ({ productId: item.id, quantity: item.quantity }))
      })
      erpOrderNo = erpRes.orderNo || ''
    } catch (e) {
      // ERP 下单失败不阻断本地流程
      // console.warn('[ERP] 创建订单失败:', e.message)
    }

    const order = {
      id: orderId,
      orderNo: erpOrderNo,  // ERP 订单号
      status: 'pending',     // pending | paid | shipped | received | completed | cancelled
      userId: userInfo.phone || 'guest',
      items: orderItems.map(item => ({
        id: item.id,
        title: item.title,
        image: item.image,
        price: item.price,
        quantity: item.quantity
      })),
      address: {
        name: address.name,
        phone: address.phone,
        full: `${address.province}${address.city}${address.district} ${address.detail}`
      },
      remark,
      totalAmount: parseFloat(totalAmount),
      finalPrice: parseFloat(finalPrice),
      freight: this.data.freight,
      createdAt: new Date().toISOString(),
      updateTime: new Date().toISOString()
    }

    // 保存订单
    app.addOrder(order)

    // 清除购物车中已下单的商品
    let cart = app.globalData.cart || []
    cart = cart.filter(item => !item.selected)
    app.globalData.cart = cart
    wx.setStorageSync('yxzx_cart', cart)
    app.updateCartBadge(cart.length)

    this.currentOrderId = orderId
    this.currentOrderNo = erpOrderNo
    this.setData({ submitting: false, showPayment: true })
  },

  // 第二步：选择支付方式
  selectPayMethod(e) {
    this.setData({ payMethod: e.currentTarget.dataset.method })
  },

  // 第三步：确认支付（已对接微信支付）
  async confirmPayment() {
    if (this.data.paying) return
    this.setData({ paying: true })

    const order = app.getOrders().find(o => o.id === this.currentOrderId)
    if (!order) {
      this.setData({ paying: false })
      return wx.showToast({ title: '订单不存在', icon: 'none' })
    }

    try {
      // ① 构造商品描述
      const itemNames = (order.items || []).map(i => i.title).join('、').slice(0, 40)
      const totalFee = Math.round(order.finalPrice * 100)  // 金额转分

      // ② 请求后端统一下单 → 获取支付参数
      wx.showLoading({ title: '拉起支付...', mask: true })
      const payParams = await API.unifiedOrder({
        orderId: order.id,
        totalFee,
        body: itemNames || '有闲甄选商品',
        openid: app.globalData.openid || '',
        attach: order.id
      })
      wx.hideLoading()

      // ③ 调起微信支付
      await API.requestPayment(payParams)

      // ④ 支付成功 → 更新订单状态
      app.updateOrderStatus(order.id, 'paid')

      // 通知 ERP 支付成功
      if (this.currentOrderNo) {
        API.ecommerceCallback(this.currentOrderNo, 'PAID').catch(() => {})
      }

      // 强制同步购物车角标
      const syncedCart = wx.getStorageSync('yxzx_cart') || []
      app.globalData.cart = syncedCart
      app.updateCartBadge(syncedCart.length)
      this.setData({
        paying: false,
        showPayment: false,
        paymentResult: 'success'
      })

      wx.showToast({
        title: '支付成功',
        icon: 'success',
        duration: 1500
      })
      // 延迟跳转，等 toast 自然消失
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/orders/orders' })
      }, 1600)
    } catch (err) {
      wx.hideLoading()
      this.setData({ paying: false })

      // 用户取消支付不算失败
      if (err.errMsg && err.errMsg.includes('cancel')) {
        wx.showToast({ title: '支付已取消', icon: 'none' })
        return
      }

      // console.error('[Payment] 支付失败:', err)
      wx.showModal({
        title: '支付失败',
        content: err.message || '支付遇到问题，订单已保留，可在订单列表继续支付',
        showCancel: false,
        confirmText: '知道了'
      })
    }
  },

  // 取消支付
  cancelPayment() {
    // 订单保留为 pending 状态，用户可在订单列表继续支付
    this.setData({ showPayment: false })
    wx.showToast({ title: '订单已保存', icon: 'none' })
    setTimeout(() => wx.redirectTo({ url: '/pages/orders/orders' }), 1500)
  },

  // 关闭支付弹层
  closePayment() {
    if (this.data.paying) return
    this.cancelPayment()
  }
})