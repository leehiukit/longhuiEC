// 订单详情页 - 有闲甄选（集成顺丰物流追踪）
const app = getApp()
const API = require('../../utils/api')

const STATUS_MAP = {
  pending:   { label: '待付款',   icon: '💰', color: '#fa8c16' },
  paid:      { label: '待发货',   icon: '📦', color: '#1890ff' },
  shipped:   { label: '运输中',   icon: '🚚', color: '#722ed1' },
  delivered: { label: '已签收',   icon: '📋', color: '#13c2c2' },
  completed: { label: '已完成',   icon: '✅', color: '#52c41a' },
  cancelled: { label: '已取消',   icon: '❌', color: '#999' },
  afterSale: { label: '售后完成', icon: '🔄', color: '#999' }
}

const PROGRESS_STEPS = [
  { key: 'paid',      label: '已下单',  icon: '📝' },
  { key: 'shipped',   label: '已发货',  icon: '📦' },
  { key: 'delivered', label: '已签收',  icon: '✅' },
  { key: 'completed', label: '已完成',  icon: '🎉' }
]

Page({
  data: {
    order: null,
    statusInfo: null,
    progressSteps: [],
    currentStep: 0,
    showLogistics: false
  },

  onLoad(options) {
    if (options.orderId) {
      this.loadOrder(options.orderId)
    } else {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1200)
    }
  },

  async loadOrder(orderId) {
    try {
      let orders = app.getOrders()
      let order = orders.find(o => o.id === orderId)
      if (!order) {
        wx.showToast({ title: '订单不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1200)
        return
      }

      // 从 ERP 同步最新状态 + 物流信息
      if (order.orderNo) {
        try {
          const erp = await API.getEcommerceOrders({ orderNo: order.orderNo })
          if (erp) {
            const erpStatusMap = {
              PENDING_PAYMENT: 'pending', PAID: 'paid', SHIPPED: 'shipped',
              DELIVERED: 'delivered', COMPLETED: 'completed',
              CANCELLED: 'cancelled', REFUNDED: 'cancelled'
            }
            const mappedStatus = erpStatusMap[erp.status]
            if (mappedStatus && mappedStatus !== order.status) {
              const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'afterSale'])
              if (!TERMINAL_STATUSES.has(order.status)) {
                order.status = mappedStatus
              }
            }
            // 物流信息始终同步
            order.carrier = erp.carrier || order.carrier || ''
            order.trackingNumber = erp.trackingNumber || order.trackingNumber || ''
            order.shippedAt = erp.shippedAt || order.shippedAt || ''
            order.deliveredAt = erp.deliveredAt || order.deliveredAt || ''
            // 地址信息
            if (erp.buyerAddress) {
              try {
                order.address = JSON.parse(erp.buyerAddress)
              } catch (_) { /* ignore */ }
            }
            if (erp.buyerName) order.buyerName = erp.buyerName
            if (erp.buyerPhone) order.buyerPhone = erp.buyerPhone
            // 售后
            if (erp.afterSalesStatus) order.refundStatus = erp.afterSalesStatus
          }
        } catch (_) { /* ERP 同步失败不影响详情展示 */ }
      }

      // 补充展示字段
      const detail = { ...order }
      detail.statusInfo = STATUS_MAP[detail.status] || STATUS_MAP.pending
      detail.itemsPreview = Array.isArray(detail.items) ? detail.items : []

      // 物流追踪显示条件：已发货 / 已签收 / 已完成
      detail.showLogistics = ['shipped', 'delivered', 'completed'].includes(detail.status) && !!detail.trackingNumber
      detail.carrier = detail.carrier || '顺丰速运'

      // 进度步骤
      const progressSteps = this.buildProgress(detail.status)
      const currentStep = PROGRESS_STEPS.findIndex(s => s.key === detail.status)
      const showLogistics = detail.showLogistics

      // 待付款倒计时
      if (detail.status === 'pending' && detail.createdAt) {
        const created = new Date(detail.createdAt).getTime()
        if (!isNaN(created)) {
          const deadline = created + 30 * 60 * 1000
          const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
          detail.remainingText = this.formatRemaining(remaining)
          detail.expired = remaining <= 0
        }
      }

      this.setData({
        order: detail,
        statusInfo: detail.statusInfo,
        progressSteps,
        currentStep: currentStep >= 0 ? currentStep : 0,
        showLogistics
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  buildProgress(status) {
    const steps = [...PROGRESS_STEPS]
    if (status === 'cancelled') {
      return [{ key: 'cancelled', label: '已取消', icon: '❌' }]
    }
    // 标记完成/当前步骤
    return steps.map((step, i) => {
      const stepIdx = steps.findIndex(s => s.key === status)
      if (stepIdx >= 0) {
        if (i < stepIdx) step.done = true
        if (i === stepIdx) step.current = true
        if (i === stepIdx && status === 'shipped') step.current = true
      }
      return step
    })
  },

  formatRemaining(seconds) {
    if (seconds <= 0) return '已过期'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `剩余 ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  },

  // 复制物流单号
  copyTracking() {
    const no = this.data.order.trackingNumber
    if (!no) return
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: '单号已复制', icon: 'success' })
    })
  },

  // 打开顺丰查物流（优先跳转小程序，失败则打开 H5）
  openTracking() {
    const no = this.data.order.trackingNumber
    if (!no) {
      wx.showToast({ title: '暂无物流单号', icon: 'none' })
      return
    }
    wx.showLoading({ title: '打开顺丰...', mask: true })

    // 方式一：跳转顺丰速运+ 小程序
    wx.navigateToMiniProgram({
      appId: 'wx6885acbedba59c14',
      path: '',
      extraData: { waybillNo: no },
      envVersion: 'release',
      success: () => {
        wx.hideLoading()
      },
      fail: () => {
        wx.hideLoading()
        // 方式二：跳转顺丰 H5 查件页
        const h5Url = `https://www.sf-express.com/we/ow/chn/sc/waybill/waybill-detail/${no}`
        wx.setClipboardData({
          data: no,
          success: () => {
            wx.showModal({
              title: '查看物流',
              content: `单号 ${no} 已复制\n点击确认打开顺丰官网查件`,
              confirmText: '打开查件',
              success: (res) => {
                if (res.confirm) {
                  // 使用 web-view 需要业务域名白名单，此处用复制+提示方式
                  wx.showToast({ title: '请打开顺丰官网查询', icon: 'none' })
                }
              }
            })
          }
        })
      }
    })
  },

  // 辅助操作
  goPay() {
    const id = this.data.order.id
    wx.navigateTo({ url: `/pages/order/order?repayId=${id}` })
  },

  confirmReceive() {
    const order = this.data.order
    wx.showModal({
      title: '确认收货',
      content: '请确认已收到商品',
      confirmText: '确认收货',
      success: async (res) => {
        if (!res.confirm) return
        app.updateOrderStatus(order.id, 'delivered')
        if (order.orderNo) {
          API.ecommerceCallback(order.orderNo, 'DELIVERED').catch(() => {})
        }
        wx.showToast({ title: '已确认收货', icon: 'success' })
        setTimeout(() => this.loadOrder(order.id), 800)
      }
    })
  },

  confirmComplete() {
    const order = this.data.order
    wx.showModal({
      title: '确认完成',
      content: '确认订单已完成？',
      confirmText: '确认完成',
      success: async (res) => {
        if (!res.confirm) return
        app.updateOrderStatus(order.id, 'completed')
        if (order.orderNo) {
          API.ecommerceCallback(order.orderNo, 'COMPLETED').catch(() => {})
        }
        wx.showToast({ title: '订单已完成', icon: 'success' })
        setTimeout(() => this.loadOrder(order.id), 800)
      }
    })
  },

  cancelOrder() {
    const order = this.data.order
    wx.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？',
      success: (res) => {
        if (!res.confirm) return
        app.updateOrderStatus(order.id, 'cancelled')
        if (order.orderNo) {
          API.ecommerceCallback(order.orderNo, 'CANCELLED').catch(() => {})
        }
        wx.showToast({ title: '已取消', icon: 'none' })
        setTimeout(() => this.loadOrder(order.id), 800)
      }
    })
  },

  goReview() {
    const orderId = this.data.order.id
    const review = app.getReviewByOrder(orderId)
    if (review) {
      wx.navigateTo({ url: `/pages/review-detail/review-detail?reviewId=${review.id}` })
    } else {
      wx.navigateTo({ url: `/pages/review/review?orderId=${orderId}` })
    }
  },

  applyAfterSale(e) {
    const type = e.currentTarget.dataset.type || 'refund'
    wx.navigateTo({ url: `/pages/refund/refund?orderId=${this.data.order.id}&type=${type}` })
  },

  viewRefund() {
    wx.navigateTo({ url: `/pages/refund-detail/refund-detail?refundId=${this.data.order.refundId}` })
  }
})
