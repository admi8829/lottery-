import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    const botToken = env.BOT_TOKEN;
    const bot = new Telegraf(botToken);

    // 1. ዋናው ሜኑ (ከምዝገባ በኋላ የሚመጣ)
    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    // 2. ስልክ ቁጥር ለመጠየቅ የሚያገለግል አዝራር
    const requestPhoneKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📲 ስልክ ቁጥሬን ላክ')]
    ]).resize();

    // /start ሲባል የሚመጣ
    bot.start(async (ctx) => {
      const firstName = ctx.from.first_name;
      return ctx.reply(
        `ሰላም ${firstName} 👋! ወደ ሎተሪ ቦት እንኳን መጡ።\n\nለመቀጠል እባክዎ "📲 ስልክ ቁጥሬን ላክ" የሚለውን ይጫኑ።`,
        requestPhoneKeyboard
      );
    });

    // ስልክ ቁጥር ሲላክ ወደ DB 1 ለማስገባት
    bot.on('contact', async (ctx) => {
      const userId = ctx.from.id;
      const phoneNumber = ctx.contact.phone_number;
      const firstName = ctx.from.first_name;

      try {
        // ወደ Cloudflare D1 Database ዳታውን ያስገባል
        // ማሳሰቢያ፡ በ dashboard ላይ 'DB' የሚል binding መፍጠር አለብህ
        await env.DB.prepare(
          "INSERT OR IGNORE INTO users (user_id, phone, name) VALUES (?, ?, ?)"
        ).bind(userId, phoneNumber, firstName).run();

        return ctx.reply(
          `ምዝገባው ተሳክቷል! ✅\nአሁን መጠቀም ይችላሉ።`,
          mainKeyboard
        );
      } catch (err) {
        return ctx.reply("ይቅርታ፣ መረጃውን መመዝገብ አልቻልንም። እባክዎ ቆይተው ይሞክሩ።");
      }
    });

    // ሌሎች አዝራሮች
    bot.hears('🎟 አዲስ ticket ለመቁረጥ', (ctx) => ctx.reply('በቅርብ ቀን ይጀምራል...'));
    bot.hears('❓ Help', (ctx) => ctx.reply('አስተዳዳሪውን @Admin ያነጋግሩ።'));
    bot.hears('👤 My Info', (ctx) => ctx.reply(`ስም፡ ${ctx.from.first_name}\nID: ${ctx.from.id}`));

    // Webhook Logic
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK');
      } catch (err) {
        return new Response('Error: ' + err.message);
      }
    }
    return new Response('Bot is Online!');
  }
};
  
