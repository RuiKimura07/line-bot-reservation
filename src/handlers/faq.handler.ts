export class FAQHandler {
  async handleFAQ(message: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('営業時間') || lowerMessage.includes('何時')) {
      return '営業時間は11:00-22:00です（ラストオーダー21:00）\n定休日：毎週火曜日';
    }

    if (lowerMessage.includes('場所') || lowerMessage.includes('アクセス') || lowerMessage.includes('どこ')) {
      return '📍 住所：[実際の住所を入力]\n🚃 アクセス：[実際のアクセス方法]\n詳しいアクセス情報：[実際のURL]';
    }

    if (lowerMessage.includes('メニュー') || lowerMessage.includes('料理')) {
      return '🍽️ メニューはこちらからご確認いただけます：\n[実際のメニューURL]\n\n人気メニュー：\n• [実際のメニュー1]\n• [実際のメニュー2]\n• [実際のメニュー3]';
    }

    if (lowerMessage.includes('キャンセル') || lowerMessage.includes('取消')) {
      return '📋 キャンセルポリシー：\n• 当日キャンセル：料金の50%\n• 無断キャンセル：料金の100%\n\nキャンセルをご希望の場合は、予約変更メニューからお手続きください。';
    }

    if (lowerMessage.includes('電話') || lowerMessage.includes('連絡')) {
      return '📞 お電話でのお問い合わせ：\n[実際の電話番号]\n受付時間：[実際の受付時間]';
    }

    return null;
  }
}

export const faqHandler = new FAQHandler();