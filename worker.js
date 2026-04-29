import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN) return new Response("BOT_TOKEN missing");
    
    const bot = new Telegraf(env.BOT_TOKEN);
    const CHANNEL_ID = "@SmartX_Ethio"; // ያንተ ቻናል
    const ADMIN_ID = 8344169004;
    const ADMIN_GROUP_ID = -1003879708444
    
    // --- 1. Keyboards ---
const mainKeyboard = Markup.keyboard([
  ['🎟 New Ticket'],
  ['🎟 My Tickets', '💰 Wallet & Invite'],
  ['🏆 Winners', '👥 Invite & Earn'],
  ['⚙️ Settings', '❓ Help', '🛡 Privacy'], // ሦስቱንም በአንድ መስመር
  ['👨‍✈️ Admin', '👨‍💻 Contact Developer'] // አድሚን እና ዴቨሎፐርን ጎን ለጎን
]).resize();
    
     const requestPhoneKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📲 send to phone ')]
    ]).resize();

    // --- 2. Start Command ---
    // --- 2. Start Command ---
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const startPayload = ctx.startPayload;
    
    // 1. ተጠቃሚው መኖሩን ማረጋገጥ
    const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

    // 2. ተጠቃሚው ቀድሞ ተመዝግቦ ከሆነ
    if (user && user.phone) {
      // ቻናሉ ላይ መኖሩን ቼክ እናድርግ
      const member = await ctx.telegram.getChatMember("@SmartX_Ethio", userId).catch(() => ({ status: 'left' }));
      const isMember = ['member', 'administrator', 'creator'].includes(member.status);

      if (isMember) {
        return ctx.reply(`👋 <b>Welcome Back, ${user.name}!</b>\n━━━━━━━━━━━━━━━━━━\n<i>Your account is secure and active.</i>`, { 
          parse_mode: 'HTML', ...mainKeyboard 
        });
      } else {
        // ስልክ አለው ግን ቻናሉን ለቆ ከሆነ
        return ctx.reply("👋 <b>Welcome Back!</b>\nPlease <b>re-join</b> our channel to access the bot features.", {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('📢 Join Channel', 'https://t.me/SmartX_Ethio')],
            [Markup.button.callback('✅ I Have Joined', 'check_join')]
          ])
        });
      }
    }

    // 3. አዲስ ተጠቃሚ ከሆነ (Registration)
    let referrerId = null;
    if (startPayload && startPayload.startsWith('ref_')) {
      const ref = parseInt(startPayload.replace('ref_', ''));
      if (ref !== userId) referrerId = ref;
    }

    await env.DB.prepare(
      "INSERT OR IGNORE INTO users (user_id, name, referred_by, balance, invite_count) VALUES (?, ?, ?, 0, 0)"
    ).bind(userId, ctx.from.first_name, referrerId).run();

    const welcomeMsg = `
✨ <b>SMARTX LOTTERY</b> ✨
━━━━━━━━━━━━━━━━━━
Welcome! To start winning, please complete these steps:

1️⃣ <b>Join:</b> @SmartX_Ethio
2️⃣ <b>Verify:</b> Share your contact below.
━━━━━━━━━━━━━━━━━━`;

    return ctx.reply(welcomeMsg, { parse_mode: 'HTML', ...requestPhoneKeyboard });

  } catch (e) {
    console.error(e);
    return ctx.reply("⚠️ Connection error. Please /start again.");
  }
});

// --- 3. Phone Verification ---
bot.on('contact', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const contact = ctx.message.contact;

    if (contact.user_id !== userId) {
      return ctx.reply("❌ <b>Security Alert!</b>\nPlease share <b>your own</b> contact using the button.", { parse_mode: 'HTML' });
    }

    await env.DB.prepare("UPDATE users SET phone = ?, name = ? WHERE user_id = ?")
      .bind(contact.phone_number, ctx.from.first_name, userId).run();

    // Referral System
    const user = await env.DB.prepare("SELECT referred_by FROM users WHERE user_id = ?").bind(userId).first();
    if (user?.referred_by) {
      await env.DB.prepare("UPDATE users SET balance = balance + 2, invite_count = invite_count + 1 WHERE user_id = ?").bind(user.referred_by).run();
      ctx.telegram.sendMessage(user.referred_by, "🎊 <b>Referral Success!</b>\nYour friend joined. <b>+2 ETB</b> added to your wallet.", { parse_mode: 'HTML' }).catch(() => {});
    }

    // --- SECURITY & UX CHECK ---
    const member = await ctx.telegram.getChatMember("@SmartX_Ethio", userId).catch(() => ({ status: 'left' }));
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);

    if (isMember) {
      return ctx.reply(`✅ <b>Verification Success!</b>\nYou are already a member. Access granted.`, {
        parse_mode: 'HTML', ...mainKeyboard 
      });
    }

    const completionMsg = `
✨ <b>REGISTRATION SUCCESS!</b> ✨
━━━━━━━━━━━━━━━━━━
Final step: Join our channel to unlock the <b>Main Menu</b> and see results.
━━━━━━━━━━━━━━━━━━`;

    return ctx.reply(completionMsg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Join Official Channel', 'https://t.me/SmartX_Ethio')],
        [Markup.button.callback('✅ I Have Joined', 'check_join')]
      ])
    });

  } catch (e) {
    return ctx.reply("⚠️ System Error. Please try again.");
  }
});

// --- 4. Admin Menu ---
          
                                                                                                                      
                                                                                                                      
                                                                                                                      
                                                                                                                      
  bot.command('admin_menu', async (ctx) => {
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
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("Unauthorized!");

  try {
    // 1. Fetch draw settings with Safety Check
    const drawSettings = await env.DB.prepare("SELECT * FROM draw_settings WHERE id = 1").first();
    
    if (!drawSettings) {
      return ctx.reply("🚨 <b>Error:</b> Draw settings not found. Please run the SQL setup first.");
    }

    const currentRound = drawSettings.draw_name || "Round 1";
    
    // 2. Select 3 Random Winners from Active Tickets
    const winners = await env.DB.prepare(
      `SELECT t.ticket_number, t.user_id, u.name 
       FROM tickets t 
       JOIN users u ON t.user_id = u.user_id 
       WHERE t.status = 'active' 
       ORDER BY RANDOM() LIMIT 3`
    ).all();

    if (!winners.results || winners.results.length < 3) {
      return ctx.reply("❌ <b>Draw Failed:</b> Minimum 3 'Active' tickets required to pick winners.", { parse_mode: 'HTML' });
    }

    const prizes = [drawSettings.prize_1, drawSettings.prize_2, drawSettings.prize_3];
    const ranks = ["1st Prize", "2nd Prize", "3rd Prize"];
    
    let announcementText = `🎊 <b>OFFICIAL DRAW RESULTS</b> 🎊\n`;
    announcementText += `━━━━━━━━━━━━━━━━━━━━\n`;
    announcementText += `🏆 <b>Event:</b> <code>${currentRound}</code>\n`;
    announcementText += `📅 <b>Date:</b> <code>${new Date().toLocaleDateString()}</code>\n`;
    announcementText += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 3. Process Winners
    for (let i = 0; i < winners.results.length; i++) {
      const winner = winners.results[i];
      const prize = prizes[i];
      const rank = ranks[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';

      // Save to Winners Table
      await env.DB.prepare(
        "INSERT INTO winners (draw_round, winner_name, ticket_number, prize_amount, rank_label) VALUES (?, ?, ?, ?, ?)"
      ).bind(currentRound, winner.name, winner.ticket_number, prize, rank).run();

      // Notify the Winner Privately
      try {
        const winnerMsg = `🎉 <b>CONGRATULATIONS!</b>\n\nYou have won the <b>${rank} (${prize})</b> in <b>${currentRound}</b>!\n\n🎫 Ticket: <b>#${winner.ticket_number}</b>\n\nPlease contact the Admin to claim your prize! 🎁`;
        await ctx.telegram.sendMessage(winner.user_id, winnerMsg, { parse_mode: 'HTML' });
      } catch (e) {
        console.log(`Could not DM user ${winner.user_id}`);
      }

      announcementText += `${medal} <b>${rank} Winner</b>\n`;
      announcementText += `┣ 👤 <b>Name:</b> ${winner.name}\n`;
      announcementText += `┣ 🎫 <b>Ticket:</b> <code>#${winner.ticket_number}</code>\n`;
      announcementText += `┗ 🎁 <b>Prize:</b> <b>${prize}</b>\n\n`;
    }

    announcementText += `━━━━━━━━━━━━━━━━━━━━\n`;
    announcementText += `✨ <i>Congratulations to all the winners! Stay tuned for the next round.</i>`;

    // 4. Auto-Increment Round Name
    const nextRoundNum = parseInt(currentRound.replace(/[^0-9]/g, '')) + 1 || 2;
    const nextRoundName = `Round ${nextRoundNum}`;

    // 5. Update DB (Expire tickets & Set Next Round)
    await env.DB.batch([
      env.DB.prepare("UPDATE tickets SET status = 'expired' WHERE status = 'active'"),
      env.DB.prepare("UPDATE draw_settings SET draw_name = ? WHERE id = 1").bind(nextRoundName)
    ]);

    // 6. Send to Group & Admin
    try {
        await ctx.telegram.sendMessage(ADMIN_GROUP_ID, announcementText, { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Failed to forward to group:", e);
    }

    return ctx.reply(announcementText, { parse_mode: 'HTML' });

  } catch (e) {
    console.error("Draw Error:", e);
    return ctx.reply("🚨 <b>Critical Error:</b> " + e.message);
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
    // 1. መረጃዎችን ከዳታቤዝ ማምጣት (Security: ተጠቃሚው መኖሩን እናረጋግጣለን)
    const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(userId).first();
    const draw = await env.DB.prepare("SELECT * FROM draw_settings LIMIT 1").first();

    // ተጠቃሚው ዳታቤዝ ውስጥ ካልተመዘገበ (Security Check)
    if (!user) {
      return ctx.reply("⚠️ <b>Account Not Found!</b>\nPlease restart the bot by sending /start", { parse_mode: 'HTML' });
    }

    const balance = user.balance || 0;
    const currentDraw = draw?.draw_name || "Weekly Grand Draw";
    const ticketPrice = 10;

    // ሽልማቶቹን ከዳታቤዝ ማምጣት (id=1 ካልሰራ LIMIT 1 ያመጣዋል)
    const p1 = draw?.prize_1 || "TBA";
    const p2 = draw?.prize_2 || "TBA";
    const p3 = draw?.prize_3 || "TBA";

    // የጋራ የሽልማት ዝርዝር ዲዛይን (ለሁለቱም ሁኔታዎች እንዲያገለግል)
    const prizeSection = `
🎁 <b>AVAILABLE PRIZES:</b>
🥇 1st Prize: <b>${p1}</b>
🥈 2nd Prize: <b>${p2}</b>
🥉 3rd Prize: <b>${p3}</b>`;

    // --- ሁኔታ 1: በቂ ብር ካለው ---
    if (balance >= ticketPrice) {
      const confirmKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`✅ Confirm Purchase (${ticketPrice} ETB)`, 'buy_with_wallet')],
        [Markup.button.callback('❌ Cancel', 'action_cancelled')]
      ]);

      const purchaseMsg = `
✨ <b>NEW TICKET Oakton, Uni PURCHASE</b> ✨
━━━━━━━━━━━━━━━━━━
🏆 <b>Event:</b> <code>${currentDraw}</code>
${prizeSection}
━━━━━━━━━━━━━━━━━━
💰 <b>Ticket Price:</b> <code>${ticketPrice} ETB</code>
💳 <b>Your Balance:</b> <code>${balance} ETB</code>
━━━━━━━━━━━━━━━━━━
<i>Click the button below to secure your entry! 🚀</i>`;

      return ctx.reply(purchaseMsg, { parse_mode: 'HTML', ...confirmKeyboard });
    } 

    // --- ሁኔታ 2: በቂ ብር ከሌለው (አሁን እዚህም የሽልማት ዝርዝሩ ይመጣል) ---
    else {
      const depositKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📥 Deposit Money', 'show_deposit_info')],
        [Markup.button.callback('👥 Invite Friends', 'view_invite_link')],
        [Markup.button.callback('📂 View My Tickets', 'view_my_tickets')]
      ]);

      const lowBalanceMsg = `
<b>❌ INSUFFICIENT  BALANCE!</b>
━━━━━━━━━━━━━━━━━━
🏆 <b>Event:</b> <code>${currentDraw}</code>
${prizeSection}
━━━━━━━━━━━━━━━━━━
📉 <b>Your Balance:</b> <code>${balance} ETB</code>
🎟 <b>Required:</b> <code>${ticketPrice} ETB</code>

<i>You need more balance to win these amazing prizes! Deposit now or invite friends to earn.</i>`;

      return ctx.reply(lowBalanceMsg, { parse_mode: 'HTML', ...depositKeyboard });
    }

  } catch (e) {
    console.error("New Ticket Error:", e);
    return ctx.reply("⚠️ <b>System Error:</b> Please try again later.");
  }
});
  

 // ደረጃ 1፡ ተጠቃሚው መጀመሪያ እንዲያረጋግጥ መጠየቅ (ብሩ ገና አይቆረጥም)
bot.action('buy_with_wallet', async (ctx) => {
  const userId = ctx.from.id;
  const TICKET_PRICE = 10;

  try {
    const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(userId).first();

    if (!user || user.balance < TICKET_PRICE) {
      return ctx.answerCbQuery("❌ Insufficient Funds!", { show_alert: true });
    }

    const confirmMsg = `
<b>💳 TICKET CONFIRMATION</b>
━━━━━━━━━━━━━━━━━━
<b>Product:</b> 🎟 1 entry Ticket
<b>Price:</b> <code>${TICKET_PRICE} ETB</code>
<b>Your Balance:</b> <code>${user.balance} ETB</code>
━━━━━━━━━━━━━━━━━━
<i>Note: 10 ETB will be deducted after you click the button below.</i>`;

    const keyboard = Markup.inlineKeyboard([
  [Markup.button.callback('✅ Confirm & Purchase', 'finalize_buy_ticket')],
  [Markup.button.callback('❌ Cancel', 'action_cancelled')] 
]);
    
    return ctx.editMessageText(confirmMsg, { parse_mode: 'HTML', ...keyboard });

  } catch (e) {
    return ctx.answerCbQuery("🚨 Error checking balance.");
  }
});

// ደረጃ 2፡ ተጠቃሚው ሲያጸድቅ ብሩ ተቆርጦ ቲኬቱ ይመዘገባል
bot.action('finalize_buy_ticket', async (ctx) => {
  const userId = ctx.from.id;
  const TICKET_PRICE = 10;

  try {
    const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(userId).first();

    if (!user || user.balance < TICKET_PRICE) {
      return ctx.answerCbQuery("❌ Insufficient balance to complete purchase!", { show_alert: true });
    }

    const ticketNumber = Math.floor(100000 + Math.random() * 900000);

    // --- ብሩ የሚቀነሰውና ቲኬቱ የሚመዘገበው እዚህ ጋር ብቻ ነው ---
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?")
        .bind(TICKET_PRICE, userId, TICKET_PRICE),
      env.DB.prepare("INSERT INTO tickets (user_id, ticket_number, purchase_date, status) VALUES (?, ?, ?, 'active')")
        .bind(userId, ticketNumber, new Date().toISOString())
    ]);

    await ctx.answerCbQuery("💎 Purchase Successful!");

    const successMessage = `
🎊 <b>CONGRATULATIONS!</b> 🎊
━━━━━━━━━━━━━━━━━━
Your ticket has been successfully issued.

✨ <b>OFFICIAL TICKET</b> ✨
┌────────────────────┐
  <b>NUMBER:</b> <code>#${ticketNumber}</code>
  <b>AMOUNT:</b> <code>${TICKET_PRICE}.00 ETB</code>
  <b>STATUS:</b> <code>Verified ✅</code>
└────────────────────┘

📅 <b>DATE:</b> <code>${new Date().toLocaleString('en-GB')}</code>
━━━━━━━━━━━━━━━━━━
<i>Thank you for participating! Good luck.</i>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Finished', 'back_to_settings')]
    ]);

    return ctx.editMessageText(successMessage, { 
      parse_mode: 'HTML', 
      ...keyboard 
    });

  } catch (e) {
    console.error(e);
    return ctx.answerCbQuery("🚨 System Error. Try again.");
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
    

bot.action('back_to_settings', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    // የቆየውን የቲኬት መልዕክት ያጠፋዋል
    await ctx.deleteMessage().catch(() => {}); 

    // ዋናውን ሜኑ (Main Menu) መልሶ ያመጣለታል
    return ctx.reply(`<b>🏠 Main Menu</b>\n━━━━━━━━━━━━━━━━━━\nWelcome back! Choose an option from the menu below:`, {
      parse_mode: 'HTML',
      ...mainKeyboard // ዋናው ሜኑ እንዲመጣ
    });
  } catch (e) {
    console.error("Back to menu error:", e);
  }
});

bot.action('action_cancelled', async (ctx) => {
  try {
    // 1. ሰዓቱን (loading) ለማጥፋት
    await ctx.answerCbQuery("Action Cancelled");

    // 2. የነበረውን የክፍያ ማረጋገጫ መልዕክት ለማጥፋት
    await ctx.deleteMessage().catch(() => {});

    // 3. አጭር የማረጋገጫ መልዕክት ለመላክ
    return ctx.reply("<b>❌ Purchase Cancelled</b>\nYour balance remains unchanged. Use the menu below to continue.", {
      parse_mode: 'HTML',
      ...mainKeyboard // ዋናው ዝርዝር አዝራሮች ተመልሰው እንዲመጡ
    });
  } catch (e) {
    console.error("Cancel error:", e);
  }
});
    
bot.hears('🎟 My Tickets', async (ctx) => {
  const userId = ctx.from.id;
  try {
    const tickets = await env.DB.prepare("SELECT ticket_number, status FROM tickets WHERE user_id = ? ORDER BY purchase_date DESC")
      .bind(userId).all();

    if (!tickets.results || tickets.results.length === 0) {
      return ctx.reply("<b>📂 My Tickets</b>\n━━━━━━━━━━━━━━━━━━\n<i>You have no tickets yet.</i>", { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🎟 Buy Now', 'buy_with_wallet')]])
      });
    }

    let activeList = [];
    let pastList = [];

    tickets.results.forEach(t => {
      const formatted = `<code>#${t.ticket_number}</code>`;
      if (t.status === 'active') activeList.push(formatted);
      else pastList.push(formatted);
    });

    // መልዕክቱን በአጭሩ ማቀናጀት (ጎን ለጎን)
    let msg = `<b>📂 YOUR TICKETS</b>\n━━━━━━━━━━━━━━━━━━\n`;
    
    if (activeList.length > 0) {
      msg += `<b>🟢 ACTIVE (${activeList.length}):</b>\n${activeList.join('  |  ')}\n\n`;
    }
    
    if (pastList.length > 0) {
      msg += `<b>🔴 PAST (${pastList.length}):</b>\n${pastList.join('  |  ')}\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━`;

    return ctx.reply(msg, { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🎟 Buy New', 'buy_with_wallet')],
        [Markup.button.callback('🔙 Main Menu', 'back_to_settings')]
      ])
    });

  } catch (e) {
    return ctx.reply("⚠️ Error loading tickets.");
  }
});

bot.hears('🏆 Winners', async (ctx) => {
  try {
    // Fetch the last 10 winners from the database
    const winners = await env.DB.prepare(
      "SELECT draw_round, winner_name, ticket_number, prize_amount, rank_label FROM winners ORDER BY id DESC LIMIT 10"
    ).all();

    let winnersMsg = `<b>🏆 HALL OF FAME: RECENT WINNERS</b>\n━━━━━━━━━━━━━━━━━━\n`;

    if (!winners.results || winners.results.length === 0) {
      winnersMsg += `<i>No winners recorded yet. Your name could be here next! ⏳</i>\n`;
    } else {
      winners.results.forEach((w) => {
        winnersMsg += `<b>⭐ ${w.draw_round}</b>\n`;
        winnersMsg += `┃ 🏆 <b>Rank:</b> <code>${w.rank_label}</code>\n`;
        winnersMsg += `┃ 👤 <b>Winner:</b> <code>${w.winner_name}</code>\n`;
        winnersMsg += `┃ 🎫 <b>Ticket:</b> <code>#${w.ticket_number}</code>\n`;
        winnersMsg += `┃ 🎁 <b>Prize:</b> <b>${w.prize_amount}</b>\n`;
        winnersMsg += `━━━━━━━━━━━━━━━━━━\n`;
      });
      winnersMsg += `<i>Congratulations to all our lucky winners! 🎉</i>`;
    }

    // Navigation buttons
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎟 Buy Ticket Now', 'buy_with_wallet')],
      [Markup.button.callback('🔙 Back to Menu', 'back_to_settings')]
    ]);

    return ctx.reply(winnersMsg, { 
      parse_mode: 'HTML',
      ...keyboard 
    });

  } catch (e) {
    console.error("Winners View Error:", e);
    return ctx.reply("⚠️ <b>System Error:</b> Could not load the winners list. Please try again later.");
  }
});

    bot.hears('❓ Help', async (ctx) => {
  const helpMessage = `
<b>❓ SMARTX HELP CENTER</b>
━━━━━━━━━━━━━━━━━━
Welcome to the help section! Here is everything you need to know about using the <b>SmartX Lottery Bot</b>.

<b>1. How to Buy a Ticket?</b>
• Go to the <b>Main Menu</b> and click on <b>🎟 New Ticket</b>.
• Ensure you have at least <b>10 ETB</b> in your wallet.
• Confirm your purchase to receive your unique ticket number.

<b>2. How to Deposit Money?</b>
• Click on <b>💰 Wallet & Invite</b> and then <b>📥 Deposit</b>.
• Choose your preferred payment method (Telebirr, CBE, etc.).
• Send the money and <b>Upload a Screenshot</b> of the receipt for admin verification.

<b>3. How to Earn for Free?</b>
• Use the <b>👥 Invite & Earn</b> section to get your referral link.
• Share it with friends! You will receive <b>2 ETB</b> for every person who joins and registers.

<b>4. When is the Draw?</b>
• Draws are held regularly. You can check the <b>🏆 Winners</b> section to see results from previous rounds.

<b>5. Still need assistance?</b>
• If you have any issues with payments or tickets, contact our support team directly.
━━━━━━━━━━━━━━━━━━
👤 <b>Support:</b> @AdminUsername
📢 <b>Channel:</b> @SmartX_Ethio`;

  const helpKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('👨‍💻 Contact Support', 'contact_support')],
    [Markup.button.callback('🔙 Back to Menu', 'back_to_settings')]
  ]);

  return ctx.reply(helpMessage, { 
    parse_mode: 'HTML', 
    ...helpKeyboard 
  });
});

// ለ Contact Support አዝራር የሚሆን ምላሽ
bot.action('contact_support', (ctx) => {
  return ctx.reply("<b>📩 Support Inquiry</b>\nPlease send your message directly to @AdminUsername. Make sure to include your User ID if it's a payment issue.", { parse_mode: 'HTML' });
});

    
  bot.hears('👨‍💻 Contact Developer', async (ctx) => {
  const devMessage = `
<b>🚀 NEED A CUSTOM DIGITAL SOLUTION?</b>
━━━━━━━━━━━━━━━━━━
Hi! I am a <b>Full-Stack Developer</b> specialized in building high-performance digital products tailored to your needs.

<b>🛠 What I Can Build For You:</b>
• 🤖 <b>Telegram Bots:</b> Advanced bots with payment systems, database integration (like this one!), and AI.
• 🌐 <b>Websites:</b> Professional, responsive, and SEO-optimized web applications for business or personal use.
• 📱 <b>Mobile Apps:</b> User-friendly Android and iOS applications with modern features.

<b>💡 Why Choose My Services?</b>
✅ Secure and Scalable Code
✅ Modern and Clean UI/UX Design
✅ Fast Delivery & Ongoing Support
✅ Affordable Pricing for Quality Work

━━━━━━━━━━━━━━━━━━
<b>📩 LET'S WORK TOGETHER!</b>
Ready to turn your idea into reality? Contact me directly:

👤 <b>Telegram:</b> @YourUsername
📢 <b>Portfolio:</b> @YourChannel
━━━━━━━━━━━━━━━━━━
<i>"Transforming ideas into powerful digital experiences."</i>`;

  const devKeyboard = Markup.inlineKeyboard([
    [Markup.button.url('✉️ Send Message', 'https://t.me/YourUsername')],
    [Markup.button.callback('🔙 Back to Menu', 'back_to_settings')]
  ]);

  return ctx.reply(devMessage, { 
    parse_mode: 'HTML', 
    ...devKeyboard 
  });
});

bot.hears('👨‍✈️ Admin', async (ctx) => {
  const userId = ctx.from.id;

  // 1. ለአድሚን የሚታይ የቁጥጥር ፓነል (Admin View)
  if (userId === ADMIN_ID) {
    const adminPanelMsg = `
<b>🛠 ADMIN CONTROL PANEL</b>
━━━━━━━━━━━━━━━━━━
Welcome back, <b>Chief Administrator!</b>
You have full access to the system management tools.

<b>Available Actions:</b>
• Draw winners for the current round
• Manage user balances and deposits
• Send global announcements
• View system statistics
━━━━━━━━━━━━━━━━━━
<i>What would you like to manage today?</i>`;

    const adminPanelKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎰 Open Draw Menu', 'admin_draw_winners')],
      [Markup.button.callback('📊 View Stats', 'view_stats')],
      [Markup.button.callback('🔙 Close Panel', 'back_to_settings')]
    ]);

    return ctx.reply(adminPanelMsg, { 
      parse_mode: 'HTML', 
      ...adminPanelKeyboard 
    });
  } 

  // 2. ለተራ ተጠቃሚዎች የሚታይ መረጃ (User View)
  else {
    const contactAdminMsg = `
<b>👨‍✈️ CONTACT ADMINISTRATION</b>
━━━━━━━━━━━━━━━━━━
Need help or have a business inquiry? Our official admin team is available to assist you.

<b>You can contact us for:</b>
✅ Payment & Deposit Issues
✅ Prize Claiming Process
✅ Partnership & Advertising
✅ Reporting Technical Bugs

━━━━━━━━━━━━━━━━━━
<b>Official Admin:</b> @AdminUsername
<b>Working Hours:</b> 2:00 AM - 6:00 PM (Local Time)
━━━━━━━━━━━━━━━━━━
<i>Please send your message with your User ID: <code>${userId}</code> for faster support.</i>`;

    const userContactKeyboard = Markup.inlineKeyboard([
      [Markup.button.url('📩 Message Admin Now', 'https://t.me/AdminUsername')],
      [Markup.button.callback('🔙 Back to Menu', 'back_to_settings')]
    ]);

    return ctx.reply(contactAdminMsg, { 
      parse_mode: 'HTML', 
      ...userContactKeyboard 
    });
  }
});

 bot.hears('🛡 Privacy', async (ctx) => {
  const privacyMessage = `
<b>🛡 PRIVACY & SECURITY POLICY</b>
━━━━━━━━━━━━━━━━━━
At <b>SmartX Lottery</b>, we take your privacy seriously. Here is how we handle your information:

<b>1. Data Collection 📊</b>
• We only collect your <b>Telegram ID</b>, <b>Name</b>, and <b>Phone Number</b> (with your permission) to verify your tickets and prizes.
• Payment screenshots are used only for transaction verification.

<b>2. Secure Transactions 🔐</b>
• All your balance and ticket data are stored in a secure encrypted database.
• We do not share your personal information with any third-party companies.

<b>3. Prize Transparency 🏆</b>
• Winner's Ticket Numbers and Names are shared in our official channel for transparency, but full phone numbers are always kept hidden.

<b>4. Your Rights ⚖️</b>
• You can view your registered data at any time in the <b>⚙️ Settings</b> menu.
• If you wish to delete your account, you can contact our <b>👨‍✈️ Admin</b>.

━━━━━━━━━━━━━━━━━━
<i>"Your security is our priority. Play with confidence."</i>
━━━━━━━━━━━━━━━━━━`;

  const privacyKeyboard = Markup.inlineKeyboard([
    [Markup.button.url('📜 Official Channel', 'https://t.me/SmartX_Ethio')],
    [Markup.button.callback('🔙 Back to Menu', 'back_to_settings')]
  ]);

  return ctx.reply(privacyMessage, { 
    parse_mode: 'HTML', 
    ...privacyKeyboard 
  });
});
    
    
bot.hears('👥 Invite & Earn', async (ctx) => {
  const userId = ctx.from.id;
  const botUsername = ctx.botInfo.username;
  
  const user = await env.DB.prepare("SELECT invite_count FROM users WHERE user_id = ?")
    .bind(userId)
    .first();

  const invites = user?.invite_count || 0;
  const earnings = invites * 2; 
  const inviteLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const inviteMessage = `
<b>🎁 INVITE & EARN REWARDS</b>
━━━━━━━━━━━━━━━━━━━━
Invite your friends and get <b>2.00 ETB</b> for every new user!

<b>📈 YOUR INVITATION STATS</b>
👥 Total Invited: <code>${invites} Users</code>
💰 Total Earned: <code>${earnings} ETB</code>

<b>🔗 YOUR PERSONAL LINK</b>
<code>${inviteLink}</code>
━━━━━━━━━━━━━━━━━━━━
<i>Tap the link to copy or use the button below to share. 🚀</i>`;

  const shareKeyboard = Markup.inlineKeyboard([
    [Markup.button.url('📤 Share Referral Link', `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent("Join now and start winning! 🎁✨")}`)],
    [Markup.button.callback('🔄 Refresh Stats', 'refresh_invites')]
  ]);

  return ctx.reply(inviteMessage, { 
    parse_mode: 'HTML',
    ...shareKeyboard 
  });
});
    
    
// 1. የሴቲንግ ሜኑ ማሳያ
bot.hears('⚙️ Settings', async (ctx) => {
  const userId = ctx.from.id;

  try {
    const user = await env.DB.prepare("SELECT phone FROM users WHERE user_id = ?").bind(userId).first();
    const phoneStatus = user?.phone ? `🟢 ${user.phone}` : "🔴 Not Linked";

    const settingsText = `
<b>⚙️ SETTINGS & PROFILE</b>
━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${ctx.from.first_name}
🆔 <b>User ID:</b> <code>${userId}</code>
📞 <b>Phone:</b> ${phoneStatus}
━━━━━━━━━━━━━━━━━━
<i>Please keep your information up to date to ensure smooth prize payouts.</i>`;

    const settingsKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📲 Update Phone Number', 'update_profile')],
      [Markup.button.callback('🛠 Contact Support', 'contact_support')],
      [Markup.button.callback('🗑 Delete Account', 'confirm_delete')]
    ]);

    return ctx.reply(settingsText, {
      parse_mode: 'HTML',
      ...settingsKeyboard
    });
  } catch (e) {
    console.error("Settings Error:", e);
    return ctx.reply("❌ Error loading settings. Please try again later.");
  }
});

// 2. ስልክ ቁጥር ለማደስ (Update Profile)
bot.action('update_profile', async (ctx) => {
  await ctx.answerCbQuery();
  const updateMessage = `
<b>📲 Update Your Phone Number</b>
━━━━━━━━━━━━━━━━━━
To receive your winnings and keep your account secure, please share your current phone number.

<b>Note:</b> Click the button at the bottom of your screen.`;

  return ctx.reply(updateMessage, {
    parse_mode: 'HTML',
    ...Markup.keyboard([
      [Markup.button.contactRequest('📲 Share My Phone Number')]
    ]).resize().oneTime()
  });
});

// 3. አካውንት ለመሰረዝ መጀመሪያ የሚመጣ ማስጠንቀቂያ (Step 1)
bot.action('confirm_delete', async (ctx) => {
  await ctx.answerCbQuery();
  const deleteWarning = `
<b>⚠️ PERMANENT DELETION</b>
━━━━━━━━━━━━━━━━━━
Are you sure you want to delete your account? 
This will:
• Wipe your balance
• Delete your ticket history
• Remove your referral link

<b>This action cannot be undone!</b>`;

  const deleteKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔥 Yes, Delete Permanently', 'final_delete_account')],
    [Markup.button.callback('✅ No, Keep My Account', 'back_to_settings')]
  ]);

  return ctx.editMessageText(deleteWarning, {
    parse_mode: 'HTML',
    ...deleteKeyboard
  });
});

// 4. አካውንቱን ከዳታቤዝ የሚሰርዝ (Step 2)
bot.action('final_delete_account', async (ctx) => {
  const userId = ctx.from.id;
  try {
    await env.DB.prepare("DELETE FROM users WHERE user_id = ?").bind(userId).run();
    await ctx.answerCbQuery("Account Deleted.");
    return ctx.editMessageText("<b>❌ Your account has been permanently deleted.</b>\nSend /start to register again.", { parse_mode: 'HTML' });
  } catch (e) {
    return ctx.reply("Error: " + e.message);
  }
});
    

// 1. Wallet & Invite (አድስ የሚል አዝራር ተጨምሮበታል)
bot.hears('💰 Wallet & Invite', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await env.DB.prepare("SELECT balance, invite_count, payout_account FROM users WHERE user_id = ?").bind(userId).first();

    const balance = user?.balance || 0;
    const invites = user?.invite_count || 0;
    const payoutAcc = user?.payout_account || "None (Will be asked during withdrawal)";
    
    const botUsername = ctx.botInfo.username;
    const inviteLink = `https://t.me/${botUsername}?start=ref_${userId}`;

    const message = `
<b>👛 YOUR WALLET & REWARDS</b>
━━━━━━━━━━━━━━━━━━
💰 <b>Current Balance:</b> <code>${balance} ETB</code>
👥 <b>Total Referrals:</b> <code>${invites} Users</code>
🏦 <b>Payment Info:</b> <code>${payoutAcc}</code>
━━━━━━━━━━━━━━━━━━
🎁 <b>Referral Bonus:</b> Get <b>2.00 ETB</b> for every friend!
🔗 <b>Invite Link:</b> <code>${inviteLink}</code>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎟 Buy Ticket (10 ETB)', 'buy_with_wallet')],
      [Markup.button.callback('💸 Withdraw', 'request_withdraw'), Markup.button.callback('📥 Deposit', 'show_deposit_info')],
      [Markup.button.callback('🔄 Refresh Stats', 'refresh_wallet')]
    ]);

    return ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
  } catch (e) {
    return ctx.reply("⚠️ Wallet Error: " + e.message);
  }
});

// --- 1. Withdrawal Start: Bank Selection ---
bot.action('request_withdraw', async (ctx) => {
  const userId = ctx.from.id;
  try {
    const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(userId).first();

    if (!user || user.balance < 50) {
      return ctx.reply("⚠️ <b>Insufficient Balance!</b>\n\nYou need at least <b>50 ETB</b> to request a withdrawal.\nYour current balance: <b>" + (user?.balance || 0) + " ETB</b>", { parse_mode: 'HTML' });
    }

    const bankKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📱 Telebirr', 'set_b_Telebirr'), Markup.button.callback('🏦 CBE', 'set_b_CBE')],
      [Markup.button.callback('💸 M-Pesa', 'set_b_M-Pesa')]
    ]);

    return ctx.reply("🏦 <b>WITHDRAWAL: STEP 1</b>\n\nPlease select your preferred <b>Bank or Wallet</b> below:", { 
      parse_mode: 'HTML', 
      ...bankKeyboard 
    });
  } catch (e) {
    return ctx.reply("Error: " + e.message);
  }
});

// --- 2. Bank Selected: Initialize Number Pad ---
bot.action(/^set_b_(.+)$/, async (ctx) => {
  const bank = ctx.match[1];
  const userId = ctx.from.id;
  
  await env.DB.prepare("UPDATE users SET deposit_method = ?, payout_account = '' WHERE user_id = ?")
    .bind(`ACC_PAD_${bank}`, userId).run();
  
  await ctx.answerCbQuery(`${bank} Selected!`);
  return showNumberPad(ctx, "", bank);
});

// --- 3. The Reusable Number Pad Function ---
function showNumberPad(ctx, currentAcc, bank) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['❌ Clear', '0', '✅ Done']
  ];

  const keyboard = Markup.inlineKeyboard(
    keys.map(row => row.map(key => {
      if (key === '✅ Done') return Markup.button.callback(key, 'acc_done');
      if (key === '❌ Clear') return Markup.button.callback(key, 'acc_del');
      return Markup.button.callback(key, `num_${key}`);
    }))
  );

  const msg = `🏦 <b>BANK:</b> ${bank}\n━━━━━━━━━━━━━━━━━━\n✍️ <b>ENTER ACCOUNT NUMBER:</b>\n<code>${currentAcc || '_________________'}</code>\n━━━━━━━━━━━━━━━━━━\n<i>Use the buttons below to type your account number accurately.</i>`;
  
  if (ctx.callbackQuery) {
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard });
  }
  return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
}

// --- 4. Number Pad Logic: Digit Press ---
bot.action(/^num_(\d)$/, async (ctx) => {
  const num = ctx.match[1];
  const userId = ctx.from.id;
  
  const user = await env.DB.prepare("SELECT deposit_method, payout_account FROM users WHERE user_id = ?").bind(userId).first();
  if (!user.deposit_method || !user.deposit_method.startsWith('ACC_PAD_')) return ctx.answerCbQuery();
  
  const newAcc = (user.payout_account || "") + num;
  const bank = user.deposit_method.replace('ACC_PAD_', '');

  // አካውንት ቁጥር ከ 20 ዲጂት እንዳይበልጥ መገደብ ይቻላል
  if (newAcc.length > 20) return ctx.answerCbQuery("Too long!");

  await env.DB.prepare("UPDATE users SET payout_account = ? WHERE user_id = ?").bind(newAcc, userId).run();
  return showNumberPad(ctx, newAcc, bank);
});

// --- 5. Number Pad Logic: Clear/Delete ---
bot.action('acc_del', async (ctx) => {
  const userId = ctx.from.id;
  const user = await env.DB.prepare("SELECT deposit_method, payout_account FROM users WHERE user_id = ?").bind(userId).first();
  
  if (!user.payout_account) return ctx.answerCbQuery("Already empty!");
  
  const newAcc = user.payout_account.slice(0, -1);
  const bank = user.deposit_method.replace('ACC_PAD_', '');
  
  await env.DB.prepare("UPDATE users SET payout_account = ? WHERE user_id = ?").bind(newAcc, userId).run();
  return showNumberPad(ctx, newAcc, bank);
});

// --- 6. Number Pad Logic: Finalize Account ---
bot.action('acc_done', async (ctx) => {
  const userId = ctx.from.id;
  const user = await env.DB.prepare("SELECT deposit_method, payout_account FROM users WHERE user_id = ?").bind(userId).first();
  
  if (!user.payout_account || user.payout_account.length < 8) {
    return ctx.answerCbQuery("❌ Please enter a valid account number!", { show_alert: true });
  }

  await env.DB.prepare("UPDATE users SET deposit_method = 'WAITING_AMOUNT' WHERE user_id = ?").bind(userId).run();
  
  await ctx.answerCbQuery("Account Saved! ✅");
  const finalMsg = `✅ <b>ACCOUNT VERIFIED</b>\n━━━━━━━━━━━━━━━━━━\n🏦 <b>Bank:</b> ${user.deposit_method.replace('ACC_PAD_', '')}\n💳 <b>Account:</b> <code>${user.payout_account}</code>\n━━━━━━━━━━━━━━━━━━\n💰 <b>STEP 3:</b> Please type the <b>Amount</b> you wish to withdraw:`;
  
  return ctx.editMessageText(finalMsg, { parse_mode: 'HTML' });
});
      
    
bot.action(/^confirm_paid_(\d+)_(\d+)$/, async (ctx) => {
  const targetId = ctx.match[1];
  const amount = ctx.match[2];

  try {
    // ባላንሱን ወደ 0 መቀየር
    await env.DB.prepare("UPDATE users SET balance = 0 WHERE user_id = ?").bind(targetId).run();

    // ለተጠቃሚው ማሳወቅ
    await ctx.telegram.sendMessage(targetId, `🎊 <b>Payment Successful!</b>\nYour withdrawal of <b>${amount} ETB</b> has been processed. Check your bank account.`, { parse_mode: 'HTML' });

    await ctx.editMessageText(`✅ <b>COMPLETED:</b> ${amount} ETB paid to ${targetId}`);
    return ctx.answerCbQuery("Success!");
  } catch (e) {
    return ctx.reply("Error: " + e.message);
  }
});
    

bot.action('view_my_tickets', async (ctx) => {
  const userId = ctx.from.id;
  try {
    await ctx.answerCbQuery();
    
    // 1. ሁሉንም የዚህን ሰው ቲኬቶች ከዳታቤዝ እናመጣለን
    const tickets = await env.DB.prepare("SELECT ticket_number, status, purchase_date FROM tickets WHERE user_id = ? ORDER BY purchase_date DESC")
      .bind(userId)
      .all();

    if (!tickets.results || tickets.results.length === 0) {
      return ctx.editMessageText("<b>📂 My Tickets</b>\n━━━━━━━━━━━━━━━━━━\n<i>You haven't purchased any tickets yet.</i>", { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🎟 Buy New Ticket', 'buy_with_wallet')]])
      });
    }

    // 2. ቲኬቶችን በሁለት መለየት (Active vs Drawn/Expired)
    let activeTickets = "";
    let expiredTickets = "";
    let activeCount = 0;
    let expiredCount = 0;

    tickets.results.forEach((t) => {
      const dateStr = new Date(t.purchase_date).toLocaleDateString();
      if (t.status === 'active') {
        activeCount++;
        activeTickets += `🟢 <code>#${t.ticket_number}</code> - <pre>${dateStr}</pre>\n`;
      } else {
        expiredCount++;
        expiredTickets += `🔴 <code>#${t.ticket_number}</code> - <pre>${dateStr}</pre>\n`;
      }
    });

    // 3. መልዕክቱን ማዘጋጀት
    let finalMsg = `<b>📂 TICKET HISTORY</b>\n━━━━━━━━━━━━━━━━━━\n\n`;
    
    finalMsg += `<b>🎫 Active Entries (${activeCount})</b>\n`;
    finalMsg += activeCount > 0 ? activeTickets : "<i>No active tickets</i>\n";
    
    finalMsg += `\n<b>⌛ Past Entries (${expiredCount})</b>\n`;
    finalMsg += expiredCount > 0 ? expiredTickets : "<i>No past history</i>\n";
    
    finalMsg += `\n━━━━━━━━━━━━━━━━━━\n<i>Green (🟢) means currently in the draw.</i>`;

    return ctx.editMessageText(finalMsg, { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🎟 Buy New', 'buy_with_wallet')],
        [Markup.button.callback('🔙 Back', 'back_to_settings')]
      ])
    });

  } catch (e) {
    console.error(e);
    return ctx.reply("Error fetching your tickets.");
  }
});
      


    // ፎቶ እንዲልኩ መጠየቂያ
bot.action('ask_for_photo', async (ctx) => {
  const userId = ctx.from.id;
  
  // ተጠቃሚው ፎቶ እንዲልክ እየጠበቅን መሆኑን ምልክት እናስቀምጥ
  await env.DB.prepare("UPDATE users SET deposit_method = 'WAITING_FOR_PHOTO' WHERE user_id = ?")
    .bind(userId)
    .run();

  await ctx.answerCbQuery();
  return ctx.reply("<b>📸 Please upload your Screenshot now:</b>\nMake sure the transaction reference number is visible.", { parse_mode: 'HTML' });
});
    

// --- ፎቶ ሲላክ ለአድሚን የሚሄድበት ሲስተም ---
// Triggered when user clicks "Deposit"
bot.action('ask_for_photo', async (ctx) => {
  const userId = ctx.from.id;
  
  // Mark user as waiting to upload a photo
  await env.DB.prepare("UPDATE users SET deposit_method = 'WAITING_FOR_PHOTO' WHERE user_id = ?")
    .bind(userId)
    .run();

  await ctx.answerCbQuery("Waiting for screenshot...");
  return ctx.reply("<b>📸 DEPOSIT VERIFICATION</b>\n━━━━━━━━━━━━━━━━━━\nPlease <b>Upload your Screenshot</b> (Telebirr or Bank receipt) now.\n\n<i>Ensure the Transaction ID and Amount are clearly visible.</i>", { parse_mode: 'HTML' });
});

// Handling the Photo Upload
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  
  // 1. Security Check: Is the user in "Waiting for Photo" mode?
  const user = await env.DB.prepare("SELECT deposit_method, phone FROM users WHERE user_id = ?").bind(userId).first();

  if (!user || user.deposit_method !== 'WAITING_FOR_PHOTO') {
    return ctx.reply("ℹ️ Please click the <b>📥 Deposit</b> button before sending a screenshot.", { parse_mode: 'HTML' });
  }

  const firstName = ctx.from.first_name;
  const username = ctx.from.username ? `@${ctx.from.username}` : "No Username";
  const phone = user.phone || "Not Shared";
  const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

  // Notify User
  await ctx.reply("<b>⏳ Receipt Received!</b>\nAdmin is now verifying your deposit. You will be notified once approved.", { parse_mode: 'HTML' });

  // 2. Clear the waiting status
  await env.DB.prepare("UPDATE users SET deposit_method = NULL WHERE user_id = ?").bind(userId).run();

  // 3. Send to Admin for Approval
  const adminDepositCaption = `
<b>💰 NEW DEPOSIT REQUEST</b>
━━━━━━━━━━━━━━━━━━
👤 <b>User:</b> ${firstName}
🆔 <b>ID:</b> <code>${userId}</code>
📞 <b>Phone:</b> <code>${phone}</code>
🔗 <b>Username:</b> ${username}
━━━━━━━━━━━━━━━━━━
<b>Select amount to credit to user:</b>`;

  const adminDepositKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ +10 ETB', `approve_${userId}_10`), Markup.button.callback('✅ +50 ETB', `approve_${userId}_50`)],
    [Markup.button.callback('✅ +100 ETB', `approve_${userId}_100`), Markup.button.callback('✅ +500 ETB', `approve_${userId}_500`)],
    [Markup.button.callback('➕ Custom Amount', `custom_approve_${userId}`)],
    [Markup.button.callback('❌ Reject Request', `reject_${userId}`)]
  ]);

  return ctx.telegram.sendPhoto(ADMIN_ID, photoId, {
    caption: adminDepositCaption,
    parse_mode: 'HTML',
    ...adminDepositKeyboard
  });
});


// --- አድሚኑ የፈለገውን ያህል ብር እንዲጨምር የሚያስችለው Logic ---
bot.action(/^custom_approve_(\d+)$/, async (ctx) => {
  const targetUserId = ctx.match[1];
  await ctx.answerCbQuery();
  return ctx.reply(`<b>✍️ Enter Amount:</b>\nPlease type the exact amount to add for User ID: <code>${targetUserId}</code>\n\nExample: <code>add ${targetUserId} 250</code>`, { parse_mode: 'HTML' });
});
                                                              
                        
  bot.action('view_invite_link', async (ctx) => {
  const userId = ctx.from.id;
  const botUsername = ctx.botInfo.username;
  const inviteLink = `https://t.me/${botUsername}?start=ref_${userId}`;
  
  await ctx.answerCbQuery();
  return ctx.reply(`<b>🔗 Your Invite Link:</b>\n<code>${inviteLink}</code>\n\nShare this and get 2 ETB for every join!`, { parse_mode: 'HTML' });
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
    

// 4. የተላከውን ጽሁፍ ተቀብሎ ዳታቤዝ ውስጥ ማስገባት
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  // 1. የተጠቃሚውን ዳታ መጀመሪያ እናምጣ
  const user = await env.DB.prepare("SELECT balance, deposit_method, payout_account FROM users WHERE user_id = ?").bind(userId).first();
  if (!user) return;

  // --- A. ለአድሚን ብቻ፡ Custom Amount መጨመሪያ (add userId amount) ---
  if (userId === ADMIN_ID && text.startsWith('add ')) {
    const parts = text.split(' ');
    if (parts.length === 3) {
      const targetId = parts[1];
      const amount = parseInt(parts[2]);
      if (!isNaN(amount)) {
        await env.DB.prepare("UPDATE users SET balance = balance + ? WHERE user_id = ?").bind(amount, targetId).run();
        await ctx.telegram.sendMessage(targetId, `✅ <b>Deposit Approved!</b>\nYour wallet has been credited with <b>${amount} ETB</b>.`, { parse_mode: 'HTML' });
        return ctx.reply(`✅ Successfully added ${amount} ETB to User ${targetId}`);
      }
    }
  }

  // --- B. የባንክ መረጃ መቀበያ (WAITING_FOR_BANK ሲሆን ብቻ) ---
  if (user.deposit_method === 'WAITING_FOR_BANK') {
    if (text.includes('-') && text.length > 8) {
      await env.DB.prepare("UPDATE users SET payout_account = ?, deposit_method = 'WAITING_FOR_WITHDRAW' WHERE user_id = ?").bind(text, userId).run();
      return ctx.reply(`✅ <b>Bank Info Saved!</b>\n🏦 <b>Bank:</b> <code>${text}</code>\n\nNow, type the <b>Amount</b> you wish to withdraw:`, { parse_mode: 'HTML' });
    } else {
      return ctx.reply("❌ Invalid format. Please use: <i>Bank - AccountNumber</i>", { parse_mode: 'HTML' });
    }
  }

  // --- C. ገንዘብ ማውጫ መጠን መቀበያ (WAITING_FOR_WITHDRAW ሲሆን ብቻ) ---
  if (user.deposit_method === 'WAITING_FOR_WITHDRAW') {
    const amount = parseInt(text);
    if (!isNaN(amount) && amount >= 50) {
      if (amount > user.balance) {
        return ctx.reply(`❌ <b>Insufficient Funds!</b>\nYour balance: <b>${user.balance} ETB</b>.`, { parse_mode: 'HTML' });
      }

      // ለአድሚን ጥያቄ መላክ
      await ctx.telegram.sendMessage(ADMIN_ID, `<b>🔔 WITHDRAWAL REQUEST</b>\nID: <code>${userId}</code>\nAmount: <code>${amount} ETB</code>\nBank: <code>${user.payout_account}</code>`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm Paid', `confirm_paid_${userId}_${amount}`)]])
      });

      // ሁኔታውን (State) መዝጋት
      await env.DB.prepare("UPDATE users SET deposit_method = NULL WHERE user_id = ?").bind(userId).run();
      return ctx.reply("✅ Request Sent! Admin will process it soon.", { parse_mode: 'HTML' });
    } else {
      return ctx.reply("❌ Minimum withdrawal is 50 ETB. Please enter a valid number.");
    }
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
      
