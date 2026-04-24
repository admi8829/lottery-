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
    // 1. Check if contact exists
    if (!ctx.message || !ctx.message.contact) {
      return ctx.reply(
        "<b>⚠️ Error</b>\nPlease use the button <b>'📲 ስልክ ቁጥሬን ላክ'</b> to share your contact.",
        { parse_mode: 'HTML' }
      );
    }

    // 2. Extract data
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name || ""; // Optional
    const fullName = `${firstName} ${lastName}`.trim();
    const phone = ctx.message.contact.phone_number;
    const username = ctx.from.username ? `@${ctx.from.username}` : "<i>Not set</i>";

    // 3. Insert into Database (Updated to include username)
    // Make sure your table has 'username' column
    await env.DB.prepare(
      "INSERT OR REPLACE INTO users (user_id, phone, name, username) VALUES (?, ?, ?, ?)"
    )
    .bind(userId, phone, fullName, ctx.from.username || "N/A")
    .run();

    // 4. Success Message with HTML Styling
    const welcomeMessage = `
<b>Registration Successful! ✅</b>

<b>👤 Profile Information:</b>
━━━━━━━━━━━━━━━━━━
<b>Name:</b> ${fullName}
<b>Phone:</b> <code>${phone}</code>
<b>Username:</b> ${username}
<b>User ID:</b> <code>${userId}</code>
━━━━━━━━━━━━━━━━━━

<i>You can now access all features of the Lottery Bot. Good luck! 🎟</i>`;

    return ctx.reply(welcomeMessage, {
      parse_mode: 'HTML',
      ...mainKeyboard // This brings up your main menu buttons
    });

  } catch (e) {
    console.error("Database error:", e.message);
    return ctx.reply(
      `<b>❌ Registration Failed</b>\nError: <code>${e.message}</code>`,
      { parse_mode: 'HTML' }
    );
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
      
