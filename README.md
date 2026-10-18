# 动画曲线 · WPS 演示插件

[![CI](https://github.com/YOUR-NAME/WPS-Curve-Anim/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR-NAME/WPS-Curve-Anim/actions/workflows/ci.yml)

给 WPS 演示（PPT）的动画加上**可拖拽的速率曲线**。

WPS 自带的动画窗格只能拖「平滑开始 / 平滑结束」两个滑块——本质上只有一条对称的缓动。
这个加载项在任务窗格里给你一条贝塞尔曲线，两个控制点随便拖，曲线决定动画的速度节奏，
包括回弹这种原生界面完全做不出来的效果。

> 当前状态：**已在真实 WPS 12.1 里跑通全链路**，等待人工确认后发布。GitHub 地址仍是占位符。

![任务窗格里的样子](docs/pane-only.png)

---

## 它解决什么问题

PPTX 的动画速率只存在两个地方：

| 位置 | 能力 |
|---|---|
| `p:cTn` 的 `accel` / `decel` 属性 | 只有两个百分比，做不出弹性、回弹、先慢后冲 |
| `p:tavLst` 时间-数值关键帧表 | 任意多个关键帧，真正的曲线 |

动画窗格只暴露了第一种。这个插件写入第二种。

## 能做 / 不能做

**能做**：位置（任意路径）、不透明度、尺寸、旋转、填充色这类**属性动画**。
曲线采样成 20~40 个关键帧写进去，WPS 在关键帧之间做线性插值，帧数够多就看不出折角。

位置动画用**起止点**描述，不用填"距离几个百分比"：

面板上是一张 16:9 的版心小图，**直接把绿点（起点）和蓝点（终点）拖到想要的位置**。
虚线方框是你的形状当前所处的位置，作为参照。

- 终点拖到形状原位、起点拖到旁边 → 就是**入场动画**
- 起点是原位、终点在别处 → 就是**移出**
- 起点终点都随便放 → 就是一条**自定义路径**

两个「= 形状位置」按钮可以一键把起点/终点对齐到形状现在的位置，做入场时很方便。
X、Y 两轴同时动，共用一个速率曲线。

**不能做**：飞入、擦除、百叶窗、缩放这类**原生进出场特效**。它们在 OOXML 里是
`p:animEffect`，模型内部只有 `accel`/`decel` 两个百分比，不存在关键帧表，
任何工具都写不进曲线——这是 PowerPoint 系格式的天花板，不是 WPS 的限制。

## 安装

### 方式一：本地调试（开发用）

```bash
npm install                      # 安装 wpsjs 等依赖
node server.js                   # 起本地静态服务，默认 127.0.0.1:39123
```

然后把加载项注册进 WPS（Windows）：

```xml
<!-- %APPDATA%\kingsoft\wps\jsaddons\publish.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <jspluginonline name="WpsCurveAnim" type="wpp" url="http://127.0.0.1:39123/" debug="" enable="enable_dev" install="null" customDomain=""/>
</jsplugins>
```

重启 WPS 演示即可。**必须打开一个文档**，WPS 在没有文档窗口时不会加载加载项（踩过这个坑）。

### 方式二：GitHub Pages（对外分发）

`docs/` 已经是可直接部署的静态站点：

```
docs/
├─ index.html      落地页
├─ publish.html    安装页（用户点这里安装）
├─ addon/          加载项本体，WPS 从这里拉文件
└─ curve_proof.png
```

1. 仓库 Settings → Pages → Source 选 `main` 分支的 `/docs` 目录
2. 把 `docs/publish.html` 里的地址换成你的真实域名（当前是 `YOUR-NAME` 占位）
3. 用户打开 `https://<你的域名>/publish.html` → 点「安装」

> ⚠️ `github.io` 在国内经常不稳，而**加载项每次启动都要从该地址拉文件**。
> 面向国内用户建议换 Gitee Pages / Vercel，或同时在 Release 里放离线包。

### 离线包

`npm run release` 会在 `release/WpsCurveAnim.7z` 打一个自解释的压缩包，里面是：

```
README.txt            这个包能干什么、不能干什么
publish.xml.sample    离线部署的配置格式
WpsCurveAnim_<版本>/   加载项全部静态文件
```

**它不能当"一键安装包"用。** 安装页走的是在线模式（从你部署的地址拉 `ribbon.xml`），
压缩包只在这两种场合有用：

- **专业版 / 企业版**：按 `publish.xml.sample` 指向本地目录做离线部署
- **任何人**：当备份，或拿去自建静态托管

个人版装了 `oem.ini` 那套办法从 12.1.0.16910 起已被官方封掉，只能走在线安装页。

## 使用

1. 点功能区「动画曲线」→「曲线编辑器」
2. 在面板顶部「目标」下拉框里选要加动画的形状（也可以直接在画布上选中形状，选「跟随当前选区」即走选区）
3. **拖动曲线上的两个蓝点**改变速率——预设只是快捷方式，拖一下就会变成你自己的曲线
4. 要精确数值可以展开「精确输入」直接填四个控制点坐标
5. **在版心小图上拖起点和终点**，决定从哪儿动到哪儿
6. 设时长、关键帧数、播放时机
7. 点「应用到选中形状」，然后 F5 放映

> 拖拽失败也不至于没辙：「精确输入」那四个数值框不依赖鼠标事件，任何环境下都能改曲线。
>
> 想一次给多个形状套同一条曲线：在画布上多选，然后「目标」保持「跟随当前选区」再应用。

装不上、看不到选项卡、动画没反应？先翻 [FAQ.md](FAQ.md)。

> 「目标」下拉框直接从当前页的 `Shapes` 枚举，不依赖选区接口——这是刻意做的冗余，
> 因为选区相关 API 在不同版本上行为不完全一致。

「时机」选**进页自动播**时写入 `nodeType="afterEffect"`，进页就跑；选「单击时」则要点一下。

## 实现要点

```js
const seq = slide.TimeLine.MainSequence
const eff = seq.AddEffect(shape, msoAnimEffectCustom)
eff.Timing.Duration   = 秒数          // 不设就是 indefinite，动画根本不会走
eff.Timing.TriggerType = msoAnimTriggerAfterPrevious   // 进页自动播

const beh = eff.Behaviors.Add(msoAnimTypeProperty)
beh.Timing.Duration = 秒数            // 必须也写到行为层，引擎读的是这个
const pe = beh.PropertyEffect
pe.Property = msoAnimX                // 1=X 位移，2=Y，5=不透明度，6=旋转，7=颜色

const pts = pe.Points                 // 对应 p:tavLst
pts.Add().Time  = 0.5                 // 0~1 归一化时间
pts.Add().Value = '#ppt_x+0.35'       // 公式字符串，相对位移
```

写出来长这样：

```xml
<p:anim calcmode="lin" valueType="num">
  <p:cBhvr>
    <p:cTn id="8" dur="3000"/>
    <p:tgtEl><p:spTgt spid="3"/></p:tgtEl>
    <p:attrNameLst><p:attrName>ppt_x</p:attrName></p:attrNameLst>
  </p:cBhvr>
  <p:tavLst>
    <p:tav tm="0"><p:val><p:strVal val="#ppt_x+0.000000"/></p:val></p:tav>
    <p:tav tm="50000"><p:val><p:strVal val="#ppt_x+0.196489"/></p:val></p:tav>
    <p:tav tm="100000"><p:val><p:strVal val="#ppt_x+0.350000"/></p:val></p:tav>
  </p:tavLst>
</p:anim>
```

## 验证数据

不只是"看文档推断能做"。四层，从真机到数学。

### 0. 真机：真实 WPS 12.1 + 真实鼠标输入

在真机上跑了一遍环境探针，全部通过：

| 检查项 | 结果 |
|---|---|
| 加载项加载 / 功能区选项卡 | 出现「动画曲线」 |
| `Shape.Id` / `Shape.Name` 读取 | `2:标题 1` |
| `Selection.ShapeRange` | **未选中形状时为 falsy**，`Shape.Select()` 后可用（Count=1） |
| `listShapes()` 枚举 | 1 |
| `applyToTarget()` 写入 | 20 帧 / 2.5s，落盘 XML 校验通过 |
| `CreateTaskPane()` | 返回 id=1，面板正常停靠 |
| 任务窗格内 `Application` | `object`（面板页同样能访问对象模型） |
| **真实鼠标拖拽控制点** | 成功，日志 `[drag] p=0.650,0.000,0.147,1.055` |

最后一条是关键：用系统级 `mouse_event` 向嵌入式浏览器注入真实鼠标手势，
页面收到 `pointerdown`（`hit=0/1`）并连续更新曲线，说明拖拽在 WPS 里确实可用，
不是只在无头浏览器里能跑。

### 1. 界面：无头 Chrome 渲染 + 自动交互

注入 mock `Application` 记录 WPS API 调用，自动跑完整流程（点预设 → 改参数 → 拖曲线控制点 → 拖版心起点 → 把终点设回形状位置 → 应用），7 步全过：

```
OK 点「回弹」预设 / 时长 1.5s / 关键帧 12
OK 拖动速率曲线控制点:  (0.340, 1.560) -> (0.407, 1.384)
OK 拖动版心小图的起点:  (0.219, 0.593) -> (0.134, 0.395)
OK 把终点设回形状位置（= 入场） / 点「应用」

effects 数量: 1   行为条数=2（X、Y 各一条）
形状位置 0.219, 0.593        ← 形状中心，不是左上角
  [X] 帧=12   首=-0.0851  末=0.0000
  [Y] 帧=12   首=-0.1980  末=0.0000
```

首帧偏移正好等于「起点 − 形状中心」（0.134−0.219 = −0.085、0.395−0.593 = −0.198），
末帧回到 0，两轴共用同一条曲线——从拖动到落盘数值的换算完全对齐。

### 2. 数学：52 条断言

| 套件 | 覆盖 | 结果 |
|---|---|---|
| 贝塞尔求解 | 6 个预设的端点、单调性、缓入/缓出相对线性、回弹超调与收敛 | 21/21 |
| 关键帧烘焙 | 帧数、时间均匀、首尾值、方向取负、帧数保护、24 帧单调、回弹超调 | 11/11 |
| 移入模式 | 起点=距离、终点归零、离原位距离单调减小、与移出逐帧互补 | 7/7 |
| 起止点路径 | 起止重合静止、线性中点、入场首末帧、两轴同曲线、总位移换算 | 8/8 |
| 形状位置 | 取中心而非左上角、贴边形状换算、缺宽高时退化 | 5/5 |

### 3. 播放：录屏逐帧核对

绿色方块走 `t³` 曲线、灰色方块走线性，同页同时自动播放，25fps 录屏逐帧量像素质心：

| 指标 | 结果 |
|---|---|
| 实测时长 | 3.84 s（设定 4000 ms） |
| 实测位移 | 635.6 px（= 0.5 版心宽） |
| 对 **t³** 残差 | **0.086** |
| 对 t² 残差 | 0.476 |
| 对**线性**残差 | 5.958 |

拟合度是线性的 **69 倍**。红线（实测）贴合蓝线（t³），与灰线（线性）无关。

## 踩过的坑

| 现象 | 原因 |
|---|---|
| `MainSequence.Count` 恒为 0 | 即使动画已加入也不更新，不能用它判断循环 |
| `SaveAs` 之后代码全停 | 同步阻塞 JS 线程，后续定时器不触发；改用 `SaveCopyAs` |
| 删掉 `Behavior` 后动画丢失目标 | `Behavior.Delete()` 会连带删掉共享的 `cBhvr`，`spTgt` 和 `dur` 一起没了 |
| WPS 空窗口不加载加载项 | 必须带文档启动 |
| `AddEffect` 后动画要点击才播 | 默认 `delay="indefinite"`，必须设 `TriggerType` |
| 改 `oem.ini` 部署失效 | 个人版 12.1.0.16910 起被官方限制，只能走 publish 模式 |

## 目录

```
addin/          加载项源码
  ribbon.xml    自定义功能区
  js/curve.js   曲线求值 / 关键帧烘焙 / 写入 WPS 对象模型
  js/ribbon.js  功能区回调 + 任务窗格管理
  ui/editor.html  任务窗格里的编辑器界面
docs/           GitHub Pages 站点（落地页 + 安装页 + FAQ 页 + addon/），addon/ 与 faq.html 由 release 生成
release/        离线包（走 GitHub Release 分发，不提交进仓库）
test/           测试稿
  curve-test.pptx     三页对照（三个相同方块，方便比不同曲线）
  entrance-check.pptx 入场隐藏行为检查（F5 后别按键，看方块在不在原位）
tools/          构建与测试
  tests/        纯 Node 单测（不需要 WPS）
  experiments/  可行性验证阶段的一次性脚本，留作溯源
PUBLISH.md      发布到 GitHub Pages 的完整清单
FAQ.md          常见问题：装不上、拖不动、效果不对、分发
server.js       本地调试用静态服务
```

## 开发命令

```bash
npm install              # 首次
npm run dev              # 本地静态服务 127.0.0.1:39123
npm test                 # 单测：曲线逻辑 39 项 + 资源完整性 12 项（不需要 WPS）
npm run doctor           # 环境体检：注册文件、发布地址、WPS 安装情况，全自动排查
npm run build            # 在线构建 -> addin/wps-addon-build/
npm run release <地址>   # 构建 + 生成安装页 + 部署 docs/ + 打离线包
npm run preview:ui       # 生成编辑器预览页（浏览器里看界面）
npm run preview:itest    # 生成集成测试页（mock WPS，自动点一遍）
```

XML 层面的辅助脚本（Python，需要 python-pptx / lxml）：

```bash
python tools/make_test_deck.py test/curve-test.pptx   # 生成对照测试稿
python tools/check_selftest.py out/probe.pptx         # 检查写出来的动画结构
python tools/inspect_timing.py out/probe.pptx         # 打印完整 timing 树
```

发布流程见 [PUBLISH.md](PUBLISH.md)。

## 只能人工确认的三件事

自动化能验的都验了，下面三条必须用眼睛看。改动涉及动画呈现时，请逐条过一遍：

| # | 操作 | 期望 |
|---|---|---|
| 1 | 打开 WPS 演示 | 功能区出现「动画曲线」选项卡；点开有「曲线编辑器」 |
| 2 | 点开面板，拖两个蓝点 | 曲线跟着变形、预设高亮消失、底部滑轨小球按新节奏跑 |
| 3 | 选中形状 → 应用 → F5 | 动画按所选曲线走；「移入」是从偏移处滑回原位 |

第 3 条有个具体待确认点：**「从该方向移入」+「单击时」时，形状在点击前是否已经露在原位**。

按 OOXML 语义，入场效果开始前形状应该是隐藏的（写入时会生成 `p:set style.visibility=visible`），
在前期一次带淡入的入场实验里也观察到了隐藏行为；但**纯属性动画的移入没有逐帧确认过**。

为此仓库里放了一份现成的检查文件 **`test/entrance-check.pptx`**：

1. 用 WPS 演示打开它，按 F5 放映
2. **什么键都别按**，盯住那个品红色方块
   - **看不见** → 行为正确（播放前形状被隐藏）
   - **已经停在原位露着** → 会出现"闪现→滑入"的穿帮
3. 随便点一下，方块应该从右侧滑进来停在原位

若第 2 步是"露着"，把「时机」改成「进页自动播」即可规避，也请提个 issue。

## 卸载

删除 `%APPDATA%\kingsoft\wps\jsaddons\publish.xml`，重启 WPS。

## 兼容性

Windows / Linux 版 WPS 演示，个人版需 ≥ 12.1.0.16910。**不支持 Mac 版 WPS**（该平台没有加载项机制）。

## 许可

MIT





