// dsh-sidebar-sections — browser half.
//
// 纯 DOM 增强，不改 React 树、不注册 slot：给左侧栏三段各加一个可点击的折叠条
//   功能区 = nav._panelList                     （插件 / 插件市场 / 定时任务 / MCP 连接器 / 更多）
//   工作区 = div._regionArea                    （sidebar.workspaces 槽位：任务 / 频道 / 定时 + 工作区列表）
//   状态区 = div._footArea > div._footerActions （Remote / OpenCode GO 用量）
//
// 状态区**只折 footerActions**：同一 footArea 里的 _settingsArea（呼叫按钮 + 账号头像）
// 永远留在最底下跟着折叠走，那是「总在最下面」的一块，不属于可选内容。
//
// 折叠靠 html 上的 data-dsh-sc-<key> 属性 + 一行 !important 的 CSS 完成，
// 所以 React 重渲染不会把隐藏状态冲掉；折叠条自己由 MutationObserver 补回。
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

		// parentSuffix：目标必须挂在哪个宿主容器下面。防止撞到同名但不同位置的
		// class —— 例如审批卡片里的 wnLwla_footerActions 就没有 _footArea 父级。
		const SECTIONS = [
			{ key: "panels", label: "功能区", hint: "插件 / 插件市场 / 定时任务 / MCP / 更多", suffix: "panelList", parentSuffix: null },
			{ key: "region", label: "工作区", hint: "任务 / 频道 / 定时 + 会话与工作区列表", suffix: "regionArea", parentSuffix: null },
			{ key: "foot", label: "状态区", hint: "远端入口 / 用量（设置与账号常驻底部）", suffix: "footerActions", parentSuffix: "footArea" }
		];

		// true = 折叠。默认只展开工作区，符合「东西太多，只留工作区」的诉求。
		const DEFAULTS = { panels: true, region: false, foot: true };

		const CSS_TEXT = [
			// —— 折叠态：直接隐藏宿主自己的区块 ——
			'html[data-dsh-sc-panels="1"] [class*="_panelList"]{display:none!important}',
			// 工作区：只隐藏内容、保留盒子 —— 它有 flex:1，是撑住底部的那块弹性区
			'html[data-dsh-sc-region="1"] [class*="_regionArea"] > *{display:none!important}',
			// 只折 footArea 里的 footerActions，_settingsArea（头像那排）永远保留
			'html[data-dsh-sc-foot="1"] [class*="_footArea"] > [class*="_footerActions"]{display:none!important}',
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
			for (const s of SECTIONS) {
				out[s.key] = saved && typeof saved[s.key] === "boolean" ? saved[s.key] : DEFAULTS[s.key] === true;
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
			for (const s of SECTIONS) {
				root.setAttribute("data-dsh-sc-" + s.key, state[s.key] ? "1" : "0");
			}
		}

		function classMatches(el, suffix) {
			const cls = el && typeof el.className === "string" ? el.className : "";
			if (cls === "") return false;
			const exact = new RegExp("(^|\\s)[A-Za-z0-9_-]*_" + suffix + "(\\s|$)");
			return exact.test(cls);
		}

		// 用 CSS Modules 的 class 后缀找宿主区块：不写死构建哈希（wtg9ga 之类会随版本变）
		function findTarget(section) {
			const loose = document.querySelectorAll('[class*="_' + section.suffix + '"]');
			for (const el of loose) {
				if (!classMatches(el, section.suffix)) continue;
				if (section.parentSuffix !== null) {
					const parent = el.parentNode;
					if (!parent || !classMatches(parent, section.parentSuffix)) continue;
				}
				return el;
			}
			return null;
		}

		function makeHeader(section, onToggle) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "dsh-sc-h";
			btn.dataset.dshScKey = section.key;
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
				onToggle(section.key);
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

			// 让折叠条紧贴在各自区块前面；宿主重渲染掉了就补回来
			const sync = () => {
				for (const section of SECTIONS) {
					const target = findTarget(section);
					if (!target || !target.parentNode) continue;
					const parent = target.parentNode;
					let header = null;
					for (const child of parent.children) {
						if (child.classList && child.classList.contains("dsh-sc-h") && child.dataset.dshScKey === section.key) {
							header = child;
							break;
						}
					}
					if (!header) {
						header = makeHeader(section, toggle);
						parent.insertBefore(header, target);
					} else if (header.nextElementSibling !== target) {
						parent.insertBefore(header, target);
					}
				}
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
				const anchor = document.querySelector('[class*="_panelList"]');
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
