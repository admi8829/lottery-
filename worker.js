import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    // 1. ቦቱን በ Environment Variable መጥራት
    const bot = new Telegraf(env.BOT_TOKEN);

    // --- Keyboards ---
    const requestPhoneKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📲 ስልክ ቁጥር አጋራ')]
    ]).resize();

    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    // --- Middleware: ተጠቃሚው በ DB ውስጥ መኖሩን ማረጋገጫ ---
    // ይህ ተጠቃሚው ስልኩን ሳይልክ ሌላ በተኖችን ቢነካ መልስ እንዳይሰጥ ያደርጋል
    const checkUser = async (userId) => {
      const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
        .bind(userId)
        .first();
      return !!user;
    };

    // --- Command Handlers ---
    bot.start(async (ctx) => {
      const isRegistered = await checkUser(ctx.from.id);
      if (isRegistered) {
        return ctx.reply(`እንኳን ደህና መጡ ${ctx.from.first_name}! ምን ላግዝዎት?`, mainKeyboard);
      } else {
        return ctx.reply(
          `ሰላም ${ctx.from.first_name} 👋! ወደ ዕጣ ማውጫ ቦት እንኳን በደህና መጡ። ለመቀጠል እባክዎ ስልክ ቁጥርዎን ያጋሩ።`,
          requestPhoneKeyboard
        );
      }
    });

    // --- Contact Handler (ስልክ ቁጥር መቀበያ) ---
    bot.on('contact', async (ctx) => {
      const userId = ctx.from.id;
      const firstName = ctx.from.first_name;
      const phoneNumber = ctx.contact.phone_number;

      try {
        // D1 Database ላይ መመዝገብ
        await env.DB.prepare(
          "INSERT OR REPLACE INTO users (id, name, phone) VALUES (?, ?, ?)"
        ).bind(userId, firstName, phoneNumber).run();

        return ctx.reply("በአግባቡ ተመዝግበዋል! አሁን መጠቀም ይችላሉ።", mainKeyboard);
      } catch (e) {
        console.error("DB Error:", e.message);
        return ctx.reply("ይቅርታ፣ መረጃዎን መመዝገብ አልቻልንም። እባክዎ በ Dashboard ላይ 'DB' Binding መኖሩን ያረጋግጡ።");
      }
    });

    // --- Button Actions ---
    bot.hears('🎟 አዲስ ticket ለመቁረጥ', async (ctx) => {
      if (!(await checkUser(ctx.from.id))) return ctx.reply("እባክዎ መጀመሪያ ስልክዎን ያጋሩ", requestPhoneKeyboard);
      ctx.reply('ቲኬት የመቁረጥ ሂደት በቅርብ ቀን ይጀምራል...');
    });

    bot.hears('🌐 Language', (ctx) => {
      ctx.reply('ቋንቋ ይምረጡ / Choose Language:', 
        Markup.inlineKeyboard([
          [Markup.button.callback('አማርኛ', 'lang_am'), Markup.button.callback('English', 'lang_en')]
        ])
      );
    });

    bot.hears('❓ Help', (ctx) => {
      ctx.reply('ማንኛውም ጥያቄ ካለዎት @Admin ያነጋግሩ።');
    });

    bot.hears('👤 My Info', async (ctx) => {
      const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(ctx.from.id).first();
      if (user) {
        ctx.reply(`👤 መረጃዎ፡\n\nስም፡ ${user.name}\nስልክ፡ ${user.phone}\nID: ${user.id}`);
      } else {
        ctx.reply("መረጃዎ አልተገኘም። እባክዎ /start ብለው ስልክዎን ያጋሩ።");
      }
    });

    bot.hears('🔗 Invite Friends', (ctx) => {
      ctx.reply(`ለጓደኞችዎ ያጋሩ፡ https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`);
    });

    // --- Webhook Logic ---
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK', { status: 200 });
      } catch (err) {
        return new Response('Error: ' + err.message, { status: 500 });
      }
    }

    return new Response('Bot is running!', { status: 200 });
  },
};
          
