// "Pip ready": the moment the app has done its part of Pip's cold start. The
// first Pip's rig is instantiated, its view model bound and its first frame
// requested, so it is ready to draw. How long the GPU then takes to finish
// that frame is not the app's to control, and is not in this mark.

/** The performance mark's name, read by the cold-start budget. */
export const PIP_READY_MARK = "pip-ready";

/** Marks the first Pip ready to draw, once per page. */
export function markPipReady(): void {
  if (performance.getEntriesByName(PIP_READY_MARK, "mark").length === 0)
    performance.mark(PIP_READY_MARK);
}
