/**
 * Text helpers shared by the validator phases.
 *
 * Both exist because generated documentation routinely contains ADR headings,
 * rule headers, and Core Mandate lines inside examples. Matching the raw file
 * would mistake documentation ABOUT the contract for the contract itself.
 */

export function stripHtmlComments(text) {
  // Remove HTML comments, tolerating unclosed ones. A stray `<!--` from an
  // editor's "comment selection" must not silently hide every ADR after it.
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!--[\s\S]*$/, '');
}

/**
 * Removes fenced code blocks so that examples inside documentation are not
 * mistaken for real content. Without this, a rule file whose only H1 and
 * "Core Mandate" lines sit inside a ```md fence satisfies both checks, and a
 * `#### ADR-001` shown as an example is counted as a real decision.
 */
export function stripFencedCode(text) {
  return text.replace(/^([ \t]*)(```|~~~)[\s\S]*?^\1\2[ \t]*$/gm, '');
}

export default { stripHtmlComments, stripFencedCode };
