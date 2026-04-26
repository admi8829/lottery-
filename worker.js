import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN) return new Response("BOT_TOKEN missing");
    
    const bot = new Telegraf(env.BOT_TOKEN);
    const CHANNEL_ID = "@SmartX_Ethio"; // ያንተ ቻናል
    const ADMIN_ID = 8344169004;
    
    // --- 1. Keyboards ---
    const mainKeyboard = Markup.keyboard([
      ['🎟 New Ticket'],
      ['🎟 My Tickets', '⚙️ Settings'],
      ['🏆 Winners', '💰 Wallet & Invite'],
      ['👥 Invite & Earn', '❓ Help']
    ]).resize();

    const requestPhoneKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📲 send to phone ')]
    ]).resize();

    // --- 2. Start Command ---
   bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const startPayload = ctx.startPayload;
    
    // 1. ተጠቃሚው መመዝገቡን ቼክ ማድረግ
    const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

    // 2. ተጠቃሚው ቀድሞ ተመዝግቦ ከሆነ (ስልክ ካለው)
    if (user && user.phone) {
      
      // --- አዲሱ ማስተካከያ እዚህ ጋር ነው ---
      // ተጠቃሚው ቻናሉን መቀላቀሉን ቼክ እናደርጋለን
      const member = await ctx.telegram.getChatMember("@SmartX_Ethio", userId);
      const isMember = ['member', 'administrator', 'creator'].includes(member.status);

      if (isMember) {
        // አባል ከሆነና ስልክ ካለው በቀጥታ Main Menu
        const welcomeBackMsg = `
👋 <b>Welcome Back, ${user.name}!</b>
━━━━━━━━━━━━━━━━━━
Your account is active and ready. What would you like to do today?
━━━━━━━━━━━━━━━━━━`;
        return ctx.reply(welcomeBackMsg, { parse_mode: 'HTML', ...mainKeyboard });
      } else {
        // ስልክ አለው ግን ቻናሉን ለቆ ከሆነ ድጋሜ እንዲቀላቀል መጠየቅ
        return ctx.reply("👋 <b>Welcome Back!</b>\nPlease join our channel to continue using the bot.", {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('📢 Join Channel', 'https://t.me/SmartX_Ethio')],
            [Markup.button.callback('✅ I Have Joined', 'check_join')]
          ])
        });
      }
    }

    // 3. አዲስ ተጠቃሚ ከሆነ የሚደረግ ምዝገባ (እንደ ቀድሞው)
    let referrerId = null;
    if (startPayload && startPayload.startsWith('ref_')) {
      const ref = parseInt(startPayload.replace('ref_', ''));
      if (ref !== userId) referrerId = ref;
    }

    await env.DB.prepare(
      "INSERT OR IGNORE INTO users (user_id, name, referred_by, balance, invite_count) VALUES (?, ?, ?, ?, ?)"
    ).bind(userId, ctx.from.first_name, referrerId, 0, 0).run();

    const welcomeMsg = `
✨ <b>Welcome to SmartX Pottery!</b> ✨
━━━━━━━━━━━━━━━━━━
To start winning amazing prizes, please complete your registration.

<b>1. Join our channel:</b> @SmartX_Ethio
<b>2. Share your phone number</b> using the button below.
━━━━━━━━━━━━━━━━━━`;

    return ctx.reply(welcomeMsg, { parse_mode: 'HTML', ...requestPhoneKeyboard });

  } catch (e) {
    return ctx.reply("Error: " + e.message);
  }
});
          
    // --- 3. Phone Verification & Draw Info Display ---
bot.on('contact', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const contact = ctx.message.contact;
    const firstName = ctx.from.first_name;

    // 1. Security Check: Ensures the user shared their own contact
    if (contact.user_id !== userId) {
      return ctx.reply("❌ <b>Security Alert!</b>\nFor verification purposes, you must share your own contact number using the button below.", { parse_mode: 'HTML' });
    }

    // 2. Database Update: Register phone and name
    await env.DB.prepare("UPDATE users SET phone = ?, name = ? WHERE user_id = ?")
      .bind(contact.phone_number, firstName, userId).run();

    // 3. Referral Reward System: Pays the referrer 2 ETB
    const user = await env.DB.prepare("SELECT referred_by FROM users WHERE user_id = ?").bind(userId).first();
    if (user && user.referred_by) {
      await env.DB.prepare("UPDATE users SET balance = balance + 2, invite_count = invite_count + 1 WHERE user_id = ?")
        .bind(user.referred_by).run();
      
      // Notify the person who invited this user
      try {
        await ctx.telegram.sendMessage(user.referred_by, "🎊 <b>New Referral Reward!</b>\nYour friend joined successfully. <b>+2 ETB</b> has been added to your balance.", { parse_mode: 'HTML' });
      } catch (err) {
        console.log("Could not send referral notification.");
      }
    }

    // 4. Force Join Instructions: Clean and Professional UI
    const completionMsg = `
✨ <b>Registration Success!</b> ✨
━━━━━━━━━━━━━━━━━━
Hello <b>${firstName}</b>, your phone number has been verified and your account is created.

🔓 <b>One Final Step:</b>
To unlock the <b>Main Menu</b> and start participating in our lottery draws, you must <b>join our official channel</b>.

Joining helps you stay updated with draw results, winners, and upcoming prizes!
━━━━━━━━━━━━━━━━━━`;

    return ctx.reply(completionMsg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Join Official Channel', 'https://t.me/SmartX_Ethio')],
        [Markup.button.callback('✅ I Have Joined', 'check_join')]
      ])
    });

  } catch (e) {
    console.error("Contact Processing Error:", e);
    return ctx.reply("⚠️ <b>System Error:</b> We encountered a problem while saving your contact. Please try again.", { parse_mode: 'HTML' });
  }
});
    
    // --- [ 1. የአድሚን ሜኑ ትዕዛዝ ] ---
bot.command('admin_menu', async (ctx) => {
  // Check if the user is the authorized admin
  if (ctx.from.id !== ADMIN_ID) return; 

  const adminMsg = `
<b>🛠 Admin Control Panel</b>
━━━━━━━━━━━━━━━━━━
Welcome back, Admin! Use the button below to randomly select 3 winners for the current active draw.

<b>⚠️ Note:</b> This action is irreversible.
━━━━━━━━━━━━━━━━━━`;

  return ctx.reply(adminMsg, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🎰 Draw Winners Now', 'admin_draw_winners')]
    ])
  });
});
    
// --- [ 2. ዕጣውን የሚያወጣው ተግባር (Action) ] ---
bot.action('admin_draw_winners', async (ctx) => {
  // Use the global ADMIN_ID constant
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("Unauthorized!");

  try {
    // 1. Fetch draw settings and 3 random winners
    const drawSettings = await env.DB.prepare("SELECT * FROM draw_settings WHERE id = 1").first();
    
    // Selecting winners where status is 'active'
    const winners = await env.DB.prepare(
      `SELECT t.ticket_number, t.user_id, u.name 
       FROM tickets t 
       JOIN users u ON t.user_id = u.user_id 
       WHERE t.status = 'active' 
       ORDER BY RANDOM() LIMIT 3`
    ).all();

    // Check if there are at least 3 active tickets
    if (!winners.results || winners.results.length < 3) {
      return ctx.reply("❌ <b>Draw Failed:</b> At least 3 'Active' tickets are required to perform a draw.", { parse_mode: 'HTML' });
    }

    const prizes = [drawSettings.prize_1, drawSettings.prize_2, drawSettings.prize_3];
    let announcementText = `🎊 <b>OFFICIAL DRAW RESULTS</b> 🎊\n━━━━━━━━━━━━━━━━━━\n<b>🏆 Event:</b> ${drawSettings.draw_name || "Weekly Grand Draw"}\n\n`;

    // 2. Loop through winners, save to DB and notify them
    for (let i = 0; i < winners.results.length; i++) {
      const winner = winners.results[i];
      const prize = prizes[i];

      // Register the winner in the Winners Table
      await env.DB.prepare(
        "INSERT INTO winners (user_id, ticket_number, prize_amount, draw_date) VALUES (?, ?, ?, ?)"
      ).bind(winner.user_id, winner.ticket_number, prize, new Date().toISOString()).run();

      // Send private message to the winner
      try {
        const winnerMsg = `
🎉 <b>CONGRATULATIONS!</b>
━━━━━━━━━━━━━━━━━━
Your ticket <b>#${winner.ticket_number}</b> has won the <b>${prize}</b> prize in the ${drawSettings.draw_name}!

Please contact support to claim your prize.
━━━━━━━━━━━━━━━━━━`;
        await ctx.telegram.sendMessage(winner.user_id, winnerMsg, { parse_mode: 'HTML' });
      } catch (e) {
        console.log(`Failed to notify user ${winner.user_id}`);
      }

      // Build the public announcement text
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      announcementText += `${medal} <b>${prize} Winner:</b>\n👤 ${winner.name} (🎫 #${winner.ticket_number})\n\n`;
    }

    // 3. Mark all active tickets as 'expired' for this round
    await env.DB.prepare("UPDATE tickets SET status = 'expired' WHERE status = 'active'").run();

    announcementText += `━━━━━━━━━━━━━━━━━━\n<i>All winners have been notified. Congratulations to everyone!</i>`;
    
    // Show results to the Admin
    return ctx.reply(announcementText, { parse_mode: 'HTML' });

  } catch (e) {
    console.error("Draw Error:", e);
    return ctx.reply("🚨 <b>Critical Error:</b> " + e.message, { parse_mode: 'HTML' });
  }
});
    
  bot.action('check_join', async (ctx) => {
  try {
    // ቴሌግራምን ተጠቃሚው አባል መሆኑን እንጠይቃለን
    const member = await ctx.telegram.getChatMember("@SmartX_Ethio", ctx.from.id);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);

    if (isMember) {
      // 1. አጭር የማረጋገጫ መልዕክት ከላይ ያሳያል
      await ctx.answerCbQuery("Success! Welcome aboard. 🎉");

      // 2. የቆየውን የ "Join Channel" መልዕክት ያጠፋል
      await ctx.deleteMessage().catch(() => {});

      // 3. ዋናውን ሜኑ (Main Menu) ይከፍትለታል
      return ctx.reply(`<b>Access Granted!</b> 👋\n\nWelcome to <b>SmartX Lottery</b>. Your account is now fully active. You can start buying tickets and inviting friends!`, {
        parse_mode: 'HTML',
        ...mainKeyboard 
      });

    } else {
      // አባል ካልሆነ የሚመጣ ማስጠንቀቂያ (Alert)
      return ctx.answerCbQuery("⚠️ You haven't joined yet! Please join the channel first.", { show_alert: true });
    }
  } catch (e) {
    console.error("Join Check Error:", e);
    return ctx.answerCbQuery("❌ Error: Make sure the bot is an Admin in the channel.", { show_alert: true });
  }
});
      
bot.hears('🎟 New Ticket', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    // 1. የተጠቃሚውን ባላንስ እና የዕጣ መረጃን ከዳታቤዝ እናመጣለን
    const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(userId).first();
    const draw = await env.DB.prepare("SELECT * FROM draw_settings WHERE id = 1").first();

    const balance = user?.balance || 0;
    const currentDraw = draw?.draw_name || "Weekly Grand Draw";
    const prize1 = draw?.prize_1 || "1,000 ETB";
    const ticketPrice = 10;

    // --- ሁኔታ 1: በቂ ብር ካለው ---
    if (balance >= ticketPrice) {
      const confirmKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Confirm Purchase (10 ETB)', 'buy_with_wallet')],
        [Markup.button.callback('❌ Cancel', 'back_to_wallet')]
      ]);

      const purchaseMsg = `
<b>🎟 Purchase a New Ticket</b>
━━━━━━━━━━━━━━━━━━
🏆 <b>Active Draw:</b> <code>${currentDraw}</code>
🎁 <b>Top Prize:</b> <code>${prize1}</code>
💰 <b>Ticket Price:</b> <code>${ticketPrice} ETB</code>

💳 <b>Your Balance:</b> <code>${balance} ETB</code>
━━━━━━━━━━━━━━━━━━
<i>Would you like to buy 1 entry ticket for 10 ETB?</i>`;

      return ctx.reply(purchaseMsg, { 
        parse_mode: 'HTML', 
        ...confirmKeyboard 
      });
    } 

    // --- ሁኔታ 2: በቂ ብር ከሌለው ---
    else {
      const depositKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📥 How to Deposit Money', 'show_deposit_info')],
        [Markup.button.callback('📂 View My Tickets', 'view_my_tickets')],
        [Markup.button.callback('👥 Invite Friends', 'view_invite_link')]
      ]);

      const lowBalanceMsg = `
<b>❌ Insufficient Balance!</b>
━━━━━━━━━━━━━━━━━━
To participate in the <b>${currentDraw}</b>, you need at least <b>10 ETB</b>.

📉 <b>Your Balance:</b> <code>${balance} ETB</code>
🎟 <b>Required:</b> <code>${ticketPrice} ETB</code>
━━━━━━━━━━━━━━━━━━
<i>Please deposit funds or invite friends to earn more balance!</i>`;

      return ctx.reply(lowBalanceMsg, { 
        parse_mode: 'HTML', 
        ...depositKeyboard 
      });
    }

  } catch (e) {
    console.error("New Ticket Error:", e);
    return ctx.reply("⚠️ <b>System Error:</b> Could not fetch draw details. Please try again.", { parse_mode: 'HTML' });
  }
});
      

    // 2. Buy Ticket (የተሻሻለ ዲዛይን)
bot.action('buy_with_wallet', async (ctx) => {
  const userId = ctx.from.id;
  const TICKET_PRICE = 10;

  try {
    // 1. የባላንስ ቼክ (Atomic Transaction logic remains the same for safety)
    const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(userId).first();

    if (!user) {
      return ctx.answerCbQuery("⚠️ Account not found. Please restart /start", { show_alert: true });
    }

    if (user.balance < TICKET_PRICE) {
      return ctx.answerCbQuery(`❌ Insufficient Funds! You need ${TICKET_PRICE} ETB.`, { show_alert: true });
    }

    // 2. ደህንነቱ የተጠበቀ የቲኬት ቁጥር ማመንጨት
    const ticketNumber = Math.floor(100000 + Math.random() * 900000);

    // 3. ዳታቤዝ ላይ በአንድ ጊዜ ማደስ (Balance update + Ticket Insert)
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?")
        .bind(TICKET_PRICE, userId, TICKET_PRICE),
      env.DB.prepare("INSERT INTO tickets (user_id, ticket_number, purchase_date, status) VALUES (?, ?, ?, 'active')")
        .bind(userId, ticketNumber, new Date().toISOString())
    ]);

    await ctx.answerCbQuery("💎 Purchase Successful!", { show_alert: false });

    // 5. PREMIUM UI DESIGN (ተጠቃሚው ሲያየው ደስ እንዲለው)
    const successMessage = `
🎊 <b>CONGRATULATIONS!</b> 🎊
━━━━━━━━━━━━━━━━━━
Your ticket has been successfully issued. You are now officially in the draw!

✨ <b>OFFICIAL TICKET</b> ✨
┌────────────────────┐
  <b>NUMBER:</b> <code>#${ticketNumber}</code>
  <b>AMOUNT:</b> <code>${TICKET_PRICE}.00 ETB</code>
  <b>STATUS:</b> <code>Verified ✅</code>
└────────────────────┘

📅 <b>DATE:</b> <code>${new Date().toLocaleString('en-GB')}</code>
━━━━━━━━━━━━━━━━━━
<i>Wishing you the best of luck! You can view all your entries in the "My Tickets" section.</i>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎟 Buy Another Ticket', 'buy_with_wallet')],
      [Markup.button.callback('📂 View My Tickets', 'view_my_tickets')],
      [Markup.button.callback('🏠 Main Menu', 'back_to_settings')]
    ]);

    // መልዕክቱን ወደ ስኬታማው ገጽ ይቀይረዋል
    return ctx.editMessageText(successMessage, { 
      parse_mode: 'HTML', 
      ...keyboard 
    });

  } catch (e) {
    console.error("Purchase Error:", e);
    return ctx.answerCbQuery("🚨 System Busy. Please try again.", { show_alert: true });
  }
});

bot.action('show_deposit_info', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const depositText = `
<b>💳 DEPOSIT METHODS</b>
━━━━━━━━━━━━━━━━━━
Choose your preferred method to add balance to your wallet.

📱 <b>Mobile Money:</b>
• <b>Telebirr:</b> <code>0911223344</code> (Name)
• <b>CBE Birr:</b>  <code>0911223344</code> (Name)

🏦 <b>Bank Transfer:</b>
• <b>CBE Bank:</b> <code>100012345678</code> (Name)

⚠️ <b>IMPORTANT STEPS:</b>
━━━━━━━━━━━━━━━━━━
1️⃣ Transfer the amount (Min: <b>10 ETB</b>).
2️⃣ Take a clear <b>Screenshot</b> of the receipt.
3️⃣ Click the button below to <b>Upload</b> your receipt.

<i>Our team will verify and add the balance within 5-30 minutes.</i>`;
  
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📸 Upload Screenshot', 'ask_for_photo')],
      [Markup.button.callback('🔙 Back to Wallet', 'back_to_wallet')]
    ]);

    return ctx.editMessageText(depositText, { 
      parse_mode: 'HTML', 
      ...keyboard 
    });
  } catch (e) {
    console.error("Deposit Info Error:", e);
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

    // ማጽደቂያ (Approval)
bot.action(/^approve_(\d+)_(\d+)$/, async (ctx) => {
  const targetId = ctx.match[1];
  const amount = ctx.match[2];

  try {
    // 1. ዳታቤዝ ላይ ብር መጨመር
    await env.DB.prepare("UPDATE users SET balance = balance + ? WHERE user_id = ?")
      .bind(amount, targetId)
      .run();

    // 2. ለተጠቃሚው ማሳወቅ
    await ctx.telegram.sendMessage(targetId, `<b>✅ Deposit Approved!</b>\n\nYour wallet has been credited with <b>${amount} ETB</b>. You can now buy tickets!`, { parse_mode: 'HTML' });

    // 3. የአድሚኑን ሜሴጅ ማደስ
    await ctx.answerCbQuery(`Success: ${amount} ETB added.`);
    return ctx.editMessageCaption(`✅ <b>Approved:</b> ${amount} ETB added to User <code>${targetId}</code>`, { parse_mode: 'HTML' });

  } catch (e) {
    return ctx.reply("Database Error: " + e.message);
  }
});

// ውድቅ ማድረጊያ (Reject)
bot.action(/^reject_(\d+)$/, async (ctx) => {
  const targetId = ctx.match[1];
  
  await ctx.telegram.sendMessage(targetId, "<b>❌ Deposit Rejected</b>\n\nYour receipt was not verified. Please contact support or send a valid screenshot.", { parse_mode: 'HTML' });
  
  await ctx.answerCbQuery("Request Rejected.");
  return ctx.editMessageCaption(`❌ <b>Rejected:</b> Request from User <code>${targetId}</code> was declined.`, { parse_mode: 'HTML' });
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
      
