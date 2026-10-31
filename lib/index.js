// dsh-sidebar-sections — host half.
//
// 空实现：这个包只提供浏览器半边（左侧栏折叠条），host 侧不需要任何行为。
// 这个 apply 存在的唯一目的是让条目出现在宿主 cordis / Loader 图里，
// 浏览器半边通过 package.json 的 dsh.client 声明 + exports["./client"] 被发现。
export function apply() {}
