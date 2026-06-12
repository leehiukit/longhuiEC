// 搜索页逻辑
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    keyword: '',
    historyList: [],
    hotKeywords: ['ThinkPad', 'MacBook', '游戏本', '轻薄本', '华为', '联想', '戴尔', 'i7'],
    resultList: [],
    hasResult: false,
    sortBy: 'default',
    sortLabel: '综合排序'
  },

  onLoad() {
    this.loadHistory()
  },

  loadHistory() {
    const history = wx.getStorageSync(app.accountKey('yxzx_search_history')) || []
    this.setData({ historyList: history.slice(0, 8) })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  doSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) return
    
    // 保存历史
    let history = (wx.getStorageSync(app.accountKey('yxzx_search_history')) || []).filter(h => h !== keyword)
    history.unshift(keyword)
    if (history.length > 10) history = history.slice(0, 10)
    wx.setStorageSync(app.accountKey('yxzx_search_history'), history)
    this.setData({ historyList: history.slice(0, 8) })

    this.searchProducts(keyword)
  },

  searchKeyword(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword })
    this.doSearch()
  },

  async searchProducts(keyword) {
    try {
      const res = await api.searchProducts(keyword)
      let list = res.data || []
      
      // 本地过滤（模拟数据时使用）
      if (list.length === 0) {
        const allRes = await api.getProducts()
        list = allRes.data.filter(p => 
          p.title.toLowerCase().includes(keyword.toLowerCase()) ||
          (p.brand && p.brand.includes(keyword)) ||
          (p.specs && p.specs.toLowerCase().includes(keyword.toLowerCase()))
        )
      }

      // 排序
      if (this.data.sortBy === 'sales') {
        list.sort((a, b) => b.sales - a.sales)
      } else if (this.data.sortBy === 'price') {
        list.sort((a, b) => a.price - b.price)
      }

      this.setData({ resultList: list, hasResult: true })
    } catch (e) {
    }
  },

  toggleSort() {
    const sorts = [
      { value: 'default', label: '综合排序' },
      { value: 'sales', label: '销量优先' },
      { value: 'price', label: '价格升序' }
    ]
    const idx = sorts.findIndex(s => s.value === this.data.sortBy)
    const next = sorts[(idx + 1) % sorts.length]
    
    this.setData({ sortBy: next.value, sortLabel: next.label })
    
    if (this.data.hasResult) {
      this.searchProducts(this.data.keyword)
    }
  },

  clearHistory() {
    wx.removeStorageSync(app.accountKey('yxzx_search_history'))
    this.setData({ historyList: [] })
    wx.showToast({ title: '已清空', icon: 'success' })
  },

  goBack() {
    wx.navigateBack()
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})