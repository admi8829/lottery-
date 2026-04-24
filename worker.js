import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    const botToken = env.BOT_TOKEN;
    const bot = new Telegraf(botToken);

    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    const requestPhoneKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📲 ስልክ ቁጥሬን ላክ')]
    ]).resize();

    bot.start((ctx) => {
      return ctx.reply(
        `ሰላም ${ctx.from.first_name} 👋! ለመቀጠል እባክዎ ስልክ ቁጥርዎን ይላኩ።`,
        requestPhoneKeyboard
      );
    });

    bot.on('contact', async (ctx) => {
      const userId = ctx.from.id;
      const phoneNumber = ctx.contact.phone_number;
      const firstName = ctx.from.first_name;

      try {
        // 1. መረጃውን ለማስገባት መሞከር
        const { success } = await env.DB.prepare(
          "INSERT OR REPLACE INTO users (user_id, phone, name) VALUES (?, ?, ?)"
        ).bind(userId, phoneNumber, firstName).run();

        if (success) {
          return ctx.reply("ምዝገባው ተሳክቷል! ✅ አሁን መጠቀም ይችላሉ።", mainKeyboard);
        } else {
          // INSERT ባይሳካ ግን Error ባይወረውር
          return ctx.reply("ይቅርታ፣ መረጃዎ በዳታቤዝ ውስጥ ሊቀመጥ አልቻለም።");
        }

      } catch (err) {
        // 2. ሰንጠረዡ (Table) ካልተፈጠረ እዚህ ጋር ስህተቱን ይይዘዋል
        console.error("DB Error:", err.message);
        return ctx.reply(`ስህተት ተፈጥሯል፦ ${err.message}\n(ምናልባት Table አልተፈጠረም ይሆናል)`);
      }
    });

    // ሌሎቹ አዝራሮች እዚህ ይቀጥላሉ...
    bot.hears('❓ Help', (ctx) => ctx.reply('አስተዳዳሪውን @Admin ያነጋግሩ።'));

    if (request.method === 'POST') {
      const body = await request.json();
      await bot.handleUpdate(body);
      return new Response('OK');
    }
    return new Response('Bot is Online!');
  }
};
        
