# Codex 插件配置指南

## 1. 连接 Linear

1. 在 Codex 窗口**右上角**找到 **设置图标**（⚙️ 齿轮）
2. 点击进入 **设置** 面板
3. 左侧菜单找到 **插件 (Plugins)** 或 **集成 (Integrations)**
4. 在列表中找到 **Linear** 插件
5. 点击 **连接 (Connect)** 或 **启用 (Enable)**
6. 浏览器会弹出 Linear 授权页面 → 点击 **授权 (Authorize)**
7. 完成后回到 Codex，Linear 状态应显示为 **已连接 ✅**

连接后告诉我，我会一键同步任务到 Linear。

---

## 2. 连接 Figma

1. 同样在 **设置 → 插件** 中
2. 找到 **Figma** 插件
3. 点击 **连接**
4. 浏览器弹出 Figma 授权 → 登录你的 Figma 账号 → **允许访问**
5. 打开你要用的 Figma 文件（或让我帮你新建）
6. 在 Figma 中：**右键画布 → Plugins → Codex**（或类似名称的插件）
7. 完成后回到 Codex，Figma 状态应为 **已连接 ✅**

连接后告诉我，我会按设计规范在 Figma 中生成完整看板 UI。

---

## 3. 连接 GitHub

1. 安装 GitHub CLI（如果还没装）：
   - 打开 PowerShell，运行：`winget install GitHub.cli`
2. 安装完成后，运行：`gh auth login`
3. 选择 `GitHub.com` → `HTTPS` → `Login with a web browser`
4. 浏览器打开后，输入显示的验证码
5. 授权完成后告诉我

连接后我会帮你创建远程仓库并推送代码。

---

## 需要帮助？

如果任何一步卡住了，截图发给我，我帮你排查。
