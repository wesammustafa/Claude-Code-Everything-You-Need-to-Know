// The actions: the only inputs a browser can send (the spec's catalogue,
// "Actions, events and the snapshot"). No action names a command, a script
// or a file to read: a Check is chosen by Lesson id from the course file.
// An action the Learner's place does not allow changes nothing. Types only.
import type { FolderKey, LessonId } from "./common";
import type { EventId } from "./events";

/** The Learner read the welcome. */
export interface WelcomeFinishAction {
  type: "welcome.finish";
}

/** Resume the Lesson's play, or show its overview. */
export interface LessonOpenAction {
  type: "lesson.open";
  lesson: LessonId;
}

/** Start the overview's Lesson with the planned help, or with less help. */
export interface LessonStartAction {
  type: "lesson.start";
  help: "planned" | "less";
}

/** Start the Lesson over from its overview; the browser confirms first. */
export interface LessonRestartAction {
  type: "lesson.restart";
  lesson: LessonId;
}

/** From Lesson complete, on to the next Lesson. */
export interface LessonNextAction {
  type: "lesson.next";
}

/** Open the folder answer for `key`, or edit the one open. */
export interface FolderAskAction {
  type: "folder.ask";
  key: FolderKey;
}

/** Answer where `key`'s Lessons run: the Practice copy, or another folder. */
export interface FolderChooseAction {
  type: "folder.choose";
  key: FolderKey;
  to: "practice-copy" | { path: string };
}

/** Drop the folder answer being checked. */
export interface FolderCancelAction {
  type: "folder.cancel";
}

/** On from a done beat. */
export interface StepContinueAction {
  type: "step.continue";
}

/** Back one beat, or to the step before. */
export interface StepBackAction {
  type: "step.back";
}

/** Skip an optional step. */
export interface StepSkipAction {
  type: "step.skip";
}

/** Go back to the earlier step the snapshot's back offer names. */
export interface StepRevisitAction {
  type: "step.revisit";
}

/** Pick an answer: `option` is its index in the beat's options. */
export interface AnswerPickAction {
  type: "answer.pick";
  option: number;
}

/** Show the answer. */
export interface AnswerRevealAction {
  type: "answer.reveal";
}

/** A typed answer, at most 200 characters; an empty one shows the answer. */
export interface AnswerTypeAction {
  type: "answer.type";
  text: string;
}

/** The Learner says a self-checked beat is done. */
export interface StepMarkDoneAction {
  type: "step.markDone";
}

/** "The session has ended", on a beat that waits for it. */
export interface SessionEndedAction {
  type: "session.ended";
}

/** Check again: run the step's Check now. */
export interface CheckRunAction {
  type: "check.run";
}

/** The next hint, or the question before the exact command. */
export interface HintNextAction {
  type: "hint.next";
}

/** The answer to "show the exact command?". */
export interface HintTakeExactAction {
  type: "hint.takeExact";
  take: boolean;
}

/** The answer to the question a long wait offers: `option` is its index. */
export interface WaitQuestionAnswerAction {
  type: "waitQuestion.answer";
  option: number;
}

/** Take the Step-down's lower help. */
export interface StepDownAcceptAction {
  type: "stepDown.accept";
}

/** Take the Step-down with one tier more help from this step on. */
export interface StepDownMoreHelpAction {
  type: "stepDown.moreHelp";
}

/** Back from the Step-down to the step before. */
export interface StepDownBackAction {
  type: "stepDown.back";
}

/** A tab showed the pending milestone with this ID. */
export interface MilestoneShownAction {
  type: "milestone.shown";
  id: EventId;
}

/** Every action a browser can send. */
export type QuestAction =
  | WelcomeFinishAction
  | LessonOpenAction
  | LessonStartAction
  | LessonRestartAction
  | LessonNextAction
  | FolderAskAction
  | FolderChooseAction
  | FolderCancelAction
  | StepContinueAction
  | StepBackAction
  | StepSkipAction
  | StepRevisitAction
  | AnswerPickAction
  | AnswerRevealAction
  | AnswerTypeAction
  | StepMarkDoneAction
  | SessionEndedAction
  | CheckRunAction
  | HintNextAction
  | HintTakeExactAction
  | WaitQuestionAnswerAction
  | StepDownAcceptAction
  | StepDownMoreHelpAction
  | StepDownBackAction
  | MilestoneShownAction;

export type QuestActionType = QuestAction["type"];

/** The actions the engine reduces: the host handles `milestone.shown`. */
export type EngineAction = Exclude<QuestAction, MilestoneShownAction>;
