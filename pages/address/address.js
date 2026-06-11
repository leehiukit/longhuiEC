// 地址管理逻辑
const app = getApp()

Page({
  data: {
    addresses: [],
    showModal: false,
    editId: null,
    region: ['', '', ''],
    formData: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      isDefault: false
    },
    selectMode: false // 是否为选择模式（从订单页进入）
  },

  onLoad(options) {
    this.setData({ selectMode: !!options.selectMode })
    this.loadAddresses()
  },

  onShow() {
    this.loadAddresses()
  },

  loadAddresses() {
    const addrKey = app.accountKey('yxzx_addresses')
    let addresses = wx.getStorageSync(addrKey) || []
    // 清理历史遗留的演示地址
    const before = addresses.length
    addresses = addresses.filter(a => a.id !== 'default_addr_1' && a.id !== 'default_addr_2')
    if (addresses.length !== before) {
      wx.setStorageSync(addrKey, addresses)
    }
    this.setData({ addresses })
  },

  addAddress() {
    this.setData({
      showModal: true,
      editId: null,
      region: ['', '', ''],
      formData: { name: '', phone: '', detail: '', isDefault: false }
    })
  },

  editAddress(e) {
    const id = e.currentTarget.dataset.id
    const addr = this.data.addresses.find(a => a.id === id)
    if (!addr) return

    this.setData({
      showModal: true,
      editId: id,
      region: [addr.province, addr.city, addr.district],
      formData: {
        name: addr.name,
        phone: addr.phone,
        detail: addr.detail,
        isDefault: addr.isDefault
      }
    })
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定删除该地址吗？',
      success: (res) => {
        if (res.confirm) {
          let addresses = this.data.addresses.filter(a => a.id !== id)
          wx.setStorageSync(app.accountKey('yxzx_addresses'), addresses)
          this.setData({ addresses })
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
  },

  onRegionChange(e) {
    const region = e.detail.value
    this.setData({
      region,
      'formData.province': region[0],
      'formData.city': region[1],
      'formData.district': region[2]
    })
  },

  onDefaultChange(e) {
    this.setData({ 'formData.isDefault': e.detail.value.length > 0 })
  },

  // 阻止事件冒泡（弹窗内容区点击不关闭）
  stopPropagation() {},

  closeModal() {
    this.setData({ showModal: false })
  },

  saveAddress() {
    const { formData, editId, region } = this.data
    
    if (!formData.name || !formData.phone || !formData.detail || !region[0]) {
      return wx.showToast({ title: '请填写完整信息', icon: 'none' })
    }
    if (!/^1\d{10}$/.test(formData.phone)) {
      return wx.showToast({ title: '手机号格式不正确', icon: 'none' })
    }

    let addresses = [...this.data.addresses]
    const addressData = {
      ...formData,
      province: region[0],
      city: region[1],
      district: region[2]
    }

    if (editId) {
      // 编辑
      const idx = addresses.findIndex(a => a.id === editId)
      if (idx > -1) {
        addresses[idx] = { ...addresses[idx], ...addressData }
      }
    } else {
      // 新增
      const newAddr = {
        id: Date.now(),
        ...addressData
      }
      
      // 如果设为默认，取消其他默认
      if (addressData.isDefault) {
        addresses.forEach(a => a.isDefault = false)
      }
      addresses.push(newAddr)
    }

    wx.setStorageSync(app.accountKey('yxzx_addresses'), addresses)
    this.setData({ addresses, showModal: false })
    wx.showToast({ title: '保存成功', icon: 'success' })
  },

  selectAddress(e) {
    if (!this.data.selectMode) return
    
    const item = e.currentTarget.dataset.item
    // 返回订单页时携带选中的地址
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    if (prevPage && prevPage.route === 'pages/order/order') {
      prevPage.setData({ address: item })
    }
    wx.navigateBack()
  },
})