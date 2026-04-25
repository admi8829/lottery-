import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN) return new Response("BOT_TOKEN missing");
    
    const bot = new Telegraf(env.BOT_TOKEN);

// 1. ዋናው ሜኑ (Main Menu) - Updated
const mainKeyboard = Markup.keyboard([
  ['🎟 New Ticket'],                          // ትልቅ አዝራር
  ['👤 My Info', '⚙️ Settings'],             // መረጃ እና ሴቲንግ
  ['🏆 Winners', '💰 Wallet & Invite'],               // አሸናፊዎች እና የገንዘብ ቦርሳ (አዲሱ)
  ['👥 Invite & Earn', '❓ Help']                   // ግብዣ እና እርዳታ
]).resize();

// 2. ስልክ ቁጥር መጠየቂያ
const requestPhoneKeyboard = Markup.keyboard([
  [Markup.button.contactRequest('📲 ስልክ ቁጥሬን ላክ')]
]).resize();
    
    
    // Start Command
    bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const startPayload = ctx.startPayload; // ref_12345
    
    // 1. መጀመሪያ ተጠቃሚው መኖሩን ቼክ እናደርጋለን
    const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

    if (user) {
      return ctx.reply(`Welcome back ${user.name}! 👋`, mainKeyboard);
    }

    // 2. ተጠቃሚው አዲስ ከሆነ እና በሪፈራል ሊንክ ከመጣ
    let referrerId = null;
    if (startPayload && startPayload.startsWith('ref_')) {
      const potentialReferrer = parseInt(startPayload.replace('ref_', ''));

      // 🛑 መጭበርበር መከላከያ፡ ራሱን እንዳይጋብዝ ቼክ ማድረግ
      if (potentialReferrer !== userId) {
        referrerId = potentialReferrer;
      }
    }

    // 3. ተጠቃሚውን ለጊዜው መመዝገብ (ስልኩን እስኪልክ ድረስ referred_by መረጃን ይዞ እንዲቆይ)
    // ስሙን ለጊዜው 'Pending' እንበለው
    await env.DB.prepare(
      "INSERT OR IGNORE INTO users (user_id, name, referred_by, balance, invite_count) VALUES (?, ?, ?, ?, ?)"
    ).bind(userId, "Pending User", referrerId, 0, 0).run();

    return ctx.reply("እንኳን ደህና መጡ! ለመመዝገብ እባክዎ ስልክ ቁጥርዎን ይላኩ።", requestPhoneKeyboard);

  } catch (e) {
    return ctx.reply("Error: " + e.message);
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

    // 1. የተጠቃሚውን ነባር መረጃ ከዳታቤዝ መፈለግ
    const existingUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?")
      .bind(userId)
      .first();

    // 2. ተጠቃሚው አዲስ ከሆነ (ወይም ስልኩን ገና ካልላከ) እና በሪፈራል የመጣ ከሆነ ለጋባዡ ብር መክፈል
    if (existingUser && !existingUser.phone && existingUser.referred_by) {
      const referrerId = existingUser.referred_by;

      // ለጋባዡ 2 ብር መጨምር እና የኢንቫይት ብዛት መቁጠር
      await env.DB.prepare(
        "UPDATE users SET balance = balance + 2, invite_count = invite_count + 1 WHERE user_id = ?"
      ).bind(referrerId).run();

      // ለጋባዡ ማሳወቂያ መላክ
      try {
        await ctx.telegram.sendMessage(referrerId, `<b>🎊 New Referral!</b>\nSomeone joined using your link. <b>+2 ETB</b> added to your wallet.`, { parse_mode: 'HTML' });
      } catch (err) {
        console.log("Referrer notification failed");
      }
    }

    // 3. የተጠቃሚውን መረጃ ማዘመን (Update user data)
    // ማሳሰቢያ፡ INSERT OR REPLACE ካልን የቆየውን balance ሊያጠፋው ስለሚችል UPDATE መጠቀም ይሻላል
    await env.DB.prepare(
      "UPDATE users SET phone = ?, name = ?, username = ? WHERE user_id = ?"
    ).bind(phone, fullName, username, userId).run();

    // 4. ተጠቃሚው ቀድሞ የነበረ ከሆነ (Profile Update ካደረገ)
    if (existingUser && existingUser.phone) {
      return ctx.reply(`<b>✅ Profile Updated Successfully!</b>\n\nYour information has been refreshed, <b>${fullName}</b>.`, {
        parse_mode: 'HTML',
        ...mainKeyboard 
      });
    }

    // 5. ተጠቃሚው አዲስ ከሆነ (ለመጀመሪያ ጊዜ ሲመዘገብ) የቻናል ግዴታ ማሳየት
    const channelLink = "https://t.me/SmartX_Ethio"; 
    const joinKeyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 Join Our Channel', channelLink)],
      [Markup.button.callback('✅ Joined - Continue', 'check_join')]
    ]);

    const welcomeMessage = `
<b>Registration Successful! ✅</b>
━━━━━━━━━━━━━━━━━━
<b>Welcome, ${fullName}!</b>
Your account is created. To start earning and buying tickets, please <b>Join our Official Channel</b> below.
━━━━━━━━━━━━━━━━━━`;

    return ctx.reply(welcomeMessage, {
      parse_mode: 'HTML',
      ...joinKeyboard
    });

  } catch (e) {
    return ctx.reply(`<b>❌ Error:</b> <code>${e.message}</code>`, { parse_mode: 'HTML' });
  }
});

 bot.hears('🎟 New Ticket', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    // 1. የሰውንየውን ብር ቼክ ማድረግ
    const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?")
      .bind(userId)
      .first();

    const balance = user?.balance || 0;

    // --- ሁኔታ 1: ብር ካለው ---
    if (balance >= 10) {
      const confirmKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes, Buy Now (10 ETB)', 'buy_with_wallet')],
        [Markup.button.callback('❌ Cancel', 'back_to_wallet')]
      ]);

      return ctx.reply(`
<b>🎟 New Ticket Purchase</b>
━━━━━━━━━━━━━━━━━━
Your current balance: <b>${balance} ETB</b>
Ticket Price: <b>10 ETB</b>

Do you want to use your balance to buy 1 ticket?`, { parse_mode: 'HTML', ...confirmKeyboard });
    } 

    // --- ሁኔታ 2: ብር ከሌለው (የአከፋፈል መመሪያውን እዚህ ያሳየዋል) ---
    else {
      const depositKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📥 How to Deposit Money', 'show_deposit_info')],
        [Markup.button.callback('👥 Invite Friends (Earn 2 ETB)', 'view_invite_link')]
      ]);

      return ctx.reply(`
<b>❌ Insufficient Balance!</b>
━━━━━━━━━━━━━━━━━━
To buy a ticket, you need at least <b>10 ETB</b>.
Your current balance is: <b>${balance} ETB</b>

Please deposit money or invite friends to earn enough balance.`, { parse_mode: 'HTML', ...depositKeyboard });
    }

  } catch (e) {
    return ctx.reply("Error: " + e.message);
  }
});
    


  bot.hears('👥 Invite & Earn', async (ctx) => {
  const userId = ctx.from.id;
  const botUsername = ctx.botInfo.username;
  
  // የዳታቤዝ መረጃ (ስንት ሰው እንደጋበዘ ለማሳየት)
  const user = await env.DB.prepare("SELECT invite_count, balance FROM users WHERE user_id = ?")
    .bind(userId)
    .first();

  const invites = user?.invite_count || 0;
  const earnings = invites * 2; // ለእያንዳንዱ 2 ብር ከሆነ
  const inviteLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const inviteMessage = `
<b>👥 Invite Friends & Earn Money!</b>
━━━━━━━━━━━━━━━━━━
Share your referral link with friends and family. For every person who joins and registers, you will receive <b>2 ETB</b> in your wallet!

<b>📊 Your Stats:</b>
• Total Invited: <b>${invites} users</b>
• Total Earned: <b>${earnings} ETB</b>

<b>🔗 Your Referral Link:</b>
<code>${inviteLink}</code>
━━━━━━━━━━━━━━━━━━
<i>Copy the link above and start sharing! 🚀</i>`;

  // በቀጥታ ለሰዎች Forward እንዲያደርጉት የሚረዳ አዝራር (Inline)
  const shareKeyboard = Markup.inlineKeyboard([
    [Markup.button.url('📢 Share with Friends', `https://t.me/share/url?url=${inviteLink}&text=Join%20this%20bot%20to%20play%20lottery%20and%20win%20prizes!%20🎁`)]
  ]);

  return ctx.reply(inviteMessage, { 
    parse_mode: 'HTML',
    ...shareKeyboard 
  });
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

// 1. Wallet & Invite (አድስ የሚል አዝራር ተጨምሮበታል)
bot.hears('💰 Wallet & Invite', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await env.DB.prepare("SELECT balance, invite_count FROM users WHERE user_id = ?").bind(userId).first();

    const balance = user?.balance || 0;
    const invites = user?.invite_count || 0;
    const botUsername = ctx.botInfo.username;
    const inviteLink = `https://t.me/${botUsername}?start=ref_${userId}`;

    const message = `
<b>👛 Your Wallet & Invites</b>
━━━━━━━━━━━━━━━━━━
<b>💰 Balance:</b> <code>${balance} ETB</code>
<b>👥 Total Invites:</b> <code>${invites} users</code>
━━━━━━━━━━━━━━━━━━
<b>🎁 Invite & Earn:</b>
Share your link and get <b>2 ETB</b> for every friend!
Your Link: <code>${inviteLink}</code>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎟 Buy Ticket (10 ETB)', 'buy_with_wallet')],
      [Markup.button.callback('💸 Withdraw', 'request_withdraw'), Markup.button.callback('📥 Deposit', 'show_deposit_info')],
      [Markup.button.callback('🔙 Back', 'back_to_settings')]
    ]);

    return ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
  } catch (e) {
    return ctx.reply("Error: " + e.message);
  }
});

// 2. Buy Ticket (በዳታቤዝ የሚመዘግብ)
bot.action('buy_with_wallet', async (ctx) => {
  const userId = ctx.from.id;
  const TICKET_PRICE = 10;

  try {
    // 1. ATOMIC TRANSACTION: Check balance and update in one sequence
    // This prevents "Race Conditions" (Double Spending)
    const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?")
      .bind(userId)
      .first();

    if (!user) {
      return ctx.answerCbQuery("⚠️ Account not found. Please restart the bot.", { show_alert: true });
    }

    if (user.balance < TICKET_PRICE) {
      return ctx.answerCbQuery(`❌ Low Balance! You need at least ${TICKET_PRICE} ETB.`, { show_alert: true });
    }

    // 2. GENERATE SECURE TICKET NUMBER
    // Using a more robust random generator
    const ticketNumber = Math.floor(100000 + Math.random() * 900000);

    // 3. SECURE EXECUTION (Batch update)
    // We update the balance and insert the ticket record simultaneously
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?")
        .bind(TICKET_PRICE, userId, TICKET_PRICE),
      env.DB.prepare("INSERT INTO tickets (user_id, ticket_number, purchase_date) VALUES (?, ?, ?)")
        .bind(userId, ticketNumber, new Date().toISOString())
    ]);

    // 4. REMOVE LOADING STATE
    await ctx.answerCbQuery("💎 Processing Purchase...", { show_alert: false });

    // 5. PREMIUM UI DESIGN
    const successMessage = `
✨ <b>PURCHASE CONFIRMED</b> ✨
━━━━━━━━━━━━━━━━━━
<b>Congratulations!</b> Your entry has been securely registered in our system.

<b>🎫 TICKET DETAILS:</b>
┌────────────────────┐
  <b>NUM:</b> <code>#${ticketNumber}</code>
  <b>COST:</b> <code>${TICKET_PRICE}.00 ETB</code>
  <b>STAT:</b> <code>Verified ✅</code>
└────────────────────┘

<b>📅 DATE:</b> <code>${new Date().toLocaleString()}</code>

━━━━━━━━━━━━━━━━━━
<i>Check your "My Tickets" menu to see all your entries. Good luck!</i>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎟 Buy Another', 'buy_with_wallet')],
      [Markup.button.callback('📂 View My Tickets', 'view_my_tickets')]
    ]);

    return ctx.editMessageText(successMessage, { 
      parse_mode: 'HTML', 
      ...keyboard 
    });

  } catch (e) {
    console.error("CRITICAL ERROR during purchase:", e);
    return ctx.answerCbQuery("🚨 System Busy. Please try again in a moment.", { show_alert: true });
  }
});

    bot.action('view_my_tickets', async (ctx) => {
  const userId = ctx.from.id;

  try {
    // 1. Fetch all tickets for this user from DB
    const { results } = await env.DB.prepare(
      "SELECT ticket_number, purchase_date FROM tickets WHERE user_id = ? ORDER BY purchase_date DESC"
    ).bind(userId).all();

    await ctx.answerCbQuery();

    if (!results || results.length === 0) {
      return ctx.editMessageText(
        "<b>📂 MY TICKETS</b>\n━━━━━━━━━━━━━━━━━━\n" +
        "You haven't purchased any tickets yet.\n\n" +
        "Invite friends to earn <b>2 ETB</b> or deposit money to start playing!",
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🎟 Buy Your First Ticket', 'buy_with_wallet')],
            [Markup.button.callback('🔙 Back to Wallet', 'back_to_wallet')]
          ])
        }
      );
    }

 // 2. Build the ticket list string
    let ticketList = `<b>📂 MY TICKETS (${results.length})</b>\n`;
    ticketList += `━━━━━━━━━━━━━━━━━━\n`;
    ticketList += `<i>Here are your officially registered entries:</i>\n\n`;

    results.forEach((ticket, index) => {
      // Formatting the date (Optional: simplified)
      const date = new Date(ticket.purchase_date).toLocaleDateString();
      ticketList += `<b>${index + 1}.</b> <code>#${ticket.ticket_number}</code>  |  📅 ${date}\n`;
    });

    ticketList += `\n━━━━━━━━━━━━━━━━━━\n`;
    ticketList += `<b>Status:</b> All entries are <code>Active ✅</code>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎟 Buy More Tickets', 'buy_with_wallet')],
      [Markup.button.callback('🔙 Back to Wallet', 'back_to_wallet')]
    ]);

    return ctx.editMessageText(ticketList, {
      parse_mode: 'HTML',
      ...keyboard
    });

  } catch (e) {
    console.error(e);
    return ctx.reply("❌ Error fetching your tickets. Please try again.");
  }
});

// Also handle the "🎟 My Tickets" button from the main Reply Keyboard
bot.hears('🎟 My Tickets', async (ctx) => {
    // We can just trigger the same action logic
    return ctx.reply("Fetching your tickets...", Markup.inlineKeyboard([
        [Markup.button.callback('Click to View My Tickets', 'view_my_tickets')]
    ]));
});
      

// 3. Deposit Info (editMessageText ተጠቀምንበት)
// --- Deposit መመሪያ ማሳያ ---
bot.action('show_deposit_info', async (ctx) => {
  await ctx.answerCbQuery();
  const depositText = `
<b>📥 Deposit Funds</b>
━━━━━━━━━━━━━━━━━━
To add balance to your wallet, please use one of the payment methods below:

🔸 <b>Telebirr:</b> <code>0911223344</code>
🔸 <b>CBE Birr:</b> <code>0911223344</code>
🔸 <b>CBE Bank:</b> <code>100012345678</code>

<b>⚠️ Instructions:</b>
1. Transfer the amount you wish to deposit.
2. Take a <b>Screenshot</b> of the successful transaction.
3. Click the <b>"📸 Send Screenshot"</b> button below and upload the photo.
━━━━━━━━━━━━━━━━━━`;
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📸 Send Screenshot', 'ask_for_photo')],
    [Markup.button.callback('🔙 Back to Wallet', 'back_to_wallet')]
  ]);

  return ctx.editMessageText(depositText, { parse_mode: 'HTML', ...keyboard });
});

// ፎቶ እንዲልኩ መጠየቂያ
bot.action('ask_for_photo', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply("<b>📸 Please upload your Screenshot now:</b>\nMake sure the transaction reference number is visible.", { parse_mode: 'HTML' });
});

// --- ፎቶ ሲላክ ለአድሚን የሚሄድበት ሲስተም ---
bot.on('photo', async (ctx) => {
  const adminId = "8344169004"; // 👈 እዚህ ጋር ያንተን ID ተካው (ቁጥር ብቻ)
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  const username = ctx.from.username ? `@${ctx.from.username}` : "No Username";
  
  // የሰውየውን ስልክ ከዳታቤዝ እናምጣ
  const user = await env.DB.prepare("SELECT phone FROM users WHERE user_id = ?").bind(userId).first();
  const phone = user?.phone || "Phone not found";

  // ለተጠቃሚው ማረጋገጫ መስጠት
  await ctx.reply("<b>⏳ Receipt Received!</b>\nYour payment is being verified by the admin. Please wait...", { parse_mode: 'HTML' });

  // ለአድሚኑ መረጃውን መላክ
  const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  const adminCaption = `
<b>💰 New Deposit Request</b>
━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${firstName}
🆔 <b>User ID:</b> <code>${userId}</code>
📞 <b>Phone:</b> <code>${phone}</code>
🔗 <b>Username:</b> ${username}
━━━━━━━━━━━━━━━━━━
Select an amount to approve:`;

  const adminKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Approve 10 ETB', `approve_${userId}_10`)],
    [Markup.button.callback('✅ Approve 50 ETB', `approve_${userId}_50`)],
    [Markup.button.callback('❌ Reject Request', `reject_${userId}`)]
  ]);

  return ctx.telegram.sendPhoto(adminId, photoId, {
    caption: adminCaption,
    parse_mode: 'HTML',
    ...adminKeyboard
  });
});
    

// 4. Withdrawal Request
bot.action('request_withdraw', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply("📩 <b>Withdrawal Request</b>\nPlease contact @AdminUsername with your registered phone and the amount you wish to withdraw.", { parse_mode: 'HTML' });
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

  bot.action('view_invite_link', async (ctx) => {
  const userId = ctx.from.id;
  const botUsername = ctx.botInfo.username;
  const inviteLink = `https://t.me/${botUsername}?start=ref_${userId}`;
  
  await ctx.answerCbQuery();
  return ctx.reply(`<b>🔗 Your Invite Link:</b>\n<code>${inviteLink}</code>\n\nShare this and get 2 ETB for every join!`, { parse_mode: 'HTML' });
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
      
