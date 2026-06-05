export function StatusPill({ attentionCount }: { attentionCount: number }) {
  if (attentionCount === 0) {
    return (
      <div className="status-pill ok">
        <span className="dot pulse" />
        All agents working. Nothing needs you.
      </div>
    );
  }
  const msg = `${attentionCount} ${attentionCount === 1 ? 'item needs' : 'items need'} your attention`;
  return (
    <div className="status-pill attn">
      <span className="dot" />
      {msg}
    </div>
  );
}
