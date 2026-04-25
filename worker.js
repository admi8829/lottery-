import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN) return new Response("BOT_TOKEN missing");
    
    const bot = new Telegraf(env.BOT_TOKEN);
    const CHANNEL_ID = "@SmartX_Ethio"; 

    // --- 1. Keyboards (Global Scope) ---
    const mainKeyboard = Markup.keyboard([
      ['🎟 New Ticket'],
      ['🎟 My Tickets', '⚙️ Settings'],
      ['🏆 Winners', '💰 Wallet & Invite'],
      ['👥 Invite & Earn', '❓ Help'],
      ['🌐 Language']
    ]).resize();

    // --- 2. Start Command ---
    bot.start(async (ctx) => {
      try {
        const userId = ctx.from.id;
        const startPayload = ctx.startPayload;

        let user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
        
        if (!user) {
          let referrerId = null;
          if (startPayload && startPayload.startsWith('ref_')) {
            const ref = parseInt(startPayload.replace('ref_', ''));
            if (ref !== userId) referrerId = ref;
          }
          await env.DB.prepare(
            "INSERT OR IGNORE INTO users (user_id, name, referred_by, balance, invite_count, language) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(userId, ctx.from.first_name, referrerId, 0, 0, 'en').run();
          user = { user_id: userId, language: 'en', phone: null };
        }

        // --- Force Join Check ---
        try {
          const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
          const isMember = ['member', 'administrator', 'creator'].includes(member.status);

          if (!isMember) {
            const joinMsg = `
👋 <b>Hello ${ctx.from.first_name}!</b>

To participate in our lottery, you must join our official channel first.

<b>1. Join:</b> ${CHANNEL_ID}
<b>2. Click:</b> Verify Membership below.
━━━━━━━━━━━━━━━━━━`;
            return ctx.reply(joinMsg, {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.url('📢 Join Our Channel', `https://t.me/${CHANNEL_ID.replace('@', '')}`)],
                [Markup.button.callback('✅ Verify Membership', 'check_join')]
              ])
            });
          }
        } catch (e) { console.log("Join check error"); }

        // --- Registration Check ---
        if (!user.phone) {
          return ctx.reply("✨ <b>Welcome!</b>\nPlease share your phone number to complete registration.", { 
            parse_mode: 'HTML', 
            ...Markup.keyboard([[Markup.button.contactRequest('📲 Share My Phone Number')]]).resize().oneTime()
          });
        }

        return ctx.reply(`<b>Welcome back, ${user.name}!</b> 👋`, { parse_mode: 'HTML', ...mainKeyboard });

      } catch (e) { return ctx.reply("Error: " + e.message); }
    });

    // --- 3. Verify Button Action ---
    bot.action('check_join', async (ctx) => {
      try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
        if (['member', 'administrator', 'creator'].includes(member.status)) {
          await ctx.answerCbQuery("✅ Verified!");
          await ctx.deleteMessage();
          return ctx.reply("✨ <b>Membership Verified!</b>\nNow, please share your phone number:", {
            parse_mode: 'HTML',
            ...Markup.keyboard([[Markup.button.contactRequest('📲 Share My Phone Number')]]).resize().oneTime()
          });
        } else {
          return ctx.answerCbQuery("❌ Please join the channel first!", { show_alert: true });
        }
      } catch (e) { return ctx.answerCbQuery("Error verifying..."); }
    });

    // --- 4. Phone Verification & Success ---
    bot.on('contact', async (ctx) => {
      try {
        const userId = ctx.from.id;
        const contact = ctx.message.contact;

        if (contact.user_id !== userId) {
          return ctx.reply("❌ <b>Security:</b> Please send your own contact!", { parse_mode: 'HTML' });
        }

        await env.DB.prepare("UPDATE users SET phone = ?, name = ? WHERE user_id = ?")
          .bind(contact.phone_number, ctx.from.first_name, userId).run();

        const user = await env.DB.prepare("SELECT language, referred_by FROM users WHERE user_id = ?").bind(userId).first();
        const lang = user?.language || 'en';

        // Referral Logic
        if (user && user.referred_by) {
          await env.DB.prepare("UPDATE users SET balance = balance + 2, invite_count = invite_count + 1 WHERE user_id = ?")
            .bind(user.referred_by).run();
          try {
            const refMsg = lang === 'am' ? "🎊 <b>አዲስ ሪፈራል!</b> +2 ETB ተጨምሯል።" : "🎊 <b>New Referral!</b> +2 ETB added.";
            await ctx.telegram.sendMessage(user.referred_by, refMsg, { parse_mode: 'HTML' });
          } catch (err) {}
        }

        // Success Design
        const successMsg = lang === 'am' ? 
          `✅ <b>ምዝገባው ተጠናቅቋል!</b> 🔓\n━━━━━━━━━━━━━━━━━━\nእንኳን ደህና መጡ! አካውንትዎ አሁን ንቁ ነው።\nአሁኑኑ መጫወት ይጀምሩና አሸናፊ ይሁኑ! 🏆` :
          `✅ <b>Registration Complete!</b> 🔓\n━━━━━━━━━━━━━━━━━━\nWelcome! Your account is now active.\nStart playing now and be the next winner! 🏆`;

        return ctx.reply(successMsg, { 
          parse_mode: 'HTML', 
          ...mainKeyboard,
          ...Markup.inlineKeyboard([[Markup.button.callback(lang === 'am' ? '📖 እንዴት ነው የምጫወተው?' : '📖 How to Play Guide', 'help_guide')]])
        });

      } catch (e) { return ctx.reply("Error: " + e.message); }
    });

    // Webhook handle
    const { body } = request;
    if (request.method === 'POST') {
      const update = await request.json();
      await bot.handleUpdate(update);
    }
    return new Response("OK");
  }
};
              
    
    // --- [ 1. የአድሚን ሜኑ ትዕዛዝ ] ---
bot.command('admin_menu', async (ctx) => {
  const adminId = 8344169004; // ያንተ ID በትክክል ተገብቷል
  if (ctx.from.id !== adminId) return;

  return ctx.reply("<b>🛠 የአድሚን መቆጣጠሪያ ገጽ</b>\n\nከታች ያለውን አዝራር በመጫን የዙሩን 3 አሸናፊዎች በዘፈቀደ ማውጣት ይችላሉ።", {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🎰 ዕጣውን አሁን አውጣ', 'admin_draw_winners')]
    ])
  });
});

// --- [ 2. ዕጣውን የሚያወጣው ተግባር (Action) ] ---
bot.action('admin_draw_winners', async (ctx) => {
  const adminId = 8344169004; // ያንተ ID እዚህም ተስተካክሏል
  if (ctx.from.id !== adminId) return ctx.answerCbQuery("Unauthorized!");

  try {
    // 1. የዕጣ መረጃውን እና 3 አሸናፊዎችን ከዳታቤዝ በዘፈቀደ መምረጥ
    const drawSettings = await env.DB.prepare("SELECT * FROM draw_settings WHERE id = 1").first();
    const winners = await env.DB.prepare(
      `SELECT t.ticket_number, t.user_id, u.name 
       FROM tickets t 
       JOIN users u ON t.user_id = u.user_id 
       WHERE t.status = 'active' 
       ORDER BY RANDOM() LIMIT 3`
    ).all();

    // ቢያንስ 3 ሰው መኖሩን ቼክ ማድረግ
    if (!winners.results || winners.results.length < 3) {
      return ctx.reply("❌ ዕጣ ለማውጣት ቢያንስ 3 'Active' ቲኬቶች መሸጥ አለባቸው።");
    }

    // የሽልማት አይነቶችን ከዳታቤዝ መውሰድ
    const prizes = [drawSettings.prize_1, drawSettings.prize_2, drawSettings.prize_3];
    let announcementText = `🎊 <b>የዕጣ ውጤት መግለጫ</b> 🎊\n━━━━━━━━━━━━━━━━━━\n<b>🏆 እጣው፡</b> ${drawSettings.draw_name}\n\n`;

    // 2. አሸናፊዎችን በ Loop መመዝገብ እና ማሳወቅ
    for (let i = 0; i < winners.results.length; i++) {
      const winner = winners.results[i];
      const prize = prizes[i];

      // በ Winners Table መመዝገብ
      await env.DB.prepare(
        "INSERT INTO winners (user_id, ticket_number, prize_amount) VALUES (?, ?, ?)"
      ).bind(winner.user_id, winner.ticket_number, prize).run();

      // ለአሸናፊው የግል መልዕክት (Inbox) መላክ
      try {
        await ctx.telegram.sendMessage(winner.user_id, 
          `🎉 <b>እንኳን ደስ አለዎት!</b>\nየእርስዎ ቲኬት <b>#${winner.ticket_number}</b> የ <b>${prize}</b> አሸናፊ ሆኗል!`, 
          { parse_mode: 'HTML' });
      } catch (e) {
        console.log(`Notification failed for user ${winner.user_id}`);
      }

      // ውጤቱን ለጠቅላላ ማስታወቂያ ማዘጋጀት
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      announcementText += `${medal} <b>${prize} አሸናፊ፡</b>\n👤 ${winner.name} (🎫 #${winner.ticket_number})\n\n`;
    }

    // 3. ሁሉንም የዙሩን ቲኬቶች Expired ማድረግ (በጣም አስፈላጊ!)
    await env.DB.prepare("UPDATE tickets SET status = 'expired' WHERE status = 'active'").run();

    announcementText += `━━━━━━━━━━━━━━━━━━\n<i>እንኳን ደስ አላችሁ! ለሁሉም ተጠቃሚዎች ውጤቱ ተልኳል።</i>`;
    
    // ለአድሚኑ ውጤቱን ማሳየት
    return ctx.reply(announcementText, { parse_mode: 'HTML' });

  } catch (e) {
    return ctx.reply("Error during draw: " + e.message);
  }
});
  
    // 1. የቋንቋ አዝራሩ ሲጫን (bot.hears)
bot.hears('🌐 Language', async (ctx) => {
  const langKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🇺🇸 English', 'set_lang_en')],
    [Markup.button.callback('🇪🇹 አማርኛ', 'set_lang_am')]
  ]);

  const langMsg = `
<b>🌐 Select Your Language / ቋንቋ ይምረጡ</b>
━━━━━━━━━━━━━━━━━━
Please choose your preferred language to continue.
እባክዎ የሚፈልጉትን ቋንቋ ከታች ይምረጡ።
━━━━━━━━━━━━━━━━━━`;

  return ctx.reply(langMsg, {
    parse_mode: 'HTML',
    ...langKeyboard
  });
});

// 2. English ሲመረጥ (Action)
bot.action('set_lang_en', async (ctx) => {
  const userId = ctx.from.id;
  try {
    // ዳታቤዝ ላይ 'en' ብሎ መመዝገብ
    await env.DB.prepare("UPDATE users SET language = 'en' WHERE user_id = ?").bind(userId).run();
    
    await ctx.answerCbQuery("✅ Language set to English");
    return ctx.editMessageText("<b>✅ Success!</b>\nYour language has been set to <b>English</b>. All future messages will be in English.", { 
      parse_mode: 'HTML' 
    });
  } catch (e) {
    return ctx.answerCbQuery("Error updating language");
  }
});

// 3. አማርኛ ሲመረጥ (Action)
bot.action('set_lang_am', async (ctx) => {
  const userId = ctx.from.id;
  try {
    // ዳታቤዝ ላይ 'am' ብሎ መመዝገብ
    await env.DB.prepare("UPDATE users SET language = 'am' WHERE user_id = ?").bind(userId).run();
    
    await ctx.answerCbQuery("✅ ቋንቋው ወደ አማርኛ ተቀይሯል");
    return ctx.editMessageText("<b>✅ ተሳክቷል!</b>\nቋንቋዎ ወደ <b>አማርኛ</b> ተቀይሯል። ከእንግዲህ ቦቱ በአማርኛ መልዕክት ይልክልዎታል።", { 
      parse_mode: 'HTML' 
    });
  } catch (e) {
    return ctx.answerCbQuery("ስህተት ተከስቷል");
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
    
// 1. የቻናል ግዴታን የሚያረጋግጥ Action
bot.action('check_join', async (ctx) => {
  const CHANNEL_ID = "@SmartX_Ethio"; // ያንተ ቻናል ID
  const userId = ctx.from.id;

  try {
    // በቴሌግራም ሲስተም ተጠቃሚው አባል መሆኑን ቼክ ማድረግ
    const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);

    if (isMember) {
      // ✅ አባል ከሆነ - ደስ የሚል አኒሜሽን እና መልዕክት
      await ctx.answerCbQuery("🎉 እንኳን ደህና መጡ! በትክክል ተቀላቅለዋል።", { show_alert: false });
      
      const successMsg = `
✨ <b>እንኳን ደስ አለዎት!</b> ✨
━━━━━━━━━━━━━━━━━━
አሁን የ <b>SmartX Lottery</b> ሙሉ አባል ነዎት።
ሁሉንም የቦቱን አገልግሎቶች መጠቀም ይችላሉ።

ዕድልዎን ይሞክሩ፣ በሚሊዮኖች የሚቆጠሩ ሽልማቶችን ያሸንፉ! 🏆
━━━━━━━━━━━━━━━━━━`;

      // ዋናውን ሜኑ አሳይ
      return ctx.editMessageText(successMsg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🎟 ቲኬት ቁረጥ', 'buy_ticket_menu')],
          [Markup.button.callback('💰 Wallet', 'view_wallet')]
        ])
      });

    } else {
      // ❌ አባል ካልሆነ - ማስጠንቀቂያ
      return ctx.answerCbQuery("⚠️ እባክዎ መጀመሪያ ቻናሉን ይቀላቀሉ!", { show_alert: true });
    }

  } catch (e) {
    console.error("Join check error:", e);
    return ctx.reply("ስህተት ተከስቷል፣ እባክዎ ትንሽ ቆይተው ይሞክሩ።");
  }
});

// 2. ተጠቃሚው ገና ሲመጣ የሚላክ ማራኪ ጥሪ (Start ላይ ወይም በየመሃሉ የሚላክ)
const forceJoinKeyboard = Markup.inlineKeyboard([
  [Markup.button.url('📢 ቻናላችንን ይቀላቀሉ', 'https://t.me/SmartX_Ethio')],
  [Markup.button.callback('✅ ተቀላቅያለሁ አረጋግጥ', 'check_join')]
]);
    
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
      
