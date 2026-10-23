import { Bell, Home, Plus, Search, UserRound } from 'lucide-react';
import { t, type Lang } from '@/lib/i18n';

export type TabKey = 'home' | 'search' | 'create' | 'notifications' | 'mypage';

const items: { key: TabKey; labelKey: string; icon: any; center?: boolean }[] = [
  { key: 'home', labelKey: 'tab_home', icon: Home },
  { key: 'search', labelKey: 'tab_search', icon: Search },
  { key: 'create', labelKey: 'tab_create', icon: Plus, center: true },
  { key: 'notifications', labelKey: 'tab_notifications', icon: Bell },
  { key: 'mypage', labelKey: 'tab_mypage', icon: UserRound }
];

// スマホ下部ナビ：ノートの「インデックス（見出しタブ）」をモチーフにしたMiri独自のナビ。
// ・上辺はミシン目（点線）で、紙のノートの下端に見立てる
// ・選択中は白い紙タブが少し持ち上がり、上辺に色付きの見出し帯が付く
// ・中央「つくる」はスタンプ風の丸ボタン
// タップ領域（各列 52px 以上）・セーフエリア・5項目は従来どおり維持。
export function BottomTab({ active, onChange, lang = 'ja', unread = 0, themeGradient }: { active: TabKey; onChange: (key: TabKey) => void; lang?: Lang; unread?: number; themeGradient?: string }) {
  // ガチャ背景を装備中は、その背景グラデーションでタブバーも色合わせ
  const navBg = themeGradient ? `bg-gradient-to-t ${themeGradient}` : 'bg-[#FFFCF5]/95';
  return (
    <nav
      aria-label="メインメニュー"
      className={`absolute bottom-0 left-0 right-0 z-30 rounded-t-[22px] px-3 pt-2 shadow-[0_-6px_18px_rgba(156,125,173,.16)] backdrop-blur ${navBg}`}
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      {/* ノートのミシン目（装飾。クリックを妨げない） */}
      <div aria-hidden className="pointer-events-none absolute inset-x-5 top-1.5 border-t-2 border-dashed border-pink/35" />
      <div className="relative grid grid-cols-5 items-end gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          const label = t(item.labelKey, lang);
          if (item.center) {
            return (
              <button
                key={item.key}
                onClick={() => onChange(item.key)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className="flex min-h-[56px] flex-col items-center justify-end"
              >
                <span className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-pink text-white shadow-floating ring-4 ring-[#FFFCF5]">
                  <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-dashed border-white/70">
                    <Icon size={24} />
                  </span>
                </span>
                <span className="mt-0.5 text-[10px] font-black text-pinkStrong">{label}</span>
              </button>
            );
          }
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-t-xl px-1 pb-1 pt-2 text-[11px] font-black transition ${
                isActive
                  ? '-translate-y-1 bg-white text-ink shadow-[0_-2px_8px_rgba(0,0,0,.08)]'
                  : 'text-muted'
              }`}
            >
              {/* 見出しタブの色帯（選択中のみ） */}
              {isActive && <span aria-hidden className="absolute inset-x-2 top-0 h-1 rounded-b-full bg-pink" />}
              <span className="relative">
                <Icon size={21} className={isActive ? 'text-pink' : ''} />
                {item.key === 'notifications' && unread > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-pink px-1 text-[9px] font-black text-white">{unread > 9 ? '9+' : unread}</span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
