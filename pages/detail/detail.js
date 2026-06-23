// 详情页逻辑 - 有闲甄选
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    productId: null,
    product: null,
    specList: [],
    guarantees: [
      { icon: '/images/guarantees/warranty.png', text: '365天超长质保' },
      { icon: '/images/guarantees/authentic.png', text: '正品保障 · 支持验机' },
      { icon: '/images/guarantees/shipping.png', text: '24小时极速发货' },
      { icon: '/images/guarantees/return.png', text: '7天无理由退换' },
      { icon: '/images/guarantees/clean.png', text: '深度清洁杀菌消毒' },
      { icon: '/images/guarantees/support.png', text: '终身免费技术咨询' }
    ],
    isFav: false,
    cartCount: 0
  },

  onLoad(options) {
    const id = options.id
    this.setData({ productId: id })
    this.loadDetail(id)
    this.updateCartCount()
  },

  async loadDetail(id) {
    try {
      const res = await api.getProductDetail(id)
      const product = res.data

      let specList = []
      if (product.specs && typeof product.specs === 'object' && !Array.isArray(product.specs)) {
        const specMap = {
          cpu: '处理器', memory: '内存', storage: '硬盘',
          screen: '屏幕', graphics: '显卡',
          battery: '电池', weight: '重量', os: '系统'
        }
        specList = Object.entries(product.specs).map(([key, value]) => ({
          label: specMap[key] || key, value
        }))
      }

      this.setData({ product, specList })

      // 收藏状态
      const favorites = wx.getStorageSync(app.accountKey('yxzx_favorites')) || []
      this.setData({ isFav: favorites.some(f => f.id === id) })

      wx.setNavigationBarTitle({
        title: product.title ? (product.title.length > 10 ? product.title.substr(0, 10) + '...' : product.title) : '商品详情'
      })
    } catch (e) {
      wx.showToast({ title: '加载失败，请下拉重试', icon: 'none' })
    }
  },

  updateCartCount() {
    const cart = app.globalData.cart || []
    this.setData({ cartCount: cart.reduce((sum, item) => sum + (item.quantity || 1), 0) })
  },

  toggleFavorite() {
    const { isFav, product, productId } = this.data
    let favorites = wx.getStorageSync(app.accountKey('yxzx_favorites')) || []
    
    if (isFav) {
      favorites = favorites.filter(f => f.id !== productId)
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      favorites.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image || (product.images && product.images[0]) || ''
      })
      wx.showToast({ title: '加入收藏夹', icon: 'success' })
    }
    wx.setStorageSync(app.accountKey('yxzx_favorites'), favorites)
    this.setData({ isFav: !isFav })
  },

  addToCart() {
    const { product } = this.data
    if (!product) return
    
    let cart = app.globalData.cart || []
    const existIdx = cart.findIndex(item => item.id === product.id)
    
    if (existIdx > -1) cart[existIdx].quantity++
    else cart.push({
      id: product.id, title: product.title, price: product.price,
      image: product.images?.[0] || '', quantity: 1, selected: true
    })

    app.globalData.cart = cart
    wx.setStorageSync(app.accountKey('yxzx_cart'), cart)
    app.updateCartBadge(cart.length)
    this.updateCartCount()
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  buyNow() {
    this.addToCart()
    setTimeout(() => wx.switchTab({ url: '/pages/cart/cart' }), 500)
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },
  goCart() {
    wx.switchTab({ url: '/pages/cart/cart' })
  },

  onShareAppMessage() {
    const product = this.data.product
    return {
      title: product ? `${product.title || product.name} — 有闲甄选` : '有闲甄选 — 品质二手笔记本',
      path: `/pages/detail/detail?id=${this.data.productId}`,
      imageUrl: ''
    }
  },
})