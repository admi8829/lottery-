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
    bot.start(async (ctx) => {
  return ctx.reply(
    `ሰላም ${ctx.from.first_name} 👋! ለመቀጠል እባክዎ ስልክ ቁጥርዎን ያጋሩ።`,
    Markup.keyboard([
      [Markup.button.contactRequest('📲 ስልክ ቁጥር አጋራ')]
    ]).resize().oneTime()
  );
});
    

    // --- Button Actions ---
    bot.on('contact', async (ctx) => {
  const userId = ctx.from.id;
  const phoneNumber = ctx.contact.phone_number;
  const firstName = ctx.from.first_name;

  try {
    // D1 Database ላይ መመዝገብ (Table ስም 'users' እንደሆነ በማሰብ)
    await env.DB.prepare(
      "INSERT OR REPLACE INTO users (id, name, phone) VALUES (?, ?, ?)"
    ).bind(userId, firstName, phoneNumber).run();

    // ምዝገባው ካለቀ በኋላ ዋናውን ሜኑ አሳይ
    const mainKeyboard = Markup.keyboard([
      ['🎟 አዲስ ticket ለመቁረጥ'],
      ['🌐 Language', '❓ Help'],
      ['👤 My Info', '🔗 Invite Friends']
    ]).resize();

    return ctx.reply("እናመሰግናለን! ስልክዎ ተመዝግቧል። አሁን መጠቀም ይችላሉ።", mainKeyboard);
    
  } catch (e) {
    console.error("DB Error:", e);
    return ctx.reply("ይቅርታ፣ መረጃዎን መመዝገብ አልቻልንም። እባክዎ ቆይተው ይሞክሩ።");
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

