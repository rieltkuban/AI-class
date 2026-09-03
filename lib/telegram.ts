/**
 * Заявка уходит в Telegram (ТЗ, 1.1). Дубликат пишется в JSONL —
 * это не база, а страховка на случай, если бот отвалится.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface Lead {
  /** Способ связи: телефон, почта или телеграм. */
  contact: string;
  name?: string;
  comment?: string;
  contour?: string;
  cycle?: string;
  role?: string;
  /** Только порядок выручки. Точное число сюда не попадает никогда. */
  revenueBand?: string;
  dayCost?: string;
  source?: string;
  at: string;
}

const TELEGRAM_TIMEOUT_MS = 8000;

function leadsFile(): string {
  return process.env.LEADS_FILE ?? '/var/www/aiclass/data/leads.jsonl';
}

export function formatLead(lead: Lead): string {
  const rows = [
    'Заявка с сайта',
    `Контакт: ${lead.contact}`,
    lead.name ? `Имя: ${lead.name}` : null,
    lead.contour ? `Контур: ${lead.contour}` : null,
    lead.cycle ? `Цикл решения: ${lead.cycle}` : null,
    lead.role ? `Роль: ${lead.role}` : null,
    lead.revenueBand ? `Порядок выручки: ${lead.revenueBand}` : null,
    lead.dayCost ? `Цена суток: ${lead.dayCost}` : null,
    lead.comment ? `Комментарий: ${lead.comment}` : null,
    lead.source ? `Источник перехода: ${lead.source}` : null,
    `Время: ${lead.at}`,
  ];
  return rows.filter((row): row is string => row !== null).join('\n');
}

/** Пишем дубликат до отправки: файл надёжнее сети. */
export async function saveLeadToFile(lead: Lead): Promise<boolean> {
  const path = leadsFile();
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(lead)}\n`, 'utf8');
    return true;
  } catch (error) {
    console.error('[lead] запись в файл не удалась', (error as Error).message);
    return false;
  }
}

export async function sendLeadToTelegram(lead: Lead): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[lead] Telegram не настроен, заявка только в файле');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatLead(lead),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[lead] Telegram ответил', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[lead] Telegram недоступен', (error as Error).message);
    return false;
  }
}
