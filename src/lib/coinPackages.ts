// コイン購入パッケージの唯一の定義（クライアント表示・サーバー検証の両方でこれを使う）。
// price は日本円（JPY）。coins は基本枚数、bonus はおまけ。付与総数は coins + bonus。
export type CoinPackage = {
  id: string;
  coins: number;
  bonus: number;
  price: number; // JPY
  popular?: boolean;
};

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'coin_100',  coins: 100,  bonus: 0,   price: 120 },
  { id: 'coin_500',  coins: 500,  bonus: 50,  price: 480, popular: true },
  { id: 'coin_1000', coins: 1000, bonus: 200, price: 980 },
  { id: 'coin_3000', coins: 3000, bonus: 800, price: 2800 },
];

export function getCoinPackage(id: string): CoinPackage | null {
  return COIN_PACKAGES.find((p) => p.id === id) ?? null;
}

/** 付与総数（基本＋ボーナス）。サーバー側でメタデータを信用せず、この関数で再計算する。 */
export function coinTotal(pkg: CoinPackage): number {
  return pkg.coins + pkg.bonus;
}
