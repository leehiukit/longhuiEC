// 订单列表页 - 有闲甄选（已对接微信支付）
const app = getApp()
const API = require('../../utils/api')

const STATUS_MAP = {
  pending:   { label: '待付款',   icon: '💰', color: '#fa8c16', action: '去支付' },
  paid:      { label: '待发货',   icon: '📦', color: '#1890ff', action: '等待发货' },
  shipped:   { label: '待收货',   icon: '🚚', color: '#722ed1', action: '确认收货' },
  delivered: { label: '待完成',   icon: '📋', color: '#13c2c2', action: '确认完成' },
  completed: { label: '已完成',   icon: '✅', color: '#52c41a', action: '去评价' },
  cancelled: { label: '已取消',   icon: '❌', color: '#999',    action: '' },
  afterSale: { label: '售后完成', icon: '🔄', color: '#999',    action: '' }
}

const REFUND_STATUS_TEXT = {
  pending:   '退款处理中',
  approved:  '退款已通过',
  rejected:  '退款已拒绝',
  returning: '退货中',
  refunded:  '已退款'
}

Page({
  data: {
    orders: [],
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待付款' },
      { key: 'paid', label: '待发货' },
      { key: 'shipped', label: '待收货' },
      { key: 'delivered', label: '待完成' },
      { key: 'completed', label: '已完成' },
      { key: 'review', label: '待评价' }
    ],
    isEmpty: false,
    refreshing: false
  },

  onLoad(options) {
    if (options.tab) {
      this.setData({ activeTab: options.tab })
    }
  },

  onShow() {
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    setTimeout(() => {
      this.loadOrders()
      this.setData({ refreshing: false })
      wx.stopPullDownRefresh()
    }, 600)
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab }, () => this.loadOrders())
  },

  async loadOrders() {
    try {
      const { activeTab } = this.data
      let rawOrders = app.getOrders()

      // 防御：确保是数组
      if (!Array.isArray(rawOrders)) rawOrders = []

      // 有 orderNo 的订单，从 ERP 同步最新状态
      const ordersWithNo = rawOrders.filter(o => o && o.orderNo)
      if (ordersWithNo.length > 0) {
        const erpStatusMap = {
          PENDING_PAYMENT: 'pending',
          PAID: 'paid',
          SHIPPED: 'shipped',
          DELIVERED: 'delivered',
          COMPLETED: 'completed',
          CANCELLED: 'cancelled',
          REFUNDED: 'cancelled'
        }
        // 状态优先级：数字越大越靠后；终态（cancelled/completed）不允许被 ERP 回滚
        const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'afterSale'])
        const statusPriority = { pending: 1, paid: 2, shipped: 3, delivered: 4, completed: 5, cancelled: 5, afterSale: 5 }
        for (const local of ordersWithNo) {
          try {
            const erp = await API.getEcommerceOrders({ orderNo: local.orderNo })
            if (erp && erp.status) {
              const mappedStatus = erpStatusMap[erp.status] || local.status
              // 本地已是终态 → 不允许 ERP 回滚
              if (TERMINAL_STATUSES.has(local.status)) continue
              const isTerminal = TERMINAL_STATUSES.has(mappedStatus)
              const canUpdate = isTerminal ||
                (statusPriority[mappedStatus] || 0) > (statusPriority[local.status] || 0)
              if (canUpdate) {
                local.status = mappedStatus
              }
              // 售后/退款信息同步（ERP 返回字段为 afterSalesStatus）
              if (erp.afterSalesStatus) {
                local.refundStatus = erp.afterSalesStatus
              }
              if (erp.refundAmount != null) {
                local.refundAmount = erp.refundAmount
              }
              if (erp.refundId) {
                local.refundId = erp.refundId
              }
              // ERP 已退款/已取消 → 同步更新本地退款记录状态
              if ((erp.status === 'REFUNDED' || erp.status === 'CANCELLED') && local.refundId) {
                const allRefunds = app.getRefunds()
                const rf = allRefunds.find(r => r.id === local.refundId)
                if (rf && rf.status !== 'refunded') {
                  rf.status = 'refunded'
                  rf.updateTime = new Date().toISOString()
                  if (!rf.timeline.some(t => t.text.includes('已到账'))) {
                    rf.timeline.push({
                      time: new Date().toISOString(),
                      text: '退款已到账，售后完成',
                      done: true
                    })
                  }
                  app.saveRefunds(allRefunds)
                  local.refundStatus = 'refunded'
                }
              }
              // 物流信息始终同步
              local.carrier = erp.carrier || local.carrier || ''
              local.trackingNumber = erp.trackingNumber || local.trackingNumber || ''
              local.shippedAt = erp.shippedAt || local.shippedAt || ''
              local.deliveredAt = erp.deliveredAt || local.deliveredAt || ''
            }
          } catch (_) { /* 单个订单同步失败不影响列表 */ }
        }
        // 回写 storage
        app.saveOrders(rawOrders)
      }

      // 筛选 tab
      let orders
      if (activeTab === 'all') {
        orders = rawOrders.filter(o => !!o)
      } else if (activeTab === 'review') {
        // 待评价：已完成且未评价的订单
        orders = rawOrders.filter(o => o && o.status === 'completed' && !o.reviewed)
      } else {
        orders = rawOrders.filter(o => o && o.status === activeTab)
      }

      // 深拷贝 + 补充展示字段（避免直接修改 storage 引用）
      orders = orders.map(o => {
        const item = { ...o }

        // 待付款倒计时
        if (item.status === 'pending' && item.createdAt) {
          const created = new Date(item.createdAt).getTime()
          if (!isNaN(created)) {
            const deadline = created + 30 * 60 * 1000
            const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
            item.remainingText = this.formatRemaining(remaining)
            item.expired = remaining <= 0
          }
        }

        item.statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending

        item.hasRefund = !!item.refundId
        item.refundStatusText = (item.refundStatus && REFUND_STATUS_TEXT[item.refundStatus]) || ''
        // 已取消 + 有退款记录 → 显示"已退款"
        if (item.status === 'cancelled' && item.hasRefund) {
          item.refundStatusText = '已退款'
        }
        // 仅退款：待发货且未申请过
        item.showRefundOnly = item.status === 'paid' && !item.hasRefund
        // 退货退款：待收货/待完成/已完成且未申请过
        //   completed 增加 7 天限制
        const returnableShipped = ['shipped', 'delivered'].includes(item.status)
        const returnableCompleted = item.status === 'completed' && item.completedAt && (Date.now() - new Date(item.completedAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
        item.showReturnRefund = (returnableShipped || returnableCompleted) && !item.hasRefund
        item.showRefundDetail = item.hasRefund
        item.itemsPreview = Array.isArray(item.items) ? item.items.slice(0, 3) : []

        return item
      })

      this.setData({
        orders,
        isEmpty: orders.length === 0
      })
    } catch (e) {
      console.error('[Orders] loadOrders error:', e)
      this.setData({ orders: [], isEmpty: true })
    }
  },

  formatRemaining(seconds) {
    if (seconds <= 0) return '已过期'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `剩余 ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  },

  // 订单操作
  handleOrderAction(e) {
    const { id, status } = e.currentTarget.dataset
    switch (status) {
      case 'pending':
        this.goPay(id)
        break
      case 'shipped':
        this.confirmReceive(id)
        break
      case 'delivered':
        this.confirmComplete(id)
        break
      case 'completed':
        this.goReview(id)
        break
    }
  },

  // 去评价
  goReview(orderId) {
    // 检查是否已评价
    const review = app.getReviewByOrder(orderId)
    if (review) {
      // 已评价，跳转到评价详情
      wx.navigateTo({ url: `/pages/review-detail/review-detail?reviewId=${review.id}` })
    } else {
      // 未评价，跳转到评价页面
      wx.navigateTo({ url: `/pages/review/review?orderId=${orderId}` })
    }
  },

  // 去支付 — 跳转到支付页面
  goPay(orderId) {
    const orders = app.getOrders()
    const order = orders.find(o => o.id === orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }
    // 跳转到订单确认/支付页面，携带订单信息
    wx.navigateTo({
      url: `/pages/order/order?repayId=${orderId}`,
      fail: () => {
        wx.showToast({ title: '跳转失败，请重试', icon: 'none' })
      }
    })
  },

  // 确认收货（进入待完成状态）
  confirmReceive(orderId) {
    wx.showModal({
      title: '确认收货',
      content: '请确认已收到商品，确认后将进入待完成状态。',
      confirmText: '确认收货',
      success: async (res) => {
        if (!res.confirm) return
        app.updateOrderStatus(orderId, 'delivered')
        // 通知 ERP
        const orders = app.getOrders()
        const order = orders.find(o => o.id === orderId)
        if (order && order.orderNo) {
          API.ecommerceCallback(order.orderNo, 'DELIVERED').catch(() => {})
        }
        wx.showToast({ title: '已确认收货', icon: 'success' })
        this.loadOrders()
      }
    })
  },

  // 确认完成（进入已完成状态）
  confirmComplete(orderId) {
    wx.showModal({
      title: '确认完成',
      content: '确认订单已完成？确认后将无法再申请售后。',
      confirmText: '确认完成',
      success: async (res) => {
        if (!res.confirm) return
        app.updateOrderStatus(orderId, 'completed')
        // 通知 ERP
        const orders = app.getOrders()
        const order = orders.find(o => o.id === orderId)
        if (order && order.orderNo) {
          API.ecommerceCallback(order.orderNo, 'COMPLETED').catch(() => {})
        }
        wx.showToast({ title: '订单已完成', icon: 'success' })
        this.loadOrders()
      }
    })
  },

  // 取消订单
  cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消订单',
      content: '确定要取消此订单吗？',
      success: (res) => {
        if (res.confirm) {
          app.updateOrderStatus(orderId, 'cancelled')
          // 通知 ERP 取消
          const orders = app.getOrders()
          const order = orders.find(o => o.id === orderId)
          if (order && order.orderNo) {
            API.ecommerceCallback(order.orderNo, 'CANCELLED').catch(() => {})
          }
          wx.showToast({ title: '订单已取消', icon: 'none' })
          this.loadOrders()
        }
      }
    })
  },

  // 申请售后
  applyAfterSale(e) {
    const orderId = e.currentTarget.dataset.id
    const type = e.currentTarget.dataset.type || 'refund'
    wx.navigateTo({ url: `/pages/refund/refund?orderId=${orderId}&type=${type}` })
  },

  // 查看售后详情
  viewRefund(e) {
    const refundId = e.currentTarget.dataset.refundId
    wx.navigateTo({ url: `/pages/refund-detail/refund-detail?refundId=${refundId}` })
  },

  // 跳转订单详情
  goDetail(e) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId) return
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${orderId}` })
  }
})