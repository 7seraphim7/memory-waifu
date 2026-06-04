# Memory Waifu - 项目结构说明

## 文件结构

```
memory-waifu/
├── index.html              # 入口页面
├── manifest.json           # PWA 配置（让手机能安装到桌面）
├── sw.js                   # Service Worker（离线 + 后台推送）
├── README.md               # 项目说明
├── ARCHITECTURE.md         # 本文件
├── css/
│   └── style.css           # 全部样式（暗色主题）
├── js/
│   ├── spaced-repetition.js  # SM-2 间隔重复算法
│   ├── database.js           # IndexedDB 数据层
│   ├── motivation.js         # 激励系统（积分/连签/解锁/惩罚）
│   ├── reminder.js           # 推送提醒系统
│   └── app.js                # 主控制器（串联一切）
└── assets/
    ├── icon-192.png          # App 图标（待生成）
    └── icon-512.png          # App 图标大尺寸（待生成）
```

## 模块依赖关系

```
app.js (主控制器)
├── spaced-repetition.js  - 纯算法，无副作用
├── database.js           - 数据读写
├── motivation.js         - 激励逻辑 + localStorage
└── reminder.js           - 推送 + 提醒
```

## 数据流

```
用户添加卡片 → database.addCard()
          ↓
系统计算复习时间 → spaced-repetition.createCard() 设置 nextReview
          ↓
到达复习时间 → reminder 推送通知
          ↓
用户打开 App → app.startReview() 拉取到期卡片
          ↓
用户评分 → spaced-repetition.review() 更新间隔
          ↓
完成复习 → motivation.completeDailyReview() 结算奖励
          ↓
连签/积分/解锁 → UI 展示奖励动画
```

## 待完成功能（Phase 2+）

- [ ] AI 生成角色壁纸接入
- [ ] Live2D 角色展示
- [ ] 好感度系统详细 UI
- [ ] 数据导出/备份
- [ ] 统计图表页面
- [ ] 社交模块（可选）
- [ ] 自选角色定制流程
```
