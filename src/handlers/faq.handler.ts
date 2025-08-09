export class FAQHandler {
  async handleFAQ(message: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('営業時間') || lowerMessage.includes('何時')) {
      return '営業時間は11:00-22:00です（ラストオーダー21:00）\n定休日：毎週火曜日';
    }

    if (lowerMessage.includes('場所') || lowerMessage.includes('アクセス') || lowerMessage.includes('どこ')) {
      return '📍 住所：東京都渋谷区〇〇1-2-3\n🚃 アクセス：JR渋谷駅より徒歩5分\n詳しいアクセス情報は以下をご確認ください：\nhttps://example.com/access';
    }

    if (lowerMessage.includes('メニュー') || lowerMessage.includes('料理')) {
      return '🍽️ メニューはこちらからご確認いただけます：\nhttps://example.com/menu\n\n人気メニュー：\n• 特選ステーキ\n• 季節のパスタ\n• 自家製デザート';
    }

    if (lowerMessage.includes('キャンセル') || lowerMessage.includes('取消')) {
      return '📋 キャンセルポリシー：\n• 当日キャンセル：料金の50%\n• 無断キャンセル：料金の100%\n\nキャンセルをご希望の場合は、予約変更メニューからお手続きください。';
    }

    if (lowerMessage.includes('電話') || lowerMessage.includes('連絡')) {
      return '📞 お電話でのお問い合わせ：\n03-1234-5678\n受付時間：10:00-21:00';
    }

    return null;
  }
}

export const faqHandler = new FAQHandler();