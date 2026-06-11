// 评价详情页面 - 有闲甄选
const app = getApp()

Page({
  data: {
    reviewId: '',
    review: null,
    loading: true
  },

  onLoad(options) {
    if (!options.reviewId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    this.loadReview(options.reviewId)
  },

  loadReview(reviewId) {
    const review = app.getReviewById(reviewId)
    if (!review) {
      wx.showToast({ title: '评价不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    this.setData({
      reviewId,
      review,
      loading: false
    })
  },

  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.src
    wx.previewImage({
      current,
      urls: this.data.review.images || []
    })
  }
})
