# 有闲甄选 ERP API 文档

Base URL: `https://erp.qixiangshou.com`

---

## 认证

### POST /api/v1/auth/login

邮箱密码登录（ERP 管理员后台使用）。

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "admin@local.erp",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "cmotmhlu50006p7utol2ncig1",
    "name": "Admin",
    "email": "admin@local.erp",
    "role": "ADMIN"
  }
}
```

### POST /api/v1/auth/wx-login

微信小程序登录。接收 `wx.login()` 返回的临时 code，换取 openid 并签发 JWT。

**Headers:**
```
Content-Type: application/json
```

**Body:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| code | string | ✅ | `wx.login()` 返回的临时登录凭证（有效期 5 分钟，仅可使用一次） |

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "openid": "oGZUI0eg********",
  "unionid": "o6_bmas****"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| token | string | 用户登录 JWT（后续请求需带 `Authorization: Bearer <token>`） |
| openid | string | 微信 openid（用户唯一标识） |
| unionid | string | 微信 unionid（可能为 null） |

### POST /api/v1/auth/phone

微信手机号解密。

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| code | string | ✅ | `<button open-type="getPhoneNumber">` 回调中 `e.detail.code` |

**Response:**
```json
{
  "phoneNumber": "1381234****",
  "purePhoneNumber": "1381234****",
  "countryCode": "86"
}
```

### POST /api/v1/auth/phone-login

手机号一键登录（利用微信手机号组件，无需短信验证码）。

> **前端已不再使用此接口。** 统一改为 `wx-login`（拿 openid）+ `phone`（解密手机号）两步。
> 后端可保留此接口作为快捷通道，但不是必须。

`<button open-type="getPhoneNumber">` 回调拿到 code 后调用，后端解密手机号 → 查/建 User → 签发 JWT。

**Headers:**
```
Content-Type: application/json
```

**Body:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| code | string | ✅ | `getPhoneNumber` 回调的 `e.detail.code` |

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "phone": "1381234****",
  "user": {
    "id": "cmotmhlu50006p7utol2ncig1",
    "name": "张三",
    "phone": "1381234****",
    "role": "CUSTOMER"
  }
}
```

> `phone-login` 与 `wx-login` 签发的 JWT 等效，之后所有需鉴权接口均可正常使用。

### GET /api/v1/auth/me

获取当前用户信息。

**Headers:**
```
Authorization: Bearer <token>
```

---

## 客户（需 Bearer token）

### GET /api/v1/customers/me

获取当前客户档案（通过手机号识别，首次下单后自动创建）。

**Query:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| phone | string | ✅ | 客户手机号 |

**示例:**
```
GET /api/v1/customers/me?phone=13800138000
```

**Response（已有客户）:**
```json
{
  "customer": {
    "id": "cmq7xxxxx",
    "name": "张三",
    "phone": "13800138000",
    "wechat": "zhangsan_wx",
    "memberLevel": "GOLD",
    "tags": ["复购客户", "VIP"],
    "totalSpent": 15800,
    "orderCount": 5,
    "availableCoupons": [
      {
        "id": "coupon_xxx",
        "name": "满200减20",
        "type": "FIXED_AMOUNT",
        "value": 20,
        "minOrderAmount": 200,
        "expiresAt": "2026-07-01T00:00:00Z"
      }
    ]
  }
}
```

**Response（新客户）:**
```json
{
  "customer": null,
  "message": "新客户，首次下单后将自动创建档案"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 客户 ID |
| name | string | 客户姓名 |
| phone | string | 手机号 |
| wechat | string | 微信号（可能为 null） |
| memberLevel | string | 会员等级：`BRONZE` / `SILVER` / `GOLD` / `PLATINUM` |
| tags | string[] | 自动标签：复购客户、VIP（≥1万）、优质客户（≥5千） |
| totalSpent | number | 累计消费金额（元） |
| orderCount | number | 累计订单数 |
| availableCoupons | array | 当前可用优惠券列表 |

---

## 优惠券（需 Bearer token）

### GET /api/v1/coupons/available

查询订单可用的优惠券。自动过滤已过期、已使用、不满足最低金额或适用范围的券。

**Query:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| customerId | string | ✅ | 客户 ID（从 `/customers/me` 获取） |
| orderAmount | number | ✅ | 订单小计金额（元，不含运费） |
| productIds | string | ❌ | 商品 ID 逗号分隔，用于限品类券筛选 |

**示例:**
```
GET /api/v1/coupons/available?customerId=cmq7xxxxx&orderAmount=299&productIds=p1,p2
```

**Response:**
```json
{
  "coupons": [
    {
      "id": "coupon_xxx",
      "name": "满200减20",
      "type": "FIXED_AMOUNT",
      "value": 20,
      "minOrderAmount": 200,
      "scope": "ALL_PRODUCTS",
      "expiresAt": "2026-07-01T00:00:00Z"
    },
    {
      "id": "coupon_yyy",
      "name": "全场9折",
      "type": "PERCENTAGE",
      "value": 10,
      "minOrderAmount": 0,
      "scope": "ALL_PRODUCTS",
      "expiresAt": "2026-07-15T00:00:00Z"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 客户优惠券 ID（使用时传这个） |
| name | string | 优惠券名称 |
| type | string | `FIXED_AMOUNT`（立减）/ `PERCENTAGE`（折扣）/ `SHIPPING_WAIVE`（免运费） |
| value | number | 面值：立减券=金额(元)，折扣券=百分比(如10表示9折) |
| minOrderAmount | number | 最低订单金额（元），0 表示无门槛 |
| scope | string | 适用范围：`ALL_PRODUCTS` / `CATEGORY` / `PRODUCT` |
| expiresAt | string | 过期时间 ISO 格式（可能为 null 表示永不过期） |

### POST /api/v1/coupons/available

使用优惠券抵扣订单。调用后自动：
- 将优惠券状态改为已使用
- 计算折扣金额
- 更新订单 `discountAmount` 和 `totalAmount`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| couponId | string | ✅ | 客户优惠券 ID（从 available 接口获取） |
| orderId | string | ✅ | 订单 ID |

**示例:**
```json
{
  "couponId": "coupon_xxx",
  "orderId": "cmq6gceq7000001qme6tzwqsa"
}
```

**Response:**
```json
{
  "success": true,
  "discount": 20,
  "newTotal": 279
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否使用成功 |
| discount | number | 折扣金额（元） |
| newTotal | number | 抵扣后应付金额（元） |

---

## 微信支付

### POST /api/v1/payment/unify

统一下单，返回小程序调起支付所需的参数。

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| orderNo | string | ✅ | ERP 订单号（作为 `out_trade_no`） |
| totalFee | integer | ✅ | 支付金额，单位：**分**（¥2999.00 传 `299900`） |
| body | string | ✅ | 商品描述，显示在微信支付账单中 |
| openid | string | ✅ | 用户 openid（从 wx-login 获取） |
| attach | string | ❌ | 附加数据，支付通知时原样返回 |

**Response:**
```json
{
  "prepay_id": "wx201410272009395522657a690389285100",
  "timeStamp": "1718000000",
  "nonceStr": "abc123def456",
  "package": "prepay_id=wx201410272009395522657a690389285100",
  "signType": "RSA",
  "paySign": "U2lnbmF0dXJl..."
}
```

拿到参数后直接调用 `wx.requestPayment()` 拉起支付。

### POST /api/v1/payment/notify

微信支付异步通知回调（由微信服务端调用，无需小程序处理）。

---

## 商品（无需认证）

### GET /api/v1/products

商品列表。

**Query:**
| 参数 | 类型 | 说明 |
|------|------|------|
| published | boolean | 过滤已上架商品 |
| status | string | 商品状态: `ONLINE` / `OFFLINE` / `DRAFT` / `SOLD_OUT` |
| page | number | 页码，默认 1 |
| pageSize | number | 每页条数，默认 20，最大 50 |
| query | string | 搜索商品标题或描述 |
| category | string | 类目筛选 |

**示例:**
```
GET /api/v1/products?published=true&status=ONLINE
GET /api/v1/products?page=1&pageSize=20&query=MacBook
GET /api/v1/products?category=Apple
```

**Response:**
```json
{
  "items": [
    {
      "id": "cmq6fh1gi000101pq08ysjeff",
      "title": "Apple MacBook Pro 16寸 2019年 A2141",
      "description": "i7/16G/512G/Pro 5300M 4G\ni9/64G/512G/Pro 5500M 8G",
      "images": ["/uploads/products/c5ff7506-bfca-4283-bc47-088511c34c36.jpg"],
      "category": "Apple",
      "price": 2999,
      "costRange": null,
      "stockQty": 1,
      "status": "ONLINE",
      "published": true,
      "specs": null,
      "sortOrder": 0,
      "createdAt": "2026-06-09T09:18:57.186Z",
      "updatedAt": "2026-06-09T09:25:09.128Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1
}
```

> 图片地址需拼接 Base URL: `https://erp.qixiangshou.com/uploads/products/xxx.jpg`

### GET /api/v1/products/{id}

商品详情。

**示例:**
```
GET /api/v1/products/cmq6fh1gi000101pq08ysjeff
```

**Response:** 同上 items 单条格式。

---

## 设备（需 Bearer token）

### GET /api/v1/devices

设备列表。支持 `?status=IN_STOCK` 筛选。

### GET /api/v1/devices/{id}

设备详情。

---

## 电商订单（需 Bearer token）

### POST /api/v1/ecommerce/orders

创建订单。

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| buyerName | string | 是 | 买家姓名 |
| buyerPhone | string | 是 | 买家手机号 |
| buyerAddress | string | 否 | 收货地址 JSON: `{"province":"省","city":"市","district":"区","detail":"详细地址"}` |
| buyerNotes | string | 否 | 买家备注 |
| items | array | 是 | 商品列表 |
| items[].productId | string | 是 | 商品 ID |
| items[].quantity | number | 是 | 购买数量 |

**Body 示例:**
```json
{
  "buyerName": "张三",
  "buyerPhone": "13800138000",
  "buyerAddress": "{\"province\":\"广东省\",\"city\":\"深圳市\",\"district\":\"南山区\",\"detail\":\"科技园路1号\"}",
  "buyerNotes": "请发顺丰",
  "items": [
    { "productId": "cmq6fh1gi000101pq08ysjeff", "quantity": 1 }
  ]
}
```

**Response (201):**
```json
{
  "id": "cmq6gceq7000001qme6tzwqsa",
  "orderNo": "EC-20260609-001",
  "totalAmount": 2999,
  "status": "PENDING_PAYMENT"
}
```

### GET /api/v1/ecommerce/orders

查询订单。

**Query:**
| 参数 | 说明 |
|------|------|
| id | 按订单 ID 查询 |
| orderNo | 按订单号查询 |

**示例:**
```
GET /api/v1/ecommerce/orders?orderNo=EC-20260609-001
```

**Response:**
```json
{
  "id": "cmq6gceq7000001qme6tzwqsa",
  "orderNo": "EC-20260609-001",
  "buyerName": "张三",
  "buyerPhone": "13800138000",
  "buyerAddress": "{\"province\":\"广东省\",\"city\":\"深圳市\",\"detail\":\"科技园路1号\"}",
  "status": "PENDING_PAYMENT",
  "afterSalesStatus": null,
  "subtotalAmount": 2999,
  "shippingFee": null,
  "discountAmount": null,
  "totalAmount": 2999,
  "carrier": null,
  "trackingNumber": null,
  "shippedAt": null,
  "deliveredAt": null,
  "returnReason": null,
  "refundAmount": null,
  "paidAt": null,
  "createdAt": "2026-06-09T09:43:20.719Z",
  "items": [
    {
      "productId": "cmq6fh1gi000101pq08ysjeff",
      "productTitle": "Apple MacBook Pro 16寸 2019年 A2141",
      "productImage": "/uploads/products/c5ff7506-bfca-4283-bc47-088511c34c36.jpg",
      "quantity": 1,
      "unitPrice": 2999
    }
  ]
}
```

> 新增字段：`discountAmount` — 优惠券抵扣金额（元），null 表示未使用优惠券。

### GET /api/v1/ecommerce/orders/export

导出订单为 CSV 文件（UTF-8 BOM，Excel 可直接打开）。

**Query:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| status | string | ❌ | 按订单状态筛选（PENDING_PAYMENT / PAID / SHIPPED / DELIVERED / COMPLETED / CANCELLED） |
| afterSales | string | ❌ | 按售后状态筛选（RETURN_REQUESTED / RETURN_APPROVED / RETURN_SHIPPED / REFUNDING / REFUNDED / RETURN_REJECTED） |
| q | string | ❌ | 搜索订单号 / 买家姓名 / 手机号 |

**示例:**
```
GET /api/v1/ecommerce/orders/export?status=PAID&q=张三
```

**Response:** `Content-Type: text/csv`，直接下载文件。

### POST /api/v1/ecommerce/callback

状态同步回调（小程序支付、签收、完成、售后均通过此接口同步到 ERP）。

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderNo | string | 是 | 订单号 |
| event | string | 是 | `PAID` / `CANCELLED` / `DELIVERED` / `COMPLETED` / `RETURN_REQUESTED` / `RETURN_SHIPPED` |
| paidAt | string | 否 | 支付时间 ISO 格式，event=PAID 时可选 |
| returnReason | string | 否 | 退货/退款原因，event=RETURN_REQUESTED 时可选 |
| returnCarrier | string | 否 | 退货快递公司，event=RETURN_SHIPPED 时填写 |
| returnTrackingNumber | string | 否 | 退货快递单号，event=RETURN_SHIPPED 时填写 |

**事件说明:**
| event | 前置状态 | 触发场景 |
|-------|----------|----------|
| PAID | 待付款 | 支付成功 |
| CANCELLED | 待付款 | 取消未支付订单 |
| DELIVERED | 已发货 | 买家确认签收 |
| COMPLETED | 已签收 | 买家确认完成 |
| RETURN_REQUESTED | 已付款 或 已完成 | 已付款未发货 → 仅退款；已完成 → 退货退款 |
| RETURN_SHIPPED | RETURN_APPROVED | 买家已寄回商品，填写退货快递单号 |

**示例:**
```json
// 支付成功
{ "orderNo": "EC-20260609-001", "event": "PAID" }

// 确认签收
{ "orderNo": "EC-20260609-001", "event": "DELIVERED" }

// 确认完成
{ "orderNo": "EC-20260609-001", "event": "COMPLETED" }

// 未发货仅退款
{ "orderNo": "EC-20260609-001", "event": "RETURN_REQUESTED", "returnReason": "不想要了" }

// 已收货退货退款
{ "orderNo": "EC-20260609-002", "event": "RETURN_REQUESTED", "returnReason": "商品与描述不符" }

// 退货物流上报（买家已寄回）
{ "orderNo": "EC-20260609-002", "event": "RETURN_SHIPPED", "returnCarrier": "顺丰速运", "returnTrackingNumber": "SF1234567890" }
```

**Response:**
```json
{ "orderNo": "EC-20260609-001", "event": "PAID" }
```

---

## 订单状态流转

```
PENDING_PAYMENT（待付款）
    ├── PAID（已付款）
    │       ├── SHIPPED（已发货）→ DELIVERED（已签收）→ COMPLETED（已完成）
    │       │       └── RETURN_REQUESTED → 管理员审核 → 退货退款
    │       └── RETURN_REQUESTED → 管理员审核 → 仅退款（未发货）
    └── CANCELLED（已取消）

售后状态:
    RETURN_REQUESTED（申请售后）
    ├── RETURN_APPROVED（同意退货）
    │       └── RETURN_SHIPPED（买家已寄回）→ REFUNDING（退款中）→ REFUNDED（已退款）
    └── RETURN_REJECTED（拒绝售后）
```

| 环节 | 操作端 | 接口 |
|------|--------|------|
| 待付款 → 已付款 | 微信支付回调 | `notify` 或 callback `PAID` |
| 已付款 → 已发货 | ERP后台 | 管理员填写物流 |
| 已发货 → 已签收 | 小程序 | callback `DELIVERED` |
| 已签收 → 已完成 | 小程序 | callback `COMPLETED` |
| 已付款 → 申请退款 | 小程序 | callback `RETURN_REQUESTED` |
| 已完成 → 申请退货 | 小程序 | callback `RETURN_REQUESTED` |
| 申请售后 → 同意/拒绝 | ERP后台 | 管理员审批 |
| 同意退货 → 买家寄回 | 小程序 | callback `RETURN_SHIPPED` |

---

## Banner 轮播（无需认证）

### GET /api/v1/banners

首页 Banner 列表（仅返回启用状态的 Banner）。

```
GET https://erp.qixiangshou.com/api/v1/banners
```

**Response:**
```json
[
  {
    "id": "cmq7xxxxx",
    "title": "🔥 热销爆款",
    "desc": "甄选人气TOP",
    "color": "#E74C3C",
    "productId": "cmq6fh1gi000101pq08ysjeff",
    "productTitle": "Apple MacBook Pro 16寸 2019年 A2141",
    "imageUrl": null,
    "sortOrder": 0
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | Banner ID |
| title | string | 标题 |
| desc | string | 描述（可能为 null） |
| color | string | 背景色 Hex |
| productId | string | 关联商品 ID（可能为 null） |
| productTitle | string | 关联商品标题（可能为 null） |
| imageUrl | string | 背景图片 URL（可能为 null） |
| sortOrder | number | 排序序号 |

### POST /api/v1/payment/refund

发起退款，调用微信退款接口从原支付路径退回。

> 仅支持 `PAID` / `SHIPPED` / `DELIVERED` / `COMPLETED` 状态的订单。

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| orderNo | string | ✅ | 电商订单号 |
| refundAmount | number | ❌ | 退款金额（元），默认全额退款 |
| reason | string | ❌ | 退款原因，默认「用户申请退款」 |

**Response:**
```json
{
  "refundId": "503000003220250611...",
  "outRefundNo": "EC-20260609-001-R1718112000000",
  "status": "SUCCESS",
  "refundAmount": 99,
  "afterSalesStatus": "REFUNDED"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| refundId | string | 微信支付退款单号 |
| outRefundNo | string | 商户退款单号 |
| status | string | 退款状态：`SUCCESS` / `PROCESSING` |
| refundAmount | number | 实际退款金额（元） |
| afterSalesStatus | string | 订单售后状态：`REFUNDED` / `REFUNDING` |

---

## 文件上传（需 Bearer token）

### POST /api/v1/upload

上传图片文件。

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body:** `multipart/form-data`，字段名 `file`。

**Response:**
```json
{
  "url": "/uploads/products/image_xxx.png"
}
```

> 返回的 `url` 为相对路径，拼接 Base URL 即可访问：
> `https://erp.qixiangshou.com/uploads/products/image_xxx.png`

---

## 接口总览

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|:----:|------|
| POST | `/api/v1/auth/login` | 无 | 邮箱密码登录 |
| POST | `/api/v1/auth/login` | 无 | 邮箱密码登录 |
| POST | `/api/v1/auth/wx-login` | 无 | 微信小程序登录 |
| POST | `/api/v1/auth/phone-login` | 无 | 手机号一键登录 |
| GET | `/api/v1/auth/me` | Bearer | 获取当前用户 |
| POST | `/api/v1/auth/phone` | Bearer | 微信手机号解密 |
| GET | `/api/v1/customers/me` | Bearer | 客户档案 + 可用优惠券 |
| GET | `/api/v1/coupons/available` | Bearer | 查询订单可用优惠券 |
| POST | `/api/v1/coupons/available` | Bearer | 使用优惠券抵扣 |
| POST | `/api/v1/payment/unify` | Bearer | 微信支付统一下单 |
| POST | `/api/v1/payment/notify` | 微信签名 | 支付结果通知 |
| POST | `/api/v1/payment/refund` | Bearer | 发起退款 |
| GET | `/api/v1/products` | 无 | 商品列表 |
| GET | `/api/v1/products/{id}` | 无 | 商品详情 |
| GET | `/api/v1/devices` | Bearer | 设备列表 |
| GET | `/api/v1/devices/{id}` | Bearer | 设备详情 |
| POST | `/api/v1/ecommerce/orders` | Bearer | 创建订单 |
| GET | `/api/v1/ecommerce/orders` | Bearer | 查询订单 |
| GET | `/api/v1/ecommerce/orders/export` | Bearer | 导出订单 CSV |
| POST | `/api/v1/ecommerce/callback` | Bearer | 状态同步回调 |
| GET | `/api/v1/banners` | 无 | 首页 Banner 列表 |
| POST | `/api/v1/upload` | Bearer | 文件上传 |

---

## 小程序接入完整流程

```js
// 1. 微信登录拿 token
const { code } = await wx.login()
const loginRes = await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/auth/wx-login',
  method: 'POST',
  header: { 'Content-Type': 'application/json' },
  data: { code }
})
const token = loginRes.data.token
const openid = loginRes.data.openid

// 2. 获取手机号（可选，登录后调用）
const phoneRes = await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/auth/phone',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  data: { code: phoneCode }  // getPhoneNumber 回调的 code
})
const phone = phoneRes.data.purePhoneNumber

// 3. 获取客户档案 + 优惠券数量
const profileRes = await wx.request({
  url: `https://erp.qixiangshou.com/api/v1/customers/me?phone=${phone}`,
  method: 'GET',
  header: { 'Authorization': `Bearer ${token}` }
})
const customer = profileRes.data.customer
const couponCount = customer?.availableCoupons?.length || 0

// 4. 获取商品列表展示
const products = await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/products?published=true&status=ONLINE',
  method: 'GET'
})

// 5. 用户下单
const order = await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/ecommerce/orders',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  data: {
    buyerName: '买家姓名',
    buyerPhone: phone,
    buyerAddress: '{"province":"省","city":"市","district":"区","detail":"详细地址"}',
    items: [{ productId: 'cmq6fh1gi000101pq08ysjeff', quantity: 1 }]
  }
})

// 6. 查询可用优惠券
const couponsRes = await wx.request({
  url: `https://erp.qixiangshou.com/api/v1/coupons/available?customerId=${customer.id}&orderAmount=${order.data.totalAmount}`,
  method: 'GET',
  header: { 'Authorization': `Bearer ${token}` }
})
// 展示优惠券列表给用户选择

// 7. 用户选择优惠券后使用
if (selectedCouponId) {
  await wx.request({
    url: 'https://erp.qixiangshou.com/api/v1/coupons/available',
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: { couponId: selectedCouponId, orderId: order.data.id }
  })
}

// 8. 重新查询订单获取 final 金额
const finalOrder = await wx.request({
  url: `https://erp.qixiangshou.com/api/v1/ecommerce/orders?id=${order.data.id}`,
  method: 'GET',
  header: { 'Authorization': `Bearer ${token}` }
})

// 9. 统一下单 → 拉起微信支付
const payRes = await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/payment/unify',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  data: {
    orderNo: order.data.orderNo,
    totalFee: finalOrder.data.totalAmount * 100,  // 元转分
    body: 'ThinkPad X1 Carbon',
    openid
  }
})
await wx.requestPayment({
  timeStamp: payRes.data.timeStamp,
  nonceStr: payRes.data.nonceStr,
  package: payRes.data.package,
  signType: payRes.data.signType,
  paySign: payRes.data.paySign
})

// 10. 支付成功后回调
await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/ecommerce/callback',
  method: 'POST',
  header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  data: { orderNo: order.data.orderNo, event: 'PAID' }
})

// 11. 查询订单获取最新状态（每次打开订单详情必须调用）
await wx.request({
  url: `https://erp.qixiangshou.com/api/v1/ecommerce/orders?orderNo=${order.data.orderNo}`,
  method: 'GET',
  header: { 'Authorization': `Bearer ${token}` }
})

// 12. 未发货申请退款
await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/ecommerce/callback',
  method: 'POST',
  header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  data: { orderNo: order.data.orderNo, event: 'RETURN_REQUESTED', returnReason: '不想要了' }
})

// 13. 确认签收（仅已发货状态）
await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/ecommerce/callback',
  method: 'POST',
  header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  data: { orderNo: order.data.orderNo, event: 'DELIVERED' }
})

// 14. 确认完成（仅已签收状态）
await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/ecommerce/callback',
  method: 'POST',
  header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  data: { orderNo: order.data.orderNo, event: 'COMPLETED' }
})

// 15. 已收货申请退货退款（仅已完成状态）
await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/ecommerce/callback',
  method: 'POST',
  header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  data: { orderNo: order.data.orderNo, event: 'RETURN_REQUESTED', returnReason: '商品与描述不符' }
})

// 16. 退货物流上报（管理员同意退货后，买家寄回填写单号）
await wx.request({
  url: 'https://erp.qixiangshou.com/api/v1/ecommerce/callback',
  method: 'POST',
  header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  data: { orderNo: order.data.orderNo, event: 'RETURN_SHIPPED', returnCarrier: '顺丰速运', returnTrackingNumber: 'SF1234567890' }
})
```

---

## 当前可用测试商品

| ID | 标题 | 售价 |
|----|------|------|
| `cmq6fh1gi000101pq08ysjeff` | Apple MacBook Pro 16寸 2019年 A2141 | ¥2999 |
