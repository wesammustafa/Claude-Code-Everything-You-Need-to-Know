// Every rule the suite runs, in report order.
import * as internalLinks from './internal-links.mjs';
import * as anchorDiff from './anchor-diff.mjs';
import * as stubPaths from './stub-paths.mjs';
import * as stamps from './stamps.mjs';
import * as editionGate from './edition-gate.mjs';
import * as expiry from './expiry.mjs';

export const rules = [internalLinks, anchorDiff, stubPaths, stamps, editionGate, expiry];
