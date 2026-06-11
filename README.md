# 有闲甄选 Selection in Idle

> 品质好物 · 精心甄选 — 专业的二手数码产品电商平台

## 项目简介

「有闲甄选」是一款面向企业认证用户的微信小程序，主营二手笔记本电脑等高品质数码产品。小程序采用**暖橙色调**设计语言，与品牌Logo视觉风格完美融合。

## 品牌特色

- **品牌名**：有闲甄选
- **英文名**：Selection in Idle
- **品牌色**：`#E8952A`（橙金渐变）
- **Slogan**：品质好物 · 精心甄选

## 功能模块

| 模块 | 页面 | 功能说明 |
|------|------|----------|
| 首页 | `pages/index/index` | 品牌展示、轮播广告、分类入口、甄选商品列表 |
| 分类 | `pages/category/category` | 左侧品牌筛选、右侧商品网格、多维度排序 |
| 详情 | `pages/detail/detail` | 图片轮播、甄选价格、规格参数、服务保障 |
| 购物车 | `pages/cart/cart` | 商品管理、数量调整、全选结算 |
| 订单 | `pages/order/order` | 地址选择、费用明细、微信支付集成 |
| 我的 | `pages/user/user` | 用户信息、订单统计、功能菜单 |
| 搜索 | `pages/search/search` | 搜索历史、热门推荐、结果排序 |
| 地址 | `pages/address/address` | 收货地址增删改查、默认设置 |
| 登录 | `pages/login/login` | 手机验证码登录、微信快捷授权 |

## 项目结构

```
有闲甄选/
├── app.js              # 全局入口（含购物车、登录状态）
├── app.json            # 全局配置（导航栏、TabBar）
├── app.wxss            # 全局样式（主题色变量）
├── project.config.json  # 微信开发者工具配置
├── sitemap.json        # 小程序索引配置
├── images/
│   ├── logos/          # ← 放置品牌Logo
│   ├── banners/        # 轮播图资源
│   └── products/       # 商品图片
├── utils/
│   ├── api.js          # API接口 + 模拟数据
│   └── util.js         # 工具函数库
└── pages/              # 9个功能页面
    ├── index/          # 首页
    ├── category/       # 分类
    ├── detail/         # 详情
    ├── cart/           # 购物车
    ├── order/          # 订单确认
    ├── user/           # 个人中心
    ├── search/         # 搜索
    ├── address/        # 地址管理
    └── login/          # 登录
```

## 快速开始

### 1. 放置品牌Logo ⭐ 重要

将你的「有闲甄选」logo图片放置到以下路径：

```
/images/logos/logo.png
```

支持格式：`.png` / `.jpg`，建议尺寸 **400x400px** 以上。

### 2. 用微信开发者工具打开

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择「导入项目」
3. 目录指向本项目文件夹
4. AppID 使用已认证的企业小程序 AppID

### 3. 准备商品图片

将商品图片放到 `images/products/` 目录，并更新 `utils/api.js` 中的图片路径：

```javascript
image: '/images/products/your-image.jpg'
```

## 设计规范

### 配色方案
| 用途 | 颜色值 | 说明 |
|------|--------|------|
| 主色 | `#E8952A` | 品牌橙 |
| 主色浅 | `#F5C066` | 浅金橙 |
| 主色深 | `#D4821F` | 深橙色 |
| 背景 | `#faf8f5` | 暖白底 |
| 强调背景 | `#fef6ec` | 浅橙底 |

### 字体规范
- 标题：PingFang SC / Microsoft YaHei
- 正文字号：28rpx
- 标题字号：30-38rpx
- 价格字号：42-58rpx（加粗）

## 后续开发

当前版本使用**模拟数据**，可直接预览完整效果。接入后端只需修改 `utils/api.js`：

```javascript
// 将模拟请求替换为真实API
const api = {
  getProducts: (params) => wx.request({ url: '/api/products', ... }),
  // ...
}
```

## License

© 2026 有闲甄选 All Rights Reserved
