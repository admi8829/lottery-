import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN) return new Response("BOT_TOKEN missing");
    
    const bot = new Telegraf(env.BOT_TOKEN);

    // Buttons
    const mainKeyboard = Markup.keyboard([['🎟 አዲስ ticket ለመቁረጥ'], ['👤 My Info', '❓ Help']]).resize();
    const requestPhoneKeyboard = Markup.keyboard([[Markup.button.contactRequest('📲 ስልክ ቁጥሬን ላክ')]]).resize();

    // Start Command
    bot.start(async (ctx) => {
      try {
        // መጀመሪያ ዳታቤዙን ቼክ እናድርግ
        const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();
        
        if (user) {
          return ctx.reply(`እንኳን ደህና መጡ ${user.name}!`, mainKeyboard);
        } else {
          return ctx.reply("እንኳን ደህና መጡ! ለመመዝገብ ስልክዎን ይላኩ።", requestPhoneKeyboard);
        }
      } catch (e) {
        // ዳታቤዙ ከሌለ እዚህ ጋር ይነግረናል
        return ctx.reply("የዳታቤዝ ስህተት፡ " + e.message + "\n(ምናልባት Table አልተፈጠረም)");
      }
    });

    // ስልክ ሲላክ
    bot.on('contact', async (ctx) => {
  try {
    // መጀመሪያ contact መኖሩን እናረጋግጥ
    if (!ctx.message || !ctx.message.contact) {
      return ctx.reply("እባክዎ ስልክ ቁጥርዎን ለመላክ '📲 ስልክ ቁጥሬን ላክ' የሚለውን አዝራር ይጠቀሙ።");
    }

    const { id, first_name } = ctx.from;
    const phone = ctx.message.contact.phone_number; // እዚህ ጋር 'message.contact' ማለታችንን እርግጠኛ እንሁን

    await env.DB.prepare("INSERT OR REPLACE INTO users (user_id, phone, name) VALUES (?, ?, ?)")
      .bind(id, phone, first_name)
      .run();

    return ctx.reply("ምዝገባው ተሳክቷል! ✅", mainKeyboard);
  } catch (e) {
    console.error("Database error:", e.message);
    return ctx.reply("መመዝገብ አልተቻለም፡ " + e.message);
  }
});
      

    // የዌብሁክ ሎጂክ
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK');
      } catch (err) {
        return new Response('Error');
      }
    }
    return new Response('Bot is Online!');
  }
};
      
