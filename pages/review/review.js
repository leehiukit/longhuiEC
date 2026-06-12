// 评价页面 - 有闲甄选
const app = getApp()

Page({
  data: {
    orderId: '',
    order: null,
    rating: 5,
    content: '',
    images: [],
    anonymous: false,
    submitting: false,
    tags: ['质量好', '性价比高', '物流快', '包装好', '描述相符', '服务好'],
    selectedTags: []
  },

  onLoad(options) {
    if (!options.orderId) {
      wx.showToast({ title: '订单参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const order = this.loadOrder(options.orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    this.setData({
      orderId: order.id,
      order
    })
  },

  loadOrder(orderId) {
    const orders = app.getOrders()
    return orders.find(o => o.id === orderId) || null
  },

  // 设置评分
  setRating(e) {
    const rating = e.currentTarget.dataset.rating
    this.setData({ rating })
  },

  // 输入评价内容
  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  // 切换标签
  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    let { selectedTags } = this.data
    const index = selectedTags.indexOf(tag)
    if (index > -1) {
      selectedTags.splice(index, 1)
    } else {
      if (selectedTags.length >= 3) {
        wx.showToast({ title: '最多选择3个标签', icon: 'none' })
        return
      }
      selectedTags.push(tag)
    }
    this.setData({ selectedTags })
  },

  // 切换匿名
  toggleAnonymous() {
    this.setData({ anonymous: !this.data.anonymous })
  },

  // 选择图片
  chooseImage() {
    const remain = 6 - this.data.images.length
    if (remain <= 0) {
      return wx.showToast({ title: '最多上传6张', icon: 'none' })
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          images: [...this.data.images, ...res.tempFilePaths]
        })
      }
    })
  },

  // 删除图片
  deleteImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== idx)
    this.setData({ images })
  },

  // 预览图片
  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.images
    })
  },

  // 提交评价
  submitReview() {
    const { rating, content, selectedTags, anonymous, images } = this.data

    if (rating === 0) {
      return wx.showToast({ title: '请选择评分', icon: 'none' })
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    wx.hideLoading()

    const review = app.addReview({
        orderId: this.data.orderId,
        rating,
        content,
        tags: selectedTags,
        anonymous,
        images
      })

    this.setData({ submitting: false })

    wx.showToast({
      title: '评价成功',
      icon: 'success',
      duration: 1500,
      complete: () => {
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    })
  }
})
