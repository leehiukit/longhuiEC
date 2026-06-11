# 有闲甄选 Selection in Idle

> 品质好物 · 精心甄选 — 专业的二手数码产品电商平台

## 项目简介

「有闲甄选」是一款微信小程序电商平台，主营二手笔记本电脑等高品质数码产品。小程序采用**暖橙色调**设计语言，已完整对接 **ERP 后端**，支持真实下单、微信支付、订单追踪、退货退款等全链路业务流程。

- **品牌名**：有闲甄选
- **英文名**：Selection in Idle
- **品牌色**：`#E8952A`（橙金渐变）
- **Slogan**：品质好物 · 精心甄选
- **仓库**：https://github.com/leehiukit/longhuiEC

---

## 功能模块

### 商城核心
| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `pages/index/` | Banner 轮播、分类入口、热卖商品推荐 |
| 分类 | `pages/category/` | 品牌侧栏筛选、商品网格、多维度排序 |
| 搜索 | `pages/search/` | 关键词搜索、历史记录、热门推荐 |
| 详情 | `pages/detail/` | 图片轮播、规格参数、图文详情、收藏 |

### 交易流程
| 页面 | 路径 | 功能 |
|------|------|------|
| 购物车 | `pages/cart/` | 商品管理、数量调整、全选结算 |
| 下单 | `pages/order/` | 收货地址、费用明细、优惠券抵扣、微信支付 |
| 订单列表 | `pages/orders/` | 全部/待付款/待发货/待收货/已完成 五个 Tab |
| 订单详情 | `pages/order-detail/` | 物流追踪、确认收货、评价入口 |

### 售后服务
| 页面 | 路径 | 功能 |
|------|------|------|
| 退货申请 | `pages/refund/` | 7 天内完成订单可申请、填写原因 |
| 退货详情 | `pages/refund-detail/` | 退货进度、回寄单号提交 |
| 评价 | `pages/review/` | 订单评价、星级打分 |
| 评价详情 | `pages/review-detail/` | 查看已发表评价 |

### 用户系统
| 页面 | 路径 | 功能 |
|------|------|------|
| 登录 | `pages/login/` | 微信快捷授权、手机号绑定 |
| 个人中心 | `pages/user/` | 用户信息、订单统计、功能入口 |
| 地址管理 | `pages/address/` | 增删改查、默认地址 |
| 收藏夹 | `pages/favorites/` | 商品收藏管理 |
| 优惠券 | `pages/coupons/` | 我的优惠券 |
| 设置 | `pages/settings/` | 用户协议、关于等 |
| 协议 | `pages/agreement/` | 用户协议与隐私政策 |

---

## 项目结构

```
longhuiEC/
├── app.js                  # 全局入口（登录态、购物车、设备信息）
├── app.json                # 全局配置（导航栏、TabBar、页面路由）
├── app.wxss                # 全局样式（品牌色变量）
├── project.config.json     # 微信开发者工具配置
├── images/                 # 静态资源（Logo、Banner、商品图）
├── utils/
│   ├── api.js              # ERP 全量 API 封装（24 个接口）
│   └── util.js             # 工具函数
└── pages/                  # 20 个业务页面
    ├── index/              # 首页
    ├── category/           # 分类
    ├── search/             # 搜索
    ├── detail/             # 商品详情
    ├── cart/               # 购物车
    ├── order/              # 下单确认
    ├── orders/             # 订单列表
    ├── order-detail/       # 订单详情
    ├── refund/             # 退货申请
    ├── refund-detail/      # 退货详情
    ├── review/             # 发表评价
    ├── review-detail/      # 评价详情
    ├── login/              # 登录
    ├── user/               # 个人中心
    ├── address/            # 地址管理
    ├── favorites/          # 收藏夹
    ├── coupons/            # 优惠券
    ├── settings/           # 设置
    ├── agreement/          # 用户协议
    └── logs/               # 调试日志
```

---

## 后端对接

本项目已完整对接 **ERP 管理系统**，接口封装在 `utils/api.js`，包含：

| 模块 | 接口 |
|------|------|
| 认证 | 微信登录、手机号解密、用户信息 |
| 商品 | Banner、分类、商品列表、详情、搜索 |
| 交易 | 下单、支付统一下单、支付回调 |
| 订单 | 订单列表、详情、确认收货、物流查询 |
| 售后 | 退货申请、退货详情、回寄单号提交 |
| 客户 | 客户档案、优惠券查询/使用 |
| 其他 | 评价、文件上传 |

详细接口文档见：
- `有闲甄选-ERP-API文档.md` — ERP 端 24 个接口完整说明
- `后端接口规格-微信对接.md` — 微信相关接口规格

---

## 快速开始

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目，填入已认证的企业小程序 AppID
3. 修改 `utils/api.js` 中的 `CONFIG.baseUrl` 为你的 ERP 服务地址
4. 编译运行

---

## 设计规范

| 用途 | 颜色值 | 说明 |
|------|--------|------|
| 主色 | `#E8952A` | 品牌橙 |
| 主色浅 | `#F5C066` | 浅金橙 |
| 主色深 | `#D4821F` | 深橙色 |
| 背景 | `#faf8f5` | 暖白底 |
| 强调 | `#fef6ec` | 浅橙底 |
| 字体 | PingFang SC, Microsoft YaHei | 系统默认 |

---

© 2026 有闲甄选 All Rights Reserved
