# LINE Bot Reservation System (Render.com版)

LINEチャットボットを使った予約管理システム

## デプロイ方法

### 1. Render.comの設定

1. このリポジトリをGitHubにプッシュ
2. Render.comでWebサービスを作成
3. 環境変数を設定:
   - `LINE_CHANNEL_ACCESS_TOKEN` - LINE Developersから取得
   - `LINE_CHANNEL_SECRET` - LINE Developersから取得
   - `DATABASE_URL` - 自動設定される

### 2. LINE Developersの設定

1. Webhook URLを設定: `https://your-app.onrender.com/webhook`
2. 応答メッセージを無効化
3. Webhookを有効化

## 機能

- 予約の作成・変更・キャンセル
- 前日リマインド通知
- FAQ自動応答
- 営業時間案内

## 技術スタック

- Node.js 18+
- TypeScript
- Fastify
- PostgreSQL
- LINE Messaging API