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

    // ስልክ ሲላ
bot.on('contact', async (ctx) => {
  try {
    if (!ctx.message || !ctx.message.contact) {
      return ctx.reply("<b>⚠️ Error</b>\nPlease use the button to share your contact.", { parse_mode: 'HTML' });
    }

    const userId = ctx.from.id;
    const fullName = `${ctx.from.first_name} ${ctx.from.last_name || ""}`.trim();
    const phone = ctx.message.contact.phone_number;
    const username = ctx.from.username || "N/A";

    // 1. መጀመሪያ ተጠቃሚው ዳታቤዝ ውስጥ መኖሩን ቼክ እናደርጋለን
    const existingUser = await env.DB.prepare("SELECT user_id FROM users WHERE user_id = ?")
      .bind(userId)
      .first();

    // 2. ዳታውን እናድሳለን (INSERT OR REPLACE)
    await env.DB.prepare(
      "INSERT OR REPLACE INTO users (user_id, phone, name, username) VALUES (?, ?, ?, ?)"
    ).bind(userId, phone, fullName, username).run();

    // 3. ተጠቃሚው ቀድሞ የነበረ ከሆነ "Updated" የሚል መልዕክት ብቻ እንልካለን
    if (existingUser) {
      return ctx.reply(`<b>✅ Profile Updated Successfully!</b>\n\nYour information has been refreshed, <b>${fullName}</b>.`, {
        parse_mode: 'HTML',
        ...mainKeyboard // ዋናውን የሪፕላይ በተን ይመልስለታል
      });
    }

    // 4. ተጠቃሚው አዲስ ከሆነ (ለመጀመሪያ ጊዜ ሲመዘገብ) ቻናል እንዲቀላቀል እንጠይቃለን
    const channelLink = "https://t.me/SmartX_Ethio"; 
    const joinKeyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 Join Our Channel', channelLink)],
      [Markup.button.callback('✅ Joined - Continue', 'check_join')]
    ]);

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
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('👤 Update Profile', 'update_profile')],
    [Markup.button.callback('💳 Payment Methods', 'show_payments')],
    [Markup.button.callback('👨‍💻 Contact Support', 'contact_support')],
    [Markup.button.callback('❌ Delete My Account', 'confirm_delete')]
  ]);

  const settingsText = `
<b>⚙️ Settings Menu</b>

Manage your account details and payment methods below.
━━━━━━━━━━━━━━━━━━
<b>Status:</b> 🟢 Active
<b>Language:</b> English
━━━━━━━━━━━━━━━━━━`;

  return ctx.reply(settingsText, {
    parse_mode: 'HTML',
    ...settingsKeyboard
  });
});

  bot.hears('💰 Wallet & Invite', async (ctx) => {
  const userId = ctx.from.id;
  const user = await env.DB.prepare("SELECT balance, invite_count FROM users WHERE user_id = ?").bind(userId).first();

  const balance = user?.balance || 0;
  const invites = user?.invite_count || 0;
  const botUsername = ctx.botInfo.username;
  const inviteLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const message = `
<b>👛 Your Wallet & Invites</b>
━━━━━━━━━━━━━━━━━━
<b>💰 Balance:</b> ${balance} ETB
<b>👥 Total Invites:</b> ${invites} users
━━━━━━━━━━━━━━━━━━
<b>🎁 Invite & Earn:</b>
Share your link and get <b>2 ETB</b> for every friend who joins!
Your Link: <code>${inviteLink}</code>

<i>You can use your balance to buy Tickets or Withdraw.</i>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🎟 Buy Ticket (10 ETB)', 'buy_with_wallet')],
    [Markup.button.callback('💸 Withdraw Money', 'request_withdraw')],
    [Markup.button.callback('📥 Deposit Money', 'show_deposit_info')]
  ]);

  return ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
});
    

// Back to settings action (ለ Inline Buttons መልሶ መመለሻ እንዲሆን)
bot.action('back_to_settings', async (ctx) => {
  const settingsKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('👤 Update Profile', 'update_profile')],
    [Markup.button.callback('💳 Payment Methods', 'show_payments')],
    [Markup.button.callback('👨‍💻 Contact Support', 'contact_support')],
    [Markup.button.callback('❌ Delete My Account', 'confirm_delete')]
  ]);

  return ctx.editMessageText("<b>⚙️ Settings Menu</b>\nSelect an option to manage your account:", {
    parse_mode: 'HTML',
    ...settingsKeyboard
  });
});
    

 bot.action('buy_with_wallet', async (ctx) => {
  const userId = ctx.from.id;
  const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(userId).first();

  if (user.balance < 10) {
    return ctx.answerCbQuery("❌ Insufficient balance! You need 10 ETB.", { show_alert: true });
  }

  // 10 ብር መቀነስ
  await env.DB.prepare("UPDATE users SET balance = balance - 10 WHERE user_id = ?").bind(userId).run();

  // እዚህ ጋር ቲኬት የመፍጠር ስራ ይሰራል (ለምሳሌ Random ቁጥር መስጠት)
  const ticketNumber = Math.floor(100000 + Math.random() * 900000);
  
  return ctx.reply(`✅ <b>Ticket Purchased!</b>\n10 ETB deducted from wallet.\nYour Ticket Number: <b>#${ticketNumber}</b>`, { parse_mode: 'HTML' });
});

    // Deposit መረጃ ማሳያ
bot.action('show_deposit_info', (ctx) => {
  const depositText = `
<b>📥 How to Deposit</b>
━━━━━━━━━━━━━━━━━━
1. Send the amount you want to:
   - <b>Telebirr:</b> <code>0911223344</code>
   - <b>CBE Birr:</b> <code>0911223344</code>
2. Send the <b>Screenshot</b> of the receipt to @AdminUsername.
3. Once verified, your wallet balance will be updated.
━━━━━━━━━━━━━━━━━━`;
  return ctx.reply(depositText, { parse_mode: 'HTML' });
});

// Withdrawal ጥያቄ
bot.action('request_withdraw', async (ctx) => {
  return ctx.reply("To withdraw, please contact @AdminUsername with your registered phone number and the amount you want to withdraw.");
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

 bot.action('update_profile', (ctx) => {
  const updateMessage = `
<b>👤 Update Your Profile</b>
━━━━━━━━━━━━━━━━━━
To keep your account secure and ensure you receive your winnings, we need to verify your phone number again.

<b>Instructions:</b>
Click the button below to share your contact.
━━━━━━━━━━━━━━━━━━`;

  return ctx.reply(updateMessage, {
    parse_mode: 'HTML',
    ...Markup.keyboard([
      [Markup.button.contactRequest('📲 Verify & Update My Number')]
    ]).resize().oneTime()
  });
});
    
    //delete my information. 
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

// 1. የክፍያ አማራጮችን ማሳያ
bot.action('show_payments', (ctx) => {
  const paymentKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📥 Setup Deposit Method', 'setup_deposit')],
    [Markup.button.callback('📤 Setup Payout Account', 'setup_payout')],
    [Markup.button.callback('🔙 Back to Settings', 'back_to_settings')]
  ]);

  return ctx.editMessageText("<b>💳 Payment Settings</b>\n\nSetup how you want to pay for tickets and how you want to receive your winnings.", {
    parse_mode: 'HTML',
    ...paymentKeyboard
  });
});

// 2. ተጠቃሚው የሚከፍልበትን መንገድ ሲመርጥ
bot.action('setup_deposit', (ctx) => {
  return ctx.reply("<b>📥 Deposit Method Setup</b>\nPlease type the service you use and your phone number.\n\nExample: <code>Telebirr - 0911223344</code>", { parse_mode: 'HTML' });
});

// 3. ተጠቃሚው ሽልማት የሚቀበልበትን አካውንት ሲመርጥ
bot.action('setup_payout', (ctx) => {
  return ctx.reply("<b>📤 Payout Account Setup</b>\nPlease type your Bank name and Account number for receiving prizes.\n\nExample: <code>CBE - 1000223344556</code>", { parse_mode: 'HTML' });
});

// 4. የተላከውን ጽሁፍ ተቀብሎ ዳታቤዝ ውስጥ ማስገባት
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  // ተጠቃሚው "Telebirr" ወይም "CBE" የሚል ጽሁፍ ከላከ (ቀለል ባለ መንገድ ለመለየት)
  if (text.includes('-')) {
     if (text.toLowerCase().includes('telebirr') || text.toLowerCase().includes('cbe birr')) {
        // እንደ Deposit Method መመዝገብ
        await env.DB.prepare("UPDATE users SET deposit_method = ? WHERE user_id = ?").bind(text, userId).run();
        return ctx.reply("✅ <b>Deposit method saved!</b> You can now use this to buy tickets.", { parse_mode: 'HTML' });
     } else {
        // እንደ Payout Account መመዝገብ
        await env.DB.prepare("UPDATE users SET payout_account = ? WHERE user_id = ?").bind(text, userId).run();
        return ctx.reply("✅ <b>Payout account saved!</b> Your winnings will be sent here.", { parse_mode: 'HTML' });
     }
  }

  // ሌሎች የቦቱ መልዕክቶች ካሉ እዚህ ይቀጥላሉ...
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
      
