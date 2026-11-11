# Formation Studio

ダンスやステージパフォーマンス向けの、フォーメーション設計・3D照明演出・音楽同期タイムラインを1つにまとめたスタジオアプリです。

## 主な機能

- **2Dフォーメーション編集**: ステージ上でのメンバー配置、移動経路の表示、反転、複数人のコピー＆ペースト
- **3Dステージ＆照明シミュレーション**: Three.jsによるリアルタイム3Dプレビュー、パン・チルトの動き（位相差・ミラー・反転対応）、ゴボ（Robe Pointe R-Gobo / S-Gobo）、ストロボ（BPM連動・各種波形）の演出設定
- **音源同期タイムライン**: 音声波形を確認しながら0.01秒単位でフォーメーションや照明プリセットのキューを配置・再生
- **キューシート・Excel出力**: タイムラインのキューシート表示、ダンサーの出演状況をまとめたExcel（`.xlsx`）出力
- **Web / デスクトップ両対応**: ブラウザアプリとしてもElectronデスクトップアプリとしても利用可能

## 技術スタック

- React / TypeScript / Vite / Tailwind CSS
- Three.js (`@react-three/fiber`, `@react-three/drei`)
- Zustand
- Electron

## セットアップと起動方法

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. Web版として起動（開発サーバー）

```bash
npm run dev
```

### 3. Electronデスクトップアプリとして起動

```bash
npm run electron:dev
```

### 4. 本番ビルド

```bash
npm run build
```
