// 订单确认页逻辑 - 有闲甄选（已对接微信支付+退款）
const app = getApp()
const API = require('../../utils/api')

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
    paymentResult: null,
    // ERP 优惠券
    loadingCoupons: false
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
  async loadExistingOrder(orderId) {
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

    this.currentOrderId = order.id
    this.currentOrderNo = order.orderNo || ''
    this.currentErpOrderId = order.erpOrderId || ''

    this.setData({
      orderItems,
      totalAmount: order.totalAmount.toFixed(2),
      finalPrice: order.finalPrice.toFixed(2),
      freight: order.freight || 0,
      showPayment: true  // 直接弹出支付弹层
    })

    this.loadAddress()

    // 如果有 ERP 订单号，加载真实优惠券
    if (this.currentErpOrderId) {
      this.loadErpCoupons()
    }
  },

  onShow() {
    // 从地址选择页返回时刷新地址
    if (this.data.address) this.loadAddress()
  },

  // ========== ERP 优惠券（Step 6-8）==========

  /**
   * Step 6: 从 ERP 加载可用优惠券
   */
  async loadErpCoupons() {
    const phone = this.data.address?.phone || (wx.getStorageSync('yxzx_user') || {}).phone
    if (!phone) return

    this.setData({ loadingCoupons: true })
    try {
      // 获取客户档案 → 拿到 customerId
      const profileRes = await API.getCustomerProfile(phone)
      const customer = profileRes.customer
      if (!customer?.id) {
        this.setData({ loadingCoupons: false })
        return
      }

      // 查询订单可用优惠券
      const orderAmount = parseFloat(this.data.totalAmount) || 0
      const productIds = this.data.orderItems.map(item => item.id).join(',')
      const couponsRes = await API.getAvailableCoupons(customer.id, orderAmount, productIds)

      // 适配 ERP 优惠券字段 → 前端展示格式
      const erpCoupons = (couponsRes.coupons || []).map(c => ({
        id: c.id,
        title: c.name,
        type: c.type,
        value: c.value,
        minOrderAmount: c.minOrderAmount,
        scope: c.scope,
        expiresAt: c.expiresAt,
        // 计算立减金额用于前端展示
        amount: c.type === 'FIXED_AMOUNT' ? c.value : Math.round(orderAmount * c.value / 100),
        condition: c.minOrderAmount > 0 ? `满${c.minOrderAmount}元可用` : '无门槛'
      }))

      this.setData({ coupons: erpCoupons, loadingCoupons: false })
    } catch (e) {
      this.setData({ loadingCoupons: false })
      // 静默失败：优惠券非必选
    }
  },

  /**
   * Step 7: 选择优惠券 → 调 ERP 使用 + Step 8: 重查订单获取折扣后金额
   */
  async selectPaymentCoupon(e) {
    const coupon = e.currentTarget.dataset.coupon
    if (!coupon || this.data.paying) return

    wx.showLoading({ title: '使用优惠券...', mask: true })
    try {
      // Step 7: 调用 ERP 使用优惠券
      const useRes = await API.useCoupon(coupon.id, this.currentErpOrderId)

      // Step 8: 重新查询订单获取折扣后的实际金额
      let discountedTotal = useRes.newTotal
      let discountAmount = useRes.discount
      try {
        const orderRes = await API.getEcommerceOrders({ id: this.currentErpOrderId })
        if (orderRes.totalAmount != null) {
          discountedTotal = orderRes.totalAmount
        }
        if (orderRes.discountAmount != null) {
          discountAmount = orderRes.discountAmount
        }
      } catch (_) {
        // 如果重查失败，用 useCoupon 返回的值
      }

      wx.hideLoading()

      this.setData({
        coupon,
        finalPrice: discountedTotal.toFixed(2)
      })

      wx.showToast({ title: `已优惠 ¥${discountAmount}`, icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '优惠券使用失败', icon: 'none' })
    }
  },

  /**
   * 清除已选优惠券（仅清除前端展示，ERP 侧优惠券已使用无法回退）
   */
  async clearPaymentCoupon() {
    // 重新查询 ERP 订单获取当前实际金额
    if (this.currentErpOrderId) {
      try {
        const orderRes = await API.getEcommerceOrders({ id: this.currentErpOrderId })
        this.setData({
          coupon: null,
          finalPrice: (orderRes.totalAmount || parseFloat(this.data.totalAmount)).toFixed(2)
        })
      } catch (_) {
        this.setData({ coupon: null })
      }
    } else {
      const fallback = (parseFloat(this.data.totalAmount) + this.data.freight).toFixed(2)
      this.setData({ coupon: null, finalPrice: fallback })
    }
  },

  loadOrderData() {
    const cart = (app.globalData.cart || []).filter(item => item.selected)

    if (cart.length === 0) {
      wx.showToast({ title: '没有选中商品', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const finalPrice = this.data.freight + totalAmount

    this.setData({
      orderItems: cart,
      totalAmount: totalAmount.toFixed(2),
      finalPrice: finalPrice.toFixed(2)
    })
  },

  loadAddress() {
    const addresses = wx.getStorageSync(app.accountKey('yxzx_addresses')) || []
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
    let erpOrderId = ''

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
      erpOrderId = erpRes.id || ''
    } catch (e) {
      // ERP 下单失败：记录错误但不阻断本地流程，用户可稍后再支付
      wx.showToast({
        title: e.message || '订单创建异常',
        icon: 'none',
        duration: 2000
      })
    }

    const order = {
      id: orderId,
      orderNo: erpOrderNo,    // ERP 订单号
      erpOrderId,             // ERP 内部 ID（用于优惠券抵扣、重查订单）
      status: 'pending',      // pending | paid | shipped | received | completed | cancelled
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
    wx.setStorageSync(app.accountKey('yxzx_cart'), cart)
    app.updateCartBadge(cart.length)

    this.currentOrderId = orderId
    this.currentOrderNo = erpOrderNo
    this.currentErpOrderId = erpOrderId
    this.setData({ submitting: false, showPayment: true })

    // Step 6: ERP 下单成功后，加载真实优惠券
    if (erpOrderId) {
      this.loadErpCoupons()
    }
  },

  // 第二步：选择支付方式
  selectPayMethod(e) {
    this.setData({ payMethod: e.currentTarget.dataset.method })
  },

  // 第三步：确认支付（已对接微信支付）
  async confirmPayment() {
    if (this.data.paying) return

    // ★ 支付前置校验：检查 token 和登录状态
    const tokenData = wx.getStorageSync('yxzx_token')
    if (!tokenData || !tokenData.token) {
      return wx.showModal({
        title: '未登录',
        content: '登录状态已失效，请重新登录后再支付',
        showCancel: false,
        confirmText: '去登录',
        success: () => wx.redirectTo({ url: '/pages/login/login' })
      })
    }

    this.setData({ paying: true })

    const order = app.getOrders().find(o => o.id === this.currentOrderId)
    if (!order) {
      this.setData({ paying: false })
      return wx.showToast({ title: '订单不存在', icon: 'none' })
    }

    try {
      // ① 构造支付参数
      const itemNames = (order.items || []).map(i => i.title).join('、').slice(0, 40)
      const totalFee = Math.round(parseFloat(this.data.finalPrice) * 100)
      const orderNo = this.currentOrderNo || order.id
      // ★ openid 优先 globalData，其次从 storage token/user 恢复
      const openid = app.globalData.openid
        || tokenData.openid
        || (wx.getStorageSync('yxzx_user') || {}).openid
        || ''

      if (totalFee <= 0) {
        this.setData({ paying: false })
        return wx.showToast({ title: '支付金额无效', icon: 'none' })
      }

      // ② 请求后端统一下单 → 获取支付参数
      wx.showLoading({ title: '拉起支付...', mask: true })
      const payParams = await API.unifiedOrder({
        orderNo,
        totalFee,
        body: itemNames || '有闲甄选商品',
        openid,
        attach: order.id
      })
      wx.hideLoading()

      // ★ 后端返回的支付参数校验
      if (!payParams || !payParams.package) {
        throw new Error('服务端返回的支付参数无效')
      }

      // ③ 调起微信支付
      await API.requestPayment(payParams)

      // ④ 支付成功 → 更新订单状态
      app.updateOrderStatus(order.id, 'paid')

      // 通知 ERP 支付成功
      if (this.currentOrderNo) {
        API.ecommerceCallback(this.currentOrderNo, 'PAID').catch(() => {})
      }

      // 强制同步购物车角标
      const syncedCart = wx.getStorageSync(app.accountKey('yxzx_cart')) || []
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
      const errMsg = err.message || '支付遇到问题'
      wx.showModal({
        title: '支付失败',
        content: `${errMsg}\n\n订单已保留，可在「我的订单」中继续支付`,
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