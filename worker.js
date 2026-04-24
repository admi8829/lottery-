import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // BOT_TOKEN በ Cloudflare Dashboard ወይም wrangler.toml ላይ መገኘት አለበት
    const bot = new Telegraf(env.BOT_TOKEN);

    // --- Keyboard Layout ---
    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    // --- Command Handlers ---
    bot.start((ctx) => {
      return ctx.reply(
        `ሰላም ${ctx.from.first_name} 👋! ወደ ዕጣ ማውጫ ቦት እንኳን በደህና መጡ።`,
        mainKeyboard
      );
    });

    // --- Button Actions ---
    bot.hears('🎟 አዲስ ticket ለመቁረጥ', (ctx) => {
      ctx.reply('እባክዎ የቲኬት መግዣ መረጃዎችን ይሙሉ...');
    });

    bot.hears('🌐 Language', (ctx) => {
      ctx.reply('እባክዎ ቋንቋ ይምረጡ / Please choose your language:', 
        Markup.inlineKeyboard([
          [Markup.button.callback('አማርኛ', 'lang_am'), Markup.button.callback('English', 'lang_en')]
        ])
      );
    });

    bot.hears('❓ Help', (ctx) => {
      ctx.reply('ይህ ቦት ዕጣዎችን ለመቁረጥና ውጤት ለማየት ይረዳዎታል። ማንኛውም ጥያቄ ካለዎት @Admin ን ያነጋግሩ።');
    });

    bot.hears('👤 My Info', (ctx) => {
      ctx.reply(`የእርስዎ መረጃ:\n🆔 ID: ${ctx.from.id}\n👤 ስም: ${ctx.from.first_name}`);
    });

    bot.hears('🔗 Invite Friends', (ctx) => {
      const inviteLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
      ctx.reply(`ይህንን ሊንክ ለጓደኞችዎ በመላክ ይጋብዙ:\n${inviteLink}`);
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

