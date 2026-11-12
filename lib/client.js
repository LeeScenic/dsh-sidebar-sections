// dsh-sidebar-sections — browser half.
//
// 纯 DOM 增强，不改 React 树、不注册 slot：给左侧栏三段各加一个可点击的折叠条
//   功能区 = 新建会话按钮之后、工作区之前的一切   （插件 / 插件市场 / 定时任务 / MCP 连接器 / 更多）
//   工作区 = div._regionArea                     （sidebar.workspaces 槽位：任务 / 频道 / 定时 + 工作区列表）
//   状态区 = 工作区之后、设置行之前的一切         （Remote / OpenCode GO 用量 / 今日用量 等底部卡片）
//
// 分区靠**位置**判定，不靠类名清单：宿主以后往这几个位置加新东西，或者第三方插件
// 直接往 _footArea 里塞一块卡片（例如 dsh-usage 的 div[data-dsh-usage-foot-card]），
// 都会自动落进对应分区，不需要改这份代码。
//
// 唯一钉死不动的是设置行（div._settingsArea：呼叫按钮 + 账号头像）：它永远留在最底部，
// 既不参与折叠，也不随任何分区的开合上下浮动。
//
// 折叠靠 html 上的 data-dsh-sc-<key> 属性 + 被标记元素上的 data-dsh-sc-part + 一条
// !important 的 CSS 完成，所以 React 重渲染不会把隐藏状态冲掉；折叠条自己由
// MutationObserver 补回。
//
// 点折叠条 = 切换；状态存在 localStorage（按 origin 存，DSH 每次重启换端口，
// 所以端口变了会回到默认值——默认就是「只显示工作区」）。
window.__ModuleLoader__.load({
	id: "dsh-sidebar-sections",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const CSS_ID = "dsh-sidebar-sections/sections.css";
		const STORE_KEY = "dsh-sidebar-sections:v3";
		const GLOBAL_FLAG = "__DSH_SIDEBAR_SECTIONS__";
		const HEADER_CLASS = "dsh-sc-h";
		const PART_ATTR = "data-dsh-sc-part";

		const SECTIONS = {
			panels: { label: "功能区", hint: "插件 / 插件市场 / 定时任务 / MCP / 更多" },
			region: { label: "工作区", hint: "任务 / 频道 / 定时 + 会话与工作区列表" },
			foot: { label: "状态区", hint: "远端入口 / 用量 / 其它底部卡片（设置与账号常驻底部）" }
		};
		const KEYS = ["panels", "region", "foot"];

		// true = 折叠。默认只展开工作区，符合「东西太多，只留工作区」的诉求。
		const DEFAULTS = { panels: true, region: false, foot: true };

		const CSS_TEXT = [
			// —— 折叠态：藏掉被标记成该分区的元素 ——
			// 功能区在「整栏收成图标窄条」时不折叠：窄条正是宿主为放不下准备的形态，
			// 再按自己的偏好藏掉图标只会得到一条空栏。（状态区不豁免：卡片塞进
			// 48px 窄条会被挤成一列竖排小字，宁可保持用户的选择。）
			'html[data-dsh-sc-panels="1"]:not([data-dsh-sc-narrow="1"]) [' + PART_ATTR + '="panels"]{display:none!important}',
			// 工作区：regionArea 里的东西（页签条 / 宿主标题行 / 列表）整块收起，
			// 只留与功能区、状态区同款的整条折叠条在外壳里。
			// regionArea 盒子本身不动——它是撑住底部的弹性区。
			'html[data-dsh-sc-region="1"] [' + PART_ATTR + '="region"]{display:none!important}',
			// 状态区：footArea 里除设置行以外的一切（footerActions + 第三方直接挂进来的卡片）
			'html[data-dsh-sc-foot="1"] [' + PART_ATTR + '="foot"]{display:none!important}',
			// 设置与账号（头像那排）永远钉在左栏最底部，不随折叠改变位置
			'[class*="_footArea"]{margin-top:auto!important}',
			// —— 0.2.2：把「功能区 / 工作区」从同一个滚动容器里拆开 ——
			// 宿主把 nav.panelList 与 regionArea 一起塞进 data-sidebar-scrollport 这个
			// grid 滚动容器，于是两边共用一个滚轮：往下滑一点功能区就整块滑出去了。
			// 这里把容器改成 flex 列并收回滚动权：功能区自己滚（限高），工作区自己滚。
			'[data-sidebar-scrollport]{display:flex!important;flex-direction:column!important;',
			'overflow:hidden!important;min-height:0!important}',
			// 滚动容器是 scrollRegion > scrollArea 这两层（scrollFade 是它的兄弟），
			// 两层都改成不滚动的 flex 列，滚动权交给下面的两个块。
			'[class*="_scrollRegion"]{display:flex!important;flex-direction:column!important;',
			'overflow:hidden!important;min-height:0!important}',
			'[class*="_scrollArea"]{display:flex!important;flex-direction:column!important;overflow:hidden!important;',
			'min-height:0!important;flex:1 1 auto!important}',
			'[class*="_panelList"]{flex:0 1 auto!important;min-height:0!important;max-height:46%!important;',
			'overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain}',
			'[class*="_regionArea"]{flex:1 1 0!important;min-height:0!important;overflow:hidden!important;',
			'display:flex!important;flex-direction:column!important}',
			// 工作区里的长列表必须自己滚：外层 regionArea 是 overflow:hidden 的限高盒子，
			// 里面的列表若不滚，内容就被整块裁掉（看到的是被切断的一截，滚轮也没反应）。
			// 这些规则要带 !important：宿主的 CSS Modules 里同样的声明更"靠后"，
			// 而且 React 重渲染会抹掉我们写在元素上的内联样式。
			// regionArea 与列表之间可能还夹着宿主自己的匿名容器（没有 class 的 slot div，
			// 例如 <div class="wtg9ga_regionArea"><div><div class="GAkraW_root">…），
			// 链条上只要有任意一层按内容撑高，列表就会被挤出容器并被裁掉，
			// 所以「直接子节点」和「中间任何 _root」两层都要限高 + 隐藏溢出。
			'[class*="_regionArea"]>*:not(.dsh-sc-h){flex:1 1 0!important;min-height:0!important;',
			'overflow:hidden!important;display:flex!important;flex-direction:column!important}',
			'[class*="_regionArea"] [class*="_root"]{flex:1 1 0!important;min-height:0!important;',
			'overflow:hidden!important;display:flex!important;flex-direction:column!important}',
			// 宿主标题行（工作区 / 搜索 / 筛选 / 新建）钉住不滚
			'[class*="_regionArea"] [class*="_sectionHeader"]{flex:0 0 auto!important}',
			'[class*="_regionArea"] [class*="_treeBody"]{min-height:0!important;flex:1 1 auto!important}',
			'[class*="_regionArea"] [class*="_listArea"]{flex:1 1 auto!important;min-height:0!important;',
			'overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain}',
			'[class*="_regionArea"] [class*="_list"]:not([class*="_listArea"]){overflow:visible!important}',
			// —— 折叠条本体 ——
			'.dsh-sc-h{box-sizing:border-box;display:flex;align-items:center;gap:6px;flex:none;width:100%;min-width:0;',
			'margin:2px 0 0;padding:5px 8px;border:0;border-radius:6px;background:transparent;cursor:pointer;',
			'font:inherit;font-size:11px;font-weight:600;line-height:16px;letter-spacing:.04em;text-align:left;',
			'color:var(--dsw-alias-label-secondary,#8a8f98);user-select:none;-webkit-user-select:none}',
			'.dsh-sc-h:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));',
			'color:var(--dsw-alias-label-primary,#e6e6e6)}',
			'.dsh-sc-h:focus-visible{outline:1px solid var(--dsw-alias-border-l3,#5b8def);outline-offset:-1px}',
			'.dsh-sc-h>.dsh-sc-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.dsh-sc-h>.dsh-sc-c{flex:none;display:flex;align-items:center;justify-content:center;width:12px;height:12px;',
			'transition:transform .16s ease;transform:rotate(0deg)}',
			'html[data-dsh-sc-panels="1"] .dsh-sc-h[data-dsh-sc-key="panels"]>.dsh-sc-c,',
			'html[data-dsh-sc-region="1"] .dsh-sc-h[data-dsh-sc-key="region"]>.dsh-sc-c,',
			'html[data-dsh-sc-foot="1"] .dsh-sc-h[data-dsh-sc-key="foot"]>.dsh-sc-c{transform:rotate(-90deg)}',
			// 整栏收成窄条时不要挤折叠条
			'html[data-dsh-sc-narrow="1"] .dsh-sc-h{display:none}'
		].join("");

		function injectCss() {
			if (typeof document === "undefined") return;
			if (document.querySelector('style[data-plugin-css="' + CSS_ID + '"]')) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sidebar-sections";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = CSS_TEXT;
			(document.head || document.documentElement).appendChild(tag);
		}

		function readState() {
			let saved = null;
			try {
				saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null");
			} catch (e) {
				saved = null;
			}
			const out = {};
			for (const key of KEYS) {
				out[key] = saved && typeof saved[key] === "boolean" ? saved[key] : DEFAULTS[key] === true;
			}
			return out;
		}

		function writeState(state) {
			try {
				window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
			} catch (e) {
				/* 隐私模式/配额满：忽略，仅影响记忆 */
			}
		}

		function paintState(state) {
			const root = document.documentElement;
			for (const key of KEYS) {
				root.setAttribute("data-dsh-sc-" + key, state[key] ? "1" : "0");
			}
		}

		function classMatches(el, suffix) {
			const cls = el && typeof el.className === "string" ? el.className : "";
			if (cls === "") return false;
			const exact = new RegExp("(^|\\s)[A-Za-z0-9_-]*_" + suffix + "(\\s|$)");
			return exact.test(cls);
		}

		// 用 CSS Modules 的 class 后缀找宿主区块：不写死构建哈希（wtg9ga 之类会随版本变）
		function findBySuffix(suffix) {
			const loose = document.querySelectorAll('[class*="_' + suffix + '"]');
			for (const el of loose) {
				if (classMatches(el, suffix)) return el;
			}
			return null;
		}

		// 只在指定容器内部找同名区块
		function findIn(root, suffix) {
			if (!root || typeof root.querySelectorAll !== "function") return null;
			for (const el of root.querySelectorAll('[class*="_' + suffix + '"]')) {
				if (classMatches(el, suffix)) return el;
			}
			return null;
		}

		// 设置行（呼叫按钮 + 账号头像）以及任何包着它的容器都不许标记，
		// 否则「永远钉在最底部」这条就失效了。
		function containsSettings(el) {
			if (!el) return false;
			if (classMatches(el, "settingsArea")) return true;
			if (typeof el.querySelectorAll !== "function") return false;
			for (const probe of el.querySelectorAll('[class*="_settingsArea"]')) {
				if (classMatches(probe, "settingsArea")) return true;
			}
			return false;
		}

		function isOwnNode(el) {
			return !!(el.classList && el.classList.contains(HEADER_CLASS));
		}

		function isShellChild(el) {
			const tag = el.tagName;
			if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK") return false;
			return !isOwnNode(el);
		}

		function firstInDom(list) {
			let best = null;
			for (const el of list) {
				if (!el || !el.isConnected) continue;
				if (!best) {
					best = el;
					continue;
				}
				const where = best.compareDocumentPosition(el);
				if (where & Node.DOCUMENT_POSITION_PRECEDING) best = el;
			}
			return best;
		}

		function makeChevron() {
			const chevron = document.createElement("span");
			chevron.className = "dsh-sc-c";
			chevron.innerHTML =
				'<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
				'<path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.5" ' +
				'stroke-linecap="round" stroke-linejoin="round"/></svg>';
			return chevron;
		}

		function makeHeader(key, onToggle) {
			const section = SECTIONS[key];
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = HEADER_CLASS;
			btn.dataset.dshScKey = key;
			btn.title = section.hint + "（点击折叠 / 展开）";
			btn.setAttribute("aria-label", section.label);
			// The sidebar scroll area is a CSS grid with strong host rules, so a
			// stylesheet-based width loses. Inline styles win over any stylesheet
			// rule, which keeps the header full-width wherever it is anchored.
			btn.style.cssText =
				"display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;" +
				"grid-column:1 / -1;margin:2px 0 0;padding:5px 8px;border:0;border-radius:6px;" +
				"background:transparent;cursor:pointer;font:inherit;font-size:11px;font-weight:600;" +
				"line-height:16px;letter-spacing:.04em;text-align:left;user-select:none;" +
				"color:var(--dsw-alias-label-secondary,#8a8f98)";

			const label = document.createElement("span");
			label.className = "dsh-sc-t";
			label.textContent = section.label;
			label.style.cssText =
				"flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

			const chevron = makeChevron();

			btn.appendChild(label);
			btn.appendChild(chevron);
			btn.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				onToggle(key);
			});
			return btn;
		}

		// 工作区、功能区、状态区用同一套整条折叠条：把自己那一块的内容整体收起，
		// 条本身留在原处，视觉上与「功能区 / 状态区」完全一致。
		function start() {
			if (typeof document === "undefined" || typeof window === "undefined") return () => {};
			if (!window.__ModuleLoader__ || window[GLOBAL_FLAG]) return () => {};
			window[GLOBAL_FLAG] = true;

			injectCss();

			let state = readState();
			paintState(state);

			const toggle = (key) => {
				state = Object.assign({}, state, { [key]: !state[key] });
				paintState(state);
				writeState(state);
			};

			// 工作区与状态区的最低公共祖先 = 侧栏外壳。
			// 0.2.1 及以前两者都是外壳的直接子节点；0.2.2 起宿主给 panelList 与
			// regionArea 外面包了 scrollRegion > scrollArea 滚动容器，此时外壳仍是
			// 最低公共祖先，而 nav 缩进了两层——所以不能假设「区块的父节点就是外壳」。
			const shellOf = (region, foot) => {
				if (!region || !foot) return null;
				let node = region.parentElement;
				while (node) {
					if (node.contains(foot)) return node;
					node = node.parentElement;
				}
				return null;
			};

			// 从 el 往上找到「父节点就是 shell」的那一层：它是 el 所在这条分支。
			const branchUnder = (el, shell) => {
				let node = el;
				while (node && node.parentElement && node.parentElement !== shell) {
					node = node.parentElement;
				}
				return node && node.parentElement === shell ? node : null;
			};

			// 工作区那块的内容：regionArea 的直接子节点整块收起（页签条、宿主标题行、
			// 会话与工作区列表都在里面）。折叠条自己由 isOwnNode 跳过。
			const markRegionBody = (region, out) => {
				for (const child of Array.from(region.children)) {
					if (isOwnNode(child)) continue;
					out.push(child);
				}
			};

			// 工作区那块的滚动：regionArea 是限高弹性区，但它里面的列表默认不自己滚，
			// 长列表的尾部就被 overflow:hidden 裁掉（功能区收起后尤其明显——看到的不是
			// 最新几个会话，而是被切断的一截）。这里把「装着宿主标题行的那块」拉满剩余
			// 高度，并让它内部真正的列表容器负责滚动；页签条之类的插件卡片保持不撑高。
			const tuneWorkspace = (region) => {
				if (!region) return;
				const header = findIn(region, "sectionHeader");
				for (const child of Array.from(region.children)) {
					if (isOwnNode(child)) continue;
					const isBody = header && (child === header || (child.contains && child.contains(header)));
					if (!isBody) {
						if (child.style.flex !== "0 0 auto") child.style.flex = "0 0 auto";
						continue;
					}
					if (child.style.flex !== "1 1 0") child.style.flex = "1 1 0";
					if (child.style.minHeight !== "0") child.style.minHeight = "0";
					if (child.style.overflow !== "hidden") child.style.overflow = "hidden";
					if (child.style.display !== "flex") child.style.display = "flex";
					if (child.style.flexDirection !== "column") child.style.flexDirection = "column";
					if (header !== child) {
						if (header.style.flex !== "0 0 auto") header.style.flex = "0 0 auto";
						if (header.style.minHeight !== "auto") header.style.minHeight = "auto";
					}
					const treeBody = findIn(child, "treeBody");
					if (treeBody && treeBody.style.minHeight !== "0") treeBody.style.minHeight = "0";
					const listArea = findIn(child, "listArea");
					const scroller = listArea || treeBody;
					if (scroller) {
						if (scroller.style.flex !== "1 1 auto") scroller.style.flex = "1 1 auto";
						if (scroller.style.minHeight !== "0") scroller.style.minHeight = "0";
						if (scroller.style.overflowY !== "auto") scroller.style.overflowY = "auto";
						if (scroller.style.overflowX !== "hidden") scroller.style.overflowX = "hidden";
					}
				}
			};

			// 把元素按位置分桶并打标。
			const bucketize = () => {
				const region = findBySuffix("regionArea");
				const foot = findBySuffix("footArea");
				const shell = shellOf(region, foot);
				const wanted = new Map();
				if (!shell) return wanted;

				const kids = Array.from(shell.children).filter(isShellChild);
				const newSession = kids.find((el) => classMatches(el, "newSession")) || null;
				const regionBranch = region ? branchUnder(region, shell) : null;
				const regionAt = regionBranch ? kids.indexOf(regionBranch) : kids.length;
				const startAt = newSession ? kids.indexOf(newSession) + 1 : 0;

				kids.forEach((el, index) => {
					if (el === regionBranch) return; // 工作区所在分支内部单独处理
					if (classMatches(el, "footArea") || containsSettings(el)) return; // 状态区容器内部单独处理
					if (index >= startAt && index < regionAt) wanted.set(el, "panels");
					else if (index > regionAt) wanted.set(el, "foot");
				});

				// 面板列表可能与工作区一起被收进滚动容器（0.2.2），单独点名。
				const nav = findBySuffix("panelList");
				if (nav && shell.contains(nav)) wanted.set(nav, "panels");

				// 工作区所在的那一层容器里也要按位置分：regionArea 之后的算状态区，
				// 之前的（多数是面板列表）算功能区。0.2.2 起外壳被滚动容器隔开，别的
				// 插件常把卡片插成 regionArea 的兄弟节点，只认外壳层会漏掉它们。
				if (region && region.parentElement) {
					const siblings = Array.from(region.parentElement.children);
					const at = siblings.indexOf(region);
					siblings.forEach((el, index) => {
						if (el === region || isOwnNode(el) || classMatches(el, "footArea")) return;
						if (index > at) wanted.set(el, "foot");
						else if (index < at && !containsSettings(el)) wanted.set(el, "panels");
					});
				}

				// 工作区用与功能区、状态区同款的整条折叠条：regionArea 里的内容
				// （页签条 / 宿主标题行 / 列表）整块归工作区，折叠时全部收起。
				if (region) {
					const body = [];
					markRegionBody(region, body);
					for (const el of body) wanted.set(el, "region");
				}

				// footArea 里面每一块（除设置行与折叠条）都归状态区：宿主与第三方插件
				// 都习惯把卡片直接挂在这里。
				if (foot) {
					for (const child of Array.from(foot.children)) {
						if (isOwnNode(child) || containsSettings(child)) continue;
						wanted.set(child, "foot");
					}
				}
				return wanted;
			};

			const applyParts = (wanted) => {
				for (const [el, part] of wanted) {
					if (el.getAttribute(PART_ATTR) !== part) el.setAttribute(PART_ATTR, part);
				}
				for (const el of document.querySelectorAll("[" + PART_ATTR + "]")) {
					if (!wanted.has(el)) el.removeAttribute(PART_ATTR);
				}
			};

			// 折叠条紧贴在各自区块的第一块前面；宿主重渲染掉了就补回来。
			// 同一个 key 全文档只留一条：区块的「第一块」会随渲染时机换容器
			// （先出现在 shell 层、随后被挪进 footArea），旧位置的残留必须删掉。
			const placeHeader = (key, target) => {
				if (!target || !target.parentNode) return false;
				const parent = target.parentNode;
				const existing = [];
				for (const el of document.querySelectorAll("." + HEADER_CLASS)) {
					if (el.dataset.dshScKey === key) existing.push(el);
				}
				let header = null;
				for (const el of existing) {
					if (!header && el.parentNode === parent) header = el;
					else el.remove();
				}
				if (!header) header = makeHeader(key, toggle);
				if (header.nextElementSibling !== target) parent.insertBefore(header, target);
				return true;
			};

			const dropOrphanHeaders = (placed) => {
				for (const header of document.querySelectorAll("." + HEADER_CLASS)) {
					const key = header.dataset.dshScKey;
					if (!placed.has(key)) header.remove();
				}
			};

			// 三条折叠条长在不同容器里（外壳 / scrollArea 里的 regionArea / footArea），
			// 容器的左右内缩并不一致（实测 264 宽 @x7 与 274 宽 @x3），直接 100% 铺开就会
			// 差出几像素、看着"不齐"。这里拿真实布局把工作区那条对齐到功能区那条。
			const alignHeader = (header, ref) => {
				if (!header || !ref || header === ref) return;
				const parent = header.parentElement;
				if (!parent) return;
				const pr = parent.getBoundingClientRect();
				const rr = ref.getBoundingClientRect();
				if (!rr.width || !pr.width) return;
				const left = Math.max(0, Math.round(rr.left - pr.left));
				const right = Math.max(0, Math.round(pr.right - rr.right));
				if (header.style.marginLeft !== left + "px") header.style.marginLeft = left + "px";
				if (header.style.marginRight !== right + "px") header.style.marginRight = right + "px";
				if (header.style.width !== "auto") header.style.width = "auto";
			};

			const sync = () => {
				const wanted = bucketize();
				applyParts(wanted);

				const panels = [];
				const footParts = [];
				for (const [el, part] of wanted) {
					if (part === "panels") panels.push(el);
					else if (part === "foot") footParts.push(el);
				}

				const placed = new Set();
				// 0.2.2 里面板列表与工作区一起被收进 grid 滚动容器，直接插在 nav 前面
				// 会被 grid 自动排布挤到最下面（DOM 顺序 ≠ 视觉顺序）。所以改成贴在
				// 「外壳里包着 nav 的那条分支」前面：外壳是 flex 列，插哪儿就在哪儿。
				const navEl = findBySuffix("panelList");
				const footEl = findBySuffix("footArea");
				const shellEl = shellOf(findBySuffix("regionArea"), footEl);
				const panelsAnchor = navEl && shellEl ? branchUnder(navEl, shellEl) || navEl : firstInDom(panels);
				if (placeHeader("panels", panelsAnchor)) placed.add("panels");
				// 状态区的条尽量贴着底部区域本身：footArea 里有内容就锚在它里面，
				// 免得因为某个被插进滚动容器的卡片把标题条拽到页面上半截去。
				const foot = findBySuffix("footArea");
				const inFoot = foot ? footParts.filter((el) => foot.contains(el)) : [];
				const footAnchor = firstInDom(inFoot.length > 0 ? inFoot : footParts);
				if (placeHeader("foot", footAnchor)) placed.add("foot");
				// 工作区的条贴着 regionArea 里的第一块内容：折叠后内容整块消失，
				// 条就顶到功能区那一行下面，和「功能区 / 状态区」排成一样的三行。
				const region = findBySuffix("regionArea");
				if (region) {
					const anchor = firstInDom(
						Array.from(region.children).filter((el) => !isOwnNode(el))
					);
					if (placeHeader("region", anchor)) placed.add("region");
					tuneWorkspace(region);
				}
				dropOrphanHeaders(placed);

				// 对齐：以「功能区」那条为基准，把工作区那条摆到同样的左右边界。
				const headerOf = (key) =>
					document.querySelector("." + HEADER_CLASS + '[data-dsh-sc-key="' + key + '"]');
				const panelsHeader = headerOf("panels");
				const regionHeader = headerOf("region");
				const footHeader = headerOf("foot");
				const widthOf = (el) => (el ? el.getBoundingClientRect().width : 0);
				const refHeader = widthOf(panelsHeader) > 0 ? panelsHeader : footHeader;
				if (regionHeader && widthOf(refHeader) > 0) alignHeader(regionHeader, refHeader);
			};

			let queued = false;
			const schedule = () => {
				if (queued) return;
				queued = true;
				const raf = window.requestAnimationFrame || ((fn) => window.setTimeout(fn, 16));
				raf(() => {
					queued = false;
					try {
						sync();
					} catch (e) {
						/* 保活：任何一次失败都不该影响侧栏 */
					}
				});
			};

			schedule();

			const observer = new MutationObserver(() => schedule());
			observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

			// 整栏折叠成窄条时把折叠条收起来，避免挤成一列竖字
			let ro = null;
			const watchWidth = () => {
				if (typeof ResizeObserver !== "function") return;
				const anchor = findBySuffix("panelList") || findBySuffix("regionArea");
				const parent = anchor && anchor.parentNode;
				if (!parent || parent.__dshScWatched) return;
				parent.__dshScWatched = true;
				ro = new ResizeObserver(() => {
					document.documentElement.setAttribute("data-dsh-sc-narrow", parent.clientWidth < 96 ? "1" : "0");
				});
				ro.observe(parent);
			};
			watchWidth();
			window.setInterval(() => {
				try {
					sync();
					watchWidth();
				} catch (e) {
					/* 同上 */
				}
			}, 1500);

			return () => {
				try {
					observer.disconnect();
					if (ro) ro.disconnect();
				} catch (e) {
					/* noop */
				}
				window[GLOBAL_FLAG] = false;
			};
		}

		const inject = [];

		function apply(ctx) {
			try {
				if (ctx && typeof ctx.effect === "function") {
					ctx.effect(() => start(), "dsh-sidebar-sections: 侧栏折叠条");
				} else {
					start();
				}
			} catch (e) {
				if (typeof console !== "undefined") console.warn("[dsh-sidebar-sections]", e);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
