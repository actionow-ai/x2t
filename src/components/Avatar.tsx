// 头像：有 avatarUrl 显示图片，否则用名字首字母字标兜底。
export function AvatarInner({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    // 普通 <img>（非 next/image）可加载任意外域，无需配置 domains
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} />;
  }
  return <>{(name || "?").slice(0, 1).toUpperCase()}</>;
}
