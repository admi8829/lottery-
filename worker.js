export default {
  async fetch(request, env, ctx) {
    // 1. ቦቱን በ Environment Variable መጥራት
    const bot = new Telegraf(env.BOT_TOKEN);

    // --- Keyboards ---
    const requestPhoneKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📲 ስልክ ቁጥር አጋራ')]
    ]).resize().oneTime();

    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    // --- Database Checker Helper ---
    const checkUserInDB = async (userId) => {
      try {
        const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
          .bind(userId)
          .first();
        return !!user;
      } catch (e) {
        return false;
      }
    };

    // --- /start Handler ---
    bot.start(async (ctx) => {
      try {
        const isRegistered = await checkUserInDB(ctx.from.id);
        if (isRegistered) {
          return ctx.reply(`እንኳን ደህና መጡ ${ctx.from.first_name}! ምን ላግዝዎት?`, mainKeyboard);
        } else {
          return ctx.reply(
            `ሰላም ${ctx.from.first_name} 👋! ለመቀጠል  "ስልክ ቁጥር አጋራ" የሚለውን ቁልፍ ይጫኑ።`,
            requestPhoneKeyboard
          );
        }
      } catch (e) {
        return ctx.reply("የመነሻ ስህተት ተፈጥሯል፦ " + e.message);
      }
    });

    // --- Contact Handler (ስልክ ቁጥር ተቀብሎ DB ውስጥ መመዝገቢያ) ---
    bot.on('contact', async (ctx) => {
      const userId = ctx.from.id;
      const firstName = ctx.from.first_name;
      const phoneNumber = ctx.contact.phone_number;

      try {
        // 1. መጀመሪያ ወደ ዳታቤዝ ለመክተት መሞከር
        const result = await env.DB.prepare(
          "INSERT OR REPLACE INTO users (id, name, phone) VALUES (?, ?, ?)"
        ).bind(userId, firstName, phoneNumber).run();

        // 2. በድጋሚ ዳታቤዙን ቼክ እናደርጋለን (መግባቱን ለማረጋገጥ)
        const isSaved = await checkUserInDB(userId);

        if (isSaved) {
          // ምዝገባው ከተረጋገጠ ወደ ዋናው ሜኑ ያሳልፋል
          return ctx.reply(
            "✅ መረጃዎ በአግባቡ ተመዝግቧል! አሁን አገልግሎቶችን መጠቀም ይችላሉ።",
            mainKeyboard
          );
        } else {
          // ዳታቤዙ ውስጥ ካልተገኘ
          throw new Error("መረጃው በዳታቤዝ ውስጥ ሊገኝ አልቻለም (Save Failure)");
        }

      } catch (e) {
        // ስህተት ካለ እዚህ ጋር በግልጽ ይናገራል
        console.error("Critical DB Error:", e.message);
        return ctx.reply(
          `❌ ስህተት አጋጥሟል! መረጃዎ አልተመዘገበም።\nምክንያት፦ ${e.message}\n\nእባክዎ በ Cloudflare Settings -> Bindings ላይ 'DB' የሚባል ስም መሰጠቱን ያረጋግጡ።`
        );
      }
    });

    // --- Button Actions (ከምዝገባ በኋላ የሚሰሩ) ---
    bot.hears('🎟 አዲስ ticket ለመቁረጥ', async (ctx) => {
      if (!(await checkUserInDB(ctx.from.id))) {
        return ctx.reply("እባክዎ መጀመሪያ ስልክዎን ያጋሩ", requestPhoneKeyboard);
      }
      ctx.reply('ቲኬት የመቁረጥ ሂደት በቅርብ ቀን ይጀምራል...');
    });

    bot.hears('👤 My Info', async (ctx) => {
      try {
        const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(ctx.from.id).first();
        if (user) {
          ctx.reply(`👤 መረጃዎ፡\n\nስም፡ ${user.name}\nስልክ፡ ${user.phone}\nID: ${user.id}`);
        } else {
          ctx.reply("መረጃዎ አልተገኘም። እባክዎ ስልክዎን ያጋሩ።", requestPhoneKeyboard);
        }
      } catch (e) {
        ctx.reply("ዳታቤዝ ማንበብ አልተቻለም፦ " + e.message);
      }
    });

    // የተቀሩት በተኖች (Help, Invite)
    bot.hears('❓ Help', (ctx) => ctx.reply('ለእርዳታ @Admin ያነጋግሩ።'));
    bot.hears('🔗 Invite Friends', (ctx) => ctx.reply(`https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`));

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
        
