import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.15";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  from_email: string | null;
  from_name: string | null;
}

async function sendChatNotificationEmail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  senderName: string,
  messagePreview: string,
  platform: "Telegram" | "WhatsApp",
): Promise<void> {
  try {
    const { data: fuSettings } = await supabase
      .from("follow_up_settings")
      .select("reminder_email, enable_telegram_notifications")
      .eq("user_id", userId)
      .maybeSingle();

    if (!fuSettings || !fuSettings.reminder_email || !fuSettings.enable_telegram_notifications) return;

    const { data: smtpConfig } = await supabase
      .from("smtp_settings")
      .select("smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!smtpConfig || !smtpConfig.smtp_host || !smtpConfig.smtp_username || !smtpConfig.smtp_password) return;

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: (smtpConfig.smtp_port || 587) === 465,
      auth: { user: smtpConfig.smtp_username, pass: smtpConfig.smtp_password },
    });

    const subject = `New ${platform} message from ${senderName}`;
    const textBody = `New ${platform} Message

You received a new message on ${platform} from: ${senderName}

Message: ${messagePreview}

Log in to your CRM to reply.`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #0891B2, #06B6D4); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 1.4rem;">New ${platform} Message</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 0.9rem;">LeadCentre CRM</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p style="font-size: 1rem; color: #1f2937; margin: 0 0 16px;">You received a new message on ${platform} from:</p>
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 12px; font-size: 1.2rem; color: #111827;">${senderName}</h2>
            <div style="margin-top: 12px; padding: 12px; background: #f1f5f9; border-radius: 8px; font-size: 0.88rem; color: #475569; line-height: 1.5;">${messagePreview}</div>
          </div>
          <p style="margin-top: 24px; font-size: 0.78rem; color: #94a3b8; text-align: center;">This notification was sent from your LeadCentre CRM account.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: smtpConfig.from_name
        ? `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.smtp_username}>`
        : (smtpConfig.from_email || smtpConfig.smtp_username),
      to: fuSettings.reminder_email,
      subject,
      text: textBody,
      html: htmlBody,
    });
  } catch {
    // Email notification is best-effort; don't block the webhook
  }
}

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number }>;
  video?: { file_id: string; file_unique_id: string; width: number; height: number; duration: number };
  audio?: { file_id: string; file_unique_id: string; duration: number; mime_type?: string };
  voice?: { file_id: string; file_unique_id: string; duration: number };
  document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };
  sticker?: { file_id: string; file_unique_id: string; emoji?: string };
  animation?: { file_id: string; file_unique_id: string; width: number; height: number; duration: number };
  location?: { latitude: number; longitude: number };
  contact?: { phone_number: string; first_name: string; last_name?: string };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface BotRecord {
  id: string;
  user_id: string;
  bot_token: string;
  welcome_message: string;
  bot_username: string | null;
  label: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract webhook_secret from URL path: /functions/v1/telegram-webhook/{webhook_secret}
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const pathToken = pathParts[pathParts.length - 1];

    if (req.method === "GET") {
      return new Response(
        JSON.stringify({ status: "ok", message: "Telegram webhook is active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: TelegramUpdate = await req.json();

    if (!body.message) {
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const msg = body.message;
    const chatId = msg.chat.id;
    const fromUser = msg.from;

    // Resolve which bot received this update
    let bot: BotRecord | null = null;

    // Try by webhook_secret from URL path
    if (pathToken && pathToken !== "telegram-webhook") {
      const { data: botBySecret } = await supabase
        .from("telegram_bots")
        .select("id, user_id, bot_token, welcome_message, bot_username, label")
        .eq("webhook_secret", pathToken)
        .eq("is_active", true)
        .maybeSingle();
      bot = botBySecret as BotRecord | null;
    }

    // Fallback: try by bot_token directly in the path (legacy mode)
    if (!bot && pathToken && pathToken !== "telegram-webhook") {
      const { data: botByToken } = await supabase
        .from("telegram_bots")
        .select("id, user_id, bot_token, welcome_message, bot_username, label")
        .eq("bot_token", pathToken)
        .eq("is_active", true)
        .maybeSingle();
      bot = botByToken as BotRecord | null;
    }

    // Last resort fallback: try old telegram_settings table (single-bot legacy)
    if (!bot) {
      const { data: legacySettings } = await supabase
        .from("telegram_settings")
        .select("user_id, bot_token, welcome_message")
        .limit(1)
        .maybeSingle();

      if (legacySettings && legacySettings.bot_token) {
        // Try to find a matching bot in telegram_bots
        const { data: matchingBot } = await supabase
          .from("telegram_bots")
          .select("id, user_id, bot_token, welcome_message, bot_username, label")
          .eq("user_id", legacySettings.user_id)
          .eq("bot_token", legacySettings.bot_token)
          .eq("is_active", true)
          .maybeSingle();

        if (matchingBot) {
          bot = matchingBot as BotRecord;
        } else {
          // Use legacy settings directly with a synthetic bot record
          bot = {
            id: "",
            user_id: legacySettings.user_id,
            bot_token: legacySettings.bot_token,
            welcome_message: legacySettings.welcome_message,
            bot_username: null,
            label: "Default Bot",
          };
        }
      }
    }

    if (!bot) {
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminUserId = bot.user_id;
    const botId = bot.id || null;

    // Handle /start command
    if (msg.text && msg.text.trim() === "/start") {
      const welcomeMsg = bot.welcome_message || "Hi! Thanks for reaching out. Our team will get back to you shortly.";
      await sendTelegramMessage(bot.bot_token, chatId, welcomeMsg);

      await supabase
        .from("chat_conversations")
        .upsert({
          user_id: adminUserId,
          bot_id: botId || undefined,
          telegram_chat_id: chatId,
          telegram_user_id: fromUser?.id,
          telegram_username: fromUser?.username,
          telegram_first_name: fromUser?.first_name,
          telegram_last_name: fromUser?.last_name,
          last_message_text: "Started conversation",
          last_message_at: new Date().toISOString(),
          profile_pic_url: fromUser?.id ? await getTelegramProfilePhoto(bot.bot_token, fromUser.id) : null,
        }, { onConflict: "user_id,telegram_chat_id" })
        .select()
        .single();

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await processMessage(supabase, adminUserId, botId, msg, bot.welcome_message, bot.bot_token);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function processMessage(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  botId: string | null,
  msg: TelegramMessage,
  _welcomeMessage: string,
  botToken: string,
) {
  const chatId = msg.chat.id;
  const fromUser = msg.from;

  let profilePicUrl: string | null = null;
  if (fromUser?.id) {
    profilePicUrl = await getTelegramProfilePhoto(botToken, fromUser.id);
  }

  // Upsert conversation
  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .upsert({
      user_id: adminUserId,
      bot_id: botId || undefined,
      telegram_chat_id: chatId,
      telegram_user_id: fromUser?.id,
      telegram_username: fromUser?.username,
      telegram_first_name: fromUser?.first_name,
      telegram_last_name: fromUser?.last_name,
      profile_pic_url: profilePicUrl,
      last_message_text: getPreviewText(msg),
      last_message_at: new Date().toISOString(),
      unread_count: 1,
    }, { onConflict: "user_id,telegram_chat_id" })
    .select()
    .single();

  if (convError || !conversation) return;

  const updateData: Record<string, unknown> = {
    last_message_text: getPreviewText(msg),
    last_message_at: new Date().toISOString(),
    unread_count: conversation.unread_count + 1,
  };

  if (profilePicUrl && !conversation.profile_pic_url) {
    updateData.profile_pic_url = profilePicUrl;
  }

  if (botId && !conversation.bot_id) {
    updateData.bot_id = botId;
  }

  await supabase
    .from("chat_conversations")
    .update(updateData)
    .eq("id", conversation.id);

  const messageData: Record<string, unknown> = {
    conversation_id: conversation.id,
    sender: "client",
    message_type: getMessageType(msg),
    text_content: msg.text || msg.caption || null,
    file_id: getFileId(msg),
    file_unique_id: getFileUniqueId(msg),
    mime_type: getMimeType(msg),
    file_size: getFileSize(msg),
    file_name: getFileName(msg),
    media_width: getMediaWidth(msg),
    media_height: getMediaHeight(msg),
    media_duration: getMediaDuration(msg),
    emoji: msg.sticker?.emoji || null,
    latitude: msg.location?.latitude || null,
    longitude: msg.location?.longitude || null,
  };

  await supabase.from("chat_messages").insert(messageData);

  // Fire automation trigger for telegram_received
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-automations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_type: "telegram_received",
        lead_id: null,
        lead_data: { chat_id: msg.chat?.id, name: [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(" ").trim() || fromUser?.username || "", message: msg.text || msg.caption || "" },
        user_id: adminUserId,
      }),
    });
  } catch { /* best effort */ }

  const senderName = [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(" ").trim() || fromUser?.username || "Unknown sender";
  const previewText = getPreviewText(msg);
  await sendChatNotificationEmail(supabase, adminUserId, senderName, previewText, "Telegram");
}

function getMessageType(msg: TelegramMessage): string {
  if (msg.text) return "text";
  if (msg.photo) return "photo";
  if (msg.video) return "video";
  if (msg.audio) return "audio";
  if (msg.voice) return "voice";
  if (msg.document) return "document";
  if (msg.sticker) return "sticker";
  if (msg.animation) return "animation";
  if (msg.location) return "location";
  if (msg.contact) return "contact";
  return "text";
}

function getPreviewText(msg: TelegramMessage): string {
  if (msg.text) return msg.text.slice(0, 100);
  if (msg.caption) return msg.caption.slice(0, 100);
  if (msg.photo) return "📷 Photo";
  if (msg.video) return "🎥 Video";
  if (msg.audio) return "🎵 Audio";
  if (msg.voice) return "🎤 Voice message";
  if (msg.document) return `📎 ${msg.document.file_name || "File"}`;
  if (msg.sticker) return `${msg.sticker.emoji || "🏷️"} Sticker`;
  if (msg.animation) return "🎞️ GIF";
  if (msg.location) return "📍 Location";
  if (msg.contact) return "👤 Contact";
  return "Message";
}

function getFileId(msg: TelegramMessage): string | null {
  if (msg.photo) return msg.photo[msg.photo.length - 1]?.file_id || null;
  if (msg.video) return msg.video.file_id;
  if (msg.audio) return msg.audio.file_id;
  if (msg.voice) return msg.voice.file_id;
  if (msg.document) return msg.document.file_id;
  if (msg.sticker) return msg.sticker.file_id;
  if (msg.animation) return msg.animation.file_id;
  return null;
}

function getFileUniqueId(msg: TelegramMessage): string | null {
  if (msg.photo) return msg.photo[msg.photo.length - 1]?.file_unique_id || null;
  if (msg.video) return msg.video.file_unique_id;
  if (msg.audio) return msg.audio.file_unique_id;
  if (msg.voice) return msg.voice.file_unique_id;
  if (msg.document) return msg.document.file_unique_id;
  if (msg.sticker) return msg.sticker.file_unique_id;
  if (msg.animation) return msg.animation.file_unique_id;
  return null;
}

function getMimeType(msg: TelegramMessage): string | null {
  if (msg.audio) return msg.audio.mime_type;
  if (msg.document) return msg.document.mime_type;
  return null;
}

function getFileSize(msg: TelegramMessage): number | null {
  if (msg.document) return msg.document.file_size || null;
  return null;
}

function getFileName(msg: TelegramMessage): string | null {
  if (msg.document) return msg.document.file_name || null;
  return null;
}

function getMediaWidth(msg: TelegramMessage): number | null {
  if (msg.photo) return msg.photo[msg.photo.length - 1]?.width || null;
  if (msg.video) return msg.video.width;
  if (msg.animation) return msg.animation.width;
  return null;
}

function getMediaHeight(msg: TelegramMessage): number | null {
  if (msg.photo) return msg.photo[msg.photo.length - 1]?.height || null;
  if (msg.video) return msg.video.height;
  if (msg.animation) return msg.animation.height;
  return null;
}

function getMediaDuration(msg: TelegramMessage): number | null {
  if (msg.video) return msg.video.duration;
  if (msg.audio) return msg.audio.duration;
  if (msg.voice) return msg.voice.duration;
  if (msg.animation) return msg.animation.duration;
  return null;
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function getTelegramProfilePhoto(botToken: string, userId: number): Promise<string | null> {
  try {
    const photosUrl = `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`;
    const photosRes = await fetch(photosUrl);
    const photosData = await photosRes.json();

    if (!photosData.ok || !photosData.result?.photos?.length) return null;

    const photo = photosData.result.photos[0];
    const fileId = photo[photo.length - 1]?.file_id;
    if (!fileId) return null;

    const fileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const fileRes = await fetch(fileUrl);
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result?.file_path) return null;

    return `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
  } catch {
    return null;
  }
}
