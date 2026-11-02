import { Disclosure } from "../components/Disclosure";
import { InlineText } from "../components/InlineText";

/**
 * What a Lesson's check looks for, collapsed: the course's check items in
 * order. Nothing at all for a Lesson with none.
 */
export function CheckLooksFor({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <Disclosure
      variant="quiet"
      summary="What the check looks for"
      count={{
        value: items.length,
        label:
          items.length === 1 ? "1 check" : `${String(items.length)} checks`,
      }}
    >
      <ol className="grid list-decimal gap-1 pl-5" data-check-items="">
        {items.map((item, i) => (
          <li key={i}>
            <InlineText text={item} />
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}
