// Every rule the suite runs, in report order.
import * as internalLinks from './internal-links.mjs';
import * as anchorDiff from './anchor-diff.mjs';
import * as stubPaths from './stub-paths.mjs';
import * as stamps from './stamps.mjs';
import * as editionGate from './edition-gate.mjs';
import * as expiry from './expiry.mjs';
import * as emDash from './em-dash.mjs';
import * as images from './images.mjs';
import * as lessonLint from './lesson-lint.mjs';
import * as staticValidation from './static-validation.mjs';
import * as inertness from './inertness.mjs';
import * as smokeTests from './smoke-tests.mjs';
import * as externalLinks from './external-links.mjs';
import * as drift from './drift.mjs';

export const rules = [internalLinks, anchorDiff, stubPaths, stamps, editionGate, expiry, emDash, images, lessonLint, staticValidation, inertness, smokeTests, externalLinks, drift];
