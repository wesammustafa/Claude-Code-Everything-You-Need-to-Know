// Synthetic saved-evidence check for the stable reducer-course fixtures.
export const versionSaved = {
  text: "`.practice/version.txt` holds the output of `claude --version`",
  // Saved state under .practice/ is git-ignored, so only a local run can see it.
  local: true,
  check(repo) {
    const text = repo.read(".practice/version.txt");
    // With --dir, this is the Learner's own repository, not the practice copy.
    const save = `run \`claude --version > .practice/version.txt\` in ${repo.dir}, the folder this check reads`;
    if (text === null)
      return `No \`.practice/version.txt\` yet: ${save} (create its \`.practice\` folder first).`;
    if (!text.trim())
      return `\`.practice/version.txt\` is empty. Run \`claude --version\` on its own: if the shell says \`claude\` isn't found, the install folder isn't on your PATH yet (lesson 1 links the fix). Then ${save}.`;
    if (!/^\d+\.\d+\.\d+ \(Claude Code\)/m.test(text))
      return `\`.practice/version.txt\` should hold a line such as \`2.1.0 (Claude Code)\`. To save it again, ${save}.`;
    return true;
  },
};
