# AGENTS.md — 给后续接手的人（和 AI）看的约定

这个文件记录 **用户明确提出的需求**、**已经踩过的坑**，以及**发布前必须通过的验证**。
改动这个仓库之前请先读完；下面每一条几乎都对应过一次真实的返工。

- 插件：`dsh-sidebar-sections`（DSH 左栏分区折叠，纯 DOM 增强，不动 React 树）
- 仓库：<https://github.com/LeeScenic/dsh-sidebar-sections>
- 目标宿主：DeepSeek Harness（Electron 打包版），当前验证过的版本是 **0.2.2-rc.2**
- 用户即仓库作者（LeeScenic / scenic），中文沟通

---

## 1. 用户的明确需求（不要自行"优化"掉）

### 1.1 三段必须能各自折叠

| 键 | 显示名 | 覆盖范围 |
| --- | --- | --- |
| `panels` | **功能区** | 新会话按钮下方到工作区之间的全域面板列表（插件 / Skill·MCP / 定时任务 / 任务看板 / 智能体 / 洞察 / 更多……） |
| `region` | **工作区** | `_regionArea` 里的**一切**：页签条（任务/频道/定时）、宿主那行「工作区 + 搜索/筛选/新建」、工作区与会话列表 |
| `foot` | **状态区** | `_footArea` 里**除设置行以外的一切** |

### 1.2 状态区必须"收纳一切"，且对未来的新增自动生效

- 用户原话：*"你看最下面的今日用量，没有放到状态区里，这不太对吧？……举一反三，以后这些地方又有新的东西，是不是也一并放到状态区里去？"*
- 也就是说：**不能按类名点名**（`_footerActions` 之类），宿主的卡片、第三方的卡片（`@linxin666/dsh-usage` 的今日用量、`dsh-web-all`、`dsh-settings-width` 等）都是直接把节点挂进 `_footArea` 的。
- 判定必须**按位置**：`_footArea` 的每个子节点都归状态区，唯独跳过 `_settingsArea`（以及任何包含它的容器）。
- 同理，外壳里 `_regionArea` 之后出现的任何节点也归状态区。
- 唯一永远不折叠的：**设置 / 账号那一行（`… 更多`、头像）必须钉在左栏最底部**。

### 1.3 三段是彼此独立的区块，不是一坨

- 用户原话：*"功能区这个不应该是自己单独一块，然后工作区也是自己单独一块吗，类似于单独的div……我把功能区和工作区都展开后，它俩的滚轮是一起的"*。
- 要求：**各自滚动**，滚轮在功能区里就只滚功能区，在工作区里就只滚工作区；绝不能共用一个滚动容器。
- 折叠工作区时，该区块收成**只剩一条折叠条**，腾出的高度归状态区（不是留一大片空白）。

### 1.4 外观：三段用同款整条折叠条

- 一行灰字（11px / 600 字重）、文字靠左、**右侧一个下箭头 chevron**（折叠后转成 `›`）。
- 三条必须**像素级对齐**（`x` 起点、宽度、label 起点、chevron 位置都一致）。
- 整栏收成 48px 图标窄条（rail）时：**隐藏三条折叠条**，且不要按用户偏好把图标栏也折掉（否则得到一条空栏）。

### 1.5 长列表必须能滚到底

- 用户原话：*"工作区里的东西太多时，最下面的信息/对话/session 展示不出来"*。
- 要求：列表自身滚动；宿主那行「工作区 + 三个图标」钉住不滚；**最后一条完整可见**，不能被状态区硬切。

### 1.6 默认态与持久化

- 默认：**只展开工作区**，功能区和状态区折叠（`DEFAULTS = { panels: true, region: false, foot: true }`，`true` = 折叠）。
- 状态存 `localStorage["dsh-sidebar-sections:v3"]`，形如 `{"panels":true,"region":false,"foot":true}`。
- 用户手动改过之后，刷新/重启必须保持。

---

## 2. 宿主 0.2.2 的真实 DOM 契约（按位置判定所依赖的事实）

```
wtg9ga_root
├── brand / toggle 行
├── button._newSession
├── [功能区 折叠条]                 ← 插件插入（必须在外壳里，见 3.3）
├── wtg9ga_scrollRegion            ← 0.2.2 新增
│   ├── wtg9ga_scrollArea  (display:grid，原来两段共用一个滚动)
│   │   ├── nav.wtg9ga_panelList
│   │   └── div.wtg9ga_regionArea
│   └── span.wtg9ga_scrollFade
├── [状态区 折叠条]                 ← 插件插入
└── div.wtg9ga_footArea
    ├── div.wtg9ga_footerActions
    ├── (第三方卡片，例如 data-dsh-usage-foot-card)
    └── div.wtg9ga_settingsArea     ← 永远不折叠、永远钉底
```

`_regionArea` 内部（这层**多了一个无 class 的匿名 div**，很容易漏）：

```
wtg9ga_regionArea
└── div(无 class，槽位容器)
    └── GAkraW_root
        ├── [页签条：任务 / 频道 / 定时]
        ├── GAkraW_sectionHeader   ← 宿主「工作区 + 🔍 ⚙ ＋」
        └── GAkraW_listArea (真滚动容器)
            └── GAkraW_treeBody → GAkraW_list → 会话行
```

- 类名是 CSS Modules 哈希（前缀随版本变，0.2.1/0.2.2 都是 `wtg9ga`，工作区包是 `GAkraW`），**只用后缀匹配**：`(^|\s)[A-Za-z0-9_-]*_<suffix>(\s|$)`。永远不要把 `wtg9ga_regionArea` 写死。
- 客户端插件装载契约（两代一致）：`window.__ModuleLoader__.load({ id, factory })`，导出 `apply` / `inject`；`package.json` 里 `dsh.client = { platform: "web", immediately: true }`。

---

## 3. 实现约定（照这个写才不会返工）

### 3.1 按位置分桶，不按类名点名

- 分桶结果写到元素属性 `data-dsh-sc-part="panels|region|foot"`，折叠态由 `html[data-dsh-sc-panels="1"]` 之类的根属性驱动 CSS。
- 工作区内容必须**递归**取：`regionArea` 里除了 `_sectionHeader` 那行以外的一切（含标题行**上方**的页签条）都算 `region`。只取"标题行之后的兄弟"会把页签条漏在外面。

### 3.2 样式一律写进一个 `<style>`，并带 `!important`

- 宿主的 CSS Modules 优先级更高，而且 **React 重渲染会抹掉元素上的内联样式** —— 用 `element.style.xxx` 调尺寸基本会被打回原形。
- 唯一例外：折叠条按钮的布局必须用内联样式（父容器是 grid，宿主的 `button` 规则会把宽度压成内容宽 16px），见 3.3。

### 3.3 折叠条插在哪

- 工作区：插在 `_regionArea` 内部第一块内容之前（折叠后只剩这一条）。
- 功能区：**不能**直接插在 `nav` 前面 —— `_scrollArea` 是 grid，插进去会被自动排布挤到底部。要插在"外壳里包着 nav 的那条分支"（`scrollRegion`）之前。
- 状态区：插在 `_footArea` 内第一块内容之前，**对齐全宽**（`_footArea` 外边距与 `_regionArea` 差 4px，要用 `alignHeader()` 以功能区那条为基准补 `margin-left/right`）。
- 同一个 key 全文档只允许存在一条：`sync()` 里换了挂载位置时必须先删除旧的那条（`dropOrphanHeaders`），否则会出现两条「工作区」。

### 3.4 限高链条：每一层都要 `min-height:0` + `overflow:hidden`

列表要能滚，从 `_regionArea` 到 `_listArea` **中间不能有任何一层按内容撑高**：

```css
[class*="_regionArea"]                                  { flex:1 1 0; min-height:0; overflow:hidden; flex column }
[class*="_regionArea"] > *:not(.dsh-sc-h)               { flex:1 1 0; min-height:0; overflow:hidden; flex column }
[class*="_regionArea"] [class*="_root"]                 { flex:1 1 0; min-height:0; overflow:hidden; flex column }
[class*="_regionArea"] [class*="_sectionHeader"]        { flex:0 0 auto }
[class*="_regionArea"] [class*="_listArea"]             { flex:1 1 auto; min-height:0; overflow-y:auto }
```

只写"直接子节点"是不够的：`regionArea > 匿名div > _root` 两层都要限高。

### 3.5 拆开共用滚动容器

`[data-sidebar-scrollport]`、`_scrollRegion`、`_scrollArea` 都改成 `display:flex; flex-direction:column; overflow:hidden; min-height:0`；`_panelList` 限高（`max-height:46%`）自己滚；`_regionArea` `flex:1 1 0` 自己滚。

---

## 4. 踩过的坑（现象 → 根因 → 正确做法）

| 现象 | 根因 | 正确做法 |
| --- | --- | --- |
| 升级 DSH 后插件"消失"，文件都在、市场没禁用 | `engines.dsh` 是硬门禁：不满足就**整包跳过**并记入 `skippedBundles`，patch 的 insert 不落地 | **不要写 `engines.dsh`**。DOM 增强找不到锚点本来就会安静 no-op，硬门禁只会让用户遇到"升级后突然没了" |
| 今日用量没被折进状态区 | 第三方卡片是 `_footArea` 的直接子节点（不在 `_footerActions` 里），按类名点名收不到 | 按位置判定：`_footArea` 子节点除设置行外全归状态区 |
| 折叠工作区后出现**两条**「工作区」 | 曾经加过"把开关挂到宿主标题行"的方案，并把 key 记进了 `placed`，于是 `dropOrphanHeaders()` 不再删旧条 | key 只在自己插入的条存在时才记 `placed`；换方案时确保旧条会被清掉 |
| 折叠后页签条（任务/频道/定时）不消失 | 只标了 `_sectionHeader` **之后**的兄弟 | 递归标 `regionArea` 里除标题行外的一切 |
| 功能区 + 工作区同时展开时，滚轮失效、底部被硬切 | `regionArea` 与列表之间夹了**无 class 的匿名 div**，它按内容撑高；列表因此 `scrollHeight == clientHeight`，压根没有可滚内容 | 链条上每一层都限高（见 3.4） |
| 两条折叠条被压成 16px 小三角 | 父容器 `_scrollArea` 是 `display:grid`，宿主更强的 `button` 规则盖掉了 `width:100%` | 折叠条布局写**内联样式**（`width:100%; grid-column:1/-1; display:flex…`），hover/箭头旋转仍用 CSS 类 |
| 功能区折叠条跑到底部/顺序错乱 | `_scrollArea` 是 grid，插在 `nav` 前面会被自动排布挪位；DOM 顺序 ≠ 视觉顺序 | 插在 `scrollRegion` 之前（外壳里包着 nav 的那条分支） |
| 三条折叠条左右不对齐 | `regionArea` 在 `_scrollArea`（x=3,w=274），另两条在外壳/footArea（x=7,w=264） | `alignHeader()` 以功能区条为基准补 `margin-left/right` |
| 测试时"合成滚轮"完全不滚动 | `new WheelEvent(...)` 是**不可信事件**，浏览器不会执行默认动作（滚动） | 必须用真实输入（CDP 的 wheel，即浏览器工具的滚动），或直接读 `clientHeight/scrollHeight` 判断可滚性 |
| 测试时滚轮被吃掉、误判成"没修好" | 隔离宿主首屏弹「预览版说明」/「开始使用」，全屏遮罩把滚轮吞了 | 先关弹窗再测；测完记录一次 `elementFromPoint` 的结果，避免被遮罩骗 |
| `dsh plugin add` 说成功但代码没更新 | 依赖是 `file:` tgz 且**版本号没变**（1.0.5→1.0.5），pnpm 判定"已满足"→ `added 0`，exit 0 | 装之前先 `Remove-Item profiles\desktop\node_modules\dsh-sidebar-sections -Recurse -Force`，再 add |
| 测试宿主污染/删掉真实 profile 的东西 | 用 junction 把测试 profile 的 `node_modules` 指向 `C:\Users\liming\.dsh\profiles\desktop\node_modules`，宿主/用户同时在装插件，pnpm 把测试包当 extraneous 清掉 | 测试宿主用**完全独立**的 `DSH_HOME`（例如 `E:\tmp\scNN`），`node_modules` 里只放真实目录 |
| 某次测试宿主实际对着真实 `~/.dsh` 跑了 4 分钟 | 子 agent 里 bash 提前展开 `$env:DSH_HOME`，变量丢失，宿主回了默认 home | 起宿主后立刻核对：测试 home 的 `profiles/web/cordis.yml` 有没有被改写；没把握就别起 |
| token URL 第二次打开就失效 | `/connect?token=` 是一次性的；服务器没起来就去开也会把 token 烧掉 | 等日志里出现 token 行再打开，只开一次 |
| 测试宿主活不过几分钟 | `Start-Process` 起的进程跟着子 agent 的进程树一起被回收 | 用 `Start-Process -WindowStyle Hidden` 起、并让一个常驻 subagent 定期 tick 持有；或每次用完显式收尾 |
| 父会话里没有 shell | 该会话的工具集里没有 `win_bash` | git / pnpm / 进程管理一律委派给 subagent（subagent 有 `pwsh` + node + npm） |
| 推送 20s 超时 `Failed to connect to github.com port 443` | `github.com` 的 DNS 被解析到黑洞 IP；`git config` 里还有 `insteadOf` 把 github 改写到只读镜像 | 钉 IP 的本地 CONNECT 代理（监听 `127.0.0.1:18080`，TARGET `140.82.113.3:443`）+ `-c http.sslBackend=schannel` + `https://x-access-token:<PAT>@github.com:...`（URL 带 token 前缀就不再命中 `https://github.com/` 的 `insteadOf`） |
| PAT 401 | token 被吊销/过期 | 让用户重新给；**不要把 token 写进仓库或文件**（曾经落在 `E:\tmp\ghtoken.txt`，已删） |

---

## 5. 发布前必须逐条通过的验证清单

在**真实页面**上（隔离宿主可以，但必须能真滚轮、无弹窗遮罩）：

1. 三条折叠条都在，label 分别是 功能区 / 工作区 / 状态区，chevron 在右。
2. 三条折叠条 `getBoundingClientRect()` 的 `x` / `width` / label `x` / chevron `x` 完全一致。
3. 点「功能区」：面板列表收起，chevron 转 `›`；再点展开，图标与文字顺序正确。
4. 点「工作区」：只剩一条折叠条，页签条 + 标题行 + 列表一起消失；再点展开全部回来。
5. 点「状态区」：`footerActions` **和第三方卡片**一起收起/展开；设置行与头像始终在最底部。
6. **功能区与工作区同时展开**时：两者各自独立滚动，互不带动。
7. 工作区塞满内容（列表注入 60 行即可）时：滚到底部，**最后一行完整可见**，宿主标题行钉住。
8. 刷新后状态保持；窄条（rail）模式下三条折叠条隐藏、图标栏不被折叠。
9. 装好的文件与仓库一致：`Get-FileHash` 对比 `E:\work\ss\lib\client.js` 与
   `C:\Users\liming\.dsh\profiles\desktop\node_modules\dsh-sidebar-sections\lib\client.js`。
10. 交付给用户时必须明确说：**完全退出 DSH 再打开**（插件在启动时加载，热重载不生效）。

> 没跑完这 10 条，不要说"修好了"。上一轮就是只跑了 1–5 + 程序化 `scrollTop` 就宣布通过，
> 结果 6、7 两条全挂。

---

## 6. 提交流程

```powershell
cd E:\work\ss
node --check lib/client.js
git add -A
git commit --amend --no-edit          # 未推送时统一 amend，保持一个提交
git tag -f -a v1.0.5 -m "v1.0.5" HEAD
git rev-parse HEAD ; git rev-parse "v1.0.5^{}"        # 两者必须相同（注意 ^{}，tag 是 annotated 对象）
```

> 打 tag 之后仍然可以往 `main` 上加**文档类**提交（例如 AGENTS.md），这时 `HEAD` 会比 tag 新，
> 属于正常状态：tag 应永远指向**发布用**的那个提交。验证发布内容时用 `git rev-parse "v1.0.5^{}"`，
> 不要拿它跟 `HEAD` 比。要不要把 tag 挪到 HEAD 上，取决于这次提交是否改变了插件行为 ——
> 只改文档就别动 tag，免得已发布资产的来源对不上。

安装到本机（本地验证 / 交付）：

```powershell
cd E:\work\ss ; npm pack
Copy-Item .\dsh-sidebar-sections-1.0.5.tgz "C:\Users\liming\.dsh\local-plugins\" -Force
Remove-Item "C:\Users\liming\.dsh\profiles\desktop\node_modules\dsh-sidebar-sections" -Recurse -Force
& "C:\Users\liming\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" `
    plugin --profile desktop add "file:C:/Users/liming/.dsh/local-plugins/dsh-sidebar-sections-1.0.5.tgz"
Remove-Item .\dsh-sidebar-sections-1.0.5.tgz    # 仓库保持干净
```

推送（需有效 PAT，见第 4 节最后两行）。改版本号时记得同步 `package.json`、`dsh.plugin.json`、两个 README。

---

## 7. 沟通约定

- 用户很在意"跟原来不一样"：任何改动前先确认**参照物**是哪一版（截图对照最省事）。
- 不要在没验证的情况下说"已修复"；宁可说"已装好，请重启后确认这两点"。
- 用户可能连续重启多次，每次都要说清楚**这次改的根因是什么、为什么上一版没解决**，不要只说"又修好了"。
- 折叠条的名称就用 功能区 / 工作区 / 状态区，不要再起别的名字。
