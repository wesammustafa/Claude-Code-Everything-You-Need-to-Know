import type { FolderQuestion as Question } from "@quest/contract";
import { Button } from "../components/Button";
import { FolderForm } from "../components/FolderForm";
import { useActionProps, useSend } from "../live/useAction";
import { workFolderLabel } from "./folderWords";
import { useCourseSnapshot } from "./lesson";

/**
 * The overview's Work folder question (ticket 252): the form while it asks
 * or an answer is edited, then the answer with Change, which opens it again
 * (`folder.ask`).
 */
export function FolderQuestion({ question }: { question: Question }) {
  const practiceCopy = useCourseSnapshot()?.learner.practiceCopy ?? "";
  const change = useActionProps("folder.ask", {
    type: "folder.ask",
    key: question.key,
  });
  const send = useSend();
  if (question.open || question.current === null)
    return (
      <FolderForm
        key={question.key}
        folderKey={question.key}
        asks={question.asks}
        practiceCopy={practiceCopy}
        problem={question.problem}
        checking={question.checking}
        // Editing a saved answer can be left: the answer stays.
        onCancel={
          question.current !== null && !question.checking
            ? () => {
                send("folder.cancel", { type: "folder.cancel" });
              }
            : undefined
        }
      />
    );
  return (
    <p className="flex flex-wrap items-center gap-2.5">
      <span>
        Work folder: {workFolderLabel(question.current, practiceCopy)}
      </span>
      <Button variant="ghost" size="sm" {...change}>
        Change
      </Button>
    </p>
  );
}
