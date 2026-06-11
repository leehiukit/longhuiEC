// 我的收藏
const app = getApp()

Page({
  data: {
    favorites: []
  },

  onShow() {
    this.loadFavorites()
  },

  loadFavorites() {
    const favs = wx.getStorageSync('yxzx_favorites') || []
    this.setData({ favorites: favs })
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  removeFav(e) {
    const { id } = e.currentTarget.dataset
    const favs = this.data.favorites.filter(item => item.id !== id)
    wx.setStorageSync('yxzx_favorites', favs)
    this.setData({ favorites: favs })
    wx.showToast({ title: '已取消收藏', icon: 'none' })
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有收藏吗？',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('yxzx_favorites', [])
          this.setData({ favorites: [] })
          wx.showToast({ title: '已清空', icon: 'none' })
        }
      }
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
