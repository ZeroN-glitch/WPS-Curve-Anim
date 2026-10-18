# 发布清单

从零把这个加载项发到 GitHub Pages，全程约 10 分钟。

## 0. 前置：把占位符换成你的真实地址

一共两处，**必须都改**，否则安装页会指向不存在的域名：

| 文件 | 位置 | 改成 |
|---|---|---|
| `package.json` | `homepage` 字段 | `https://<用户名>.github.io/<仓库名>/addon/` |
| `docs/index.html` | 页脚 GitHub 链接 | `https://github.com/<用户名>/<仓库名>` |

仓库名建议用 `WPS-Curve-Anim`（`docs/publish.html` 里的默认地址就是按这个名字写的）。

## 1. 一键生成发布产物

```bash
npm install          # 首次
npm run release
```

它会依次做四件事：

1. 在线构建 → `addin/wps-addon-build/`
2. 调 `wpsjs publish` 生成安装页
3. 去掉 wpsjs 自带的示例条目 `test123`，把安装页和加载项部署到 `docs/`
4. 打离线包 → `release/WpsCurveAnim.7z`

> 只想本地试跑整条流水线（不换真实地址）可以加参数：`node tools/release.js --allow-placeholder`
>
> 地址里还有 `YOUR-NAME` 时脚本会直接拒绝执行——这是故意的，防止把坏链接发出去。

## 2. 本地自检产物

发布前确认这三件事：

```bash
# 安装页里应该只有你的加载项，没有 test123
findstr curList docs\publish.html

# 加载项文件都在
dir docs\addon

# 离线包存在
dir release
```

`docs/publish.html` 里应该能看到类似：

```
var curList = [{"name":"WpsCurveAnim","addonType":"wpp","online":"true",...,"url":"https://你的地址/addon/"}];
```

## 3. 建仓库并推送

```bash
git init
git add -A
git commit -m "feat: WPS 演示动画速率曲线编辑器"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

`.gitignore` 已经排除了 `node_modules/`、`out/`、`addin/wps-addon-build/`、`addin/wps-addon-publish/`、
`release/*.7z` 和本地录屏产物。推之前可以 `git status` 确认一下没有意外的大文件。

推上去之后 GitHub Actions 会自动跑 CI（[.github/workflows/ci.yml](.github/workflows/ci.yml)）：

- 三个 js 文件的语法检查
- `npm test`：曲线逻辑 39 项 + 资源完整性 12 项
- `addin/` 与 `docs/addon/` 的 SHA256 一致性（防止改了源码忘记重新 release）

出现红叉基本就是第三种情况——本地跑一次 `npm run release` 再推即可。

> 徽章地址已指向 ZeroN-glitch/WPS-Curve-Anim；如果仓库换了归属，记得一并改掉，否则 README 顶部会显示破图。

## 4. 开启 GitHub Pages

仓库 Settings → Pages：

- Source 选 **Deploy from a branch**
- 分支选 `main`，目录选 **`/docs`**
- 保存，等 1~2 分钟

## 5. 部署后自检

| 检查 | 地址 | 期望 |
|---|---|---|
| 加载项清单可达 | `https://<地址>/addon/ribbon.xml` | 返回以 `<customUI ...` 开头的 XML 文本 |
| 加载项入口可达 | `https://<地址>/addon/index.html` | 返回一个只含 `<script src="./main.js">` 的小页面 |
| 安装页正常 | `https://<地址>/publish.html` | 页面里列出你的加载项，有「安装」按钮 |
| 落地页正常 | `https://<地址>/` | 介绍页 + 两张截图 |

`ribbon.xml` 这一条最关键：WPS 启动加载项时第一件事就是拉它，拉不到插件就完全不出现。

## 6. 打 Release

在 GitHub 上新建 Release：

- Tag 写 `v0.1.0`
- 附件上传 `release/WpsCurveAnim.7z`
- 说明里写清两件事：
  1. **个人版用户不要下载这个包**——安装请走安装页；这个包是给专业版/企业版离线部署、或当备份用的
  2. 环境要求：WPS 演示 ≥ 12.1.0.16910、仅 Windows/Linux、原生特效不支持自定义曲线

## 7. 已知坑

**`github.io` 在国内经常访问不了。** 而加载项**每次启动都要从发布地址拉文件**，
域名不通 = 插件白屏或干脆不加载。面向国内用户建议：

- 换 Gitee Pages 或 Vercel 托管 `docs/`
- 或者把离线包作为主要分发方式

换域名后只要重跑一次 `npm run release <新地址>` 即可，安装页里的地址会跟着更新。

**Pages 有缓存。** 更新加载项后，用户可能还拿到旧文件；发布页 WPS 侧也有缓存。
验证新版是否生效，看一眼面板页脚或 `ribbon.xml` 的内容时间戳。

