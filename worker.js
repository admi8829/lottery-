export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      const update = await request.json();
      const botToken = "7797852298:AAEeBpccwh6SW6zLP_Jo0qX_b0AywdhTyNQ";
      const apiUrl = `https://api.telegram.org/bot${botToken}`;

      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;

        // --- /start መልዕክት ---
        if (text === "/start") {
          await fetch(`${apiUrl}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "ሰላም! ለመመዝገብ እባክዎ ስልክዎን ያጋሩ።",
              reply_markup: {
                keyboard: [[{ text: "📲 ስልክ ቁጥር አጋራ", request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true
              }
            })
          });
        }

        // --- ስልክ ቁጥር ሲላክ (Contact) ---
        if (update.message.contact) {
          const phone = update.message.contact.phone_number;
          const name = update.message.from.first_name;

          try {
            await env.DB.prepare("INSERT OR REPLACE INTO users (id, name, phone) VALUES (?, ?, ?)")
              .bind(chatId, name, phone)
              .run();

            await fetch(`${apiUrl}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "✅ በአግባቡ ተመዝግበዋል!",
                reply_markup: {
                  keyboard: [["🎟 አዲስ ticket", "👤 My Info"]],
                  resize_keyboard: true
                }
              })
            });
          } catch (e) {
            // ስህተት ካለ እዚህ ይያዛል
          }
        }
      }
      return new Response("OK");
    }
    return new Response("Bot is active");
  }
};
        
