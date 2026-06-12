/**
 * API 对接层 — 有闲甄选
 * 已对接 erp.qixiangshou.com
 */
const CONFIG = {
  BASE_URL: 'https://erp.qixiangshou.com',
  APP_ID: 'wx8cf5c2ef49e867fe',
  MCH_ID: '1641058332',
  ERP_TOKEN_KEY: 'yxzx_erp_token',   // ERP 管理员 JWT（用于 API 鉴权）
  USER_TOKEN_KEY: 'yxzx_token'        // 用户微信登录信息
}

/* ==================== 通用请求（ERP 格式） ==================== */

/**
 * 基础请求：自动携带 token（优先用户 token，无则用管理员 token）
 */
function erpRequest(method, url, data, opts = {}) {
  return new Promise((resolve, reject) => {
    // 优先使用用户微信登录 token，无则 fallback 管理员 token
    const userToken = wx.getStorageSync(CONFIG.USER_TOKEN_KEY)
    const adminToken = wx.getStorageSync(CONFIG.ERP_TOKEN_KEY)
    const activeToken = (opts.useUser !== false && userToken?.token) ? userToken.token : (adminToken?.token || '')

    wx.request({
      url: CONFIG.BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': activeToken ? 'Bearer ' + activeToken : ''
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          // 提取 ERP 返回的详细错误信息
          let errMsg = ''
          const body = res.data
          if (typeof body === 'string') {
            errMsg = body.slice(0, 200)
          } else if (body && body.message) {
            errMsg = body.message
          } else if (body && body.error) {
            errMsg = body.error
          } else if (body && body.errmsg) {
            errMsg = body.errmsg
          }
          if (!errMsg) errMsg = '请求失败 (' + res.statusCode + ')'
          reject(new Error(errMsg))
        }
      },
      fail(err) { reject(err) }
    })
  })
}

/**
 * 用户请求：强制使用微信登录 token（用于支付/订单等用户操作）
 */
function userRequest(method, url, data) {
  return erpRequest(method, url, data, { useUser: true })
}

/* ==================== 商家后台登录 ==================== */

/**
 * 商家管理后台账号登录
 * POST /api/v1/auth/login
 */
function adminLogin(email, password) {
  return erpRequest('POST', '/api/v1/auth/login', { email, password })
}

/** 获取当前用户信息 GET /api/v1/auth/me */
function getMe() {
  return erpRequest('GET', '/api/v1/auth/me')
}

/* ==================== 微信小程序登录（wx.login → ERP 换 token） ==================== */

/**
 * 微信登录：wx.login 获取临时 code → 发送到 ERP 后端换取 openid + token
 *
 * 【后端接口规范】
 * POST /api/v1/auth/wx-login
 * Body: { code: "wx.login 返回的临时 code" }
 *
 * 后端需要做的事情：
 * 1. 调用微信官方接口：
 *    GET https://api.weixin.qq.com/sns/jscode2session
 *    ?appid={小程序AppID}&secret={小程序AppSecret}&js_code={客户端传来的code}&grant_type=authorization_code
 * 2. 微信返回 { openid, session_key, unionid }（session_key 不要下发给前端）
 * 3. 根据 openid 查找/创建用户，生成 JWT token
 * 4. 返回 { token, openid }
 */
function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) return reject(new Error('wx.login 未返回 code'))

        // wx-login 无需鉴权，直接发 code 到 ERP 换取用户 token
        erpRequest('POST', '/api/v1/auth/wx-login', { code: loginRes.code }, { useUser: false })
          .then(res => {
            if (!res.token) return reject(new Error('后端未返回 token'))
            resolve({
              token: res.token,
              openid: res.openid || '',
              unionid: res.unionid || ''
            })
          })
          .catch(err => reject(new Error('微信登录失败: ' + (err.message || '未知错误'))))
      },
      fail(err) { reject(new Error('wx.login 失败: ' + JSON.stringify(err))) }
    })
  })
}

/**
 * 微信手机号授权 → 发送到 ERP 后端解密
 *
 * 【后端接口规范】
 * POST /api/v1/auth/phone
 * Body: { code: "getPhoneNumber 返回的 code" }
 *
 * 后端需要做的事情：
 * 1. 获取 access_token：
 *    GET https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={APPID}&secret={SECRET}
 * 2. 用 access_token 调用微信接口解密手机号：
 *    POST https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={ACCESS_TOKEN}
 *    Body: { code: "客户端传来的 code" }
 * 3. 微信返回 { phone_info: { phoneNumber, purePhoneNumber, countryCode } }
 * 4. 把 phoneNumber 返回给前端
 *
 * 返回: { phoneNumber: "138xxxx1234" }
 */
function getPhoneNumber(e) {
  return new Promise((resolve, reject) => {
    if (e.detail.errMsg && e.detail.errMsg.includes('fail')) {
      return reject(new Error('用户取消授权'))
    }
    const code = e.detail.code
    if (!code) return reject(new Error('未获取到手机号授权码'))

    // 将 code 发送到 ERP 后端解密（需用户 token）
    userRequest('POST', '/api/v1/auth/phone', { code })
      .then(res => {
        if (!res.phoneNumber) return reject(new Error('后端未返回手机号'))
        resolve({ phoneNumber: res.phoneNumber })
      })
      .catch(err => reject(new Error('手机号获取失败: ' + (err.message || '未知错误'))))
  })
}

/**
 * 本机号码一键登录（微信）
 * POST /api/v1/auth/phone-login
 *
 * 前端通过 <button open-type="getPhoneNumber"> 拿到 code 后调用此接口，
 * 后端解密手机号 → 查/建 User → 签发 JWT，无需短信验证码。
 *
 * Body: { code: "getPhoneNumber 返回的 code" }
 * Response: { token, phone, user: { id, name, phone, role } }
 */
function phoneLogin(code) {
  return new Promise((resolve, reject) => {
    erpRequest('POST', '/api/v1/auth/phone-login', { code }, { useUser: false })
      .then(res => {
        if (!res.token) return reject(new Error('后端未返回 token'))
        resolve({
          token: res.token,
          phone: res.phone || '',
          openid: res.openid || res.user?.openid || '',
          user: res.user || {}
        })
      })
      .catch(err => reject(new Error('一键登录失败: ' + (err.message || '未知错误'))))
  })
}

/**
 * 获取用户头像/昵称（从本地缓存读取，由微信侧提供）
 */
function getUserProfile() {
  const stored = wx.getStorageSync('yxzx_user') || {}
  return Promise.resolve({
    nickName: stored.nickName || '',
    avatarUrl: stored.avatarUrl || '',
    gender: 0
  })
}

/* ==================== 微信支付（通过 ERP 后端统一下单） ==================== */

/**
 * 统一下单 → 调用 ERP 后端，拿到 prepay_id 和支付签名参数
 *
 * 【后端接口规范】
 * POST /api/v1/payment/unify
 * Body: {
 *   orderNo: "ERP 订单号",
 *   totalFee: 金额（分，整数）,
 *   body: "商品描述",
 *   openid: "用户 openid（可选，不传时后端自动查数据库）",
 *   attach: "附加数据（可选）"
 * }
 *
 * 后端需要做的事情（微信支付 API V3）：
 * 1. 调用微信统一下单接口：
 *    POST https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi
 *    Header: Authorization: WECHATPAY2-SHA256-RSA2048 ...
 *    Body: {
 *      appid: "wx8cf5c2ef49e867fe",
 *      mchid: "1641058332",
 *      description: body,
 *      out_trade_no: orderNo,
 *      notify_url: "https://erp.qixiangshou.com/api/v1/payment/notify",
 *      amount: { total: totalFee, currency: "CNY" },
 *      payer: { openid: openid }
 *    }
 * 2. 微信返回 { prepay_id: "wx..." }
 * 3. 用商户私钥对以下参数签名（RSA 或 MD5）：
 *    - appId: 小程序的 AppID
 *    - timeStamp: String(Math.floor(Date.now() / 1000))
 *    - nonceStr: 随机字符串（32位以内）
 *    - package: "prepay_id=" + prepay_id
 *    - signType: "RSA"（推荐）或 "MD5"
 * 4. 计算签名后返回给前端：
 *    { prepay_id, timeStamp, nonceStr, package, signType, paySign }
 *
 * 前端拿到这些参数后调用 wx.requestPayment 拉起支付
 */
function unifiedOrder(orderData) {
  return userRequest('POST', '/api/v1/payment/unify', {
    orderNo: orderData.orderId || orderData.orderNo || '',
    totalFee: orderData.totalFee,
    body: orderData.body || '有闲甄选商品',
    openid: orderData.openid || '',
    attach: orderData.attach || ''
  })
}

/**
 * 调起微信支付
 * 参数由 unifiedOrder 从后端返回
 */
function requestPayment(payParams) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: payParams.timeStamp || '',
      nonceStr: payParams.nonceStr || '',
      package: payParams.package || '',
      signType: payParams.signType || 'RSA',
      paySign: payParams.paySign || '',
      success(res) {
        resolve(res)
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

/* ==================== 图片地址补全 ==================== */

function fixImageUrl(url) {
  if (!url) return '/images/logos/other.png'
  if (url.startsWith('http')) return url
  return CONFIG.BASE_URL + url
}

function fixProduct(p) {
  const images = (p.images || []).map(fixImageUrl)
  const image = images[0] || fixImageUrl(p.image) || '/images/logos/other.png'
  return {
    id: p.id,
    title: p.title || '',
    description: p.description || '',
    desc: p.description || '',
    image,
    images: images.length ? images : [image],
    category: p.category || '',
    categoryId: p.category || '',
    price: p.price || 0,
    originalPrice: p.price || 0,
    stock: p.stockQty != null ? p.stockQty : (p.stock != null ? p.stock : 0),
    stockQty: p.stockQty,
    status: p.status,
    published: p.published,
    specs: p.specs || null,
    specsText: p.specs || '',
    sortOrder: p.sortOrder || 0,
    sales: p.sales != null ? p.sales : (p.soldCount != null ? p.soldCount : (p.soldQty != null ? p.soldQty : 0)),
    condition: '匠心甄选',
    conditionDesc: '每件商品均通过专业团队12道严苛检测工序，涵盖外观成色评估、屏幕触控灵敏测试、电池健康度与续航实测、摄像头光学成像校验、全端口连接性验证、扬声器/麦克风清晰度测试、WiFi与蓝牙信号稳定检测、CPU/GPU满载压力测试等。确保功能100%完好、外观至多达A+级标准，性能稳如新品。',
    rating: '4.8'
  }
}

/* ==================== 商品接口（对接 ERP） ==================== */

/**
 * 获取商品列表
 * GET /api/v1/products?published=true&status=ONLINE&category=xxx&query=xxx
 */
async function getProducts(params = {}) {
  try {
    const query = []
    if (params.published !== false) query.push('published=true')
    if (params.status) query.push('status=' + params.status)
    else query.push('status=ONLINE')
    if (params.categoryId || params.category) query.push('category=' + encodeURIComponent(params.categoryId || params.category))
    if (params.query || params.keyword) query.push('query=' + encodeURIComponent(params.query || params.keyword))
    if (params.page) query.push('page=' + params.page)
    if (params.pageSize) query.push('pageSize=' + params.pageSize)

    const res = await erpRequest('GET', '/api/v1/products' + (query.length ? '?' + query.join('&') : ''))
    const items = (res.items || []).map(fixProduct)
    return { code: 0, data: items, page: res.page, pageSize: res.pageSize, total: res.total }
  } catch (e) {
    // ERP 不可用时返回空数据，避免上层崩溃
    return { code: 0, data: [], page: 1, pageSize: params.pageSize || 20, total: 0 }
  }
}

/**
 * 获取商品详情
 * GET /api/v1/products/{id}
 */
async function getProductDetail(id) {
  const res = await erpRequest('GET', '/api/v1/products/' + id)
  return { code: 0, data: fixProduct(res) }
}

/**
 * 搜索商品
 */
function searchProducts(keyword) {
  if (!keyword) return Promise.resolve({ code: 0, data: [] })
  return getProducts({ query: keyword })
}

/**
 * 获取分类列表
 * 本地预设分类 + ERP 商品动态分类合并
 */
async function getCategories() {
  // 品牌分类与对应图标（真实配置，始终作为基础展示）
  const CATEGORY_ICONS = {
    'Apple':      '/images/logos/apple.png',
    'ThinkPad':    '/images/logos/thinkpad.jpg',
    '华为':        '/images/logos/huawei.jpg',
    '联想':        '/images/logos/lenovo.jpg',
    '华硕':        '/images/logos/asus.png',
    '惠普':        '/images/logos/hp.jpeg',
    '戴尔':        '/images/logos/dell.png',
    '微软':        '/images/logos/microsoft.jpg',
    '游戏本':      '/images/logos/gaming.png',
    '移动工作站':  '/images/logos/workstation.png',
    '二合一':      '/images/logos/other.png',
    '其他':        '/images/logos/other.png'
  }

  // 基础分类：始终展示全部品牌
  const base = Object.entries(CATEGORY_ICONS).map(([name, iconImage]) => ({
    id: name,
    name,
    iconImage
  }))

  try {
    // 从 ERP 拉取所有商品，提取去重分类，追加基础分类之外的新增分类
    const res = await getProducts({ pageSize: 50 })
    const erpCats = [...new Set(res.data.map(p => p.category).filter(Boolean))]
    const baseIds = new Set(base.map(c => c.id))
    erpCats.forEach(c => {
      if (!baseIds.has(c)) {
        base.push({ id: c, name: c, iconImage: '/images/logos/other.png' })
      }
    })
  } catch (_) { /* ERP 不可用时仍展示基础分类 */ }

  return { code: 0, data: base }
}

/**
 * 轮播图（对接 ERP）
 * GET /api/v1/banners（无需认证）
 */
async function getBanners() {
  try {
    const res = await erpRequest('GET', '/api/v1/banners')
    const list = (Array.isArray(res) ? res : (res.data || res.items || []))
    if (!list.length) return { code: 0, data: [] }

    // 按 sortOrder 升序排列
    list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    // 处理图片 & 补全字段
    const data = list.map(b => ({
      id: b.id,
      title: b.title || '',
      desc: b.desc || '',
      color: b.color || '#E74C3C',
      productId: b.productId || '',
      productTitle: b.productTitle || '',
      imageUrl: b.imageUrl ? fixImageUrl(b.imageUrl) : '',
      sortOrder: b.sortOrder || 0
    }))
    return { code: 0, data }
  } catch (e) {
    return { code: 0, data: [] }
  }
}

/* ==================== 设备（对接 ERP） ==================== */

/**
 * 获取设备列表
 * GET /api/v1/devices?status=IN_STOCK
 */
function getDevices(params = {}) {
  const query = []
  if (params.status) query.push('status=' + params.status)
  return erpRequest('GET', '/api/v1/devices' + (query.length ? '?' + query.join('&') : ''))
}

/**
 * 获取设备详情
 * GET /api/v1/devices/{id}
 */
function getDeviceDetail(id) {
  return erpRequest('GET', '/api/v1/devices/' + id)
}

/* ==================== 电商订单（对接 ERP） ==================== */

/**
 * 创建订单
 * POST /api/v1/ecommerce/orders
 */
function createEcommerceOrder(data) {
  return userRequest('POST', '/api/v1/ecommerce/orders', data)
}

/**
 * 查询订单
 * GET /api/v1/ecommerce/orders?id=xxx 或 ?orderNo=xxx
 */
function getEcommerceOrders(params = {}) {
  const query = []
  if (params.id) query.push('id=' + params.id)
  if (params.orderNo) query.push('orderNo=' + params.orderNo)
  return userRequest('GET', '/api/v1/ecommerce/orders' + (query.length ? '?' + query.join('&') : ''))
}

/**
 * 支付回调（支付成功后通知 ERP）
 * POST /api/v1/ecommerce/callback
 */
function ecommerceCallback(orderNo, event, extra = {}) {
  return userRequest('POST', '/api/v1/ecommerce/callback', { orderNo, event, ...extra })
}

/**
 * 导出订单 CSV
 * GET /api/v1/ecommerce/orders/export?status=xxx&q=xxx
 */
function exportOrders(params = {}) {
  const query = []
  if (params.status) query.push('status=' + params.status)
  if (params.afterSales) query.push('afterSales=' + params.afterSales)
  if (params.q) query.push('q=' + encodeURIComponent(params.q))
  return userRequest('GET', '/api/v1/ecommerce/orders/export' + (query.length ? '?' + query.join('&') : ''))
}

/**
 * 退货物流上报 — 客户寄回商品后填写快递单号，同步到 ERP
 *
 * 【后端接口规范（ERP 需实现）】
 * POST /api/v1/ecommerce/callback
 * Body: {
 *   orderNo: "EC-20260609-001",
 *   event: "RETURN_SHIPPED",
 *   carrier: "顺丰速运",
 *   trackingNumber: "SF1234567890"
 * }
 */
function submitReturnTracking(orderNo, carrier, trackingNumber) {
  return userRequest('POST', '/api/v1/ecommerce/callback', {
    orderNo,
    event: 'RETURN_SHIPPED',
    returnCarrier: carrier || '顺丰速运',
    returnTrackingNumber: trackingNumber
  })
}

/**
 * 发起退款 — 调用微信退款接口，从原支付路径退回款项
 *
 * 【后端接口规范】
 * POST /api/v1/payment/refund
 * Body: {
 *   orderNo: "EC-20260609-001",
 *   refundAmount: 99.00,    // 可选，默认全额退款
 *   reason: "用户申请退款"   // 可选
 * }
 *
 * 后端会：
 * 1. 校验订单状态（PAID / SHIPPED / DELIVERED / COMPLETED）
 * 2. 调用微信退款接口
 * 3. 更新订单售后状态为 REFUNDED 或 REFUNDING
 *
 * Response: { refundId, outRefundNo, status, refundAmount, afterSalesStatus }
 */
function paymentRefund(orderNo, refundAmount, reason) {
  const body = { orderNo }
  if (refundAmount != null) body.refundAmount = refundAmount
  if (reason) body.reason = reason
  return userRequest('POST', '/api/v1/payment/refund', body)
}

/* ==================== 客户档案（对接 ERP） ==================== */

/**
 * 获取客户档案 + 可用优惠券
 * GET /api/v1/customers/me?phone=xxx
 */
function getCustomerProfile(phone) {
  return userRequest('GET', '/api/v1/customers/me?phone=' + encodeURIComponent(phone))
}

/**
 * 查询订单可用优惠券
 * GET /api/v1/coupons/available?customerId=xxx&orderAmount=xxx&productIds=xxx
 */
function getAvailableCoupons(customerId, orderAmount, productIds) {
  let url = `/api/v1/coupons/available?customerId=${encodeURIComponent(customerId)}&orderAmount=${orderAmount}`
  if (productIds) url += '&productIds=' + encodeURIComponent(productIds)
  return userRequest('GET', url)
}

/**
 * 使用优惠券抵扣订单
 * POST /api/v1/coupons/available
 * Body: { couponId, orderId }
 */
function useCoupon(couponId, orderId) {
  return userRequest('POST', '/api/v1/coupons/available', { couponId, orderId })
}

/* ==================== 文件上传（需 Bearer token） ==================== */

/**
 * 上传图片文件
 * POST /api/v1/upload (multipart/form-data, field: file)
 * 返回: { url: "/uploads/products/xxx.png" }
 */
function upload(filePath) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync(CONFIG.USER_TOKEN_KEY)
    wx.uploadFile({
      url: CONFIG.BASE_URL + '/api/v1/upload',
      filePath,
      name: 'file',
      header: {
        'Authorization': token?.token ? 'Bearer ' + token.token : ''
      },
      success(res) {
        try {
          const data = JSON.parse(res.data)
          if (data.url) {
            resolve(data)
          } else {
            reject(new Error(data.message || '上传失败'))
          }
        } catch {
          reject(new Error('解析响应失败'))
        }
      },
      fail(err) { reject(err) }
    })
  })
}

/* ==================== 导出 ==================== */

module.exports = {
  CONFIG,
  wxLogin,
  adminLogin,
  getMe,
  getPhoneNumber,
  phoneLogin,
  getUserProfile,
  unifiedOrder,
  requestPayment,
  getBanners,
  getCategories,
  getProducts,
  getProductDetail,
  searchProducts,
  getDevices,
  getDeviceDetail,
  createEcommerceOrder,
  getEcommerceOrders,
  exportOrders,
  ecommerceCallback,
  submitReturnTracking,
  paymentRefund,
  getCustomerProfile,
  getAvailableCoupons,
  useCoupon,
  upload
}
