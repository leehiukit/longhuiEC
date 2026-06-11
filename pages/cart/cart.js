// 购物车逻辑
const app = getApp()

Page({
  data: {
    cartList: [],
    selectAll: false,
    totalPrice: 0,
    selectedCount: 0
  },

  onShow() {
    this.loadCart()
  },

  loadCart() {
    // 每次进入都从 Storage 重新读取（确保多页面同步）
    const cart = wx.getStorageSync('yxzx_cart') || []
    app.globalData.cart = cart
    this.setData({ cartList: cart })
    app.updateCartBadge(cart.length)
    this.calcTotal()
  },

  calcTotal() {
    const { cartList } = this.data
    let total = 0
    let count = 0
    
    cartList.forEach(item => {
      if (item.selected) {
        total += item.price * item.quantity
        count++
      }
    })
    
    // 全选状态
    const selectAll = cartList.length > 0 && cartList.every(item => item.selected)
    
    this.setData({
      totalPrice: total.toFixed(2),
      selectedCount: count,
      selectAll
    })
  },

  toggleSelectAll(e) {
    const { cartList } = this.data
    const checked = e.detail.value.length > 0
    
    cartList.forEach(item => {
      item.selected = checked
    })
    
    app.globalData.cart = cartList
    wx.setStorageSync('yxzx_cart', cartList)
    this.setData({ cartList, selectAll: checked })
    this.calcTotal()
  },

  toggleItem(e) {
    const index = e.currentTarget.dataset.index
    const { cartList } = this.data
    cartList[index].selected = !cartList[index].selected
    
    app.globalData.cart = cartList
    wx.setStorageSync('yxzx_cart', cartList)
    this.setData({ cartList })
    this.calcTotal()
  },

  increaseQty(e) {
    const index = e.currentTarget.dataset.index
    const { cartList } = this.data
    cartList[index].quantity++
    
    app.globalData.cart = cartList
    wx.setStorageSync('yxzx_cart', cartList)
    this.setData({ cartList })
    this.calcTotal()
  },

  decreaseQty(e) {
    const index = e.currentTarget.dataset.index
    const { cartList } = this.data
    if (cartList[index].quantity <= 1) return
    cartList[index].quantity--
    
    app.globalData.cart = cartList
    wx.setStorageSync('yxzx_cart', cartList)
    this.setData({ cartList })
    this.calcTotal()
  },

  deleteSelected() {
    const { cartList } = this.data
    const selected = cartList.filter(item => item.selected)
    
    if (selected.length === 0) {
      return wx.showToast({ title: '请先选择商品', icon: 'none' })
    }
    
    wx.showModal({
      title: '提示',
      content: `确定删除选中的${selected.length}件商品吗？`,
      success: (res) => {
        if (res.confirm) {
          const newCart = cartList.filter(item => !item.selected)
          app.globalData.cart = newCart
          wx.setStorageSync('yxzx_cart', newCart)
          app.updateCartBadge(newCart.length)
          this.setData({ cartList: newCart })
          this.calcTotal()
        }
      }
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  },

  goShop() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goCheckout() {
    const { selectedCount } = this.data
    if (selectedCount === 0) {
      return wx.showToast({ title: '请选择要结算的商品', icon: 'none' })
    }
    
    // 检查登录
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '需要登录',
        content: '请先登录后再进行结算',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }
    
    wx.navigateTo({ url: '/pages/order/order' })
  },
})