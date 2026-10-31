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
			// 工作区：只隐藏内容、保留盒子 —— 它有 flex:1，是撑住底部的那块弹性区
			'html[data-dsh-sc-region="1"] [class*="_regionArea"] > *{display:none!important}',
			// 状态区：footArea 里除设置行以外的一切（footerActions + 第三方直接挂进来的卡片）
			'html[data-dsh-sc-foot="1"] [' + PART_ATTR + '="foot"]{display:none!important}',
			// 设置与账号（头像那排）永远钉在左栏最底部，不随折叠改变位置
			'[class*="_footArea"]{margin-top:auto!important}',
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

		function makeHeader(key, onToggle) {
			const section = SECTIONS[key];
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = HEADER_CLASS;
			btn.dataset.dshScKey = key;
			btn.title = section.hint + "（点击折叠 / 展开）";
			btn.setAttribute("aria-label", section.label);

			const label = document.createElement("span");
			label.className = "dsh-sc-t";
			label.textContent = section.label;

			const chevron = document.createElement("span");
			chevron.className = "dsh-sc-c";
			chevron.innerHTML =
				'<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
				'<path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.5" ' +
				'stroke-linecap="round" stroke-linejoin="round"/></svg>';

			btn.appendChild(label);
			btn.appendChild(chevron);
			btn.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				onToggle(key);
			});
			return btn;
		}

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

			// 把元素按位置分桶并打标：功能区 / 状态区各自一堆，工作区靠 CSS 直接处理。
			const bucketize = () => {
				const region = findBySuffix("regionArea");
				const foot = findBySuffix("footArea");
				const shell = (region && region.parentElement) || (foot && foot.parentElement) || null;
				const wanted = new Map();
				if (!shell) return wanted;

				const kids = Array.from(shell.children).filter(isShellChild);
				const newSession = kids.find((el) => classMatches(el, "newSession")) || null;
				const regionAt = region && region.parentElement === shell ? kids.indexOf(region) : kids.length;
				const startAt = newSession ? kids.indexOf(newSession) + 1 : 0;

				kids.forEach((el, index) => {
					if (el === region) return;
					if (classMatches(el, "footArea") || containsSettings(el)) return;
					if (index >= startAt && index < regionAt) wanted.set(el, "panels");
					else if (index > regionAt) wanted.set(el, "foot");
				});

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
				if (placeHeader("panels", firstInDom(panels))) placed.add("panels");
				if (placeHeader("foot", firstInDom(footParts))) placed.add("foot");
				const region = findBySuffix("regionArea");
				if (placeHeader("region", region)) placed.add("region");
				dropOrphanHeaders(placed);
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
