// Every rule the suite runs, in report order.
import * as internalLinks from './internal-links.mjs';
import * as anchorDiff from './anchor-diff.mjs';
import * as stubPaths from './stub-paths.mjs';

export const rules = [internalLinks, anchorDiff, stubPaths];
