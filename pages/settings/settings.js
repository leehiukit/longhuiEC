// 设置页面
const app = getApp()

Page({
  data: {
    userInfo: {},
    cacheSize: '0 KB',
    appVersion: getApp().globalData.appVersion || '1.0.1'
  },

  onShow() {
    const userInfo = { ...(app.globalData.userInfo || {}) }
    // 兜底：如果 userInfo 没有手机号，从 token 中取
    if (!userInfo.phone) {
      const tokenData = wx.getStorageSync('yxzx_token')
      if (tokenData && tokenData.phone) {
        userInfo.phone = tokenData.phone
      }
    }
    this.setData({ userInfo })
    this.calcCacheSize()
  },

  // 计算缓存大小
  calcCacheSize() {
    try {
      const res = wx.getStorageInfoSync()
      const size = res.currentSize || 0
      const display = size < 1024 ? size + ' KB' : (size / 1024).toFixed(1) + ' MB'
      this.setData({ cacheSize: display })
    } catch (e) {
      this.setData({ cacheSize: '未知' })
    }
  },

  // 修改头像
  editAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0]
        // 模拟环境中直接使用临时路径作为头像
        const userInfo = {
          ...(app.globalData.userInfo || {}),
          avatarUrl: tempPath
        }
        app.globalData.userInfo = userInfo
        wx.setStorageSync('yxzx_user', userInfo)
        this.setData({ userInfo })
        wx.showToast({ title: '头像已更新', icon: 'success' })
      }
    })
  },

  // 查看手机号
  showPhone() {
    const phone = this.data.userInfo.phone
    if (phone) {
      wx.showModal({
        title: '绑定手机号',
        content: phone,
        showCancel: false,
        confirmText: '知道了'
      })
    }
  },

  // 修改昵称
  editNickname() {
    const { nickName = '' } = this.data.userInfo
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      content: nickName,
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const newNick = res.content.trim()
          const userInfo = {
            ...(app.globalData.userInfo || {}),
            nickName: newNick
          }
          app.globalData.userInfo = userInfo
          wx.setStorageSync('yxzx_user', userInfo)
          this.setData({ userInfo })
          wx.showToast({ title: '昵称已更新', icon: 'success' })
        }
      }
    })
  },

  // 清除缓存（保留核心用户数据）
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除搜索历史、浏览记录等临时缓存，不会影响您的订单、收货地址、收藏和优惠券数据。',
      success: (res) => {
        if (res.confirm) {
          try {
            // 只清除搜索历史等非核心缓存
            wx.removeStorageSync(app.accountKey('yxzx_search_history'))
            // 如果后续有浏览记录等缓存也在这里清除
            this.calcCacheSize()
            wx.showToast({ title: '缓存已清除', icon: 'success' })
          } catch (e) {
            wx.showToast({ title: '清除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 检查更新
  checkUpdate() {
    const updateManager = wx.getUpdateManager()
    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        wx.showLoading({ title: '更新中...' })
        updateManager.onUpdateReady(() => {
          wx.hideLoading()
          updateManager.applyUpdate()
        })
      } else {
        wx.showToast({ title: '已是最新版本', icon: 'none' })
      }
    })
  },

  // 关于
  showAbout() {
    wx.showModal({
      title: '关于有闲甄选',
      content: '有闲甄选是专注高品质数码好物的精选平台。\n\n'
        + '我们携手各大品牌，为你甄选每一件好物，让品质生活触手可及。\n\n'
        + '版本：v' + (getApp().globalData.appVersion || '1.0.1') + '\n'
        + '联系邮箱：service@kyrecycle.com',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 跳转协议
  toAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=service' })
  },

  toPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          wx.navigateBack()
        }
      }
    })
  },

  // 注销账号
  handleDeleteAccount() {
    wx.showModal({
      title: '注销账号',
      content: '注销后，您的个人信息将被删除或匿名化处理，订单记录将保留以满足财务合规要求。\n\n此操作不可撤销，确定继续吗？',
      confirmText: '确认注销',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 二次确认
          wx.showModal({
            title: '再次确认',
            content: '请再次确认您要永久注销账号，所有个人数据将被清除。',
            confirmText: '我确定注销',
            confirmColor: '#ff4d4f',
            success: (res2) => {
              if (res2.confirm) {
                // 清除账号隔离数据
                const phone = app.getUserPhone()
                if (phone) {
                  try {
                    const allKeys = wx.getStorageInfoSync().keys || []
                    allKeys.forEach(key => {
                      if (key.includes(phone)) {
                        wx.removeStorageSync(key)
                      }
                    })
                  } catch (_) { /* 忽略单个清除错误 */ }
                }
                // 清除全局 token
                wx.removeStorageSync('yxzx_token')
                wx.removeStorageSync('yxzx_user')
                // 清除全局数据引用
                app.globalData.isLoggedIn = false
                app.globalData.userInfo = null
                app.globalData.openid = ''
                app.globalData.cart = []
                wx.showToast({ title: '账号已注销', icon: 'success', duration: 2000 })
                setTimeout(() => {
                  wx.reLaunch({ url: '/pages/index/index' })
                }, 2000)
              }
            }
          })
        }
      }
    })
  },
})
