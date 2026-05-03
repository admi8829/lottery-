import { Telegraf, Markup } from 'telegraf';

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN) return new Response("BOT_TOKEN missing");
    
    const bot = new Telegraf(env.BOT_TOKEN);
    const ADMIN_ID = 7471102761;
    
    // --- 1. Keyboards ---
    const mainKeyboard = Markup.keyboard([
      ['🎟 New Ticket'],
      ['🎟 My Tickets', '💰 Wallet & Invite'],
      ['🏆 Winners', '👥 Invite & Earn'],
      ['⚙️ Settings', '❓ Help', '🛡 Privacy'],
      ['👨‍✈️ Admin', '👨‍💻 Contact Developer']
    ]).resize();
    
    const requestPhoneKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📲 send to phone ')]
    ]).resize();

    // --- 2. Start Command ---
    bot.start(async (ctx) => {
      try {
        const userId = ctx.from.id;
        const startPayload = ctx.startPayload;
        
        const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

        if (!user) {
          let referredBy = null;
          if (startPayload && !isNaN(startPayload)) {
            referredBy = parseInt(startPayload);
          }

          await env.DB.prepare(
            "INSERT INTO users (user_id, username, first_name, balance, referred_by) VALUES (?, ?, ?, 0, ?)"
          ).bind(userId, ctx.from.username || 'N/A', ctx.from.first_name, referredBy).run();

          if (referredBy) {
            await ctx.telegram.sendMessage(referredBy, `<b>🎁 New Referral!</b>\nYour friend ${ctx.from.first_name} joined. You'll get bonus when they play!`, { parse_mode: 'HTML' });
          }

          return ctx.reply(`<b>Welcome to Smart X Academy! 🚀</b>\n\nPlay lottery and win amazing prizes.`, {
            parse_mode: 'HTML',
            ...mainKeyboard
          });
        }

        return ctx.reply(`<b>Welcome back, ${ctx.from.first_name}!</b>`, {
          parse_mode: 'HTML',
          ...mainKeyboard
        });
      } catch (e) {
        console.error(e);
        return ctx.reply("Error: " + e.message);
      }
    });

    // --- 3. Wallet & Invite ---
    bot.hears('💰 Wallet & Invite', async (ctx) => {
      const userId = ctx.from.id;
      const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${userId}`;

      const walletMsg = `<b>🏦 YOUR WALLET</b>\n━━━━━━━━━━━━━━━━━━\n💰 <b>Balance:</b> <code>${user.balance} ETB</code>\n🆔 <b>User ID:</b> <code>${userId}</code>\n\n<b>👥 REFERRAL SYSTEM</b>\nShare your link and earn bonus!\n🔗 <code>${referralLink}</code>`;

      return ctx.reply(walletMsg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💳 Deposit', 'deposit_menu'), Markup.button.callback('💸 Withdraw', 'withdraw_menu')],
          [Markup.button.url('📣 Share Link', `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20SmartX%20Academy!`)]
        ])
      });
    });

    // --- 4. Deposit System ---
    bot.action('deposit_menu', async (ctx) => {
      return ctx.editMessageText("<b>💳 SELECT DEPOSIT METHOD</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📱 Telebirr', 'deposit_telebirr')],
          [Markup.button.callback('🏦 Bank Transfer', 'deposit_bank')],
          [Markup.button.callback('🔙 Back', 'wallet_back')]
        ])
      });
    });

    bot.action('deposit_telebirr', async (ctx) => {
      return ctx.editMessageText("<b>📱 Telebirr Deposit</b>\n\nNumber: <code>0912345678</code>\nName: Habtamu Y.\n\nAfter payment, send screenshot.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('📸 Send Screenshot', 'ask_for_photo')]])
      });
    });

    bot.action('deposit_bank', async (ctx) => {
      return ctx.editMessageText("<b>🏦 Bank Deposit (CBE)</b>\n\nAccount: <code>1000123456789</code>\nName: Habtamu Y.\n\nAfter payment, send screenshot.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('📸 Send Screenshot', 'ask_for_photo')]])
      });
    });

    bot.action('ask_for_photo', async (ctx) => {
      await env.DB.prepare("UPDATE users SET deposit_method = 'WAITING_DEPOSIT_PHOTO' WHERE user_id = ?").bind(ctx.from.id).run();
      await ctx.answerCbQuery();
      return ctx.reply("<b>📸 Upload your Receipt</b>\nPlease send the screenshot of your payment now.", { parse_mode: 'HTML' });
    });

    // --- 5. Withdrawal System ---
    bot.action('withdraw_menu', async (ctx) => {
      return ctx.editMessageText("<b>💸 WITHDRAWAL</b>\nMinimum: 50 ETB\n\nPlease enter the amount you want to withdraw:", {
        parse_mode: 'HTML'
      });
    });

    // Handle Amount Input (via Hears or Message)
    bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const text = ctx.message.text;

      // Admin logic
      if (text === '👨‍✈️ Admin' && userId === ADMIN_ID) {
        return ctx.reply("Welcome Boss! Choose action:", Markup.inlineKeyboard([
          [Markup.button.callback('📊 Stats', 'admin_stats'), Markup.button.callback('📢 Broadcast', 'admin_bc')]
        ]));
      }

      // If text is a number, assume it's for withdrawal or other amount tasks
      if (!isNaN(text) && parseInt(text) >= 50) {
        await env.DB.prepare("UPDATE users SET amount_input = ? WHERE user_id = ?").bind(text, userId).run();
        return ctx.reply(`Withdraw amount: ${text} ETB. Please send your Payout Account Details (Bank/Telebirr):`);
      }

      // Assume any other text is Payout Details if amount is set
      const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
      if (user && user.amount_input) {
        const amount = user.amount_input;
        // Send request to Admin
        const adminReq = `<b>🔔 WITHDRAWAL REQUEST</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>User:</b> ${ctx.from.first_name}\n🆔 <b>ID:</b> <code>${userId}</code>\n💰 <b>Amount:</b> <b>${amount} ETB</b>\n🏦 <b>Details:</b> <code>${text}</code>`;
        
        await ctx.telegram.sendMessage(ADMIN_ID, adminReq, Markup.inlineKeyboard([
          [Markup.button.callback('✅ Confirm & Deduct', `confirm_pay_${userId}_${amount}`)],
          [Markup.button.callback('❌ Reject', `reject_with_${userId}`)]
        ]));

        await env.DB.prepare("UPDATE users SET amount_input = NULL WHERE user_id = ?").bind(userId).run();
        return ctx.reply("✅ Request sent! Admin will process it soon.");
      }
    });

    // --- 6. Admin Action Handlers (Confirm/Reject) ---
    bot.action(/^confirm_pay_(\d+)_(\d+)$/, async (ctx) => {
      const targetId = ctx.match[1];
      const amount = parseInt(ctx.match[2]);

      try {
        const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(targetId).first();
        if (!user || user.balance < amount) {
          return ctx.answerCbQuery("❌ Insufficient user balance!", { show_alert: true });
        }

        await env.DB.prepare("UPDATE users SET balance = balance - ? WHERE user_id = ?").bind(amount, targetId).run();
        await ctx.telegram.sendMessage(targetId, `<b>✅ Withdrawal Successful!</b>\nYour payment of ${amount} ETB has been processed.`, { parse_mode: 'HTML' });
        
        await ctx.editMessageText(`✅ <b>Paid:</b> ${amount} ETB to User ${targetId}`);
        return ctx.answerCbQuery("Payment Confirmed!");
      } catch (e) {
        return ctx.reply("Error: " + e.message);
      }
    });

    bot.action(/^reject_with_(\d+)$/, async (ctx) => {
      const targetId = ctx.match[1];
      await ctx.telegram.sendMessage(targetId, "❌ Your withdrawal request was rejected by Admin.");
      return ctx.editMessageText("❌ Request Rejected.");
    });

    // --- 7. Photo Handler (For Deposit) ---
    bot.on('photo', async (ctx) => {
      const userId = ctx.from.id;
      const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

      if (user.deposit_method === 'WAITING_DEPOSIT_PHOTO') {
        await ctx.telegram.sendPhoto(ADMIN_ID, photoId, {
          caption: `<b>💰 NEW DEPOSIT PROOF</b>\n👤 From: ${ctx.from.first_name}\n🆔 ID: <code>${userId}</code>\nUse /add ${userId} amount to update.`,
          parse_mode: 'HTML'
        });
        await env.DB.prepare("UPDATE users SET deposit_method = NULL WHERE user_id = ?").bind(userId).run();
        return ctx.reply("✅ Receipt sent to Admin. Waiting for approval.");
      }
    });

    // --- Webhook Support ---
    const body = await request.json();
    await bot.handleUpdate(body);
    return new Response("OK");
  }
};
                                          
