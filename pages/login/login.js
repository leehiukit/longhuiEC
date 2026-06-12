// 登录页逻辑 - 有闲甄选（本机号码一键登录）
const app = getApp()
const API = require('../../utils/api')

const TOKEN_KEY = 'yxzx_token'
const USER_KEY  = 'yxzx_user'
const TOKEN_EXPIRE_DAYS = 7

Page({
  data: {
    logoPath: app.globalData.logoPath || '',
    agreed: true,
    phoneLogging: false,    // 本机号码一键登录进行中
    wechatLogging: false    // 微信一键登录进行中
  },

  onShow() {
    if (app.globalData.isLoggedIn) {
      const pages = getCurrentPages()
      pages.length >= 2 ? wx.navigateBack() : wx.switchTab({ url: '/pages/user/user' })
    }
  },

  /* ==================== 本机号码一键登录 ==================== */

  /**
   * 本机号码一键登录（getPhoneNumber 回调）
   * 流程：getPhoneNumber code → POST /api/v1/auth/phone-login → token+phone+user → 完成登录
   */
  async onPhoneLogin(e) {
    if (e.detail.errMsg && e.detail.errMsg.includes('fail')) {
      return wx.showToast({ title: '授权已取消', icon: 'none' })
    }

    if (!this.data.agreed) {
      return wx.showToast({ title: '请先同意协议', icon: 'none' })
    }

    this.setData({ phoneLogging: true })
    wx.showLoading({ title: '号码认证中...', mask: true })

    try {
      const result = await API.phoneLogin(e.detail.code)
      const phone = result.phone
      const openid = result.openid

      if (!phone) {
        throw new Error('未获取到手机号')
      }

      // 构建用户信息
      const existingUser = this.getExistingUser(phone)
      const userInfo = existingUser
        ? { ...existingUser, openid, lastLogin: new Date().toISOString() }
        : {
            id: 'U' + Date.now().toString(36).toUpperCase(),
            nickName: `甄选会员${phone.slice(-4)}`,
            avatarUrl: '',
            phone,
            openid,
            level: 1,
            registerTime: new Date().toISOString()
          }

      // 写入 token + user
      wx.setStorageSync(TOKEN_KEY, {
        token: result.token,
        openid,
        phone,
        createdAt: Date.now(),
        expiresAt: Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000
      })
      wx.setStorageSync(USER_KEY, userInfo)

      app.globalData.isLoggedIn = true
      app.globalData.userInfo = userInfo
      app.globalData.openid = openid

      app.onLoginSuccess(phone)
      this.saveUserRecord(phone, userInfo)

      wx.hideLoading()
      wx.showToast({
        title: existingUser ? '欢迎回来' : '欢迎来到有闲甄选',
        icon: 'success', duration: 1500,
        complete: () => {
          setTimeout(() => {
            const pages = getCurrentPages()
            pages.length >= 2 ? wx.navigateBack() : wx.switchTab({ url: '/pages/user/user' })
          }, 1500)
        }
      })
      this.setData({ phoneLogging: false })
    } catch (err) {
      wx.hideLoading()
      this.setData({ phoneLogging: false })
      wx.showToast({ title: err.message || '登录失败，请重试', icon: 'none' })
    }
  },

  /* ==================== 微信一键登录（备选） ==================== */

  /**
   * 微信一键登录（getPhoneNumber 回调）
   * 流程：① wxLogin() 拿 token+openid → ② phone API 解密手机号 → 完成登录
   */
  async onGetPhone(e) {
    if (e.detail.errMsg && e.detail.errMsg.includes('fail')) {
      return wx.showToast({ title: '授权已取消', icon: 'none' })
    }

    if (!this.data.agreed) {
      return wx.showToast({ title: '请先同意协议', icon: 'none' })
    }

    this.setData({ wechatLogging: true })
    wx.showLoading({ title: '微信授权中...', mask: true })

    try {
      const loginResult = await API.wxLogin()
      const openid = loginResult.openid || ''

      const { phoneNumber: phone } = await API.getPhoneNumber(e)

      if (!phone) {
        throw new Error('未获取到手机号')
      }

      const existingUser = this.getExistingUser(phone)
      const userInfo = existingUser
        ? { ...existingUser, openid, lastLogin: new Date().toISOString() }
        : {
            id: 'U' + Date.now().toString(36).toUpperCase(),
            nickName: `甄选会员${phone.slice(-4)}`,
            avatarUrl: '',
            phone,
            openid,
            level: 1,
            registerTime: new Date().toISOString()
          }

      wx.setStorageSync(TOKEN_KEY, {
        token: loginResult.token, openid, phone,
        createdAt: Date.now(),
        expiresAt: Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000
      })
      wx.setStorageSync(USER_KEY, userInfo)

      app.globalData.isLoggedIn = true
      app.globalData.userInfo = userInfo
      app.globalData.openid = openid

      app.onLoginSuccess(phone)
      this.saveUserRecord(phone, userInfo)

      wx.hideLoading()
      wx.showToast({
        title: '微信登录成功',
        icon: 'success', duration: 1500,
        complete: () => {
          setTimeout(() => {
            const pages = getCurrentPages()
            pages.length >= 2 ? wx.navigateBack() : wx.switchTab({ url: '/pages/user/user' })
          }, 1500)
        }
      })
      this.setData({ wechatLogging: false })
    } catch (err) {
      wx.hideLoading()
      this.setData({ wechatLogging: false })
      wx.showToast({ title: err.message || '微信登录失败', icon: 'none' })
    }
  },

  /* ==================== 工具方法 ==================== */

  getExistingUser(phone) {
    const records = wx.getStorageSync('yxzx_phone_users') || {}
    return records[phone] || null
  },

  saveUserRecord(phone, userInfo) {
    const records = wx.getStorageSync('yxzx_phone_users') || {}
    records[phone] = { ...userInfo, lastLogin: new Date().toISOString() }
    wx.setStorageSync('yxzx_phone_users', records)
  },

  onAgreeChange(e) { this.setData({ agreed: e.detail.value.length > 0 }) },

  viewAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=service' })
  },

  viewPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' })
  }
})
