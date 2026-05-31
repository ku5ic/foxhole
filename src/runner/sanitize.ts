// Removes characters that break markdown rendering when selectors appear in output.
// Backticks break inline code spans; angle brackets break tag detection in some renderers.
function sanitizeSelector(selector: string): string {
  return selector.replaceAll(/[<>`]/g, "").slice(0, 200);
}

export { sanitizeSelector };
