// 分类页逻辑
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    categories: [],
    currentCategory: null,
    products: [],
    sortBy: 'default',
    sortOptions: [
      { label: '综合', value: 'default' },
      { label: '销量', value: 'sales' },
      { label: '价格', value: 'price' }
    ],
    loading: false
  },

  onLoad() {
    this.loadCategories()
  },

  onShow() {
    // 从首页点击分类入口时，同步选中分类
    const selectedId = app.globalData.selectedCategoryId
    if (selectedId && this.data.categories.length > 0 && selectedId !== this.data.currentCategory) {
      this.setData({ currentCategory: selectedId })
      this.loadProducts()
      app.globalData.selectedCategoryId = null
    }
  },

  async loadCategories() {
    try {
      const res = await api.getCategories()
      const categories = res.data || []
      // 优先使用首页传入的分类ID
      const selectedId = app.globalData.selectedCategoryId
      const defaultId = selectedId && categories.find(c => c.id === selectedId)
        ? selectedId
        : categories[0]?.id || null
      
      this.setData({
        categories,
        currentCategory: defaultId
      })
      if (this.data.currentCategory) {
        this.loadProducts()
      }
      app.globalData.selectedCategoryId = null
    } catch (e) {
      // console.error('加载分类失败:', e)
    }
  },

  selectCategory(e) {
    const { id } = e.currentTarget.dataset
    this.setData({ currentCategory: id })
    this.loadProducts()
  },

  changeSort(e) {
    const { value } = e.currentTarget.dataset
    this.setData({ sortBy: value })
    this.loadProducts()
  },

  async loadProducts() {
    this.setData({ loading: true })
    try {
      const res = await api.getProducts({
        categoryId: this.data.currentCategory,
        sort: this.data.sortBy
      })
      let products = res.data || []
      // 排序处理
      if (this.data.sortBy === 'sales') {
        products.sort((a, b) => b.sales - a.sales)
      } else if (this.data.sortBy === 'price') {
        products.sort((a, b) => a.price - b.price)
      }
      this.setData({ products, loading: false })
    } catch (e) {
      // console.error('加载商品失败:', e)
      this.setData({ loading: false })
    }
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  }
})