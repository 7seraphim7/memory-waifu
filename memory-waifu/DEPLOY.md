# GitHub Pages 部署指南

## 快速部署步骤

### 1. 创建 GitHub 仓库

1. 打开 https://github.com/new
2. 仓库名称：`memory-waifu`
3. 选择 **Public**
4. 勾选 **Add a README file**
5. 点击 **Create repository**

### 2. 上传文件

在仓库页面点击 **Add file** → **Upload files**，上传以下文件：
- `index.html`
- `manifest.json`
- `sw.js`
- `css/` 文件夹（包含 style.css）
- `js/` 文件夹（包含所有 .js 文件）

或者使用 Git 命令：
```bash
git clone https://github.com/你的用户名/memory-waifu.git
cd memory-waifu
# 复制所有项目文件到这里
git add .
git commit -m "Initial commit"
git push origin main
```

### 3. 启用 GitHub Pages

1. 进入仓库 **Settings**
2. 左侧点击 **Pages**
3. **Source** 选择 **Deploy from a branch**
4. **Branch** 选择 **main** → **/(root)**
5. 点击 **Save**

### 4. 访问应用

等待 1-2 分钟后，访问：
```
https://你的用户名.github.io/memory-waifu/
```

### 5. 添加到手机桌面

**iPhone (Safari):**
1. 打开网页
2. 点击分享按钮（方框带箭头）
3. 选择"添加到主屏幕"

**Android (Chrome):**
1. 打开网页
2. 点击菜单（三个点）
3. 选择"添加到主屏幕"或"安装应用"

---

## 应用功能

- ✅ 间隔重复复习算法
- ✅ 二次元壁纸解锁系统
- ✅ 连签打卡激励
- ✅ 数据导出/备份
- ✅ PWA 离线支持

## 注意事项

1. 首次使用建议导出备份数据
2. 定期备份防止数据丢失
3. 使用现代浏览器（Chrome/Safari/Edge）
