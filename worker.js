import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    const botToken = env.BOT_TOKEN;
    const bot = new Telegraf(botToken);

    // 1. ዋናው ሜኑ
    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    // 2. ስልክ ቁጥር መጠየቂያ
    const requestPhoneKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📲 ስልክ ቁጥሬን ላክ')]
    ]).resize();

    // /start ትዕዛዝ ሲመጣ
    bot.start(async (ctx) => {
      const userId = ctx.from.id;

      try {
        // ዳታቤዝ ውስጥ ተጠቃሚው መኖሩን ቼክ ማድረግ
        const user = await env.DB.prepare(
          "SELECT * FROM users WHERE user_id = ?"
        ).bind(userId).first();

        if (user) {
          // ተጠቃሚው ቀድሞ ከተመዘገበ በቀጥታ ሜኑውን አሳይ
          return ctx.reply(
            `እንኳን ደህና መጡ ${user.name}! ምን ልርዳዎት?`,
            mainKeyboard
          );
        } else {
          // ተጠቃሚው አዲስ ከሆነ ስልክ እንዲልክ ጠይቅ
          return ctx.reply(
            `ሰላም ${ctx.from.first_name} 👋! ወደ ሎተሪ ቦት እንኳን መጡ። ለመቀጠል እባክዎ ስልክ ቁጥርዎን ያጋሩ።`,
            requestPhoneKeyboard
          );
        }
      } catch (err) {
        return ctx.reply("የዳታቤዝ ስህተት አጋጥሟል። እባክዎ Table መፈጠሩን ያረጋግጡ።");
      }
    });

    // ስልክ ቁጥር ሲላክ የሚሰራ
    bot.on('contact', async (ctx) => {
      const userId = ctx.from.id;
      const phoneNumber = ctx.contact.phone_number;
      const firstName = ctx.from.first_name;

      try {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO users (user_id, phone, name) VALUES (?, ?, ?)"
        ).bind(userId, phoneNumber, firstName).run();

        return ctx.reply("ምዝገባው ተሳክቷል! ✅", mainKeyboard);
      } catch (err) {
        return ctx.reply("መረጃውን መመዝገብ አልተቻለም።");
      }
    });

    // ሌሎች አዝራሮች ምላሽ
    bot.hears('🎟 አዲስ ticket ለመቁረጥ', (ctx) => ctx.reply('በቅርብ ቀን ይጀምራል...'));
    bot.hears('👤 My Info', async (ctx) => {
        const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();
        if(user) {
            ctx.reply(`👤 ስም፡ ${user.name}\n📞 ስልክ፡ ${user.phone}\n🆔 ID: ${user.user_id}`);
        } else {
            ctx.reply("መረጃዎ አልተገኘም። እባክዎ መጀመሪያ ይመዝገቡ።");
        }
    });

    if (request.method === 'POST') {
      const body = await request.json();
      await bot.handleUpdate(body);
      return new Response('OK');
    }
    return new Response('Bot is Online!');
  }
};
      
