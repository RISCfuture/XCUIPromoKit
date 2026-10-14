/** One result of a compliance check. */
export type Finding = {
  /** The file or storyboard entry checked. */
  subject: string;
  /** What was checked, such as "length" or "alpha". */
  rule: string;
  severity: 'error' | 'warning';
  message: string;
};

export const error = (subject: string, rule: string, message: string): Finding => ({
  subject,
  rule,
  severity: 'error',
  message,
});

export const warning = (subject: string, rule: string, message: string): Finding => ({
  subject,
  rule,
  severity: 'warning',
  message,
});
