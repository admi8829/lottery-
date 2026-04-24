import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN) return new Response("BOT_TOKEN missing");
    
    const bot = new Telegraf(env.BOT_TOKEN);

// 1. ዋናው ሜኑ (Main Menu) - Updated
const mainKeyboard = Markup.keyboard([
  ['🎟 New Ticket'],                          // ትልቅ አዝራር
  ['👤 My Info', '⚙️ Settings'],             // መረጃ እና ሴቲንግ
  ['🏆 Winners', '💰 Wallet'],               // አሸናፊዎች እና የገንዘብ ቦርሳ (አዲሱ)
  ['🔗 Invite', '❓ Help']                   // ግብዣ እና እርዳታ
]).resize();

// 2. ስልክ ቁጥር መጠየቂያ
const requestPhoneKeyboard = Markup.keyboard([
  [Markup.button.contactRequest('📲 ስልክ ቁጥሬን ላክ')]
]).resize();
    
    
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
    if (!ctx.message || !ctx.message.contact) {
      return ctx.reply("<b>⚠️ Error</b>\nPlease use the button to share your contact.", { parse_mode: 'HTML' });
    }

    const userId = ctx.from.id;
    const fullName = `${ctx.from.first_name} ${ctx.from.last_name || ""}`.trim();
    const phone = ctx.message.contact.phone_number;
    const username = ctx.from.username || "N/A";

    // 1. Save to Database
    await env.DB.prepare(
      "INSERT OR REPLACE INTO users (user_id, phone, name, username) VALUES (?, ?, ?, ?)"
    ).bind(userId, phone, fullName, username).run();

    // 2. Channel Join Buttons
    const channelLink = "https://t.me/SmartX_Ethio"; // እዚህ ጋር የቻናልህን ሊንክ አስገባ
    const joinKeyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 Join Our Channel', channelLink)],
      [Markup.button.callback('✅ Joined - Continue', 'check_join')]
    ]);

    // 3. Success & Prompt to Join
    const welcomeMessage = `
<b>Registration Successful! ✅</b>
━━━━━━━━━━━━━━━━━━
<b>Welcome, ${fullName}!</b>
To complete your access and start using the bot, please <b>Join our Official Channel</b> below.
━━━━━━━━━━━━━━━━━━`;

    return ctx.reply(welcomeMessage, {
      parse_mode: 'HTML',
      ...joinKeyboard
    });

  } catch (e) {
    return ctx.reply(`<b>❌ Error:</b> <code>${e.message}</code>`, { parse_mode: 'HTML' });
  }
});

bot.hears('⚙️ Settings', async (ctx) => {
  const userId = ctx.from.id;
  
  // ከዳታቤዝ የተጠቃሚውን ቋንቋ ማግኘት
  const user = await env.DB.prepare("SELECT language FROM users WHERE user_id = ?").bind(userId).first();
  const currentLang = user ? user.language : 'Amharic';

  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`🌐 Language: ${currentLang}`, 'show_languages')],
    [Markup.button.callback('💳 Payment Methods', 'show_payments')],
    [Markup.button.callback('👤 Update Profile', 'update_profile')],
    [Markup.button.callback('❌ Delete My Account', 'confirm_delete')]
  ]);

  return ctx.reply(`<b>⚙️ Settings Menu</b>\n\nYour current language is set to: <b>${currentLang}</b>\nSelect an option to customize your experience:`, {
    parse_mode: 'HTML',
    ...settingsKeyboard
  });
});
    

  bot.action('check_join', async (ctx) => {
  const channelId = "@SmartX_Ethio"; // የቻናልህ Username (@ ምልክት እንዳይረሳ)
  const userId = ctx.from.id;

  try {
    const member = await ctx.telegram.getChatMember(channelId, userId);
    
    // መቀላቀሉን ማረጋገጫ (status 'member', 'administrator', ወይም 'creator' ከሆነ)
    if (['member', 'administrator', 'creator'].includes(member.status)) {
      await ctx.answerCbQuery("Thank you for joining! 🎉");
      await ctx.deleteMessage(); // የ join መልዕክቱን ለማጥፋት
      return ctx.reply(
        "<b>Verification Complete! 🔓</b>\nYou now have full access to the bot.",
        { parse_mode: 'HTML', ...mainKeyboard }
      );
    } else {
      await ctx.answerCbQuery("❌ You haven't joined the channel yet!", { show_alert: true });
    }
  } catch (e) {
    await ctx.answerCbQuery("Error verifying membership. Make sure the bot is Admin in the channel.", { show_alert: true });
  }
});
    
    // ቋንቋዎችን ለማሳየት
bot.action('show_languages', (ctx) => {
  const langKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('አማርኛ 🇪🇹', 'set_lang_Amharic')],
    [Markup.button.callback('English 🇺🇸', 'set_lang_English')],
    [Markup.button.callback('🔙 Back to Settings', 'back_to_settings')]
  ]);
  return ctx.editMessageText("<b>Choose your preferred language:</b>", {
    parse_mode: 'HTML',
    ...langKeyboard
  });
});

// ቋንቋውን ዳታቤዝ ላይ ለመቀየር
const languages = ['Amharic', 'English'];
languages.forEach(lang => {
  bot.action(`set_lang_${lang}`, async (ctx) => {
    try {
      await env.DB.prepare("UPDATE users SET language = ? WHERE user_id = ?")
        .bind(lang, ctx.from.id)
        .run();
      
      await ctx.answerCbQuery(`Language changed to ${lang} ✅`);
      return ctx.editMessageText(`✅ Language successfully updated to <b>${lang}</b>!`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'back_to_settings')]])
      });
    } catch (e) {
      return ctx.answerCbQuery("Error updating language.");
    }
  });
});

    
 bot.action('confirm_delete', (ctx) => {
  return ctx.editMessageText("<b>⚠️ Are you sure?</b>\nThis will permanently delete your registration and wallet data.", {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('Yes, Delete everything', 'do_delete')],
      [Markup.button.callback('No, Cancel', 'back_to_settings')]
    ])
  });
});

bot.action('do_delete', async (ctx) => {
  await env.DB.prepare("DELETE FROM users WHERE user_id = ?").bind(ctx.from.id).run();
  await ctx.answerCbQuery("Account Deleted");
  return ctx.editMessageText("Your account has been deleted. Send /start to register again.");
});

// ወደ ኋላ መመለሻ (Back Button)
bot.action('back_to_settings', async (ctx) => {
  // እዚህ ጋር የ Setting ሜኑን መልሰህ ጥራ (ከላይ ያለውን ኮድ ደግመህ መጠቀም ትችላለህ)
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
      
