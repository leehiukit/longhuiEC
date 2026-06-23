// 首页逻辑 - 有闲甄选
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    logoPath: app.globalData.logoPath || '',
    banners: [],
    categories: [],
    products: [],
    loading: false,
    productCount: 0
  },

  onLoad() {
    this.loadData()
  },

  onShareAppMessage() {
    return {
      title: '有闲甄选 — 品质二手笔记本，企享收直供',
      path: '/pages/index/index',
      imageUrl: ''
    }
  },

  onShareTimeline() {
    return {
      title: '那些被大公司退下来的笔记本，都去哪了？',
      query: ''
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    // 独立请求：任一接口失败不影响其余模块展示
    const [bannersRes, categoriesRes, productsRes] = await Promise.allSettled([
      api.getBanners(),
      api.getCategories(),
      api.getProducts()
    ])

    const banners = (bannersRes.status === 'fulfilled' ? (bannersRes.value.data || []) : [])
    const categories = (categoriesRes.status === 'fulfilled' ? (categoriesRes.value.data || []) : [])
    const rawProducts = (productsRes.status === 'fulfilled' ? (productsRes.value.data || []) : [])

    // 为商品添加热卖标记
    const products = rawProducts.map((p, i) => ({
      ...p,
      isHot: i < 3 && p.sales > 100
    }))

    this.setData({
      banners,
      categories,
      products,
      productCount: products.length
    })
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  goCategory(e) {
    const { id } = e.currentTarget.dataset
    app.globalData.selectedCategoryId = id
    wx.switchTab({ url: '/pages/category/category' })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  goMore() {
    wx.switchTab({ url: '/pages/category/category' })
  },

  // Banner 点击：跳转到对应商品或活动
  goBanner(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    if (item.productId) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${item.productId}` })
    } else if (item.url) {
      wx.navigateTo({ url: item.url })
    }
  },
})