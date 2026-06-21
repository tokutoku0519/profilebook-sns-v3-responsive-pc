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

export function BottomTab({ active, onChange, lang = 'ja' }: { active: TabKey; onChange: (key: TabKey) => void; lang?: Lang }) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-30 rounded-t-[28px] border border-purple-100 bg-white/95 px-4 pt-2 shadow-floating backdrop-blur" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
      <div className="grid grid-cols-5 items-end gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition ${isActive ? 'text-pinkStrong' : 'text-muted'}`}
            >
              <span className={`${item.center ? 'mb-1 grid h-14 w-14 place-items-center rounded-full bg-pink text-white shadow-floating' : isActive ? 'grid h-9 w-12 place-items-center rounded-full bg-pink/15 text-pinkStrong' : 'grid h-9 w-12 place-items-center'}`}>
                <Icon size={item.center ? 26 : 21} />
              </span>
              {!item.center && t(item.labelKey, lang)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
