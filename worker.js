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
      [Markup.button.contactRequest('📲 Send Phone Number')]
    ]).resize();

    // --- 2. Start Command ---
    bot.start(async (ctx) => {
      try {
        const userId = ctx.from.id;
        const startPayload = ctx.startPayload;
        
        let user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

        if (!user) {
          await env.DB.prepare("INSERT INTO users (user_id, first_name, username, balance) VALUES (?, ?, ?, ?)")
            .bind(userId, ctx.from.first_name, ctx.from.username || 'N/A', 0).run();
          
          if (startPayload && startPayload !== userId.toString()) {
            await env.DB.prepare("UPDATE users SET referred_by = ? WHERE user_id = ? AND referred_by IS NULL")
              .bind(startPayload, userId).run();
          }
          return ctx.reply(`👋 Welcome ${ctx.from.first_name} to SmartX Academy!`, mainKeyboard);
        }
        
        return ctx.reply(`Welcome back, ${ctx.from.first_name}!`, mainKeyboard);
      } catch (e) {
        return ctx.reply("Error: " + e.message);
      }
    });

    // --- 3. Admin Panel ---
    bot.hears('👨‍✈️ Admin', async (ctx) => {
      if (ctx.from.id !== ADMIN_ID) return ctx.reply("❌ Access Denied!");
      return ctx.reply("Welcome Admin. Choose an action:", Markup.inlineKeyboard([
        [Markup.button.callback("📊 Statistics", "admin_stats")],
        [Markup.button.callback("📢 Broadcast", "admin_broadcast")]
      ]));
    });

    // --- 4. Wallet & Withdraw System ---
    bot.hears('💰 Wallet & Invite', async (ctx) => {
      const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(ctx.from.id).first();
      const balance = user ? user.balance : 0;
      const msg = `<b>💰 Your Wallet</b>\n━━━━━━━━━━━━━━\nBalance: <b>${balance} ETB</b>\n━━━━━━━━━━━━━━`;
      return ctx.reply(msg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit', 'deposit_menu'), Markup.button.callback('💸 Withdraw', 'withdraw_request')]
        ])
      });
    });

    bot.action('deposit_menu', (ctx) => {
      return ctx.editMessageText("<b>💳 Choose Deposit Method</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📱 Telebirr', 'dep_telebirr'), Markup.button.callback('🏦 Bank', 'dep_bank')]
        ])
      });
    });

    bot.action('dep_bank', (ctx) => {
      return ctx.editMessageText("<b>🏦 Bank Details:</b>\nCBE: 1000123456789\nName: Habtamu Yifru", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('📸 Send Receipt', 'ask_for_photo')]])
      });
    });

    bot.action('ask_for_photo', async (ctx) => {
      await env.DB.prepare("UPDATE users SET deposit_method = 'WAITING_DEPOSIT_PHOTO' WHERE user_id = ?").bind(ctx.from.id).run();
      await ctx.answerCbQuery();
      return ctx.reply("<b>📸 Please upload your Receipt Screenshot now:</b>", { parse_mode: 'HTML' });
    });

    // --- 5. Withdraw Process ---
    bot.action('withdraw_request', async (ctx) => {
      const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(ctx.from.id).first();
      if (user.balance < 50) return ctx.answerCbQuery("❌ Minimum balance for withdraw is 50 ETB", { show_alert: true });
      
      await env.DB.prepare("UPDATE users SET deposit_method = 'WAITING_WITHDRAW_AMT' WHERE user_id = ?").bind(ctx.from.id).run();
      return ctx.reply("Enter amount to withdraw:");
    });

    // --- 6. Admin Approval with Direct Deduction ---
    bot.action(/^confirm_paid_(\d+)_(\d+)$/, async (ctx) => {
      const targetId = ctx.match[1];
      const amount = parseInt(ctx.match[2]);

      try {
        const user = await env.DB.prepare("SELECT balance FROM users WHERE user_id = ?").bind(targetId).first();
        if (!user || user.balance < amount) return ctx.answerCbQuery("❌ Insufficient User Balance!");

        await env.DB.prepare("UPDATE users SET balance = balance - ? WHERE user_id = ?").bind(amount, targetId).run();
        await ctx.telegram.sendMessage(targetId, `✅ <b>Withdrawal Success!</b>\n${amount} ETB has been paid.`, { parse_mode: 'HTML' });
        
        await ctx.answerCbQuery("Success! Wallet updated.");
        return ctx.editMessageText(`✅ <b>Approved:</b> ${amount} ETB deducted from User ${targetId}`);
      } catch (e) {
        return ctx.reply("Error: " + e.message);
      }
    });

    // --- 7. Message & Photo Handlers ---
    bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const text = ctx.message.text;
      const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

      if (!user) return;

      if (user.deposit_method === 'WAITING_WITHDRAW_AMT') {
        const amt = parseInt(text);
        if (isNaN(amt) || amt < 50) return ctx.reply("Please enter a valid amount (Min 50).");
        
        await env.DB.prepare("UPDATE users SET deposit_method = NULL WHERE user_id = ?").bind(userId).run();
        const adminMsg = `<b>🔔 WITHDRAWAL REQUEST</b>\n👤 User: ${ctx.from.first_name}\n💰 Amount: ${amt} ETB`;
        await ctx.telegram.sendMessage(ADMIN_ID, adminMsg, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirm & Deduct', `confirm_paid_${userId}_${amt}`)],
            [Markup.button.callback('❌ Reject', `reject_withdraw`)]
          ])
        });
        return ctx.reply("✅ Request sent to Admin.");
      }
    });

    bot.on('photo', async (ctx) => {
      const userId = ctx.from.id;
      const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const user = await env.DB.prepare("SELECT deposit_method FROM users WHERE user_id = ?").bind(userId).first();

      if (user && user.deposit_method === 'WAITING_DEPOSIT_PHOTO') {
        await ctx.telegram.sendPhoto(ADMIN_ID, photoId, {
          caption: `<b>💰 NEW DEPOSIT PROOF</b>\n👤 From: ${ctx.from.first_name}\n🆔 ID: <code>${userId}</code>`,
          parse_mode: 'HTML'
        });
        await env.DB.prepare("UPDATE users SET deposit_method = NULL WHERE user_id = ?").bind(userId).run();
        return ctx.reply("✅ Receipt sent! Admin will verify soon.");
      }
    });

    // --- Webhook Logic ---
    if (request.method === 'POST') {
      const body = await request.json();
      await bot.handleUpdate(body);
      return new Response('OK');
    }
    return new Response('Bot is running');
  }
};
          
