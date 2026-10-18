# Superposition Editor

一个可以运行的交互系统原型：**保持对象的行为未决，继续编辑这个对象，最后再选择结局。**

## 启动

需要 Node.js 22.6+ 和 npm。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，通常为 http://127.0.0.1:5173/。

```sh
npm test       # 核心状态、引用与模拟测试
npm run build # TypeScript 检查与生产构建
```

## 建议先试这条路径

1. 保持 Bounce、Slide、Shatter 三种行为启用；按空格播放或拖动底部时间轴。
2. 打开 **Follow object**，修改 **Caption**，打开 **Spin intact**。这些编辑只有一份，三个行为共享。
3. 在 **Center / Largest piece** 之间切换。物体碎裂后，逻辑引用会指向碎片群的面积加权中心，或最大的碎片。完整物体上的这两种引用一致。
4. 观察 Spin intact 的 **2/3** 标记：操作需要完整物体，所以碎裂分支明确跳过它。操作仍然保存在共享编辑中。
5. 点击 **Resolve branch → Shatter → Resolve to Shatter**。字幕和相机引用保留，旋转标记变成 **0/1**。
6. 点击 **Reopen possibilities** 或撤销，重新看到所有未来。窄屏下，可以通过顶部 Resolved 按钮打开对话框，再选择 Reopen possibilities。

主画布中的十字 **shared origin** 可以拖动，三个未来共同更新。聚焦该控制后也可以用方向键调整，Shift + 方向键大幅调整。一次拖动只产生一个撤销步骤。

上方三个预览可点击以单独查看分支；**Compare** 并排显示。**Impact strength** 会改变运动和各分支的停止时间；字幕由每个分支自己的停止事件触发。

快捷键：Space 播放/暂停，R 重播，⌘/Ctrl Z 撤销，⌘/Ctrl Shift Z 重做，? 查看交互说明。文本输入期间保留原生输入行为。

场景自动保存在当前浏览器的 localStorage 中。顶部下载按钮导出真实场景 JSON；圆形重置按钮恢复初始场景，重置本身可以撤销。JSON 导入暂未提供。字体已随项目打包，应用运行不依赖外部 API、账号或模型服务。

## 系统模型

```text
EditorDocument
 ├─ object-01                  稳定的逻辑对象 ID
 ├─ enabled / resolved         可能性集合与最终选择
 ├─ origin / impact            所有分支共用的输入
 └─ SharedEdits                相机、轨迹、字幕、旋转、缩放
           │
           ├─ evaluateBranch(bounce, t) → 1 body
           ├─ evaluateBranch(slide, t)  → 1 body
           └─ evaluateBranch(shatter,t) → 7 stable fragment IDs
                     │
                     └─ reference resolution → centroid / largest fragment
```

- `src/engine.ts`：确定性的按时间求值器、停止事件、引用解析、分支适用性与存储数据校验。
- `src/useEditor.ts`：共享文档、撤销/重做、拖动事务、播放时钟与本地保存。
- `src/components/Stage.tsx`：SVG 动画、轨迹、相机跟随、起点拖动与对比视图。
- `src/components/Timeline.tsx`：每个分支的撞击/停止事件、字幕区间和统一播放头。
- `src/components/Inspector.tsx`：共享编辑与适用范围。
- `src/components/Dialogs.tsx`：确定行为与中文实验指引。
- `design/`：ImageGen 界面参考与实现 brief。几何物体是原生 SVG 模拟元素。

确定行为只改变 `resolved`，不复制、不清空共享编辑。片段身份由父逻辑 ID 派生；引用规则在求值时解析。模拟采用简化的解析运动模型，便于稳定重放和测试。

## 这一版的边界

这是用于判断交互是否值得深入的机制原型。支持一个逻辑对象、三个预设行为，以及有限的共享操作；它**尚不是**通用的未决状态编辑器。

尚未实现：多个对象和多个未决决策的组合、任意行为图、用户自定义操作、自动推断跨结构引用、符号状态合并、共享计算子图或视频导出。轨迹、适用性和引用规则目前均为显式实现，未使用 LLM 模拟推断能力。

下一步最值得验证：对碎裂后结构不同的对象，用户是否能理解并继续使用同一个引用；以及在增加第二个未决决策后，如何让编辑与引用自然组合。
