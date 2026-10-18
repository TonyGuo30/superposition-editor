import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="help-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="help-title"
    >
      <div className="dialog-heading">
        <h2 id="help-title">Build before you decide.</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close help">
          <X size={18} />
        </button>
      </div>
      <p>
        Superposition 是一个可以带着未决选择继续工作的交互编辑器。New
        可从单个对象的空白场景开始，重置按钮可加载示例。每个世界是一组选择的完整组合，所有世界共享同一份对象与关系定义。
      </p>
      <ol>
        <li>
          <strong>保留多个选择。</strong>在右侧为对象勾选多个 On impact 或 Release
          delay。两个维度可以同时未定；添加对象也不需要先决定其他对象。
        </li>
        <li>
          <strong>继续连接对象。</strong>Add link 选择 source、target、触发事件和动作。Follow
          跨碎裂保持对象引用，Launch 在各世界对应事件后启动，Push 施加推力，Pulse 高亮。
        </li>
        <li>
          <strong>只预览，不做决定。</strong>下面的选项按钮是可组合的预览筛选。Worlds 表里的 Preview
          可单独查看完整组合；Events 显示该世界的因果时间。
        </li>
        <li>
          <strong>逐个决定。</strong>选项旁的锁只确定这一项。Keep world 确定整个组合，Reopen
          可以恢复备选，编辑与关系都会保留。Undo / Redo 也支持这些操作。
        </li>
      </ol>
      <div className="help-boundaries">
        <strong>运行范围</strong>
        <p>
          最多 10 个对象、24 条关系、128 个精确世界。时间窗口 10 秒，固定 60 Hz
          积分。关系是有向无环图；事件只触发一次。接触按包围圆检测，对象默认不互相弹开；需要时添加
          Push。静止事件取第一次静止。多个 Launch 取最先发生的一次。未发生的事件会在 Events 中解释。
        </p>
        <p>
          JSON 自动保存在本机。Import / Export
          可保存完整的未决场景，也支持旧版文件。没有后端或模型调用。
        </p>
      </div>
      <div className="help-shortcuts">
        <span>Space 播放</span>
        <span>R 重播</span>
        <span>⌘/Ctrl Z 撤销</span>
        <span>方向键移动 origin</span>
      </div>
    </dialog>
  );
}
