// 登录页逻辑 - 有闲甄选（已对接微信登录）
const app = getApp()
const API = require('../../utils/api')

const TOKEN_KEY = 'yxzx_token'
const USER_KEY  = 'yxzx_user'
const TOKEN_EXPIRE_DAYS = 7

Page({
  data: {
    logoPath: app.globalData.logoPath || '',
    phone: '',
    code: '',
    countdown: 0,
    loading: false,
    agreed: true,
    sentCode: null,
    wechatLogging: false  // 微信一键登录进行中
  },

  onShow() {
    if (app.globalData.isLoggedIn) {
      const pages = getCurrentPages()
      pages.length >= 2 ? wx.navigateBack() : wx.switchTab({ url: '/pages/user/user' })
    }
  },

  /* ==================== 手机号+验证码登录 ==================== */

  /* ==================== 手机号+验证码登录 ==================== */

  onPhoneInput(e) { this.setData({ phone: e.detail.value }) },
  onCodeInput(e)  { this.setData({ code: e.detail.value }) },

  startCountdown() {
    let count = 60
    this.setData({ countdown: count })
    this.clearCountdown()
    this._countdownTimer = setInterval(() => {
      count--
      this.setData({ countdown: count })
      if (count <= 0) {
        this.clearCountdown()
      }
    }, 1000)
  },

  clearCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  sendCode() {
    const { phone } = this.data
    if (!/^1\d{10}$/.test(phone)) {
      return wx.showToast({ title: '手机号格式不正确', icon: 'none' })
    }
    wx.showLoading({ title: '发送中...' })
    setTimeout(() => {
      wx.hideLoading()
      const code = String(Math.floor(100000 + Math.random() * 900000))
      this.setData({ sentCode: code })
      wx.showModal({
        title: '验证码已发送',
        content: `验证码：${code}（有效期5分钟）\n手机号：${phone}`,
        showCancel: false, confirmText: '知道了'
      })
      this.startCountdown()
    }, 800)
  },

  /**
   * 手机号验证码登录
   * 流程：校验验证码 → wx.login 获取 openid → 本地写入用户/token
   */
  async doLogin() {
    const { phone, code, agreed, loading, sentCode } = this.data
    if (loading) return
    if (!agreed) return wx.showToast({ title: '请先同意协议', icon: 'none' })
    if (!phone || !code) return wx.showToast({ title: '请填写完整信息', icon: 'none' })

    if (!sentCode) return wx.showToast({ title: '请先获取验证码', icon: 'none' })
    if (code !== sentCode) return wx.showToast({ title: '验证码不正确', icon: 'none' })

    this.setData({ loading: true })
    try {
      // ① 验证码校验通过，调用 wx.login 获取 openid
      wx.showLoading({ title: '登录中...', mask: true })
      const loginResult = await API.wxLogin()
      wx.hideLoading()

      // ② 构建用户信息
      const existingUser = this.getExistingUser(phone)
      const userInfo = existingUser ? { ...existingUser, lastLogin: new Date().toISOString() } : {
        id: 'U' + Date.now().toString(36).toUpperCase(),
        nickName: `甄选会员${phone.slice(-4)}`,
        avatarUrl: '',
        phone,
        openid: loginResult.openid,
        level: 1,
        registerTime: new Date().toISOString()
      }
      // 补充 openid
      if (!userInfo.openid) userInfo.openid = loginResult.openid

      // ③ 写入 token（含 openid 和过期时间）
      const tokenData = {
        token: loginResult.token,
        openid: loginResult.openid,
        phone,
        createdAt: Date.now(),
        expiresAt: Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000
      }

      wx.setStorageSync(TOKEN_KEY, tokenData)
      wx.setStorageSync(USER_KEY, userInfo)

      app.globalData.isLoggedIn = true
      app.globalData.userInfo = userInfo
      app.globalData.openid = loginResult.openid

      // 按账号隔离数据
      app.onLoginSuccess(phone)

      this.saveUserRecord(phone, userInfo)

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
      this.setData({ loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.hideLoading()
      wx.showToast({ title: e.message || '登录失败，请重试', icon: 'none' })
    }
  },

  getExistingUser(phone) {
    const records = wx.getStorageSync('yxzx_phone_users') || {}
    return records[phone] || null
  },

  saveUserRecord(phone, userInfo) {
    const records = wx.getStorageSync('yxzx_phone_users') || {}
    records[phone] = { ...userInfo, lastLogin: new Date().toISOString() }
    wx.setStorageSync('yxzx_phone_users', records)
  },

  /* ==================== 微信一键登录 ==================== */

  /**
   * 微信一键登录（getPhoneNumber 回调）
   * 流程：① wxLogin() 拿 token+openid → ② phone API 解密手机号 → 完成登录
   * 核心原则：openid 只依赖 wx.login()，手机号只是额外绑定
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
      // ① 先拿身份：wx.login → 后端 code2Session → token + openid
      const loginResult = await API.wxLogin()
      const openid = loginResult.openid || ''

      // ② 再解密手机号：用 step① 的 token 鉴权
      const { phoneNumber: phone } = await API.getPhoneNumber(e)

      if (!phone) {
        throw new Error('未获取到手机号')
      }

      // ③ 构建用户信息
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

      // ④ 写入 token + user
      wx.setStorageSync(TOKEN_KEY, { token: loginResult.token, openid, phone, createdAt: Date.now(), expiresAt: Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000 })
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

  /* ==================== 其他 ==================== */

  onAgreeChange(e) { this.setData({ agreed: e.detail.value.length > 0 }) },

  onUnload() {
    this.clearCountdown()
  },

  viewAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=service' })
  },

  viewPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' })
  }
})
