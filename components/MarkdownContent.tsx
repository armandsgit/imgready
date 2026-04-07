interface MarkdownContentProps {
  content: string;
}

function renderInline(text: string) {
  return text.split('\n').map((line, index, allLines) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < allLines.length - 1 ? <br /> : null}
    </span>
  ));
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push(
      <p key={`paragraph-${blocks.length}`} className="text-base leading-8 text-[color:var(--text-secondary)]">
        {renderInline(paragraphLines.join('\n'))}
      </p>
    );
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(
      <ul key={`list-${blocks.length}`} className="space-y-2 pl-5 text-base leading-8 text-[color:var(--text-secondary)]">
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2 key={`heading-${blocks.length}`} className="pt-4 text-2xl font-semibold text-[color:var(--text-primary)]">
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h1 key={`heading-${blocks.length}`} className="pt-4 text-3xl font-semibold text-[color:var(--text-primary)]">
          {trimmed.slice(2)}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className="space-y-5">{blocks}</div>;
}
