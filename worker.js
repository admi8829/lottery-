import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // BOT_TOKEN በ Cloudflare Dashboard ወይም wrangler.toml ላይ መገኘት አለበት
    const bot = new Telegraf(env.BOT_TOKEN);

        // --- Keyboard Layout (ይህ ለበኋላ እንዲሆን ከላይ ይቆይ) ---
    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    // 1. መጀመሪያ /start ሲባል ስልክ እንዲያጋራ መጠየቂያ
    bot.start(async (ctx) => {
      return ctx.reply(
        `ሰላም ${ctx.from.first_name} 👋! ወደ ዕጣ ማውጫ ቦት እንኳን በደህና መጡ። ለመቀጠል እባክዎ ስልክ ቁጥርዎን ያጋሩ።`,
        Markup.keyboard([
          [Markup.button.contactRequest('📲 ስልክ ቁጥር አጋራ')]
        ]).resize().oneTime()
      );
    });

    // 2. ተጠቃሚው ስልኩን ሲልክ DB ላይ መመዝገብና ዋናውን ሜኑ መክፈት
    bot.on('contact', async (ctx) => {
      const userId = ctx.from.id;
      const firstName = ctx.from.first_name;
      const phoneNumber = ctx.contact.phone_number;

      try {
        // D1 Database ላይ መመዝገቢያ (ከዚህ በፊት ዳታቤዙን dashboard ላይ connect ማድረጋችንን አንርሳ)
        await env.DB.prepare(
          "INSERT OR REPLACE INTO users (id, name, phone) VALUES (?, ?, ?)"
        ).bind(userId, firstName, phoneNumber).run();

        // ምዝገባው ሲሳካ ወደ ዋናው ሜኑ ይለወጣል
        return ctx.reply(
          "በአግባቡ ተመዝግበዋል! አሁን መጠቀም ይችላሉ።",
          mainKeyboard
        );
      } catch (e) {
        console.error("DB Error:", e.message);
        return ctx.reply("ይቅርታ፣ መረጃዎን መመዝገብ አልቻልንም። እባክዎ ትንሽ ቆይተው ይሞክሩ።");
      }
    });
      
    
    // Webhook handling logic
    try {
      const body = await request.json();
      await bot.handleUpdate(body);
      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('Error handling update:', err);
      return new Response('Error', { status: 500 });
    }
  },
};

