import express from "express";
import axios from "axios";
import fs from "fs-extra";
import { badWords } from "./badwords.js";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BALE_TOKEN;
const API = `https://tapi.bale.ai/bot${BOT_TOKEN}/`;
const WARN_FILE = "./data.json";

// اطمینان از وجود فایل اخطارها
if (!fs.existsSync(WARN_FILE)) fs.writeJsonSync(WARN_FILE, {});

// --- توابع کمکی ---
async function sendMessage(chatId, text) {
  await axios.post(API + "sendMessage", { chat_id: chatId, text });
}

async function deleteMessage(chatId, messageId) {
  await axios.post(API + "deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function kickUser(chatId, userId) {
  await axios.post(API + "kickChatMember", { chat_id: chatId, user_id: userId });
}

function addWarning(userId) {
  const data = fs.readJsonSync(WARN_FILE);
  if (!data[userId]) data[userId] = 0;
  data[userId]++;
  fs.writeJsonSync(WARN_FILE, data);
  return data[userId];
}

// بررسی توهین
function containsBadWord(text) {
  const content = text.toLowerCase();
  return badWords.some(word => content.includes(word));
}

// دریافت آپدیت‌ها از وبهوک
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const update = req.body;
  if (!update.message) return;

  const chatId = update.message.chat.id;
  const userId = update.message.from.id;
  const messageId = update.message.message_id;
  const text = update.message.text?.trim();

  // --- فیلتر توهین ---
  if (text && containsBadWord(text)) {
    await deleteMessage(chatId, messageId);
    const warnCount = addWarning(userId);

    if (warnCount >= 3) {
      await kickUser(chatId, userId);
      await sendMessage(chatId, `🚫 کاربر ${update.message.from.first_name} به دلیل تکرار توهین، از گروه حذف شد.`);
    } else {
      await sendMessage(chatId, `⚠️ هشدار ${warnCount}/3: لطفاً از الفاظ نامناسب استفاده نکنید.`);
    }
    return;
  }

  // --- دستورات فارسی ---
  if (text.startsWith("کیک")) {
    const target = text.split(" ")[1];
    await sendMessage(chatId, `🚫 ${target} از گروه حذف شد (نمونه).`);
  }

  if (text.startsWith("بن")) {
    const target = text.split(" ")[1];
    await sendMessage(chatId, `⛔ ${target} بن شد (نمونه).`);
  }

  if (text.startsWith("میوت")) {
    const target = text.split(" ")[1];
    const minutes = parseInt(text.split(" ")[2]) || 5;
    await sendMessage(chatId, `🔇 ${target} برای ${minutes} دقیقه سکوت شد (نمونه).`);
  }
});

app.listen(3000, () => console.log("ربات بله روی پورت 3000 فعال شد ✔️"));
