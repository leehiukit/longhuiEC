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
   * 流程：
   *   ① phoneLogin(code) → token+phone → 完成登录
   *   ② wx.login() + wx-login API → openid（独立获取，确保支付时可带上）
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
      // ① 本机号码一键登录
      const result = await API.phoneLogin(e.detail.code)
      const phone = result.phone

      if (!phone) {
        throw new Error('未获取到手机号')
      }

      // ② 独立调用 wx.login() 获取 openid（无论用什么登录方式都拿得到）
      let openid = result.openid || ''
      if (!openid) {
        try {
          const wxResult = await API.wxLogin()
          openid = wxResult.openid || ''
        } catch (_) {
          // wx-login 失败不阻断登录，支付时后端可自动查 openid
          console.warn('[登录] wx-login 获取 openid 失败，支付时将由后端自动查询')
        }
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
      this.setData({ phoneLogging: false })

      const needBindWechat = !openid

      wx.showToast({
        title: existingUser ? '欢迎回来' : '欢迎来到有闲甄选',
        icon: 'success', duration: 1200,
        complete: () => {
          const navigate = () => {
            const pages = getCurrentPages()
            pages.length >= 2 ? wx.navigateBack() : wx.switchTab({ url: '/pages/user/user' })
          }

          if (needBindWechat) {
            // 手机号登录后 openid 为空 → 推荐绑定微信
            setTimeout(() => {
              wx.showModal({
                title: '绑定微信',
                content: '检测到您使用手机号登录，建议绑定微信以获得更完整的服务体验（支付、订单通知等）',
                confirmText: '去绑定',
                cancelText: '稍后再说',
                success: async (res) => {
                  if (res.confirm) {
                    wx.showLoading({ title: '绑定中...', mask: true })
                    try {
                      const wxResult = await API.wxLogin()
                      const wechatOpenid = wxResult.openid || ''
                      if (wechatOpenid) {
                        const tokenData = wx.getStorageSync(TOKEN_KEY) || {}
                        tokenData.openid = wechatOpenid
                        wx.setStorageSync(TOKEN_KEY, tokenData)

                        const user = wx.getStorageSync(USER_KEY) || {}
                        user.openid = wechatOpenid
                        wx.setStorageSync(USER_KEY, user)

                        app.globalData.openid = wechatOpenid
                        app.globalData.userInfo = { ...(app.globalData.userInfo || {}), openid: wechatOpenid }

                        wx.hideLoading()
                        wx.showToast({ title: '微信绑定成功', icon: 'success', duration: 1500 })
                        setTimeout(navigate, 1500)
                      } else {
                        wx.hideLoading()
                        wx.showToast({ title: '绑定失败，可在个人中心重试', icon: 'none', duration: 2000 })
                        setTimeout(navigate, 2000)
                      }
                    } catch (_) {
                      wx.hideLoading()
                      wx.showToast({ title: '绑定失败，可在个人中心重试', icon: 'none', duration: 2000 })
                      setTimeout(navigate, 2000)
                    }
                  } else {
                    navigate()
                  }
                }
              })
            }, 300)
          } else {
            setTimeout(navigate, 500)
          }
        }
      })
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
