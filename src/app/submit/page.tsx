import { submitPost } from "./actions";

export default function SubmitPage() {
  return (
    <>
      <h1 className="page-title">手动提交一条帖子</h1>
      <p className="page-sub">人工提交兜底——自动抓取覆盖不到时，手动把博主的一条帖子录入。</p>

      <form className="form" action={submitPost}>
        <div>
          <label>博主 handle *</label>
          <input name="handle" placeholder="serenity" required />
        </div>
        <div>
          <label>博主显示名</label>
          <input name="displayName" placeholder="Serenity" />
        </div>
        <div>
          <label>帖子内容 *</label>
          <textarea name="contentText" placeholder="Loading up on $NVDA here. Target 1200." required />
        </div>
        <div>
          <label>原帖链接</label>
          <input name="url" placeholder="https://x.com/..." />
        </div>
        <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>
          提交
        </button>
        <p className="hint">以 platform=manual 录入，提交后出现在信号流里。</p>
      </form>
    </>
  );
}
