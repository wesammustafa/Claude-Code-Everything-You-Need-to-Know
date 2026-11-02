// "Pip ready": the moment the app has done its part of Pip's cold start. The
// first Pip's rig is loaded on the runtime (file, artboard and state machine
// set up, the view model in the file), on Rive's Load event, before Rive draws
// frame 0. How long the GPU takes to draw that frame is not the app's to
// control, and is not in this mark (ticket 294).

/** The performance mark's name, read by the cold-start budget. */
export const PIP_READY_MARK = "pip-ready";

/** Marks the first Pip ready to draw, once per page. */
export function markPipReady(): void {
  if (performance.getEntriesByName(PIP_READY_MARK, "mark").length === 0)
    performance.mark(PIP_READY_MARK);
}
