// 登录页逻辑 - 有闲甄选（已对接微信登录）
const app = getApp()
const API = require('../../utils/api')

const TOKEN_KEY = 'yxzx_token'
const USER_KEY  = 'yxzx_user'
const TOKEN_EXPIRE_DAYS = 7

// 微信审核测试账号
const TEST_ACCOUNT = {
  phone: '13800138000',
  code: '000000'
}

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
    // 审核测试账号：固定验证码 000000
    const isTest = phone === TEST_ACCOUNT.phone
    wx.showLoading({ title: '发送中...' })
    setTimeout(() => {
      wx.hideLoading()
      const code = isTest ? TEST_ACCOUNT.code : String(Math.floor(100000 + Math.random() * 900000))
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

    // 审核测试账号：无需先点发送验证码，直接校验
    const isTest = phone === TEST_ACCOUNT.phone && code === TEST_ACCOUNT.code
    if (!isTest) {
      if (!sentCode) return wx.showToast({ title: '请先获取验证码', icon: 'none' })
      if (code !== sentCode) return wx.showToast({ title: '验证码不正确', icon: 'none' })
    }

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
      // console.error('[Login] 登录失败:', e)
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
   * 微信一键登录（getPhoneNumber 回调）— 一次 API 调用完成
   * 流程：点按钮 → 微信授权弹窗 → 获取 code →
   *       wx.login() 拿 wxCode → phoneLogin(code, wxCode) → 后端一并返回 token + phone + openid
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
      // ① 先获取 wx.login 的 code（用于后端换取 openid）
      let wxCode = ''
      try {
        const wxLoginResult = await new Promise((resolve, reject) => {
          wx.login({ success: resolve, fail: reject })
        })
        wxCode = wxLoginResult.code || ''
      } catch (_) { /* wx.login 不可用不影响主流程 */ }

      // ② 一次请求：后端解密手机号 + 获取 openid + 签发 JWT
      const loginResult = await API.phoneLogin(e.detail.code, wxCode)
      const phone = loginResult.phone
      const token = loginResult.token
      const openid = loginResult.openid || ''

      if (!phone || !token) {
        throw new Error('后端未返回手机号或 token')
      }

      // ③ 构建用户信息（优先使用后端返回的 user）
      const existingUser = this.getExistingUser(phone)
      const backendUser = loginResult.user || {}
      const userInfo = existingUser
        ? { ...existingUser, ...backendUser, openid: openid || existingUser.openid || '', lastLogin: new Date().toISOString() }
        : {
            id: backendUser.id || ('U' + Date.now().toString(36).toUpperCase()),
            nickName: backendUser.name || `甄选会员${phone.slice(-4)}`,
            avatarUrl: '',
            phone,
            openid,
            level: 1,
            registerTime: new Date().toISOString(),
            ...backendUser
          }

      // ④ 写入 token + user
      wx.setStorageSync(TOKEN_KEY, { token, openid, phone, createdAt: Date.now(), expiresAt: Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000 })
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
