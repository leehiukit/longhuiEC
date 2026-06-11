// 退款/售后申请页 - 有闲甄选
const app = getApp()
const API = require('../../utils/api')

const REFUND_REASONS = [
  '不想要了',
  '买错了/拍错了',
  '商品质量有问题',
  '商品与描述不符',
  '卖家发错货',
  '外观/成色问题',
  '功能故障',
  '其他原因'
]

Page({
  data: {
    orderId: '',
    order: null,
    refundType: 'refund',   // 'refund' 仅退款 | 'return' 退货退款
    showRefundOnly: true,     // 是否显示"仅退款"选项（未发货时 true）
    showReturnRefund: true,   // 是否显示"退货退款"选项（已发货后 true）
    returnExpired: false,     // 已完成超过 7 天，不可退货
    reasons: REFUND_REASONS,
    reasonIndex: -1,
    description: '',
    refundAmount: 0,
    maxAmount: 0,
    images: [],
    submitting: false
  },

  onLoad(options) {
    if (!options.orderId) {
      wx.showToast({ title: '订单参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const order = this.loadOrder(options.orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    // 根据订单状态决定可用的退款类型：
    //   paid（已付款未发货）→ 仅退款
    //   shipped / delivered → 退货退款
    //   completed → 退货退款（7天内）；超出则不允许退货
    const shippedStatuses = ['shipped', 'delivered', 'completed']
    const isShipped = shippedStatuses.includes(order.status)
    const defaultType = isShipped ? 'return' : 'refund'

    // 已完成订单检查是否超出 7 天退货期限
    let showReturnRefund = isShipped
    let returnExpired = false
    if (order.status === 'completed') {
      const completedAt = order.completedAt
      if (!completedAt) {
        // 没有完成时间记录，保守拒绝
        showReturnRefund = false
        returnExpired = true
      } else {
        const DAY7_MS = 7 * 24 * 60 * 60 * 1000
        const elapsed = Date.now() - new Date(completedAt).getTime()
        if (elapsed > DAY7_MS) {
          showReturnRefund = false
          returnExpired = true
        }
      }
    }

    this.setData({
      orderId: order.id,
      order,
      refundType: defaultType,
      showRefundOnly: !isShipped,   // 未发货才显示"仅退款"
      showReturnRefund,              // 已发货 + 未超期才显示"退货退款"
      returnExpired,                 // 是否已超出 7 天退货期限
      maxAmount: order.finalPrice,
      refundAmount: order.finalPrice
    })
  },

  loadOrder(orderId) {
    const orders = app.getOrders()
    return orders.find(o => o.id === orderId) || null
  },

  // 切换退款类型
  switchType(e) {
    this.setData({ refundType: e.currentTarget.dataset.type })
  },

  // 选择原因
  selectReason(e) {
    this.setData({ reasonIndex: e.currentTarget.dataset.index })
  },

  // 退款金额输入
  onAmountInput(e) {
    let val = parseFloat(e.detail.value)
    if (isNaN(val) || val < 0) val = 0
    if (val > this.data.maxAmount) val = this.data.maxAmount
    this.setData({ refundAmount: val })
  },

  // 描述输入
  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  // 上传图片
  chooseImage() {
    const remain = 6 - this.data.images.length
    if (remain <= 0) {
      return wx.showToast({ title: '最多上传6张', icon: 'none' })
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          images: [...this.data.images, ...res.tempFilePaths]
        })
      }
    })
  },

  // 删除图片
  deleteImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== idx)
    this.setData({ images })
  },

  // 预览图片
  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.images
    })
  },

  // 提交申请
  submitRefund() {
    const { reasonIndex, refundAmount } = this.data

    if (reasonIndex < 0) {
      return wx.showToast({ title: '请选择退款原因', icon: 'none' })
    }
    if (refundAmount <= 0) {
      return wx.showToast({ title: '退款金额不正确', icon: 'none' })
    }

    this.setData({ submitting: true })

    wx.showLoading({ title: '提交中...' })
    setTimeout(() => {
      wx.hideLoading()

      const refund = app.applyRefund({
        orderId: this.data.orderId,
        orderAmount: this.data.order.finalPrice,
        type: this.data.refundType,
        reason: REFUND_REASONS[reasonIndex],
        description: this.data.description,
        amount: parseFloat(refundAmount.toFixed(2)),
        images: this.data.images
      })

      // 通知 ERP（仅退款 / 退货退款统一走 RETURN_REQUESTED）
      if (this.data.order.orderNo) {
        API.ecommerceCallback(this.data.order.orderNo, 'RETURN_REQUESTED', {
          returnReason: REFUND_REASONS[reasonIndex]
        }).catch(() => {})
      }

      this.setData({ submitting: false })

      wx.showToast({
        title: '申请已提交',
        icon: 'success',
        duration: 1800,
        complete: () => {
          setTimeout(() => {
            wx.redirectTo({ url: `/pages/refund-detail/refund-detail?refundId=${refund.id}` })
          }, 1800)
        }
      })
    }, 800)
  }
})