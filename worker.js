// አሁን package.json ስላለህ በቀጥታ ስሙን ብቻ ጥራ
import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    // BOT_TOKEN በ Dashboard Variables ላይ መኖሩን አረጋግጥ
    const botToken = env.BOT_TOKEN || "7797852298:AAEeBpccwh6SW6zLP_Jo0qX_b0AywdhTyNQ";
    const bot = new Telegraf(botToken);

    // Buttons
    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    // Start Command
    bot.start((ctx) => {
      return ctx.reply(
        `ሰላም ${ctx.from.first_name} 👋! እንኳን ወደ ሎተሪ ቦት በደህና መጡ።`,
        mainKeyboard
      );
    });

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
                        
