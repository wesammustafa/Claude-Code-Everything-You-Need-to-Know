// Part of linkcheck.
import { findLinks } from './links.js';

export function countLinks(markdown) {
  return findLinks(markdown).length;
}
