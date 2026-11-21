// VEYNS Admin, Feedback: the Export Feedback file (Step B5). A CSV that opens in Excel.
// Pure function. Any cell that starts with = + - @ is prefixed so a spreadsheet cannot run it as a formula.

type ExportPost = {
  created_at: string;
  is_guest?: boolean;
  display_name?: string;
  rating: number;
  status: string;
  comment?: string;
  feedback_post_items?: { item_name_snapshot: string }[] | null;
  feedback_replies?: { body: string } | { body: string }[] | null;
};

function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function feedbackToCsv(posts: ExportPost[]): string {
  const header = ['Posted at', 'Customer', 'Type', 'Rating', 'Status', 'Menu items', 'Comment', 'Official reply'];
  const lines = [header.map(cell).join(',')];
  for (const p of posts) {
    const reply = Array.isArray(p.feedback_replies) ? p.feedback_replies[0] : p.feedback_replies;
    lines.push(
      [
        p.created_at,
        p.is_guest ? 'Guest' : p.display_name || '',
        p.is_guest ? 'Guest' : 'Registered',
        p.rating,
        p.status,
        (p.feedback_post_items || []).map((f) => f.item_name_snapshot).join('; '),
        p.comment || '',
        reply ? reply.body : '',
      ]
        .map(cell)
        .join(','),
    );
  }
  return '\uFEFF' + lines.join('\r\n');
}
