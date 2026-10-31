# dsh-sidebar-sections

给 DeepSeek Harness 左侧栏加可折叠的分区标题条：把侧栏切成 **功能区 / 工作区 / 状态区** 三段，
每段点一下收起、再点展开。

| 分区 | 宿主元素 | 里面是什么 |
| --- | --- | --- |
| 功能区 | `nav._panelList` | 插件 / 插件市场 / 定时任务 / MCP 连接器 / 更多 |
| 工作区 | `div._regionArea` | `任务 / 频道 / 定时` 标签行 + 会话与工作区列表 |
| 状态区 | `div._footArea` 里的 `div._footerActions` | Remote 入口、OpenCode GO 用量 |

默认就是「只展开工作区」——打开就是干净的一屏。

设置区（`div._settingsArea`：呼叫按钮 + 账号头像）**永不参与折叠**，并且钉死在侧栏最底部，
不随任何分区的开合上下移动。

## 安装

```sh
dsh plugin --profile web add "https://github.com/LeeScenic/dsh-sidebar-sections/releases/latest/download/dsh-sidebar-sections-1.0.3.tgz"
```

桌面版：`dsh plugin --profile desktop add "https://github.com/LeeScenic/dsh-sidebar-sections/releases/latest/download/dsh-sidebar-sections-1.0.3.tgz"`。

装完要**完全退出 DSH 再打开**——客户端 bundle 在启动时加载。

## 实现方式

纯浏览器半边插件（`dsh.client.platform = "web"`），不注册 slot、不改 React 树：

1. 用 CSS Modules 的 **class 后缀**找宿主区块（`[class*="_regionArea"]` + 正则精确匹配），
   不写死构建哈希——宿主升级换了哈希也照样能找到。
2. 折叠靠 `<html>` 上的 `data-dsh-sc-<key>` 属性 + 一行 `!important` 的 CSS，
   React 重渲染冲不掉隐藏状态。
3. 标题条自己可能在重渲染里被丢掉，所以 `MutationObserver`（rAF 去抖）+ 1500ms 兜底定时器会把它补回去。
4. 整栏折叠成窄条时（父容器 `clientWidth < 96`）标题条自动隐藏，避免挤成一列竖字。
5. 全程 try/catch：任何一次失败只 `console.warn`，绝不影响侧栏本身。

## 状态

存在 `localStorage["dsh-sidebar-sections:v3"]`，形如 `{"panels":true,"region":false,"foot":true}`
（`true` = 折叠）。

已知限制：DSH 桌面版每次启动换端口 → origin 变了 → 读不到上一次的记录，回到默认值。
默认值本来就是「只展开工作区」，所以影响不大。

## 兼容性

DSH `0.2.1-rc.3` — `0.2.1-rc.5`，网页版与桌面版均可。除了侧栏的 CSS Modules 类名（按后缀匹配）
之外，不依赖宿主任何内部实现。

## 文件

| 文件 | 作用 |
| --- | --- |
| `lib/client.js` | 浏览器半边，全部行为 |
| `lib/index.js` | host 半边，空 `apply()`，只为让条目出现在 Loader 图里 |
| `cordis.patch.yml` | bundle patch，insert 一行（纯新增，自带重复挂载守卫） |
| `dsh.plugin.json` | 插件清单 |

## License

MIT
