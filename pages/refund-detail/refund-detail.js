// 退款详情页 - 有闲甄选
const app = getApp()
const API = require('../../utils/api')

const STATUS_MAP = {
  pending:   { label: '待审核',  icon: '⏳', color: '#fa8c16', desc: '您的退款申请已提交，商家审核中' },
  approved:  { label: '已通过',  icon: '✅', color: '#52c41a', desc: '商家已同意退款，等待退款到账' },
  rejected:  { label: '已拒绝',  icon: '❌', color: '#ff4d4f', desc: '商家拒绝了退款申请' },
  returning: { label: '待收货',  icon: '📦', color: '#1890ff', desc: '已寄回商品，等待商家收货确认' },
  refunded:  { label: '已退款',  icon: '💰', color: '#52c41a', desc: '退款已原路返回' }
}

Page({
  data: {
    refundId: '',
    refund: null,
    statusInfo: null,
    order: null,
    showLogistics: false,
    logisticsCompany: '顺丰速运',
    logisticsNumber: ''
  },

  onLoad(options) {
    if (!options.refundId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    this.setData({ refundId: options.refundId })
  },

  onShow() {
    this.loadRefund()
  },

  async loadRefund() {
    const refunds = app.getRefunds()
    const refund = refunds.find(r => r.id === this.data.refundId)
    if (!refund) {
      wx.showToast({ title: '退款记录不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    // 关联订单
    const orders = app.getOrders()
    const order = orders.find(o => o.id === refund.orderId)

    // 从 ERP 同步最新状态
    if (order && order.orderNo) {
      try {
        const erp = await API.getEcommerceOrders({ orderNo: order.orderNo })
        if (erp) {
          // ERP 售后状态映射
          const erpStatus = erp.afterSalesStatus || erp.status || ''

          if (erpStatus === 'REFUNDED') {
            if (refund.status !== 'refunded') {
              refund.status = 'refunded'
              refund.updateTime = new Date().toISOString()
              if (!refund.timeline || !refund.timeline.some(t => t.text.includes('已到账'))) {
                refund.timeline = refund.timeline || []
                refund.timeline.push({
                  time: new Date().toISOString(),
                  text: '退款已到账，售后完成',
                  done: true
                })
              }
              app.saveRefunds(refunds)
              // 同步订单
              const orders = app.getOrders()
              const o = orders.find(it => it.id === refund.orderId)
              if (o) {
                o.refundStatus = 'refunded'
                o.status = 'afterSale'
                app.saveOrders(orders)
              }
            }
          } else if (erpStatus === 'REFUNDING') {
            // 退款处理中，本地保持 pending
            if (!refund.timeline || !refund.timeline.some(t => t.text.includes('退款处理中'))) {
              refund.timeline = refund.timeline || []
              refund.timeline.push({
                time: new Date().toISOString(),
                text: '退款处理中，预计1-3个工作日到账',
                done: false
              })
              app.saveRefunds(refunds)
            }
          } else if (erpStatus === 'RETURN_APPROVED' && refund.status === 'pending') {
            refund.status = 'approved'
            refund.updateTime = new Date().toISOString()
            refund.timeline = refund.timeline || []
            refund.timeline.push({
              time: new Date().toISOString(),
              text: '商家已同意退款申请',
              done: true
            })
            app.saveRefunds(refunds)
          } else if (erpStatus === 'RETURN_REJECTED' && refund.status === 'pending') {
            refund.status = 'rejected'
            refund.rejectReason = erp.returnRejectReason || '不符合退款条件'
            refund.updateTime = new Date().toISOString()
            refund.timeline = refund.timeline || []
            refund.timeline.push({
              time: new Date().toISOString(),
              text: `商家已拒绝退款：${refund.rejectReason}`,
              done: true
            })
            app.saveRefunds(refunds)
          }

          // 同步金额（防止本地为空）
          if (!refund.amount && (erp.totalAmount || erp.subtotalAmount)) {
            refund.amount = erp.totalAmount || erp.subtotalAmount || 0
            app.saveRefunds(refunds)
          }
          if (erp.refundAmount != null && refund.amount !== erp.refundAmount) {
            refund.amount = erp.refundAmount
            app.saveRefunds(refunds)
          }
        }
      } catch (_) { /* ERP 不可用则使用本地数据 */ }
    }

    const statusInfo = STATUS_MAP[refund.status] || STATUS_MAP.pending

    this.setData({ refund, statusInfo, order })
  },

  // 填写退货物流（仅退款类型为 return 且状态为 approved）
  openLogistics() {
    this.setData({ showLogistics: true })
  },

  closeLogistics() {
    this.setData({ showLogistics: false })
  },

  onCompanyInput(e) {
    this.setData({ logisticsCompany: e.detail.value })
  },

  onNumberInput(e) {
    this.setData({ logisticsNumber: e.detail.value })
  },

  submitLogistics() {
    const { logisticsCompany, logisticsNumber } = this.data
    if (!logisticsCompany.trim()) {
      return wx.showToast({ title: '请输入快递公司', icon: 'none' })
    }
    if (!logisticsNumber.trim()) {
      return wx.showToast({ title: '请输入快递单号', icon: 'none' })
    }

    app.submitReturnLogistics(this.data.refundId, {
      company: logisticsCompany.trim(),
      number: logisticsNumber.trim()
    })

    wx.showToast({ title: '已提交物流信息', icon: 'success' })
    this.setData({ showLogistics: false })
    this.loadRefund()
  },

  // 复制退货物流单号
  copyReturnTracking() {
    const no = this.data.refund?.logistics?.number
    if (!no) return
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: '单号已复制', icon: 'success' })
    })
  },

  // 查看退货物流（跳转顺丰）
  openReturnTracking() {
    const no = this.data.refund?.logistics?.number
    if (!no) {
      wx.showToast({ title: '暂无物流单号', icon: 'none' })
      return
    }
    wx.showLoading({ title: '打开顺丰...', mask: true })

    wx.navigateToMiniProgram({
      appId: 'wx6885acbedba59c14',
      path: '',
      extraData: { waybillNo: no },
      envVersion: 'release',
      success: () => wx.hideLoading(),
      fail: () => {
        wx.hideLoading()
        wx.setClipboardData({
          data: no,
          success: () => {
            wx.showModal({
              title: '查看物流',
              content: `单号 ${no} 已复制\n请打开顺丰速运 App 或小程序查询`,
              showCancel: false,
              confirmText: '知道了'
            })
          }
        })
      }
    })
  },

  // 联系客服
  contactService() {
    wx.showModal({
      title: '有闲甄选客服',
      content: '如有疑问，请联系客服处理\n工作时间：工作日 9:00-18:00',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 预览凭证图片
  previewProof(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.refund.images || []
    })
  }
})