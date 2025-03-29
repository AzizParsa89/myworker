import { Router } from 'itty-router'; import { Database } from '@cloudflare/d1';

const router = Router();

async function setWebhook(botToken, url) { const response = await fetch("https://api.telegram.org/bot${botToken}/setWebhook?url=${url}/${botToken}"); return response.ok; }

async function sendMessage(botToken, chatId, text) { await fetch("https://api.telegram.org/bot${botToken}/sendMessage", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) }); }

async function handleUpdates(update, env) { const db = new Database(env.D1); const message = update.message;

if (message) {
    const chatId = message.chat.id;
    const text = message.text;
    
    await db.prepare('INSERT INTO users (id) VALUES (?) ON CONFLICT DO NOTHING').bind(chatId).run();
    
    if (text === '/start') {
        return sendMessage(env.BOT_TOKEN, chatId, 'به ربات پیام ناشناس خوش آمدید!\n- برای دریافت لینک پیام ناشناس: /getlink\n- برای چت ناشناس: /chat');
    }
    
    if (text === '/getlink') {
        const userLink = `https://t.me/${env.BOT_USERNAME}?start=${chatId}`;
        return sendMessage(env.BOT_TOKEN, chatId, `لینک پیام ناشناس شما: ${userLink}`);
    }
    
    if (text.startsWith('/start ') && text.length > 7) {
        const targetId = text.split(' ')[1];
        await db.prepare('INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)')
            .bind(chatId, targetId, text).run();
        return sendMessage(env.BOT_TOKEN, targetId, `یک پیام ناشناس دریافت کردید!`);
    }
    
    if (text === '/chat') {
        return sendMessage(env.BOT_TOKEN, chatId, 'لطفا جنسیت خود را انتخاب کنید: \n1. مرد \n2. زن');
    }
    
    if (text === '1' || text === '2') {
        const gender = text === '1' ? 'male' : 'female';
        await db.prepare('UPDATE users SET gender = ? WHERE id = ?').bind(gender, chatId).run();
        return sendMessage(env.BOT_TOKEN, chatId, 'جنسیت شما ثبت شد. لطفا منتظر بمانید تا شخصی پیدا شود...');
    }
    
    const user = await db.prepare('SELECT gender FROM users WHERE id = ?').bind(chatId).first();
    if (user) {
        const oppositeGender = user.gender === 'male' ? 'female' : 'male';
        const partner = await db.prepare('SELECT id FROM users WHERE gender = ? AND id != ? ORDER BY RANDOM() LIMIT 1')
            .bind(oppositeGender, chatId).first();
        
        if (partner) {
            await db.prepare('INSERT INTO chats (user1, user2) VALUES (?, ?)')
                .bind(chatId, partner.id).run();
            sendMessage(env.BOT_TOKEN, chatId, 'شما به یک فرد متصل شدید! شروع به گفتگو کنید.');
            sendMessage(env.BOT_TOKEN, partner.id, 'شما به یک فرد متصل شدید! شروع به گفتگو کنید.');
        } else {
            return sendMessage(env.BOT_TOKEN, chatId, 'فعلا فردی برای چت یافت نشد، لطفا بعدا امتحان کنید.');
        }
    }
    
    // ذخیره تمام پیام‌های چت ناشناس
    const chat = await db.prepare('SELECT user1, user2 FROM chats WHERE user1 = ? OR user2 = ? ORDER BY id DESC LIMIT 1')
        .bind(chatId, chatId).first();
    
    if (chat) {
        const recipient = chat.user1 === chatId ? chat.user2 : chat.user1;
        await db.prepare('INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)')
            .bind(chatId, recipient, text).run();
        return sendMessage(env.BOT_TOKEN, recipient, text);
    }
}
return new Response('OK');

}

router.get('/', async (request, env) => { const webhookUrl = https://${env.WORKER_DOMAIN}; const response = await setWebhook(env.BOT_TOKEN, webhookUrl); return new Response(response ? 'Webhook Set Successfully' : 'Failed to Set Webhook'); });

router.post(/${env.BOT_TOKEN}, async (request, env) => { const update = await request.json(); return handleUpdates(update, env); });

export default { fetch: router.handle };

  
