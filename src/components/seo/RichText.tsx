import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { Block } from "@/content/guides";

/** Renders `[text](/path)` links and `**bold**` inside trusted content strings. */
export function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <Link key={m.index} href={m[2]!} className="font-semibold text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600">
          {m[1]}
        </Link>,
      );
    } else parts.push(<strong key={m.index} className="font-semibold text-ink-900">{m[3]}</strong>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (typeof b === "string") return <p key={i} className="leading-relaxed text-ink-600"><Inline text={b} /></p>;
        if ("list" in b)
          return (
            <ul key={i} className="space-y-2.5">
              {b.list.map((li, j) => (
                <li key={j} className="flex gap-3 leading-relaxed text-ink-600">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden />
                  <span><Inline text={li} /></span>
                </li>
              ))}
            </ul>
          );
        if ("note" in b) return <p key={i} className="rounded-2xl bg-ink-50 p-4 text-sm text-ink-600"><Inline text={b.note} /></p>;
        return (
          <div key={i} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[520px] overflow-hidden rounded-2xl text-sm ring-1 ring-ink-900/5">
              <thead className="bg-ink-900 text-left text-white">
                <tr>{b.table.head.map((h, j) => <th key={j} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {b.table.rows.map((r, j) => (
                  <tr key={j}>{r.map((c, k) => (k === 0 ? <th key={k} scope="row" className="px-4 py-3 text-left font-medium text-ink-900">{c}</th> : <td key={k} className="px-4 py-3 text-ink-600">{c}</td>))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
