// Telegrafን በቀጥታ ከኢንተርኔት (esm.sh) እናመጣዋለን - ይህ Build Errorን ያስቀራል
import { Telegraf, Markup } from 'https://esm.sh/telegraf@4.16.3';

export default {
  async fetch(request, env, ctx) {
    // BOT_TOKENን ከ Dashboard Variables ላይ ያነባል። 
    // ከሌለ እዚህ ጋር በቀጥታ ቶከኑን መተካት ትችላለህ።
    const botToken = env.BOT_TOKEN || "7797852298:AAEeBpccwh6SW6zLP_Jo0qX_b0AywdhTyNQ";
    const bot = new Telegraf(botToken);

    // ዋናው ሜኑ (Buttons)
    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    // --- Start Command ---
    bot.start((ctx) => {
      return ctx.reply(
        `ሰላም ${ctx.from.first_name} 👋! እንኳን ወደ ሎተሪ ቦት በደህና መጡ። ከታች ያሉትን ምርጫዎች ይጠቀሙ።`,
        mainKeyboard
      );
    });

    // --- Button Actions ---
    bot.hears('🎟 አዲስ ticket ለመቁረጥ', (ctx) => {
      return ctx.reply('🎟 የቲኬት ሽያጭ በቅርብ ቀን ይጀምራል! እባክዎ በትዕግስት ይጠብቁ።');
    });

    bot.hears('❓ Help', (ctx) => {
      return ctx.reply('እርዳታ ለማግኘት አስተዳዳሪውን @Admin ያነጋግሩ።');
    });

    bot.hears('👤 My Info', (ctx) => {
      return ctx.reply(`የእርስዎ መረጃ፡\n👤 ስም፡ ${ctx.from.first_name}\n🆔 ID: ${ctx.from.id}`);
    });

    bot.hears('🔗 Invite Friends', (ctx) => {
      return ctx.reply('ጓደኞችዎን ለመጋበዝ ይህንን ሊንክ ይላኩላቸው፡ https://t.me/your_bot_username');
    });

    // --- Webhook Handling ---
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK');
      } catch (err) {
        return new Response('Error: ' + err.message);
      }
    }

    return new Response('Bot is running online!');
  }
};
          
